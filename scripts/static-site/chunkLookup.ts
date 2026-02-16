/**
 * Chunk-Lookup-Service: Lädt Chunk-Metadaten aus Postgres (rag_chunks)
 * für Begriffs-Referenzen. Bei fehlender DSN oder Verbindungsfehler:
 * Graceful Degradation – leeres Map, Begriffe ohne Quell-Links.
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
function findChapterFile(
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

interface RawChunkInfo {
  chunk_id: string;
  source_id: string;
  metadata: Record<string, unknown>;
  text: string | null;
  source_index: number;
}

/**
 * Lädt Chunks aus Postgres und baut den Index.
 * Bei fehlender DSN oder Verbindungsfehler: leeres Map (Graceful Degradation).
 */
export async function buildChunkIndex(
  chunkIdsByCollection: Map<string, Set<string>>,
  repoRoot: string,
  booksById: Map<string, Book>
): Promise<Map<string, ChunkInfo>> {
  const dbUrl =
    process.env.RAGRUN_POSTGRES_DSN ??
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL;
  if (!dbUrl || String(dbUrl).trim() === "") {
    // eslint-disable-next-line no-console
    console.warn(
      "Hinweis: RAGRUN_POSTGRES_DSN nicht gesetzt – Begriffs-Referenzen werden ohne Quell-Links gerendert."
    );
    return new Map();
  }

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

  const bookIdToDir = buildBookIdToDirMap(repoRoot);

  const { Client } = await import("pg");
  const client = new Client({ connectionString: dbUrl });

  try {
    await client.connect();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      "Hinweis: Keine DB-Verbindung – Begriffs-Referenzen ohne Quell-Links:",
      err instanceof Error ? err.message : String(err)
    );
    await client.end();
    return new Map();
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
          }
        }
      }

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
        paragraphTag,
        chapterFileName,
      });
    }

    return result;
  } finally {
    await client.end();
  }
}
