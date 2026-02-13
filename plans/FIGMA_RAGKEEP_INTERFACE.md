# Schnittstelle Figma ↔ ragkeep

Dieses Dokument beschreibt die Schnittstelle zwischen dem Figma-Export („KI-Assistenten Webseite erstellen“) und dem ragkeep-Projekt.

---

## 1. Übersicht

| Aspekt | Figma-Territorium | ragkeep-Territorium |
|--------|-------------------|---------------------|
| **Design** | Layout, Komponenten, Styles | — |
| **Daten** | mockAgents (Platzhalter) | assistants.json, books/, assistants/ |
| **Konfiguration** | theme.css, Vite, Routing | base URL, Build-Pipeline |
| **Integration** | — | build_agent_registry.ts |

---

## 2. Antworten auf die konkreten Fragen

### 2.1 Werden die Style-Tokens eins zu eins übernommen und können bei Updates einfach überschrieben werden?

**Aktueller Stand:**
- **Ja, teilweise.** Die `theme.css` enthält CSS Custom Properties (`:root`, `.dark`) und `@theme inline` für Tailwind.
- Die ZIP-Datei und `website/figma-prototype` haben **identische** `theme.css`-Inhalte (Farben, Radius, Font-Weights).
- Es gibt **keine** `design-tokens.json` – der Plan sieht sie als optional vor, ist aber nicht implementiert.

**Eins-zu-eins-Übernahme:**
- **Direkt überschreibbar:** `src/styles/theme.css` kann bei jedem Figma-Update 1:1 ersetzt werden.
- **Einschränkung:** Figma exportiert keine native `design-tokens.json`. Die Tokens stammen aus dem Figma-Dev-Mode / Make-Export und liegen bereits als CSS vor.
- **Empfehlung:** Bei Figma-Updates `theme.css` aus dem neuen ZIP in `website/figma-prototype/src/styles/theme.css` kopieren → sofort wirksam.

**Falls design-tokens.json gewünscht:**
- Figma Variables müssten manuell oder per Plugin (z.B. Style Dictionary, Figma Tokens) exportiert werden.
- Ein kleines Script könnte `design-tokens.json` → `theme.css` generieren (siehe REACT_APP_AGENT_REGISTRY.md §7).

---

### 2.2 Bleibt auch das Layout von Figma erhalten, sodass es einfach überschrieben werden kann?

**Aktueller Stand:**
- **Teilweise.** Das Layout steckt in den React-Komponenten (`Layout.tsx`, `AgentListPage.tsx`, `AgentDetailPage.tsx`, `components/ui/*`, `components/figma/*`).
- Ein vollständiger Figma-Export überschreibt diese Dateien – **aber** ragkeep hat sie bereits angepasst:
  - `App.tsx`: Fetch von `assistants.json`, HashRouter, Loading/Error-States
  - `AgentListPage.tsx`: erhält `agents` als Prop statt mockAgents
  - `AgentDetailPage.tsx`: erhält `agents` als Prop, nutzt echte Daten
  - `vite.config.ts`: `base: '/ragkeep/'` für GitHub Pages

**Problem bei 1:1-Überschreibung:**
- Ein naiver Austausch des gesamten `website/figma-prototype/` durch den ZIP-Inhalt würde die ragkeep-spezifischen Anpassungen zerstören.

**Lösung (siehe Frage 4):** Trennung in Figma-Territorium und ragkeep-Territorium.

---

### 2.3 Wie ist die derzeitige Schnittstelle zwischen Figma und ragkeep?

**Konkrete Berührungspunkte:**

| Ort | Figma-Export | ragkeep-Anpassung |
|-----|--------------|-------------------|
| `src/app/App.tsx` | BrowserRouter, mockAgents | HashRouter, Fetch `assistants.json`, Loading/Error |
| `src/app/pages/AgentListPage.tsx` | `mockAgents` import | `agents` als Prop, echte URLs |
| `src/app/pages/AgentDetailPage.tsx` | `mockAgents` import | `agents` als Prop, echte URLs |
| `src/app/types.ts` | Agent-Interface | Unverändert (kompatibel) |
| `src/styles/theme.css` | Design-Tokens | Unverändert (1:1 übernehmbar) |
| `public/data/assistants.json` | — | **Generiert** von `build_agent_registry.ts` |
| `public/books/` | — | **Kopiert** von `books/` |
| `public/assistants/` | — | **Kopiert** (Avatare, Essays, Concepts) |
| `vite.config.ts` | base: `/` | base: `/ragkeep/` (Produktion) |

**Datenfluss:**
```
assistants/*/assistant-manifest.yaml
books/*
        │
        ▼
website/scripts/build_agent_registry.ts
        │
        ├──► public/data/assistants.json
        ├──► public/books/<bookDir>/
        └──► public/assistants/<id>/
        │
        ▼
website/figma-prototype (Vite Build)
        │
        ▼
dist/ → GitHub Pages
```

**Keine automatische Figma-Sync-Pipeline:** Es gibt keinen CI-Job, der Figma-Exports automatisch einspielt. Updates erfolgen manuell.

---

### 2.4 Ist es möglich, `website/figma-prototype` unangetastet zu lassen (Figma-Territorium) und Anpassungen in einem anderen Verzeichnis zu haben?

**Ja, das ist möglich und sinnvoll.** Vorgeschlagene Struktur:

```
ragkeep/
├── website/figma-prototype/           # FIGMA-TERRITORIUM – nur bei Figma-Updates überschreiben
│   ├── src/
│   │   ├── app/
│   │   │   ├── App.tsx         # Original: BrowserRouter, mockAgents
│   │   │   ├── pages/
│   │   │   ├── components/
│   │   │   └── data/mockAgents.ts
│   │   └── styles/
│   │       └── theme.css
│   ├── public/                 # Leer oder Platzhalter – wird von Build überschrieben
│   ├── package.json
│   └── vite.config.ts
│
├── website/app-overrides/              # RAGKEEP-TERRITORIUM – Anpassungen, die Figma nicht liefert
│   ├── App.tsx                 # Ersetzt: HashRouter, Fetch, Loading/Error
│   ├── pages/
│   │   ├── AgentListPage.tsx   # agents als Prop
│   │   └── AgentDetailPage.tsx # agents als Prop
│   └── vite.config.patch.ts    # base: '/ragkeep/'
│
├── website/scripts/
│   └── build_agent_registry.ts # Schreibt nach website/figma-prototype/public/
│
├── assistants/
├── books/
└── ...
```

**Implementierungsoptionen:**

1. **Build-Zeit-Merge (empfohlen):**
   - `build_agent_registry.ts` schreibt wie bisher nach `website/figma-prototype/public/`.
   - Ein zusätzliches Script kopiert vor dem Vite-Build die Dateien aus `website/app-overrides/` nach `website/figma-prototype/src/app/` (nur die geänderten Dateien).
   - `website/figma-prototype` bleibt das „Quell-Design“; Overrides werden beim Build eingespielt.

2. **Vite-Alias / Resolve:**
   - In `vite.config.ts`: `resolve.alias['@/app/App'] = path.resolve('website/app-overrides/App.tsx')`.
   - So werden nur bestimmte Module aus `app-overrides` geladen, der Rest aus `website/figma-prototype`.

3. **Separate App + Design-Package:**
   - `website/figma-prototype` wird zu einem npm-Paket `@ragkeep/design` (nur UI-Komponenten, theme.css).
   - Die eigentliche App lebt in `app/` und importiert das Design-Paket.
   - Größerer Refactor, aber sauberste Trennung.

**Pragmatische Variante (minimaler Aufwand):**
- `website/figma-prototype` unverändert lassen.
- Nur diese Dateien als „ragkeep-Overrides“ in einem separaten Verzeichnis pflegen:
  - `App.tsx`
  - `AgentListPage.tsx`
  - `AgentDetailPage.tsx`
  - `vite.config.ts` (nur die `base`-Zeile)
- Ein Script `website/scripts/apply_overrides.ts` kopiert sie vor `npm run build` nach `website/figma-prototype/`.
- Bei Figma-Updates: ZIP entpacken → `apply_overrides` erneut ausführen → fertig.

---

## 3. Dateien-Übersicht: Was kommt von wo?

| Datei/Verzeichnis | Quelle | Überschreibbar bei Figma-Update? |
|-------------------|--------|----------------------------------|
| `src/styles/theme.css` | Figma | ✅ Ja, 1:1 |
| `src/styles/fonts.css`, `index.css`, `tailwind.css` | Figma | ✅ Ja |
| `src/app/components/ui/*` | Figma | ✅ Ja |
| `src/app/components/figma/*` | Figma | ✅ Ja |
| `src/app/components/Layout.tsx` | Figma | ⚠️ Prüfen (evtl. ragkeep-Anpassungen) |
| `src/app/App.tsx` | ragkeep (angepasst) | ❌ Nein, Override |
| `src/app/pages/AgentListPage.tsx` | ragkeep (angepasst) | ❌ Nein, Override |
| `src/app/pages/AgentDetailPage.tsx` | ragkeep (angepasst) | ❌ Nein, Override |
| `src/app/types.ts` | Gemeinsam | ⚠️ Muss kompatibel bleiben |
| `src/app/data/mockAgents.ts` | Figma | Kann ignoriert werden (App fetcht JSON) |
| `public/data/assistants.json` | build_agent_registry | ❌ Generiert |
| `public/books/` | build_agent_registry | ❌ Kopiert |
| `public/assistants/` | build_agent_registry | ❌ Kopiert |
| `vite.config.ts` | ragkeep (angepasst) | ❌ Nein, Override (base) |

---

## 4. Empfohlener Workflow bei Figma-Updates

1. Neuen Figma-Export (ZIP) herunterladen.
2. In temporäres Verzeichnis entpacken.
3. **Nur** folgende Dateien/Ordner nach `website/figma-prototype/` kopieren:
   - `src/styles/*`
   - `src/app/components/`
   - `src/app/data/mockAgents.ts` (optional, wird nicht genutzt)
   - `src/app/types.ts` (nur wenn kompatibel)
4. **Nicht** überschreiben: `App.tsx`, `AgentListPage.tsx`, `AgentDetailPage.tsx`, `vite.config.ts`.
5. `npm run build:registry && npm run apply:overrides && npm run build:app` ausführen.

**Oder** mit Override-Verzeichnis:
1. ZIP komplett nach `website/figma-prototype/` entpacken (überschreibt alles).
2. `website/scripts/apply_overrides.ts` ausführen (kopiert ragkeep-Anpassungen zurück).
3. Build ausführen.

---

## 5. Figma-Projekt-Referenz

- **Figma-URL:** https://www.figma.com/design/WymSOBCvSVAOBkbsWGbHkZ/KI-Assistenten-Webseite-erstellen
- **ZIP-Name:** „KI-Assistenten Webseite erstellen.zip“
- **Package-Name im Export:** `@figma/my-make-file`
