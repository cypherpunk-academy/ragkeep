# Plan: Essays aus ragkeep, ragprep und ragrun entfernen und als Information bündeln

Dieses Dokument beschreibt, was eine vollständige **Entkopplung des Essay-Features** aus den drei Repositories bedeuten würde, und welche **Inhalte separat gesichert** werden sollten (Quelltexte, Prompts, Konventionen), bevor Code und Konfigurationen entfernt oder vereinfacht werden.

---

## 1. Zielbild

- **Technisch:** Keine produktive Essay-Pipeline mehr in den RAG-Repos: keine `.essay`-Artefakte im **Static-Site-Build** und **kein Essay-Upload** zur Vektordatenbank; keine Nutzung der Chunk-Typen **`essay`** und **`essay_summary`** in Upload, Sync und Retrieval (Intent-Listen, Action-Manifests, CLI-Filter). **Ausnahme / bewusst behalten:** der **Essay-MCP** und zugehöriger ragprep-Code (`essay:mcp`, CLI `essay:*`, Chunker-Utils) werden **nicht** aus ragprep gelöscht — sie bleiben als wieder verwendbare Basis; nur die Integration in den „Live“-Stack (Site, DB, ragrun-Endpunkte je nach Aufräum-Umfang) entfällt oder wird zurückgebaut.
- **Inhaltlich:** Alle bisherigen Essay-Assets (YAML-Dateien, Prompts, Mood-/Planet-Struktur, Referenzen auf Primärchunks) werden **an einem Ort dokumentiert oder archiviert** (z. B. separates Repo, `knowledge_base`, oder ein reines Content-Archiv), damit nichts Wissenswertes verloren geht.

---

## 2. ragkeep — betroffene Bereiche

### 2.1 Assistenten-Inhalt (zu archivieren, nicht „einfach löschen“)

| Bereich | Pfad / Muster | Inhalt |
|--------|-----------------|--------|
| Essay-Quellen | `assistants/*/essays/**/*.essay` | YAML-Struktur: `topic`, `short_topic`, `background`, `parts[]` mit Texten, `chunk_id`, `references` |
| Template | `assistants/philo-von-freisinn/essays/templates/essay-template.essay` | Vorlage für neue Essays |
| Manifest | `assistants/*/assistant-manifest.yaml` → Schlüssel `essays:` | Liste der eingetragenen `.essay`-Dateien |
| RAG-Chunks (generiert) | `assistants/*/essays/chunks/essays.jsonl` | Aggregierte JSONL für Vector-Upload |
| Statische Site (generiert) | `site/agent/*/essays.html`, `site/agent/*/essays/*.html` | Ausgabe des Static-Site-Builds |
| Prompts (Essay-Pipeline) | `assistants/sigrid-von-gleich/prompts/essays/*.prompt` | u. a. `essay_write`, `essay_write_supplement`, `essay_header`, `essay_rewrite_from_draft`, `essay_tune_part`, … |
| Prompts (Philo) | `assistants/philo-von-freisinn/prompts/essays/*.prompt` | z. B. `essay_pitch.prompt` |

**Hinweis:** In `sigrid-von-gleich/soul-moods/…/instruction.md` steht textlich „Essay-Schreiber“ — das ist **Stil-/Rollenbeschreibung**, nicht dieselbe technische Essay-Pipeline. Beim Aufräumen klären, ob das nur umbenannt oder beibehalten wird.

### 2.2 Build & Konfiguration (Code, der wegfällt oder schrumpft)

