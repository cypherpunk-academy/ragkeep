#!/usr/bin/env node
/*
  Build a static site under `site/` that lists all books with HTML outputs and links to their HTML index.
  It scans both `books/` and `ragkeep-deutsche-klassik-books-de/books/` for book dirs that contain either
  `html/index.html` or `results/html/index.html`, then copies the found html dir to `site/books/<bookDir>/`.
*/

const fs = require('fs');
const path = require('path');

// This script lives under `administration/scripts/`, so repo root is 2 levels up.
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const OUTPUT_DIR = path.join(REPO_ROOT, 'site');

/**
 * Parse author and title from a book directory name of the form
 * Author#Book_Title#Id (we only care about the first two segments).
 */
function parseAuthorAndTitle(dirName) {
  const parts = dirName.split('#');
  const authorRaw = parts[0] || '';
  const titleRaw = parts[1] || dirName;
  const decode = (s) => s.replace(/_/g, ' ');
  return {
    author: decode(authorRaw),
    title: decode(titleRaw),
  };
}

function ensureCleanDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  fs.mkdirSync(dir, { recursive: true });
}

function fileExists(p) {
  try {
    fs.accessSync(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function readSubtitleFromManifest(absBookDir) {
  const p = path.join(absBookDir, 'book-manifest.yaml');
  if (!fileExists(p)) return '';
  const content = fs.readFileSync(p, 'utf8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^subtitle:\s*(.*)\s*$/);
    if (!m) continue;

    let v = (m[1] || '').trim();
    if (!v) return '';

    // Handle quoted multi-line: subtitle: "foo ...\n  bar"
    if (v.startsWith('"')) {
      v = v.slice(1);
      while (true) {
        const endIdx = v.indexOf('"');
        if (endIdx !== -1) {
          v = v.slice(0, endIdx);
          break;
        }
        const next = lines[++i];
        if (next == null) break;
        v += ' ' + next.trim();
      }
    }

    return v.replace(/\s+/g, ' ').trim();
  }
  return '';
}

function readScalarFromManifest(absBookDir, key) {
  const p = path.join(absBookDir, 'book-manifest.yaml');
  if (!fileExists(p)) return '';
  const content = fs.readFileSync(p, 'utf8');
  const lines = content.split('\n');
  const re = new RegExp(`^${key}:\\s*(.*)\\s*$`);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(re);
    if (!m) continue;

    let v = (m[1] || '').trim();
    if (!v) return '';

    // Handle quoted multi-line: key: "foo ...\n  bar"
    if (v.startsWith('"')) {
      v = v.slice(1);
      while (true) {
        const endIdx = v.indexOf('"');
        if (endIdx !== -1) {
          v = v.slice(0, endIdx);
          break;
        }
        const next = lines[++i];
        if (next == null) break;
        v += ' ' + next.trim();
      }
    }

    return v.replace(/\s+/g, ' ').trim();
  }
  return '';
}

function findHtmlDirForBook(bookRootDir) {
  const rootHtml = path.join(bookRootDir, 'html');
  const resultsHtml = path.join(bookRootDir, 'results', 'html');
  const rootIndex = path.join(rootHtml, 'index.html');
  const resultsIndex = path.join(resultsHtml, 'index.html');

  // Prefer html/ at book root (new default), but keep fallback to results/html (legacy)
  if (fileExists(rootIndex)) return rootHtml;
  if (fileExists(resultsIndex)) return resultsHtml;
  return null;
}

function collectBooks() {
  const sources = [
    path.join(REPO_ROOT, 'books'),
    path.join(REPO_ROOT, 'ragkeep-deutsche-klassik-books-de', 'books'),
  ];

  /** @type {Array<{dirName:string, absBookDir:string, absHtmlDir:string, relOutputDir:string, author:string, title:string, subtitle:string}>} */
  const books = [];

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
      const author = readScalarFromManifest(absBookDir, 'author') || parsed.author;
      const title = readScalarFromManifest(absBookDir, 'title') || parsed.title;
      const subtitle = readScalarFromManifest(absBookDir, 'subtitle') || '';
      const relOutputDir = path.join('books', dirName);
      books.push({ dirName, absBookDir, absHtmlDir, relOutputDir, author, title, subtitle });
    }
  }

  // De-duplicate by dirName in case the same book exists in both sources; prefer the one under top-level books/ (newest pipeline output).
  const preferredPrefix = path.join(REPO_ROOT, 'books') + path.sep;
  const byName = new Map();
  for (const b of books) {
    const existing = byName.get(b.dirName);
    if (!existing) {
      byName.set(b.dirName, b);
      continue;
    }
    const isPreferred = b.absBookDir.startsWith(preferredPrefix);
    if (isPreferred) byName.set(b.dirName, b);
  }

  return Array.from(byName.values()).sort((a, b) => {
    // Sort by author then title for nicer index
    const aKey = `${a.author}\u0000${a.title}`.toLowerCase();
    const bKey = `${b.author}\u0000${b.title}`.toLowerCase();
    return aKey.localeCompare(bKey);
  });
}

