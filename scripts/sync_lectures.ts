#!/usr/bin/env node
// sync_lectures.ts
// Reads the lecture catalog + cycle YAML, UPSERTs into rag_lecture_catalog
// and rag_lecture_cycles, then queries rag_chunks to find which lectures
// have chunks and UPSERTs those into rag_sources.
//
// Called from pre-push hook with: sync_lectures.ts <local_sha> <remote_sha>
// With --all flag: syncs everything regardless of git diff.

import pg from 'pg';
import yaml from 'js-yaml';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const RAGRUN_ROOT = join(REPO_ROOT, '..');

function resolveSteineroriginalsRoot(): string {
  if (process.env.STEINERORIGINALS_ROOT) return process.env.STEINERORIGINALS_ROOT;
  // Sibling directory (same level as ragrun)
  const sibling = join(RAGRUN_ROOT, '..', 'steineroriginals');
  if (existsSync(sibling)) return sibling;
  throw new Error('steineroriginals not found. Set STEINERORIGINALS_ROOT or clone as sibling of ragrun.');
}

const CATALOG_PATH = join(resolveSteineroriginalsRoot(), 'rudolf-steiner-ga-lecture-catalog.yaml');
const CYCLES_PATH = join(REPO_ROOT, 'lectures', 'rudolf-steiner-ga-vortrag-zyklus.yaml');
const GA_TITLES_PATH = join(REPO_ROOT, 'lectures', 'ga-titles.json');
const NULL_SHA = '0000000000000000000000000000000000000000';

