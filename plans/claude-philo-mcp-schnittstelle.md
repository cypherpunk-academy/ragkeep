# Claude × Philo — MCP-Schnittstelle

Stand: 1.10.2026 · Dev / Staging (ngrok) · Branch `philo-claude-integration`

Operativer Ausschnitt aus [`claude-philo-phasenplan.md`](claude-philo-phasenplan.md) (**Schritt 0c**). Testdaten: [`../../tests/mcp_testdata.yaml`](../../tests/mcp_testdata.yaml), Skripte `../../scripts/test_handoffs.py`, `test_cleanup.py`.

---

## Ziel

Ebene-A-Tests des Philo-MCP-Servers grün machen (Befunde F-1–F-4), ohne Prod-Daten zu verändern. Testnutzer Anton/Antonia; Fixture-Einträge mit Präfix `[TEST]`.

**Primärkorpus (Produkt):** 8 Bände `is_primary = true` (PdF, Dreigliederung, soziale Entwicklungsstufe) sind **bevorzugte** Belegbasis; die App-Bibliothek filtert darauf. **`list_volumes`** bleibt **Vollkorpus** (~333: Bücher + Vorträge + Sekundär) für Claude-Orientierung — getrennt von der App-UI. Später: MCP-Instructions + optional zweistufige Suche (Kern zuerst, erweitern bei Vertiefung/dünnen Treffern).

---

## Umsetzungstabelle (0c)

| # | Befund | Entscheidung | Repo | Lieferung | Akzeptanz |
|---|--------|--------------|------|-----------|-----------|
| 0c.1 | **F-2** Slug ≠ Index bei Protokollen | **Fix** | ragrun | `resolve_segment_slug()` in `citation.py`; `get_protocol` / `append_to_protocol` / Kapitelbeleg | G-03: `"15"` und Slug → dasselbe Protokoll |
| 0c.2 | **F-1** `types` filtert nicht | **Fix** | ragrun | `_title_match_search` nutzt dieselbe `chunk_types`-Liste wie Hybrid; S-06: nur `text`, `concept`, `quote`, `chapter_summary` | `types=["unbekannt"]` → Fehler; `chapter_summary` nur wenn im Filter |
| 0c.3 | **F-4** keine Längenlimite | **Fix: 1 MB** | ragrun + ragapp | MCP + RPC `create_note` / `save_note` (Migration 019) | C-07: >1 MB → Fehlermeldung |
| 0c.4 | **F-3** GA 337b 10.10.1920 doppelt | **Fix** | ragkeep | `sync_lectures.ts`: bei leerem `vortragstitel` **`anlass` oder Katalog-`id`** (`19201010a` / `19201010c`) | Unterschiedliche `rag_sources.title` |
| 0c.5 | **F-3** technische Buchtitel | **Fix** | ragkeep | Lesbares `title` in `book-manifest.yaml`, dann `sync_sources` | Kein `Author#Title#Index` in `display_name` |
| 0c.6 | **F-3** `list_volumes` Metadaten | **Erweitern** | ragrun | `is_primary`, `ga`, `zyklus` (JOIN Katalog); **kein** Filter auf 8 Bände (V-02) | Claude sieht Kern vs. Erweiterung |
| 0c.7 | Oberschlesien doppelt | **Keine Aktion** | — | — | — |
| 0c.8 | Dev „Error executing tool“ | **Diagnose** | ragrun | Pre-Flight Qdrant/Embeddings/DSN; MCP `{error, code}` (X-04) | `search_corpus` + `get_passage` testbar |

**Reihenfolge:** 0c.1 → 0c.2 → 0c.4 → 0c.5 → 0c.6 → 0c.3 → 0c.8. Vor Testlauf: `scripts/test_handoffs.py`.

**Schritt 13 (Phase 1):** Vollkatalog in `list_volumes` bleibt; Filter „nur Bücher“ erst mit Lecture-Tools (12) als separates Tool/Parameter.

---

## Befunde — Kurz

| ID | Ist | Soll |
|----|-----|------|
| **F-1** | Title-Search hardcoded `chapter_summary` ([`app_search_service.py`](../../app/services/app_search_service.py) ~468), Hybrid nutzt `_resolve_chunk_types` | Beide Pfade dieselben `chunk_types`; unbekannte App-Types → Fehler (S-06) |
| **F-2** | Exakter `segment_slug`-String in Protokollen | Index → kanonischer Slug aus `rag_paragraphs` |
| **F-3** | `list_volumes` = alle `rag_sources`; Titel aus Sync/Manifest | GA-337b-Disambiguierung; Manifest-Titel; Metadaten `ga`/`zyklus`/`is_primary` |
| **F-4** | Unbegrenztes `content` | Max **1 MB** MCP + Supabase-RPC |

---

## F-1 — Analyse (Dev)

Bei `types=["bogus_type"]`: Hybrid leer (bogus `chunk_type` in Qdrant), parallel lief Title-Match **immer** mit `["chapter_summary"]` → Treffer trotz ungültigem Filter.

**Fix:** `chunk_types = _resolve_chunk_types(types)` einmal; Hybrid und `_title_match_search(q, chunk_types, …)` teilen sich die Liste. Kein Durchreichen unbekannter App-Types.

---

## F-3 — GA 337b & technische Titel

**GA 337b:** Zwei Events am 10.10.1920, beide `ga: 337b`, leerer `vortragstitel` — SSOT `steineroriginals/rudolf-steiner-ga-lecture-catalog.yaml` (`19201010a`, `19201010c`). `buildDisplayTitle` kollabiert auf „GA … — Dornach, 10.10.1920“ ohne `anlass`.

**Technische Titel:** `sync_sources.ts` schreibt `book-manifest.yaml` → Feld `title` 1:1 nach `rag_sources.title`. MCP `list_volumes` setzt nur `display_name = author: title`. Fix an **Manifest**, nicht in MCP.

**333 vs. 8:** App `SourceRepository.findPrimary()` ≈ 8 lesbare Bände; MCP-Liste ≈ gesamter Korpus.

---

## Primärkorpus-Policy

| Ebene | Soll |
|-------|------|
| Daten | `is_primary` unverändert (8 Kernbände) |
| Retrieval | Optional später: `prefer_primary` / zweistufige Suche |
| Claude | Instructions: Kern zuerst; Sekundär/Vortrag bei Vertiefung oder dünnen Treffern |
| `list_volumes` | `is_primary` in Antwort; nicht auf 8 reduzieren |

Geplante Tests: S-13, B-11, V-05 (siehe Testplan).

---

## Dev-Blocker (X-04)

| Tool | Abhängigkeit |
|------|----------------|
| `list_volumes` | Postgres |
| `search_corpus` | Postgres + Qdrant + Embeddings |
| `get_passage` | Postgres (ohne Qdrant) |

Bei generischem „Error executing tool“: Env auf MCP-Host prüfen; Tool-Wrapper mit strukturiertem Fehlerobjekt.

---

## Code-Reihenfolge

1. F-2 `resolve_segment_slug` + Tests G-03  
2. F-1 Title-Search + types-Validierung + Tests S-06  
3. `sync_lectures` GA-337b; Manifest-Titel; `list_volumes`-Metadaten  
4. F-4 1 MB  
5. Pre-Flight / X-04  

**Testplan-Doku:** geplant als `ragrun/tests/TESTPLAN_MCP.md` (noch anzulegen).

---

## Weitere Testplan-Lücken

- S-09 leere `query` — MCP soll Fehler liefern (nicht `[]`)  
- A-03, C-03, U-04, H-04 — Enum-Validierung MCP vs. Testplan klären  
