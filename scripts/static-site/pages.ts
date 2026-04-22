import path from "node:path";
import type { Agent, Book } from "./types";
import type { ConceptEntry } from "./concepts";
import type { ChunkInfo } from "./chunkLookup";
import { getConceptFileLabel, getTypologyFileLabel } from "./concepts";
import type { TalkData, TalkCitation } from "./talks";
import { renderQuellenDetails } from "./talks";
import {
  type AgentLectureSets,
  countDistinctLectureViews,
  type LectureView,
} from "./lectures";
import type { QuotesData } from "./quotes";
import {
  escapeHtml,
  parseBookString,
  readScalarFromManifest,
  renderInlineWithEmphasis,
  renderSummaryHtml,
  writeTextFile,
} from "./utils";

type AgentSection =
  | "overview"
  | "books"
  | "secondary-books"
  | "talks"
  | "concepts"
  | "quotes"
  | "taxonomies";

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
  talks: {
    label: "Gespräche",
    fileName: "talks.html",
    heading: "Gespräche",
  },
  quotes: { label: "Zitate", fileName: "quotes.html", heading: "Zitate" },
  concepts: {
    label: "Begriffe",
    fileName: "concepts.html",
    heading: "Die häufigsten Begriffe der Bücher",
  },
  taxonomies: {
    label: "Ordnungen",
    fileName: "taxonomies.html",
    heading: "Typologien und Ordnungen",
  },
};

const ASSET_VERSION =
  (typeof process !== "undefined" && process.env?.GITHUB_SHA?.slice(0, 7)) ||
  `t${Date.now().toString(36)}`;

const RAGRUN_BASE: string =
  (typeof process !== "undefined" && process.env?.RAGRUN_URL) || "";

function renderMonitoringWidget(agent: Agent): string {
  return `<a class="monitoring-toggle" href="statistik.html" title="Statistik öffnen" aria-label="Statistik öffnen">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
    Statistik
  </a>`;
}

