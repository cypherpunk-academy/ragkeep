# Claude × Philo — Phasenplan

Stand 1.10.2026. Operative Folge der Arbeit in **ragapp**, **ragrun**, **ragkeep** und Supabase (**ragxxx**, Dev → Staging → Prod nur nach Freigabe).

**Fachlicher Plan:** `plans/ZUKUNFT/filo-naechste-schritte.md` (Ziele, Datenmodell, Entscheidungen). **Bestand:** `docs/status-v2.md` (v2-Schritte 1–18 auf `philo-claude-integration`). **Korpus-Promotion:** `plans/ZUKUNFT/corpus-promotion.md`. **Vorträge (Schema/Sync):** `plans/lecture-sources-plan.md`, Anreicherung `plans/ZUKUNFT/philo-claude-consistency-plan.md`. **MCP-Schnittstelle (Testplan, Befunde F-1–F-4):** [`plans/claude-philo-mcp-schnittstelle.md`](claude-philo-mcp-schnittstelle.md) · Fixtures `ragrun/tests/mcp_testdata.yaml`, `ragrun/scripts/test_handoffs.py`, `test_cleanup.py`.

Arbeit geht auf **`philo-claude-integration`** weiter (Abschluss Schritt 0, dann Phasen 1–4). Kein paralleler Neuaufbau auf frischem `main`.

---

## Arbeitsregeln (kurz)

Migrationen zuerst Dev, dann Staging. Schreiben auf `app_notes` nur über RPCs. MCP-Nutzerdaten mit User-JWT. Server-Konfiguration unter `ragrun/app/mcp_server/config/` und `/app/*`. Alte TestFlight-Builds: nichts droppen, was sie brauchen (v2 Schritt 17 erst in Schritt 40). App-Migration **020+** in `ragapp/supabase/migrations/`; **`ragkeep/sql/019_lecture_catalog.sql`** ist Korpus-Schema, keine Doppelbelegung von 019.

---

## Übersicht

| Phase | Schritte | Schwerpunkt |
|-------|----------|-------------|
| 0 | 0, 0b, **0c** | Branch-Abschluss, Bestand, **MCP-Testplan-Befunde** |
| 1 | 1–17 | Schnittstelle exakt, Vorträge, Verbindungsherkunft, Referenztests |
| 2 | 18–34 | App, Übergabe, Durchschaubarkeit, Links/OTA |
| 3 | 35–38 | Filo-Bibliothek |
| 4 | 39–41 | Tester, Aufräumen, optional Desktop |

---

## Phase 0 — Abschluss und Bestand

### Schritt 0 — Branch-Abschluss (`philo-claude-integration`)

**Repos:** ragapp, ragrun, ragkeep.

Anpassungen nur dort, wo der Branch dem Fachplan widerspricht. Nicht einführen: Belegobjekt, Formpaket, Bibliothek, Aktivitätsprotokoll, Absatzfunktionen, `client_kind` (kommt in Phase 1).

| # | Aufgabe | Repo | Akzeptanz |
|---|---------|------|-----------|
| 0.1 | Server-Instructions: Korpus-Bände mit vollem deutschen Titel zitieren, ohne GA-Nummer; Collection `rudolf-steiner-ga` ausnehmen („GA n, S. …“) | ragrun | Instructions in `server.py` / `handoff_instructions.md` |
| 0.2 | `buildDisplayTitle`: keine GA-Nummer im Anzeigetitel; Feld `ga` unverändert | ragkeep | `sync_lectures.ts`; Re-Sync Dev optional |
| 0.3 | Handoff-Sprung: URL aus `GET /app/deep-link-config`, nicht fest `claude.ai/new` | ragapp | Langer Druck / Übergabe |
| 0.4 | `list_volumes`: weiter Gesamtliste mit `source_type` aus DB (Filter auf Bücher erst Schritt 8) | ragrun | Kein vorzeitiger Bücher-Filter |
| 0.5 | Merge nach `main`, wenn Lesen, Suche, Bücher, Notes-RPC stabil laufen | alle | Rückmeldung an Michael |

**Abhängigkeit:** vor erneuter Bestandsaufnahme, falls sich der Branch ändert.

### Schritt 0c — MCP-Schnittstelle (Claude × Philo)

