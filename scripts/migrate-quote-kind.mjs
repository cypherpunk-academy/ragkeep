#!/usr/bin/env node
/**
 * Setzt quote_kind: "author" in allen bestehenden Quote-Chunks,
 * die das Feld noch nicht haben.
 *
 * Quellen:
 *   books/{bookDir}/results/rag-chunks/quotes-chunks.jsonl
 *   lectures/chunks/quotes/{id}.quotes.jsonl
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

function patchFile(filePath) {
    const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
    let patched = 0;
    const out = lines.map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return line;
        try {
            const chunk = JSON.parse(trimmed);
            if (chunk?.metadata && chunk.metadata.quote_kind === undefined) {
                chunk.metadata.quote_kind = 'author';
                patched += 1;
                return JSON.stringify(chunk);
            }
        } catch {
            // malformed line – leave as is
        }
        return line;
    });
    if (patched > 0) {
        fs.writeFileSync(filePath, out.join('\n'), 'utf-8');
        console.log(`  patched ${patched} chunk(s): ${path.relative(repoRoot, filePath)}`);
    } else {
        console.log(`  already up-to-date: ${path.relative(repoRoot, filePath)}`);
    }
    return patched;
}

function findFiles() {
    const results = [];

    // books/*/results/rag-chunks/quotes-chunks.jsonl
    const booksDir = path.join(repoRoot, 'books');
    if (fs.existsSync(booksDir)) {
        for (const entry of fs.readdirSync(booksDir, { withFileTypes: true })) {
            if (!entry.isDirectory()) continue;
            const candidate = path.join(booksDir, entry.name, 'results', 'rag-chunks', 'quotes-chunks.jsonl');
            if (fs.existsSync(candidate)) results.push(candidate);
        }
    }

    // lectures/chunks/quotes/*.quotes.jsonl
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

const files = findFiles();
console.log(`migrate-quote-kind: ${files.length} Datei(en) gefunden.\n`);

let totalPatched = 0;
for (const f of files) {
    totalPatched += patchFile(f);
}

console.log(`\nFertig. ${totalPatched} Chunk(s) insgesamt mit quote_kind: "author" versehen.`);
