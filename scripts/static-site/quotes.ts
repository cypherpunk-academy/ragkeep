import fs from "node:fs";
import path from "node:path";
import type { Agent, Book } from "./types";
import type { AgentLectureSets, LectureView } from "./lectures";
import { findChapterFile } from "./chunkLookup";

export interface QuoteEntry {
  text: string;
  sourceId: string;
  sourceTitle: string;
  segmentId: string;
  segmentTitle: string;
  paragraphUrl: string | null;
}

const PARAGRAPH_NUMBER_REGEX = /^(\d+)\|/;

const ERKLAERUNG_MARKER = "\n\nErklärung:";

/**
 * Formatiert segment_id (kebab-case) zu lesbarem Titel (Title Case).
 * z.B. "vorrede-zur-neuausgabe" → "Vorrede zur Neuausgabe"
 */
export function formatSegmentTitle(segmentId: string): string {
  const trimmed = String(segmentId ?? "").trim();
  if (!trimmed) return "(Ohne Kapitel)";
  return trimmed
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Extrahiert paragraphNum aus metadata.paragraph_number (Format "1|", "10|").
 */
function parseParagraphNumber(raw: string | undefined): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const m = s.match(PARAGRAPH_NUMBER_REGEX);
  return m ? m[1] ?? null : null;
}

/**
 * Extrahiert nur den Zitat-Teil (vor "Erklärung:").
 */
function extractQuoteText(fullText: string): string {
  const text = String(fullText ?? "").trim();
  if (!text) return "";
  const idx = text.indexOf(ERKLAERUNG_MARKER);
  if (idx >= 0) {
    return text.slice(0, idx).trim();
  }
  return text;
}

function loadBookQuotes(
  book: Book,
  sourceId: string,
  sourceTitle: string
): QuoteEntry[] {
  const quotesPath = path.join(
    book.absBookDir,
    "results",
    "rag-chunks",
    "quotes-chunks.jsonl"
  );
  if (!fs.existsSync(quotesPath)) return [];

  const lines = fs
    .readFileSync(quotesPath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const entries: QuoteEntry[] = [];
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as {
        text?: string;
        metadata?: { segment_id?: string; paragraph_number?: string };
      };
      const text = extractQuoteText(String(parsed.text ?? ""));
      if (!text) continue;

      const segmentId = String(parsed.metadata?.segment_id ?? "").trim();
      const segmentTitle = formatSegmentTitle(segmentId);
      const paragraphNum = parseParagraphNumber(parsed.metadata?.paragraph_number);

      let paragraphUrl: string | null = null;
      if (paragraphNum && segmentId) {
        const chapter = findChapterFile(book.absHtmlDir, segmentId);
        if (chapter) {
          paragraphUrl = `../../books/${encodeURIComponent(book.dirName)}/chapters/${encodeURIComponent(chapter.fileName)}#p-${chapter.chapterIndex}-${paragraphNum}`;
        }
      }

      entries.push({
        text,
        sourceId,
        sourceTitle,
        segmentId: segmentId || "unknown",
        segmentTitle,
        paragraphUrl,
      });
    } catch {
      // skip malformed lines
    }
  }
  return entries;
}

function loadLectureQuotes(
  lecture: LectureView,
  repoRoot: string,
  sourceId: string,
  sourceTitle: string
): QuoteEntry[] {
  const quotesDir = path.join(repoRoot, "lectures", "chunks", "quotes");
  if (!fs.existsSync(quotesDir)) return [];

  const id = lecture.id;
  const files = fs.readdirSync(quotesDir);
  const matching = files.filter((f) => {
    if (!f.toLowerCase().endsWith(".jsonl")) return false;
    const base = path.basename(f, ".jsonl");
    if (!base.endsWith(".quotes")) return false;
    return base === id || base.startsWith(id + "_");
  });

  if (matching.length === 0) return [];

  const filePath = path.join(quotesDir, matching[0]!);
  const lines = fs
    .readFileSync(filePath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const entries: QuoteEntry[] = [];
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as {
        text?: string;
        metadata?: { segment_id?: string; paragraph_number?: string };
      };
      const text = extractQuoteText(String(parsed.text ?? ""));
      if (!text) continue;

      const segmentId = String(parsed.metadata?.segment_id ?? "").trim();
      const segmentTitle = formatSegmentTitle(segmentId);
      const paragraphNum = parseParagraphNumber(parsed.metadata?.paragraph_number);

      let paragraphUrl: string | null = null;
      if (paragraphNum && lecture.htmlPath) {
        paragraphUrl = `../../${encodeURI(lecture.htmlPath)}#p-1-${paragraphNum}`;
      }

      entries.push({
        text,
        sourceId,
        sourceTitle,
        segmentId: segmentId || "unknown",
        segmentTitle,
        paragraphUrl,
      });
    } catch {
      // skip malformed lines
    }
  }
  return entries;
}

export interface QuotesData {
  quotes: QuoteEntry[];
  sources: { id: string; title: string }[];
}

/**
 * Sammelt alle Zitate für einen Agenten aus Büchern und Vorträgen.
 */
export function collectQuotesForAgent(
  agent: Agent,
  booksById: Map<string, Book>,
  lecturesByAgent: Map<string, AgentLectureSets>,
  repoRoot: string
): QuotesData {
  const quotes: QuoteEntry[] = [];
  const sourcesMap = new Map<string, string>();

  const allBookIds = [...agent.primaryBooks, ...agent.secondaryBooks];
  for (const bookId of allBookIds) {
    const book = booksById.get(bookId);
    if (!book) continue;

    const sourceId = `book:${bookId}`;
    const sourceTitle = `${book.author} – ${book.title}`;
    if (!sourcesMap.has(sourceId)) {
      sourcesMap.set(sourceId, sourceTitle);
    }

    const bookQuotes = loadBookQuotes(book, sourceId, sourceTitle);
    quotes.push(...bookQuotes);
  }

  const lectureSets = lecturesByAgent.get(agent.id);
  if (lectureSets) {
    const allLectures = [
      ...lectureSets.primaryLectures,
      ...lectureSets.secondaryLectures,
    ];
    for (const lecture of allLectures) {
      const sourceId = `lecture:${lecture.id}`;
      const sourceTitle = lecture.zyklusTitle
        ? `${lecture.zyklusTitle}, ${lecture.title}`
        : lecture.title;

      if (!sourcesMap.has(sourceId)) {
        sourcesMap.set(sourceId, sourceTitle);
      }

      const lectureQuotes = loadLectureQuotes(
        lecture,
        repoRoot,
        sourceId,
        sourceTitle
      );
      quotes.push(...lectureQuotes);
    }
  }

  const sources = Array.from(sourcesMap.entries()).map(([id, title]) => ({
    id,
    title,
  }));

  return { quotes, sources };
}
