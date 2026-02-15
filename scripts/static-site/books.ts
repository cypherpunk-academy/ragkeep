import fs from "node:fs";
import path from "node:path";
import type { Agent, Book } from "./types";
import {
  escapeHtml,
  fileExists,
  findHtmlDirForBook,
  parseAuthorAndTitle,
  readScalarFromManifest,
  renderInlineWithEmphasis,
  renderSummaryHtml,
} from "./utils";

export function collectBooks(repoRoot: string): Book[] {
  const sources = [
    path.join(repoRoot, "books"),
    path.join(repoRoot, "ragkeep-deutsche-klassik-books-de", "books"),
  ];
  const books: Book[] = [];
  for (const source of sources) {
    if (!fs.existsSync(source)) continue;
    const entries = fs.readdirSync(source, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dirName = entry.name;
      const absBookDir = path.join(source, dirName);
      const absHtmlDir = findHtmlDirForBook(absBookDir);
      if (!absHtmlDir) continue;
      const parsed = parseAuthorAndTitle(dirName);
      const author = readScalarFromManifest(absBookDir, "author") || parsed.author;
      const title = readScalarFromManifest(absBookDir, "title") || parsed.title;
      const subtitle = readScalarFromManifest(absBookDir, "subtitle") || "";
      books.push({
        dirName,
        absBookDir,
        absHtmlDir,
        relOutputDir: path.join("books", dirName),
        author,
        title,
        subtitle,
      });
    }
  }

  const preferredPrefix = `${path.join(repoRoot, "books")}${path.sep}`;
  const byName = new Map<string, Book>();
  for (const book of books) {
    const existing = byName.get(book.dirName);
    if (!existing) {
      byName.set(book.dirName, book);
      continue;
    }
    const isPreferred = book.absBookDir.startsWith(preferredPrefix);
    if (isPreferred) byName.set(book.dirName, book);
  }

  return Array.from(byName.values()).sort((a, b) => {
    const aKey = `${a.author}\u0000${a.title}`.toLowerCase();
    const bKey = `${b.author}\u0000${b.title}`.toLowerCase();
    return aKey.localeCompare(bKey, "de");
  });
}

export function buildBookLookup(books: Book[]): Map<string, Book> {
  const map = new Map<string, Book>();
  for (const book of books) map.set(book.dirName, book);
  return map;
}

export function collectReferencedBookIds(agents: Agent[]): Set<string> {
  const ids = new Set<string>();
  for (const agent of agents) {
    for (const id of agent.primaryBooks) ids.add(id);
    for (const id of agent.secondaryBooks) ids.add(id);
  }
  return ids;
}