- **`scripts/build_static_site.ts`** — Import und Nutzung von `collectEssays`, `generateEssayPages`, Chunk-Sammlung für Essay-Referenzen.
- **`scripts/static-site/essays.ts`** — gesamtes Modul kann entfallen, wenn keine Essay-Seiten mehr gebaut werden.
- **`scripts/static-site/pages.ts`** — Tab/Section `essays`, `SECTION_META.essays`, `renderEssayRows`, Parameter `essaysByAgent` durch die Seiten-API.
- **`scripts/static-site/assistants.ts`** — Feld `essays` in Typen und Manifest-Merge; `essays` in `foldersToCopy`.
- **`scripts/static-site/types.ts`** — `essays: string[]` am Agent-Modell.
- **`scripts/static-site/assets.ts`** — CSS-Klassen `.essay-card`, `.essay-summary-details`, …
- **`scripts/build_agent_registry.ts`** — `essays` im Registry-Output, falls noch benötigt.
- **`.vscode/settings.json`** — Zuordnung `*.essay` → YAML-Sprache (optional entfernen).

### 2.3 Abhängigkeiten / Dokumentation im Repo

- Pläne wie `plans/UNIFIED_STATIC_HTML_SITE.md`, `plans/REACT_APP_AGENT_REGISTRY.md` erwähnen Essays — **nachziehen oder veralten lassen**.
- Sonstige `.cursor/plans` mit Essay-Bezug (z. B. Chunk-Links für Essays).

---

## 3. ragprep — betroffene Bereiche

### 3.1 Zu archivierende „Wissen“-Artefakte (vor Löschen von produktiven Pfaden exportieren)

- **MCP Essay-Server (Code bleibt im Repo):** `essayMcpServer.ts`, `essayOperations.ts`, `essayTemplateStore.ts` — Tooling (`essay_create`, `essay_complete_part`, `essay_tune_part`). **Nicht löschen**; bei Wiederinbetriebnahme siehe `plans/ADDING_ESSAYS_THE_STACK.md`.
- **CLI (Code bleibt):** `essay:create`, `essay:chunk`, `essay:complete-part`, `essay:tune`, `essay:mcp`; `src/cli/index.ts`, `src/bin/mcp-essay.ts`, `tsup`‑Eintrag `bin/mcp-essay`.
- **Chunk-Pipeline:** `essayYamlToChunks.ts` — `.essay` → `essays.jsonl`, `source_id`‑Muster `assistant:…:essay:…`, UUIDv5 `ESSAY_CHUNK_NAMESPACE_UUID` in `chunkId.ts`.
- **Upload (produktiv zurückbauen):** `ragUpload` — `kind: 'essays'`, `ChunkType.ESSAY` **und** **`ESSAY_SUMMARY`** wo referenziert, Sync `essays/chunks/essays.jsonl`.
- **Typen (Stack bereinigen):** `ragSchemas.ts` — **`ESSAY`** und **`ESSAY_SUMMARY`** aus produktiven Pfaden; `fileSchemas` (`essays`, Essay-Manifest-Typen), `FileService` — je nachdem ob Manifest-Feld `essays:` in ragkeep entfällt.
- **Migration:** `migrate-anchor-chunk-ids.ts` — Phase `.essay` / `essays.jsonl` (historisch).

### 3.2 Cursor / IDE

- MCP-Deskriptor **`user-ragprep-essay`** kann **aktiv bleiben**, solange der Essay-MCP im Build enthalten ist. Nur anpassen, wenn Binary oder Pfad sich ändern — **nicht** als „MCP entfernen“ interpretieren.

---

## 4. ragrun — betroffene Bereiche

### 4.1 API & Graphen (Endpunkte unter `…/agent/philo-von-freisinn/…`)

- Router-Einbindung in `app/retrieval/api/__init__.py`: `essay_create`, `essay_completion`, `essay_tune_part`, `essay_evaluation`.
- Zugehörige Module: `app/retrieval/api/essay_*.py`, Services, `app/retrieval/graphs/essay_*.py`, `app/retrieval/chains/essay_*.py`, `app/retrieval/prompts/essay_*.py`.
- **`essay_completion.py` (Graph)** liest Metadaten aus **ragkeep**: `assistants/<assistant>/essays/<slug>.essay` und Prompts aus **`assistants/sigrid-von-gleich/prompts/essays/`** (Pfadauflösung `_resolve_sigrid_essay_prompts_dir`). Das ist eine **harte Kopplung an das ragkeep-Working-Copy** beim Server-Start.

