# Claude × Philo — Phasenplan

**Geschlossen 18.10.2026.** Phase-1-Gate, Phase 4 und die unten genannten Entscheidungen gelten als erledigt (läuft oder gestrichen). Bei einem Fehler an einem dieser Punkte gehen wir den einzeln an.

Erledigt: **G1–G8** einschließlich **G2b**. **Phase 4** (39–41): Tester, DROP von `app_starter_prompts` / `llm_pricing` / `vector_chunks` sowie Sync/Invite, Desktop-Anleitung. Entscheidungen: Korpus-Promotion, Band gegen Einzelvortrag in `list_volumes`, `source_type` für Nicht-Vorträge, Formpaket vor Schritt 23, Umfang des Aktivitätslogs vor Schritt 29.

Phase 2 (18–34) liegt in ragapp `plans/filo-phase-2-werkstatt.md` und kommt später.

Stand 14.10.2026. Operative Folge der Arbeit in **ragapp**, **ragrun**, **ragkeep** und Supabase (**ragxxx**, Dev → Staging → Prod nur nach Freigabe). Dev liest Qdrant und Embedder lokal (`localhost:6333`, `localhost:8001`). Staging und Production lesen **Tuxai**. Der Korpus liegt dort (G2b).

**Fachlicher Plan:** `plans/ZUKUNFT/filo-naechste-schritte.md` (Ziele, Datenmodell, Entscheidungen). **Bestand:** `docs/status-v2.md` (v2-Schritte 1–18 auf `philo-claude-integration`). **Korpus-Promotion:** `plans/ZUKUNFT/corpus-promotion.md`. **Vorträge (Schema/Sync):** `plans/lecture-sources-plan.md`, Anreicherung `plans/ZUKUNFT/philo-claude-consistency-plan.md`. **MCP-Schnittstelle (Testplan, Befunde F-1–F-4):** [`plans/claude-philo-mcp-schnittstelle.md`](claude-philo-mcp-schnittstelle.md) · Fixtures `ragrun/tests/mcp/mcp_testdata.yaml`, `ragrun/scripts/mcp_tests/`.

Arbeit geht auf **`philo-claude-integration`** weiter. Nächster Schritt ist das Phase-1-Gate (G1–G8), danach Phasen 2–4. Kein paralleler Neuaufbau auf frischem `main`.

---

## Arbeitsregeln (kurz)

Migrationen zuerst Dev, dann Staging. Schreiben auf `app_notes` nur über RPCs. MCP-Nutzerdaten mit User-JWT. Server-Konfiguration unter `ragrun/app/mcp_server/config/` und `/app/*`. Alte TestFlight-Builds: nichts droppen, was sie brauchen (v2 Schritt 17 erst in Schritt 40). App-Migration **020+** in `ragapp/supabase/migrations/`; **`ragkeep/sql/019_lecture_catalog.sql`** ist Korpus-Schema, keine Doppelbelegung von 019.

---

## Übersicht

| Phase | Schritte | Schwerpunkt |
|-------|----------|-------------|
| 0 | 0, 0b, **0c** | Branch-Abschluss, Bestand, **MCP-Testplan-Befunde** |
| 1 | 1–17 | Schnittstelle exakt, Vorträge, Collection `rudolf-steiner-ga`, Verbindungsherkunft, Referenztests |
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

**Abhängigkeit:** vor erneuter Bestandsaufnahme, falls sich der Branch ändert.

### Schritt 0c — MCP-Schnittstelle (Claude × Philo)

Vollständiger Plan, Befunde F-1–F-4, Primärkorpus, Umsetzungstabelle und Reihenfolge: **[`claude-philo-mcp-schnittstelle.md`](claude-philo-mcp-schnittstelle.md)**.

### Schritt 0b — Bestandsaufnahme (Referenz)

Erledigt 30.9.2026 → `docs/status-v2.md`. Für Phase 1 nicht mehr als Ist verwenden: Beleg, Lecture-Tools und `client_kind` sind seit dem 10.10. im Code. Chat-Endpoint und Staging ohne geprüfte 019 bleiben offen.

---

## Phase 1 — Exakt und Verbindung

Ziel: einheitliches **Belegobjekt** (`citation`), **Titel-Fallback** in MCP-Listen, **Vortrags**-Tools und -Titel, **`client_kind`**.

