import fs from "node:fs";
import path from "node:path";
import type { Agent } from "./types";
import { escapeHtml, fileExists, writeTextFile } from "./utils";

export interface TalkData {
  slug: string;
  title: string;
  excerpt: string;
  bodyHtml: string;
}

/**
 * Fließtext für die Talk-Karten-Vorschau: keine `##`-Überschriften, keine * / **-Marker.
 * Pro Zeile: `## Abschnitt` allein → entfernen; `## Abschnitt Fließtext` → nur `Fließtext` (erstes Wort = Rolle).
 */
function talkPlainExcerptFromBody(body: string, maxLen: number): string {
  let s = String(body || "");
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
export function renderTalkBodyHtml(body: string): string {
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
    const rest = nl === -1 ? "" : seg.slice(nl + 1);
    out.push(
      `<h2 class="talk-turn">${escapeHtml(heading)}</h2>${renderTalkParagraphs(rest)}`
    );
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
    return { slug, title, excerpt, bodyHtml };
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

function talkDetailPageHtml(talk: TalkData, agentName: string): string {
  const title = escapeHtml(talk.title);
  const agentEscaped = escapeHtml(agentName);
  return `<!DOCTYPE html>
<html lang="de" class="book-page" data-theme="default">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <meta name="color-scheme" content="light dark" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Lato:wght@300;400&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="../../../assets/book.css" />
</head>
<body class="book-body">
<main class="book-main">
  <button id="themeToggle" class="reader-toggle reader-toggle-theme" aria-label="Theme umschalten" title="Theme umschalten">🌙</button>
  <button id="sizeToggle" class="reader-toggle reader-toggle-size" aria-label="Schriftgröße umschalten" title="Schriftgröße umschalten">A</button>
  <p class="meta-quiet"><a href="../talks.html" class="back-link">← ${agentEscaped} · Talks</a></p>
  <h1 class="book-title">${title}</h1>
  <article class="talk-prose">${talk.bodyHtml}</article>
</main>
<script src="../../../assets/reader.js"></script>
</body>
</html>`;
}

export function generateTalkDetailPage(
  outputDir: string,
  agent: Agent,
  talk: TalkData
): void {
  const agentDir = path.join(outputDir, "agent", encodeURIComponent(agent.id));
  const talksOutDir = path.join(agentDir, "talks");
  const destPath = path.join(talksOutDir, `${talk.slug}.html`);
  const html = talkDetailPageHtml(talk, agent.name);
  writeTextFile(destPath, html);
}

export function generateTalkPages(
  outputDir: string,
  agents: Agent[],
  talksByAgent: Map<string, Map<string, TalkData>>
): void {
  for (const agent of agents) {
    const talks = talksByAgent.get(agent.id);
    if (!talks || talks.size === 0) continue;
    for (const talk of talks.values()) {
      generateTalkDetailPage(outputDir, agent, talk);
    }
  }
}
