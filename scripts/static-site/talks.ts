import fs from "node:fs";
import path from "node:path";
import type { Agent } from "./types";
import type { ChunkInfo } from "./chunkLookup";
import { escapeHtml, fileExists, writeTextFile } from "./utils";

export interface TalkData {
  slug: string;
  title: string;
  excerpt: string;
  bodyHtml: string;
  body: string;
  chunkIds: string[];
}

export interface TalkCitation {
  source_title: string;
  segment_title?: string;
  text?: string;
  link?: string;
  chunk_id?: string;
  relevance?: number;
  /** Optional: book-id (UUID) aus book-manifest; nützlich wenn kein Chunk-Index (z. B. ohne DB) */
  book_id?: string;
}

/**
 * Fließtext für die Talk-Karten-Vorschau: keine `##`-Überschriften, keine * / **-Marker.
 * Pro Zeile: `## Abschnitt` allein → entfernen; `## Abschnitt Fließtext` → nur `Fließtext` (erstes Wort = Rolle).
 */
function talkPlainExcerptFromBody(body: string, maxLen: number): string {
  let s = String(body || "");
  // Strip HTML comment blocks (e.g. <!-- quellen [...] -->)
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  s = s.replace(/^#{1,6}\s+(.+)$/gm, (_, rest: string) => {
    const t = rest.trim();
    const sp = t.indexOf(" ");
    if (sp === -1) return "";
    return t.slice(sp + 1).trim();
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/\*([^*]+)\*/g, "$1");
  s = s.replace(/\s+/g, " ").trim();
  if (s.length > maxLen) {
    return `${s.slice(0, maxLen).trim()}…`;
  }
  return s;
}

function renderTalkItalicLine(text: string): string {
  const t = String(text || "");
  const parts = t.split(/(\*[^*]+\*)/g);
  return parts
    .map((p) => {
      if (p.startsWith("*") && p.endsWith("*") && p.length > 2) {
        return `<em>${escapeHtml(p.slice(1, -1))}</em>`;
      }
      return escapeHtml(p);
    })
    .join("");
}

/**
 * Segment-/Anriss-Text: gängige Entities dekodieren, nur <i>/<em> erlauben,
 * sonst escapen; auf Textläufe zusätzlich *kursiv* (renderTalkItalicLine).
 */
function formatTalkRichInlineHtml(raw: string): string {
  const decoded = String(raw ?? "")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'");

  const out: string[] = [];
  let i = 0;
  while (i < decoded.length) {
    if (decoded[i] !== "<") {
      let j = i;
      while (j < decoded.length && decoded[j] !== "<") j++;
      out.push(renderTalkItalicLine(decoded.slice(i, j)));
      i = j;
      continue;
    }
    const rest = decoded.slice(i);
    const open = rest.match(/^<(i|em)\b[^>]*>/i);
    const close = rest.match(/^<\/(i|em)\s*>/i);
    if (open) {
      out.push(`<${open[1].toLowerCase()}>`);
      i += open[0].length;
    } else if (close) {
      out.push(`</${close[1].toLowerCase()}>`);
      i += close[0].length;
    } else {
      out.push("&lt;");
      i += 1;
    }
  }
  return out.join("");
}

const QUELLEN_REGEX = /<!--\s*quellen\s*\n([\s\S]*?)\n\s*-->/;

/** Extrahiert optional einen <!-- quellen [...] --> Block aus dem Segment-Text. */
function parseQuellenBlock(segText: string): { citations: TalkCitation[]; cleanText: string } {
  const match = segText.match(QUELLEN_REGEX);
  if (!match) return { citations: [], cleanText: segText };
  const json = match[1]?.trim() ?? "";
  let citations: TalkCitation[] = [];
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) citations = parsed as TalkCitation[];
  } catch {
    // malformed block — ignore
  }
  const cleanText = segText.replace(QUELLEN_REGEX, "").trim();
  return { citations, cleanText };
}