### Stand 10.10.2026

Abgelesen am Code auf `philo-claude-integration`, nicht an einem frischen Ebene-A-Lauf und nicht an Dev/Staging. `docs/status-v2.md` (30.9.) beschreibt diesen Stand nicht mehr.

| Block | Schritte | Stand |
|-------|----------|--------|
| A Zitation | 1–8 | Im Code (`citation.py`, `tools.py`, Instructions). ragrun lokal **1 Commit voraus**, nicht gepusht, nicht neu deployt. |
| B Vorträge | 11–13 | Hook in ragkeep, `get_lecture_info` / `list_lectures`, `list_volumes` mit `is_primary`, `ga`, `zyklus`. Beide Repos lokal **1 Commit voraus**, nicht gepusht. |
| B2 GA-Collection | `search_ga`, `search_ga_summaries` | Im selben ragrun-Commit. Collection `rudolf-steiner-ga`, getrennt von `search_corpus`. Kein Philo-`citation`. Beleg „(GA n, S. seite, Wortlaut nicht sicher)“. Noch kein Ebene-A-Fall, live nicht geprüft. |
| B Vorträge | 9–10 | Schema **019** auf Dev und Staging. **G4** 14.10.: Staging-Katalog 5302 Zeilen, 50 Zyklen (`19140208` ohne UUID ausgelassen, falscher Eintrag). Staging hat keine Vortrags-Chunks, daher 0 Lecture-Zeilen in `rag_sources`. Dev: 0 leere Lecture-Titel; GA 337b am 10.10.1920 zwei Titel (`19201010a`, `19201010c`). |
| C Herkunft | 15–16 | Im ragrun-Code (`ai_clients.yaml`, Grant-Upsert, `GET /app/ai-connections`). Nicht gepusht, nicht deployt. |
| C Herkunft | 14 | **020** und **021** am 14.10. auf Dev und Staging: `save_note`/`create_note` mit 1-MB-Grenze, `connector_grants.client_kind` (`varchar(32)`, Default `unknown`) und `redirect_host`. |
| D Tests | 17 | Letzter Lauf **1b, 1.10.**, nicht grün. Ohne Anton blockiert: G-01/03, A/C/U, H-01/02/05–07, V-02. Ebene A ohne `xfail` (C-07/CITE-02 gestrichen; V-04 nach DB-Bereinigung). |

### Weg zum Gate

Erledigt 18.10.2026: G1–G8, einschließlich G2b. Die Tabelle bleibt als Protokoll.

