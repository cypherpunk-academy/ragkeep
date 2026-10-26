# Front 2 — MCP-Architektur

**Stand:** 2026-10-25  
**Status:** Soll-Architektur; Schritte 1–2 erledigt; Schritt 3 (SG) weitgehend (Übergang: Referenzen noch in YAML); **Schritt 4 umgesetzt (ragrun + ragapp)**  
**Repos:** ragrun (`app/mcp_server/`), ragprep (Referenzlauf), ragkeep (YAML), ragapp (gemeinsame Suche)  
**Vorrang:** Entscheidungen aus dem Plan-Review (E1–E10) gelten vor älteren Planfragmenten.

Ersetzt inhaltlich [`mcp-functions-and-search.md`](./mcp-functions-and-search.md) und [`mcp-tool-budget.md`](./mcp-tool-budget.md) (nach Verschiebung nach `obsolete/`). Quellen: Lecture-Katalog (done), Typologie-MCP-Felder in [`typology-tree-chunks.md`](./typology-tree-chunks.md), Auftrag Suchmessung, Plan-Review gegen ragrun `staging` (22.10.2026).

---

## 1. Ziel und Leitregeln

Drei Jobs: suchen, lesen, Nutzerarbeit. Der Katalog (`list_volumes`, `list_lectures`, `get_lecture_info`) gehört zum Lesen. Neue MCP-Tools nur bei neuem Datentyp oder klarer Trennung Lesen/Schreiben. Filter sind Parameter; Verhalten steht in Instructions oder am Treffer. Schreib-Tools nur auf ausdrückliche Bitte. Kein Tool pro Typologie, Buch oder Pipeline-Schritt.

**Originalquellen in `hits`:** Körper aus Werken und Vorträgen (`book`, `secondary_book`) und wörtliche Zitate (`quote`, siehe E10). **`curated_text` nie in `hits` und nie als `wegweiser`:** Eigentexte aus `sources/curated-texts/` sind unsichtbare Routing-/Referenzträger; bei Match werden gespeicherte `references` expandiert — Korpus (`book` / `secondary_book`, zitierbar) und ggf. GA-Angaben (`ga_text`, `zitierbar: false`, ohne `citation`). KI-Augment (Begriff, Typologie, Kapitelzusammenfassung, Zitat-Erklärung) landet in `wegweiser`, nicht in `hits`.

**`kuratiert` (Boolean, Typologie + Begriff-YAML):** `kuratiert: true | false`, fehlend = false. Nicht verwechseln mit `chunk_type: curated_text`. `false`: Wegweiser nur mit Titel, `ref`, `herkunft: augment`, `zitierbar: false`. `true`: zusätzlich `schlagsatz` und `kurztext` (max. ~300 Zeichen), `herkunft: kuratiert`, nie Beleg.

**Chunk-Typen (Soll):** Körper `book`, `secondary_book` (Steiner-Vorträge: `secondary_book`, `source_id` = Katalog-UUID, nicht `talk`). Augment: `quote`, `quote_explanation`, `chapter_summary`, `begriff`, `typology`. Eigentexte: `curated_text`. GA: `ga_text` (eigene Collection). `talk` / `talk_summary` entfallen (Ersatz `curated_text`). App-Chat `rag_talks` hat keinen `chunk_type`.

**Such-Reihenfolge:** Immer zuerst `search_corpus`. Bekannte GA-`chunk_id` → `get_ga_chunk`. Freie `search_ga` nur nach explizitem Nutzerwunsch (Gesamtausgabe).

**Ist (Review, unverändert dokumentiert):** 18 Tools in `server.py`; `talk` noch in `_APP_TYPE_TO_CHUNK_TYPES`; Instructions erwähnen Typologie-`zitate`; `quote_explanation` wird gegen Elternzitat aufgelöst (`_resolve_quote_explanations`) — Vorbild Wegweiser-Weg; Staging: 0 `rag_paragraphs`, Korpus-Treffer ohne `paragraph_id`; `parseBookStructure.ts` erfasst Zwischenüberschriften fest nur Ebene 2.

