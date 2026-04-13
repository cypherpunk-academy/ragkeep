# Essays wieder in den Stack bringen — Referenz

Dieses Dokument beschreibt die **Essay-Pipeline** über **ragkeep**, **ragprep** und **ragrun**, damit sie nach einem Abbau oder in einer neuen Umgebung **wieder zusammengesetzt** werden kann. Es sind **keine vollständigen Quellen**, sondern **Orientierung, Pfade und typische Code-/CLI-Muster** (Fragmente).

Verwandt: `plans/ESSAYS_AUS_RAG_STACK_ENTFERNEN.md` (was abgebaut wird) — hier der **Gegenentwurf: alles wieder verbinden**.

---

## 1. Rolle der drei Repos

| Repo | Funktion für Essays |
|------|---------------------|
| **ragkeep** | Quelle der Wahrheit für `.essay`-Dateien, Essay-Prompts unter `assistants/…/prompts/essays/`, `essays:` im `assistant-manifest.yaml`, statische Site (Tabs, Detail-HTML), optional Soul-Moods (nur inhaltlich/Stil, nicht identisch mit Chunk-Pipeline). |
| **ragprep** | CLI und **MCP** zum Anlegen/Bearbeiten von `.essay`, Erzeugung von `essays.jsonl`, **Upload** zur Vektordatenbank via ragrun; verwendet feste UUIDv5-Namespace-IDs für Essay-Chunks. |
| **ragrun** | HTTP-APIs (**Graphs**) für Essay-Erstellung, -Teilgenerierung, Feintuning, Evaluation; liest Prompts und `.essay`-Pfade typischerweise **aus dem ragkeep-Arbeitsbaum** (konfigurierter `assistants`‑Pfad). |

---

## 2. ragkeep — Daten und Site

### 2.1 Manifest

Pro Assistent: `assistants/<assistant-id>/assistant-manifest.yaml` enthält eine Liste `essays:` mit Dateinamen (z. B. `thema-slug.essay`).

```yaml
# Fragment
essays:
  - beispiel-essay.essay
```

### 2.2 `.essay`-Datei (YAML)

Struktur grob: Metadaten (`topic`, `short_topic`, `background`), dann `parts` als Liste von Stimmungs-/Abschnittsblöcken mit Text und optional `references` (Verweise auf Primär-`chunk_id`s) sowie ggf. `chunk_id` pro Part.

```yaml
# Fragment — keine vollständige Schemaspezifikation
topic: "…"
short_topic: "…"
background: "…"
parts:
  - mood: "…"
    text: |
      …
    references:
      - chunk_id: "…"
        description: "…"
        relevance: 0.9
```

Template-Pfad (historisch): `assistants/philo-von-freisinn/essays/templates/essay-template.essay`.

### 2.3 Prompts für ragrun-Graphen

Unter anderem: `assistants/sigrid-von-gleich/prompts/essays/*.prompt` (z. B. Schreib- und Umschreib-Prompts, Header, Tune-Part).  
Zusätzlich z. B. `assistants/philo-von-freisinn/prompts/essays/*.prompt` für pitch/sonstige Varianten.

**Wichtig:** ragrun löst diese Pfade oft **relativ zu einem konfigurierten ragkeep-Root** auf — beim Deploy müssen ragrun und Pfad zum geklonten ragkeep zusammenpassen.

### 2.4 Generierte Artefakte (ragprep)

- `assistants/<assistant>/essays/chunks/essays.jsonl` — **eine** JSONL-Datei, alle Essay-Parts als Zeilen-Chunks.

### 2.5 Statische Site

Build-Einstieg u. a. `scripts/build_static_site.ts`; Essay-Logik in Modulen wie `scripts/static-site/essays.ts` sowie Einbindung in `pages.ts` (Tab „Essays“, Karten, Detailseiten).  
Build-Kommando (typisch): `npm run build:pages` aus `package.json` von ragkeep (ruft u. a. Registry- und Static-Site-Skripte auf).

---

## 3. ragprep — CLI, Chunking, Upload, MCP

### 3.1 CLI-Befehle (Namen)

- `essay:create` — leeres Gerüst `.essay` (Thema, Kurzthema, Hintergrund).
- `essay:chunk` — liest alle im Manifest gelisteten `.essay`-Dateien und schreibt `essays/chunks/essays.jsonl`.
- `essay:complete-part` / `essay:tune` — rufen ragrun-Endpunkte auf und schreiben zurück in die `.essay`-Datei.
- `essay:mcp` — startet den **stdio-MCP** mit denselben Operationen wie die CLI (für Cursor/IDE).

Registrierung: zentral im CLI-Einstieg (z. B. `src/cli/index.ts`); separates Binary z. B. `mcp-essay` über Bundler-Konfiguration.

### 3.2 Von YAML zu JSONL (Konzept)