| # | Aufgabe | Akzeptanz |
|---|---------|-----------|
| **G1** | ragapp: `021` committen. ragapp, ragrun, ragkeep auf `philo-claude-integration` pushen. | Origin hat Beleg, Lecture-Tools, `search_ga` / `search_ga_summaries`, Hook, `ai_clients.yaml`, Migration 021. |
| **G2** | 019 auf Staging einspielen, falls die Tabellen fehlen. 020 und 021 auf Dev und Staging. | Staging hat Katalogtabellen und `source_type`/`ga`. Beide Umgebungen haben `client_kind`, `redirect_host` und die 1-MB-RPC. |
| **G3** | ragrun-MCP auf Dev deployen, danach Staging. Connector neu verbinden, damit Lecture-Tools und die GA-Suche in der Tool-Liste sind. | Dev-`list_volumes` liefert `is_primary`, `ga`, `zyklus`. `get_lecture_info`, `list_lectures`, `search_ga` und `search_ga_summaries` antworten gegen lokales Qdrant (`localhost:6333`) und den lokalen Embedder (`localhost:8001`). Ein Treffer aus `search_ga` hat `ga` und `page_start` oder lässt die Seite weg, und die Instructions verlangen „(GA n, S. seite, Wortlaut nicht sicher)“. Die Staging-Suche folgt nach G2b in G8. |
| **G4** | `sync_lectures.ts --all` gegen Staging. Auf Dev einmal prüfen: keine leeren Titel bei gechunkten Vorträgen, GA 337b am 10.10.1920 zwei verschiedene Titel. | Schritt 10. Hook (Schritt 11) synct beim nächsten Push nach `main` nur Dev. |
| **G5** | Neuen Grant auf Dev anlegen (Claude oder Cursor) und `GET /app/ai-connections` lesen. | `client_kind` ist nicht `unknown`. `claude-status` für alte Builds unverändert. |
| **G6** | Ebene A ohne erledigte `xfail`-Markierungen; F-4 nur noch Unit. A-03, C-03, U-04 bleiben „speichert oder lehnt strukturiert ab“, solange kein Enum-Check beschlossen ist. Dazu zwei Fälle für die Collection: `search_ga` mit einem bekannten Band (Treffer `chunk_type` `ga_text`, kein `citation`) und `search_ga_summaries` (Zusammenfassung, kein `citation`). Unbekanntes `ga` → `unknown_ga`. | `tests/mcp/level_a/README.md` nennt keine erledigten Befunde mehr als `xfail`. Die beiden GA-Fälle stehen im Testplan. |
| **G7** | Auf Dev: Cleanup, Seed, Handoffs, `pytest tests/mcp/level_a`, Cleanup. Token über `scripts/mcp_tests/mint.py` (Anton/Antonia). Bericht `tests/reports/ebene_a_<datum>.md`. | Kein Fehlschlag. Treffer mit `paragraph_id` haben `citation` (`citation_problem` leer). Die am 1.10. blockierten Fälle G-01/03, H-01/02/05–07, V-02 sind gelaufen. Der Lauf liest lokales Qdrant und den lokalen Embedder. |
| **G2b** | Lokaler Korpus ist bestätigt. Collections `rudolf-steiner-ga` und `philo-von-freisinn` vom Mac-Docker nach Tuxai kopieren (`deploy/tuxai/copy_collection.sh`). Railway Staging und Production an die Tailscale-IP anbinden. Variablen dort: `RAGRUN_QDRANT_URL=http://100.93.243.73:6333`, `RAGRUN_QDRANT_API_KEY`, `RAGRUN_EMBEDDINGS_PROVIDER=http`, `RAGRUN_EMBEDDINGS_BASE_URL=http://100.93.243.73:8001`. `.env.dev` bleibt auf `localhost:6333` und `localhost:8001`. | `rudolf-steiner-ga` auf Tuxai hat dieselbe Punktzahl wie das lokale Docker (12.10.2026: 183168). Ein Query-Embed gegen Tuxai `:8001` antwortet. Staging und Production lesen diese Kopie und denselben Tuxai-Embedder. Dev liest weiter lokal. Qdrant Cloud, Railway-`qdrant-staging` und der HF-/Modal-Query-Pfad sind für Staging und Production abgelöst. |
| **G8** | Dieselben Verträge auf Staging stichprobenweise: Suche, Passage, Handoff mit Beleg; `list_volumes` mit Metadaten; `list_lectures`; ein `search_ga`-Treffer; ein Grant mit `client_kind`. | Gate-Satz unten erfüllt. `search_ga` trifft die Tuxai-Kopie aus G2b. |

**Dev lokal, Tuxai für Staging und Production.** Auf Dev laufen Qdrant und Embedder lokal (Docker, `localhost:6333` und `localhost:8001`). Chunking, Embed und die Prüfung des Korpus passieren dort. Stimmt der Korpus, kopiert `copy_collection.sh` die Collections auf Tuxai. Staging und Production teilen sich diese eine Qdrant-Instanz und diesen einen Embedder, mit denselben Collection-Namen. Das Modell bleibt `intfloat/multilingual-e5-large`, lokal und auf Tuxai, damit die kopierten Vektoren zu den Query-Embeddings passen. Nutzerdaten bleiben in getrennten Supabase-Projekten. Ein späterer Korpus-Stand geht denselben Weg: lokal prüfen, dann Snapshot nach Tuxai. Eigene Collections pro Umgebung kommen erst mit der Korpus-Promotion, sobald ein Staging-Stand vom Production-Stand abweichen soll (`plans/ZUKUNFT/corpus-promotion.md`).

**Phase-1-Gate:** Staging-MCP mit Beleg in Suche, Passage und Handoff; `list_volumes` mit Metadaten; Lecture-Tools; `search_ga` und `search_ga_summaries` gegen `rudolf-steiner-ga` auf Tuxai (G2b); Grants mit `client_kind`; Hook synct Vorträge auf Dev; Ebene A auf Dev grün. Erst dann Phase 2.

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