Vollständiger Plan, Befunde F-1–F-4, Primärkorpus, Umsetzungstabelle und Reihenfolge: **[`claude-philo-mcp-schnittstelle.md`](claude-philo-mcp-schnittstelle.md)**.

### Schritt 0b — Bestandsaufnahme (Referenz)

Erledigt 30.9.2026 → `docs/status-v2.md`. Vor Phase 1 nur aktualisieren, wenn Schritt 0 den Code verändert hat. Offene Punkte aus dem Dokument in die jeweiligen Schritte unten eintragen (Staging ohne 019, `client_kind` fehlt, Beleg fehlt, Chat-Endpoint in ragrun noch da).

---

## Phase 1 — Exakt und Verbindung

Ziel: einheitliches **Belegobjekt** (`citation`), **Titel-Fallback** in MCP-Listen, **Vortrags**-Tools und -Titel, **`client_kind`**.

### Block A — Zitation (ragrun)

| Schritt | Aufgabe | Lieferung | Akzeptanz |
|---------|---------|-----------|-----------|
| **1** | Modul `app/mcp_server/citation.py`: `build_citation(paragraph_id)`, `build_chapter_citation(source_id, segment_slug)`, `format_zitierform(...)` | SQL: `rag_paragraphs`, `rag_sources`, JOIN `rag_lecture_catalog` bei Vorträgen | Buch- und Vortragsbeispiele ohne GA in `zitierform`; `return_url` aus `settings.mcp_base_url` |
| **2** | `get_passage`: Feld `citation` vollständig; Legacy-Felder optional parallel | `tools.py` | Keine leeren Pflichtfelder im Beleg |
| **3** | `search_corpus`: pro Treffer mit `paragraph_id` ein `citation` | `tools.py`, ggf. Batch-Lookup | Instructions verweisen auf `citation.zitierform` |
| **4** | `get_handoff`: `citation` aus `paragraph_id`; abgelaufen wie heute plus Beleg wenn möglich | `tools.py` | |
| **5** | `get_protocol`: `chapter_citation` + pro Eintrag `citation` wenn `paragraph_id` | `tools.py` | |
| **6** | `get_work_text`: bei Anker `citation`; `display_title`, `title_source`, `text_return_url` | `tools.py` | |
| **7** | `list_work_texts`: `display_title`, `title_source` (stored → heading → first_sentence → citation) | `tools.py` | Juli-Notizen mit `title = NULL` haben sinnvolles `display_title` |
| **8** | Server-Instructions: Belege nur aus `citation.zitierform` übernehmen | `server.py`, `handoff_instructions.md` | |

**Reihenfolge innerhalb Block A:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8.

### Block B — Vorträge (ragkeep + ragrun + Supabase)

| Schritt | Aufgabe | Lieferung | Akzeptanz |
|---------|---------|-----------|-----------|
| **9** | `019_lecture_catalog.sql` auf **Staging** einspielen | `ragkeep/sql/019_lecture_catalog.sql` | Spalten `source_type`, `ga`; Tabellen Katalog/Zyklen |
| **10** | `sync_lectures.ts --all` auf Staging; Dev: Titelregeln aus Fachplan 6.1; Disambiguierung GA+Datum (**0c.4**) | ragkeep | 0 leere `rag_sources.title` für chunked lectures; keine identischen Titel für verschiedene UUIDs am selben Tag |
| **11** | Pre-Push-Hook: `sync_lectures.ts` nach `sync_sources.ts` (git-diff wie Quellen) | `scripts/hooks/pre-push` | Push nach main synct Katalog nach Dev |
| **12** | MCP: `get_lecture_info(source_id)`, `list_lectures(ga)` (Planname `list_ga_lectures`) | ragrun `tools.py`, `server.py` | GA intern; Titel/`zitierform` ohne GA |
| **13** | `list_volumes`: Metadaten `is_primary`, `ga`, `zyklus`; optional später Filter nur Bücher oder zweites Tool | `app_catalog_repository.py` | Siehe **0c.6** — Testplan V-02: ~333 Einträge; App-Bibliothek bleibt 8 Primärbände |

**Reihenfolge:** 9 → 10 → 11 parallel möglich zu Block A ab Schritt 1; **13 erst nach 12**.

