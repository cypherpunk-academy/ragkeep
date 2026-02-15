import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import type { Agent } from "./types";
import { escapeHtml, fileExists, renderSummaryHtml, writeTextFile } from "./utils";

export interface EssayPart {
  header: string;
  text: string;
}

export interface EssayData {
  slug: string;
  topic: string;
  background: string;
  summary: string | null;
  parts: EssayPart[];
}

interface EssayYamlPart {
  mood?: string;
  header?: string;
  text?: string;
}

interface EssayYaml {
  topic?: string;
  background?: string;
  parts?: EssayYamlPart[];
}

export function parseEssayFile(essayPath: string): EssayData | null {
  if (!fileExists(essayPath)) return null;
  try {
    const raw = fs.readFileSync(essayPath, "utf8");
    const parsed = yaml.load(raw) as EssayYaml | null;
    if (!parsed || typeof parsed !== "object") return null;

    const slug = path.basename(essayPath, ".essay");
    const topic = String(parsed.topic ?? slug).trim();
    const background = String(parsed.background ?? "").trim();

    const parts: EssayPart[] = [];
    const rawParts = Array.isArray(parsed.parts) ? parsed.parts : [];
    for (const p of rawParts) {
      if (!p || typeof p !== "object") continue;
      const header = String(p.header ?? "").trim();
      const text = String(p.text ?? "").trim();
      parts.push({ header, text });
    }

    return { slug, topic, background, summary: null, parts };
  } catch {
    return null;
  }
}

export function readEssaySummary(essayPath: string): string | null {
  const summaryPath = `${essayPath}.summary`;
  if (!fileExists(summaryPath)) return null;
  try {
    const content = fs.readFileSync(summaryPath, "utf8").trim();
    return content || null;
  } catch {
    return null;
  }
}

export function collectEssays(
  repoRoot: string,
  agent: Agent
): Map<string, EssayData> {
  const result = new Map<string, EssayData>();
  const essaysDir = path.join(repoRoot, "assistants", agent.id, "essays");

  for (const essayFile of agent.essays) {
    if (!essayFile.endsWith(".essay")) continue;
    const essayPath = path.join(essaysDir, essayFile);
    const data = parseEssayFile(essayPath);
    if (!data) continue;

    const summary = readEssaySummary(essayPath);
    data.summary = summary ?? (data.background || null);

    result.set(data.slug, data);
  }

  return result;
}

function essayDetailPageHtml(essay: EssayData, agentName: string): string {
  const title = escapeHtml(essay.topic);
  const agentEscaped = escapeHtml(agentName);

  const tocItems = essay.parts
    .map((part) => {
      const header = escapeHtml(part.header || "(Ohne Titel)");
      const textHtml = renderSummaryHtml(part.text);
      return `<li>
  <details class="toc-details">
    <summary class="toc-summary-line">
      <span class="toc-arrow toc-arrow-closed" aria-hidden="true">►</span>
      <span class="toc-arrow toc-arrow-open" aria-hidden="true">▼</span>
      <span class="toc-title-text">${header}</span>
    </summary>
    <div class="toc-panel">
      <div class="toc-excerpt">${textHtml}</div>
    </div>
  </details>
</li>`;
    })
    .join("\n");

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
  <p class="meta-quiet"><a href="../index.html" class="back-link">← ${agentEscaped}</a></p>
  <h1 class="book-title">${title}</h1>
  <nav class="toc book-toc">
    <ul class="book-toc-list">
${tocItems}
    </ul>
  </nav>
</main>
<script src="../../../assets/reader.js"></script>
</body>
</html>`;
}

export function generateEssayDetailPage(
  outputDir: string,
  agent: Agent,
  essay: EssayData
): void {
  const agentDir = path.join(outputDir, "agent", encodeURIComponent(agent.id));
  const essaysDir = path.join(agentDir, "essays");
  const destPath = path.join(essaysDir, `${essay.slug}.html`);

  const html = essayDetailPageHtml(essay, agent.name);
  writeTextFile(destPath, html);
}

export function generateEssayPages(
  outputDir: string,
  agents: Agent[],
  essaysByAgent: Map<string, Map<string, EssayData>>
): void {
  for (const agent of agents) {
    const essays = essaysByAgent.get(agent.id);
    if (!essays || essays.size === 0) continue;

    for (const essay of essays.values()) {
      generateEssayDetailPage(outputDir, agent, essay);
    }
  }
}
