import path from "node:path";
import type { Agent, Book, Conversation } from "./types";
import type { ConceptEntry } from "./concepts";
import type { ChunkInfo } from "./chunkLookup";
import { getConceptFileLabel } from "./concepts";
import type { EssayData } from "./essays";
import type { AgentLectureSets, LectureView } from "./lectures";
import type { QuotesData } from "./quotes";
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
  books: { label: "Primärliteratur", fileName: "books.html", heading: "Primärliteratur" },
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

const ASSET_VERSION =
  (typeof process !== "undefined" && process.env?.GITHUB_SHA?.slice(0, 7)) ||
  `t${Date.now().toString(36)}`;

const RAGRUN_BASE: string =
  (typeof process !== "undefined" && process.env?.RAGRUN_URL) || "";

function renderMonitoringWidget(agent: Agent): string {
  const collection = escapeHtml(agent.ragCollection);
  const ragrunUrl = escapeHtml(RAGRUN_BASE.replace(/\/$/, "") + "/api/v1");
  return `<div class="monitoring-wrapper" data-monitoring data-collection="${collection}" data-ragrun-url="${ragrunUrl}">
  <button type="button" class="monitoring-toggle" data-monitoring-toggle title="Monitoring öffnen" aria-label="Monitoring öffnen">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
    Statistik
  </button>
  <div class="monitoring-panel" data-monitoring-panel hidden>
    <div class="monitoring-loading" data-monitoring-loading>Lade …</div>
    <div class="monitoring-content" data-monitoring-content hidden>
      <div class="monitoring-grid">
        <div class="monitoring-tile" data-monitoring-chunks>
          <h4>Chunks</h4>
          <div class="monitoring-tile-body" data-chunks-body></div>
        </div>
        <div class="monitoring-tile" data-monitoring-events>
          <h4>Events</h4>
          <div class="monitoring-tile-body" data-events-body></div>
        </div>
      </div>
      <div class="monitoring-log">
        <h4>Log</h4>
        <div class="monitoring-log-body" data-log-body></div>
      </div>
    </div>
    <div class="monitoring-error" data-monitoring-error hidden></div>
  </div>
</div>
<script>
(function(){
  var wrapper = document.querySelector("[data-monitoring]");
  if (!wrapper) return;
  var toggle = wrapper.querySelector("[data-monitoring-toggle]");
  var panel = wrapper.querySelector("[data-monitoring-panel]");
  var loading = wrapper.querySelector("[data-monitoring-loading]");
  var content = wrapper.querySelector("[data-monitoring-content]");
  var errorEl = wrapper.querySelector("[data-monitoring-error]");
  var collection = wrapper.getAttribute("data-collection");
  var baseUrl = wrapper.getAttribute("data-ragrun-url");
  var loaded = false;

  function show(el, v) { if (el) el.hidden = !v; }
  function setText(el, t) { if (el) el.textContent = t; }
  function esc(s) { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

  if (toggle) toggle.addEventListener("click", function() {
    var open = !panel.hidden;
    panel.hidden = open;
    wrapper.classList.toggle("monitoring-open", !open);
    toggle.classList.toggle("monitoring-toggle-active", !open);
    toggle.setAttribute("title", open ? "Monitoring öffnen" : "Monitoring schließen");
    toggle.setAttribute("aria-label", open ? "Monitoring öffnen" : "Monitoring schließen");
    if (!open && !loaded) load();
  });

  function load() {
    loaded = true;
    show(loading, true);
    show(content, false);
    show(errorEl, false);
    if (!baseUrl) {
      setText(errorEl, "RAGRUN_URL nicht konfiguriert.");
      show(loading, false);
      show(errorEl, true);
      return;
    }
    var chunksUrl = baseUrl + "/rag/monitoring/chunks?collection=" + encodeURIComponent(collection);
    var eventsUrl = baseUrl + "/rag/monitoring/events?collection=" + encodeURIComponent(collection) + "&limit=50";
    Promise.all([
      fetch(chunksUrl).then(function(r){ return r.ok ? r.json() : Promise.reject(r.status); }),
      fetch(eventsUrl).then(function(r){ return r.ok ? r.json() : Promise.reject(r.status); })
    ]).then(function(res) {
      renderChunks(wrapper, res[0]);
      renderEvents(wrapper, res[1]);
      renderLog(wrapper, res[1].log);
      show(loading, false);
      show(content, true);
    }).catch(function(err) {
      setText(errorEl, "Monitoring nicht verfügbar (" + (err.message || err) + "). Ist ragrun erreichbar?");
      show(loading, false);
      show(errorEl, true);
    });
  }

  function barHtml(label, count, max, title) {
    var pct = max > 0 ? Math.round((count / max) * 100) : 0;
    var t = title != null ? title : String(count);
    return "<div class=\\"monitoring-bar-row\\" title=\\"" + esc(t) + "\\"><span class=\\"monitoring-bar-label\\">" + esc(label) + "</span><div class=\\"monitoring-bar-track\\"><div class=\\"monitoring-bar-fill\\" style=\\"width:" + pct + "%\\"></div></div><span class=\\"monitoring-bar-value\\">" + count + "</span></div>";
  }

  function bookBarHtml(book, maxChunks, maxUsage, sortBy) {
    var label = (book.book_title || "") + " [" + (book.chunk_type || "") + "]";
    var displayCount = sortBy === "usage" ? (book.usage_count || 0) : book.count;
    var max = sortBy === "usage" ? maxUsage : maxChunks;
    var pct = max > 0 ? Math.round((displayCount / max) * 100) : 0;
    var usageStr = (book.usage_count || 0) + " (" + (book.usage_pct || 0) + "%)";
    var title = book.count + " Chunks, " + (book.usage_count || 0) + " Verwendungen (" + (book.usage_pct || 0) + "%)";
    return "<div class=\\"monitoring-bar-row monitoring-bar-row-book\\" title=\\"" + esc(title) + "\\"><span class=\\"monitoring-bar-label\\">" + esc(label) + "</span><div class=\\"monitoring-bar-track\\"><div class=\\"monitoring-bar-fill\\" style=\\"width:" + pct + "%\\"></div></div><span class=\\"monitoring-bar-value\\">" + book.count + "</span><span class=\\"monitoring-bar-usage\\">" + usageStr + "</span></div>";
  }

  function renderChunks(w, data) {
    var body = w.querySelector("[data-chunks-body]");
    if (!body) return;
    if (!data || !data.chunk_types || data.chunk_types.length === 0) {
      body.innerHTML = "<p class=\\"empty-state\\">Keine Chunk-Daten.</p>";
      return;
    }
    var max = Math.max.apply(null, data.chunk_types.map(function(x){ return x.count; }));
    var html = "<div class=\\"monitoring-bars\\">" + data.chunk_types.map(function(x){ return barHtml(x.chunk_type, x.count, max); }).join("") + "</div>";
    if (data.books && data.books.length > 0) {
      var books = data.books.slice();
      var sortBy = "chunks";
      var bookMaxChunks = Math.max.apply(null, books.map(function(x){ return x.count; }));
      var bookMaxUsage = Math.max.apply(null, books.map(function(x){ return x.usage_count || 0; }));
      function renderBooks() {
        var sorted = books.slice();
        if (sortBy === "usage") sorted.sort(function(a,b){ return (b.usage_count||0) - (a.usage_count||0); });
        else if (sortBy === "name") sorted.sort(function(a,b){ return String(a.book_title||"").localeCompare(b.book_title||""); });
        else sorted.sort(function(a,b){ return b.count - a.count; });
        return sorted.map(function(x){ return bookBarHtml(x, bookMaxChunks, bookMaxUsage, sortBy); }).join("");
      }
      html += "<h5 style=\\"margin:0.75rem 0 0.35rem;font-size:0.82rem;color:var(--muted)\\">Bücher</h5>";
      html += "<div class=\\"monitoring-sort-row\\"><label for=\\"monitoring-sort\\">Sortierung:</label><select id=\\"monitoring-sort\\" data-monitoring-sort><option value=\\"chunks\\">Chunks</option><option value=\\"usage\\">Verwendungen</option><option value=\\"name\\">Name</option></select></div>";
      html += "<div class=\\"monitoring-books-scroll\\" data-monitoring-books><div class=\\"monitoring-bars\\">" + renderBooks() + "</div></div>";
    }
    body.innerHTML = html;
    if (data.books && data.books.length > 0) {
      var sortEl = body.querySelector("[data-monitoring-sort]");
      var booksEl = body.querySelector("[data-monitoring-books]");
      if (sortEl && booksEl) {
        sortEl.addEventListener("change", function() {
          sortBy = sortEl.value;
          booksEl.innerHTML = "<div class=\\"monitoring-bars\\">" + renderBooks() + "</div>";
        });
      }
    }
  }

  function renderEvents(w, data) {
    var body = w.querySelector("[data-events-body]");
    if (!body) return;
    if (!data || !data.volume || data.volume.length === 0) {
      body.innerHTML = "<p class=\\"empty-state\\">Keine Event-Daten.</p>";
      return;
    }
    var max = Math.max.apply(null, data.volume.map(function(x){ return x.event_count; }));
    body.innerHTML = "<div class=\\"monitoring-bars\\">" + data.volume.map(function(x){ return barHtml(x.endpoint, x.event_count, max); }).join("") + "</div>";
  }

  function renderLog(w, log) {
    var body = w.querySelector("[data-log-body]");
    if (!body) return;
    if (!log || log.length === 0) {
      body.innerHTML = "<p class=\\"empty-state\\">Kein Log.</p>";
      return;
    }
    body.innerHTML = "<table class=\\"monitoring-log-table\\"><thead><tr><th>Zeit</th><th>Endpoint</th><th>Chunks</th><th>Concept</th><th>Typ</th></tr></thead><tbody>" + log.map(function(row){
      var t = (row.created_at || "").replace("T", " ").slice(0, 19);
      var chunkCell = row.chunk_count != null ? row.chunk_count : "—";
      var conceptCell = (row.concept || "").slice(0, 40) + ((row.concept || "").length > 40 ? "…" : "");
      return "<tr><td>" + esc(t) + "</td><td>" + esc(row.endpoint || "") + "</td><td>" + chunkCell + "</td><td title=\\"" + esc(row.concept || "") + "\\">" + esc(conceptCell) + "</td><td>" + esc(row.source || "") + "</td></tr>";
    }).join("") + "</tbody></table>";
  }
})();
</script>`;
}

