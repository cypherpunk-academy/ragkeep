-- 019_lecture_catalog.sql
-- Add lecture catalog tables and extend rag_sources for lectures.
--
-- Run on each Supabase instance before sync_lectures.ts:
--   Dev → Staging → Prod

-- ── 1. Extend rag_sources ───────────────────────────────────────────────────

ALTER TABLE rag_sources ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'book';
ALTER TABLE rag_sources ADD COLUMN IF NOT EXISTS ga text;

CREATE INDEX IF NOT EXISTS idx_rag_sources_ga ON rag_sources (ga) WHERE ga IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rag_sources_source_type ON rag_sources (source_type);

-- ── 2. rag_lecture_catalog ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rag_lecture_catalog (
    id text PRIMARY KEY,                -- YYYYMMDD[a-z]
    uuid uuid UNIQUE NOT NULL,
    datum text NOT NULL,                -- DD.MM.YYYY (original format, sometimes irregular)
    lecture_date date,                  -- parsed date for ordering (NULL if unparseable)
    ort text,
    vortragstitel text,
    ga text,                            -- ~344 entries have no GA
    reihe text,
    zyklus integer,
    anlass text,
    has_chunks boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_lecture_catalog_ga ON rag_lecture_catalog (ga);
CREATE INDEX IF NOT EXISTS idx_lecture_catalog_date ON rag_lecture_catalog (lecture_date);

-- ── 3. rag_lecture_cycles ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rag_lecture_cycles (
    zyklus integer PRIMARY KEY,
    titel text NOT NULL,
    vortraege integer NOT NULL
);

-- ── 4. RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE rag_lecture_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_lecture_cycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read" ON rag_lecture_catalog
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated read" ON rag_lecture_cycles
    FOR SELECT TO authenticated USING (true);
