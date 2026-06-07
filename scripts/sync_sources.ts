#!/usr/bin/env node
// sync_sources.ts
// Reads all book-manifest.yaml and assistant-manifest.yaml files, builds the
// rag_sources catalogue, and UPSERTs into Supabase via direct Postgres connection.
//
// is_primary and sort_order are derived from the assistant manifests:
//   primary-books  → is_primary=true,  sort_order 0..N (manifest order)
//   secondary-books → is_primary=false, sort_order 100..M
//   unlisted        → is_primary=false, sort_order 9999
//
// Called from pre-push hook with: sync_sources.ts <local_sha> <remote_sha>
// With --all flag: syncs all books regardless of git diff.

import pg from 'pg';
import yaml from 'js-yaml';
import { readFileSync, readdirSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const BOOKS_DIR = join(REPO_ROOT, 'books');
const ASSISTANTS_DIR = join(REPO_ROOT, 'assistants');
const NULL_SHA = '0000000000000000000000000000000000000000';

const RAW_DSN = process.env.RAGRUN_POSTGRES_DSN;
if (!RAW_DSN) {
  console.error('sync_sources: RAGRUN_POSTGRES_DSN must be set in .env');
  process.exit(1);
}
// pg expects postgresql:// not postgresql+psycopg://
const DSN = RAW_DSN.replace(/^postgresql\+[^:]+:\/\//, 'postgresql://');

// ── Types ────────────────────────────────────────────────────────────────────

type BookManifest = {
  'book-id': string;
  title: string;
  author: string;
  year?: number | null;
  language?: string;
  'book-index'?: number;
};

type AssistantManifest = {
  'primary-books'?: string[];
  'secondary-books'?: string[];
};

type SourceRow = {
  id: string;
  title: string;
  author: string;
  year: number | null;
  language: string;
  book_index: number | null;
  is_primary: boolean;
  sort_order: number;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function readYaml<T>(path: string): T | null {
  try {
    return yaml.load(readFileSync(path, 'utf8')) as T;
  } catch {
    return null;
  }
}

/** book-dir basename → book-id lookup (from all manifests) */
function buildBookDirIndex(): Map<string, string> {
  const index = new Map<string, string>();
  for (const dir of readdirSync(BOOKS_DIR, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const m = readYaml<BookManifest>(join(BOOKS_DIR, dir.name, 'book-manifest.yaml'));
    if (m?.['book-id']) index.set(dir.name, m['book-id']);
  }
  return index;
}

/** Collect all SourceRows from book manifests + assistant manifests. */
function buildSourceRows(): Map<string, SourceRow> {
  // 1. Read all book manifests
  const rows = new Map<string, SourceRow>();
  for (const dir of readdirSync(BOOKS_DIR, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const m = readYaml<BookManifest>(join(BOOKS_DIR, dir.name, 'book-manifest.yaml'));
    if (!m?.['book-id']) continue;
    rows.set(m['book-id'], {
      id: m['book-id'],
      title: m.title ?? '',
      author: m.author ?? '',
      year: m.year ?? null,
      language: m.language ?? 'de',
      book_index: m['book-index'] ?? null,
      is_primary: false,
      sort_order: 9999,
    });
  }

  // 2. Apply assistant manifest ordering (first assistant wins for conflicts)
  const dirIndex = buildBookDirIndex();

  for (const assistantDir of readdirSync(ASSISTANTS_DIR, { withFileTypes: true })) {
    if (!assistantDir.isDirectory()) continue;
    const m = readYaml<AssistantManifest>(
      join(ASSISTANTS_DIR, assistantDir.name, 'assistant-manifest.yaml'),
    );
    if (!m) continue;

    for (const [i, bookDirName] of (m['primary-books'] ?? []).entries()) {
      const id = dirIndex.get(bookDirName);
      if (!id || !rows.has(id)) continue;
      const row = rows.get(id)!;
      if (row.sort_order === 9999) {  // not yet claimed by another assistant
        row.is_primary = true;
        row.sort_order = i;
      }
    }

    for (const [i, bookDirName] of (m['secondary-books'] ?? []).entries()) {
      const id = dirIndex.get(bookDirName);
      if (!id || !rows.has(id)) continue;
      const row = rows.get(id)!;
      if (row.sort_order === 9999) {
        row.is_primary = false;
        row.sort_order = 100 + i;
      }
    }
  }

  return rows;
}

// ── Git diff ─────────────────────────────────────────────────────────────────

function changedBookIds(remoteSha: string, localSha: string, dirIndex: Map<string, string>): Set<string> | 'all' {
  try {
    const out = execSync(
      `git diff --name-only ${remoteSha} ${localSha} -- 'books/' 'assistants/'`,
      { cwd: REPO_ROOT, encoding: 'utf8' },
    );
    const lines = out.split('\n').filter(Boolean);

    // If any assistant manifest changed, re-sync everything (sort_order/is_primary may shift)
    if (lines.some((l) => l.startsWith('assistants/'))) return 'all';

    const ids = new Set<string>();
    for (const line of lines) {
      if (!line.startsWith('books/')) continue;
      const bookDir = line.split('/')[1];
      const id = dirIndex.get(bookDir);
      if (id) ids.add(id);
    }
    return ids;
  } catch {
    return 'all';
  }
}

// ── DB upsert ────────────────────────────────────────────────────────────────

async function upsertSources(rows: SourceRow[]): Promise<void> {
  const client = new pg.Client({ connectionString: DSN });
  await client.connect();
  try {
    for (const r of rows) {
      await client.query(
        `INSERT INTO rag_sources (id, title, author, year, language, book_index, is_primary, sort_order, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())
         ON CONFLICT (id) DO UPDATE SET
           title      = EXCLUDED.title,
           author     = EXCLUDED.author,
           year       = EXCLUDED.year,
           language   = EXCLUDED.language,
           book_index = EXCLUDED.book_index,
           is_primary = EXCLUDED.is_primary,
           sort_order = EXCLUDED.sort_order,
           updated_at = now()`,
        [r.id, r.title, r.author, r.year, r.language, r.book_index, r.is_primary, r.sort_order],
      );
      console.log(`  ✓ ${r.title.slice(0, 55)}`);
    }
  } finally {
    await client.end();
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const forceAll = process.argv.includes('--all');
  const localSha = process.argv[2];
  const remoteSha = process.argv[3];

  const allRows = buildSourceRows();
  const dirIndex = buildBookDirIndex();

  let toSync: SourceRow[];

  if (forceAll || !localSha || !remoteSha || remoteSha === NULL_SHA) {
    toSync = [...allRows.values()];
  } else {
    const changed = changedBookIds(remoteSha, localSha, dirIndex);
    if (changed === 'all') {
      toSync = [...allRows.values()];
    } else if (changed.size === 0) {
      console.log('sync_sources: no manifest changes, skipping.');
      return;
    } else {
      toSync = [...changed].map((id) => allRows.get(id)).filter(Boolean) as SourceRow[];
    }
  }

  console.log(`sync_sources: syncing ${toSync.length} source(s) to Supabase...`);
  await upsertSources(toSync);
  console.log('sync_sources: done.');
}

main().catch((e) => {
  console.error('sync_sources failed:', e.message ?? e);
  process.exit(1);
});