function fixBookTocPageTitle(book: Book, destBookHtmlDir: string): void {
  const tocPath = path.join(destBookHtmlDir, "index.html");
  if (!fileExists(tocPath)) return;

  const titleText = (book.title || "").trim();
  if (!titleText) return;

  let html = fs.readFileSync(tocPath, "utf8");
  html = html.replace(
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escapeHtml(titleText)}</title>`
  );
  html = html.replace(
    /<h1[^>]*>[\s\S]*?<\/h1>/i,
    `<h1 class="book-title">${escapeHtml(titleText)}</h1>`
  );
  fs.writeFileSync(tocPath, html, "utf8");
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripTags(value: string): string {
  return String(value || "").replace(/<[^>]*>/g, "");
}

function pickBestSummaryText(summariesByTitle: Map<string, string>, tocTitle: string): string | null {
  if (summariesByTitle.has(tocTitle)) return summariesByTitle.get(tocTitle) ?? null;

  const norm = (value: string) =>
    value
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[^a-z0-9äöüß\s]/g, "")
      .trim();

  const normWithVariants = (value: string) =>
    norm(value).replace(/phantasie/g, "fantasie").replace(/philosophie/g, "filosofie");

  const normalizedToc = normWithVariants(tocTitle);
  if (!normalizedToc) return null;

  for (const [k, v] of summariesByTitle.entries()) {
    if (norm(k) === norm(tocTitle)) return v;
  }
  for (const [k, v] of summariesByTitle.entries()) {
    if (normWithVariants(k) === normalizedToc) return v;
  }
  return null;
}

function injectTocSummaries(absBookDir: string, destBookHtmlDir: string): void {
  const summariesPath = path.join(
    absBookDir,
    "results",
    "rag-chunks",
    "summaries-chunks.jsonl"
  );
  if (!fileExists(summariesPath)) return;

  const tocPath = path.join(destBookHtmlDir, "index.html");
  if (!fileExists(tocPath)) return;

  const marker = 'data-ragkeep-toc-summaries="6"';
  let html = fs.readFileSync(tocPath, "utf8");
  if (html.includes(marker)) return;

  const summariesByTitle = new Map<string, string>();
  const lines = fs.readFileSync(summariesPath, "utf8").split("\n").filter(Boolean);
  for (const line of lines) {
    try {
      const obj = JSON.parse(line) as Record<string, unknown>;
      const metadata = obj.metadata as Record<string, unknown> | undefined;
      const sourceTitle = String(metadata?.source_title ?? obj.source_title ?? "").trim();
      const text = String(obj.text ?? "").trim();
      if (!sourceTitle || !text) continue;
      if (!summariesByTitle.has(sourceTitle)) summariesByTitle.set(sourceTitle, text);
    } catch {
      // ignore malformed lines
    }
  }
  if (summariesByTitle.size === 0) return;

  html = html.replace(
    /<nav class="[^"]*\btoc\b[^"]*"[^>]*>([\s\S]*?)<\/nav>/m,
    (_navMatch, navInner) => {
      const replaced = String(navInner).replace(
        /<li[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/li>/g,
        (_liMatch, href, rawTitleHtml) => {
          const decoded = decodeHtmlEntities(String(rawTitleHtml || "").trim());
          const titlePlain = stripTags(decoded).trim();
          const titleHtml = renderInlineWithEmphasis(decoded).trim();
          const summaryText = pickBestSummaryText(summariesByTitle, titlePlain);
          if (!summaryText) return `<li><a class="toc-link" href="${href}">${titleHtml}</a></li>`;

          let cleanedSummary = summaryText;
          const titlePlainTrimmed = titlePlain.trim();
          const normalizeSpelling = (value: string) =>
            value.replace(/phantasie/gi, "fantasie");
          const titleNormalized = normalizeSpelling(titlePlainTrimmed);
          const titleWithBold = `**${titlePlainTrimmed}**`;
          const titleWithBoldAndNewline = `${titleWithBold}\n\n`;

          if (cleanedSummary.trim().startsWith(titlePlainTrimmed)) {
            cleanedSummary = cleanedSummary
              .substring(titlePlainTrimmed.length)
              .trim()
              .replace(/^[\s\n\r]*[:\-\.]?[\s\n\r]*/, "")
              .trim();
          } else if (cleanedSummary.trim().startsWith(titleWithBoldAndNewline)) {
            cleanedSummary = cleanedSummary
              .substring(titleWithBoldAndNewline.length)
              .trim();
          } else if (cleanedSummary.trim().startsWith(titleWithBold)) {
            cleanedSummary = cleanedSummary
              .substring(titleWithBold.length)
              .trim()
              .replace(/^[\s\n\r]+/, "")
              .trim();
          }

          const paragraphs = cleanedSummary
            .split(/\n\s*\n/)
            .map((item) => item.trim())
            .filter(Boolean);
          if (paragraphs.length > 0) {
            const firstParaRaw = paragraphs[0] ?? "";
            const firstParaText = firstParaRaw.replace(/^\*\*|\*\*$/g, "").trim();
            const firstParaNormalized = normalizeSpelling(firstParaText.toLowerCase());
            const titleNormalizedLower = titleNormalized.toLowerCase();
            if (
              firstParaText === titlePlainTrimmed ||
              firstParaNormalized === titleNormalizedLower
            ) {
              paragraphs.shift();
              cleanedSummary = paragraphs.join("\n\n").trim();
            }
          }

          const renderedHtml = renderSummaryHtml(cleanedSummary);
          const firstParaMatch = renderedHtml.match(/^<p>([^<]*)<\/p>/i);
          if (firstParaMatch) {
            const firstParaText = stripTags(firstParaMatch[1] ?? "").trim();
            const firstParaNormalized = normalizeSpelling(firstParaText);
            if (
              firstParaText === titlePlainTrimmed ||
              firstParaNormalized === titleNormalized
            ) {
              cleanedSummary = cleanedSummary.replace(/^[^\n]*\n\n/, "").trim();
            }
          }

          return `<li>
  <details class="toc-details">
    <summary class="toc-summary-line">
      <span class="toc-arrow toc-arrow-closed" aria-hidden="true">►</span>
      <span class="toc-arrow toc-arrow-open" aria-hidden="true">▼</span>
      <span class="toc-title-text">${titleHtml}</span>
      <a class="toc-link toc-book-link" href="${href}" aria-label="Kapitel öffnen">📖</a>
    </summary>
    <div class="toc-panel">
      <h3 class="toc-summary-heading">Zusammenfassung</h3>
      <div class="toc-excerpt">${renderSummaryHtml(cleanedSummary)}</div>
    </div>
  </details>
</li>`;
        }
      );
      return `<nav class="toc book-toc" ${marker}>${replaced}</nav>`;
    }
  );

  if (!html.includes("ragkeep-toc-toggle-handler")) {
    html = html.replace(
      /<\/body>/i,
      `<script>
/* ragkeep-toc-toggle-handler */
(function() {
  document.querySelectorAll('nav.toc a.toc-book-link').forEach(function(link) {
    link.addEventListener('click', function(e) {
      e.stopPropagation();
    });
  });
})();
</script>
</body>`
    );
  }
  fs.writeFileSync(tocPath, html, "utf8");
}

function unescapeInlineItalicsEntities(rootDir: string): void {
  const stack = [rootDir];
  while (stack.length > 0) {
    const dir = stack.pop();
    if (!dir) continue;
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const currentPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(currentPath);
        continue;
      }
      if (!entry.isFile() || !currentPath.endsWith(".html")) continue;
      try {
        const current = fs.readFileSync(currentPath, "utf8");
        const next = current
          .replace(/&lt;\s*i\s*&gt;/gi, "<em>")
          .replace(/&lt;\s*\/\s*i\s*&gt;/gi, "</em>");
        if (next !== current) fs.writeFileSync(currentPath, next, "utf8");
      } catch {
        // ignore single-file errors
      }
    }
  }
}

export function copyBookHtmlToSite(book: Book, outputDir: string): void {
  const destination = path.join(outputDir, book.relOutputDir);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(book.absHtmlDir, destination, { recursive: true });
  injectTocSummaries(book.absBookDir, destination);
  unescapeInlineItalicsEntities(destination);
  fixBookTocPageTitle(book, destination);
}
