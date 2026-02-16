import path from "node:path";
import type { Agent, Book, Conversation } from "./types";
import type { ConceptEntry } from "./concepts";
import type { ChunkInfo } from "./chunkLookup";
import { getConceptFileLabel } from "./concepts";
import type { EssayData } from "./essays";
import {
  escapeHtml,
  parseBookString,
  renderInlineWithEmphasis,
  renderSummaryHtml,
  writeTextFile,
} from "./utils";

type AgentSection =
  | "overview"
  | "books"
  | "secondary-books"
  | "essays"
  | "concepts"
  | "quotes"
  | "taxonomies"
  | "conversations";

const SECTION_META: Record<
  AgentSection,
  { label: string; fileName: string; heading: string }
> = {
  overview: { label: "Übersicht", fileName: "index.html", heading: "Beschreibung" },
  books: { label: "Bücher", fileName: "books.html", heading: "Primärliteratur" },
  "secondary-books": {
    label: "Sekundärliteratur",
    fileName: "secondary-books.html",
    heading: "Sekundärliteratur",
  },
  essays: { label: "Essays", fileName: "essays.html", heading: "Verfügbare Essays" },
  concepts: {
    label: "Begriffe",
    fileName: "concepts.html",
    heading: "Die häufigsten Begriffe der Bücher",
  },
  quotes: { label: "Zitate", fileName: "quotes.html", heading: "Zitate" },
  taxonomies: {
    label: "Taxonomien",
    fileName: "taxonomies.html",
    heading: "Wissens-Taxonomien",
  },
  conversations: {
    label: "Gespräche",
    fileName: "conversations.html",
    heading: "Gespeicherte Gespräche",
  },
};

function pageShell(title: string, relAssetPrefix: string, content: string): string {
  return `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <meta name="color-scheme" content="light dark" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Lato:wght@300;400&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="${relAssetPrefix}assets/styles.css" />
    <link rel="stylesheet" href="${relAssetPrefix}assets/layout.css" />
    <link rel="stylesheet" href="${relAssetPrefix}assets/dark.css" />
  </head>
  <body>
    <div class="site-shell">
      ${content}
    </div>
  </body>
</html>`;
}

function renderAgentCard(agent: Agent): string {
  const name = escapeHtml(agent.name);
  const ragCollection = escapeHtml(agent.ragCollection);
  const description = escapeHtml(agent.description);
  const totalBooks = agent.primaryBooks.length + agent.secondaryBooks.length;
  const essays = agent.essays.length;
  const target = `agent/${encodeURIComponent(agent.id)}/index.html`;
  const imgUrl = agent.coverUrl || agent.avatarUrl;
  const imgHtml = imgUrl
    ? `<img src="${escapeHtml(imgUrl)}" alt="${name}" loading="lazy" />`
    : `<div class="agent-avatar-placeholder" aria-hidden="true"></div>`;

  return `<a class="agent-card agent-card--${escapeHtml(agent.id)} site-card" href="${target}" aria-label="${name} öffnen" data-agent-id="${escapeHtml(agent.id)}">
    <div class="agent-media">
      ${imgHtml}
      <div class="agent-overlay">
        <h3>${name}</h3>
        <p>Collection: ${ragCollection}</p>
      </div>
    </div>
    <div class="agent-body stack-8">
      <p>${description}</p>
      <div class="agent-meta">
        <span>${totalBooks} Bücher</span>
        <span>${essays} Essays</span>
      </div>
    </div>
  </a>`;
}

export function generateHomePage(outputDir: string, agents: Agent[]): void {
  const generatedAt = new Date().toISOString();
  const cards = agents.map(renderAgentCard).join("\n");
  const html = pageShell(
    "AI Agent Registry",
    "",
    `<div class="wrap">
      <header class="hero stack-16">
        <h1 class="hero-title">Wähle deinen KI-Assistenten</h1>
        <p class="hero-lede">Erkunde unsere kuratierte Sammlung spezialisierter KI-Agenten, jeweils mit eigener Perspektive, Stil und Wissensbasis.</p>
        <p class="meta meta-quiet">${agents.length} Assistenten · generiert: ${escapeHtml(generatedAt)}</p>
      </header>
      <main class="agent-grid">${cards}</main>
    </div>`
  );

  writeTextFile(path.join(outputDir, "index.html"), html);
}

