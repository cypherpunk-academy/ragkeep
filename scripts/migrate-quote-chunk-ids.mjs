#!/usr/bin/env node
/**
 * Migriert quote chunk_ids von SHA1 → UUIDv5.
 *
 * Die neue ID basiert auf: QUOTE_CHUNK_NAMESPACE_UUID + sourceId + contentHash
 * contentHash = SHA1 des gespeicherten Texts (Quote + Erklärung).
 *
 * Quellen:
 *   books/{bookDir}/results/rag-chunks/quotes-chunks.jsonl
 *   lectures/chunks/quotes/{id}.quotes.jsonl
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

// Muss mit QUOTE_CHUNK_NAMESPACE_UUID in ragprep/src/utils/chunkId.ts übereinstimmen.
const QUOTE_CHUNK_NAMESPACE_UUID = 'f1e2d3c4-b5a6-4789-90ab-cdef01234567';

// ── UUIDv5-Implementierung ────────────────────────────────────────────────────

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
    bytes[6] = (bytes[6] & 0x0f) | 0x50;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    return formatUuid(bytes);
}

function computeContentHash(text) {
    return crypto.createHash('sha1').update(text, 'utf8').digest('hex');
}

function buildQuoteChunkId(sourceId, contentHash) {
    return buildUuidV5(`${sourceId}:${contentHash}`, QUOTE_CHUNK_NAMESPACE_UUID);
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

            // content_hash aus Metadaten verwenden oder frisch berechnen
            const contentHash =
                (typeof md.content_hash === 'string' && md.content_hash.trim())
                    ? md.content_hash.trim()
                    : computeContentHash(String(chunk.text ?? ''));

            md.chunk_id = buildQuoteChunkId(sourceId, contentHash);
            patched++;
            return JSON.stringify(chunk);
        } catch {
            return line;
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

    // books/{bookDir}/results/rag-chunks/quotes-chunks.jsonl
    const booksDir = path.join(repoRoot, 'books');
    if (fs.existsSync(booksDir)) {
        for (const entry of fs.readdirSync(booksDir, { withFileTypes: true })) {
            if (!entry.isDirectory()) continue;
            const candidate = path.join(
                booksDir,
                entry.name,
                'results',
                'rag-chunks',
                'quotes-chunks.jsonl',
            );
            if (fs.existsSync(candidate)) results.push(candidate);
        }
    }

    // lectures/chunks/quotes/{id}.quotes.jsonl
    const lectureQuotesDir = path.join(repoRoot, 'lectures', 'chunks', 'quotes');
    if (fs.existsSync(lectureQuotesDir)) {
        for (const f of fs.readdirSync(lectureQuotesDir)) {
            if (f.endsWith('.jsonl')) {
                results.push(path.join(lectureQuotesDir, f));
            }
        }
    }

    return results;
}

// ── Hauptlauf ─────────────────────────────────────────────────────────────────

const files = findFiles();
console.log(`migrate-quote-chunk-ids: ${files.length} Datei(en) gefunden.\n`);

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