function copyBookHtmlToSite(book) {
  const destAbs = path.join(OUTPUT_DIR, book.relOutputDir);
  fs.mkdirSync(path.dirname(destAbs), { recursive: true });
  fs.cpSync(book.absHtmlDir, destAbs, { recursive: true });
  ensurePrettyTocCss(destAbs);
  injectTocSummaries({ absBookDir: book.absBookDir, destBookHtmlDir: destAbs });
  unescapeInlineItalicsEntities(destAbs);
  fixBookTocPageTitle({ book, destBookHtmlDir: destAbs });
}

function fixBookTocPageTitle({ book, destBookHtmlDir }) {
  const tocPath = path.join(destBookHtmlDir, 'index.html');
  if (!fileExists(tocPath)) return;

  const titleText = (book?.title || '').trim();
  if (!titleText) return;

  let html = fs.readFileSync(tocPath, 'utf8');

  // Update <title>...</title>
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(titleText)}</title>`);

  // Replace the first <h1>...</h1> only (TOC page header)
  html = html.replace(/<h1[^>]*>[\s\S]*?<\/h1>/i, `<h1>${escapeHtml(titleText)}</h1>`);

  fs.writeFileSync(tocPath, html, 'utf8');
}

function ensurePrettyTocCss(destBookHtmlDir) {
  const cssPath = path.join(destBookHtmlDir, 'assets', 'styles.css');
  if (!fileExists(cssPath)) return;

  const marker = '/* ragkeep:pretty-toc */';
  const current = fs.readFileSync(cssPath, 'utf8');

  // Replace any previous injected TOC block (we always keep it at file end)
  const base = current.replace(/\/\* ragkeep:pretty-toc[\s\S]*$/m, '').trimEnd();

  // Keep this strictly scoped to TOC pages: the selector is `nav.toc ...`
  const extra = `
\n${marker}
nav.toc {
  margin: 1.25rem 0 2.25rem;
}

nav.toc ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

nav.toc li {
  margin: 0;
  padding: 0.65rem 0;
  border-top: 1px solid rgba(127, 127, 127, 0.22);
}

nav.toc a {
  color: inherit;
  text-decoration: none;
  font-family: var(--heading-font-family, var(--font-family, "Cormorant Garamond", Georgia, "Times New Roman", serif));
  font-size: 0.95em;
  line-height: 1.25;
  letter-spacing: -0.01em;
  transition: opacity 140ms ease, text-decoration-color 140ms ease;
}

nav.toc a:hover {
  opacity: 0.9;
  text-decoration: underline;
  text-decoration-color: rgba(127, 127, 127, 0.45);
}

nav.toc a:focus-visible {
  outline: 3px solid rgba(120, 170, 255, 0.55);
  outline-offset: 4px;
  border-radius: 10px;
}

nav.toc li:first-child {
  border-top: 0;
}

/* If there are no summaries available (no <details> injected), keep a simple arrow for plain links */
nav.toc li > a::before {
  content: "►";
  width: 1.2ch;
  opacity: 0.6;
  display: inline-block;
  text-align: center;
  margin-right: 10px;
}

