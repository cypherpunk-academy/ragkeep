# Analyse: Umbenennung Philo von Freisinn → Filo von Freisinn

Stand: **2026-07-17** (Codebase-Scan über ragkeep, ragprep, ragrun, ragapp, ragfb)

## Ziel

| Ebene | Alt | Neu |
|--------|-----|-----|
| Anzeigename | Philo von Freisinn | Filo von Freisinn |
| Kurzname | Philo | Filo |
| Slug / Verzeichnis / `rag-collection` | `philo-von-freisinn` | `filo-von-freisinn` |

Diese Analyse listet **alle betroffenen Schichten**, Abhängigkeiten und empfohlene Migrationsreihenfolge — inklusive Datenbanken (Postgres, Qdrant) und externer Clients.

---

## 1. Kern-Identifier (was ändert sich, was kann bleiben)

### 1.1 Primäre Schlüssel der Persona

| Identifier | Aktuell | Empfehlung nach Rename |
|------------|---------|-------------------------|
| Assistenten-Ordner | `ragkeep/assistants/philo-von-freisinn/` | `ragkeep/assistants/filo-von-freisinn/` |
| `assistant-manifest.yaml` → `name` | Philo von Freisinn | Filo von Freisinn |
| `assistant-manifest.yaml` → `rag-collection` | philo-von-freisinn | filo-von-freisinn |
| `assistant-manifest.yaml` → `assistant-id` | `1e3d0f4f-8e71-4f78-8f46-b1d31e607a1c` | **UUID beibehalten** (stabile Referenz, keine DB-Pflicht zur Änderung) |
| Postgres `rag_chunks.rag_partition` | philo-von-freisinn | filo-von-freisinn |
| Qdrant Collection-Name | philo-von-freisinn (Prod laut ragapp-Plan ~37k Punkte) | filo-von-freisinn (siehe Abschnitt 6) |
| Benchmark-Test-Collections | `philo-von-freisinn-test-e5`, `-bge`, `-cross`, … | analog `filo-von-freisinn-test-*` |

`rag-collection` im Manifest ist die **Single Source of Truth** für ragprep (`resolveRagCollectionForPush`), ragrun Ingestion/Embed und CLI-Defaults.

### 1.2 Kurzalias `philo` / `filo`

Mehrere Stellen nutzen **Präfix-Auflösung** (eindeutiger Ordnername unter `assistants/`):

- ragrun `cli/commands/chunks_info.py` und `chunks_delete.py`: `philo` → `philo-von-freisinn`
- ragprep `resolveRagCollectionForPush`: Kurzname, wenn eindeutig

Nach Umbenennung: Kurzalias wird **`filo`** (nicht mehr `philo`). Alte CLI-Aufrufe mit `philo` brechen, sofern kein Kompatibilitäts-Alias eingebaut wird.

### 1.3 API-Pfade (Breaking Change)

ragrun mountet Retrieval-Router fest unter:

- `/api/v1/agent/philo-von-freisinn/...` (`app/retrieval/api/__init__.py`)

Clients (ragapp, Docs, Pläne) referenzieren diese Pfade. Umbenennung erfordert entweder:

- **harte Umstellung** aller Clients + Deprecation der alten Pfade, oder
- **Übergangsphase**: neue Pfade `filo-von-freisinn` + Proxy/Redirect von `philo-von-freisinn` (mindestens 1 Release).

### 1.4 Feld `personality` vs. Collection-Slug

In ragrun (`app/api/app_api.py`, `rag_talks.personality`, Tests mit `personality="philo"`) ist `personality` **nicht identisch** mit `rag-collection`. Vor Go-Live klären:

- Welche Werte senden ragapp / ragfb / Facebook-Bridge heute?
- Sollen `personality`, `collection` in `rag_talks` und App-Requests **mit dem neuen Slug** synchronisiert werden?

---

## 2. Umfang im Repository (Grobschätzung)

| Repo | Dateien mit Treffer (philo-von-freisinn / Philo von Freisinn) | Anmerkung |
|------|------------------------------------------------------------------|-----------|
| **ragkeep** | ~68 | inkl. Assistentenbaum, Talks, JSONL, Pläne, Skripte |
| **ragprep** | ~57 | viele CLI-Defaults, Shell-Skripte, Tests |
| **ragrun** | ~39 | Config, API, Prompt-Loader, UI-Sidebar, Pläne |
| **ragapp** | ~8 | gebündelter Assistant, Search, Supabase-Migrations-Kommentare |
| **ragfb** | 1 Plan | Facebook-Bridge mit fester Persona |

