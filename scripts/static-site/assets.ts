import path from "node:path";
import { writeTextFile } from "./utils";

const stylesCss = `
:root {
  --font-serif: "Cormorant Garamond", Georgia, "Times New Roman", serif;
  --font-header: "Lato", sans-serif;
  --font-summary: "Lato", sans-serif;
  --font-sans: "Lato", ui-sans-serif, system-ui, -apple-system, sans-serif;

  --bg: #f8f9fb;
  --surface: #ffffff;
  --surface-soft: #f3f4f6;
  --fg: #111827;
  --muted: #6b7280;
  --border: #e5e7eb;
  --accent: #4f46e5;
  --accent-soft: #eef2ff;
}

html, body {
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--font-sans);
  font-weight: 400;
  background: var(--bg);
  color: var(--fg);
  line-height: 1.5;
}

a {
  color: inherit;
}

.site-shell {
  min-height: 100vh;
}

.site-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
}

.hero-title {
  font-family: var(--font-header);
  font-weight: 400;
  font-size: clamp(2.15rem, 4.2vw, 3.35rem);
  letter-spacing: -0.03em;
  line-height: 1.05;
  margin: 0;
}

.hero-lede {
  color: var(--muted);
  margin: 0;
}

.pill {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 0.2rem 0.7rem;
  border: 1px solid transparent;
  font-size: 0.82rem;
}

.pill-accent {
  background: var(--accent-soft);
  border-color: #c7d2fe;
  color: #3730a3;
}

.pill-muted {
  background: var(--surface-soft);
  border-color: #d1d5db;
  color: #374151;
}

.tab-link {
  text-decoration: none;
  border-radius: 10px;
  padding: 0.45rem 0.9rem;
  border: 1px solid transparent;
  color: #4b5563;
  font-size: 0.94rem;
}

.tab-link:hover {
  background: #eef2ff;
  color: #1f2937;
}

.tab-link-active {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

.book-link,
.file-link {
  text-decoration: none;
  border: 1px solid var(--border);
  background: #ffffff;
  border-radius: 12px;
}

.book-link:hover,
.file-link:hover {
  border-color: #c7d2fe;
  box-shadow: 0 8px 24px rgba(79, 70, 229, 0.1);
}

.empty-state {
  color: var(--muted);
  font-style: italic;
}

.meta-quiet {
  color: var(--muted);
}
`.trimStart();

const layoutCss = `
* {
  box-sizing: border-box;
}

.wrap {
  max-width: 1180px;
  margin: 0 auto;
  padding: 36px 18px 56px;
}

.hero {
  text-align: center;
  margin-bottom: 22px;
}

.hero .meta {
  margin-top: 14px;
}

.agent-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 22px;
}

.agent-card {
  overflow: hidden;
  text-decoration: none;
  color: inherit;
  display: block;
}

.agent-media {
  height: 180px;
  position: relative;
  background: linear-gradient(180deg, #eef2ff 0%, #e5e7eb 100%);
}

.agent-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.agent-overlay {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 14px;
  color: #fff;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.56), rgba(0, 0, 0, 0));
}

.agent-overlay h3 {
  font-family: var(--font-header);
  font-weight: 400;
  margin: 0;
  font-size: 1.9rem;
  line-height: 1.1;
}

.agent-overlay p {
  margin: 2px 0 0;
  font-size: 0.8rem;
}

.agent-body {
  padding: 14px;
}

.agent-meta {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 0.8rem;
  border-top: 1px solid #f3f4f6;
  padding-top: 9px;
}

.agent-header {
  padding: 1.4rem;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 1.2rem;
  align-items: center;
}

.agent-header h1 {
  font-family: var(--font-header);
  font-weight: 400;
  margin: 0;
}

.agent-avatar {
  width: 100px;
  height: 100px;
  border-radius: 999px;
  overflow: hidden;
  border: 3px solid #e0e7ff;
  background: #eef2ff;
}

.agent-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.tab-row {
  margin-top: 14px;
  margin-bottom: 14px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 8px;
}

.content-card {
  padding: 1.4rem;
}

.content-card h1,
.content-card h3 {
  font-family: var(--font-header);
  font-weight: 400;
}

.agent-body p,
.agent-description {
  font-family: var(--font-summary);
  font-weight: 300;
}

.stack-8 > * + * {
  margin-top: 0.5rem;
}

.stack-16 > * + * {
  margin-top: 1rem;
}

.stack-24 > * + * {
  margin-top: 1.5rem;
}

.book-list,
.file-list {
  display: grid;
  gap: 12px;
}

.essay-card {
  display: block;
}

.essay-summary-details .toc-summary-line {
  padding-left: 0;
}

.essay-summary-details .toc-arrow {
  display: none;
}

.concepts-dropdown-label {
  display: block;
  margin-bottom: 0.5rem;
  font-family: var(--font-header);
  font-weight: 400;
}

.concepts-dropdown {
  margin-bottom: 1rem;
  padding: 0.4rem 0.8rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  font: inherit;
  background: var(--surface);
}

.concept-accordion-item {
  margin-bottom: 0.5rem;
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
}

.concepts-accordions .toc-details {
  padding: 0;
}

.concepts-accordions .toc-summary-line {
  padding: 12px;
  cursor: pointer;
  list-style: none;
}

.concepts-accordions .toc-summary-line::-webkit-details-marker {
  display: none;
}

.concepts-accordions .toc-panel {
  padding: 0 12px 12px;
  margin-left: 0;
}

.concepts-accordions .toc-excerpt {
  font-family: var(--font-summary);
  font-weight: 300;
  font-size: 0.95em;
  line-height: 1.5;
}

.concepts-accordions .toc-arrow {
  display: inline-block;
  width: 1.2ch;
  margin-right: 0.5rem;
}

.concepts-accordions details:not([open]) .toc-arrow-open {
  display: none !important;
}

.concepts-accordions details[open] .toc-arrow-closed {
  display: none !important;
}

.book-link {
  display: grid;
  grid-template-columns: 1fr;
  gap: 4px;
  padding: 12px;
}

.file-link {
  display: inline-flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px;
}

.quote-card,
.conversation-card,
.taxonomy-item {
  border: 1px solid var(--border);
  background: #fff;
  border-radius: 12px;
  padding: 12px;
}

.back-link {
  text-decoration: none;
  color: var(--muted);
  font-size: 0.9rem;
}

@media (max-width: 760px) {
  .agent-header {
    grid-template-columns: 1fr;
  }

  .agent-avatar {
    width: 88px;
    height: 88px;
  }
}
`.trimStart();