/* Expandable TOC items (injected by build:pages when summaries exist) */
nav.toc details.toc-details {
  padding: 0;
  width: 100%;
}

nav.toc summary.toc-summary-line {
  list-style: none;
  cursor: pointer;
  display: flex;
  align-items: baseline;
  gap: 10px;
  width: 100%;
  min-width: 0;
}

nav.toc summary.toc-summary-line::-webkit-details-marker { display: none; }

nav.toc .toc-arrow {
  width: 1.2ch;
  opacity: 0.6;
  display: inline-block;
  text-align: center;
  flex: 0 0 auto;
  position: absolute;
  left: 0;
}

nav.toc summary.toc-summary-line {
  position: relative;
  padding-left: calc(1.2ch + 10px);
}

nav.toc .toc-title-text {
  flex: 1 1 auto;
  min-width: 0;
  font-family: var(--heading-font-family, var(--font-family, "Cormorant Garamond", Georgia, "Times New Roman", serif));
}

nav.toc a.toc-book-link {
  flex: 0 0 auto;
  text-decoration: none;
  font-size: 1.65em;
  opacity: 0.7;
  transition: opacity 140ms ease;
  line-height: 1;
}

nav.toc a.toc-book-link:hover {
  opacity: 1;
}

nav.toc summary.toc-summary-line:hover { opacity: 0.95; }

nav.toc summary.toc-summary-line:focus-visible {
  outline: 3px solid rgba(120, 170, 255, 0.55);
  outline-offset: 4px;
  border-radius: 10px;
}

nav.toc .toc-panel {
  margin-top: 0.55rem;
  margin-left: calc(1.2ch + 10px);
}

nav.toc .toc-summary-heading {
  font-family: var(--heading-font-family, var(--font-family, "Cormorant Garamond", Georgia, "Times New Roman", serif));
  font-size: 0.8075em;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
  opacity: 0.85;
}

nav.toc .toc-actions {
  margin-bottom: 0.35rem;
}

nav.toc a.toc-open {
  font-family: var(--heading-font-family, var(--font-family, "Cormorant Garamond", Georgia, "Times New Roman", serif));
  font-size: 0.82em;
  color: inherit;
  opacity: 0.72;
  text-decoration: underline;
  text-decoration-color: rgba(127,127,127,0.45);
}

nav.toc .toc-excerpt {
  font-size: 0.92em;
  line-height: 1.45;
}

@media (max-width: 640px) {
  nav.toc .toc-excerpt { font-size: 0.98em; }
}

/* Toggle the arrow icons based on expanded/collapsed state - only one visible at a time */
nav.toc details:not([open]) .toc-arrow-open { display: none !important; }
nav.toc details[open] .toc-arrow-closed { display: none !important; }

/* Make chapter links look like the rest of the TOC */
nav.toc a.toc-link {
  color: inherit;
  text-decoration: none;
  font-family: var(--heading-font-family, var(--font-family, "Cormorant Garamond", Georgia, "Times New Roman", serif));
}

nav.toc a.toc-link:hover {
  text-decoration: underline;
  text-decoration-color: rgba(127,127,127,0.45);
}