function pageShell(title: string, relAssetPrefix: string, content: string): string {
  const v = ASSET_VERSION;
  return `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <meta name="color-scheme" content="light dark" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Lato:wght@300;400&family=Special+Elite&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="${relAssetPrefix}assets/styles.css?v=${v}" />
    <link rel="stylesheet" href="${relAssetPrefix}assets/layout.css?v=${v}" />
    <link rel="stylesheet" href="${relAssetPrefix}assets/dark.css?v=${v}" />
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

function renderLectureRows(lectures: LectureView[]): string {
  if (lectures.length === 0) {
    return `<p class="empty-state">Keine Vorträge in dieser Kategorie.</p>`;
  }

  const cards = lectures.map((lecture) => {
    const date = escapeHtml(lecture.date || "Ohne Datum");
    const id = escapeHtml(lecture.id);
    const title = escapeHtml(lecture.title || "(Ohne Titel)");
    const zyklusText =
      lecture.zyklus != null
        ? `Zyklus ${lecture.zyklus}${lecture.zyklusTitle ? `, ${escapeHtml(lecture.zyklusTitle)}` : ""}`
        : "—";
    const gaText = lecture.ga
      ? `GA ${escapeHtml(lecture.ga)}${lecture.gaTitle ? `, ${escapeHtml(lecture.gaTitle)}` : ""}`
      : "—";
    const htmlLink = lecture.htmlPath
      ? `<a class="lecture-open-link" href="../../${encodeURI(lecture.htmlPath)}" target="_blank" rel="noreferrer" aria-label="Vortragstext öffnen">📖</a>`
      : `<span class="meta-quiet">Kein Text-Link verfügbar</span>`;
    const summaryHtml = lecture.summary
      ? `<details class="toc-details lecture-summary-details">
    <summary class="toc-summary-line"><span class="toc-title-text">Zusammenfassung</span></summary>
    <div class="toc-panel">
      <div class="toc-excerpt">${renderSummaryHtml(lecture.summary)}</div>
    </div>
  </details>`
      : "";
    return `<article class="lecture-card book-link" data-lecture-card data-date-value="${lecture.dateValue ?? ""}" data-date-label="${date}" data-zyklus="${lecture.zyklus ?? ""}" data-ga="${escapeHtml(
      lecture.ga.toLowerCase()
    )}">
  <strong>${title}</strong>
  <div class="lecture-meta-row"><span>Datum: ${date}</span><span>ID: ${id}</span></div>
  <div class="lecture-meta-row"><span>${zyklusText}</span><span>${gaText}</span></div>
  <div class="lecture-meta-row">${htmlLink}</div>
  ${summaryHtml}
