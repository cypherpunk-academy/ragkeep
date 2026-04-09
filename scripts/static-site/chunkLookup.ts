/**
 * Chunk-Lookup-Service: Metadaten aus Postgres (rag_chunks) oder – ohne DSN bzw. bei
 * Verbindungsfehler – aus lokalen book-chunks.jsonl unter books/.../results/rag-chunks/.
 */
import fs from "node:fs";
import path from "node:path";
import { fileExists, readScalarFromManifest } from "./utils";
import type { Book } from "./types";

const PARAGRAPH_MARKER_REGEX = /^(\d+)\|/;

export interface ChunkInfo {
  author: string;
  source_title: string;
  source_type: string;
  segment_id: string;
  segment_title: string;
  text: string;
  source_index: number;
  bookDir: string;
  /** UUID aus book-manifest.yaml (Cover: site/assets/covers/{bookId}.svg) */
  bookId: string | null;
  paragraphTag: string | null;
  chapterFileName: string | null;
}

/**
 * Baut eine Map von source_id (UUID oder bookDir) auf bookDir.
 * Scannt books/ und ragkeep-deutsche-klassik-books-de/books/.
 */
function buildBookIdToDirMap(repoRoot: string): Map<string, string> {
  const map = new Map<string, string>();
  const sources = [
    path.join(repoRoot, "books"),
    path.join(repoRoot, "ragkeep-deutsche-klassik-books-de", "books"),
  ];
  for (const source of sources) {
    if (!fs.existsSync(source)) continue;
    const entries = fs.readdirSync(source, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dirName = entry.name;
      const absBookDir = path.join(source, dirName);
      const bookId = readScalarFromManifest(absBookDir, "book-id");
      if (bookId) map.set(bookId, dirName);
      map.set(dirName, dirName);
    }
  }
  return map;
}

/**
 * Ermittelt den Kapitel-Dateinamen (NN-segment_id.html) und den chapterIndex.
 */
export function findChapterFile(
  absHtmlDir: string,
  segmentId: string
): { chapterIndex: number; fileName: string } | null {
  const chaptersDir = path.join(absHtmlDir, "chapters");
  if (!fileExists(chaptersDir)) return null;
  const files = fs.readdirSync(chaptersDir);
  const suffix = `-${segmentId}.html`;
  const match = files.find((f) => f.endsWith(suffix));
  if (!match) return null;
  const numMatch = match.match(/^(\d+)-/);
  const chapterIndex = numMatch ? parseInt(numMatch[1] ?? "0", 10) : 0;
  return { chapterIndex, fileName: match };
}

/**
 * Extrahiert paragraphNum aus Chunk-Text (Regex: ^\d+\|).
 * Ohne Marker: durchsucht vorherige Chunks (source_index absteigend).
 */
function resolveParagraphTag(
  chunk: RawChunkInfo,
  allChunksInSegment: RawChunkInfo[]
): string | null {
  const text = chunk.text ?? "";
  const markerMatch = text.match(PARAGRAPH_MARKER_REGEX);
  if (markerMatch) {
    return markerMatch[1] ?? null;
  }
  const currentIdx = chunk.source_index;
  const preceding = allChunksInSegment
    .filter((c) => (c.source_index ?? 0) < currentIdx)
    .sort((a, b) => (b.source_index ?? 0) - (a.source_index ?? 0));
  for (const c of preceding) {
    const m = (c.text ?? "").match(PARAGRAPH_MARKER_REGEX);
    if (m) return m[1] ?? null;
  }
  return null;
}

const chapterHtmlByPath = new Map<string, string>();

function readChapterHtmlCached(absPath: string): string | null {
  if (chapterHtmlByPath.has(absPath)) return chapterHtmlByPath.get(absPath)!;
  if (!fileExists(absPath)) return null;
  const t = fs.readFileSync(absPath, "utf8");
  chapterHtmlByPath.set(absPath, t);
  return t;
}