function _resolveLink(c: TalkCitation, chunkIndex?: Map<string, ChunkInfo>): string | undefined {
  if (c.link) return c.link;
  if (!c.chunk_id || !chunkIndex) return undefined;
  const info = chunkIndex.get(c.chunk_id);
  if (!info) return undefined;
  // Talk pages are 3 levels deep: site/agent/{agent}/talks/{slug}.html
  const base = `../../../books/${encodeURIComponent(info.bookDir)}`;
  if (info.chapterFileName) {
    const anchor = info.paragraphTag ? `#${info.paragraphTag}` : "";
    return `${base}/chapters/${encodeURIComponent(info.chapterFileName)}${anchor}`;
  }
  return `${base}/index.html`;
}

/** Rohtext eines Chunks für Snippet (ohne Absatz-Markierung am Anfang). */
function _normChunkBody(raw: string): string {
  return String(raw || "")
    .replace(/^\d+\|\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Kurzanriss: aus Quelle oder Chunk-Index. */
function _snippetForCitation(
  c: TalkCitation,
  info: ChunkInfo | undefined,
  maxLen: number
): string {
  const fromCitation = c.text != null && String(c.text).trim() !== "";
  const raw = fromCitation ? String(c.text) : info?.text != null ? String(info.text) : "";
  const s = _normChunkBody(raw);
  if (!s) return "";
  if (s.length <= maxLen) return s;
  return `${s.slice(0, Math.max(0, maxLen - 1)).trimEnd()}…`;
}

/** Konsistente Hintergrundfarbe aus dem Quellentitel (für Buchcover-Placeholder). */
function _coverColor(title: string): string {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue}, 28%, 32%)`;
}

function _coverAssetHref(bookId: string): string {
  return `../../../assets/covers/${encodeURIComponent(bookId)}.svg`;
}

function _bookIdForCover(c: TalkCitation, info: ChunkInfo | undefined): string | null {
  return (c.book_id?.trim() || info?.bookId || "").trim() || null;
}

type CoverSize = "thumb" | "expanded";

/** SVG-Cover aus site/assets/covers oder Placeholder (book-id aus Manifest / optional book_id in Quelle). */
function _renderTalkCover(
  c: TalkCitation,
  info: ChunkInfo | undefined,
  size: CoverSize,
  linkHref?: string
): string {
  const bookId = _bookIdForCover(c, info);
  const coverBg = _coverColor(c.source_title);
  const author = info?.author || "";

  const wrapInner = (inner: string): string => {
    if (!linkHref) return `<div class="talk-source-cover-wrap">${inner}</div>`;
    return (
      `<div class="talk-source-cover-wrap">` +
      `<a class="talk-source-cover-link" href="${escapeHtml(linkHref)}">${inner}</a>` +
      `</div>`
    );
  };

  if (size === "thumb") {
    if (!bookId) {
      const ph =
        `<div class="talk-source-cover talk-source-cover--thumb-placeholder" style="background:${coverBg}" aria-hidden="true"></div>`;
      return wrapInner(ph);
    }
    const src = escapeHtml(_coverAssetHref(bookId));
    const img =
      `<img class="talk-source-cover-img talk-source-cover-img--thumb" src="${src}" alt="" decoding="async" loading="lazy" />`;
    return wrapInner(img);
  }

  const placeholder =
    `<div class="talk-source-cover talk-source-cover--placeholder talk-source-cover--expanded" style="background:${coverBg}" aria-hidden="true">` +
    `<span class="talk-source-cover-author">${escapeHtml(author)}</span>` +
    `<span class="talk-source-cover-title">${escapeHtml(c.source_title)}</span>` +
    `</div>`;

  if (!bookId) {
    return wrapInner(placeholder);
  }

  const src = escapeHtml(_coverAssetHref(bookId));
  const img =
    `<img class="talk-source-cover-img talk-source-cover-img--expanded" src="${src}" height="220" alt="" decoding="async" loading="lazy" />`;
  return wrapInner(img);
}

/** Zugeklappt: Pfeil + [Thumbnail | Spalte mit Titel, darunter Kapitel] — Kapitel nur unter dem Titel, rechts neben dem Bild. */
function _renderSummaryCollapsed(c: TalkCitation, info: ChunkInfo | undefined): string {
  const segTitle = c.segment_title || info?.segment_title || "";
  const thumb = _renderTalkCover(c, info, "thumb");
  const titleSmall = `<span class="talk-sources-summary-title">${escapeHtml(c.source_title)}</span>`;
  const chapterPart = segTitle
    ? `<span class="talk-sources-summary-chapter-line"><span class="talk-sources-summary-chapter">${formatTalkRichInlineHtml(segTitle)}</span></span>`
    : "";
  const textStack =
    `<span class="talk-sources-summary-text-stack">` +
    `<span class="talk-sources-summary-meta">${titleSmall}</span>` +
    chapterPart +
    `</span>`;
  const topRow =
    `<span class="talk-sources-summary-top">` +
    `<span class="talk-sources-summary-item">${thumb}${textStack}</span>` +
    `</span>`;
  return `<span class="talk-sources-summary-inner">${topRow}</span>`;
}

/** Relevanz als 0–1 und Balkenbreite 0–100; fehlend → null. */
function _relevanceScore01(rel: number | undefined): { score: number; label: string } | null {
  if (rel == null || !Number.isFinite(rel)) return null;
  let v = rel;
  if (v > 1 && v <= 100) v = v / 100;
  if (v > 1) v = 1;
  if (v < 0) v = 0;
  return { score: v, label: v.toFixed(2) };
}

/** Pro Quelle ein <details>; nur die gewählte Quelle klappt auf. */
function renderQuellenDetails(citations: TalkCitation[], chunkIndex?: Map<string, ChunkInfo>): string {
  if (citations.length === 0) return "";

  const items = citations.map((c) => {
    const link = _resolveLink(c, chunkIndex);
    const info = c.chunk_id ? chunkIndex?.get(c.chunk_id) : undefined;
    const segTitle = c.segment_title || info?.segment_title || "";
    const summary = _renderSummaryCollapsed(c, info);

    const cover = _renderTalkCover(c, info, "expanded");

    const chapterRow = segTitle
      ? `<div class="talk-source-chapter talk-source-chapter--lead">${formatTalkRichInlineHtml(segTitle)}</div>`
      : "";

    const author = info?.author || "";
    const authorEl = author
      ? `<div class="talk-source-author">${escapeHtml(author)}</div>`
      : "";
    const titlePlain = `<div class="talk-source-book-title talk-source-book-title--plain">${escapeHtml(c.source_title)}</div>`;
    const bookInfo = `<div class="talk-source-info">${chapterRow}${authorEl}${titlePlain}</div>`;

    const expandedSnippet = _snippetForCitation(c, info, 900);
    let anrissBlock = "";
    if (expandedSnippet && link) {
      anrissBlock =
        `<blockquote class="talk-source-text">` +
        `<a href="${escapeHtml(link)}" class="talk-source-anriss-link" title="Zum Buchabschnitt">${formatTalkRichInlineHtml(expandedSnippet)}</a>` +
        `</blockquote>`;
    } else if (expandedSnippet) {
      anrissBlock = `<blockquote class="talk-source-text">${formatTalkRichInlineHtml(expandedSnippet)}</blockquote>`;
    } else if (link) {
      const fallbackHtml = segTitle.trim()
        ? formatTalkRichInlineHtml(segTitle)
        : c.source_title?.trim()
          ? escapeHtml(c.source_title)
          : escapeHtml("Zum Buchabschnitt");
      anrissBlock =
        `<blockquote class="talk-source-text">` +
        `<a href="${escapeHtml(link)}" class="talk-source-anriss-link" title="Zum Buchabschnitt">${fallbackHtml}</a>` +
        `</blockquote>`;
    }
    const textEl = anrissBlock ? `<div class="talk-source-text-wrap">${anrissBlock}</div>` : "";

    const q = _relevanceScore01(c.relevance);
    const qualEl = q
      ? `<div class="talk-source-quality">` +
        `<div class="talk-source-quality-head">` +
        `<span class="talk-source-quality-heading">Trefferqualität</span>` +
        `<span class="talk-source-quality-label">${q.label}</span>` +
        `</div>` +
        `<div class="talk-source-quality-track"><span class="talk-source-quality-bar" style="width:${Math.round(q.score * 100)}%"></span></div>` +
        `</div>`
      : `<div class="talk-source-quality">` +
        `<div class="talk-source-quality-head">` +
        `<span class="talk-source-quality-heading">Trefferqualität</span>` +
        `<span class="talk-source-quality-missing">—</span>` +
        `</div></div>`;

    const block =
      `<div class="talk-source-block">` +
      `<div class="talk-source-main">${cover}<div class="talk-source-body">${bookInfo}${qualEl}${textEl}</div></div>` +
      `</div>`;

    return `<details class="talk-sources">\n<summary class="talk-sources-summary">${summary}</summary>\n${block}\n</details>`;
  });

  return `<div class="talk-sources-stack">\n${items.join("\n")}\n</div>`;
}

/** Rendert Fließtext mit *kursiv* und Zeilenumbrüchen. */
function renderTalkParagraphs(text: string): string {
  const paras = String(text || "")
    .split(/\n\s*\n/g)
    .map((item) => item.trim())
    .filter(Boolean);
  if (paras.length === 0) {
    const single = String(text || "").trim();
    return single
      ? `<p>${renderTalkItalicLine(single).replace(/\n/g, "<br/>")}</p>`
      : "";
  }
  return paras
    .map(
      (item) =>
        `<p>${renderTalkItalicLine(item).replace(/\n/g, "<br/>")}</p>`
    )
    .join("");
}

/** Body nach der Titelzeile: Abschnitte an `## ` mit optionaler Einleitung davor. */
export function renderTalkBodyHtml(body: string, chunkIndex?: Map<string, ChunkInfo>): string {
  const raw = String(body || "").trim();
  if (!raw) return "";
  // `split(/\n## /)` findet kein `##` am Textanfang (kein vorangestelltes \n).
  const forSplit = raw.startsWith("## ") ? `\n${raw}` : raw;
  const segments = forSplit.split(/\n## /);
  const out: string[] = [];
  const first = segments[0]?.trim();
  if (first) {
    out.push(`<div class="talk-intro">${renderTalkParagraphs(first)}</div>`);
  }
  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i] ?? "";
    const nl = seg.indexOf("\n");
    const heading = nl === -1 ? seg.trim() : seg.slice(0, nl).trim();
    const rawRest = nl === -1 ? "" : seg.slice(nl + 1);
    const isHuman = ["mensch", "user"].includes(heading.toLowerCase());
    if (!isHuman) {
      const { citations, cleanText } = parseQuellenBlock(rawRest);
      const paragraphs = renderTalkParagraphs(cleanText);
      const quellen = renderQuellenDetails(citations, chunkIndex);
      out.push(`<h2 class="talk-turn">${escapeHtml(heading)}</h2>${paragraphs}${quellen ? `\n${quellen}` : ""}`);
    } else {
      out.push(
        `<h2 class="talk-turn">${escapeHtml(heading)}</h2>${renderTalkParagraphs(rawRest)}`
      );
    }
  }
  return out.join("\n");
}