</article>`;
  });

  return `<div class="lecture-list">${cards.join("")}</div>`;
}

function renderLectureFilterPanel(scope: string, lectures: LectureView[]): string {
  const datedRaw = lectures
    .filter((lecture) => lecture.dateValue != null && lecture.date)
    .sort((a, b) => (a.dateValue ?? 0) - (b.dateValue ?? 0));

  const datedMap = new Map<number, string>();
  for (const lecture of datedRaw) {
    if (lecture.dateValue == null || !lecture.date) continue;
    if (!datedMap.has(lecture.dateValue)) {
      datedMap.set(lecture.dateValue, lecture.date);
    }
  }
  const dated = Array.from(datedMap.entries()).map(([dateValue, date]) => ({
    dateValue,
    date,
  }));

  const fromOptions = dated
    .map(
      (lecture) =>
        `<option value="${lecture.dateValue}">${escapeHtml(lecture.date)}</option>`
    )
    .join("");
  const toOptions = fromOptions;

  const zyklusMap = new Map<number, string>();
  for (const lecture of lectures) {
    if (lecture.zyklus == null) continue;
    if (!zyklusMap.has(lecture.zyklus)) {
      const title = lecture.zyklusTitle || "";
      zyklusMap.set(lecture.zyklus, title);
    }
  }
  const zyklusOptions = Array.from(zyklusMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([zyklus, title]) => {
      const label = title
        ? `Zyklus ${zyklus}, ${title}`
        : `Zyklus ${zyklus}`;
      return `<option value="${zyklus}">${escapeHtml(label)}</option>`;
    })
    .join("");

  const gaMap = new Map<string, string>();
  for (const lecture of lectures) {
    if (!lecture.ga) continue;
    const key = lecture.ga.toLowerCase();
    if (!gaMap.has(key)) {
      gaMap.set(key, lecture.gaTitle);
    }
  }
  const gaOptions = Array.from(gaMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0], "de"))
    .map(([ga, title]) => {
      const upperGa = ga.toUpperCase();
      const label = title ? `GA ${upperGa}, ${title}` : `GA ${upperGa}`;
      return `<option value="${escapeHtml(ga)}">${escapeHtml(label)}</option>`;
    })
    .join("");

  const firstDate = dated[0]?.date ?? "";
  const lastDate = dated[dated.length - 1]?.date ?? "";

  const filters = `<div class="lecture-filters" data-lecture-filters data-default-from="${escapeHtml(
    firstDate
  )}" data-default-to="${escapeHtml(lastDate)}">
  <div class="lecture-filter-group">
    <label for="${scope}-lecture-date-from">Datum von</label>
    <select id="${scope}-lecture-date-from" data-lecture-from>
      <option value="">—</option>
      ${fromOptions}
    </select>
  </div>
  <div class="lecture-filter-group">
    <label for="${scope}-lecture-date-to">Datum bis</label>
    <select id="${scope}-lecture-date-to" data-lecture-to>
      <option value="">—</option>
      ${toOptions}
    </select>
  </div>
  <div class="lecture-filter-group">
    <label for="${scope}-lecture-zyklus">Zyklus</label>
    <select id="${scope}-lecture-zyklus" data-lecture-zyklus>
      <option value="">—</option>
      ${zyklusOptions}
    </select>
  </div>
  <div class="lecture-filter-group">
    <label for="${scope}-lecture-ga">GA-Nummer</label>
    <select id="${scope}-lecture-ga" data-lecture-ga>
      <option value="">—</option>
      ${gaOptions}
    </select>
  </div>
