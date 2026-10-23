# Front 2 — MCP-Architektur

**Stand:** 2026-10-23  
**Status:** Soll-Architektur; Schritte 1–2 in Umsetzung  
**Repos:** ragrun (`app/mcp_server/`), ragprep (Referenzlauf), ragkeep (YAML), ragapp (gemeinsame Suche)  
**Vorrang:** Entscheidungen aus dem Plan-Review (E1–E10) gelten vor älteren Planfragmenten.

Ersetzt inhaltlich [`mcp-functions-and-search.md`](./mcp-functions-and-search.md) und [`mcp-tool-budget.md`](./mcp-tool-budget.md) (nach Verschiebung nach `obsolete/`). Quellen: Lecture-Katalog (done), Typologie-MCP-Felder in [`typology-tree-chunks.md`](./typology-tree-chunks.md), Auftrag Suchmessung, Plan-Review gegen ragrun `staging` (22.10.2026).

---

## 1. Ziel und Leitregeln

Drei Jobs: suchen, lesen, Nutzerarbeit. Der Katalog (`list_volumes`, `list_lectures`, `get_lecture_info`) gehört zum Lesen. Neue MCP-Tools nur bei neuem Datentyp oder klarer Trennung Lesen/Schreiben. Filter sind Parameter; Verhalten steht in Instructions oder am Treffer. Schreib-Tools nur auf ausdrückliche Bitte. Kein Tool pro Typologie, Buch oder Pipeline-Schritt.

**Originalquellen in `hits`:** Körper aus Werken und Vorträgen (`book`, `secondary_book`), wörtliche Zitate (`quote`, siehe E10) und Eigentexte (`curated_text` aus `sources/curated-texts/` — in Treffern, nicht als Steiner-Beleg). KI-Augment (Begriff, Typologie, Kapitelzusammenfassung, Zitat-Erklärung) lenkt die Suche, landet nicht in `hits`; Einordnung über `via` und Block `wegweiser`.

**`kuratiert` (Boolean, Typologie + Begriff-YAML):** `kuratiert: true | false`, fehlend = false. Nicht verwechseln mit `chunk_type: curated_text`. `false`: Wegweiser nur mit Titel, `ref`, `herkunft: augment`, `zitierbar: false`. `true`: zusätzlich `schlagsatz` und `kurztext` (max. ~300 Zeichen), `herkunft: kuratiert`, nie Beleg.

**Chunk-Typen (Soll):** Körper `book`, `secondary_book` (Steiner-Vorträge: `secondary_book`, `source_id` = Katalog-UUID, nicht `talk`). Augment: `quote`, `quote_explanation`, `chapter_summary`, `begriff`, `typology`. Eigentexte: `curated_text`. GA: `ga_text` (eigene Collection). `talk` / `talk_summary` entfallen (Ersatz `curated_text`). App-Chat `rag_talks` hat keinen `chunk_type`.

**Such-Reihenfolge:** Immer zuerst `search_corpus`. `search_ga` nur bei expliziter GA-Nennung oder wenn der Korpus nicht reicht. Referenzlauf ohne GA-Fallback.

**Ist (Review, unverändert dokumentiert):** 18 Tools in `server.py`; `talk` noch in `_APP_TYPE_TO_CHUNK_TYPES`; Instructions erwähnen Typologie-`zitate`; `quote_explanation` wird gegen Elternzitat aufgelöst (`_resolve_quote_explanations`) — Vorbild Wegweiser-Weg; Staging: 0 `rag_paragraphs`, Korpus-Treffer ohne `paragraph_id`; `parseBookStructure.ts` erfasst Zwischenüberschriften fest nur Ebene 2.

---

## 2. Befehlssatz

| Job | Soll (dauerhaft) |
|-----|------------------|
| Suchen | `search_corpus`, `search_ga` |
| Lesen | `get_passage`, `list_volumes`, `list_lectures`, `get_lecture_info` |
| Nutzer | `list_work_texts`, `get_work_text`, `create_work_text`, `update_work_text`, `get_protocol`, `append_to_protocol`, `get_handoff` |
| Befristet | `rate_search_comparison` (Vergleichsmodus) |

Entfallen: `list_typologies`, `list_typology`, `search_typology`, `search_ga_summaries`. `whoami` nur Dev. Typologie-Verzeichnis → Resource `philo://typologien`. Migration: `list_typology` → `via` + `search_corpus(ref=…)`.

---

## 3. `search_corpus`

Zwei Wege: direkte Original-Chunks und Wegweiser (Begriff, Typologie, Zusammenfassung) → Referenzen oder Kapitelsuche → RRF/Dedupe. **Chunk vs. Absatz:** Treffer sind `rag_chunks`; Lesen/Zitat über `paragraph_id` (Lookup wie `_lookup_paragraph_ids`). **`get_passage`** liefert Absätze, nicht Chunk-Rohtext.

**`types`:** `text | quote | curated_text`. Intern `text` → `book` + `secondary_book` (ohne `talk`, E6). **`quote` (E10):** nur in `hits`, wenn `quote_verified` und auflösbare `paragraph_id`; Dedupe pro `paragraph_id` fasst Zitat und Körper desselben Absatzes. **`curated_text`:** kein `return_url`, nicht als Steiner-Beleg zitieren.