---

## 2. Befehlssatz

| Job | Soll (dauerhaft) |
|-----|------------------|
| Suchen | `search_corpus`, `get_ga_chunk`, `search_ga` |
| Lesen | `get_passage`, `list_volumes`, `list_lectures`, `get_lecture_info` |
| Nutzer | `list_work_texts`, `get_work_text`, `create_work_text`, `update_work_text`, `get_protocol`, `append_to_protocol`, `get_handoff` |
| Befristet | `rate_search_comparison` (Vergleichsmodus) |

Entfallen: `list_typologies`, `list_typology`, `search_typology`, `search_ga_summaries`. `whoami` nur Dev. Typologie-Verzeichnis → Resource `philo://typologien`. Migration: `list_typology` → `via` + `search_corpus(ref=…)`.

---

## 3. `search_corpus`

Zwei Wege: direkte Original-Chunks und Wegweiser (Begriff, Typologie, Zusammenfassung) → Referenzen oder Kapitelsuche → RRF/Dedupe. **Chunk vs. Absatz:** Treffer sind `rag_chunks`; Lesen/Zitat über `paragraph_id` (Lookup wie `_lookup_paragraph_ids`). **`get_passage`** liefert Absätze, nicht Chunk-Rohtext.

**`types`:** `text | quote | curated_text`. Intern `text` → `book` + `secondary_book` (ohne `talk`, E6). **`quote` (E10):** nur in `hits`, wenn `quote_verified` und auflösbare `paragraph_id`; Dedupe pro `paragraph_id` fasst Zitat und Körper desselben Absatzes. **`curated_text`:** Kandidaten aus dem Index nur zur Referenz-Expansion — nie selbst in `hits`/`wegweiser`.

**Titelsuche (E7):** `_title_match_search` liefert in `hits` nur Originaltypen (`book`, `secondary_book`, `quote`). Augment-Titel → höchstens `wegweiser`. Curated-Titel → References expandieren, kein Hit.

**Antwort:** `hits` (Originale) + `wegweiser` (max. 5): `kind`, `titel`, `ref`, `references_status`, `herkunft`, `zitierbar: false`; bei `kuratiert: true` optional `schlagsatz`/`kurztext`. Treffer mit `citation`/`return_url` für Steiner-Originale mit Absatz-Mapping.

**Navigation ohne Typologie-Tools:** `via` mit `counterpart_ref`, `group_ref`, `overview_ref`; `search_corpus(ref=…)` holt Belege aus gespeicherten `references` des Knotens.

**Offen O1 — `search_corpus(ref=…)` ohne Referenzen:** Wenn der Knoten keine `references` hat (`references_status: redaktionell`), ist unklar, was `ref` liefert (leere Liste = Sackgasse). **Vorschlag (Entscheidung Michael):** Ersatzsuche mit Titel/Schlagwort/Kurztext des Knotens, nur Pool `book`/`secondary_book`, Treffer mit `via: { kind, ref, weg: "ersatzsuche" }`. Bis zur Entscheidung nicht implementieren.

---

## 3a. Referenzlauf (ragprep)

Belege an Typologie-Knoten, Begriffen und `curated_text`-Zeilen (je **ein** Chunk pro Textknoten) aus Manifest Primär/Sekundär (Bücher + Vorträge). Ziel-Pool: nur `chunk_type` **`book`** und **`secondary_book`**, bare `source_id`, keine `:quotes`/`:summary`, kein GA, kein Augment. Steiner-Vorträge im Korpus sind `secondary_book` (Staging geprüft). **`rag:augment:references`** (E3: alte Branches `feat/augment-references` / `feat/chunk-references-endpoint` nicht verwenden).

**SSOT vs. Laufzeit**

