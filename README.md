---
language:
- de
tags:
- books
- rag
- text-retrieval
license: MIT
pretty_name: ragkeep-weimarer-klassik-books-de
configs:
- default
---

# ragkeep-weimarer-klassik-books-de

Released subset of Weimarer Klassik books curated in `ragkeep` and prepared by `ragprep`.

## Contents (HF subset)
- Released Markdown: `books/**/results/_released.md`
- HTML rendering: `books/**/results/html/<bookname>.html`
- TOC JSON: `books/**/results/toc.json`
- Provenance & corrections: `book-manifest.yaml`, `errata.txt`

`<bookname>` = canonical folder basename `Author#Title#Index`.

## Loading
```python
from datasets import load_dataset

md = load_dataset("michaelschmidt/ragkeep-weimarer-klassik-books-de",
                  data_files={"train": "books/**/results/_released.md"}, split="train")
idx = load_dataset("michaelschmidt/ragkeep-weimarer-klassik-books-de",
                  data_files={"index": "books/index.json"}, split="index")
```

## License
MIT

## Notes
- Full working tree (inputs, intermediates) lives in `ragkeep`; only the HF subset is mirrored here.

## GitHub Pages (publish the HTML books to `github.io`)

This repo can publish a static site under `site/` that lists all books which have an HTML rendering at:
- `books/<bookDir>/html/index.html` (preferred), or
- `books/<bookDir>/results/html/index.html` (legacy)

### Build locally

```bash
npm run build:pages
```

This (re)creates `site/` and writes an `index.html` that links to each book.

### Publish on GitHub Pages

This repo includes a workflow at `.github/workflows/pages.yml` that deploys the `site/` folder to GitHub Pages on every push to `main`/`master`.

To enable it once in GitHub:
- Go to **Settings → Pages**
- Set **Source** to **GitHub Actions**

Your site will be available at `https://<owner>.github.io/<repo>/` and the books index at `https://<owner>.github.io/<repo>/index.html`.

## Essay-Verwaltung mit MCP

Dieses Repository unterstützt die Erstellung und Vervollständigung von Essays über MCP (Model Context Protocol) Tools.

### Verfügbare MCP-Tools

1. **`essay_create`**: Erstellt eine neue `.essay`-Datei mit leerem Template
2. **`essay_complete_part`**: Vervollständigt einen Essay-Teil über ragrun
3. **`essay_suggest`**: Füllt einen oder mehrere Parts mit vorgeschlagenen Inhalten vor

### Neue Essay-Datei erstellen

Verwende das Tool `essay_create`:

**Erforderliche Parameter:**
- `assistant`: Name des Assistenten (z.B. `philo-von-freisinn`)

**Optionale Parameter:**
- `essay_title` oder `topic`: Titel des Essays
- `essay_slug`: Custom Slug (wird sonst aus Titel generiert)
- `background`: Hintergrundtext für den Essay
- `created`: Datum im Format YYYY-MM-DD
- `modified`: Datum im Format YYYY-MM-DD
- `version`: Versionsnummer (Standard: "0.0.1")
- `overwrite`: Überschreibe existierende Datei (Standard: false)

**Beispiel:**
```
Erstelle einen neuen Essay mit dem Titel "Freiheit und Verantwortung" für philo-von-freisinn
```

→ Erstellt: `assistants/philo-von-freisinn/essays/freiheit-und-verantwortung.essay`

### Essay-Teile vervollständigen

### Cursor Rule

Die Cursor Rule in `.cursor/rules/essay-completion.md` definiert, wie Essay-Teile automatisch vervollständigt werden:

- **MCP-Server**: `user-ragprep-essay`
- **Tool**: `essay_complete_part`
- **Backend**: ruft `ragrun` API auf (`/api/v1/agent/{assistant}/graphs/essay-completion`)

### Essay-Template

Beim Erstellen wird ein Template aus `assistants/{assistant}/essays/essay-template.essay` geladen. Falls dieses nicht existiert, wird ein Standard-Template mit 7 leeren Parts erstellt (okkult, transzendental, mystisch, empirisch, voluntaristisch, logistisch, gnostisch).

### Verwendung: Essay-Teile vervollständigen

Wenn du in Cursor um die Vervollständigung eines Essay-Teils bittest, z.B.:

```
Bitte Ergänze okkult Teil in @ragkeep/assistants/philo-von-freisinn/essays/gedankenfehler-kinder-muessen-erzogen-werden.essay
```

wird automatisch das MCP-Tool aufgerufen mit:
- `assistant`: Extrahiert aus dem Pfad (z.B. `philo-von-freisinn`)
- `essay_slug`: Dateiname ohne `.essay`-Extension
- `mood_index`: 1-7 (okkult=1, transzendental=2, mystisch=3, empirisch=4, voluntaristisch=5, logistisch=6, gnostisch=7)
- `k`: Anzahl der Context-Chunks (Standard: 5)
- `verbose`: Detailliertes Logging (Standard: true)
- `force`: Erzwinge Neugenerierung (Standard: true)

### Workflow

1. **Draft-Generierung**: Erstellt einen ersten Entwurf basierend auf dem Essay-Thema, Background und der Seelenstimmung
2. **Authenticity-Check**: Prüft den Entwurf gegen den Steiner-Kontext aus den Primary Books
3. **Rewrite**: Überarbeitet den Text basierend auf dem Verifikationsbericht und dem vollständigen Kontext (Primary + Secondary Books)
4. **Header-Generierung**: Erstellt einen prägnanten Header für den finalen Text
5. **Datei-Update**: Schreibt Header und Text automatisch in die `.essay`-Datei zurück

### Wichtig

- **NIEMALS** die `.essay`-Datei direkt bearbeiten, wenn es um die Vervollständigung eines Parts geht
- **IMMER** das MCP-Tool verwenden, da es die vollständige Pipeline durchläuft (ragrun → LLM → Verifikation → Rewrite)
- Nur bei expliziter Anfrage zur direkten Textbearbeitung die Datei manuell bearbeiten

### Voraussetzungen

- `ragrun` API muss laufen (Standard: `http://localhost:8000/api/v1`)
- MCP-Server `user-ragprep-essay` muss in Cursor konfiguriert sein
- Die entsprechenden Prompt-Dateien müssen in `assistants/sigrid-von-gleich/prompts/essays/` vorhanden sein