**Titelsuche (E7):** `_title_match_search` liefert in `hits` nur Originaltypen (`book`, `secondary_book`, `quote`, `curated_text`). Augment-Titel → höchstens `wegweiser`.

**Antwort:** `hits` (Originale) + `wegweiser` (max. 5): `kind`, `titel`, `ref`, `references_status`, `herkunft`, `zitierbar: false`; bei `kuratiert: true` optional `schlagsatz`/`kurztext`. Treffer mit `citation`/`return_url` für Steiner-Originale mit Absatz-Mapping.

**Navigation ohne Typologie-Tools:** `via` mit `counterpart_ref`, `group_ref`, `overview_ref`; `search_corpus(ref=…)` holt Belege aus gespeicherten `references` des Knotens.

**Offen O1 — `search_corpus(ref=…)` ohne Referenzen:** Wenn der Knoten keine `references` hat (`references_status: redaktionell`), ist unklar, was `ref` liefert (leere Liste = Sackgasse). **Vorschlag (Entscheidung Michael):** Ersatzsuche mit Titel/Schlagwort/Kurztext des Knotens, nur Pool `book`/`secondary_book`, Treffer mit `via: { kind, ref, weg: "ersatzsuche" }`. Bis zur Entscheidung nicht implementieren.

---

## 3a. Referenzlauf (ragprep)

Belege an Typologie-Knoten, Begriffen und `curated_text`-Abschnitten (`##`) aus Manifest Primär/Sekundär (Bücher + Vorträge). Ziel-Pool: nur `chunk_type` **`book`** und **`secondary_book`**, bare `source_id`, keine `:quotes`/`:summary`, kein GA, kein Augment. Steiner-Vorträge im Korpus sind `secondary_book` (Staging geprüft). **`rag:augment:references`** entsteht neu nach diesem Abschnitt (E3: bestehende Branches `feat/augment-references` / `feat/chunk-references-endpoint` nicht verwenden).

**Speicherort (colocated):**

| Art | Ort |
|-----|-----|
| Typologie | `sources/typologies/*.yaml` |
| Begriff | `sources/concepts/concepts.yaml` |
| Curated | Sidecar `*.references.yaml` pro `.md`, Block pro `##` |

**YAML-Referenz (E1):** Kein dauerhafter `paragraph_id`-Anker — IDs sind je Umgebung neu (`randomUUID` in `paragraphChapterMatcher.ts`). Gespeichert werden **`chunk_id`** (uuid5, stabil) und natürlicher Schlüssel **`source_id`, `segment_slug`, `paragraph_number`**. `paragraph_id` zur Laufzeit über `app_paragraph_chunk` / Lookup wie `_lookup_paragraph_ids`. Verwaist, wenn `chunk_id` nicht mehr aktiv.

```yaml
references:
  - id: "<uuidv4>"
    chunk_id: …
    chunk_type: book | secondary_book
    source_id: …
    segment_slug: …
    paragraph_number: …
    relation: …
    relevance: …
    begruendung: …
```

Pipeline: Hybrid-Kandidaten (~30) → LLM-Prüfung (`definiert | erlaeutert | …`, Krank-Pol: `kritisiert | warnt | …`) → max. 5 pro Knoten. In-place in dieselbe YAML. Kein Pflicht-`rag:augment:quotes` (Buch).

#### 3a.1 Soziale Gesundheit

`zitate` entfällt; pro Aspekt `references` (Freitext-`zitate` nicht übernehmen). FM: `members.references: references`. Chunker: `parseReferences`, kein `quoteReferences`. Band-2-`generate-a2.py`: Regex `references` statt `zitate`.

---

## 3b. Steiner-Zitat-Katalog (Front 3)

`rag:augment:quotes:export-yaml` (geplant): Scan `references` in typologies + concepts + Sidecars; ergänzend Kursiv; optional einmalig legacy `quotes.md`. Output `sources/quotes/*.yaml`. Philo `*.quote.md` entfällt. Nicht identisch mit Buch-`rag:augment:quotes`.

---

## 4. `get_passage`

Ein Lesezugang; **kein** Lesen per `chunk_id`. Parameter (E9, englisch): `paragraph_id`, `source_id`, `segment_index`, `from_paragraph`, `to_paragraph`, `before`, `after` (Kontext max. 5). Obergrenze 12 Absätze je Aufruf. Antwort: `paragraphs[]` mit je `citation`/`return_url` wo möglich; `nav.prev` / `nav.next`; `segment_first`, `segment_last`, `segment_index`. **Vorträge (E9):** `nav` springt an Segmentgrenzen zum vorigen/nächsten Vortrag desselben Bandes (Katalog-Reihenfolge). Aufbau über `(source_id, segment_index, paragraph_number)` in `rag_paragraphs`.