| Was | SSOT (Git) | Laufzeit (DB) |
| --- | ---------- | ------------- |
| Redaktion (Titel, Text, Struktur, `chunk_id`, `kuratiert`, …) | `sources/typologies/*.yaml`, `sources/concepts/concepts.yaml`, `sources/curated-texts/` | Spiegel in `rag_chunks.text` / Metadaten nach `assistant:chunk` |
| Belege (`references`) | **nicht** — nie manuell pflegen | **`rag_chunks.references`** (JSONB); MCP `search_corpus(ref=…)` und Wegweiser `references_status` lesen **nur Postgres** |
| Embeddings | — | Qdrant nach `rag:embed` |

**Pipeline (Pflichtreihenfolge):**

1. **`assistant:chunk`** — exakt **1 Chunk pro Textknoten** (Typologie-Member, Begriff, `curated_text`-Segment); Referenzen beim Upsert **leer lassen** (nicht aus YAML übernehmen).
2. **`rag:augment:references`** — Kandidaten + LLM-Judge → **`references` auf die bestehende Assistant-`chunk_id` in der DB** schreiben (Upsert/Patch über ragrun, z. B. `store-chunks` mit Merge oder schlanker References-Endpoint).
3. **`rag:embed`** — Vektoren; ändert keine Referenzen.

Text in YAML geändert → **chunk + augment:references** neu. Korpus (Primär/Sekundär) neu ingested ohne YAML-Änderung → **augment:references** (betroffene Typen / Vollrefresh) prüfen — Ziel-`chunk_id`s können verwaist sein (E1, `deprecated_at`).

**Referenz-Objekt (E1, in DB):** Kein dauerhafter `paragraph_id`-Anker — IDs sind je Umgebung neu (`randomUUID` in `paragraphChapterMatcher.ts`). Gespeichert werden u. a. `chunk_id` (Korpus-Ziel, uuid5), `chunk_type`, natürlicher Schlüssel `source_id`, `segment_slug`, `paragraph_number`, `relation`, `relevance`, `begruendung`. `paragraph_id` zur Laufzeit über `app_paragraph_chunk` / Lookup wie `_lookup_paragraph_ids`.

Judge-Pipeline: Hybrid-Kandidaten (~30) → LLM-Prüfung (`definiert | erlaeutert | …`, Krank-Pol: `kritisiert | warnt | …`) → max. 5 pro Knoten. Kein Pflicht-`rag:augment:quotes` (Buch).

**Übergang (Schritt 3):** SG-YAML enthält noch `references` aus dem ersten Typologie-Lauf; Schritt 6 entfernt sie aus Git, sobald die DB befüllt ist, und stellt Augment auf DB-Schreiben um.

#### 3a.1 Soziale Gesundheit

`zitate` entfällt (Freitext-`zitate` nicht übernehmen). **Soll:** keine `references`-Blöcke mehr in `soziale-gesundheit.yaml` — nur redaktionelle Felder. Band-2-`generate-a2.py` nutzt für das Plakat nur `schlagwort`/`schlagsatz`; `references` war nur Parser-Grenze (optional `chunk_id` als Abschnittende).

---

## 3b. Steiner-Zitat-Katalog (Front 3)

`rag:augment:quotes:export-yaml` (geplant): Scan **`rag_chunks.references`** (Assistant-Partition, Typologie/Begriff/curated_text) — nicht mehr YAML/Sidecars; ergänzend Kursiv; optional einmalig legacy `quotes.md`. Output `sources/quotes/*.yaml`. Philo `*.quote.md` entfällt. Nicht identisch mit Buch-`rag:augment:quotes`.

---

## 4. `get_passage`

Ein Lesezugang; **kein** Lesen per `chunk_id`. Parameter (E9, englisch): `paragraph_id`, `source_id`, `segment_index`, `from_paragraph`, `to_paragraph`, `before`, `after` (Kontext max. 5). Obergrenze 12 Absätze je Aufruf. Antwort: `paragraphs[]` mit je `citation`/`return_url` wo möglich; `nav.prev` / `nav.next`; `segment_first`, `segment_last`, `segment_index`. **Vorträge (E9):** `nav` springt an Segmentgrenzen zum vorigen/nächsten Vortrag desselben Bandes (Katalog-Reihenfolge). Aufbau über `(source_id, segment_index, paragraph_number)` in `rag_paragraphs`.