function renderStatistikPage(agent: Agent): string {
  const collection = escapeHtml(agent.ragCollection);
  const ragrunUrl = escapeHtml(RAGRUN_BASE.replace(/\/$/, "") + "/api/v1");
  const agentName = escapeHtml(agent.name);

  const script = `<script>
(function(){
  var wrapper = document.getElementById("stat-wrapper");
  if (!wrapper) return;
  var collection = wrapper.getAttribute("data-collection");
  var baseUrl = wrapper.getAttribute("data-ragrun-url");
  var statusEl = document.getElementById("stat-status");
  var contentEl = document.getElementById("stat-content");
  var reloadBtn = document.getElementById("stat-reload");

  function esc(s) { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
  /** Anzeigename für chunk_type (API-Werte bleiben unverändert). */
  function chunkTypeLabel(ct) {
    var s = String(ct || "");
    if (s === "begriff_list") return "begriff";
    return s;
  }
  function fmtDate(s) {
    if (!s) return "—";
    var str = String(s).slice(0, 10);
    var parts = str.split("-");
    if (parts.length !== 3) return str;
    var months = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
    var day = parseInt(parts[2], 10);
    var month = months[parseInt(parts[1], 10) - 1];
    var year = parts[0];
    return (isNaN(day) || !month ? str : day + ". " + month + " " + year);
  }

  function setStatus(msg, isError) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.className = isError ? "stat-status stat-status-error" : "stat-status";
    statusEl.hidden = !msg;
  }

  function renderChunksTypeTable(types) {
    if (!types || types.length === 0) return "<p class=\\"empty-state\\">Keine Chunk-Daten.</p>";
    var visible = types.filter(function(t){ return t.count > 0; });
    if (visible.length === 0) return "<p class=\\"empty-state\\">Keine Chunks vorhanden.</p>";
    var header = "<tr><th></th>" + visible.map(function(t){ return "<th>" + esc(chunkTypeLabel(t.chunk_type)) + "</th>"; }).join("") + "</tr>";
    var rowChunks = "<tr><td>Chunks</td>" + visible.map(function(t){ return "<td>" + t.count + "</td>"; }).join("") + "</tr>";
    var rowMb = "<tr><td>Text (MB)</td>" + visible.map(function(t){ return "<td>" + (t.text_mb != null ? t.text_mb.toFixed(2) + " MB" : "—") + "</td>"; }).join("") + "</tr>";
    var rowOldest = "<tr><td>Ältester Eintrag</td>" + visible.map(function(t){ return "<td>" + fmtDate(t.oldest) + "</td>"; }).join("") + "</tr>";
    var rowNewest = "<tr><td>Neuester Eintrag</td>" + visible.map(function(t){ return "<td>" + fmtDate(t.newest) + "</td>"; }).join("") + "</tr>";
    return "<div class=\\"stat-table-wrap\\"><table class=\\"stat-table\\"><thead>" + header + "</thead><tbody>" + rowChunks + rowMb + rowOldest + rowNewest + "</tbody></table></div>";
  }

  function renderBooksTable(books) {
    if (!books || books.length === 0) return "<p class=\\"empty-state\\">Keine Bücher/Vorträge.</p>";
    var data = books.slice();
    var sortBy = "chunks";
    var sortDir = "desc";

    function sortTh(c, a, b) {
      var cmp;
      if (c === "name") cmp = String(a.book_title||"").localeCompare(String(b.book_title||""), "de");
      else if (c === "chunk_type") cmp = String(a.chunk_type||"").localeCompare(String(b.chunk_type||""), "de");
      else if (c === "events") cmp = (a.usage_count||0) - (b.usage_count||0);
      else if (c === "pct") cmp = (a.usage_pct||0) - (b.usage_pct||0);
      else cmp = a.count - b.count;
      return sortDir === "asc" ? cmp : -cmp;
    }

    function groupedRows() {
      var sorted = data.slice();
      sorted.sort(function(a,b){ return sortTh(sortBy, a, b); });
      var groupsByTitle = Object.create(null);
      var order = [];
      for (var i = 0; i < sorted.length; i++) {
        var row = sorted[i];
        var title = row.book_title || "";
        if (!groupsByTitle[title]) {
          groupsByTitle[title] = [];
          order.push(title);
        }
        groupsByTitle[title].push(row);
      }
      function sum(rows, key) {
        return rows.reduce(function(acc, row){ return acc + (row[key] || 0); }, 0);
      }
      function groupCmp(aTitle, bTitle) {
        var aRows = groupsByTitle[aTitle];
        var bRows = groupsByTitle[bTitle];
        var cmp;
        if (sortBy === "name") cmp = String(aTitle).localeCompare(String(bTitle), "de");
        else if (sortBy === "events") cmp = sum(aRows, "usage_count") - sum(bRows, "usage_count");
        else if (sortBy === "pct") cmp = sum(aRows, "usage_pct") - sum(bRows, "usage_pct");
        else if (sortBy === "chunk_type") cmp = String(aTitle).localeCompare(String(bTitle), "de");
        else cmp = sum(aRows, "count") - sum(bRows, "count");
        if (cmp === 0) {
          cmp = String(aTitle).localeCompare(String(bTitle), "de");
        }
        return sortDir === "asc" ? cmp : -cmp;
      }
      var sortedTitles = order.slice().sort(groupCmp);
      return sortedTitles.map(function(title){
        var rows = groupsByTitle[title];
        rows = rows.slice().sort(function(a, b){
          return String(a.chunk_type || "").localeCompare(String(b.chunk_type || ""), "de");
        });
        return rows.map(function(b, idx){
          var rowClass = idx === 0 ? "stat-book-group-start" : "";
          if (idx === rows.length - 1) rowClass = (rowClass ? rowClass + " " : "") + "stat-book-group-end";
          var titleCell = idx === 0
            ? "<td rowspan=\\"" + rows.length + "\\" class=\\"stat-book-title-cell\\">" + esc(title) + "</td>"
            : "";
          return "<tr class=\\"" + rowClass + "\\">" + titleCell + "<td>" + esc(chunkTypeLabel(b.chunk_type||"")) + "</td><td>" + b.count + "</td><td>" + (b.usage_count||0) + "</td><td>" + (b.usage_pct != null ? b.usage_pct + "%" : "—") + "</td></tr>";
        }).join("");
      }).join("");
    }

    function thWithSort(label, col) {
      var ascActive = sortBy === col && sortDir === "asc" ? " stat-sort-active" : "";
      var descActive = sortBy === col && sortDir === "desc" ? " stat-sort-active" : "";
      return "<th><span class=\\"stat-th-content\\"><span class=\\"stat-th-label\\">" + esc(label) + "</span><span class=\\"stat-sort-stack\\"><button class=\\"stat-sort-btn" + ascActive + "\\" data-col=\\"" + col + "\\" data-dir=\\"asc\\" aria-label=\\"Aufsteigend sortieren\\">↑</button><button class=\\"stat-sort-btn" + descActive + "\\" data-col=\\"" + col + "\\" data-dir=\\"desc\\" aria-label=\\"Absteigend sortieren\\">↓</button></span></span></th>";
    }

    var tableId = "stat-books-table";
    var tbodyId = "stat-books-tbody";
    var header = "<tr>" + thWithSort("Buch / Vortragstitel", "name") + thWithSort("chunk_type", "chunk_type") + thWithSort("Anzahl chunks", "chunks") + thWithSort("Anzahl events", "events") + thWithSort("%", "pct") + "</tr>";
    var html = "<div class=\\"stat-table-wrap\\"><table class=\\"stat-table\\" id=\\"" + tableId + "\\"><thead>" + header + "</thead><tbody id=\\"" + tbodyId + "\\">" + groupedRows() + "</tbody></table></div>";

    setTimeout(function(){
      var table = document.getElementById(tableId);
      var tbody = document.getElementById(tbodyId);
      if (!table || !tbody) return;
      table.addEventListener("click", function(ev){
        var btn = ev.target && ev.target.closest && ev.target.closest(".stat-sort-btn");
        if (!btn) return;
        sortBy = btn.getAttribute("data-col");
        sortDir = btn.getAttribute("data-dir");
        tbody.innerHTML = groupedRows();
        var btns = table.querySelectorAll(".stat-sort-btn");
        if (btns) for (var i = 0; i < btns.length; i++) {
          var b = btns[i];
          var isActive = b.getAttribute("data-col") === sortBy && b.getAttribute("data-dir") === sortDir;
          b.classList.toggle("stat-sort-active", isActive);
        }
      });
    }, 0);

    return html;
  }

  function renderEventsSection(volume) {
    if (!volume || volume.length === 0) return "<p class=\\"empty-state\\">Keine Event-Daten.</p>";
    var max = Math.max.apply(null, volume.map(function(x){ return x.event_count; }));
    return "<div class=\\"stat-events-bars\\">" + volume.map(function(x){
      var pct = max > 0 ? Math.round((x.event_count / max) * 100) : 0;
      return "<div class=\\"stat-bar-row\\"><span class=\\"stat-bar-label\\">" + esc(x.endpoint) + "</span><div class=\\"stat-bar-track\\"><div class=\\"stat-bar-fill\\" style=\\"width:" + pct + "%\\"></div></div><span class=\\"stat-bar-value\\">" + x.event_count + "</span></div>";
    }).join("") + "</div>";
  }

  function renderLogTable(log) {
    if (!log || log.length === 0) return "<p class=\\"empty-state\\">Kein Log.</p>";
    return "<div class=\\"stat-table-wrap\\"><table class=\\"stat-table monitoring-log-table\\"><thead><tr><th>Zeit</th><th>Endpoint</th><th>Chunks</th><th>Concept</th><th>Typ</th></tr></thead><tbody>" + log.map(function(row){
      var t = (row.created_at || "").replace("T", " ").slice(0, 19);
      var chunkCell = row.chunk_count != null ? row.chunk_count : "—";
      var conceptCell = (row.concept || "").slice(0, 50) + ((row.concept || "").length > 50 ? "…" : "");
      return "<tr><td>" + esc(t) + "</td><td>" + esc(row.endpoint || "") + "</td><td>" + chunkCell + "</td><td title=\\"" + esc(row.concept || "") + "\\">" + esc(conceptCell) + "</td><td>" + esc(row.source || "") + "</td></tr>";
    }).join("") + "</tbody></table></div>";
  }

  function load() {
    if (contentEl) contentEl.innerHTML = "";
    setStatus("Lade …", false);
    if (!baseUrl) {
      setStatus("RAGRUN_URL nicht konfiguriert.", true);
      return;
    }
    var chunksUrl = baseUrl + "/rag/monitoring/chunks?collection=" + encodeURIComponent(collection);
    var eventsUrl = baseUrl + "/rag/monitoring/events?collection=" + encodeURIComponent(collection) + "&limit=50";
    Promise.all([
      fetch(chunksUrl).then(function(r){ return r.ok ? r.json() : Promise.reject("HTTP " + r.status); }),
      fetch(eventsUrl).then(function(r){ return r.ok ? r.json() : Promise.reject("HTTP " + r.status); })
    ]).then(function(res) {
      var chunksData = res[0];
      var eventsData = res[1];
      setStatus("", false);
      if (!contentEl) return;
      contentEl.innerHTML =
        "<section class=\\"stat-section\\">" +
          "<h2 class=\\"stat-heading\\">Chunks</h2>" +
          renderChunksTypeTable(chunksData.chunk_types) +
          renderBooksTable(chunksData.books) +
        "</section>" +
        "<section class=\\"stat-section\\">" +
          "<h2 class=\\"stat-heading\\">Events</h2>" +
          renderEventsSection(eventsData.volume) +
          "<h4 style=\\"margin:1.5rem 0 0.5rem;font-size:0.9rem;color:var(--muted)\\">Log</h4>" +
          renderLogTable(eventsData.log) +
        "</section>";
    }).catch(function(err) {
      setStatus("Statistik nicht verfügbar (" + (err.message || err) + "). Ist ragrun erreichbar?", true);
    });
  }

  if (reloadBtn) reloadBtn.addEventListener("click", load);
  load();
})();
</script>`;

  return pageShell(
    `${agent.name} – Statistik`,
    "../../",
    `<div class="wrap stack-16">
      <div class="stat-page-header">
        <a class="back-link" href="index.html">← Zurück zur Übersicht</a>
        <button type="button" class="stat-reload-btn" id="stat-reload" aria-label="Neu laden">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          Neu laden
        </button>
      </div>
      <header class="agent-header site-card">
        <div class="agent-avatar">${agent.avatarUrl ? `<img src="../../${escapeHtml(agent.avatarUrl)}" alt="${agentName}" />` : ""}</div>
        <div class="stack-8 agent-header-main">
          <h1>${agentName}</h1>
          <p class="stat-subtitle">Chunk- und Event-Statistik</p>
          <div class="agent-header-meta">
            <span class="pill pill-accent">Collection: ${collection}</span>
          </div>
        </div>
      </header>
      <div id="stat-wrapper" data-collection="${collection}" data-ragrun-url="${ragrunUrl}">
        <p id="stat-status" class="stat-status">Lade …</p>
        <div id="stat-content"></div>
      </div>
    </div>
${script}`
  );
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
    <link rel="stylesheet" href="${relAssetPrefix}assets/book.css?v=${v}" />
  </head>
  <body>
    <div class="site-shell">
      ${content}
    </div>
  </body>
</html>`;
}

function renderAgentCard(
  agent: Agent,
  lectureSets: AgentLectureSets | undefined
): string {
  const name = escapeHtml(agent.name);
  const ragCollection = escapeHtml(agent.ragCollection);
  const description = escapeHtml(agent.description);
  const totalBooks = agent.primaryBooks.length + agent.secondaryBooks.length;
  const totalLectures = lectureSets
    ? countDistinctLectureViews(lectureSets)
    : 0;
  const talks = agent.talks.length;
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
        <span>${totalLectures} Vorträge</span>
        <span>${talks} Gespräche</span>
      </div>
    </div>
  </a>`;
}