function renderBookRows(bookIds: string[], availableBooks: Map<string, Book>): string {
  if (bookIds.length === 0) return `<p class="empty-state">Keine Bücher in dieser Kategorie.</p>`;
  const items = bookIds.map((bookId) => {
    const known = availableBooks.get(bookId);
    const parsed = parseBookString(bookId);
    const title = escapeHtml(known?.title || parsed.title || bookId);
    const author = escapeHtml(known?.author || parsed.author || "Unbekannt");
    const subtitle = known?.subtitle ? `<div class="meta-quiet">${escapeHtml(known.subtitle)}</div>` : "";
    return `<a class="book-link" href="../../books/${encodeURIComponent(bookId)}/index.html">
      <strong>${title}</strong>
      <span>${author}</span>
      ${subtitle}
    </a>`;
  });
  return `<div class="book-list">${items.join("")}</div>`;
}

function renderFileRows(
  files: string[],
  relFolderPrefix: string,
  emptyMessage: string
): string {
  if (files.length === 0) return `<p class="empty-state">${escapeHtml(emptyMessage)}</p>`;
  return `<div class="file-list">${files
    .map(
      (file) =>
        `<a class="file-link" href="${relFolderPrefix}/${encodeURIComponent(file)}" target="_blank" rel="noreferrer"><span>${escapeHtml(
          file
        )}</span><span class="meta-quiet">Öffnen</span></a>`
    )
    .join("")}</div>`;
}

function renderEssayRows(
  essayFiles: string[],
  essaysData: Map<string, EssayData>
): string {
  if (essayFiles.length === 0) return `<p class="empty-state">Keine Essays verfügbar.</p>`;

  const items = essayFiles
    .filter((f) => f.endsWith(".essay"))
    .map((file) => {
      const slug = file.replace(/\.essay$/, "");
      const essay = essaysData.get(slug);
      const title = escapeHtml(essay?.topic ?? slug);
      const essayUrl = `essays/${encodeURIComponent(slug)}.html`;
      const summary = essay?.summary;

      if (summary) {
        const summaryHtml = renderSummaryHtml(summary);
        return `<div class="essay-card book-link">
  <a href="${essayUrl}" style="text-decoration: none; color: inherit;"><strong>${title}</strong></a>
  <details class="toc-details essay-summary-details">
    <summary class="toc-summary-line"><span class="toc-title-text">Zusammenfassung</span></summary>
    <div class="toc-panel">
      <div class="toc-excerpt">${summaryHtml}</div>
    </div>
  </details>
</div>`;
      }

      return `<a class="book-link" href="${essayUrl}">
  <strong>${title}</strong>
</a>`;
    });

  return `<div class="book-list">${items.join("")}</div>`;
}

function renderQuotes(quotes: string[]): string {
  if (quotes.length === 0) return `<p class="empty-state">Keine Zitate verfügbar.</p>`;
  return `<div class="stack-16">${quotes
    .map((quote) => `<blockquote class="quote-card">"${escapeHtml(quote)}"</blockquote>`)
    .join("")}</div>`;
}