### Block B2 — Collection `rudolf-steiner-ga` (ragrun)

Eigene Qdrant-Collection, nicht der Philo-Korpus von `search_corpus`. Sie liefert kein `citation`-Objekt. Stellenangabe für den Nutzer: „(GA n, S. seite, Wortlaut nicht sicher)“; ohne `page_start` die Seite weglassen, die Unsicherheit behalten. Lange zusammenhängende Passagen nicht an den Nutzer weitergeben. Die Tools sind dem Philo-Korpus nachgeordnet: erst `search_corpus`, die GA-Suche zum Prüfen und wenn der Korpus wenig ergibt.

| Tool | Inhalt | Filter |
|------|--------|--------|
| `search_ga` | Wortlaut, `chunk_type` `ga_text`. Treffer: `ga`, `lecture_id`, `vortragstitel`, `lecture_date`, `venue`, `page_start`/`page_end`, Text | `ga` (eins oder Liste, leer = alle), `lecture_id` (`YYYYMMDD` plus Buchstabe), `limit` 1–20, Default 8 |
| `search_ga_summaries` | Vortragszusammenfassungen, `chunk_type` `chapter_summary`. Orientierung, danach `search_ga` für den Wortlaut | dieselben Filter, Default `limit` 5 |

Unbekanntes `ga` → `{error, code: unknown_ga}` gegen `rag_lecture_catalog`. Leere Query → `empty_query`. Instructions in `server.py` und `handoff_instructions.md` nennen die Ausnahme schon bei Schritt 0.1. Ebene-A-Fälle kommen in **G6**, der Live-Nachweis in **G3** und **G7**. Bis **G2b** lesen Staging und Production noch Railway-Qdrant bzw. Qdrant Cloud. Dev liest lokales Docker.

**Tuxai** (`deploy/tuxai/compose.yaml`): ein Compose auf dem Pulse, Qdrant `qdrant/qdrant:v1.11.0` an Port 6333, Embedding-Dienst (`personal-embeddings-service`, Modell `intfloat/multilingual-e5-large`) an Port 8001 — Origin **`127.0.0.1`** für `cloudflared`. Railway Staging/Production erreichen Qdrant/Embed über **Cloudflare Tunnel + Access** (`deploy/tuxai/plan-tuxai-cloudflare-railway.md`), nicht Tailscale.

Gemessen 12.10.2026 am Container `ragrun-qdrant` (dasselbe Image): `rudolf-steiner-ga` 183168 Punkte, 366283 indizierte Vektoren, dicht 1024 float32 Cosine, Sparse `text-sparse`, HNSW `m=64` im RAM, ohne Quantisierung, Payload auf Platte, Collection 1,8 GB. `philo-von-freisinn`: 35340 Punkte, 328 MB Platte. Der Prozess belegt 2,17 GiB RAM für beide Collections. Ein Qdrant-Cloud-Free-Cluster (1 GB RAM) trägt das nicht. Auf Tuxai liegt deshalb eine Instanz für Staging und Production. Dev bleibt das lokale Docker und liefert den Korpus per Snapshot, sobald er stimmt.

### Block C — Verbindungsherkunft (Supabase + ragrun + ragapp)

| Schritt | Aufgabe | Lieferung | Akzeptanz |
|---------|---------|-----------|-----------|
| **14** | Migration **021** (ragapp): `connector_grants.client_kind`, `redirect_host`; `config/ai_clients.yaml` | `supabase/migrations/021_…sql`, ragrun config | Dev + Staging |
| **15** | Beim Grant/MCP: Domain → `client_kind` setzen; DCR-Metadaten auf Staging loggen | ragrun OAuth/MCP-Middleware | Neue Grants nicht `unknown` |
| **16** | `GET /app/ai-connections` (JWT); `claude-status` unverändert für alte Builds | `app_api.py` | Liste aktiver Verbindungen |

**Reihenfolge:** 14 → 15 → 16. Parallel zu Block A/B ab Schritt 14.

### Block D — Referenztests (ragrun)