nav.toc .toc-title {
  font-family: var(--heading-font-family, var(--font-family, "Cormorant Garamond", Georgia, "Times New Roman", serif));
  flex: 1 1 auto;
  min-width: 0;
}
`;

  fs.writeFileSync(cssPath, base + extra, 'utf8');
}

function injectTocSummaries({ absBookDir, destBookHtmlDir }) {
  const summariesPath = path.join(absBookDir, 'results', 'rag-chunks', 'summaries-chunks.jsonl');
  if (!fileExists(summariesPath)) return;

  const tocPath = path.join(destBookHtmlDir, 'index.html');
  if (!fileExists(tocPath)) return;

  const marker = 'data-ragkeep-toc-summaries="6"';
  let html = fs.readFileSync(tocPath, 'utf8');
  if (html.includes(marker)) return;

  const summariesByTitle = new Map();
  const lines = fs.readFileSync(summariesPath, 'utf8').split('\n').filter(Boolean);
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      const title = (obj?.metadata?.source_title || obj?.source_title || '').toString().trim();
      const text = (obj?.text || '').toString().trim();
      if (!title || !text) continue;
      if (!summariesByTitle.has(title)) summariesByTitle.set(title, text);
    } catch {
      // ignore malformed line
    }
  }
  if (summariesByTitle.size === 0) return;

  html = html.replace(/<nav class="toc"[^>]*>([\s\S]*?)<\/nav>/m, (navMatch, navInner) => {
    const replaced = navInner.replace(/<li>\s*<a href="([^"]+)">([\s\S]*?)<\/a>\s*<\/li>/g, (liMatch, href, rawTitleHtml) => {
      const decoded = decodeHtmlEntities(String(rawTitleHtml || '').trim());
      const titlePlain = stripTags(decoded).trim();
      const titleHtml = renderInlineWithEmphasis(decoded).trim();

      const summaryText = pickBestSummaryText(summariesByTitle, titlePlain);
      if (!summaryText) return `<li><a class="toc-link" href="${href}">${titleHtml}</a></li>`;

      // Remove duplicate chapter title from summary if it appears at the start
      let cleanedSummary = summaryText;
      const titlePlainLower = titlePlain.toLowerCase().trim();
      const summaryStart = cleanedSummary.substring(0, Math.min(200, cleanedSummary.length)).toLowerCase();
      if (summaryStart.startsWith(titlePlainLower)) {
        // Remove title if it's at the very start
        cleanedSummary = cleanedSummary.substring(titlePlain.length).trim();
        // Also remove if followed by newline/paragraph break
        if (cleanedSummary.match(/^[\n\r\s]*[:\-\.]?[\n\r\s]*/)) {
          cleanedSummary = cleanedSummary.replace(/^[\n\r\s]*[:\-\.]?[\n\r\s]*/, '').trim();
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
    });

    return `<nav class="toc" ${marker}>${replaced}</nav>`;
  });

  // Inject JavaScript to prevent book link from toggling summary
  if (!html.includes('ragkeep-toc-toggle-handler')) {
    html = html.replace(/<\/body>/i, `<script>