function renderConceptsRows(
  agent: Agent,
  conceptsByFile: Map<string, ConceptEntry[]>,
  chunkIndex: Map<string, ChunkInfo>,
  agentBookIds: Set<string>
): string {
  const files = Array.from(conceptsByFile.keys());
  if (files.length === 0) return `<p class="empty-state">Keine Begriffe verfügbar.</p>`;

  const dropdownOptions = files
    .map(
      (f) =>
        `<option value="${escapeHtml(f)}">${escapeHtml(
          getConceptFileLabel(f, agent.name)
        )}</option>`
    )
    .join("");

  const accordionPanels = files.map((fileName) => {
    const entries = conceptsByFile.get(fileName) ?? [];
    const items = entries
      .map((entry) => {
        const title = entry.segmentTitle
          ? entry.segmentTitle.charAt(0).toUpperCase() + entry.segmentTitle.slice(1)
          : "(Ohne Titel)";
        const titleHtml = renderInlineWithEmphasis(title);
        const textHtml = renderSummaryHtml(entry.text);
        let refsHtml = "";
        if (entry.references && entry.references.length > 0) {
          const refLines: string[] = [];
          for (const ref of entry.references) {
            const chunk = chunkIndex.get(ref.chunk_id);
            if (!chunk) continue;
            if (chunk.source_type !== "book" && chunk.source_type !== "secondary_book") continue;
            if (!agentBookIds.has(chunk.bookDir)) continue;
            const href =
              chunk.chapterFileName && chunk.paragraphTag
                ? `../../books/${encodeURIComponent(chunk.bookDir)}/chapters/${encodeURIComponent(chunk.chapterFileName)}#${chunk.paragraphTag}`
                : chunk.chapterFileName
                  ? `../../books/${encodeURIComponent(chunk.bookDir)}/chapters/${encodeURIComponent(chunk.chapterFileName)}`
                  : `../../books/${encodeURIComponent(chunk.bookDir)}/index.html`;
            const label = `${escapeHtml(chunk.author)} – ${escapeHtml(chunk.source_title)}`;
            const excerpt = chunk.text.length > 200 ? `${chunk.text.slice(0, 200)}…` : chunk.text;
            const hoverParts = [
              chunk.author,
              chunk.source_title,
              chunk.segment_title || "(Kapitel)",
              excerpt,
            ].filter(Boolean);
            const titleAttr = escapeHtml(hoverParts.join(" · "));
            refLines.push(
              `<a href="${href}" class="concept-ref" title="${titleAttr}">${label}</a>`
            );
          }
          if (refLines.length > 0) {
            refsHtml = `<div class="concept-refs">${refLines.join(" · ")}</div>`;
          }
        }
        return `<details class="toc-details concept-accordion-item">
    <summary class="toc-summary-line">
      <span class="toc-arrow toc-arrow-closed" aria-hidden="true">►</span>
      <span class="toc-arrow toc-arrow-open" aria-hidden="true">▼</span>
      <span class="toc-title-text">${titleHtml}</span>
    </summary>
    <div class="toc-panel">
      <div class="toc-excerpt">${textHtml}</div>
      ${refsHtml}
    </div>
  </details>`;
      })
      .join("");
    const displayStyle = files.indexOf(fileName) === 0 ? "" : "display:none";
    const styleAttr = displayStyle ? ` style="${displayStyle}"` : "";
    return `<div class="concepts-panel" data-concepts-file="${escapeHtml(fileName)}"${styleAttr}>${items}</div>`;
  });

  const script = `
<script>
(function(){
  var sel = document.getElementById("conceptsDropdown");
  var panels = document.querySelectorAll(".concepts-panel");
  if (!sel || !panels.length) return;
  sel.addEventListener("change", function(){
    var v = sel.value;
    panels.forEach(function(p){
      p.style.display = (p.getAttribute("data-concepts-file") === v) ? "" : "none";
    });
  });
})();
</script>`;

  return `<div class="concepts-section stack-8">
  <label for="conceptsDropdown" class="concepts-dropdown-label">Quelle:</label>
  <select id="conceptsDropdown" class="concepts-dropdown" aria-label="Begriffsquelle wählen">
    ${dropdownOptions}
  </select>
  <div class="concepts-accordions stack-16">
    ${accordionPanels.join("")}
  </div>
  ${script}
</div>`;
}

function renderTaxonomies(taxonomies: string[]): string {
  if (taxonomies.length === 0) return `<p class="empty-state">Keine Taxonomien verfügbar.</p>`;
  return `<div class="stack-8">${taxonomies
    .map((tax) => `<div class="taxonomy-item">${escapeHtml(tax).replace(/&gt;/g, " &rarr; ")}</div>`)
    .join("")}</div>`;
}

function renderConversations(conversations: Conversation[]): string {
  if (conversations.length === 0) return `<p class="empty-state">Keine Gespräche gefunden.</p>`;
  return `<div class="stack-16">${conversations
    .map(
      (conv) => `<article class="conversation-card stack-8">
      <div><strong>${escapeHtml(conv.title)}</strong></div>
      <div class="meta-quiet">${escapeHtml(conv.date)}</div>
      <p>${escapeHtml(conv.snippet)}</p>
    </article>`
    )
    .join("")}</div>`;
}