/** Entfernt optional YAML-Frontmatter (--- … ---) und liefert den restlichen Text zeilenweise. */
function stripFrontmatter(lines: string[]): string[] {
  if (lines[0]?.trim() !== "---") return lines;
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === "---") {
      end = i;
      break;
    }
  }
  if (end === -1) return lines;
  const rest = lines.slice(end + 1);
  let skip = 0;
  while (skip < rest.length && rest[skip]?.trim() === "") skip += 1;
  return rest.slice(skip);
}

/** Extrahiert alle chunk_ids aus quellen-Blöcken im Body. */
export function extractTalkChunkIds(body: string): string[] {
  const ids: string[] = [];
  const rx = /<!--\s*quellen\s*\n([\s\S]*?)\n\s*-->/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(body)) !== null) {
    try {
      const parsed = JSON.parse(m[1]?.trim() ?? "");
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item.chunk_id === "string" && item.chunk_id) {
            ids.push(item.chunk_id);
          }
        }
      }
    } catch { /* ignore malformed */ }
  }
  return ids;
}

export function parseTalkFile(talkPath: string): TalkData | null {
  if (!fileExists(talkPath)) return null;
  try {
    const raw = fs.readFileSync(talkPath, "utf8");
    const allLines = raw.split(/\r?\n/);
    const lines = stripFrontmatter(allLines);
    let title = path.basename(talkPath, ".md");
    let startIdx = 0;
    const firstHeading = lines.findIndex((l) => l.startsWith("# "));
    if (firstHeading >= 0) {
      title = lines[firstHeading].slice(2).trim();
      startIdx = firstHeading + 1;
    }
    while (startIdx < lines.length && lines[startIdx]?.trim() === "") {
      startIdx += 1;
    }
    const body = lines.slice(startIdx).join("\n");
    const slug = path.basename(talkPath, ".md");
    const excerpt = talkPlainExcerptFromBody(body, 220);
    const bodyHtml = renderTalkBodyHtml(body);
    const chunkIds = extractTalkChunkIds(body);
    return { slug, title, excerpt, bodyHtml, body, chunkIds };
  } catch {
    return null;
  }
}