### 4.2 Retrieval & Chunk-Typen

- **`app/shared/models.py`** — erlaubte `chunk_type`-Werte inkl. **`essay`** und **`essay_summary`** (beide aus dem produktiven Stack entfernen, sofern beschlossen).
- **`app/api/action_prompt.py`** / **`app/retrieval/services/action_prompt_service.py`** — spezielle Behandlung von `essay`/`talk` (Expansion über `references` zu Primärchunks).
- **`app/retrieval/graphs/intents.py`**, **`problem_solver_graph.py`**, **Action-Manifests** (`general-question`, `socratic-dialog`, …) — Listen, die `essay` enthalten.
- **`cli/commands/chunks_delete.py`**, **`cli/__main__.py`** — Nutzeroptionen für Chunk-Typ `essay`.

### 4.3 Sonstiges

- Tests: z. B. `tests/test_essay_completion_previous_parts.py`.
- **`app/retrieval/actions/summarize/prompt.prompt`** — erwähnt „Essay-Titelvorschläge“ / Essay-`background` (nicht nur Chunk-Typ `essay`).

---

## 5. Was „als Information sammeln“ konkret heißt

Vor dem Entfernen empfiehlt sich ein **Export-Paket** (Ordner oder kleines Archiv-Repo), das mindestens enthält:

1. **Alle `.essay`-Dateien** und das Template, mit Manifest-Auszug (`essays:`-Liste pro Assistent).
2. **Alle Prompt-Dateien** unter `…/prompts/essays/` (sigrid + philo).
3. **Kurzdokumentation** der Pipeline: UUIDv5-Regel, `source_id`-Format, JSONL-Spalten/Metadaten für `essay`-Chunks, ragrun-Endpunkt-URLs (historisch), CLI-Befehle (historisch).
4. Optional: **letzter Stand** von `essays.jsonl` oder ein Hinweis, dass diese Datei **reproduzierbar** aus `.essay` via ehemaligem `essay:chunk` entstand.
5. **Soul-Moods / Stil** nur, falls inhaltlich zu den Essay-Prompts gehörig (siehe `soul-moods` vs. technische Essay-Pipeline).