**Konsistenz (Schritt 1, E2):** Vor Rollout SQL-Report: je `(source_id, segment_index)` lückenlose eindeutige `paragraph_number`; je `source_id` 1:1 zwischen `segment_index` und `segment_slug` (Unique-Index `(source_id, segment_slug, paragraph_number)`).

**GA (E4):** Absatzweises Lesen/Blättern in der GA-Collection gibt es nicht (Payload: `segment_id`, `page_start`/`page_end`, keine Absatznummer). Review beantwortet den früheren offenen Payload-Punkt.

---

## 4a. GA-Tools

**`get_ga_chunk(chunk_id)`:** Qdrant-Lookup in `rudolf-steiner-ga` per Payload-`chunk_id` (≠ Point-ID). Immer erlaubt für bekannte IDs (z. B. curated-Angaben). Antwort mit Volltext, `zitierbar: false`.

**`search_ga` / `search_ga_summaries`:** freie Hybrid-Suche nur nach explizitem Nutzerwunsch. Gefiltert: direkte Hybrid-Suche. Ungefiltert: gestuft (Summaries orientieren → `ga_text` „Eintauchen“ → RRF). **Eintauchen filtert auf `segment_id`**, nicht nur `lecture_id`. Summaries nie in `hits`.

**Korpus-Mapping (E5):** Liegt der Vortrag eines GA-Treffers im Korpus, Abbildung über Katalog (`lecture_id` → UUID → `rag_paragraphs`) auf Korpus-Absatz → `citation`/`return_url`, Dedupe Korpus/GA. Deep-Link-Lücke nur noch für Stellen **außerhalb** des Korpus.

---

## 5. Deep-Links

Kette: `citation.return_url` → `/passage/{uuid}` → App oder `corpus.*`. Staging/Prod: Promotion `rag_paragraphs` nötig (Front 6). GA-only ohne Korpus-Mapping: Zitierform ohne sicheren Wortlaut-Link.

---

## 5a. `curated_text`

Quelle `sources/curated-texts/<sammlung>/`. Markdown unverändert: **`#`** = Vortrag/Artikel (`segment_title`), **`##`** = Abschnitt (harte Chunk-Grenze, `section_title`). Sammlung = 1. Verzeichnisebene; `source_id` = UUIDv4 in `.uuid` im Ordner. `chunk_id` = frische UUIDv4 pro Chunk-Zeile (kein Anker). Pipeline: `assistant:chunk --type curated_text` → `rag:augment:references --type curated_text` → `rag:embed --type curated_text`. MCP: nie in `hits`/`wegweiser`; Match → expandierte `references` in `hits`. Korpus-Ziele (`book` / `secondary_book`) mit `citation`. Bei spärlichen Korpus-Refs (≤1) ergänzt Augment GA-Angaben (`ga_text` aus `rudolf-steiner-ga`) mit `zitierbar: false` (ohne `citation`, kurzes `snippet` + `chunk_id`). Volltext bei Bedarf via **`get_ga_chunk(chunk_id)`** (immer erlaubt für bekannte IDs). Freie **`search_ga`**-Textsuche nur nach explizitem Nutzerwunsch. Chunks ohne jede Referenz: manuell in Markdown nacharbeiten.

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

