# Plan: React App Agent Registry

Dieses Dokument beschreibt die Architektur und den Workflow für die ragkeep-Webseite als React-App, die auf GitHub Pages veröffentlicht wird.

---

## 1. Übersicht

- **Hauptseite**: React-App (Figma-Prototyp) unter `website/figma-prototype/`
- **Entfernt**: `site/` und `administration/scripts/build_pages_site.js`
- **Datenquelle**: `assistants/`, `books/`, Essays, Concepts – zur Build-Zeit in die App integriert
- **Design-Workflow**: Figma → `design-tokens.json` / `theme.css` oder Prompt-basierte Änderungen

---

## 2. Zielstruktur

```
ragkeep/
├── website/figma-prototype/           # React-App (Hauptseite, TypeScript)
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/
│   │   │   ├── data/           # mockAgents → assistants.json (generiert)
│   │   │   ├── pages/
│   │   │   └── types.ts
│   │   └── styles/
│   │       ├── theme.css       # Design-Tokens (Figma → hier)
│   │       └── design-tokens.json  # Optional: Export aus Figma
│   ├── public/
│   │   ├── data/
│   │   │   └── assistants.json    # Build-Zeit generiert
│   │   └── books/                  # Buch-HTML (Build-Zeit kopiert)
│   ├── package.json
│   ├── tsconfig.json             # TypeScript-Konfiguration
│   └── vite.config.ts
├── assistants/
├── books/
├── scripts/
│   └── build_agent_registry.ts   # Neuer Build: Daten + Buch-HTML (TypeScript)
└── .github/workflows/
    └── pages.yml                 # deployt website/figma-prototype/dist
```

### 2.1 TypeScript

- **React-App** (`website/figma-prototype/`): Vollständig in TypeScript (`.ts`, `.tsx`)
- **Build-Script** (`website/scripts/build_agent_registry.ts`): TypeScript, Ausführung z.B. via `tsx` oder `ts-node`
- **tsconfig.json**: Strict-Mode, `@/*`-Pfad-Alias
- **Scripts**: `typecheck` (nur Prüfung), `build` (tsc --noEmit && vite build)

---

## 3. Build-Pipeline

### 3.1 Einziger Build-Script: `website/scripts/build_agent_registry.ts`

TypeScript-Script. Ersetzt `build_pages_site.js` und übernimmt:

1. **Assistenten-Daten** aus `assistants/*/assistant-manifest.yaml`
   - Erzeugt `website/figma-prototype/public/data/assistants.json`
   - Inhalt: name, ragCollection, description, writingStyle, primaryBooks, secondaryBooks, concepts, essays
   - Optional: Avatar-URL, Zitate, Taxonomien (falls vorhanden)

2. **Buch-HTML kopieren**
   - **Nur aus `books/`** (nicht aus `ragkeep-deutsche-klassik-books-de/books/`)
   - Nur Bücher, die im `assistant-manifest` (primary-books, secondary-books) mindestens eines Assistenten vorkommen
   - Nach `website/figma-prototype/public/books/<bookDir>/`
   - Gleiche Logik wie bisher (html/, results/html/, TOC-Summaries etc.)

3. **Assistenten-Daten strikt aus Manifest**
   - `primaryBooks`, `secondaryBooks`: exakt die im Manifest genannten Einträge (nur wenn Buch in `books/` existiert)
   - `essays`: nur die im Manifest unter `essays:` gelisteten Dateien; Metadaten aus `assistants/<id>/essays/<file>.essay` (topic, short_topic, background)
   - `concepts`: nur die im Manifest unter `concepts:` gelisteten JSONL-Dateien; Begriffe aus `assistants/<id>/concepts/<file>.jsonl`

### 3.2 Vite Build

- `npm run build` in `website/figma-prototype/` → `dist/`
- `base: '/ragkeep/'` in `vite.config.ts` für GitHub Pages
- React Router: `BrowserRouter` mit `base` oder `HashRouter` für SPA-Routing

### 3.3 GitHub Pages Workflow

- Workflow baut `website/figma-prototype` statt `site/`
- Artifact: `website/figma-prototype/dist`
- Kein `site/`, kein `build_pages_site.js`

---

## 4. Design-Workflow: Figma → Code

### 4.1 Kleine Änderungen (Farben, Typografie, Spacing)

**Pfad A: `design-tokens.json`**

- Figma Variables/Tokens exportieren → `design-tokens.json` im Repo
- Build oder `theme.css` liest Tokens und generiert CSS-Variablen
- Änderung: Figma → Export → `design-tokens.json` ersetzen → neu bauen

**Pfad B: Direkt in `theme.css`**

- Figma-Variablen manuell in `src/styles/theme.css` übertragen
- Änderung: Werte in `theme.css` anpassen

### 4.2 Strukturelle Änderungen (Layout, Komponenten, Sektionen)

**Prompt-basierter Workflow**

Beispiele für Prompts an den AI-Assistenten (Cursor o.ä.):

- *"Bitte füge die neue Karte in der Begriffe-Sektion ein. Ersetze die alte."*
- *"Passe das Layout der Agent-Karten an das neue Figma-Design an."*
- *"Ersetze die Tab-Navigation in AgentDetailPage durch die neue Sidebar aus Figma."*

**Vorgehen:**

1. Design in Figma anpassen
2. Screenshot oder Export des betroffenen Bereichs bereitstellen
3. Prompt mit klarer Anweisung formulieren („ersetze X durch Y“, „füge Z ein“)
4. AI passt die entsprechenden React-Komponenten an

