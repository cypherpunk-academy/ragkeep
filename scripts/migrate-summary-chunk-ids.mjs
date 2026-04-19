#!/usr/bin/env node
/**
 * Migriert chapter_summary chunk_ids von SHA1 → UUIDv5.
 *
 * Die neue ID basiert auf:  SUMMARY_CHUNK_NAMESPACE_UUID + sourceId + segmentId
 * (segmentId = Kapitel-Slug, z.B. "erster-vortrag-berlin-20-januar-1914").
 * Damit bleibt die ID stabil, wenn eine Zusammenfassung neu generiert wird.
 *
 * Quellen:
 *   books/{bookDir}/results/rag-chunks/summaries-chunks.jsonl
 *   lectures/chunks/summaries/{id}.summaries.jsonl
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

// Muss mit SUMMARY_CHUNK_NAMESPACE_UUID in ragprep/src/utils/chunkId.ts übereinstimmen.
const SUMMARY_CHUNK_NAMESPACE_UUID = 'e8f3c4b2-7a91-4d5e-b0c3-2f6e8a9b1c4d';

// ── UUIDv5-Implementierung (analog zu buildUuidV5 in chunkId.ts) ──────────────

function uuidToBytes(uuid) {
    const hex = uuid.replace(/-/g, '').toLowerCase();
    if (hex.length !== 32) throw new Error(`Invalid UUID: ${uuid}`);
    const out = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
        out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return out;
}

function formatUuid(bytes) {
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
    return [
        hex.slice(0, 4).join(''),
        hex.slice(4, 6).join(''),
        hex.slice(6, 8).join(''),
        hex.slice(8, 10).join(''),
        hex.slice(10, 16).join(''),
    ].join('-');
}

function buildUuidV5(name, namespace) {
    const nsBytes = uuidToBytes(namespace);
    const nameBytes = Buffer.from(name, 'utf8');
    const data = Buffer.concat([Buffer.from(nsBytes), nameBytes]);
    const hash = crypto.createHash('sha1').update(data).digest();
    const bytes = new Uint8Array(hash.subarray(0, 16));
    bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
    return formatUuid(bytes);
}

function buildSummaryChunkId(sourceId, segmentId) {
    return buildUuidV5(`${sourceId}:${segmentId}`, SUMMARY_CHUNK_NAMESPACE_UUID);
}

// ── Hilfsfunktionen ──────────────────────────────────────────────────────────

function isUuidV5(id) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[ab89][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

function patchFile(filePath) {
    const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
    let patched = 0;
    let skipped = 0;
    const out = lines.map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return line;
        try {
            const chunk = JSON.parse(trimmed);
            const md = chunk?.metadata;
            if (!md) return line;

            const chunkId = md.chunk_id;
            if (typeof chunkId === 'string' && isUuidV5(chunkId)) {
                skipped++;
                return line; // bereits migriert
            }

            const sourceId = md.source_id;
            if (!sourceId || typeof sourceId !== 'string') return line;

            // segmentId bevorzugen; Fallback auf source_index (Kapitel-Nummer)
            const segmentId =
                (typeof md.segment_id === 'string' && md.segment_id.trim())
                    ? md.segment_id.trim()
                    : String(md.source_index ?? md.chapter_index ?? 0);

            md.chunk_id = buildSummaryChunkId(sourceId, segmentId);
            patched++;
            return JSON.stringify(chunk);
        } catch {
            return line; // malformed line – unverändert lassen
        }
    });

    if (patched > 0) {
        fs.writeFileSync(filePath, out.join('\n'), 'utf-8');
        console.log(`  ✓ ${patched} migriert, ${skipped} bereits ok: ${path.relative(repoRoot, filePath)}`);
    } else {
        console.log(`  – Keine Änderung (${skipped} bereits ok): ${path.relative(repoRoot, filePath)}`);
    }
    return { patched, skipped };
}

function findFiles() {
    const results = [];

    // books/{bookDir}/results/rag-chunks/summaries-chunks.jsonl
    const booksDir = path.join(repoRoot, 'books');
    if (fs.existsSync(booksDir)) {
        for (const entry of fs.readdirSync(booksDir, { withFileTypes: true })) {
            if (!entry.isDirectory()) continue;
            const candidate = path.join(
                booksDir,
                entry.name,
                'results',
                'rag-chunks',
                'summaries-chunks.jsonl',
            );
            if (fs.existsSync(candidate)) results.push(candidate);
        }
    }

    // lectures/chunks/summaries/{id}.summaries.jsonl
    const lecturesSummariesDir = path.join(repoRoot, 'lectures', 'chunks', 'summaries');
    if (fs.existsSync(lecturesSummariesDir)) {
        for (const f of fs.readdirSync(lecturesSummariesDir)) {
            if (f.endsWith('.jsonl')) {
                results.push(path.join(lecturesSummariesDir, f));
            }
        }
    }

    return results;
}

// ── Hauptlauf ─────────────────────────────────────────────────────────────────

const files = findFiles();
console.log(`migrate-summary-chunk-ids: ${files.length} Datei(en) gefunden.\n`);

let totalPatched = 0;
let totalSkipped = 0;
for (const f of files) {
    const { patched, skipped } = patchFile(f);
    totalPatched += patched;
    totalSkipped += skipped;
}

console.log(
    `\nFertig. ${totalPatched} Chunk(s) migriert, ${totalSkipped} bereits mit UUIDv5.`,
);