function normalizeChunkTextForMatch(s: string): string {
  return s
    .replace(/\u00ad/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Mehrere Kandidaten-Strings (erste Zeile, erster Block, Präfix), für Abgleich mit Kapitel-HTML. */
function chunkAnchorSearchNeedles(chunkText: string): string[] {
  const raw = String(chunkText ?? "").trim();
  if (raw.length < 6) return [];
  const firstLine = raw.split(/\n/)[0]?.trim() ?? "";
  const blocks = raw.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const candidates: string[] = [];
  if (firstLine.length >= 4 && firstLine.length <= 160) {
    candidates.push(normalizeChunkTextForMatch(firstLine));
  }
  if (blocks[0]) {
    candidates.push(normalizeChunkTextForMatch(blocks[0].slice(0, 240)));
  }
  if (blocks[0] && blocks[1]) {
    candidates.push(normalizeChunkTextForMatch(`${blocks[0]}\n\n${blocks[1]}`.slice(0, 320)));
  }
  candidates.push(normalizeChunkTextForMatch(raw.slice(0, 140)));
  candidates.push(normalizeChunkTextForMatch(raw.slice(0, 70)));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of candidates) {
    if (c.length < 6) continue;
    if (seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out;
}

/**
 * Ohne `N|`-Marker: Sucht die erste book-paragraph-Section, deren Klartext den Chunk-Anfang enthält
 * (z. B. englische Blogtexte, weiche Trennzeichen im HTML werden normalisiert).
 */
function findParagraphSectionIdFromChapterHtml(chunkText: string, absChapterFile: string): string | null {
  const html = readChapterHtmlCached(absChapterFile);
  if (!html) return null;
  const needles = chunkAnchorSearchNeedles(chunkText);
  if (needles.length === 0) return null;

  const sectionRe = /<section[^>]*\bid="(p-\d+-\d+)"[^>]*>([\s\S]*?)<\/section>/gi;
  const sections: Array<{ id: string; plain: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = sectionRe.exec(html)) !== null) {
    const id = m[1];
    const inner = m[2] ?? "";
    const plain = normalizeChunkTextForMatch(inner.replace(/<[^>]+>/g, " "));
    sections.push({ id, plain });
  }

  for (const needle of needles) {
    for (const { id, plain } of sections) {
      if (plain.length === 0) continue;
      if (plain.includes(needle)) return id;
      if (needle.includes(plain) && plain.length >= 12) return id;
    }
  }
  return null;
}

interface RawChunkInfo {
  chunk_id: string;
  source_id: string;
  metadata: Record<string, unknown>;
  text: string | null;
  source_index: number;
}

interface MatchRow {
  chunk_id: string;
  source_id: string;
  metadata: Record<string, unknown>;
  text: string | null;
}

/** Alle book-chunks.jsonl unter books/.../results/rag-chunks/ (Haupt- und Klassik-Bücher). */
function findBookChunksJsonlFiles(repoRoot: string): string[] {
  const out: string[] = [];
  const bases = [
    path.join(repoRoot, "books"),
    path.join(repoRoot, "ragkeep-deutsche-klassik-books-de", "books"),
  ];
  for (const base of bases) {
    if (!fs.existsSync(base)) continue;
    const entries = fs.readdirSync(base, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const jp = path.join(base, entry.name, "results", "rag-chunks", "book-chunks.jsonl");
      if (fs.existsSync(jp)) out.push(jp);
    }
  }
  return out;
}

function assembleChunkInfosFromMatchRows(
  rows: MatchRow[],
  bySegment: Map<string, RawChunkInfo[]>,
  repoRoot: string,
  booksById: Map<string, Book>,
  bookIdToDir: Map<string, string>
): Map<string, ChunkInfo> {
  const result = new Map<string, ChunkInfo>();
  for (const r of rows) {
    const meta = (r.metadata ?? {}) as Record<string, unknown>;
    const bookDir =
      bookIdToDir.get(r.source_id) ??
      (r.source_id.includes("#") ? r.source_id : null);
    if (!bookDir) continue;

    const book = booksById.get(bookDir);
    const absHtmlDir = book?.absHtmlDir;
    const segmentId = String(meta.segment_id ?? "").trim();
    const raw: RawChunkInfo = {
      chunk_id: r.chunk_id,
      source_id: r.source_id,
      metadata: meta,
      text: r.text,
      source_index: typeof meta.source_index === "number" ? meta.source_index : 0,
    };
    const segmentChunks = bySegment.get(`${r.source_id}\0${segmentId}`) ?? [raw];
    const paragraphNum = resolveParagraphTag(raw, segmentChunks);

    let paragraphTag: string | null = null;
    let chapterFileName: string | null = null;
    if (absHtmlDir && segmentId) {
      const chapterInfo = findChapterFile(absHtmlDir, segmentId);
      if (chapterInfo) {
        chapterFileName = chapterInfo.fileName;
        if (paragraphNum) {
          paragraphTag = `p-${chapterInfo.chapterIndex}-${paragraphNum}`;
        } else {
          const absChapterPath = path.join(absHtmlDir, "chapters", chapterInfo.fileName);
          const idFromHtml = findParagraphSectionIdFromChapterHtml(r.text ?? "", absChapterPath);
          if (idFromHtml) paragraphTag = idFromHtml;
        }
      }
    }

    let absBookDirForManifest = book?.absBookDir ?? "";
    if (!absBookDirForManifest || !fileExists(path.join(absBookDirForManifest, "book-manifest.yaml"))) {
      const p1 = path.join(repoRoot, "books", bookDir);
      if (fileExists(path.join(p1, "book-manifest.yaml"))) absBookDirForManifest = p1;
      else {
        const p2 = path.join(repoRoot, "ragkeep-deutsche-klassik-books-de", "books", bookDir);
        if (fileExists(path.join(p2, "book-manifest.yaml"))) absBookDirForManifest = p2;
        else absBookDirForManifest = "";
      }
    }
    const bookIdFromManifest = absBookDirForManifest
      ? readScalarFromManifest(absBookDirForManifest, "book-id").trim()
      : "";

    result.set(r.chunk_id, {
      author: String(meta.author ?? "").trim(),
      source_title: String(
        meta.source_title ?? meta.book_title ?? ""
      ).trim(),
      source_type: String(meta.source_type ?? meta.chunk_type ?? "").trim(),
      segment_id: segmentId,
      segment_title: String(meta.segment_title ?? "").trim(),
      text: String(r.text ?? "").trim(),
      source_index: raw.source_index,
      bookDir,
      bookId: bookIdFromManifest || null,
      paragraphTag,
      chapterFileName,
    });
  }
  return result;
}

/**
 * Chunk-Metadaten aus lokalem `book-chunks.jsonl` (ohne Postgres).
 */
function buildChunkIndexFromBookJsonl(
  wantedIds: Set<string>,
  repoRoot: string,
  booksById: Map<string, Book>,
  bookIdToDir: Map<string, string>
): Map<string, ChunkInfo> {
  if (wantedIds.size === 0) return new Map();
  const jsonlFiles = findBookChunksJsonlFiles(repoRoot);
  const segmentKeys = new Set<string>();
  const primaryById = new Map<string, MatchRow>();

  for (const fp of jsonlFiles) {
    let content: string;
    try {
      content = fs.readFileSync(fp, "utf8");
    } catch {
      continue;
    }
    for (const line of content.split(/\r?\n/)) {
      if (!line.trim()) continue;
      let rec: { metadata?: Record<string, unknown>; text?: string | null };
      try {
        rec = JSON.parse(line) as { metadata?: Record<string, unknown>; text?: string | null };
      } catch {
        continue;
      }
      const meta = (rec.metadata ?? {}) as Record<string, unknown>;
      const cid = String(meta.chunk_id ?? "").trim();
      if (!wantedIds.has(cid)) continue;
      const sid = String(meta.source_id ?? "").trim();
      const seg = String(meta.segment_id ?? "").trim();
      if (sid && seg) segmentKeys.add(`${sid}\0${seg}`);
      primaryById.set(cid, {
        chunk_id: cid,
        source_id: sid,
        metadata: meta,
        text: rec.text ?? null,
      });
    }
  }

  const primaryRows = [...primaryById.values()];
  const bySegment = new Map<string, RawChunkInfo[]>();

  if (segmentKeys.size > 0) {
    for (const fp of jsonlFiles) {
      let content: string;
      try {
        content = fs.readFileSync(fp, "utf8");
      } catch {
        continue;
      }
      for (const line of content.split(/\r?\n/)) {
        if (!line.trim()) continue;
        let rec: { metadata?: Record<string, unknown>; text?: string | null };
        try {
          rec = JSON.parse(line) as { metadata?: Record<string, unknown>; text?: string | null };
        } catch {
          continue;
        }
        const meta = (rec.metadata ?? {}) as Record<string, unknown>;
        const sid = String(meta.source_id ?? "").trim();
        const seg = String(meta.segment_id ?? "").trim();
        const key = `${sid}\0${seg}`;
        if (!segmentKeys.has(key)) continue;
        const raw: RawChunkInfo = {
          chunk_id: String(meta.chunk_id ?? "").trim(),
          source_id: sid,
          metadata: meta,
          text: rec.text ?? null,
          source_index: typeof meta.source_index === "number" ? meta.source_index : 0,
        };
        const list = bySegment.get(key) ?? [];
        list.push(raw);
        bySegment.set(key, list);
      }
    }
    for (const [key, list] of bySegment) {
      list.sort((a, b) => a.source_index - b.source_index);
      const seen = new Set<string>();
      const deduped = list.filter((item) => {
        if (seen.has(item.chunk_id)) return false;
        seen.add(item.chunk_id);
        return true;
      });
      bySegment.set(key, deduped);
    }
  }

  return assembleChunkInfosFromMatchRows(primaryRows, bySegment, repoRoot, booksById, bookIdToDir);
}

/**
 * Lädt Chunks aus Postgres und baut den Index.
 * Ohne DSN oder bei Verbindungsfehler: Fallback auf lokale book-chunks.jsonl.
 */
export async function buildChunkIndex(
  chunkIdsByCollection: Map<string, Set<string>>,
  repoRoot: string,
  booksById: Map<string, Book>
): Promise<Map<string, ChunkInfo>> {
  const seen = new Set<string>();
  const allChunkIds: Array<{ chunk_id: string; collection: string }> = [];
  for (const [coll, ids] of chunkIdsByCollection) {
    for (const cid of ids) {
      const key = `${coll}:${cid}`;
      if (seen.has(key)) continue;
      seen.add(key);
      allChunkIds.push({ chunk_id: cid, collection: coll });
    }
  }
  if (allChunkIds.length === 0) {
    return new Map();
  }

  const allWantedIds = new Set<string>();
  for (const c of allChunkIds) allWantedIds.add(c.chunk_id);

  const bookIdToDir = buildBookIdToDirMap(repoRoot);

  const dbUrl =
    process.env.RAGRUN_POSTGRES_DSN ??
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL;
  if (!dbUrl || String(dbUrl).trim() === "") {
    // eslint-disable-next-line no-console
    console.warn(
      "Hinweis: RAGRUN_POSTGRES_DSN nicht gesetzt – Chunk-Metadaten werden aus lokalen book-chunks.jsonl gelesen (falls vorhanden)."
    );
    return buildChunkIndexFromBookJsonl(allWantedIds, repoRoot, booksById, bookIdToDir);
  }

  const { Client } = await import("pg");
  const client = new Client({ connectionString: dbUrl });

  try {
    await client.connect();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      "Hinweis: Keine DB-Verbindung – Fallback auf book-chunks.jsonl:",
      err instanceof Error ? err.message : String(err)
    );
    await client.end();
    return buildChunkIndexFromBookJsonl(allWantedIds, repoRoot, booksById, bookIdToDir);
  }

  try {
    const conditions = allChunkIds
      .map((_, i) => `(collection = $${2 * i + 1} AND chunk_id = $${2 * i + 2})`)
      .join(" OR ");
    const params = allChunkIds.flatMap((c) => [c.collection, c.chunk_id]);

    const res = await client.query(
      `SELECT collection, chunk_id, source_id, metadata, text
       FROM rag_chunks
       WHERE ${conditions}`,
      params
    );

    const rows = res.rows as Array<{
      collection: string;
      chunk_id: string;
      source_id: string;
      metadata: Record<string, unknown>;
      text: string | null;
    }>;

    const sourceIdToSegmentIds = new Map<string, Set<string>>();
    for (const r of rows) {
      const meta = (r.metadata ?? {}) as Record<string, unknown>;
      const segId = String(meta.segment_id ?? "").trim();
      if (segId) {
        const set = sourceIdToSegmentIds.get(r.source_id) ?? new Set();
        set.add(segId);
        sourceIdToSegmentIds.set(r.source_id, set);
      }
    }

    const segmentChunkRows: typeof rows = [];
    for (const [srcId, segIds] of sourceIdToSegmentIds) {
      for (const segId of segIds) {
        const segRes = await client.query(
          `SELECT collection, chunk_id, source_id, metadata, text
           FROM rag_chunks
           WHERE source_id = $1 AND metadata->>'segment_id' = $2`,
          [srcId, segId]
        );
        segmentChunkRows.push(...(segRes.rows as typeof rows));
      }
    }

    const byChunkId = new Map<string, RawChunkInfo>();
    for (const r of rows) {
      const meta = (r.metadata ?? {}) as Record<string, unknown>;
      byChunkId.set(r.chunk_id, {
        chunk_id: r.chunk_id,
        source_id: r.source_id,
        metadata: meta,
        text: r.text,
        source_index: typeof meta.source_index === "number" ? meta.source_index : 0,
      });
    }

    const bySegment = new Map<string, RawChunkInfo[]>();
    for (const r of segmentChunkRows) {
      const meta = (r.metadata ?? {}) as Record<string, unknown>;
      const segId = String(meta.segment_id ?? "").trim();
      if (!segId) continue;
      const key = `${r.source_id}\0${segId}`;
      const list = bySegment.get(key) ?? [];
      list.push({
        chunk_id: r.chunk_id,
        source_id: r.source_id,
        metadata: meta,
        text: r.text,
        source_index: typeof meta.source_index === "number" ? meta.source_index : 0,
      });
      bySegment.set(key, list);
    }

    for (const list of bySegment.values()) {
      list.sort((a, b) => a.source_index - b.source_index);
    }

    const matchRows: MatchRow[] = rows.map((r) => ({
      chunk_id: r.chunk_id,
      source_id: r.source_id,
      metadata: (r.metadata ?? {}) as Record<string, unknown>,
      text: r.text,
    }));

    return assembleChunkInfosFromMatchRows(matchRows, bySegment, repoRoot, booksById, bookIdToDir);
  } finally {
    await client.end();
  }
}