### Block C — Verbindungsherkunft (Supabase + ragrun + ragapp)

| Schritt | Aufgabe | Lieferung | Akzeptanz |
|---------|---------|-----------|-----------|
| **14** | Migration **020** (ragapp): `connector_grants.client_kind`, `redirect_host`; `config/ai_clients.yaml` | `supabase/migrations/020_…sql`, ragrun config | Dev + Staging |
| **15** | Beim Grant/MCP: Domain → `client_kind` setzen; DCR-Metadaten auf Staging loggen | ragrun OAuth/MCP-Middleware | Neue Grants nicht `unknown` |
| **16** | `GET /app/ai-connections` (JWT); `claude-status` unverändert für alte Builds | `app_api.py` | Liste aktiver Verbindungen |

**Reihenfolge:** 14 → 15 → 16. Parallel zu Block A/B ab Schritt 14.

### Block D — Referenztests (ragrun)

| Schritt | Aufgabe | Lieferung | Akzeptanz |
|---------|---------|-----------|-----------|
| **17** | Gerüst `tests/mcp_reference/*.yaml` + Skript gegen `search_corpus` / `get_passage` | ragrun | Meldet Trefferquote und Belegformat; Fragen von Michael nachreichbar |

**Phase-1-Gate:** Staging-MCP mit Beleg in Suche/Passage/Handoff; **`list_volumes` mit Metadaten** (0c.6); Lecture-Tools; Grants mit `client_kind`; Hook synct Vorträge auf Dev; **0c** (MCP-Testplan Ebene A) auf Dev grün.

**Entscheidungen Michael (blockieren nicht Block A/C):** Korpus-Promotion A/B/C/D; Band vs. Einzelvortrag doppelt; Nicht-Vorträge eigener `source_type`.

---

## Phase 2 — App, Übergabe, Durchschaubar

Voraussetzung: Phase 1 gemerged; Editor/Repos (v2 5–7) laut status-v2 erledigt.

### Block E — App Werkstatt und Arbeitstexte (ragapp)

| Schritt | Aufgabe | Akzeptanz |
|---------|---------|-----------|
| **18** | Werkstatt Tab 0: Philo-Bild, zuletzt gelesen, bearbeitete Arbeitstexte, `conversation_url`; Leerzustände laut Fachplan 5.1 | Alle Connector-Zustände sinnvoll |
| **19** | Connector-Setup: Prefill `claude.ai/customize/connectors?modal=add-custom-connector` | |
| **20** | Markdown lesen + Editor Bearbeiten/Vorschau | |
| **21** | Titel-Fallback in UI wie MCP (`display_title`-Logik geteilt oder API) | |
| **22** | Kopfzeile Stellenbezug → Navigation; Herkunft, Version, Verlauf, Papierkorb | |
| **23** | Formpaket (nach Entscheidung Michael): Migration, RPCs, App-Reiter, `text_formats.yaml`, MCP `format`/`parent_id` | Facebook-Post als verknüpfte Form |

### Block F — Übergabe zur KI (ragapp + ragrun + Supabase)

| Schritt | Aufgabe | Akzeptanz |
|---------|---------|-----------|
| **24** | Migration Handoffs: `function_key`, `note_ids`, `protocol_entry_ids`, `target_kind` | |
| **25** | `paragraph_functions.yaml`, `GET /app/paragraph-functions`; Absatz-Sheet (langer Druck) | Handoff + `get_handoff` mit Texten/Protokoll |
| **26** | `deep-link-config`: `clients` mit `url_template` pro `client_kind`; App liest Config | ChatGPT-Test: kein Auto-Send → Kopierweg |
| **27** | Mehrere Verbindungen, ohne Verbindung Klartext-Prompt | Fachplan 8.3–8.4 |

### Block G — Durchschaubar (ragrun + ragapp)

| Schritt | Aufgabe | Akzeptanz |
|---------|---------|-----------|
| **28** | `commands.yaml` → MCP-Resource `filo://befehle`, `GET /app/commands`, Tool-Beschreibungen | |
| **29** | Tabelle `mcp_activity` + Anzeige Werkstatt (Umfang nach Entscheidung Michael) | |
| **30** | Hilfeseite: Kurzbefehle, Server-Instructions sichtbar | |

