#!/usr/bin/env node
/**
 * Ergänzt bei allen Chunks in quotes-chunks.jsonl die source_id um ":quotes".
 * Verhindert Kollisionen mit Primary-Book-Chunks beim rag:upload Sync.
 *
 * Betrifft:
 *   - books/<book>/results/rag-chunks/quotes-chunks.jsonl
 *   - lectures/chunks/quotes/<id>.quotes.jsonl (falls vorhanden)
 *
 * Ausführung: Von ragkeep-Root aus.
 * Option: --dry-run  Nur anzeigen, keine Dateien ändern.
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const QUOTES_SUFFIX = ':quotes';

async function findQuotesChunksFiles(booksRoot, lecturesChunksDir) {
  const files = [];
  try {
    const bookDirs = await readdir(booksRoot, { withFileTypes: true });
    for (const d of bookDirs) {
      if (!d.isDirectory()) continue;
      const ragChunksDir = join(booksRoot, d.name, 'results', 'rag-chunks');
      const quotesPath = join(ragChunksDir, 'quotes-chunks.jsonl');
      try {
        const entries = await readdir(ragChunksDir, { withFileTypes: true });
        if (entries.some((e) => e.name === 'quotes-chunks.jsonl')) {
          files.push(quotesPath);
        }
      } catch {
        // Verzeichnis nicht vorhanden
      }
    }
  } catch (err) {
    console.warn('books/ nicht lesbar:', err.message);
  }

  try {
    const quotesDir = join(lecturesChunksDir, 'quotes');
    const entries = await readdir(quotesDir, { withFileTypes: true });
    for (const e of entries) {
      if (e.isFile() && e.name.endsWith('.quotes.jsonl')) {
        files.push(join(quotesDir, e.name));
      }
    }
  } catch {
    // lectures/chunks/quotes/ nicht vorhanden
  }

  return files;
}

function processJsonl(content) {
  return content
    .split(/\r?\n/)
    .filter((ln) => ln.trim().length > 0 && !ln.trim().startsWith('#'))
    .map((ln) => JSON.parse(ln));
}

async function main() {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const ragkeepRoot = join(scriptDir, '..');
  const booksRoot = join(ragkeepRoot, 'books');
  const lecturesChunksDir = join(ragkeepRoot, 'lectures', 'chunks');

  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) {
    console.log('[dry-run] Keine Dateien werden geändert.\n');
  }

  const files = await findQuotesChunksFiles(booksRoot, lecturesChunksDir);
  if (files.length === 0) {
    console.log('Keine quotes-chunks.jsonl Dateien gefunden.');
    return;
  }

  console.log(`Gefunden: ${files.length} Datei(en)\n`);

  let totalUpdated = 0;
  for (const filePath of files) {
    const content = await readFile(filePath, 'utf-8');
    const chunks = processJsonl(content);
    let changed = 0;
    const updated = chunks.map((chunk) => {
      const md = chunk.metadata ?? {};
      const sid = md.source_id ?? md.book_id;
      if (typeof sid !== 'string' || sid.endsWith(QUOTES_SUFFIX)) {
        return chunk;
      }
      changed++;
      return {
        ...chunk,
        metadata: {
          ...md,
          source_id: sid + QUOTES_SUFFIX,
        },
      };
    });

    if (changed > 0) {
      const rel = filePath.replace(ragkeepRoot + '/', '');
      console.log(`${rel}: ${changed}/${chunks.length} Chunks angepasst`);
      totalUpdated += changed;

      if (!dryRun) {
        const lines = updated.map((c) => JSON.stringify(c)).join('\n') + (updated.length ? '\n' : '');
        await writeFile(filePath, lines, 'utf-8');
      }
    }
  }

  if (totalUpdated > 0) {
    console.log(`\nGesamt: ${totalUpdated} Chunk(s) mit :quotes ergänzt.`);
    if (dryRun) {
      console.log('Führe ohne --dry-run aus, um die Änderungen zu speichern.');
    }
  } else {
    console.log('Alle source_ids haben bereits das Suffix :quotes.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