1. **Erledigt:** Konsistenzprüfung Absatznummern + `segment_slug` (E2); GA-Payload-Notiz (E4).
2. **Erledigt:** `get_passage` erweitern (E9) + Unit-Tests.
3. **Weitgehend (SG):** §3a.1 Soziale Gesundheit (`members.references`, kein `zitate`) + `rag:augment:references --type typology` für `soziale-gesundheit.yaml`. Offenes → Schritt 7.
4. **Erledigt:** `search_corpus` → `{hits, wegweiser}`, `ref=`, `talk` entfernt, `/app/search` E6/E7/E10, MCP-Tools `list_typology` / `search_typology` / `list_typologies` entfernt, Resource `philo://typologien`.
5. **Manuell (vor Schritt 6):** Begriffe in `sources/concepts/concepts.yaml` redaktionell überarbeiten — braucht die neue MCP-Antwortstufe aus Schritt 4 (Wegweiser, `references`, Lesen über `get_passage` / `search_corpus(ref=…)`).
6. **Referenzlauf §3a — DB-first, YAML bereinigen (ragprep + ragkeep + ggf. ragrun):**
   - **Pipeline dokumentieren** (README ragprep, CLAUDE/ragkeep): immer `assistant:chunk` → `rag:augment:references` → `rag:embed`; MCP liest Referenzen aus Postgres.
   - **ragprep `rag:augment:references`:** Primärsink **`rag_chunks.references`** (bestehende Assistant-`chunk_id`); **kein** In-place-Patch in Typologie-/Concept-YAML mehr. Typologie-Lauf (`--type typology`) auf DB-Schreiben umstellen (ersetzt `patchTypologyYaml`).
   - **`--type concept`**, **`--type curated_text`** implementieren (Ziele = `begriff`- bzw. `curated_text`-Zeilen nach Chunking; 1 Chunk = 1 Begriff bzw. 1 Segment).
   - **`assistant:chunk`:** `references` aus YAML **ignorieren/strippen** beim `store-chunks` (Typologie, Begriff); FM **`members.references`** aus Typologie-YAML-Schema entfernen, wenn bereinigt.
   - **Migration Git:** Nach erfolgreichem Augment-Lauf in der Zielumgebung (Staging/Dev): **`references:`-Blöcke aus `sources/` löschen** — zuerst `soziale-gesundheit.yaml`, dann **`concepts.yaml`** (historische/heuristische Einträge), übrige Typologien; Commit nur wenn DB-Belege für dieselben `chunk_id`s vorhanden sind (Audit: `search_corpus(ref=…)` / SQL).
   - **SG + Begriffe ausführen:** `assistant:chunk` (typology/concept) → `augment:references` → `rag:embed` auf Dev/Staging, damit Wegweiser `references_status: belegt` und `ref` greifen.
   - **`generate-a2.py`:** Parser an YAML **ohne** `references`-Block anpassen (Abschnittende an `chunk_id` / nächstem Aspekt).
   - **Tests/Docs:** `typology-tree-chunks.md`, Plan E1-Zeile; optional ragrun-Test für References-Upsert.
7. **Schritt-3-Rest:** andere Typologie-YAMLs (redaktionell, ohne `references`), SG-Nacharbeit (Rest-`zitate`, Qualität), Primär-vs.-Sekundär-Gewichtung in Suche/Judge, vollständige E1-Felder in DB-Referenzen, übrige Typologien **chunk → augment → embed**, Git/PR. O1 weiter offen.
8. **`curated_text` Parser/Reader** (Ingest/Lesen); GA **`routed`**; **Vergleichsmodus**; Korpus-Testkorpus (Abschnitt 11).
9. **`TESTPLAN_MCP.md`** je Schritt.

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
| E1 | Referenz-Payload in `rag_chunks.references`: Korpus-`chunk_id` + `source_id`/`segment_slug`/`paragraph_number`, kein gespeicherter `paragraph_id`; nicht in Git-YAML |
| E2 | Konsistenzprüfung inkl. `segment_index` ↔ `segment_slug` |
| E3 | Alte Referenz-Branches ignorieren; Vorträge = `secondary_book` im Referenz-Pool |
| E4 | GA „Eintauchen“ nach `segment_id`; kein absatzweises GA-Lesen |
| E5 | GA-Treffer auf Korpus-Absatz mappen wenn vorhanden |
| E6 | `app_search`-Änderungen gelten für MCP und App |
| E7 | Titelsuche nur Originale in `hits` |
| E8 | (siehe O1) |
| E9 | `nav` über Vortragsgrenzen im Band; einheitliche englische `get_passage`-Parameter |
| E10 | `quote` in `hits` nur verified + `paragraph_id`; Dedupe mit Körper |