export function generateHomePage(
  outputDir: string,
  agents: Agent[],
  lecturesByAgent: Map<string, AgentLectureSets>
): void {
  const generatedAt = new Date().toISOString();
  const cards = agents
    .map((agent) =>
      renderAgentCard(agent, lecturesByAgent.get(agent.id))
    )
    .join("\n");
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

  const coverColor = (title: string): string => {
    let h = 0;
    for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0;
    return `hsl(${h % 360}, 28%, 32%)`;
  };

  const items = bookIds.map((bookId) => {
    const known = availableBooks.get(bookId);
    const parsed = parseBookString(bookId);
    const title = escapeHtml(known?.title || parsed.title || bookId);
    const author = escapeHtml(known?.author || parsed.author || "Unbekannt");
    const subtitle = known?.subtitle ? `<div class="meta-quiet">${escapeHtml(known.subtitle)}</div>` : "";
    const bookIdFromManifest = known ? readScalarFromManifest(known.absBookDir, "book-id").trim() : "";
    const coverSrc = bookIdFromManifest
      ? `../../assets/covers/${encodeURIComponent(bookIdFromManifest)}.svg`
      : "";
    const media = coverSrc
      ? `<img class="book-link-cover-img" src="${escapeHtml(coverSrc)}" alt="" loading="lazy" decoding="async" />`
      : `<span class="book-link-cover-placeholder" style="background:${coverColor(known?.title || parsed.title || bookId)}" aria-hidden="true"></span>`;
    return `<a class="book-link" href="../../books/${encodeURIComponent(bookId)}/index.html">
      <span class="book-link-media">${media}</span>
      <span class="book-link-body">
        <strong>${title}</strong>
        <span>${author}</span>
        ${subtitle}
      </span>
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
      ? `<a class="lecture-open-link" href="../../${encodeURI(lecture.htmlPath)}" rel="noreferrer" aria-label="Vortragstext öffnen (Shift+Klick für neuen Tab)" title="Shift+Klick öffnet in neuem Tab">📖 Vortragstext</a>`
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

function renderQuotesSection(quotesData: QuotesData | undefined): string {
  if (!quotesData || quotesData.quotes.length === 0) {
    return `<p class="empty-state">Keine Zitate verfügbar.</p>`;
  }

  const { quotes, sources } = quotesData;

  // Group quotes: sourceId → segmentId → quote list
  // Also track kind per source (first quote wins)
  const bySource = new Map<
    string,
    Map<string, { text: string; segmentTitle: string; paragraphUrl: string | null; quoteKind: string; author?: string }[]>
  >();
  const kindBySource = new Map<string, string>();
  const authorsByKind: Record<string, Set<string>> = {};

  for (const q of quotes) {
    let sourceMap = bySource.get(q.sourceId);
    if (!sourceMap) {
      sourceMap = new Map();
      bySource.set(q.sourceId, sourceMap);
    }
    if (!kindBySource.has(q.sourceId)) {
      kindBySource.set(q.sourceId, q.quoteKind);
    }
    if (q.author) {
      if (!authorsByKind[q.quoteKind]) authorsByKind[q.quoteKind] = new Set();
      authorsByKind[q.quoteKind]!.add(q.author);
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
      quoteKind: q.quoteKind,
      author: q.author,
    });
  }

  // Build sourcesByKind for dynamic dropdown
  const sourcesByKind: Record<string, { id: string; title: string }[]> = {};
  for (const [srcId, kind] of kindBySource) {
    if (!sourcesByKind[kind]) sourcesByKind[kind] = [];
    const title = sources.find((s) => s.id === srcId)?.title ?? srcId;
    sourcesByKind[kind].push({ id: srcId, title });
  }

  const allSourcesJson = JSON.stringify(
    sources.map((s) => ({ id: s.id, title: s.title }))
  );
  const sourcesByKindJson = JSON.stringify(sourcesByKind);
  const authorsByKindJson = JSON.stringify(
    Object.fromEntries(
      Object.entries(authorsByKind).map(([k, v]) => [k, Array.from(v).sort()])
    )
  );

  const allSourcesDropdown =
    '<option value="">Alle</option>' +
    sources
      .map(
        (s) =>
          `<option value="${escapeHtml(s.id)}">${escapeHtml(s.title)}</option>`
      )
      .join("");

  const groupsHtml: string[] = [];
  for (const [sourceId, segmentMap] of bySource) {
    const sourceTitle =
      sources.find((s) => s.id === sourceId)?.title ?? sourceId;
    const groupKind = kindBySource.get(sourceId) ?? "author";
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
          const authorAttr = q.author ? ` data-author="${escapeHtml(q.author)}"` : "";
          return `<div class="quote-block" data-quote data-quote-kind="${escapeHtml(q.quoteKind)}"${authorAttr}><pre class="quote-text typewriter-font">${escapeHtml(
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
      `<div class="quotes-group" data-source-id="${escapeHtml(sourceId)}" data-quote-kind="${escapeHtml(groupKind)}">
  <h4 class="quotes-source-title">${escapeHtml(sourceTitle)}</h4>
  ${chaptersHtml.join("")}
</div>`
    );
  }

  const script = `
<script>
(function(){
  var searchEl = document.getElementById("quotesSearch");
  var kindEl = document.getElementById("quotesKind");
  var authorEl = document.getElementById("quotesAuthor");
  var sourceEl = document.getElementById("quotesSource");
  var container = document.getElementById("quotesContainer");
  if (!searchEl || !kindEl || !authorEl || !sourceEl || !container) return;

  var allSources = ${allSourcesJson};
  var sourcesByKind = ${sourcesByKindJson};
  var authorsByKind = ${authorsByKindJson};

  var groups = container.querySelectorAll(".quotes-group");

  function updateAuthorDropdown(kindVal) {
    var authors = kindVal ? (authorsByKind[kindVal] || []) : [];
    var show = authors.length > 0;
    authorEl.style.display = show ? "" : "none";
    if (!show) { authorEl.value = ""; return; }
    var currentAuthor = (authorEl.value || "").trim();
    var html = '<option value="">Alle</option>';
    for (var i = 0; i < authors.length; i++) {
      var a = authors[i];
      var label = a.replace(/_/g, ' ');
      var sel = a === currentAuthor ? ' selected' : '';
      html += '<option value="' + a + '"' + sel + '>' + label + '</option>';
    }
    authorEl.innerHTML = html;
    var stillValid = authors.indexOf(currentAuthor) >= 0;
    if (currentAuthor && !stillValid) authorEl.value = "";
  }

  function updateSourceDropdown(kindVal) {
    var currentSource = (sourceEl.value || "").trim();
    var sources = kindVal ? (sourcesByKind[kindVal] || []) : allSources;
    var html = '<option value="">Alle</option>';
    for (var i = 0; i < sources.length; i++) {
      var s = sources[i];
      var sel = s.id === currentSource ? ' selected' : '';
      html += '<option value="' + s.id + '"' + sel + '>' + s.title + '</option>';
    }
    sourceEl.innerHTML = html;
    var stillValid = sources.some(function(s) { return s.id === currentSource; });
    if (currentSource && !stillValid) sourceEl.value = "";
  }

  function apply() {
    var term = (searchEl.value || "").trim().toLowerCase();
    var kindVal = (kindEl.value || "").trim();
    var authorVal = (authorEl.value || "").trim();
    var sourceVal = (sourceEl.value || "").trim();

    groups.forEach(function(g) {
      var matchSource = !sourceVal || g.getAttribute("data-source-id") === sourceVal;
      var matchKind = !kindVal || g.getAttribute("data-quote-kind") === kindVal;
      var quotesInGroup = g.querySelectorAll("[data-quote]");
      var anyVisible = false;
      quotesInGroup.forEach(function(q) {
        var text = (q.textContent || "").toLowerCase();
        var matchSearch = !term || text.indexOf(term) >= 0;
        var matchQuoteKind = !kindVal || q.getAttribute("data-quote-kind") === kindVal;
        var matchAuthor = !authorVal || q.getAttribute("data-author") === authorVal;
        var show = matchSource && matchKind && matchSearch && matchQuoteKind && matchAuthor;
        q.style.display = show ? "" : "none";
        if (show) anyVisible = true;
      });
      g.style.display = anyVisible ? "" : "none";
    });
  }

  searchEl.addEventListener("input", apply);
  searchEl.addEventListener("change", apply);
  kindEl.addEventListener("change", function() {
    var kindVal = (kindEl.value || "").trim();
    updateAuthorDropdown(kindVal);
    updateSourceDropdown(kindVal);
    apply();
  });
  authorEl.addEventListener("change", apply);
  sourceEl.addEventListener("change", apply);
})();
</script>`;

  // Autorendropdown startet leer – wird per JS dynamisch befüllt wenn ein Typ gewählt ist.
  const authorDropdownOptions = '<option value="">Alle</option>';

  return `<div class="quotes-section stack-8">
  <div class="quotes-filters stack-8">
    <input type="text" id="quotesSearch" class="quotes-search-input" placeholder="Zitate durchsuchen..." aria-label="Zitate durchsuchen" />
    <select id="quotesKind" class="quotes-kind-select" aria-label="Typ wählen">
      <option value="">Alle Typen</option>
      <option value="author">Autorenzitate</option>
      <option value="foreign">Fremdzitate</option>
      <option value="assistant">Assistentenzitate</option>
    </select>
    <select id="quotesAuthor" class="quotes-author-select" aria-label="Autor wählen" style="display:none">
      ${authorDropdownOptions}
    </select>
    <select id="quotesSource" class="quotes-source-select" aria-label="Quelle wählen">
      ${allSourcesDropdown}
    </select>
  </div>
  <div id="quotesContainer" class="quotes-container stack-16">
    ${groupsHtml.join("")}
  </div>
  ${script}
</div>`;
}


function renderJsonlConceptAccordions(
  agent: Agent,
  entriesByFile: Map<string, ConceptEntry[]>,
  chunkIndex: Map<string, ChunkInfo>,
  agentBookIds: Set<string>,
  options: {
    emptyMessage: string;
    dropdownId: string;
    panelSelectorClass: string;
    panelDataAttr: string;
    selectAriaLabel: string;
    getFileLabel: (fileName: string, agentName: string) => string;
  }
): string {
  const files = Array.from(entriesByFile.keys());
  if (files.length === 0) return `<p class="empty-state">${options.emptyMessage}</p>`;

  const dropdownOptions = files
    .map(
      (f) =>
        `<option value="${escapeHtml(f)}">${escapeHtml(
          options.getFileLabel(f, agent.name)
        )}</option>`
    )
    .join("");

  const accordionPanels = files.map((fileName) => {
    const entries = entriesByFile.get(fileName) ?? [];
    const items = entries
      .map((entry, entryIndex) => {
        if (entryIndex >= 8) {
          // #region agent log
          fetch('http://127.0.0.1:7480/ingest/f96b38f1-0577-4277-afab-70a8601f20d7',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'89067e'},body:JSON.stringify({sessionId:'89067e',runId:'initial',hypothesisId:'H1',location:'pages.ts:980',message:'concept accordion item near transition',data:{entryIndex,segmentTitle:entry.segmentTitle || '',hasReferences:Boolean(entry.references?.length),referencesCount:entry.references?.length ?? 0},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
        }
        const titleFromText = entry.text.match(/^\*\*(.+?)\*\*/)?.[1];
        const title = titleFromText ?? entry.segmentTitle ?? "(Ohne Titel)";
        const titleHtml = renderInlineWithEmphasis(title);
        const textHtml = renderSummaryHtml(entry.text);
        let refsHtml = "";
        if (entry.references && entry.references.length > 0) {
          const citations: TalkCitation[] = entry.references
            .filter((ref) => {
              const chunk = chunkIndex.get(ref.chunk_id);
              return chunk && agentBookIds.has(chunk.bookDir);
            })
            .map((ref) => ({
              chunk_id: ref.chunk_id,
              relevance: ref.relevance,
              source_title: chunkIndex.get(ref.chunk_id)?.source_title ?? "",
            }));
          refsHtml = renderQuellenDetails(citations, chunkIndex, { rootPath: "../.." });
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
    return `<div class="${options.panelSelectorClass}" ${options.panelDataAttr}="${escapeHtml(fileName)}"${styleAttr}>${items}</div>`;
  });

  const ddId = escapeHtml(options.dropdownId);
  const script = `
<script>
(function(){
  var sel = document.getElementById("${ddId}");
  var panels = document.querySelectorAll(".${options.panelSelectorClass}");
  if (!sel || !panels.length) return;
  sel.addEventListener("change", function(){
    var v = sel.value;
    var attr = "${escapeHtml(options.panelDataAttr)}";
    panels.forEach(function(p){
      p.style.display = (p.getAttribute(attr) === v) ? "" : "none";
    });
  });
})();
</script>`;

  return `<div class="concepts-section stack-8">
  <label for="${ddId}" class="concepts-dropdown-label">Quelle:</label>
  <select id="${ddId}" class="concepts-dropdown" aria-label="${escapeHtml(options.selectAriaLabel)}">
    ${dropdownOptions}
  </select>
  <div class="concepts-accordions stack-16">
    ${accordionPanels.join("")}
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
  return renderJsonlConceptAccordions(agent, conceptsByFile, chunkIndex, agentBookIds, {
    emptyMessage: "Keine Begriffe verfügbar.",
    dropdownId: "conceptsDropdown",
    panelSelectorClass: "concepts-panel",
    panelDataAttr: "data-concepts-file",
    selectAriaLabel: "Begriffsquelle wählen",
    getFileLabel: getConceptFileLabel,
  });
}

function renderTypologiesRows(
  agent: Agent,
  typologiesByFile: Map<string, ConceptEntry[]>,
  chunkIndex: Map<string, ChunkInfo>,
  agentBookIds: Set<string>
): string {
  return renderJsonlConceptAccordions(agent, typologiesByFile, chunkIndex, agentBookIds, {
    emptyMessage: "Keine Ordnungen verfügbar.",
    dropdownId: "typologiesDropdown",
    panelSelectorClass: "typologies-panel",
    panelDataAttr: "data-typologies-file",
    selectAriaLabel: "Ordnungsquelle wählen",
    getFileLabel: getTypologyFileLabel,
  });
}

function renderTaxonomies(taxonomies: string[]): string {
  if (taxonomies.length === 0) return `<p class="empty-state">Keine Ordnungen verfügbar.</p>`;
  return `<div class="stack-8">${taxonomies
    .map((tax) => `<div class="taxonomy-item">${escapeHtml(tax).replace(/&gt;/g, " &rarr; ")}</div>`)
    .join("")}</div>`;
}

function renderTalkRows(
  talkFiles: string[],
  talksData: Map<string, TalkData>
): string {
  if (talkFiles.length === 0) {
    return `<p class="empty-state">Keine Gespräche verfügbar.</p>`;
  }

  const items = talkFiles
    .filter((f) => f.endsWith(".md"))
    .map((file) => {
      const slug = file.replace(/\.md$/, "");
      const talk = talksData.get(slug);
      const title = escapeHtml(talk?.title ?? slug);
      const talkUrl = `talks/${encodeURIComponent(slug)}.html`;
      const excerpt = talk?.excerpt;

      if (excerpt) {
        return `<div class="talk-card book-link">
  <a href="${talkUrl}" style="text-decoration: none; color: inherit;"><strong>${title}</strong></a>
  <p class="meta-quiet talk-excerpt">${escapeHtml(excerpt)}</p>
</div>`;
      }

      return `<a class="book-link" href="${talkUrl}">
  <strong>${title}</strong>
</a>`;
    });

  return `<div class="book-list">${items.join("")}</div>`;
}

function renderSectionContent(
  section: AgentSection,
  agent: Agent,
  availableBooks: Map<string, Book>,
  talksByAgent: Map<string, Map<string, TalkData>>,
  conceptsByAgent: Map<string, Map<string, ConceptEntry[]>>,
  conceptsChunkIndex: Map<string, ChunkInfo>,
  typologiesByAgent: Map<string, Map<string, ConceptEntry[]>>,
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
  if (section === "talks") {
    const talksData = talksByAgent.get(agent.id) ?? new Map();
    return `<div class="stack-8"><h3>${SECTION_META.talks.heading}</h3>${renderTalkRows(
      agent.talks,
      talksData
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
    const typologiesData = typologiesByAgent.get(agent.id) ?? new Map();
    const chunkIndex = conceptsChunkIndex ?? new Map();
    const agentBookIds = new Set([...agent.primaryBooks, ...agent.secondaryBooks]);
    if (typologiesData.size > 0) {
      return `<div class="stack-8"><h3>${SECTION_META.taxonomies.heading}</h3>${renderTypologiesRows(
        agent,
        typologiesData,
        chunkIndex,
        agentBookIds
      )}</div>`;
    }
    if (agent.taxonomies.length > 0) {
      return `<div class="stack-8"><h3>${SECTION_META.taxonomies.heading}</h3>${renderTaxonomies(
        agent.taxonomies
      )}</div>`;
    }
    return `<div class="stack-8"><h3>${SECTION_META.taxonomies.heading}</h3><p class="empty-state">Keine Ordnungen verfügbar.</p></div>`;
  }
  return `<div class="stack-8"><p class="empty-state">Kein Inhalt für diesen Bereich.</p></div>`;
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
  talksByAgent: Map<string, Map<string, TalkData>>,
  conceptsByAgent: Map<string, Map<string, ConceptEntry[]>>,
  conceptsChunkIndex: Map<string, ChunkInfo>,
  typologiesByAgent: Map<string, Map<string, ConceptEntry[]>>,
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
          talksByAgent,
          conceptsByAgent,
          conceptsChunkIndex,
          typologiesByAgent,
          lecturesByAgent,
          quotesByAgent
        )}
      </main>
    </div>`
  );
  writeTextFile(path.join(agentDir, sectionMeta.fileName), html);
}

function renderAgentStatistikPage(outputDir: string, agent: Agent): void {
  const agentDir = path.join(outputDir, "agent", encodeURIComponent(agent.id));
  const html = renderStatistikPage(agent);
  writeTextFile(path.join(agentDir, "statistik.html"), html);
}

export function generateAgentPages(
  outputDir: string,
  agents: Agent[],
  availableBooks: Map<string, Book>,
  talksByAgent: Map<string, Map<string, TalkData>>,
  conceptsByAgent: Map<string, Map<string, ConceptEntry[]>>,
  conceptsChunkIndex: Map<string, ChunkInfo>,
  typologiesByAgent: Map<string, Map<string, ConceptEntry[]>>,
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
        talksByAgent,
        conceptsByAgent,
        conceptsChunkIndex,
        typologiesByAgent,
        lecturesByAgent,
        quotesByAgent,
        section
      );
    }
    renderAgentStatistikPage(outputDir, agent);
  }
}
