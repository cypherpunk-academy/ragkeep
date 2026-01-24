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

  /** @type {Array<{dirName:string, absBookDir:string, absHtmlDir:string, relOutputDir:string, author:string, title:string}>} */
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
      const { author, title } = parseAuthorAndTitle(dirName);
      const relOutputDir = path.join('books', dirName);
      books.push({ dirName, absBookDir, absHtmlDir, relOutputDir, author, title });
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
}

function ensurePrettyTocCss(destBookHtmlDir) {
  const cssPath = path.join(destBookHtmlDir, 'assets', 'styles.css');
  if (!fileExists(cssPath)) return;

  const marker = '/* ragkeep:pretty-toc */';
  const current = fs.readFileSync(cssPath, 'utf8');
  if (current.includes(marker)) return;

  // Keep this strictly scoped to TOC pages: the selector is `nav.toc ...`
  const extra = `
\n${marker}
nav.toc {
  margin: 1.25rem 0 2.5rem;
}

nav.toc ul {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 10px;
  padding: 0;
  margin: 0;
}

nav.toc li {
  margin: 0;
}

nav.toc a {
  display: block;
  padding: 0.85rem 0.95rem;
  border-radius: 14px;
  border: 1px solid rgba(127, 127, 127, 0.25);
  background: rgba(0, 0, 0, 0.03);
  color: inherit;
  text-decoration: none;
  font-family: 'Inter', system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
  font-size: 0.95em;
  line-height: 1.25;
  letter-spacing: -0.01em;
  transition: transform 140ms ease, background 140ms ease, border-color 140ms ease;
}

nav.toc a:hover {
  transform: translateY(-1px);
  background: rgba(0, 0, 0, 0.05);
  border-color: rgba(127, 127, 127, 0.35);
}

nav.toc a:focus-visible {
  outline: 3px solid rgba(120, 170, 255, 0.55);
  outline-offset: 2px;
}

html[data-theme="dark"] nav.toc a {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.14);
}

html[data-theme="dark"] nav.toc a:hover {
  background: rgba(255, 255, 255, 0.10);
  border-color: rgba(255, 255, 255, 0.20);
}
`;

  fs.writeFileSync(cssPath, current + extra, 'utf8');
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
    const hue = hashToHue(b.dirName);
    return `
        <a class="card" href="${href}" aria-label="${author}: ${title}" style="--h:${hue}">
          <div class="cover" aria-hidden="true">
            <div class="coverInner">
              <div class="coverTitle">${title}</div>
              <div class="coverAuthor">${author}</div>
            </div>
          </div>
          <div class="meta">
            <div class="metaTitle">${title}</div>
            <div class="metaAuthor">${author}</div>
          </div>
        </a>`;
  }).join('\n');

  const html = `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>RAGKeep – Bücher mit HTML</title>
    <meta name="description" content="RAGKeep – automatisch generierte HTML-Ausgaben von Büchern." />
    <meta name="color-scheme" content="light dark" />
    <style>
      :root {
        --bg: #0b0f17;
        --fg: #e8eefc;
        --muted: rgba(232, 238, 252, 0.72);
        --card: rgba(255, 255, 255, 0.06);
        --cardBorder: rgba(255, 255, 255, 0.10);
        --shadow: 0 20px 60px rgba(0,0,0,0.45);
        --radius: 16px;
      }

      @media (prefers-color-scheme: light) {
        :root {
          --bg: #f6f8ff;
          --fg: #0b1220;
          --muted: rgba(11, 18, 32, 0.70);
          --card: rgba(255, 255, 255, 0.85);
          --cardBorder: rgba(11, 18, 32, 0.10);
          --shadow: 0 20px 60px rgba(11, 18, 32, 0.12);
        }
      }

      * { box-sizing: border-box; }
      html, body { height: 100%; }
      body {
        margin: 0;
        color: var(--fg);
        background: radial-gradient(1200px 800px at 20% 0%, rgba(120, 150, 255, 0.25), transparent 55%),
                    radial-gradient(1000px 700px at 90% 10%, rgba(255, 130, 200, 0.18), transparent 60%),
                    radial-gradient(900px 700px at 50% 100%, rgba(120, 255, 210, 0.16), transparent 60%),
                    var(--bg);
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
        line-height: 1.45;
      }

      .wrap { max-width: 1120px; margin: 0 auto; padding: 42px 18px 56px; }
      header { margin-bottom: 22px; }
      h1 { margin: 0 0 6px 0; font-size: clamp(28px, 4vw, 40px); letter-spacing: -0.02em; }
      .sub { margin: 0; color: var(--muted); font-size: 14px; display: flex; flex-wrap: wrap; gap: 8px 14px; }
      .pill {
        display: inline-flex;
        align-items: center;
        padding: 6px 10px;
        border-radius: 999px;
        background: rgba(255,255,255,0.06);
        border: 1px solid var(--cardBorder);
        backdrop-filter: blur(10px);
      }

      .grid {
        margin-top: 18px;
        display: grid;
        grid-template-columns: repeat( auto-fit, minmax(220px, 1fr) );
        gap: 16px;
      }

      .card {
        display: grid;
        grid-template-rows: auto 1fr;
        gap: 10px;
        padding: 14px;
        border-radius: var(--radius);
        background: var(--card);
        border: 1px solid var(--cardBorder);
        color: inherit;
        text-decoration: none;
        box-shadow: 0 0 0 rgba(0,0,0,0);
        transform: translateY(0);
        transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
      }
      .card:focus-visible { outline: 3px solid rgba(120, 170, 255, 0.6); outline-offset: 2px; }
      .card:hover { transform: translateY(-2px); box-shadow: var(--shadow); border-color: rgba(255,255,255,0.18); }

      /* “Book cover” without images: gradient + subtle spine + title/author */
      .cover {
        aspect-ratio: 3 / 4;
        border-radius: 14px;
        position: relative;
        overflow: hidden;
        background:
          linear-gradient(135deg,
            hsl(var(--h) 85% 55% / 0.95),
            hsl(calc(var(--h) + 32) 85% 52% / 0.92),
            hsl(calc(var(--h) + 68) 85% 48% / 0.90)
          );
      }
      .cover::before {
        content: "";
        position: absolute;
        inset: 0;
        background:
          linear-gradient(90deg,
            rgba(0,0,0,0.35) 0%,
            rgba(0,0,0,0.10) 10%,
            rgba(255,255,255,0.10) 16%,
            rgba(0,0,0,0.06) 22%,
            rgba(0,0,0,0.00) 36%
          );
        mix-blend-mode: overlay;
        pointer-events: none;
      }
      .cover::after {
        content: "";
        position: absolute;
        inset: -40% -40% auto auto;
        width: 220px;
        height: 220px;
        background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.35), transparent 60%);
        transform: rotate(18deg);
        pointer-events: none;
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
        font-size: 16px;
        line-height: 1.1;
        letter-spacing: -0.02em;
        text-wrap: balance;
        text-shadow: 0 2px 16px rgba(0,0,0,0.35);
      }
      .coverAuthor {
        font-size: 12px;
        opacity: 0.92;
        text-shadow: 0 2px 16px rgba(0,0,0,0.35);
      }

      .metaTitle { font-weight: 700; font-size: 14px; line-height: 1.25; text-wrap: balance; }
      .metaAuthor { margin-top: 4px; color: var(--muted); font-size: 12.5px; }

      footer { margin-top: 22px; color: var(--muted); font-size: 12px; }
      footer a { color: inherit; text-decoration: underline; text-decoration-color: rgba(127,127,127,0.55); }
    </style>
  </head>
  <body>
    <div class="wrap">
      <header>
        <h1>RAGKeep – Bücher mit HTML</h1>
        <p class="sub">
          <span class="pill">${total} Bücher</span>
          <span class="pill">Automatisch generiert: ${generatedAt}</span>
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