Zusätzlich in ragkeep unter `assistants/philo-von-freisinn/**/*.jsonl`: **~395** Vorkommen von `philo-von-freisinn` (Metadaten, `author`, `source_id`-Präfixe).

**Nicht umbenennen (False Positives):** Steiner-Vortragstitel „Philon von Alexandrien“, „Philosophie …“, `philosophical_768` (Chroma-Legacy), `philosophie-der-freiheit` als Buch-Slug, Wörter wie „Philosoph“ in Prompts.

---

## 3. ragkeep — Inhalt & Dateisystem

### 3.1 Verzeichnis & Manifest

1. `git mv assistants/philo-von-freisinn assistants/filo-von-freisinn`
2. `assistant-manifest.yaml` anpassen: `name`, `description`, `writing-style`, `rag-collection`, `test-collection`-Namen
3. Prompts: `prompts/instruction.md`, `instruction.prompt` (Persona-Text „Philo“ → „Filo“)

### 3.2 Chunk-Caches & Augmentierungen (vor erneutem store-chunks / embed)

| Pfad | Typische Felder mit altem Namen |
|------|----------------------------------|
| `concepts/chunks/concepts.jsonl` | Texte mit „Philo von Freisinn“ in Erklärungen; ggf. Metadaten |
| `typologies/chunks/typologies.jsonl` | Collection-Bezug |
| `essays/chunks/essays.jsonl` | Autor / Assistent |
| `talks/chunks/talks.jsonl` | `author: philo-von-freisinn`, `source_id: assistant:philo-von-freisinn:talk:…` |
| `summaries/chapters.jsonl` | Attribution in Karten-Metadaten |
| `quotes/quotes.jsonl` | Chat-Quotes mit Persona-Bezug |

Nach Rename: **JSONL neu schreiben oder batch-ersetzen**, dann `rag:chunk` / `store-chunks` / `rag:embed` für betroffene Typen.

### 3.3 Talks & Produkte (Markdown)

- Talk-Frontmatter: `collection`, `Persönlichkeit`, Rollenprefix `**philo-von-freisinn:**` in exportierten Dialogen
- `products/Doppelmatrix …/content/fields.yaml` → `author: Philo von Freisinn`
- Gespeicherte Chat-Exports unter `talks/` (viele historische `**philo-von-freisinn:**`-Zeilen)

Entscheidung: Historische Talks **inhaltlich migrieren** (Lesbarkeit) vs. nur Metadaten — für RAG relevant sind vor allem **chunks/talks.jsonl** und DB-Talks.

### 3.4 Vortrags-Quote-Caches

Unter `lectures/chunks/quotes/*.quotes.jsonl` kommt **„Philo von Freisinn erklärt:“** in `quote_explanation`-Texten vor (Augmentierungsstil). Das ist **Persona-Sprache**, kein Partition-Slug — bei Rename auf „Filo von Freisinn“ anpassen, wenn Quote-Erklärungen neu eingespielt werden sollen.

### 3.5 Skripte & Benennung

Dateinamen mit `philo` im Namen (optional umbenennen für Klarheit):

- `scripts/chunk-philo-all.sh`
- `scripts/annotate-philo-page-refs.sh`
- `scripts/rechunk-philo-lectures.sh`
- `scripts/augment-philo-lecture-summaries.sh`
- `scripts/generate_philo_book_cover_svgs.ts`
- `scripts/audit-philo-manifest-gaps.ts` (ragprep)

Inhaltlich: alle `--assistant philo-von-freisinn` und Pfade auf `filo-von-freisinn` stellen.

### 3.6 Dokumentation

README, CHANGELOG, `plans/*`, `administration/plans/*`, `reports/chunk-status.md`, Embedder-Benchmarks — Referenzen aktualisieren.

---

## 4. ragprep — CLI, Skripte, Tests

### 4.1 Harte Defaults (`philo-von-freisinn`)

Betroffen u. a.:

- `ragAugment/*` (summaries, quotes, concepts, typologies): Default `--assistant`
- `ragMetadataUpdate`, `ragChunkStatus`, `ragChat`, `talkStatus`, `talkChunk`
- `sanitizeSummaryAttribution` / `augmentSummaries`: Regeln **„Nicht Philo von Freisinn“** in Zusammenfassungen → Wortlaut auf **Filo** umstellen
- `fix-summary-card-metadata.ts`: Vergleich `authorRaw === 'philo-von-freisinn'`
- `push-summary-metadata-from-jsonl.ts`: `RAG_PARTITION`
- `scripts/chunk-philo-von-freisinn.sh` und `scripts/supabase/chunk-philo-von-freisinn-*.sh` (Dateiname + `ASSISTANT=`)

### 4.2 Tests

~10+ Testdateien mit erwarteten Strings `philo-von-freisinn` / Remediation-Hints — synchron anpassen.

### 4.3 Ablauf nach Code-Änderung

Typische Kette bleibt gleich, nur Assistenten-Slug:

```bash
yarn rp rag:chunk … --assistant filo-von-freisinn
yarn rp rag:embed filo-von-freisinn
```

---

## 5. ragrun — Backend, UI, Ops

### 5.1 Konfiguration

- `app/config.py` → `app_default_assistant_slug`
- `env.example` → `RAGRUN_APP_DEFAULT_ASSISTANT_SLUG`
- Deployment-`.env` auf Railway/lokal

### 5.2 Prompt-Loader & Pfade

- `app/retrieval/prompts/philo_von_freisinn.py` → sinnvoll: **Datei umbenennen** nach `filo_von_freisinn.py` und Pfad `assistants/filo-von-freisinn/...`
- `authentic_concept_explain.py` → `_resolve_philo_assistant_dir()` hardcoded
- `assistant_chat_graph.py` importiert Philo-Prompt

### 5.3 Services & API

Defaults in u. a.:

- `app/api/rag.py` (assistant-Parameter)
- `app/services/app_search_service.py` (Synonyme „philo von freisinn“)
- `quote_explain_service.py`, `typology_explain.py`, `authentic_concept_explain.py`
- `scripts/backfill_quote_paragraph.py` → `DEFAULT_PARTITION`

### 5.4 UI

- `ui/components/sidebar.tsx` — Assistenten-Dropdown

### 5.5 Ops-Skripte

- `scripts/token_audit.py` (Beispiele mit `philo-von-freisinn-v2` — Legacy-Hinweis in Doku)

---

## 6. Datenbanken & Vektorspeicher

### 6.1 Postgres (ragrun) — Schema-relevante Tabellen

**Primärschlüssel-Logik:** `rag_chunks` PK = `(rag_partition, chunk_id)`. Ein reines `UPDATE rag_partition` ist möglich, muss aber **konsistent** mit `rag_chunk_paragraphs` und Embed-Status erfolgen.

| Tabelle / Spalte | Inhalt | Migration |
|------------------|--------|-----------|
| `rag_chunks.rag_partition` | philo-von-freisinn | `UPDATE … SET rag_partition = 'filo-von-freisinn' WHERE rag_partition = 'philo-von-freisinn'` |
| `rag_chunk_paragraphs.rag_partition` | FK-Teil des PK | gleiches UPDATE |
| `rag_talks.collection` | Gesprächs-Sammlung | UPDATE auf neuen Slug |
| `rag_talks.personality` | optional, historische Werte prüfen | SELECT DISTINCT, dann UPDATE falls nötig |
| `rag_turns.assistant_personality` | optional | dito |
| `rag_usage` / `event_content` / Logs | ggf. `thread_id`, Metadaten JSON | Stichprobe: enthält Slug in JSON? |

**`__shared__`:** Buchkörper bleiben in `rag_partition = '__shared__'` — **nicht** umbenennen. Whitelist-Embed für Assistent bezieht sich auf `source_id`, nicht auf den alten Namen.

**Metadaten in `rag_chunks.metadata` (JSONB):** Prüfen auf eingebettete Strings:

```sql
SELECT COUNT(*) FROM rag_chunks
WHERE rag_partition = 'philo-von-freisinn'
  AND metadata::text ILIKE '%philo%';
```

Felder wie `author`, `collection` in JSON sollten mit Code/Manifest konsistent sein.

**Empfohlene Reihenfolge DB:**