export function collectTalks(
  repoRoot: string,
  agent: Agent
): Map<string, TalkData> {
  const result = new Map<string, TalkData>();
  const talksDir = path.join(repoRoot, "assistants", agent.id, "talks");
  for (const file of agent.talks) {
    if (!file.endsWith(".md")) continue;
    const talkPath = path.join(talksDir, file);
    const data = parseTalkFile(talkPath);
    if (data) result.set(data.slug, data);
  }
  return result;
}

function talkDetailPageHtml(talk: TalkData, agentName: string, chunkIndex?: Map<string, ChunkInfo>): string {
  const title = escapeHtml(talk.title);
  const agentEscaped = escapeHtml(agentName);
  const bodyHtml = chunkIndex ? renderTalkBodyHtml(talk.body, chunkIndex) : talk.bodyHtml;
  return `<!DOCTYPE html>
<html lang="de" class="book-page" data-theme="default">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <meta name="color-scheme" content="light dark" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Lato:wght@300;400&family=Special+Elite&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="../../../assets/book.css" />
</head>
<body class="book-body">
<main class="book-main">
  <button id="themeToggle" class="reader-toggle reader-toggle-theme" aria-label="Theme umschalten" title="Theme umschalten">🌙</button>
  <button id="sizeToggle" class="reader-toggle reader-toggle-size" aria-label="Schriftgröße umschalten" title="Schriftgröße umschalten">A</button>
  <p class="meta-quiet"><a href="../talks.html" class="back-link">← ${agentEscaped} · Talks</a></p>
  <h1 class="book-title">${title}</h1>
  <article class="talk-prose">${bodyHtml}</article>
</main>
<script src="../../../assets/reader.js"></script>
</body>
</html>`;
}

export function generateTalkDetailPage(
  outputDir: string,
  agent: Agent,
  talk: TalkData,
  chunkIndex?: Map<string, ChunkInfo>
): void {
  const agentDir = path.join(outputDir, "agent", encodeURIComponent(agent.id));
  const talksOutDir = path.join(agentDir, "talks");
  const destPath = path.join(talksOutDir, `${talk.slug}.html`);
  const html = talkDetailPageHtml(talk, agent.name, chunkIndex);
  writeTextFile(destPath, html);
}

export function generateTalkPages(
  outputDir: string,
  agents: Agent[],
  talksByAgent: Map<string, Map<string, TalkData>>,
  chunkIndex?: Map<string, ChunkInfo>
): void {
  for (const agent of agents) {
    const talks = talksByAgent.get(agent.id);
    if (!talks || talks.size === 0) continue;
    for (const talk of talks.values()) {
      generateTalkDetailPage(outputDir, agent, talk, chunkIndex);
    }
  }
}