Gerüst steht: Ebene-A-Suite in `ragrun/tests/mcp/` und Helfer in `ragrun/scripts/mcp_tests/`. Sprachmodelle sind nicht Teil davon. Fälle und Soll: [`../../tests/mcp/TESTPLAN_MCP.md`](../../tests/mcp/TESTPLAN_MCP.md). Fixtures nur in `tests/mcp/mcp_testdata.yaml`.

| Pfad | Rolle |
|------|--------|
| `tests/mcp/level_a/` | pytest gegen Streamable HTTP (`pytest tests/mcp/level_a`, optional `--mcp-id`) |
| `tests/mcp/test_mcp_citation.py` | Belegformat ohne Live-Server |
| `tests/mcp/mcp_live_support.py` | Token, Aufruf, `citation_problem` |
| `scripts/mcp_tests/seed_fixtures.py` | dauerhafte `[FIXTURE]`-Notizen |
| `scripts/mcp_tests/test_handoffs.py` | frische `[TEST]`-Handoffs vor dem Lauf |
| `scripts/mcp_tests/test_cleanup.py` | löscht nur `[TEST]` |
| `scripts/mcp_tests/mint.py` | JWT für Anton/Antonia |
| `scripts/mcp_tests/proxy.py` | stdio-Proxy für Cursor (Dev/Staging) |
| `tests/reports/ebene_a_<datum>.md` | Laufbericht |

Vor dem Lauf: Cleanup, Seed, Handoffs. Am Ende wieder Cleanup. Ein gewöhnliches `pytest` im Repo lässt Ebene A aus. Ablauf: `tests/mcp/level_a/README.md`.

| Schritt | Aufgabe | Lieferung | Akzeptanz |
|---------|---------|-----------|-----------|
| **17** | Ebene A auf Dev grün fahren | `pytest tests/mcp/level_a` | Bericht ohne Fehlschlag. Treffer mit `paragraph_id` haben vollständiges `citation` (`citation_problem` leer). Schreibfälle unter Anton/Antonia. Offen laut Testplan-Lauf 1b: G-01/03, A/C/U, H-01/02/05–07, V-02 |

**Entscheidungen Michael (blockieren das Gate nicht):** Korpus-Promotion A/B/C/D; Band vs. Einzelvortrag doppelt in `list_volumes`; Nicht-Vorträge eigener `source_type`; Enum-Prüfung für A-03, C-03, U-04.

---

## Phase 2 — App, Übergabe, Durchschaubar

Nach ragapp verschoben: `plans/filo-phase-2-werkstatt.md` (Schritte 18–34). Kommt später.

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

Erledigt 18.10.2026 (läuft oder gestrichen).

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

**Kritischer Pfad Phase 1:** 1 → 2 → 3 und 9 → 10 → 12 → 13 und 14 → 15. `search_ga` / `search_ga_summaries` auf Dev hängen am lokalen Qdrant und Embedder (G3, G7). Die Staging-Suche hängt am Snapshot nach Tuxai (**G2b**, nach bestätigtem lokalem Korpus, vor G8), an Tailscale von Railway und an der Embedding-URL auf dem Pulse. Kein weiteres Schema.

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

Geschlossen 18.10.2026: Formpaket vor **23**, Aktivitätslog-Umfang vor **29**, Korpus-Promotion vor einem eigenen Staging-Stand, Band gegen Einzelvortrag in `list_volumes`, Nicht-Vorträge eigener `source_type`. `note_conversations` (Schritt 38) bleibt bei Phase 3.

Qdrant und Embeddings: Dev lokal, Staging und Production gemeinsam auf Tuxai (G2b erledigt).

---

## Nächster konkreter Start

Keiner in diesem Plan. Das Phase-1-Gate ist zu. Phase 2 steht in ragapp `plans/filo-phase-2-werkstatt.md`.

---

## Mittelfristig deprecated

`app_starter_prompts`, `llm_pricing` und `vector_chunks` fallen weg. Sie gehören nicht in die Korpus-Kopie Dev → Staging → Production. DROP mit dem Aufräumen in Schritt **40**, nicht vorher: alte TestFlight-Builds können die Tabellen noch lesen. `sync_prod_to_dev.mjs` nimmt `app_starter_prompts` und `llm_pricing` heute noch mit; der Vorwärts-Sync lässt sie aus.