Details zur **Ordnerstruktur** und **Abhakliste** siehe [Abschnitt 9](#9-archiv-layout-ordnerstruktur--checkliste).

---

## 6. Reihenfolge und Risiken

| Phase | Aktion | Risiko |
|-------|--------|--------|
| A | Export/Archiv der Inhalte (Abschnitt 5) | Ohne Export gehen Prompt-Iterationen und Essay-Texte aus dem Git-Kontext verloren. |
| B | ragrun: Endpunkte entfernen oder deprecaten; Chunk-Typen und Intent-Listen bereinigen; Tests anpassen | Laufende Clients (MCP, Skripte), die noch `essay-completion` aufrufen, brechen. |
| C | ragprep: **`rag:upload`** ohne Essay-/`essay_summary`-Pfad; Typen/Validierung bereinigen; **MCP/CLI-Code zu Essays beibehalten** | Upload-Pipelines anpassen; MCP bleibt im Repo, braucht ggf. wieder laufenden ragrun für `complete`/`tune`. |
| D | ragkeep: Static-Site und Manifest-Felder bereinigen; ggf. `essays`-Ordner nur noch als Archiv-Kopie oder löschen | Build bricht, solange noch Referenzen auf `essays` existieren — **einheitlicher PR** pro Repo oder klar getrennte Schritte. |
| E | Vektordatenbank / Collections | Bereits hochgeladene **`essay`**- und ggf. **`essay_summary`**-Chunks bleiben in der DB, bis sie gelöscht oder Collections neu aufgebaut werden; separater Aufräum-Schritt. |

---

## 7. Geschätzter Umfang (Größenordnung)

- **ragkeep:** Eine mittlere Refaktorierung des Static-Site-Generators (mehrere TS-Dateien + generierte `site/`); Inhaltsverschiebung aus `assistants/…/essays` und `prompts/essays`.
- **ragprep:** Entkopplung von **Upload/Sync** und Typen; **kein** vollständiges Entfernen des Essay-MCP/CLI — Umfang kleiner als ursprünglich angenommen, wenn Code erhalten bleibt.
- **ragrun:** Viele Python-Module, aber klar entlang der `essay_*`-Dateien und Typ-Listen; Retrieval-Logik (`action_prompt`) braucht sorgfältige Anpassung, wenn `essay` komplett verschwindet.

---

## 8. Offene Entscheidungen

- ~~**`essay_summary`:**~~ **Entschieden:** wird aus dem Stack **mit entfernt** (keine produktive Verwendung mehr; konsistent zu `essay`).
- Soll die **Summarize-Action** in ragrun weiter „Essay“ im Sinne von Titelvorschlägen erwähnen, oder neutral umbenannt werden? (Betrifft Wortlaut in Prompts, nicht zwingend Chunk-Typen.)
- Soll ein **read-only Archiv-Ordner** in ragkeep verbleiben (nur Dokumentation, kein Build), oder alles in ein anderes Repo verschoben werden?

---

## 9. Archiv-Layout (Ordnerstruktur + Checkliste)

Ziel: Ein **einziges Wurzelverzeichnis** (Git-Repo, Tarball oder Unterordner in `knowledge_base`), das ohne die RAG-Repos noch verständlich ist. Name beispielhaft `essay-pipeline-archive/` — anpassbar.

### 9.1 Vorgeschlagene Struktur

```text
essay-pipeline-archive/
├── README.md
├── META/
│   ├── provenance.md          # Datum, Autor, Git-Revisions (ragkeep / ragprep / ragrun), Zweck
│   ├── manifest-snapshots.yaml # pro Assistant: essays:-Liste aus assistant-manifest.yaml
│   └── pipeline.md            # technische Kurzreferenz (siehe Checkliste „Inhalt“)
├── content/
│   ├── essays/                # Spiegel unter assistants/…/essays/ ODER flach nach assistant
│   │   ├── philo-von-freisinn/
│   │   │   ├── *.essay
│   │   │   └── templates/
│   │   │       └── essay-template.essay
│   │   └── …/
│   ├── prompts-sigrid/
│   │   └── …                  # Inhalt von assistants/sigrid-von-gleich/prompts/essays/
│   └── prompts-philo/
│       └── …                  # Inhalt von assistants/philo-von-freisinn/prompts/essays/
├── optional/
│   ├── soul-moods/            # nur wenn inhaltlich gewünscht (z. B. 1_okkult/instruction.md)
│   └── generated/
│       └── essays.jsonl/      # optional: letzte Snapshots pro Assistant (essays.jsonl)
└── tools-legacy/              # optional: Kopien der relevanten ragprep/ragrun README-Auszüge
    └── cli-and-endpoints.md   # historische Befehle + URL-Pfade (kein lauffähiger Code nötig)
```

**Minimalvariante:** `README.md` + `META/pipeline.md` + `content/essays/` + beide `prompts-*`-Ordner reichen, um nichts Wesentliches zu verlieren.

### 9.2 Checkliste vor dem Löschen im Code

**Inhalt**

- [ ] Alle `*.essay` aus `ragkeep/assistants/*/essays/` kopiert (inkl. `templates/`).
- [ ] `essays:`-Abschnitte aus jedem `assistant-manifest.yaml` in `META/manifest-snapshots.yaml` übernommen (oder Originaldateien mitkopiert).
- [ ] `assistants/sigrid-von-gleich/prompts/essays/*.prompt` vollständig.
- [ ] `assistants/philo-von-freisinn/prompts/essays/*.prompt` vollständig.
- [ ] `META/pipeline.md` befüllt mit: UUIDv5-Namespace-Name (Essay), Muster `source_id`, Pfad zu `essays.jsonl`, grobe Skizze der ragrun-POST-Pfade und ragprep-CLI-Namen (aus diesem Plan oder aus dem Code zum Ablesen).
- [ ] Optional: `essays/chunks/essays.jsonl` pro Assistant; optional: `*.essay.summary` falls vorhanden.

**Organisatorisch**

- [ ] `README.md` im Archiv: wofür das Paket da ist und dass es **keinen** automatischen Build mehr hat.
- [ ] Verweis in den drei Repos (ein Satz in den jeweiligen README oder in `plans/`) auf den Archiv-Standort — damit später niemand die Historie sucht.

**Nach dem Archiv**

- [ ] Cursor: MCP `user-ragprep-essay` nur anpassen, falls sich Binary/Pfad ändert — **Essay-MCP absichtlich nicht löschen** (siehe Abschnitt 1).
- [ ] Vektordb: bewusste Entscheidung zu Alt-`essay`- und `essay_summary`-Chunks (löschen / ignorieren / Rebuild).

---

## 10. Deprecation (schrittweise Abschaltung)

Damit nichts „über Nacht“ bricht, lässt sich die Entfernung in **Klient zuerst, Server danach, Daten zuletzt** gliedern.

### 10.1 Phase 0 — Stillstand herstellen

- Keine neuen Essays in produktiven Pipelines starten; optional kurze **Team-Notiz**: Essay-**Site**/**DB**-Pfad wird abgebaut; **Essay-MCP-Code** in ragprep bleibt erhalten.
- **Archiv nach Abschnitt 9** anlegen und committen bzw. an einen festen Ort legen.

### 10.2 Phase 1 — Aufrufer abstellen

- **Cursor / lokale Skripte:** MCP-Essay-Tools und manuelle `curl`-Aufrufe auf ragrun `…/graphs/essay-*` beenden.
- **CI / Cron:** prüfen, ob `essay:chunk` oder `essay:complete-part` noch laufen.

### 10.3 Phase 2 — API „weich“ abschalten (optional, nur wenn Übergang nötig)

- ragrun: Essay-Routen zunächst mit **HTTP 410 Gone** oder **503** + klare JSON-`detail`-Meldung antworten statt sofort zu löschen; oder kurz **Deprecation-Header** (`Deprecation`, `Sunset`) setzen, falls der Stack das unterstützt.
- Monitoring: einmalige Prüfung, ob noch Traffic auf diese Routen geht.

### 10.4 Phase 3 — Code und Konfiguration entfernen (Reihenfolge wie Abschnitt 6)

1. **ragrun:** Router, Graphen, Chains, Tests, Intent-Listen bereinigen; `action_prompt`-Zweig für `essay` nur entfernen, wenn kein Chunk mehr diesen Typ hat.
2. **ragprep:** Upload-Pfad und Typen (`essay`, `essay_summary`) — **MCP/CLI-Dateien nicht löschen**, sofern nicht ausdrücklich anders beschlossen.
3. **ragkeep:** Static-Site, Manifest-Felder, ggf. Inhaltsordner verschieben oder löschen.

### 10.5 Phase 4 — Daten

- Vektordatenbank: gezieltes Löschen oder Re-Sync ohne Essay-Quellen (Abschnitt 6, Phase E).

### 10.6 Kurzform

| Schritt | Was |
|--------|-----|
| Archiv | Abschnitt 9 |
| Clients aus | MCP, Skripte, CI |
| API | entfernen oder vorher deprecaten |
| Upload / Build | ragprep + ragkeep |
| DB | Aufräumen |

---

*Stand: Planungsdokument, keine implementierten Änderungen. Essay-MCP bleibt in ragprep vorgesehen; `essay_summary` wird mit aus dem produktiven Stack genommen. Wiedereinrichtung: siehe `plans/ADDING_ESSAYS_THE_STACK.md`.*
