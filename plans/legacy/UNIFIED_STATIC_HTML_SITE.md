# Plan: Einheitliche statische HTML-Seite

Dieses Dokument beschreibt einen Vorschlag zur Integration von Buch-HTML (ragprep) und Website (ragkeep) in eine **einheitliche statische HTML-Site** ohne React. Ziel ist eine konsistente, wartbare Lösung ohne Interaktivität außer den bereits vorhandenen Reader-Controls (Theme, Schriftgröße).

---

## 1. Ausgangslage und Problem

### 1.1 Aktuelle Architektur (Zwei Welten)

| Komponente | Technologie | Output | Verantwortung |
|------------|------------|--------|---------------|
| **ragprep** `step4RenderWrite.ts` | Node/TS | `books/<Author#Title#Id>/html/` | Buch-HTML: TOC, Kapitel, Reader-Controls |
| **build_pages_site.js** | Node | `site/` | Buch-Karten-Index, Buch-HTML kopieren + Post-Processing |
| **website/app** (React) | Vite + React | `dist/` | Agent-Übersicht, Agent-Detail, Links zu Büchern |

### 1.2 Konflikte

1. **Routing**: Buch-Links (`/books/Author%23Title%23Id/index.html`) zeigen in Dev die React-SPA, weil Vite alle Pfade auf `index.html` mappt. Die Bücher liegen in `.build/books/` (wegen `#` im Pfad nicht in `public/`).
2. **Zwei Build-Pfade**: `build_pages_site.js` → `site/` (nur Bücher) vs. `build_agent_registry.ts` + Vite → `dist/` (Agenten + Bücher).
3. **Design-Inkonsistenz**: Buch-HTML (Cormorant Garamond, eigene CSS) vs. React (Tailwind, andere Tokens).
4. **Redundanz**: `build_pages_site.js` und `build_agent_registry.ts` haben überlappende Logik (Bücher finden, kopieren, Manifest lesen).

### 1.3 Anforderung

- **Keine Interaktivität** außer den bestehenden Reader-Controls (Theme, Schriftgröße).
- **Einheitliche statische HTML-Seite**: Alles als statisches HTML, keine SPA.
- **Buch-HTML** entsteht beim `text:export` (ragprep).
- **Site-HTML** entsteht durch ein Build-Script mit derselben Funktionalität wie die React-App (Agent-Liste, Agent-Detail, Bücher-Links).

---

## 2. Zielarchitektur

### 2.1 Ein Build-Script, eine Output-Struktur

```
ragkeep/
├── books/                          # Quelle: ragprep text:export
│   └── <Author#Title#Id>/
│       ├── html/                   # step4RenderWrite.ts
│       │   ├── index.html          # TOC
│       │   ├── chapters/*.html
│       │   └── assets/styles.css
│       └── book-manifest.yaml
├── assistants/
│   └── <id>/
│       └── assistant-manifest.yaml
├── scripts/
│   └── build_static_site.ts        # NEU: ersetzt build_pages_site + build_agent_registry
└── site/                           # Einziger Output
    ├── index.html                  # Agent-Übersicht (wie AgentListPage)
    ├── agent/
    │   └── <id>/
    │       └── index.html          # Agent-Detail (wie AgentDetailPage)
    ├── books/
    │   └── <Author#Title#Id>/
    │       ├── index.html          # Buch-TOC (aus ragprep + Post-Processing)
    │       ├── chapters/*.html
    │       └── assets/styles.css
    └── assets/
        └── site.css                # Gemeinsame Styles für Agent-Seiten
```

### 2.2 Datenfluss

```
assistants/*/assistant-manifest.yaml
assistants/*/essays/*.essay
assistants/*/concepts/*.jsonl
books/*/html/  (von ragprep text:export)
        │
        ▼
scripts/build_static_site.ts
        │
        ├──► site/index.html              (Agent-Liste)
        ├──► site/agent/<id>/index.html   (Agent-Detail)
        └──► site/books/<bookDir>/        (Buch-HTML kopiert + Post-Processing)
```

