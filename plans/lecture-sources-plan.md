# Plan: Lecture Sources in rag_sources + GA/Lecture Lookup MCP Tools

## Context

`list_volumes` queries `rag_sources` — but this table only contains books. Lecture chunks use source_ids (bare UUIDs matching the catalog's `uuid` field) that don't exist in `rag_sources`, so:
- `get_passage` LEFT JOINs rag_sources → NULL source_title/author for lectures
- `list_volumes` shows no lectures
- Claude can't navigate from a search hit to the GA volume or cycle

### Source of truth

**The DB** (`rag_chunks`) is the canonical store — not local JSONL files.
- Each environment (Dev, Staging, Prod) holds the **same lecture corpus**: **238 distinct lecture source_ids** (bare UUIDs), totalling **~10 400 chunks**
- The old `lecture:YYYYMMDD[a-z]` format (from an earlier pipeline) no longer exists in the DB
- Local `ragkeep/lectures/chunks/*.jsonl` files are **deprecated legacy cache** and will be deleted — `ragprep` writes chunks directly to Supabase

### Environments

Dev, Staging, and Prod are **peers**: same schema, same catalog, same corpus. Schema, sync, and corpus updates run on all three (Dev first, then Staging, then Prod after approval).

| Env file | Environment | Supabase Ref | Role |
|----------|-------------|--------------|------|
| `.env` / `.env.dev` | **Dev** | `tgxpbgnvbirubzwfrvus` | full corpus; default for local CLI and pre-push |
| `.env.staging` | **Staging** | `duhtxxbynkilpxdpcpsk` | full corpus; integration / MCP QA |
| `.env.production` (alias `.env.prod`) | **Prod** | `rmdqihhjjyizbuhxkxhn` | full corpus; live (Railway) |

The pre-push hook uses `.env` → targets **Dev** only. Staging and Prod are synced with the **same** commands via `--env-file` — not a reduced schema-only Staging.

**Decision**: Full catalog (5163) into `rag_lecture_catalog` table + chunked lectures (identified via DB query) also into `rag_sources`. `list_volumes` stays books-only; lectures are accessed via new tools.

---

## 1. Schema Changes (Supabase Migration)

**File**: New migration `supabase/migrations/019_lecture_catalog.sql`

### 1a. Add columns to `rag_sources`

```sql
ALTER TABLE rag_sources ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'book';
ALTER TABLE rag_sources ADD COLUMN IF NOT EXISTS ga text;
CREATE INDEX IF NOT EXISTS idx_rag_sources_ga ON rag_sources (ga) WHERE ga IS NOT NULL;
```

### 1b. New table `rag_lecture_catalog`

```sql
CREATE TABLE IF NOT EXISTS rag_lecture_catalog (
    id text PRIMARY KEY,             -- YYYYMMDD[a-z]
    uuid text UNIQUE NOT NULL,
    datum text NOT NULL,             -- DD.MM.YYYY (original format)
    lecture_date date NOT NULL,      -- parsed date for ordering
    ort text NOT NULL,
    vortragstitel text NOT NULL,
    ga text NOT NULL,
    reihe text,
    zyklus integer,
    anlass text,
    has_chunks boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_lecture_catalog_ga ON rag_lecture_catalog (ga);
```

### 1c. New table `rag_lecture_cycles`

```sql
CREATE TABLE IF NOT EXISTS rag_lecture_cycles (
    zyklus integer PRIMARY KEY,
    titel text NOT NULL,
    vortraege integer NOT NULL
);
```

RLS: All three readable by `authenticated`, no INSERT/UPDATE/DELETE from client.

---

## 2. Sync Script: `ragkeep/scripts/sync_lectures.ts`

**Pattern**: Same as `sync_sources.ts` (raw `pg`, `RAGRUN_POSTGRES_DSN`, `--all` flag).

### Logic

1. Parse lecture catalog YAML (5163 entries) → UPSERT all into `rag_lecture_catalog`
2. Parse cycle catalog YAML (50 entries) → UPSERT all into `rag_lecture_cycles`
3. **Query the DB** to find which lectures have chunks:
   ```sql
   SELECT DISTINCT source_id FROM rag_chunks
   WHERE source_id IN (SELECT uuid FROM rag_lecture_catalog)
   ```
   - Mark `has_chunks = true` in `rag_lecture_catalog` for matched UUIDs
   - UPSERT into `rag_sources`:
     - `id` = source_id (UUID from DB)
     - `title` = vortragstitel from catalog (or chunk metadata if no catalog match)
     - `author` = 'Rudolf Steiner'
     - `year` = extracted from catalog `datum`
     - `language` = 'de'
     - `is_primary` = false
     - `sort_order` = 1000 (all lectures after books)
     - `source_type` = 'lecture'
     - `ga` = GA from catalog

### Source ID mapping

- All Prod source_ids are bare UUIDs → catalog lookup by `uuid`
- Orphans (no catalog match) → create minimal rag_sources entry from chunk metadata

### SSOT & Git-diff mode

The lecture catalog YAML lives in `steineroriginals/rudolf-steiner-ga-lecture-catalog.yaml`.
SSOT is the upstream repo: `https://github.com/steineroriginals/steineroriginals.git`.

Like `sync_sources.ts`, `sync_lectures.ts` supports two modes:

| Mode | Trigger | Behavior |
|------|---------|----------|
| `--all` | Manual: `npx tsx scripts/sync_lectures.ts --all` | Full UPSERT of catalog + cycles + has_chunks |
| Git-diff | Pre-push hook: `sync_lectures.ts <local_sha> <remote_sha>` | Only sync if `steineroriginals/rudolf-steiner-ga-lecture-catalog.yaml` or `ragkeep/lectures/rudolf-steiner-ga-vortrag-zyklus.yaml` changed in the diff; no-op otherwise |

### Pre-push hook integration

Add to `ragkeep/scripts/hooks/pre-push` (after the existing `sync_sources` + `upload_covers` blocks):

```bash
echo "▶ Syncing lectures..."
node --env-file "$ENV_FILE" --import tsx "$REPO_ROOT/scripts/sync_lectures.ts" "$PUSH_LOCAL_SHA" "$PUSH_REMOTE_SHA"
echo "✓ Lectures synchronisiert"
```

This ensures Prod never falls behind the local catalog state when pushing to main.

---

## 3. MCP Tool Changes

**File**: `app/mcp_server/tools.py`

### 3a. `get_lecture_info(source_id: str) -> dict`

Lookup GA number, cycle, location, date for a lecture.

SQL approach:
- Query `rag_lecture_catalog WHERE uuid = :source_id`
- LEFT JOIN `rag_lecture_cycles` on `zyklus` for cycle title
- Return: `{ lecture_id, ga, vortragstitel, datum, ort, reihe, zyklus, zyklus_titel, has_chunks }`

### 3b. `list_ga_lectures(ga: str) -> dict`

List all lectures in a GA volume.

```sql
SELECT l.id, l.datum, l.ort, l.vortragstitel, l.reihe, l.zyklus, l.has_chunks,
       c.titel AS zyklus_titel
FROM rag_lecture_catalog l
LEFT JOIN rag_lecture_cycles c ON c.zyklus = l.zyklus
WHERE l.ga = :ga
ORDER BY l.lecture_date ASC
```

Return: `{ ga, lecture_count, lectures: [...] }`

### 3c. No change to `list_volumes`

Stays books-only. Add explicit filter to `list_sources()` in `app_catalog_repository.py`:

```sql
SELECT ... FROM rag_sources WHERE source_type = 'book' ORDER BY ...
```

### 3d. `get_passage` — no code change needed

Once lecture source_ids exist in `rag_sources`, the existing LEFT JOIN resolves automatically.

---

## 4. Server Registration

**File**: `app/mcp_server/server.py`

### 4a. Register tools in `_register_tools()`

Import and register `get_lecture_info` and `list_ga_lectures`.

### 4b. Update `_SERVER_INSTRUCTIONS`

Add section about lectures: use `get_lecture_info` for GA/cycle/date lookup, `list_ga_lectures` for all lectures in a GA volume. Always cite date and location for lectures.

---

## 5. Critical Files

| File | Change |
|------|--------|
| `supabase/migrations/019_lecture_catalog.sql` | NEW — schema migration |
| `ragkeep/scripts/sync_lectures.ts` | NEW — sync script (--all + git-diff mode) |
| `ragkeep/scripts/hooks/pre-push` | ADD sync_lectures.ts call |
| `app/mcp_server/tools.py` | ADD `get_lecture_info`, `list_ga_lectures` |
| `app/mcp_server/server.py` | Register 2 new tools, update instructions |
| `app/services/app_catalog_repository.py` | Add `WHERE source_type = 'book'` to `list_sources()` |

### Source data files (read-only)
- `steineroriginals/rudolf-steiner-ga-lecture-catalog.yaml` — 5163 lectures
- `ragkeep/lectures/rudolf-steiner-ga-vortrag-zyklus.yaml` — 50 cycles
- `rag_chunks` on Dev, Staging, and Prod — ~238 lecture source_ids, ~10 400 chunks each

---

## 6. Execution Order

1. Create migration SQL
2. Create `sync_lectures.ts` (with `--all` and git-diff modes)
3. Add `sync_lectures.ts` call to `ragkeep/scripts/hooks/pre-push`
4. Add Python MCP tools + register in server
5. Add `WHERE source_type = 'book'` to `list_sources()`

### Rollout per environment

```bash
# ── Dev (pre-push hook does this automatically on push to main) ──
# Or manually:
node --env-file ../.env scripts/sync_lectures.ts --all

# ── Staging ──
node --env-file ../.env.staging scripts/sync_lectures.ts --all

# ── Prod ──
node --env-file ../.env.production scripts/sync_lectures.ts --all
```

Migration SQL must be run on each Supabase instance before the first sync.

6. Run migration + sync on **Dev** → test
7. Run migration + sync on **Staging** → test with MCP server
8. Run migration + sync on **Prod**

---

## 7. Verification

1. **get_passage for lecture**: Search for a lecture → `get_passage` returns `source_title` and `source_author` (not NULL)
2. **get_lecture_info**: Call with lecture source_id → returns GA, cycle, date, location
3. **list_ga_lectures**: Call with `ga="151"` → lists 4 lectures of "Der menschliche und der kosmische Gedanke"
4. **list_volumes**: Still returns only books, no lectures
5. **Supabase**: `SELECT count(*) FROM rag_lecture_catalog` = 5163, `SELECT count(*) FROM rag_sources WHERE source_type = 'lecture'` ≈ 238
