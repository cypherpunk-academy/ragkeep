import path from "node:path";
import type { Agent, Book, Conversation } from "./types";
import { escapeHtml, parseBookString, writeTextFile } from "./utils";

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
    heading: "Begriffskonzepte (JSONL)",
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

  return `<a class="agent-card site-card" href="${target}" aria-label="${name} öffnen">
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

function renderQuotes(quotes: string[]): string {
  if (quotes.length === 0) return `<p class="empty-state">Keine Zitate verfügbar.</p>`;
  return `<div class="stack-16">${quotes
    .map((quote) => `<blockquote class="quote-card">"${escapeHtml(quote)}"</blockquote>`)
    .join("")}</div>`;
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
  availableBooks: Map<string, Book>
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
    return `<div class="stack-8"><h3>${SECTION_META.essays.heading}</h3>${renderFileRows(
      agent.essays,
      `../../assistants/${encodeURIComponent(agent.id)}/essays`,
      "Keine Essays verfügbar."
    )}</div>`;
  }
  if (section === "concepts") {
    return `<div class="stack-8"><h3>${SECTION_META.concepts.heading}</h3>${renderFileRows(
      agent.concepts,
      `../../assistants/${encodeURIComponent(agent.id)}/concepts`,
      "Keine Begriffe verfügbar."
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
        ${renderSectionContent(section, agent, availableBooks)}
      </main>
    </div>`
  );
  writeTextFile(path.join(agentDir, sectionMeta.fileName), html);
}

export function generateAgentPages(
  outputDir: string,
  agents: Agent[],
  availableBooks: Map<string, Book>
): void {
  const sections = Object.keys(SECTION_META) as AgentSection[];
  for (const agent of agents) {
    for (const section of sections) {
      renderAgentPage(outputDir, agent, availableBooks, section);
    }
  }
}