---

## 3. Detaillierter Plan

### 3.1 Buch-HTML (ragprep) – unverändert

- **step4RenderWrite.ts** bleibt wie bisher.
- Output: `books/<Author#Title#Id>/html/` (oder `results/html/` je nach Konfiguration).
- Enthält: TOC, Kapitel, Reader-Controls (Theme, Schriftgröße), `assets/styles.css`.

### 3.2 Neues Build-Script: `build_static_site.ts`

**Aufgaben:**

1. **Assistenten-Daten** aus `assistants/*/assistant-manifest.yaml` lesen (wie `build_agent_registry.ts`).
2. **Agent-Übersicht** (`site/index.html`) generieren:
   - Entspricht visuell `AgentListPage`: Karten mit Name, RAG-Collection, Beschreibung, Bücher-/Essay-Anzahl.
   - Links zu `agent/<id>/index.html`.
   - Gemeinsames CSS aus `site/assets/site.css`.
3. **Agent-Detail** (`site/agent/<id>/index.html`) generieren:
   - Entspricht `AgentDetailPage` + `AgentTabs`: Header, Tabs (Übersicht, Bücher, Sekundärliteratur, Essays, Begriffe, …).
   - Bücher-Links: `../books/<bookDir>/index.html`.
   - Essay-Links: `../assistants/<id>/essays/<file>` (oder statische Datei, falls vorhanden).
4. **Buch-HTML** kopieren und post-processen (wie `build_pages_site.js`):
   - Von `books/<bookDir>/html/` nach `site/books/<bookDir>/`.
   - TOC-Summaries injizieren (falls `summaries-chunks.jsonl` existiert).
   - `ensurePrettyTocCss`, `unescapeInlineItalicsEntities`, `fixBookTocPageTitle`.
   - Nur Bücher, die in mindestens einem Assistant-Manifest vorkommen (oder alle – konfigurierbar).

### 3.3 Design-Konsistenz

- **Gemeinsame Design-Tokens** in `site/assets/site.css`:
  - Farben, Schriftarten (Cormorant Garamond, Inter), Abstände.
  - Entspricht den Werten aus `website/app` (variables.css, theme.css) oder `build_pages_site.js`.
- **Buch-Seiten** behalten ihre eigene `assets/styles.css` (Reader-spezifisch).
- **Agent-Seiten** nutzen `site.css`; optional können Buch-Seiten einen Link „Zurück zur Agent-Übersicht“ erhalten mit konsistentem Styling.

### 3.4 URL-Struktur

| Seite | URL |
|-------|-----|
| Agent-Übersicht | `/` oder `/index.html` |
| Agent-Detail | `/agent/philo-von-freisinn/` oder `/agent/philo-von-freisinn/index.html` |
| Buch-TOC | `/books/Rudolf_Steiner%23Die_Philosophie_der_Freiheit%234/index.html` |
| Buch-Kapitel | `/books/.../chapters/01-vorrede.html` |

Kein Hash-Routing, keine SPA – jede URL zeigt direkt die entsprechende HTML-Datei.

### 3.5 GitHub Pages

- **Deploy**: `site/` als Root (oder `site/` als Unterordner, z.B. `/ragkeep/`).
- **Kein** `404.html`-Redirect nötig – alle Seiten sind statische Dateien.
- **Kein** Vite, kein React-Build.

---

## 4. Implementierungsschritte

### Phase 1: Build-Script vorbereiten

1. `scripts/build_static_site.ts` anlegen (TypeScript).
2. Logik aus `build_pages_site.js` übernehmen:
   - `collectBooks`, `findHtmlDirForBook`, `copyBookHtmlToSite`, `injectTocSummaries`, `ensurePrettyTocCss`, etc.