const darkCss = `
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0f1117;
    --surface: #131722;
    --surface-soft: #181d2b;
    --fg: #e9ecf3;
    --muted: #b6bfce;
    --border: #2a3243;
    --accent: #6366f1;
    --accent-soft: #1f2453;
  }

  .agent-overlay {
    background: linear-gradient(to top, rgba(0, 0, 0, 0.65), rgba(0, 0, 0, 0));
  }

  .agent-meta {
    border-top-color: #2a3243;
  }
}
`.trimStart();

const bookCss = `
@import url("https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Lato:wght@300;400&display=swap");

:root {
  --book-bg: #ffffff;
  --book-fg: #0b1220;
  --book-muted: rgba(11, 18, 32, 0.72);
  --book-border: rgba(127, 127, 127, 0.24);
  --book-focus: rgba(120, 170, 255, 0.55);
  --reader-control-bg: rgba(0, 0, 0, 0.03);
  --reader-control-border: rgba(127, 127, 127, 0.35);
  --font-serif: "Cormorant Garamond", Georgia, "Times New Roman", serif;
  --font-header: "Lato", sans-serif;
  --font-summary: "Lato", sans-serif;
}

* { box-sizing: border-box; }
html, body { min-height: 100%; }
html.book-page {
  color: var(--book-fg);
  background: var(--book-bg);
  font-family: var(--font-serif);
}
body.book-body { margin: 0; }

.book-main {
  max-width: 820px;
  margin: 0 auto;
  padding: 56px 20px 64px;
  line-height: 1.55;
  font-size: 1.16rem;
}

.book-title,
.book-chapter-title,
.book-subheading {
  font-family: var(--font-header);
  font-weight: 400;
  margin: 0 0 1rem;
  letter-spacing: -0.01em;
}

.book-title { font-size: clamp(2rem, 4vw, 2.8rem); }
.book-chapter-title { font-size: clamp(1.55rem, 3.2vw, 2.15rem); }
.book-subheading { font-size: clamp(1.2rem, 2.4vw, 1.55rem); margin-top: 2rem; }

.book-paragraph { margin: 0 0 1.05rem; }
.book-paragraph-text { margin: 0; }
.book-sentence { display: inline; }

.reader-toggle {
  position: fixed;
  top: 8px;
  z-index: 9999;
  background: var(--reader-control-bg);
  backdrop-filter: saturate(120%) blur(2px);
  border: 1px solid var(--reader-control-border);
  color: inherit;
  border-radius: 9999px;
  padding: 6px 10px;
  font: inherit;
  line-height: 1;
  cursor: pointer;
}

.reader-toggle-theme { right: 8px; }
.reader-toggle-size { right: 48px; }

.chapter-nav {
  margin-top: 2.2rem;
  display: flex;
  gap: 0.75rem;
}

.nav-btn {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--book-border);
  border-radius: 999px;
  padding: 0.4rem 0.8rem;
  color: inherit;
  text-decoration: none;
}

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
  font-family: var(--font-header);
  font-weight: 400;
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

nav.toc a:focus-visible,
.nav-btn:focus-visible,
.reader-toggle:focus-visible {
  outline: 3px solid var(--book-focus);
  outline-offset: 3px;
  border-radius: 10px;
}

nav.toc li:first-child {
  border-top: 0;
}

nav.toc li > a::before {
  content: "►";
  width: 1.2ch;
  opacity: 0.6;
  display: inline-block;
  text-align: center;
  margin-right: 10px;
}

nav.toc details.toc-details {
  padding: 0;
  width: 100%;
}

nav.toc summary.toc-summary-line {
  list-style: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 18px;
  width: 100%;
  min-width: 0;
  position: relative;
  padding-left: calc(1.2ch + 18px);
}

nav.toc summary.toc-summary-line::-webkit-details-marker { display: none; }

nav.toc .toc-arrow {
  width: 1.2ch;
  color: rgba(127, 127, 127, 0.22);
  display: inline-block;
  text-align: center;
  flex: 0 0 auto;
  position: absolute;
  left: 0;
}

nav.toc .toc-title-text {
  flex: 1 1 auto;
  min-width: 0;
  font-family: var(--font-header);
  font-weight: 400;
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

nav.toc .toc-panel {
  margin-top: 0.55rem;
  margin-left: calc(1.2ch + 18px);
}

nav.toc .toc-summary-heading {
  font-family: var(--font-header);
  font-weight: 400;
  font-size: 0.8075em;
  margin: 0 0 0.5rem 0;
  opacity: 0.85;
}

/* Zusammenfassungen: Lato Light 300 */
nav.toc .toc-excerpt {
  font-family: var(--font-summary);
  font-weight: 300;
  font-size: 0.92em;
  line-height: 1.45;
}

nav.toc details:not([open]) .toc-arrow-open { display: none !important; }
nav.toc details[open] .toc-arrow-closed { display: none !important; }

html[data-theme="dark"] {
  --book-bg: #0f1117;
  --book-fg: #e9ecf3;
  --book-muted: rgba(233, 236, 243, 0.72);
  --book-border: rgba(233, 236, 243, 0.3);
  --reader-control-bg: rgba(255, 255, 255, 0.06);
  --reader-control-border: rgba(233, 236, 243, 0.3);
}

html[data-size="l"] .book-main { font-size: 1.28rem; }
html[data-size="xl"] .book-main { font-size: 1.42rem; }

@media (max-width: 640px) {
  .book-main { padding: 52px 14px 46px; }
  nav.toc .toc-excerpt { font-size: 0.98em; }
}
`.trimStart();