function renderSectionContent(
  section: AgentSection,
  agent: Agent,
  availableBooks: Map<string, Book>,
  essaysByAgent: Map<string, Map<string, EssayData>>,
  conceptsByAgent: Map<string, Map<string, ConceptEntry[]>>,
  conceptsChunkIndex: Map<string, ChunkInfo>
): string {
  if (section === "overview") {
    return `<div class="stack-24">
      <section class="stack-8">
        <h3>${SECTION_META.overview.heading}</h3>
        <p>${escapeHtml(agent.description)}</p>
      </section>
      <section class="stack-8">
        <h3>Schreibstil</h3>
        <blockquote class="quote-card">"${escapeHtml(agent.writingStyle)}"</blockquote>
      </section>
    </div>`;
  }
  if (section === "books") {
    return `<div class="stack-8"><h3>${SECTION_META.books.heading}</h3>${renderBookRows(
      agent.primaryBooks,
      availableBooks
    )}</div>`;
  }
  if (section === "secondary-books") {
    return `<div class="stack-8"><h3>${SECTION_META["secondary-books"].heading}</h3>${renderBookRows(
      agent.secondaryBooks,
      availableBooks
    )}</div>`;
  }
  if (section === "essays") {
    const essaysData = essaysByAgent.get(agent.id) ?? new Map();
    return `<div class="stack-8"><h3>${SECTION_META.essays.heading}</h3>${renderEssayRows(
      agent.essays,
      essaysData
    )}</div>`;
  }
  if (section === "concepts") {
    const conceptsData = conceptsByAgent.get(agent.id) ?? new Map();
    const chunkIndex = conceptsChunkIndex ?? new Map();
    const agentBookIds = new Set([
      ...agent.primaryBooks,
      ...agent.secondaryBooks,
    ]);
    return `<div class="stack-8"><h3>${SECTION_META.concepts.heading}</h3>${renderConceptsRows(
      agent,
      conceptsData,
      chunkIndex,
      agentBookIds
    )}</div>`;
  }
  if (section === "quotes") {
    return `<div class="stack-8"><h3>${SECTION_META.quotes.heading}</h3>${renderQuotes(
      agent.quotes
    )}</div>`;
  }
  if (section === "taxonomies") {
    return `<div class="stack-8"><h3>${SECTION_META.taxonomies.heading}</h3>${renderTaxonomies(
      agent.taxonomies
    )}</div>`;
  }
  return `<div class="stack-8"><h3>${SECTION_META.conversations.heading}</h3>${renderConversations(
    agent.conversations
  )}</div>`;
}

function renderTabRow(section: AgentSection): string {
  const links = (Object.keys(SECTION_META) as AgentSection[]).map((key) => {
    const meta = SECTION_META[key];
    const className = key === section ? "tab-link tab-link-active" : "tab-link";
    return `<a class="${className}" href="${meta.fileName}">${meta.label}</a>`;
  });
  return `<nav class="tab-row" aria-label="Assistenten-Bereiche">${links.join("")}</nav>`;
}

function renderAgentPage(
  outputDir: string,
  agent: Agent,
  availableBooks: Map<string, Book>,
  essaysByAgent: Map<string, Map<string, EssayData>>,
  conceptsByAgent: Map<string, Map<string, ConceptEntry[]>>,
  conceptsChunkIndex: Map<string, ChunkInfo>,
  section: AgentSection
): void {
  const sectionMeta = SECTION_META[section];
  const agentDir = path.join(outputDir, "agent", encodeURIComponent(agent.id));
  const avatarHtml = agent.avatarUrl
    ? `<img src="../../${escapeHtml(agent.avatarUrl)}" alt="${escapeHtml(agent.name)}" />`
    : "";
  const totalBooks = agent.primaryBooks.length + agent.secondaryBooks.length;
  const html = pageShell(
    `${agent.name} – ${sectionMeta.label}`,
    "../../",
    `<div class="wrap stack-16">
      <a class="back-link" href="../../index.html">← Zurück zur Liste</a>
      <header class="agent-header site-card">
        <div class="agent-avatar">${avatarHtml}</div>
        <div class="stack-8">
          <h1>${escapeHtml(agent.name)}</h1>
          <div class="stack-8">
            <span class="pill pill-accent">Collection: ${escapeHtml(agent.ragCollection)}</span>
            <span class="pill pill-muted">${totalBooks} Bücher insgesamt</span>
          </div>
        </div>
      </header>
      ${renderTabRow(section)}
      <main class="site-card content-card">
        ${renderSectionContent(
          section,
          agent,
          availableBooks,
          essaysByAgent,
          conceptsByAgent,
          conceptsChunkIndex
        )}
      </main>
    </div>`
  );
  writeTextFile(path.join(agentDir, sectionMeta.fileName), html);
}

export function generateAgentPages(
  outputDir: string,
  agents: Agent[],
  availableBooks: Map<string, Book>,
  essaysByAgent: Map<string, Map<string, EssayData>>,
  conceptsByAgent: Map<string, Map<string, ConceptEntry[]>>,
  conceptsChunkIndex: Map<string, ChunkInfo>
): void {
  const sections = Object.keys(SECTION_META) as AgentSection[];
  for (const agent of agents) {
    for (const section of sections) {
      renderAgentPage(
        outputDir,
        agent,
        availableBooks,
        essaysByAgent,
        conceptsByAgent,
        conceptsChunkIndex,
        section
      );
    }
  }
}
