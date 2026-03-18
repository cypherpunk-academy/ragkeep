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

/* Zitate-Seite: Schreibmaschinen-Font und Margins */
.quote-text.typewriter-font {
  font-family: "Special Elite", "Courier Prime", "Courier New", monospace;
  font-size: 1.425rem;
  line-height: 1.6;
  margin-left: 1.5rem;
  margin-right: 1.5rem;
  padding: 1.5rem;
  white-space: pre-wrap;
  word-wrap: break-word;
  border: none;
  background: #f5f4f0;
}

.quotes-section {
  display: flex;
  flex-direction: column;
}

.quotes-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}

.quotes-search-input {
  flex: 1;
  min-width: 200px;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  font: inherit;
  background: var(--surface);
  color: var(--fg);
}

.quotes-source-select {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  font: inherit;
  background: var(--surface);
  color: var(--fg);
}

.quotes-container {
  margin-top: 1rem;
}

.quotes-group {
  margin-bottom: 1.5rem;
}

.quotes-source-title {
  font-family: var(--font-header);
  font-weight: 400;
  margin: 0 0 0.5rem;
  font-size: 1.1rem;
}

.quotes-chapter {
  margin-top: 1rem;
}

.quotes-chapter-title {
  font-family: var(--font-header);
  font-weight: 400;
  margin: 0 0 0.35rem;
  font-size: 0.95rem;
  color: var(--muted);
}

.quote-block {
  margin-bottom: 1rem;
}

.quote-para-link {
  display: inline-block;
  margin-top: 0.5rem;
  font-size: 0.85rem;
  color: var(--accent);
  text-decoration: none;
}

.quote-para-link:hover {
  text-decoration: underline;
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
  opacity: 0;
  animation: agent-grid-fade-in 0.6s ease-out forwards;
}

@keyframes agent-grid-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.agent-card {
  overflow: hidden;
  text-decoration: none;
  color: inherit;
  display: flex;
  flex-direction: column;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.agent-card:hover {
  transform: translateY(-10px) scale(1.02);
  box-shadow: 0 20px 48px rgba(15, 23, 42, 0.18);
}

.agent-media {
  height: 270px;
  position: relative;
  background: linear-gradient(180deg, #bae6fd 0%, #0e7490 100%);
}

.agent-card--philo-von-freisinn .agent-media {
  background: linear-gradient(180deg, #dbeafe 0%, #2563eb 100%);
}

.agent-card--sigrid-von-gleich .agent-media {
  background: linear-gradient(180deg, #cffafe 0%, #0d9488 100%);
}

.agent-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: right center;
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
  padding: 21px;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.agent-body > p {
  flex: 1;
}

.agent-body .agent-meta {
  margin-top: auto;
  flex-shrink: 0;
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
  align-items: flex-start;
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

.literature-tab-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.literature-tab {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0.55rem 0.9rem;
  background: var(--surface-soft);
  color: var(--fg);
  font: inherit;
  cursor: pointer;
}

.literature-tab-active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.lecture-filters {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.lecture-filter-group label {
  display: block;
  margin-bottom: 0.35rem;
  color: var(--muted);
  font-size: 0.85rem;
}

.lecture-filter-group select {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.45rem 0.6rem;
  font: inherit;
  background: var(--surface);
  color: var(--fg);
}

.lecture-selection-heading {
  margin: 0;
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

.lecture-list {
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

.lecture-summary-details .toc-summary-line {
  padding-left: 0;
}

.lecture-summary-details .toc-arrow {
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

.concept-refs {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
  font-size: 0.9em;
}

.concept-refs::before {
  content: "Referenzen: ";
  color: var(--muted);
  font-size: 0.85em;
  display: block;
  margin-bottom: 6px;
}

.concept-ref {
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.concept-ref:hover {
  color: #3730a3;
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

.book-list .book-link strong {
  font-size: 1.2em;
}

.book-link {
  display: grid;
  grid-template-columns: 1fr;
  gap: 4px;
  padding: 12px;
}

.lecture-card {
  gap: 8px;
}

.lecture-meta-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 0.9rem;
}

.lecture-open-link {
  color: var(--fg);
  text-decoration: none;
  font-size: 1rem;
  line-height: 1;
}

.lecture-open-link:hover {
  text-decoration: underline;
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

.agent-header-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.agent-header-meta .monitoring-wrapper {
  margin-left: auto;
}

.agent-header-meta .monitoring-open {
  margin-left: 0;
  width: 100%;
  flex-basis: 100%;
}

.monitoring-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0.35rem 0.7rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface-soft);
  color: var(--muted);
  font-size: 0.82rem;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  text-decoration: none;
}

.monitoring-toggle:hover {
  background: var(--surface);
  color: var(--fg);
  border-color: #c7d2fe;
}

.monitoring-toggle-active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.monitoring-panel {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border);
}

.monitoring-loading,
.monitoring-error {
  color: var(--muted);
  font-size: 0.9rem;
}

.monitoring-error {
  color: #b91c1c;
}

.monitoring-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.monitoring-tile h4,
.monitoring-log h4 {
  margin: 0 0 0.5rem 0;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--muted);
}

.monitoring-tile-body,
.monitoring-log-body {
  font-size: 0.85rem;
}

.monitoring-books-scroll {
  max-height: 200px;
  overflow-y: auto;
  margin-top: 0.5rem;
}

.monitoring-sort-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0.5rem 0 0.35rem;
  font-size: 0.82rem;
}

.monitoring-sort-row select {
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 0.82rem;
  background: var(--surface);
  color: var(--fg);
}

.monitoring-bars {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.monitoring-bar-row {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 8px;
  align-items: center;
}

.monitoring-bar-row-book {
  grid-template-columns: 1fr auto auto auto;
}

.monitoring-bar-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.monitoring-bar-track {
  width: 80px;
  height: 8px;
  background: var(--surface-soft);
  border-radius: 4px;
  overflow: hidden;
}

.monitoring-bar-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 4px;
  transition: width 0.2s;
}

.monitoring-bar-value {
  font-variant-numeric: tabular-nums;
  color: var(--muted);
  min-width: 2.5em;
  text-align: right;
}

.monitoring-bar-usage {
  font-size: 0.75rem;
  color: var(--muted);
  margin-left: 0.2rem;
}

.monitoring-log {
  margin-top: 0.5rem;
}

.monitoring-log-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
}

.monitoring-log-table th,
.monitoring-log-table td {
  padding: 0.35rem 0.5rem;
  text-align: left;
  border-bottom: 1px solid var(--border);
}

.monitoring-log-table th {
  color: var(--muted);
  font-weight: 500;
}

/* ── Statistik-Seite ─────────────────────────────────────────── */

.stat-page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 1.5rem;
}

.stat-subtitle {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--muted);
  margin: 0.25rem 0 0;
}

.stat-reload-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0.35rem 0.8rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface-soft);
  color: var(--muted);
  font-size: 0.82rem;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.stat-reload-btn:hover {
  background: var(--surface);
  color: var(--fg);
  border-color: #c7d2fe;
}

h2.stat-heading {
  font-family: var(--font-header);
  font-weight: 400;
  font-size: clamp(1.4rem, 2.5vw, 1.9rem);
  margin: 0 0 0.75rem;
  letter-spacing: -0.01em;
}

.stat-section {
  margin-bottom: 2.5rem;
}

.stat-table-wrap {
  overflow-x: auto;
  margin-bottom: 1.5rem;
}

.stat-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;
}

.stat-table th,
.stat-table td {
  padding: 0.45rem 0.65rem;
  text-align: right;
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}

.stat-table th {
  color: var(--muted);
  font-weight: 500;
  font-size: 0.8rem;
  border-bottom: 2px solid var(--border);
}

.stat-table td:first-child,
.stat-table th:first-child {
  text-align: left;
}

/* Bücher-Tabelle: Titel-Spalte flexibel mit Ellipsis, Rest kompakt */
#stat-books-table {
  table-layout: fixed;
}