3. Logik aus `build_agent_registry.ts` übernehmen:
   - Assistenten aus YAML lesen, `assistants.json`-äquivalente Struktur im Speicher halten.

### Phase 2: Agent-Seiten als HTML generieren

4. **Agent-Liste** (`site/index.html`):
   - Template mit Inline-CSS oder `site.css`-Link.
   - Für jeden Agent: Karte mit Name, RAG-Collection, Beschreibung, Bücher-/Essay-Anzahl, Link zu `agent/<id>/index.html`.
5. **Agent-Detail** (`site/agent/<id>/index.html`):
   - HTML-Struktur mit Tabs als `<details>`/`<summary>` oder einfache Anker-Links (`#primary-books`, `#essays`, …).
   - Bücher-Liste mit Links zu `../../books/<bookDir>/index.html`.
   - Essays, Begriffe analog.

### Phase 3: Integration und Aufräumen

6. **package.json**: `build:pages` → `tsx scripts/build_static_site.ts`.
7. **GitHub Actions**: Deploy aus `site/` statt `website/app/dist`.
8. **Entfernen**:
   - `website/app/` (React-App) – optional behalten für lokale Design-Entwicklung.
   - `build_pages_site.js`
   - `build_agent_registry.ts`
   - `copy_books_to_dist.mjs`

### Phase 4: Optional – ragprep-Integration

9. **Build-Reihenfolge**: Vor `build_static_site` ggf. `ragprep text:export` für alle Bücher ausführen (falls nicht manuell erledigt).
10. **Gemeinsame CSS-Basis**: Optional ein gemeinsames CSS-Fragment, das sowohl ragprep (step4RenderWrite) als auch build_static_site nutzen kann – würde eine kleine Anpassung in ragprep erfordern.

---

## 5. Vorteile der einheitlichen statischen HTML-Lösung

| Aspekt | Vorteil |
|--------|---------|
| **Einfachheit** | Kein React, kein Vite, kein SPA-Routing |
| **Konsistenz** | Eine URL = eine HTML-Datei, keine Fallbacks |
| **Performance** | Kein JS-Bundle für die Agent-Seiten, nur Buch-Reader hat minimales JS |
| **Wartbarkeit** | Ein Build-Script, eine Output-Struktur |
| **ragprep-Anbindung** | Buch-HTML bleibt unverändert aus text:export; Build-Script kopiert und bereinigt nur |
| **GitHub Pages** | Statische Dateien, keine SPA-Konfiguration |

---

## 6. Offene Punkte

1. **React-App behalten?** Als Design-Referenz oder für spätere Interaktivität (z.B. Suche) – oder vollständig entfernen?
2. **Essay-/Concept-Dateien**: Sollen diese als statische Dateien unter `site/assistants/<id>/essays/` bereitgestellt werden, oder nur als Download-Links?
3. **BASE_URL / Subpath**: Falls die Site unter `https://user.github.io/ragkeep/` liegt, müssen alle Links den Präfix `/ragkeep/` haben.
4. **Design-Quelle**: Sollen die Agent-Seiten exakt dem aktuellen React-Design folgen (Tailwind-äquivalent als statisches CSS), oder einem vereinfachten Layout wie `build_pages_site.js`?

---

## 7. Zusammenfassung

**Kernidee:** Eine einheitliche statische HTML-Site, bei der

- **Buch-HTML** beim `text:export` (ragprep) entsteht und unverändert bleibt,
- **build_static_site.ts** (oder ein vergleichbares Script) die Agent-Übersicht und Agent-Detail-Seiten als HTML generiert und die Buch-HTML kopiert sowie post-processed,
- **keine React-App** mehr für die Produktion benötigt wird,
- **alle Links** direkt auf statische HTML-Dateien zeigen und korrekt funktionieren.

Das Script kombiniert die Funktionalität von `build_pages_site.js` und `build_agent_registry.ts` und erweitert sie um die HTML-Generierung der Agent-Seiten.