</div>`;

  const script = `<script>
(function() {
  var root = document.getElementById("${scope}-lecture-root");
  if (!root) return;
  var filters = root.querySelector("[data-lecture-filters]");
  if (!filters) return;
  var fromEl = root.querySelector("[data-lecture-from]");
  var toEl = root.querySelector("[data-lecture-to]");
  var zyklusEl = root.querySelector("[data-lecture-zyklus]");
  var gaEl = root.querySelector("[data-lecture-ga]");
  var headingEl = root.querySelector("[data-lecture-selection-heading]");
  var cards = root.querySelectorAll("[data-lecture-card]");
  if (!fromEl || !toEl || !zyklusEl || !gaEl || !headingEl || !cards.length) return;

  var defaultFrom = filters.getAttribute("data-default-from") || "";
  var defaultTo = filters.getAttribute("data-default-to") || "";

  function selectedText(sel) {
    if (!sel || !sel.options || sel.selectedIndex < 0) return "";
    return sel.options[sel.selectedIndex].text || "";
  }

  function showByDate() {
    var fromVal = fromEl.value ? Number(fromEl.value) : null;
    var toVal = toEl.value ? Number(toEl.value) : null;
    cards.forEach(function(card) {
      var dateValRaw = card.getAttribute("data-date-value");
      var dateVal = dateValRaw ? Number(dateValRaw) : null;
      var visible = true;
      if (dateVal == null || Number.isNaN(dateVal)) {
        visible = false;
      } else {
        if (fromVal != null && dateVal < fromVal) visible = false;
        if (toVal != null && dateVal > toVal) visible = false;
      }
      card.style.display = visible ? "" : "none";
    });
    var fromLabel = selectedText(fromEl) || defaultFrom;
    var toLabel = selectedText(toEl) || defaultTo;
    headingEl.textContent = "Vorträge von " + fromLabel + " bis " + toLabel;
  }

  function showByExact(attr, value) {
    cards.forEach(function(card) {
      var visible = card.getAttribute(attr) === value;
      card.style.display = visible ? "" : "none";
    });
  }

  function showAll() {
    cards.forEach(function(card) {
      card.style.display = "";
    });
    headingEl.textContent = "Vorträge";
  }

  function apply() {
    if (zyklusEl.value) {
      showByExact("data-zyklus", zyklusEl.value);
      headingEl.textContent = selectedText(zyklusEl) || "Vorträge";
      return;
    }
    if (gaEl.value) {
      showByExact("data-ga", gaEl.value);
      headingEl.textContent = selectedText(gaEl) || "Vorträge";
      return;
    }
    if (fromEl.value || toEl.value) {
      showByDate();
      return;
    }
    showAll();
  }

  fromEl.addEventListener("change", function() {
    zyklusEl.value = "";
    gaEl.value = "";
    apply();
  });
  toEl.addEventListener("change", function() {
    zyklusEl.value = "";
    gaEl.value = "";
    apply();
  });
  zyklusEl.addEventListener("change", function() {
    if (zyklusEl.value) {
      fromEl.value = "";
      toEl.value = "";
      gaEl.value = "";
    }
    apply();
  });
  gaEl.addEventListener("change", function() {
    if (gaEl.value) {
      fromEl.value = "";
      toEl.value = "";
      zyklusEl.value = "";
    }
    apply();
  });

  apply();
})();
</script>`;

  return `<section id="${scope}-lecture-root" class="stack-16">
  ${filters}
  <h4 class="lecture-selection-heading" data-lecture-selection-heading>Vorträge</h4>
  ${renderLectureRows(lectures)}
  ${script}