Modulidee: `essayYamlToChunks` — pro nicht-leerem Part ein Roh-Chunk mit `chunk_type: essay` (bzw. Enum `ESSAY`), `source_id` nach Muster `assistant:<name>:essay:<short_topic>`, `chunk_id` als **UUIDv5** aus `(sourceId + Partindex)` und festem Namespace (Konstante z. B. `ESSAY_CHUNK_NAMESPACE_UUID` in `chunkId.ts`).

```ts
// Idee — keine vollständige Implementierung
// buildUuidV5(`${sourceId}:${index}`, ESSAY_CHUNK_NAMESPACE_UUID)
```

### 3.3 Upload

`rag:upload <assistant>` — berücksichtigt u. a. `essays/chunks/essays.jsonl`, validiert deterministische IDs, mappt `kind: 'essays'` auf Chunk-Typen **`essay`** und historisch auch **`essay_summary`** (je nach Codestand: `essay_summary` kann im Projekt als „nicht generiert“ markiert sein — bei Wiederherstellung README/Changelog im Repo prüfen).

---

## 4. ragrun — APIs und Abhängigkeit von ragkeep

### 4.1 Router

API-Paket bindet Router unter Präfix wie `/agent/philo-von-freisinn` ein; Endpunkte u. a.:

- `…/graphs/essay-completion`
- `…/graphs/essay-tune-part`
- weitere: `essay_create`, `essay_evaluation` (exakte Pfade in `app/retrieval/api/essay_*.py` und `api/__init__.py`).

### 4.2 Graph-Logik

Python-Module: `graphs/essay_completion.py`, `essay_finetune.py`, `essay_evaluation.py`, `essay_create.py` (Namen je nach Stand); Prompt-Zusammenbau in `prompts/essay_completion.py` / `essay_evaluation.py`.

**Kopplung:** Funktionen lesen `.essay` aus `assistants/<assistant>/essays/<slug>.essay` und Prompt-Dateien aus `…/prompts/essays/` — Pfade werden aus einem **Assistants-Root** abgeleitet, der ragkeep entspricht.

### 4.3 Retrieval / Chunk-Typen

`chunk_type`-Werte **`essay`** und **`essay_summary`** in gemeinsamen Modellen; Action-Prompt-Service expandiert bei Treffern auf `essay`/`talk` oft `references` zu Primärchunks. Intents und Action-YAML listen `essay` für bestimmte Absichten (z. B. Erklärung).

---

## 5. MCP (ragprep) — Werkzeuge

Servername typisch `ragprep-essay-mcp`. Tools (Namen):

- `essay_create`
- `essay_complete_part`
- `essay_tune_part`

Die Operationen rufen per HTTP die ragrun-URLs auf (Basis z. B. `RAGRUN_URL` oder in `essayOperations` konfiguriert); Payload enthält `assistant`, `essay_slug`, `mood_index`, ggf. Modifikationstext.

---

## 6. Typische Wiederherstellungs-Reihenfolge

1. **ragkeep:** `.essay`, Manifest `essays:`, Prompts unter `prompts/essays/`, Template liegen konsistent vor.
2. **ragrun:** Server starten; sicherstellen, dass der **Pfad zu ragkeep** (Assistants-Root) stimmt, sodass Graphen die `.prompt`- und `.essay`-Dateien finden.
3. **ragprep:** `essay:chunk <assistant>` erzeugt `essays.jsonl`; danach `rag:upload <assistant>` (ggf. mit Filter — siehe Upload-Doku).
4. **Optional:** Über MCP oder CLI `essay:complete-part` / `essay:tune` testen (braucht laufenden ragrun).
5. **ragkeep:** `npm run build:pages` für die statische Site.

---

## 7. Umgebungsvariablen (stichwortartig)

- ragprep → ragrun: Basis-URL für API (häufig `RAGRUN_URL` oder projektspezifisch in `essayOperations` / Config).
- ragrun → ragkeep: Pfad/Variable für das Verzeichnis, das `assistants/` enthält (Implementierung in Settings/Config von ragrun nachschlagen).

---

## 8. Chunk-Typen `essay` und `essay_summary`

- **`essay`:** reguläre Essay-Parts aus `.essay` / JSONL.
- **`essay_summary`:** im Schema vorhanden; in manchen Pipelines **nicht** erzeugt — beim Aufräumen kann explizit aus Upload/Retrieval genommen werden. Für eine **vollständige** Wiederherstellung: prüfen, ob euer Stand überhaupt Summary-Zeilen erzeugt; sonst nur `ESSAY` synchronisieren.

---

## 9. Was nicht in diesem Dokument steht

- Exakte OpenAPI-Pfadliste (aus ragrun Router auslesen).
- Vollständige JSON-Schemas für Metadatenfelder.
- Produktions-Docker/CI — nur die logische Kette **Inhalt → Chunk → Upload → API → Site**.

Bei Unklarheiten: im gleichen Commit-Stand die genannten Dateipfade in ragkeep/ragprep/ragrun öffnen und die **Importkette** vom CLI/MCP bis zum HTTP-Client nachverfolgen.

---

*Referenzdokument zur Rekonstruktion; kein Ersatz für die jeweils gültige Implementierung im Code.*