const readerJs = `
(function(){
  var d = document.documentElement;
  var themeBtn = document.getElementById("themeToggle");
  var sizeBtn = document.getElementById("sizeToggle");

  function getTheme(){ return d.getAttribute("data-theme") || "default"; }
  function setTheme(t){
    d.setAttribute("data-theme", t);
    try { localStorage.setItem("readerTheme", t); } catch(e) {}
    updateTheme();
  }
  function getSize(){ return d.getAttribute("data-size") || "base"; }
  function setSize(s){
    if (s === "base") d.removeAttribute("data-size"); else d.setAttribute("data-size", s);
    try { localStorage.setItem("readerSize", s); } catch(e) {}
    updateSize();
  }
  function updateTheme(){
    if (!themeBtn) return;
    var t = getTheme();
    themeBtn.textContent = (t === "default") ? "🌙" : "☀️";
    themeBtn.setAttribute("aria-pressed", String(t === "dark"));
  }
  function updateSize(){
    if (!sizeBtn) return;
    var s = getSize();
    sizeBtn.textContent = (s === "base") ? "A" : (s === "l" ? "A+" : "A++");
    sizeBtn.setAttribute("aria-pressed", String(s !== "base"));
  }
  try {
    var savedTheme = localStorage.getItem("readerTheme");
    if (savedTheme) d.setAttribute("data-theme", savedTheme);
    var savedSize = localStorage.getItem("readerSize");
    if (savedSize && savedSize !== "base") d.setAttribute("data-size", savedSize);
  } catch(e) {}
  if (themeBtn) {
    themeBtn.addEventListener("click", function(){
      var t = getTheme();
      setTheme(t === "dark" ? "default" : "dark");
    });
  }
  if (sizeBtn) {
    sizeBtn.addEventListener("click", function(){
      var s = getSize();
      var next = (s === "base") ? "l" : (s === "l" ? "xl" : "base");
      setSize(next);
    });
  }
  updateTheme();
  updateSize();
})();
`.trimStart();

export function writeSiteAssets(outputDir: string): void {
  const assetsDir = path.join(outputDir, "assets");
  writeTextFile(path.join(assetsDir, "styles.css"), stylesCss);
  writeTextFile(path.join(assetsDir, "layout.css"), layoutCss);
  writeTextFile(path.join(assetsDir, "dark.css"), darkCss);
  writeTextFile(path.join(assetsDir, "book.css"), bookCss);
  writeTextFile(path.join(assetsDir, "reader.js"), readerJs);
}