1. Wartungsfenster / Embed-Jobs stoppen  
2. Backup  
3. `rag_chunks` + `rag_chunk_paragraphs` UPDATE  
4. `rag_talks` / `rag_turns` UPDATE  
5. Verifikation (Counts, Stichproben)  
6. Qdrant-Migration (Abschnitt 6.2)  
7. `rag:embed filo-von-freisinn` oder Collection-Rename in Qdrant  

### 6.2 Qdrant

Collection-Name entspricht in der Regel **`rag-collection`** aus dem Manifest (ragapp-Gesamtplan: Prod `philo-von-freisinn`, Legacy `philo-von-freisinn-v2` gelöscht).

**Option A — Neue Collection + Re-Embed (sicher, teuer):**

- Collection `filo-von-freisinn` anlegen  
- `embed-chunks` aus Postgres nachziehen  
- Alte Collection löschen, wenn Monitoring grün  

**Option B — Qdrant Collection Alias / Rename (schnell, wenn API es unterstützt):**

- Nur wenn Punkt-IDs und Payload unverändert bleiben; Partition-Filter in Payload prüfen (`collection`, `rag_partition` in Payload falls gesetzt)

**Option C — Dual-Write-Übergang:**

- Beide Collections kurz parallel; Clients auf neuen Namen; alte Collection deprecaten  

Nach Migration: `chunks:info filo` / Monitoring-Endpoint verifizieren.

### 6.3 Supabase (ragapp)

Kein separater „Philo“-Tabellenname; Treffer in:

- `supabase/migrations/008_is_primary_sync.sql`, `009_sort_order.sql` (Kommentare zu philo-von-freisinn-Manifest)
- App-Code: `src/shared/lib/assistant.ts`, `SearchScreen.tsx` (`RAGRUN_COLLECTION`, Mock-`source_id`)

Supabase **Quellen/Bücher** sind Buch-UUIDs — **nicht** der Assistenten-Slug. Nur App-Konstanten und ggf. RPC-Payloads mit `collection` prüfen.

### 6.4 Lokale SQLite (ragapp offline)

`assets/seed/db-snapshot.json` und Migrations — nur falls Assistenten-Slug in lokalen Tabellen gespeichert (Search-Mocks); nach Code-Änderung Seed neu erzeugen falls nötig.

---

## 7. Weitere Repos

| Repo | Maßnahme |
|------|----------|
| **ragapp** | `assistant.ts`, Search, `searchHitCard.ts` (Synonym-Filter), Figma-Inventar, Gesamtplan |
| **ragfb** | `plans/facebook-philo-von-freisinn-gesamtplan.md` + Runtime `assistant=philo-von-freisinn` |
| **ragrun-personalities** | Kein direkter Slug-Treffer; Prompts mit „Philosophen“ unverändert |

---

## 8. Inhaltliche Sonderfälle

### 8.1 Zusammenfassungen (Summaries)

Pipeline verbietet ausdrücklich „Philo von Freisinn“ als Autor in Kapitel-Summaries (Steiner-Texte). Regeln in `augmentSummaries` und Tests auf **Filo** umstellen — Semantik gleich.

### 8.2 Quote-Erklärungen mit Persona-Stimme

Lokale `*.quotes.jsonl` und DB-Texte mit „Philo von Freisinn erklärt“: inhaltliche Änderung, nur relevant wenn Qualität/Branding einheitlich sein soll.

### 8.3 Talk-`source_id`-Schema

Muster: `assistant:philo-von-freisinn:talk:<slug>` — **breaking** für Bookmarks/Links, die `source_id` parsen. Entweder:

- alle Talk-`source_id` migrieren + DB, oder  
- Parser akzeptieren beide Präfixe übergangsweise.

### 8.4 `assistant-id` UUID

Kann unverändert bleiben. Nur bei externen Systemen, die den **Anzeigenamen** aus UUID ableiten, Manifest-Sync sicherstellen.

---

## 9. Empfohlene Migrationsphasen

```mermaid
flowchart LR
  A[Phase 0: Entscheidungen] --> B[Phase 1: ragkeep Ordner + Manifest]
  B --> C[Phase 2: Code repos + Tests]
  C --> D[Phase 3: JSONL / Markdown Inhalt]
  D --> E[Phase 4: Postgres UPDATE]
  E --> F[Phase 5: Qdrant]
  F --> G[Phase 6: Clients ragapp ragfb]
  G --> H[Phase 7: Alte Aliase entfernen]
```