#stat-books-table th:first-child,
#stat-books-table td:first-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

#stat-books-table th:nth-child(2),
#stat-books-table td:nth-child(2) { width: 8rem; }
#stat-books-table th:nth-child(3),
#stat-books-table td:nth-child(3) { width: 6rem; }
#stat-books-table th:nth-child(4),
#stat-books-table td:nth-child(4) { width: 6rem; }
#stat-books-table th:nth-child(5),
#stat-books-table td:nth-child(5) { width: 4rem; }

.stat-table tbody tr:hover {
  background: var(--surface-soft);
}

.stat-sort-btn {
  margin-left: 0.2rem;
  padding: 0 0.2rem;
  border: none;
  background: transparent;
  cursor: pointer;
  font: inherit;
  color: var(--muted);
}

.stat-sort-btn:hover {
  color: var(--fg);
}

.stat-sort-btn.stat-sort-active {
  font-weight: 700;
  color: var(--fg);
}

#stat-books-table thead th {
  white-space: nowrap;
}

.stat-events-bars {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 600px;
}

.stat-bar-row {
  display: grid;
  grid-template-columns: 180px 1fr 3rem;
  gap: 10px;
  align-items: center;
  font-size: 0.88rem;
}

.stat-bar-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--fg);
}

.stat-bar-track {
  height: 10px;
  background: var(--surface-soft);
  border-radius: 5px;
  overflow: hidden;
}

.stat-bar-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 5px;
  transition: width 0.25s;
}

.stat-bar-value {
  font-variant-numeric: tabular-nums;
  color: var(--muted);
  text-align: right;
}

.stat-status {
  color: var(--muted);
  font-size: 0.9rem;
  padding: 0.5rem 0;
}

.stat-status-error {
  color: #b91c1c;
}

@media (max-width: 760px) {
  .agent-header {
    grid-template-columns: 1fr;
  }

  .agent-avatar {
    width: 88px;
    height: 88px;
  }

  .lecture-filters {
    grid-template-columns: 1fr;
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
  --book-quote: #3015b4;
  --book-italics: #9b0909;
  --book-p-num: #666666;
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

q { color: var(--book-quote); }
i, em { color: var(--book-italics); font-style: italic; }

.p-num {
  color: var(--book-p-num);
  text-decoration: none;
  padding-right: 0.5ch;
  font-size: 0.7em;
}

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
  --book-fg: #d9e2f6;
  --book-quote: #76b2f7;
  --book-italics: #fec8d2;
  --book-p-num: #909090;
  --book-muted: rgba(217, 226, 246, 0.72);
  --book-border: rgba(217, 226, 246, 0.3);
  --reader-control-bg: rgba(255, 255, 255, 0.06);
  --reader-control-border: rgba(217, 226, 246, 0.3);
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