</section>`;
}

function renderBooksAndLecturesContent(
  scope: "primary" | "secondary",
  bookIds: string[],
  lectures: LectureView[],
  availableBooks: Map<string, Book>
): string {
  const booksPanelId = `${scope}-books-panel`;
  const lecturesPanelId = `${scope}-lectures-panel`;
  const script = `<script>
(function() {
  var root = document.getElementById("${scope}-literature-root");
  if (!root) return;
  var buttons = root.querySelectorAll("[data-literature-tab]");
  var panels = root.querySelectorAll("[data-literature-panel]");
  if (!buttons.length || !panels.length) return;
  function activate(target) {
    buttons.forEach(function(btn) {
      var active = btn.getAttribute("data-target") === target;
      btn.classList.toggle("literature-tab-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
    panels.forEach(function(panel) {
      var active = panel.getAttribute("id") === target;
      panel.style.display = active ? "" : "none";
    });
  }
  buttons.forEach(function(btn) {
    btn.addEventListener("click", function() {
      var target = btn.getAttribute("data-target");
      if (!target) return;
      activate(target);
    });
  });
  activate("${booksPanelId}");
})();
</script>`;

  return `<div id="${scope}-literature-root" class="stack-16">
  <div class="literature-tab-row" role="tablist" aria-label="Bücher und Vorträge">
    <button type="button" class="literature-tab literature-tab-active" role="tab" aria-selected="true" data-literature-tab data-target="${booksPanelId}">Bücher</button>
    <button type="button" class="literature-tab" role="tab" aria-selected="false" data-literature-tab data-target="${lecturesPanelId}">Vorträge</button>
  </div>
  <section id="${booksPanelId}" data-literature-panel>${renderBookRows(bookIds, availableBooks)}</section>
  <section id="${lecturesPanelId}" data-literature-panel style="display:none">${renderLectureFilterPanel(
    scope,
    lectures
  )}</section>
  ${script}
</div>`;
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

function renderQuotesSection(quotesData: QuotesData | undefined): string {
  if (!quotesData || quotesData.quotes.length === 0) {
    return `<p class="empty-state">Keine Zitate verfügbar.</p>`;
  }

  const { quotes, sources } = quotesData;

  const dropdownOptions =
    '<option value="">Alle</option>' +
    sources
      .map(
        (s) =>
          `<option value="${escapeHtml(s.id)}">${escapeHtml(s.title)}</option>`
      )
      .join("");

  const bySource = new Map<
    string,
    Map<string, { text: string; segmentTitle: string; paragraphUrl: string | null }[]>
  >();
  for (const q of quotes) {
    let sourceMap = bySource.get(q.sourceId);
    if (!sourceMap) {
      sourceMap = new Map();
      bySource.set(q.sourceId, sourceMap);
    }
    let segmentList = sourceMap.get(q.segmentId);
    if (!segmentList) {
      segmentList = [];
      sourceMap.set(q.segmentId, segmentList);
    }
    segmentList.push({
      text: q.text,
      segmentTitle: q.segmentTitle,
      paragraphUrl: q.paragraphUrl,
    });
  }

  const groupsHtml: string[] = [];
  for (const [sourceId, segmentMap] of bySource) {
    const sourceTitle =
      sources.find((s) => s.id === sourceId)?.title ?? sourceId;
    const chaptersHtml: string[] = [];
    for (const [segmentId, segmentQuotes] of segmentMap) {
      const segmentTitle =
        segmentQuotes[0]?.segmentTitle ?? "(Ohne Kapitel)";
      const quotesHtml = segmentQuotes
        .map((q) => {
          const linkHtml =
            q.paragraphUrl
              ? ` <a href="${escapeHtml(q.paragraphUrl)}" class="quote-para-link" title="Zum Absatz im Buch/Vortrag">Zum Absatz →</a>`
              : "";
          return `<div class="quote-block" data-quote><pre class="quote-text typewriter-font">${escapeHtml(
            q.text
          )}</pre>${linkHtml}</div>`;
        })
        .join("");
      chaptersHtml.push(
        `<div class="quotes-chapter" data-segment-id="${escapeHtml(segmentId)}">
    <h5 class="quotes-chapter-title">${escapeHtml(segmentTitle)}</h5>
    ${quotesHtml}
  </div>`
      );
    }
    groupsHtml.push(
      `<div class="quotes-group" data-source-id="${escapeHtml(sourceId)}">
  <h4 class="quotes-source-title">${escapeHtml(sourceTitle)}</h4>
  ${chaptersHtml.join("")}
</div>`
    );
  }

  const script = `
<script>
(function(){
  var searchEl = document.getElementById("quotesSearch");
  var sourceEl = document.getElementById("quotesSource");
  var container = document.getElementById("quotesContainer");
  if (!searchEl || !sourceEl || !container) return;

  var groups = container.querySelectorAll(".quotes-group");
  var quoteEls = container.querySelectorAll("[data-quote]");

  function apply() {
    var term = (searchEl.value || "").trim().toLowerCase();
    var sourceVal = (sourceEl.value || "").trim();

    groups.forEach(function(g) {
      var matchSource = !sourceVal || g.getAttribute("data-source-id") === sourceVal;
      var quotesInGroup = g.querySelectorAll("[data-quote]");
      var anyVisible = false;
      quotesInGroup.forEach(function(q) {
        var text = (q.textContent || "").toLowerCase();
        var matchSearch = !term || text.indexOf(term) >= 0;
        var show = matchSource && matchSearch;
        q.style.display = show ? "" : "none";
        if (show) anyVisible = true;
      });
      g.style.display = anyVisible ? "" : "none";
    });
  }

  searchEl.addEventListener("input", apply);
  searchEl.addEventListener("change", apply);
  sourceEl.addEventListener("change", apply);
})();
</script>`;

  return `<div class="quotes-section stack-8">
  <div class="quotes-filters stack-8">
    <input type="text" id="quotesSearch" class="quotes-search-input" placeholder="Zitate durchsuchen..." aria-label="Zitate durchsuchen" />
    <select id="quotesSource" class="quotes-source-select" aria-label="Quelle wählen">
      ${dropdownOptions}
    </select>
  </div>
  <div id="quotesContainer" class="quotes-container stack-16">
    ${groupsHtml.join("")}
  </div>
  ${script}
</div>`;
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
  conceptsChunkIndex: Map<string, ChunkInfo>,
  lecturesByAgent: Map<string, AgentLectureSets>,
  quotesByAgent: Map<string, QuotesData>
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
    const lectureSets = lecturesByAgent.get(agent.id);
    const primaryLectures = lectureSets?.primaryLectures ?? [];
    return `<div class="stack-8"><h3>${SECTION_META.books.heading}</h3>${renderBooksAndLecturesContent(
      "primary",
      agent.primaryBooks,
      primaryLectures,
      availableBooks
    )}</div>`;
  }
  if (section === "secondary-books") {
    const lectureSets = lecturesByAgent.get(agent.id);
    const secondaryLectures = lectureSets?.secondaryLectures ?? [];
    return `<div class="stack-8"><h3>${SECTION_META["secondary-books"].heading}</h3>${renderBooksAndLecturesContent(
      "secondary",
      agent.secondaryBooks,
      secondaryLectures,
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
    const quotesData = quotesByAgent.get(agent.id);
    return `<div class="stack-8"><h3>${SECTION_META.quotes.heading}</h3>${renderQuotesSection(
      quotesData
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
  lecturesByAgent: Map<string, AgentLectureSets>,
  quotesByAgent: Map<string, QuotesData>,
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
        <div class="stack-8 agent-header-main">
          <h1>${escapeHtml(agent.name)}</h1>
          <div class="agent-header-meta">
            <span class="pill pill-accent">Collection: ${escapeHtml(agent.ragCollection)}</span>
            <span class="pill pill-muted">${totalBooks} Bücher insgesamt</span>
            ${renderMonitoringWidget(agent)}
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
          conceptsChunkIndex,
          lecturesByAgent,
          quotesByAgent
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
  conceptsChunkIndex: Map<string, ChunkInfo>,
  lecturesByAgent: Map<string, AgentLectureSets>,
  quotesByAgent: Map<string, QuotesData>
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
        lecturesByAgent,
        quotesByAgent,
        section
      );
    }
  }
}