| Phase | Inhalt | Risiko |
|-------|--------|--------|
| 0 | API-Alias ja/nein; personality-Feld; historische Talks | Architektur |
| 1 | ragkeep rename + Manifest | Git history, große diffs |
| 2 | ragprep + ragrun Defaults, Router-Pfade | CI rot |
| 3 | Batch-Replace in JSONL; rechunk talks | Zeitintensiv |
| 4 | Postgres | Inkonsistenz ohne Transaction-Plan |
| 5 | Qdrant | Search-Ausfall wenn falsch getimed |
| 6 | Mobile + Facebook | User-facing |
| 7 | `philo-*` Skriptnamen, Redirects entfernen | Ops |

---

## 10. Verifikation (Checkliste)

### Code

- [ ] `rg 'philo-von-freisinn|Philo von Freisinn'` in ragkeep, ragprep, ragrun, ragapp, ragfb → nur erlaubte Historie/Changelog
- [ ] `yarn test` / `pytest` in ragprep und ragrun grün
- [ ] `assistants/filo-von-freisinn/assistant-manifest.yaml` → `rag-collection: filo-von-freisinn`

### Daten

- [ ] `SELECT rag_partition, COUNT(*) FROM rag_chunks WHERE rag_partition IN ('philo-von-freisinn','filo-von-freisinn') GROUP BY 1;` — nur noch `filo`
- [ ] Qdrant: Punktezahl Prod ≈ vorher
- [ ] `yarn rp rag:chunk-status --assistant filo-von-freisinn` (Report-Pfad `assistants/filo-von-freisinn/reports/`)
- [ ] App-Search mit `RAGRUN_APP_DEFAULT_ASSISTANT_SLUG=filo-von-freisinn`
- [ ] Stichprobe Talk: neuer `author` / `source_id`-Präfix

### API

- [ ] `POST /api/v1/agent/filo-von-freisinn/...` (concept-explain, chat)
- [ ] Optional: alter Pfad `philo-von-freisinn` liefert 301/410 oder Proxy

---

## 11. SQL-Skizzen (manuell ausführen, nach Backup)

```sql
-- Counts vorher
SELECT rag_partition, COUNT(*) FROM rag_chunks
WHERE rag_partition LIKE '%freisinn%'
GROUP BY 1;

BEGIN;

UPDATE rag_chunk_paragraphs
SET rag_partition = 'filo-von-freisinn'
WHERE rag_partition = 'philo-von-freisinn';

UPDATE rag_chunks
SET rag_partition = 'filo-von-freisinn'
WHERE rag_partition = 'philo-von-freisinn';

UPDATE rag_talks
SET collection = 'filo-von-freisinn'
WHERE collection = 'philo-von-freisinn';

-- personality nur nach DISTINCT-Check:
-- UPDATE rag_talks SET personality = 'filo-von-freisinn' WHERE personality = 'philo-von-freisinn';

COMMIT;
```

Qdrant und Re-Embed sind **nicht** durch dieses SQL abgedeckt.

---

## 12. Offene Entscheidungen (vor Implementierung)

1. **API-Backward-Compatibility:** Redirect von `/agent/philo-von-freisinn` für wie lange?  
2. **CLI-Kurzalias:** `philo` dauerhaft als Alias behalten oder entfernen?  
3. **Historische Markdown-Talks:** Volltext „Philo“ → „Filo“ oder nur Metadaten?  
4. **Quote-Erklärungen in `lectures/chunks/quotes`:** Batch-Rewrite vs. bei nächstem Augment-Lauf?  
5. **Facebook-Seite / Marketing:** Externer Name unabhängig vom technischen Slug?  
6. **Datei `philo_von_freisinn.py`:** Re-Export unter altem Modulnamen für Import-Stabilität?

---

## 13. Kurzfassung

Die Umbenennung ist **mehr als Kosmetik**: Der Slug `philo-von-freisinn` ist in **rag_partition**, **Qdrant-Collection**, **API-Routen**, **JSONL-Metadaten** (`author`, `assistant:…:talk:…`), **CLI-Defaults** und **Mobile-App-Konstanten** verankert. Ein konsistenter Cutover braucht koordinierte Schritte in ragkeep → ragprep/ragrun → Postgres → Qdrant → ragapp/ragfb. Die **`assistant-id` UUID** kann stabil bleiben; **`__shared__`-Buchchunks** und Steiner-„Philosophie“/„Philon“-Texte bleiben unberührt.