(function() {
  // Prevent book link (📖) from toggling the summary
  document.querySelectorAll('nav.toc a.toc-book-link').forEach(function(link) {
    link.addEventListener('click', function(e) {
      e.stopPropagation();
    });
  });
})();
</script>
</body>`);
  }

  fs.writeFileSync(tocPath, html, 'utf8');
}

function pickBestSummaryText(summariesByTitle, tocTitle) {
  if (summariesByTitle.has(tocTitle)) return summariesByTitle.get(tocTitle);

  const norm = (s) =>
    s
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^a-z0-9äöüß\s]/g, '')
      .trim();
  const n = norm(tocTitle);
  if (!n) return null;
  for (const [k, v] of summariesByTitle.entries()) {
    if (norm(k) === n) return v;
  }
  return null;
}

function renderSummaryHtml(text) {
  const cleaned = String(text || '').replace(/\*\*/g, '');
  const paras = cleaned.split(/\n\s*\n/g).map((p) => p.trim()).filter(Boolean);
  const safe = paras
    .map((p) => `<p>${renderInlineWithEmphasis(p).replace(/\n/g, '<br/>')}</p>`)
    .join('');
  return safe || `<p>${renderInlineWithEmphasis(cleaned)}</p>`;
}

function decodeHtmlEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function stripTags(s) {
  return String(s || '').replace(/<[^>]*>/g, '');
}

function renderInlineWithEmphasis(s) {
  // Allow <i>...</i> (or <em>) to render as emphasis, but strip any other tags.
  let t = String(s || '');
  t = t.replace(/<\s*\/\s*em\s*>/gi, '__EM_CLOSE__');
  t = t.replace(/<\s*em\s*>/gi, '__EM_OPEN__');
  t = t.replace(/<\s*\/\s*i\s*>/gi, '__EM_CLOSE__');
  t = t.replace(/<\s*i\s*>/gi, '__EM_OPEN__');
  // Remove any other tags
  t = t.replace(/<[^>]*>/g, '');
  // Escape, then re-inject allowed tags
  t = escapeHtml(t);
  t = t.replace(/__EM_OPEN__/g, '<em>').replace(/__EM_CLOSE__/g, '</em>');
  return t;
}

function unescapeInlineItalicsEntities(rootDir) {
  // Convert literal "&lt;i&gt;...&lt;/i&gt;" to real emphasis tags in copied HTML files.
  const stack = [rootDir];
  while (stack.length) {
    const dir = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        stack.push(p);
        continue;
      }
      if (!e.isFile() || !p.endsWith('.html')) continue;
      try {
        const cur = fs.readFileSync(p, 'utf8');
        const next = cur
          .replace(/&lt;\s*i\s*&gt;/gi, '<em>')
          .replace(/&lt;\s*\/\s*i\s*&gt;/gi, '</em>');
        if (next !== cur) fs.writeFileSync(p, next, 'utf8');
      } catch {
        // ignore
      }
    }
  }
}

function writeNoJekyll() {
  const p = path.join(OUTPUT_DIR, '.nojekyll');
  fs.writeFileSync(p, '');
}

function writeRobots() {
  const p = path.join(OUTPUT_DIR, 'robots.txt');
  fs.writeFileSync(p, 'User-agent: *\nAllow: /\n');
}

function generateIndexHtml(books) {
  const generatedAt = new Date().toISOString();
  const total = books.length;

  const cards = books.map((b) => {
    // Encode the directory component to support special characters like '#', spaces, or umlauts
    const href = `books/${encodeURIComponent(b.dirName)}/index.html`;
    const title = escapeHtml(b.title);
    const author = escapeHtml(b.author);
    const subtitle = escapeHtml(b.subtitle || '');
    const subtitleCover = subtitle ? `<div class="coverSubtitle">${subtitle}</div>` : '';
    return `
        <a class="card" href="${href}" aria-label="${author}: ${title}">
          <div class="cover" aria-hidden="true">
            <div class="coverInner">
              <div class="coverTitle">${title}</div>
              ${subtitleCover}
              <div class="coverAuthor">${author}</div>
              <div class="coverBottom">
                <div class="coverHint">Kapitelübersicht</div>
                <div class="coverBrand">@ragkeep</div>
              </div>
            </div>
          </div>
        </a>`;
  }).join('\n');

  const html = `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>ragkeep – Datenlager für ragrun KI Assistenten</title>
    <meta name="description" content="RAGKeep – automatisch generierte HTML-Ausgaben von Büchern." />
    <meta name="color-scheme" content="light" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&display=swap" rel="stylesheet" />
    <style>
      :root {
        --bg: #ffffff;
        --fg: #0b1220;
        --muted: rgba(11, 18, 32, 0.70);
        --card: #ffffff;
        --cardBorder: rgba(11, 18, 32, 0.10);
        --shadow: 0 20px 60px rgba(11, 18, 32, 0.12);
        --radius: 16px;
      }

      * { box-sizing: border-box; }
      html, body { height: 100%; }
      body {
        margin: 0;
        color: var(--fg);
        background: var(--bg);
        font-family: "Cormorant Garamond", Georgia, "Times New Roman", serif;
        line-height: 1.5;
      }

      .wrap { max-width: 1120px; margin: 0 auto; padding: 42px 18px 56px; }
      header { margin-bottom: 22px; }
      h1 { margin: 0 0 6px 0; font-size: clamp(28px, 4vw, 40px); letter-spacing: -0.02em; }
      .lede { margin: 0 0 10px 0; color: var(--muted); font-size: 15px; max-width: 70ch; }
      .sub { margin: 0; color: var(--muted); font-size: 14px; display: flex; flex-wrap: wrap; gap: 8px 14px; }
      .pill {
        display: inline-flex;
        align-items: center;
        padding: 6px 10px;
        border-radius: 999px;
        background: rgba(11, 18, 32, 0.04);
        border: 1px solid var(--cardBorder);
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
      }
      .brand {
        margin-left: auto;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        font-size: 12px;
        letter-spacing: 0.01em;
        opacity: 0.8;
        user-select: none;
        padding: 6px 10px;
        border-radius: 999px;
        border: 1px solid var(--cardBorder);
        background: rgba(11, 18, 32, 0.03);
      }

      .grid {
        margin-top: 18px;
        display: grid;
        grid-template-columns: repeat( auto-fit, minmax(220px, 1fr) );
        gap: 16px;
      }

      .card {
        display: grid;
        grid-template-rows: auto;
        padding: 14px;
        border-radius: var(--radius);
        background: var(--card);
        border: 1px solid var(--cardBorder);
        color: inherit;
        text-decoration: none;
        transition: background 160ms ease, border-color 160ms ease;
      }
      .card:focus-visible { outline: 3px solid rgba(120, 170, 255, 0.6); outline-offset: 2px; }
      .card:hover { border-color: rgba(11, 18, 32, 0.18); background: rgba(11, 18, 32, 0.012); }

      /* “Book cover” without images: gradient + subtle spine + title/author */
      .cover {
        aspect-ratio: 3 / 4;
        border-radius: 14px;
        position: relative;
        overflow: hidden;
        background: #ffffff;
        border: 1px solid rgba(11, 18, 32, 0.10);
      }
      .coverInner {
        position: absolute;
        inset: 0;
        padding: 14px;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        gap: 6px;
      }
      .coverTitle {
        font-weight: 800;
        font-size: 24px;
        line-height: 1.1;
        letter-spacing: -0.02em;
        text-wrap: balance;
      }
      .coverSubtitle {
        font-size: 12px;
        color: rgba(11, 18, 32, 0.70);
        text-wrap: balance;
      }
      .coverAuthor {
        font-size: 12px;
        opacity: 0.92;
        font-weight: 700;
      }
      .coverBottom {
        margin-top: 6px;
        display: flex;
        align-items: baseline;
        gap: 10px;
      }
      .coverHint {
        font-size: 12px;
        opacity: 0.60;
      }
      .coverBrand {
        margin-left: auto;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        font-size: 12px;
        opacity: 0.55;
      }

      footer { margin-top: 22px; color: var(--muted); font-size: 12px; }
      footer a { color: inherit; text-decoration: underline; text-decoration-color: rgba(127,127,127,0.55); }
    </style>
  </head>
  <body>
    <div class="wrap">
      <header>
        <h1>ragkeep – Datenlager für ragrun KI Assistenten</h1>
        <p class="lede">Statische HTML-Ausgaben mit Kapitelübersicht – einfach ein Buch anklicken.</p>
        <p class="sub">
          <span class="pill">${total} Bücher</span>
          <span class="pill">Automatisch generiert: ${generatedAt}</span>
          <span class="brand">@ragkeep</span>
        </p>
      </header>

      <main class="grid">
        ${cards}
      </main>

      <footer>
        Generiert aus den Ordnern <code>books/</code> und <code>ragkeep-deutsche-klassik-books-de/books/</code>.
      </footer>
    </div>
  </body>
</html>`;

  fs.writeFileSync(path.join(OUTPUT_DIR, 'index.html'), html, 'utf8');
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function hashToHue(input) {
  // Stable “random” hue per book dirName (0..359)
  let h = 2166136261; // FNV-1a
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 360;
}

function main() {
  ensureCleanDir(OUTPUT_DIR);
  const books = collectBooks();
  for (const b of books) {
    copyBookHtmlToSite(b);
  }
  writeNoJekyll();
  writeRobots();
  generateIndexHtml(books);
  // eslint-disable-next-line no-console
  console.log(`Built site for ${books.length} book(s) into ${path.relative(REPO_ROOT, OUTPUT_DIR)}`);
}

main();