**Konsistenz (Schritt 1, E2):** Vor Rollout SQL-Report: je `(source_id, segment_index)` lückenlose eindeutige `paragraph_number`; je `source_id` 1:1 zwischen `segment_index` und `segment_slug` (Unique-Index `(source_id, segment_slug, paragraph_number)`).

**GA (E4):** Absatzweises Lesen/Blättern in der GA-Collection gibt es nicht (Payload: `segment_id`, `page_start`/`page_end`, keine Absatznummer). Review beantwortet den früheren offenen Payload-Punkt.

---

## 4a. `search_ga`

Gefiltert: direkte Hybrid-Suche. Ungefiltert: gestuft (Summaries orientieren → `ga_text` „Eintauchen“ → RRF). **Eintauchen filtert auf `segment_id`**, nicht nur `lecture_id`, damit Schriften (z. B. GA 4, `segment_id` `"4:11"`) nicht fehlen. Summaries nie in `hits`.

**Korpus-Mapping (E5):** Liegt der Vortrag eines GA-Treffers im Korpus, Abbildung über Katalog (`lecture_id` → UUID → `rag_paragraphs`) auf Korpus-Absatz → `citation`/`return_url`, Dedupe Korpus/GA. Deep-Link-Lücke nur noch für Stellen **außerhalb** des Korpus.

---

## 5. Deep-Links

Kette: `citation.return_url` → `/passage/{uuid}` → App oder `corpus.*`. Staging/Prod: Promotion `rag_paragraphs` nötig (Front 6). GA-only ohne Korpus-Mapping: Zitierform ohne sicheren Wortlaut-Link.

---

## 5a. `curated_text`

Quelle `sources/curated-texts/`; `#` Titel, `##` Segment, `###` Annotation `subheading`. Parser/Reader-Anpassungen wie im Umsetzungsplan. Kein MCP-`return_url` für Eigentexte.

---

## 6. Vergleichsmodus (befristet)

Parameter `compare` an beide Such-Tools; Tabelle `search_comparisons`; `rate_search_comparison`. Details im Konsolidierungsplan; Auswertung siehe Abschnitt 11.

---

## 7. Clients

OpenAI, Grok, Gemini, Kimi, DeepSeek — kleineres Tool-Menü, Instructions gekürzt.

---

## 8. Später (Phase 2 F–G)

Handoff-Erweiterung, `commands.yaml` als Resource, `mcp_activity`, Hilfeseite — Verweis [`filo-phase-2-werkstatt-and-handoffs.md`](../future/filo-phase-2-werkstatt-and-handoffs.md).

---

## 9. Umsetzung (PR-Reihenfolge)

1. **Konsistenzprüfung** Absatznummern + `segment_slug` (E2); GA-Payload-Notiz (E4).
2. **`get_passage`** erweitern (E9) + Unit-Tests.
3. **§3a.1** + `rag:augment:references` — **vor Start Rücksprache Michael.**
4. `search_corpus`-Wegweiser, Typ-Trennung, **`talk` entfernen** — **App `/app/search` mitziehen (E6)** + ragapp.
5. `curated_text` Parser/Reader; GA `routed`; Vergleichsmodus; Testkorpus.
6. `TESTPLAN_MCP.md` je Schritt.

---

## 10. Offene Entscheidungen

| ID | Thema |
|----|--------|
| O1 | `search_corpus(ref=…)` ohne gespeicherte Referenzen — siehe §3 |

Weitere Abhängigkeiten: Promotion Absätze Staging/Prod; `auftrag_ga_ranking.md` nicht im Workspace (Stand im Code dokumentieren).

---

## 11. Später: Reihenfolge und Messung

Nicht jetzt umsetzen:

- Korpus-Testkorpus (`corpus_ranking_testkorpus.yaml`) und Baseline-Lauf **vor** Referenzlauf, um den Nutzen des Laufs zu messen.
- Wochenzyklus: Aufwand ~20 Fragen × Varianten × Fragetypen — Fragetypen zusammenlegen oder Testkorpus Hauptlast, Handbewertung nur Stichproben.
- Testplan: Fall, dass das Modell **nicht** zu früh `search_ga` nutzt (Korpus-zuerst-Regel).

---

## Plan-Review: Entscheidungen E1–E10 (Kurz)

| ID | Inhalt |
|----|--------|
| E1 | Referenz-YAML: `chunk_id` + `source_id`/`segment_slug`/`paragraph_number`, kein gespeicherter `paragraph_id` |
| E2 | Konsistenzprüfung inkl. `segment_index` ↔ `segment_slug` |
| E3 | Alte Referenz-Branches ignorieren; Vorträge = `secondary_book` im Referenz-Pool |
| E4 | GA „Eintauchen“ nach `segment_id`; kein absatzweises GA-Lesen |
| E5 | GA-Treffer auf Korpus-Absatz mappen wenn vorhanden |
| E6 | `app_search`-Änderungen gelten für MCP und App |
| E7 | Titelsuche nur Originale in `hits` |
| E8 | (siehe O1) |
| E9 | `nav` über Vortragsgrenzen im Band; einheitliche englische `get_passage`-Parameter |
| E10 | `quote` in `hits` nur verified + `paragraph_id`; Dedupe mit Körper |