const RAW_DSN = process.env.RAGRUN_POSTGRES_DSN;
if (!RAW_DSN) {
  console.error('sync_lectures: RAGRUN_POSTGRES_DSN must be set in .env');
  process.exit(1);
}
const DSN = RAW_DSN.replace(/^postgresql\+[^:]+:\/\//, 'postgresql://');

// ── Types ────────────────────────────────────────────────────────────────────

type CatalogEntry = {
  id: string;          // YYYYMMDD[a-z]
  uuid: string;
  datum: string;       // DD.MM.YYYY
  jahr: string;
  ort: string;
  vortragstitel: string;
  ga: string;
  reihe?: string;
  zyklus?: number;
  anlass?: string;
};

type CycleEntry = {
  zyklus: number;
  titel: string;
  'vorträge': number;
};

type CatalogYaml = { lectures: CatalogEntry[] };
type CyclesYaml = { zyklen: CycleEntry[] };

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Parse DD.MM.YYYY → YYYY-MM-DD (ISO date for Postgres), or null if unparseable */
function parseDatum(datum: string): string | null {
  const match = datum.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

/** Parse year from catalog jahr field */
function parseYear(jahr: string): number | null {
  const n = parseInt(jahr, 10);
  return isNaN(n) ? null : n;
}

// ── GA title lookup ──────────────────────────────────────────────────────────

const GA_TITLES: Record<string, string> = JSON.parse(readFileSync(GA_TITLES_PATH, 'utf8'));

function lookupGaTitle(ga: string | number | undefined): string | null {
  if (ga == null) return null;
  const gaStr = String(ga);
  // Try first GA for comma-separated entries like "280,295"
  const first = gaStr.split(',')[0].trim();
  return GA_TITLES[first] ?? null;
}

const GENERIC_TITLE_RE = /^(Vortrag \d+|Erster |Zweiter |Dritter |Vierter |Fünfter |Sechster |Siebenter |Achter |Neunter |Zehnter |Elfter |Zwölfter |Dreizehnter |Vierzehnter )/;

function buildDisplayTitle(
  entry: CatalogEntry,
  cyclesByNr: Map<number, string>,
  duplicateTitles: Set<string>,
): string {
  const title = entry.vortragstitel?.trim() || '';
  const isGeneric = GENERIC_TITLE_RE.test(title);
  const location = `${entry.ort}, ${entry.datum}`;
  const cycleTitle = entry.zyklus ? cyclesByNr.get(entry.zyklus) ?? null : null;
  // Band title only — never embed "GA n" in display titles (ga stays a separate DB field).
  const gaTitle = lookupGaTitle(entry.ga);
  const anlass = entry.anlass?.trim() || '';

  if (title && !isGeneric) {
    return duplicateTitles.has(title) ? `${title} (${location})` : title;
  }
  if (title && isGeneric) {
    if (cycleTitle) return `${cycleTitle} — ${title}`;
    if (gaTitle) return `${gaTitle} — ${title}`;
    return `${title} (${location})`;
  }
  // Titleless: prefer anlass (with location — anlass repeats across dates), else cycle/GA band, else catalog id.
  if (anlass) {
    return `${anlass} (${location})`;
  }
  if (cycleTitle) return `${cycleTitle} — ${location}`;
  if (gaTitle) return `${gaTitle} — ${location}`;
  return `Vortrag ${entry.id} — ${location}`;
}

// ── Git diff ─────────────────────────────────────────────────────────────────

function hasCatalogChanges(remoteSha: string, localSha: string): boolean {
  try {
    const out = execSync(
      `git diff --name-only ${remoteSha} ${localSha} -- 'ragkeep/lectures/rudolf-steiner-ga-vortrag-zyklus.yaml'`,
      { cwd: RAGRUN_ROOT, encoding: 'utf8' },
    );
    return out.trim().length > 0;
  } catch {
    return true; // on error, assume changes
  }
}

// ── DB operations ────────────────────────────────────────────────────────────

async function syncAll(client: pg.Client): Promise<void> {
  // 1. Load catalog YAML
  const catalog = yaml.load(readFileSync(CATALOG_PATH, 'utf8')) as CatalogYaml;
  const lectures = catalog.lectures;
  console.log(`sync_lectures: ${lectures.length} catalog entries loaded`);

  // 2. Load cycles YAML
  const cyclesYaml = yaml.load(readFileSync(CYCLES_PATH, 'utf8')) as CyclesYaml;
  const cycles = cyclesYaml.zyklen;
  console.log(`sync_lectures: ${cycles.length} cycles loaded`);

  // 3. UPSERT cycles
  for (const c of cycles) {
    await client.query(
      `INSERT INTO rag_lecture_cycles (zyklus, titel, vortraege)
       VALUES ($1, $2, $3)
       ON CONFLICT (zyklus) DO UPDATE SET
         titel = EXCLUDED.titel,
         vortraege = EXCLUDED.vortraege`,
      [c.zyklus, c.titel, c['vorträge']],
    );
  }
  console.log(`sync_lectures: ${cycles.length} cycles upserted`);

  // 4. UPSERT catalog entries (batch via single transaction)
  await client.query('BEGIN');
  for (const l of lectures) {
    await client.query(
      `INSERT INTO rag_lecture_catalog (id, uuid, datum, lecture_date, ort, vortragstitel, ga, reihe, zyklus, anlass)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET
         uuid          = EXCLUDED.uuid,
         datum         = EXCLUDED.datum,
         lecture_date  = EXCLUDED.lecture_date,
         ort           = EXCLUDED.ort,
         vortragstitel = EXCLUDED.vortragstitel,
         ga            = EXCLUDED.ga,
         reihe         = EXCLUDED.reihe,
         zyklus        = EXCLUDED.zyklus,
         anlass        = EXCLUDED.anlass`,
      [l.id.toString(), l.uuid, l.datum, parseDatum(l.datum), l.ort ?? null, l.vortragstitel ?? null, l.ga?.toString() ?? null, l.reihe ?? null, l.zyklus ?? null, l.anlass ?? null],
    );
  }
  await client.query('COMMIT');
  console.log(`sync_lectures: ${lectures.length} catalog entries upserted`);

  // 5. Query DB for lecture source_ids that have chunks
  const chunked = await client.query(`
    SELECT DISTINCT rc.source_id
    FROM rag_chunks rc
    INNER JOIN rag_lecture_catalog lc ON lc.uuid::text = rc.source_id
  `);
  const chunkedIds = new Set(chunked.rows.map((r: { source_id: string }) => r.source_id));
  console.log(`sync_lectures: ${chunkedIds.size} lectures have chunks in DB`);

  // 6. Update has_chunks flag (reset all, then set matched)
  await client.query('UPDATE rag_lecture_catalog SET has_chunks = false WHERE has_chunks = true');
  if (chunkedIds.size > 0) {
    await client.query(
      `UPDATE rag_lecture_catalog SET has_chunks = true WHERE uuid::text = ANY($1)`,
      [Array.from(chunkedIds)],
    );
  }

  // 7. Build rag_sources entries for chunked lectures
  const catalogByUuid = new Map(lectures.map(l => [l.uuid, l]));
  const cyclesByNr = new Map(cycles.map(c => [c.zyklus, c.titel]));

  // Find duplicate vortragstitel among chunked lectures
  const titleCounts = new Map<string, number>();
  for (const sourceId of chunkedIds) {
    const entry = catalogByUuid.get(sourceId);
    const t = entry?.vortragstitel?.trim();
    if (t && !GENERIC_TITLE_RE.test(t)) {
      titleCounts.set(t, (titleCounts.get(t) ?? 0) + 1);
    }
  }
  const duplicateTitles = new Set(
    [...titleCounts.entries()].filter(([, c]) => c > 1).map(([t]) => t),
  );
  if (duplicateTitles.size > 0) {
    console.log(`sync_lectures: ${duplicateTitles.size} duplicate titles will be disambiguated`);
  }

  let upsertedSources = 0;
  for (const sourceId of chunkedIds) {
    const entry = catalogByUuid.get(sourceId);
    const title = entry
      ? buildDisplayTitle(entry, cyclesByNr, duplicateTitles)
      : '(unknown lecture)';
    const year = entry ? parseYear(entry.jahr) : null;
    const ga = entry?.ga?.toString() ?? null;

    await client.query(
      `INSERT INTO rag_sources (id, title, author, year, language, is_primary, sort_order, source_type, ga, updated_at)
       VALUES ($1, $2, 'Rudolf Steiner', $3, 'de', false, 1000, 'lecture', $4, now())
       ON CONFLICT (id) DO UPDATE SET
         title       = EXCLUDED.title,
         author      = EXCLUDED.author,
         year        = EXCLUDED.year,
         source_type = EXCLUDED.source_type,
         ga          = EXCLUDED.ga,
         updated_at  = now()`,
      [sourceId, title, year, ga],
    );
    upsertedSources++;
  }
  console.log(`sync_lectures: ${upsertedSources} lecture sources upserted into rag_sources`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const forceAll = process.argv.includes('--all');
  const localSha = process.argv[2];
  const remoteSha = process.argv[3];

  if (!forceAll && localSha && remoteSha && remoteSha !== NULL_SHA) {
    if (!hasCatalogChanges(remoteSha, localSha)) {
      console.log('sync_lectures: no catalog changes, skipping.');
      return;
    }
  }

  const client = new pg.Client({ connectionString: DSN });
  await client.connect();
  try {
    await syncAll(client);
  } finally {
    await client.end();
  }
  console.log('sync_lectures: done.');
}

main().catch((e) => {
  console.error('sync_lectures failed:', e.message ?? e);
  process.exit(1);
});