### Block H — Rest v2 in Phase 2

| Schritt | Aufgabe | Repo |
|---------|---------|------|
| **31** | Chat-Endpoint `/app/chat/stream` entfernen (wenn App clean) | ragrun |
| **32** | Domain/Universal Links Prod (`ragxxx.com`), AASA/assetlinks, Fallback `/passage`, `/text` | ragrun, ragapp |
| **33** | Korpus-OTA End-to-End (Hosting `.db`, Version bump) | ragrun, ragapp |
| **34** | Tab-Id `chat` → `werkstatt` o. ä. (kosmetisch) | ragapp |

**Parallel empfohlen:** E (18–22) mit F (24–26); G (28–30) neben F.

---

## Phase 3 — Filo-Bibliothek

| Schritt | Aufgabe | Akzeptanz |
|---------|---------|-----------|
| **35** | Migration: `visibility`, `forked_from`, `forked_from_version`; `created_by = filo`; RLS; RPC `fork_note` | |
| **36** | `app_note_paragraphs`; Import-Skript Bibliothekstexte (Bücher 1–3, …) | |
| **37** | Lesen: Hinweis Bibliothekstext am Kapitel; MCP `list_work_texts` scope `mine`/`library`/`all` | Fork + Handoff an Kopie |
| **38** | Optional `note_conversations` (Entscheidung Michael); Gesprächsvorlagen-Config | |

---

## Phase 4 — Tester und Aufräumen

| Schritt | Aufgabe | Akzeptanz |
|---------|---------|-----------|
| **39** | 5–10 Tester, Connector, Feinschliff Tool-Texte / `detail` | v2 Schritt 16 |
| **40** | Migration **021+** (DROP Sync/Invite/Starter); ragrun Chat/Problem-Solver/tools weg | Nur wenn kein alter TestFlight Build Sync/Invite braucht |
| **41** | Optional Desktop-MCP-Anleitung (v2 18); Grants pro Client | Kein Launch-Blocker |

---

## Abhängigkeiten (Kern)

```
0 Branch-Abschluss ──→ 0b status-v2 (Referenz)
        │
        ├──→ 1 citation ──→ 2–8 MCP Beleg + list_work_texts
        │
        ├──→ 9 Staging 019 ──→ 10 sync ──→ 11 hook
        │                              └──→ 12–13 lecture tools + list_volumes
        │
        └──→ 14–16 client_kind

Phase 1 Gate ──→ 18–34 Phase 2 ──→ 35–38 Phase 3 ──→ 39–41 Phase 4
```

**Kritischer Pfad Phase 1:** 1 → 2 → 3 und 9 → 10 → 12 → 13 und 14 → 15.

---

## Mapping v2 → Schritte

| v2 | Schritte |
|----|----------|
| 1 Invite | erledigt; DROP in **40** |
| 2 Schema 018 | erledigt |
| 3–7 books.db, Cache, Notes, Watermelon | erledigt laut status-v2; **0** Merge |
| 4 Chat UI | **31** |
| 8 Expo | erledigt |
| 9 OTA | **33** |
| 10–13 MCP/OAuth | erledigt; Beleg **1–8** |
| 14 Links | **32**, **26** |
| 15a/c Werkstatt | **18–19** |
| 15b Übergabe | **25–27** |
| 15d Vorträge | **9–13** |
| 16 Test | **39** |
| 17 Cleanup | **40** |
| 18 Desktop | **41** |

---

## Offene Entscheidungen (Michael)

Siehe Fachplan Abschnitt 11. Vor **23** (Formpaket), **29** (Aktivitätslog-Umfang), **38** (`note_conversations`), Promotion **vor Prod-Sync** nach Schritt 17-Befund in status-v2.

---

## Nächster konkreter Start

1. **[`claude-philo-mcp-schnittstelle.md`](claude-philo-mcp-schnittstelle.md)** — Reihenfolge 0c.1 ff.
2. Parallel **Phase 1 Block A** (Beleg/Zitation), falls noch offen laut `docs/status-v2.md`.

Wenn Schritt **0** (Merge) noch offen: **0.1–0.3** nicht durch 0c blockieren — 0c auf `philo-claude-integration` committen.