**Kontext für Prompts:**

- Referenz auf `AgentDetailPage.tsx`, `AgentListPage.tsx` oder die konkrete Sektion
- Nennung der betroffenen Sektion (z.B. „Begriffe“, „Essays“, „Bücher“)
- Ggf. Pfad zu Figma-Export oder Screenshot

---

## 5. Datenfluss

```
assistants/*/assistant-manifest.yaml
assistants/*/essays/*.essay
assistants/*/concepts/*.jsonl
books/*/html/  bzw.  books/*/results/html/
        │
        ▼
website/scripts/build_agent_registry.ts
        │
        ├──► public/data/assistants.json
        └──► public/books/<bookDir>/
        │
        ▼
Vite Build (React App)
        │
        ▼
dist/  →  GitHub Pages
```

---

## 6. Umstellungsschritte

1. **Build-Script anlegen**
   - `website/scripts/build_agent_registry.ts` erstellen (TypeScript)
   - Ausführung: `tsx website/scripts/build_agent_registry.ts` oder `npx ts-node --esm`
   - Logik aus `build_pages_site.js` für Bücher übernehmen
   - Assistenten-Daten aus `assistant-manifest.yaml` auslesen
   - `public/data/assistants.json` schreiben
   - Buch-HTML nach `public/books/` kopieren

2. **React-App anpassen**
   - `mockAgents` durch Fetch von `/data/assistants.json` ersetzen (oder Import zur Build-Zeit)
   - Buch-Links auf `/ragkeep/books/Author#Title#Id/index.html` (oder relativen Pfad)
   - Essay-Links definieren (Dateiname oder eigene Route)
   - `vite.config.ts`: `base: '/ragkeep/'`
   - SPA-Routing: `404.html`-Redirect oder `HashRouter`

3. **package.json**
   - `build:pages` → Aufruf von `build_agent_registry.ts` + `cd website/figma-prototype && npm run build`
   - Abhängigkeit: `tsx` (Dev) für `tsx website/scripts/build_agent_registry.ts`
   - Oder separates `build:registry`-Script

4. **GitHub Pages Workflow**
   - Artifact-Pfad: `website/figma-prototype/dist` statt `site`

5. **Aufräumen**
   - `site/` entfernen
   - `administration/scripts/build_pages_site.js` entfernen

---

## 7. design-tokens.json (optional)

Struktur-Beispiel für späteren Figma-Export:

```json
{
  "colors": {
    "background": "#ffffff",
    "foreground": "#0b1220",
    "primary": "#4f46e5",
    "muted": "rgba(11, 18, 32, 0.70)"
  },
  "typography": {
    "fontFamily": { "sans": "…", "serif": "Cormorant Garamond" },
    "fontSize": { "base": "16px", "lg": "18px" }
  },
  "spacing": { "radius": "16px" }
}
```

Ein kleines Script kann `design-tokens.json` in CSS-Variablen für `theme.css` umwandeln.

---

## 8. Checkliste vor Go-Live

- [ ] `build_agent_registry.ts` implementiert und getestet
- [ ] `assistants.json` wird korrekt generiert
- [ ] Buch-HTML liegt unter `public/books/` und ist erreichbar
- [ ] React-App lädt `assistants.json` zur Laufzeit oder zur Build-Zeit
- [ ] Alle Links (Bücher, Essays, Begriffe) funktionieren
- [ ] `base: '/ragkeep/'` in `vite.config.ts` für GitHub Pages gesetzt
- [ ] SPA-Routing funktioniert (HashRouter oder 404.html-Redirect)
- [ ] `site/` und `build_pages_site.js` entfernt
- [ ] Workflow deployt aus `website/figma-prototype/dist`

---

## 9. GitHub Pages Deployment: Status

### Wird die App nach dem Deployment auf GitHub Pages starten?

**Ja, sobald alle Umstellungsschritte erledigt sind.** GitHub Pages serviert statische Dateien (HTML, CSS, JS). Die gepackte React-App ist statisch und funktioniert ohne Server.

### Ist alles bereits vorbereitet?

**Nein.** Derzeit ist noch nicht alles ausgerichtet:

| Voraussetzung | Status |
|---------------|--------|
| React-App mit TypeScript | ✅ Erledigt |
| `tsconfig.json` in `website/figma-prototype/` | ✅ Erledigt |
| `base: '/ragkeep/'` in `vite.config.ts` | ❌ Nicht gesetzt |
| `build_agent_registry.ts` | ❌ Nicht implementiert |
| `assistants.json` zur Laufzeit | ❌ App nutzt noch `mockAgents` |
| `build:pages` → neuer Build | ❌ Aktuell: `build_pages_site.js` |
| Workflow-Pfad `website/figma-prototype/dist` | ❌ Aktuell: `site/` |
| SPA-Routing (404.html oder HashRouter) | ❌ Nicht implementiert |

### Was noch fehlt

1. **`vite.config.ts`**: `base: '/ragkeep/'` setzen (URL: `https://<user>.github.io/ragkeep/`).
2. **`build_agent_registry.ts`**: Erstellen und ausführbar machen.
3. **Root package.json**: `build:pages` auf neues Build-Script umstellen.
4. **Workflow `.github/workflows/pages.yml`**: `path: site` → `path: website/figma-prototype/dist`.
5. **SPA-Routing**: Entweder `HashRouter` oder `404.html` → `index.html` kopieren.
6. **App**: `mockAgents` durch Laden von `/data/assistants.json` ersetzen.
