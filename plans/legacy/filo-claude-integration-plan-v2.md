# Filo × Claude — Implementationsplan v2

> **Archiv** — siehe [`../ZUKUNFT/filo-naechste-schritte.md`](../ZUKUNFT/filo-naechste-schritte.md) und [`../claude-philo-phasenplan.md`](../claude-philo-phasenplan.md).

Erstellt 24.09.2026. Löst den früheren Plan ([`filo-claude-integration-plan.md`](./filo-claude-integration-plan.md)) ab.

**Ausgangslage:** Frische Branches von `main` in **ragapp**, **ragrun** und Schema-Arbeit gegen **ragxxx** (Supabase). Unfertige Arbeit auf `philo-claude-integration` / ähnlichen Branches **nicht** mergen — höchstens als Referenz lesen.

**Nicht mehr im Plan** (erledigt, entfallen oder verworfen):
- Deep-Link-Test als Arbeitsschritt (Ergebnis steht, siehe §0)
- Neue Absatz-ID-Schicht (UUID existiert)
- Spezial-Korpusabgleich / Qdrant-Payload-Umbau für 1.0
- `user_profiles`, `claude_tier`
- Einladungs-Gate (wird entfernt, nicht weiterentwickelt)

---

## 0. Gegebene Fakten (kein Arbeitsschritt)

| Fakt | Quelle |
|------|--------|
| Absatz-PK ist UUID (`rag_paragraphs.id`) | Migration 0023; `app_paragraph_chunk` mappt Chunk → UUID |
| Absprung Claude: HTTPS `claude.ai/new?q=…` | Getestet iOS + Android (23.09.2026); Browser ohne Claude-App funktioniert |
| Default-Deep-Link-Strategie | `native_app` via HTTPS Universal Link; Prompt nie auto-senden |
| Domain | `ragxxx.com` |
| Chat/Problem-Solver/App-Tools | Entfallen zugunsten Claude + MCP |
| DeepSeek | Bleibt nur für Pipeline (ACE, Typology/Thought/Quote-Explain, Action-Prompt) |

---

## A. Entscheidungen (verbindlich)

| Thema | Entscheidung |
|-------|--------------|
| Bücher offline | Gebündelte SQLite `books.db`, kein WatermelonDB |
| Nutzerdaten | Direkt Supabase (+ RPCs für Arbeitstexte) |
| Arbeitstexte | Soft-Delete; Versionierung; Anlegen durch Claude nur auf Wunsch |
| Protokolle | Pro Kapitel/Vortrag; Eintrag optional mit `paragraph_id` |
| Handoff | Kurz-ID aus DB; Anweisungen in `handoff_instructions.md` (Server) |
| Claude-App | Nicht voraussetzen; Browser reicht |
| Detail-Default | Immer `"kurz"`; kein Tarif abfragen |
| Connector-Status | Tabelle `connector_grants` + `GET /app/claude-status` |
| Status-Werte | `not_connected` \| `connected_unused` \| `connected` \| `revoked` |
| Auth-Consent | Selbst gebaut auf `ragxxx.com`: Email-OTP + Apple + Google |
| Registrierung | Offen (kein Invite-Gate); MCP-first möglich |
| OAuth-Grant | Jeder erfolgreiche MCP-Grant (client_id aus DCR), nicht an Claude-Redirect-URI gekoppelt |
| Connector-Setup | Prefill-Deep-Link → **Add** → **Connect** → OAuth (Add allein = kein Grant) |

---

## B. Zielbild Daten

| Datentyp | Ziel |
|----------|------|
| Buchinhalte / Katalog | `books.db` (bundle + OTA) |
| Arbeitstexte | `app_notes` + `app_note_versions` via `create_note` / `save_note` / … |
| Lesezeichen | `app_bookmarks` in Supabase |
| Leseposition | AsyncStorage first, Sync nach Supabase |
| Protokolle | `protocols` + `protocol_entries` |
| Handoffs | `handoffs` + `create_handoff()` |
| Connector | `connector_grants` |
| Korpus-Redirect | `passage_redirect` (1.0 leer, Pass-through) |
| Chat / Starter-Prompts / Invite | Entfernt |

---

## C. Abbau (was weg muss)

**ragapp:** WatermelonDB (`database`, schema, models, sync, seedLoader, `db-snapshot.json`), Chat-UI/Repos/API-Client, Invite-UI + Gate, `@nozbe/watermelondb`.

**ragrun:** Chat-Endpunkte/Services/Graph, Problem-Solver, `app/tools/`, Sync-Endpunkte, Invite-API (falls noch vorhanden).

**Supabase (spät, nach neuem Build bei Testern):** `pull_changes`/`push_changes`, `ms_to_ts`/`ts_to_ms`, `app_starter_prompts`, `invitations`. Chat-Tabellen archivieren (nicht mehr ansprechen).

---

## D. Implementationsschritte (Reihenfolge)

Nummerierung ist die Ausführungsreihenfolge. Parallelität nur wo unter dem Schritt vermerkt.

### Schritt 1 — Einladungs-Gate entfernen

**Repos:** ragapp, ragrun, optional Supabase später.

- Invite-UI, `invitationService`, Login/Register-Gate entfernen
- ragrun `/app/invitations/*` und Edge Function `send-invitation` entfernen
- Offene Registrierung (Email-OTP)
- Tabelle `invitations` erst in Schritt 14 droppen (alte Builds)

**Test:** Neuer User ohne Code registrierbar.  
**Danach:** MCP-first und Consent-Seite können Accounts anlegen.

---

### Schritt 2 — Supabase-Schema (Migration 018)

**Repos:** `ragapp/supabase/migrations/018_claude_integration.sql` → **ragxxx dev und Staging**.

Inhalt (kein `user_profiles`):
- `app_notes`: title, text_type, status, version, quotes, created_by, …
- `app_note_versions`; RPCs `create_note`, `save_note`, `delete_note`, `undelete_note`
- `protocols`, `protocol_entries`
- `handoffs` + `create_handoff()`
- `passage_redirect`, `connector_grants` (inkl. `client_name`)
- RLS: `app_notes` nur SELECT für Client; Schreiben nur über RPCs; Grants nur SELECT

**Test:** Tabellen + RPCs + RLS auf Dev und Staging.  
**Hinweis:** Solange die App noch Watermelon-`push_changes` nutzt, bleibt Sync für Notes lauffähig (SECURITY DEFINER). Nach Schritt 6/7 nur noch RPCs.

---

### Schritt 3 — `books.db` Build-Pipeline

**Repo:** ragapp.

- `scripts/fetch-db-seed.mjs` schreibt `assets/seed/books.db` (better-sqlite3)
- Absätze nur `deprecated_at IS NULL`; optional `passage_redirect` aus Supabase mitziehen (sonst leere Tabelle)
- Schema: `sources`, `paragraphs`, `passage_redirect`; `PRAGMA user_version`
- Metro: Asset-Typ `.db`; Einbindung in `app.config.js`
- `db-snapshot.json` / seedLoader bleiben vorerst (entfernt in Schritt 7)

**Test:** `yarn seed:fetch` erzeugt lesbare DB mit UUIDs.  
**Noch nicht:** App liest die Datei erst ab Schritt 5.

---

### Schritt 4 — Branch öffnen: Chat-UI raus, Platzhalter

**Repo:** ragapp. **Ein Branch** für Schritte 4–7 (erst mergen, wenn Lesen/Suchen/Bücher wieder laufen).

- Chat-Screens/Repos/API-Client löschen (Abbauliste)
- Tab 0 → Platzhalter („Werkstatt kommt“)
- Bücher / Lesen / Suche vorübergehend weiter über Watermelon, bis Schritt 5–6 greifen

**Test:** App startet; Tabs Bücher/Lesen/Suche noch nutzbar.

---

### Schritt 5 — Buch-Cache anbinden (Lesen offline)

**Repo:** ragapp (gleicher Branch).

- `src/data/lib/booksDb.ts`: Bundle → Dokumentenverzeichnis, expo-sqlite
- API: `getParagraph`, `getParagraphsBySource` / Segment, `getSources`, `getCorpusVersion`, `resolveRedirect` (1.0 Pass-through)
- `ParagraphRepository` + `SourceRepository` → nur `booksDb`
- Screens (Overview, Read, Suche-Treffer-Navigation) auf neue API (kein `observe*` / Watermelon-Models)
- Boot: Korpus **nicht** mehr aus Watermelon-Paragraphen

**Test:** Frische Installation liest alle Absätze offline aus `books.db`.  
**Abhängigkeit:** Schritt 3.

---

### Schritt 6 — Nutzerdaten-Repos + Editor

**Repo:** ragapp (gleicher Branch). **Abhängigkeit:** Schritt 2.

- Repositories: Notes (RPCs), Bookmarks (Supabase + last-read AsyncStorage-first), Protocols, Handoffs
- Hooks: `useNote(s)`, `useBookmarks`, `useProtocol`, später `useConnectorStatus` (Schritt 12)
- `NoteEditorModal` + Call-Sites: Version, Konflikt, Soft-Delete/Papierkorb
- Alle UI-Aufrufe an die neuen Signaturen anpassen (kein Watermelon-Note-Model)

**Test:** CRUD Arbeitstexte/Lesezeichen über JWT; Konflikt bei Versionsmismatch.

---

### Schritt 7 — WatermelonDB vollständig entfernen

**Repo:** ragapp (gleicher Branch). **Abhängigkeit:** 5 + 6.

- Dependency, `database`/`schema`/`migrations`/`models`, `sync.ts`, `seedLoader.ts`, `db-snapshot.json` weg
- Babel-Decorators / expo-doctor-Exclude für Watermelon weg
- Kein `pull_changes`/`push_changes` mehr aus der App

**Test:** App kompiliert und läuft ohne `@nozbe/watermelondb`.  
**Merge-Punkt:** Nach Schritt 7 (Lesen + Nutzerdaten stabil) Branch nach `main` möglich.

---

### Schritt 8 — Expo-Upgrade (54 → 57)

**Repo:** ragapp. **Abhängigkeit:** Schritt 7 (Watermelon war Blocker).

- Major-Schritte 54→55→56→57 mit `expo install --fix`, jeweils `expo-doctor`
- RN steigt mit; Reanimated / pager-view / worklets / FlashList prüfen

**Test:** `expo-doctor` clean; Simulator startet.

---

### Schritt 9 — Korpus-OTA-Update

**Repos:** ragrun + ragapp. **Abhängigkeit:** Schritt 5.

- `GET /app/corpus-version` → `{ version, download_url, size_bytes? }`
- Seed erhöht `user_version` bei Korpus-Release; gleiche Zahl serverseitig
- App: lokal `PRAGMA user_version` vs Server; bei Diff Hintergrund-Download, atomar ersetzen, alte DB bis dahin weiter nutzen
- Hosting der `.db` (Storage/CDN) festlegen

**Test:** Erhöhte Server-Version löst Update aus; UI bleibt während Download nutzbar.

---

### Schritt 10 — OAuth-Vortest

**Repo:** ragrun (+ Supabase-Konfig). Früh, bevor der volle MCP-Aufwand.

- Minimaler MCP (`/mcp/`) mit Tool `whoami` (User-ID aus Token)
- Supabase OAuth 2.1 + Dynamic Client Registration aktivieren
- Minimale selbst gebaute Autorisierungsseite (Login + Consent) — Richtung wie Schritt 12
- Als Custom Connector in Claude; Token-Refresh prüfen

**Test:** Claude autorisiert; `whoami` korrekt; Refresh ok.  
**Falls Supabase-Weg scheitert:** Fallback eigene Endpunkte (`/mcp/authorize|token|register`); User-Token-Prinzip bleibt. Schritt 12 anpassen.

---

### Schritt 11 — MCP-Server (lesend)

**Repo:** ragrun. **Nicht öffentlich** bis Schritt 12 (Dummy-User / Zugangssperre).

- FastMCP unter `app/mcp_server/`, Mount `/mcp/`
- `resolve_passage` (1.0 Pass-through)
- Tools: `search_corpus`, `get_passage`, `get_protocol`, `list_work_texts`, `get_work_text`, `list_volumes`
- Resource `band_list`, Prompt `philo_voice`, `config/handoff_instructions.md`
- `detail`-Default `"kurz"`; Auszüge knapphalten
- Server-Instructions: Korpus, Stufenlieferung, Regeln zu Arbeitstexten/Protokollen/return_url

**Test:** MCP-Inspector listet Tools; Suche/Passage liefern UUIDs + Metadaten.  
**Abhängigkeit:** Schritt 2 für Notes/Protocols-Schema; Retrieval existiert bereits.

---

### Schritt 12 — OAuth produktiv + Consent + Status

**Repos:** Supabase, ragrun, Auth-Web auf `ragxxx.com`, ragapp Auth. **Abhängigkeit:** 10 + 11 + 2.

- Authorization Server = Supabase (oder Fallback aus 10)
- MCP prüft User-JWT; Korpus ggf. Service-Key; Nutzerdaten mit User-Token (RLS)
- Consent-Seite: Email-OTP + Apple + Google (Web-Provider); App: Native Apple/Google ergänzen
- Bei Grant: Zeile in `connector_grants`
- MCP aktualisiert `last_mcp_request` (gedrosselt ≤1/min)
- `GET /app/claude-status` → Status-Semantik aus A
- Redirect zurück zum Client (Claude), kein Umweg

**Test:** Connector verbindet; Grant sichtbar; Status-Endpoint korrekt; Tools sehen User.

---

### Schritt 13 — MCP schreiben

**Repo:** ragrun. **Abhängigkeit:** Schritt 12 + 2.

- `update_work_text`, `create_work_text`, `append_to_protocol`, `get_handoff` (+ instructions aus Datei; abgelaufen → verständliche Meldung + ggf. `paragraph_id`)

**Test:** Schreiben nur mit Token; Versionskonflikt; Handoff-Expiry-Fallback.

---

### Schritt 14 — Domain, Universal Links, Absprung-Config

**Repos:** DNS/`ragxxx.com`, ragrun static, ragapp.

**14a.** DNS + HTTPS  
**14b.** `apple-app-site-association`, `assetlinks.json`; Routen `/passage/{id}`, `/text/{id}`; Fallback-Seiten (Passage sichtbar, Text privat)  
**14c.** `GET /app/deep-link-config` — Default HTTPS/`native_app` (aus §0); ohne App-Release umschaltbar  
**14d.** App: Linking für Passage/Text; Redirect/Grabstein aus `books.db`; fehlende/fremde Texte verständlich melden

**Test:** Link öffnet App bzw. Fallback; Config steuert Absprung zu Claude.

---

### Schritt 15 — Einrichtung, Übergabe, Werkstatt-Tab

**Repo:** ragapp. **Abhängigkeit:** 12–14, Editor aus 6.

**15a. Connector-Setup**
1. Claude-Konto?
2. Prefill-Link `claude.ai/customize/connectors?modal=add-custom-connector&…` (Fallback: URL kopieren)
3. In Claude: Add → Connect → OAuth (Consent)
4. App: `GET /app/claude-status`
- Free: ein Connector-Platz; Claude-App nicht voraussetzen

**MCP-first:** Connector in Claude → Consent (Registrierung) → Grant → später App-Login → Status schon verbunden

**15b. Übergabe-Sheet** („Im Arbeitszimmer vertiefen“) → Handoff-ID → Prompt mit `?q=` laut deep-link-config

**15c. Tab 0 = Werkstatt**
- connected / connected_unused / not_connected|revoked / nicht eingeloggt — Inhalte laut Entscheidung A

**Test:** Setup &lt; 2 Min inkl. Add→Connect; Handoff → Claude → `get_handoff`; Tab-Zustände ok.

---

### Schritt 15d — Konsistenzprüfung Vortrags-Daten

**Abhängigkeit:** Schritt 15c (Daten aus `rag_lecture_catalog` + `rag_sources` müssen geladen sein).

Claude sieht über `list_volumes` 333 Quellen: 57 Bände (v4-UUIDs) und 276 Einzeltexte (v5-UUIDs, aus dem Vortragskatalog). Dabei sind folgende Schwächen aufgefallen:

**Datenqualität im Katalog / in `rag_sources`:**
- **~40 Einträge ohne Titel** — erscheinen nur als „Rudolf Steiner". Ursache: `vortragstitel` leer in der Katalog-YAML → wird so nach `rag_sources.title` übernommen.
- **~70 generische Titel** wie „Vortrag 1" bis „Vortrag 14", „Erster Vortrag" usw. — ohne Band-Kontext nicht unterscheidbar. „Vortrag 1" kommt 7× vor.
- **Scheinbare Dubletten** bei Titeln (z.B. „Proletarische Forderungen…", „Oberschlesien" mit/ohne Punkt). Können echte Parallelvorträge in verschiedenen Städten sein, müssen aber geprüft werden.

**Strukturelle Lücke Band ↔ Einzelvorträge:**
- Manche Vortragsbände (z.B. „Allgemeine Menschenkunde", „Nationalökonomischer Kurs") stehen als ganzer Band in der Liste, ihre Einzelvorträge aber nicht als Einzelquellen. Andere Bände (z.B. „Anthroposophie") erscheinen zusätzlich als Einzelvorträge.
- **~25 Einträge sind keine Vorträge** im engeren Sinn (Besprechungen, Schlussworte, Seminarbesprechungen, Disputationsabende).

**Aufgaben:**
- [ ] Titellose Einträge identifizieren (Stichproben-Suche über UUID → Chunk-Metadaten)
- [ ] Generische Titel mit Band-Info anreichern (z.B. „Vortrag 1" → „Vortrag 1 (GA 293, Allgemeine Menschenkunde)")
- [ ] Dubletten prüfen und ggf. bereinigen
- [ ] Entscheiden: Sollen Bände mit Einzelvorträgen doppelt erscheinen, oder nur in einer Form?

**Test:** `list_volumes` liefert für jeden Eintrag einen unterscheidbaren, aussagekräftigen Titel.

---

### Schritt 16 — Testen und nachschärfen

- 5–10 Tester mit Connector
- Tool-Texte, `detail`, Auszugslängen

**Test:** Filo → Claude → Filo fühlt sich natürlich an.

---

### Schritt 17 — Aufräumen + Migration 019

**Voraussetzung:** Alle Tester auf Build ohne Watermelon/Invite.

```sql
DROP FUNCTION IF EXISTS pull_changes(bigint, integer);
DROP FUNCTION IF EXISTS push_changes(jsonb, bigint);
DROP FUNCTION IF EXISTS ms_to_ts(bigint);
DROP FUNCTION IF EXISTS ts_to_ms(timestamptz);
DROP TABLE IF EXISTS app_starter_prompts;
DROP FUNCTION IF EXISTS increment_starter_prompt_click(uuid);
DROP TABLE IF EXISTS invitations;
```

- ragrun: Chat, Problem-Solver, `app/tools/`, Sync-Routen entfernen
- DeepSeek + `rag_usage` / `llm_pricing` behalten

**Test:** ragrun startet; Pipeline-Tools laufen.

---

### Schritt 18 (optional) — Desktop-MCP

- Anleitung Claude Desktop / Code / Cursor
- Eigener OAuth-Grant pro Client; Account von App oder Consent
- Hinweis auf App in Tool-Antworten / `get_app_info`

Kein Launch-Blocker.

---

## E. Abhängigkeitsübersicht

```
1 Invite ──┐
2 Schema ──┼──→ 6 Nutzerdaten-Repos ──→ 7 Watermelon weg ──→ 8 Expo
3 books.db ──→ 5 Buch-Cache ─────────────┘         │
4 Chat-UI Platzhalter ─────────────────────────────┘
                5 ──→ 9 Korpus-OTA

10 OAuth-Vortest ──→ 11 MCP lesen ──→ 12 OAuth+Consent ──→ 13 MCP schreiben
2 Schema ────────────────────────────────────────────┘
12 + 14 Links + 6 Editor ──→ 15 Setup/Handoff/Tab ──→ 16 Test ──→ 17 Cleanup
                                                      └──→ 18 optional
```

**Zwei Ketten bis Launch:**
1. App-Daten: 1→2→3→4→5→6→7→(8)→9→15c
2. MCP: 1→2→10→11→12→13→15a/b

**Parallel sinnvoll:** 1∥2∥3 früh; 10 früh neben 4–7; 14 neben 11–13.

---

## F. Risiken

| Risiko | Gegenmaßnahme |
|--------|----------------|
| OAuth 2.1 / DCR bei Supabase unzureichend | Schritt 10 früh; Fallback eigene Endpunkte |
| Free-Claude-Kontingent | `detail: "kurz"`, knappe Auszüge |
| Große OTA-`books.db` | Hintergrund, alte Version bis Replace |
| App+Claude schreiben parallel | `save_note` + FOR UPDATE + Konflikt-UI |
| Alte TestFlight nach 019 | 019 erst nach Schritt 16 / neuem Build |
| Add ohne Connect | Setup-Copy + Status `not_connected` erklären |

---

## G. Mapping alt → neu

| Alt (v1) | Neu (v2) |
|----------|----------|
| 1 Deep-Link-Test | §0 Fakt (kein Schritt) |
| 2, 5, 6 | Entfallen |
| 8e Invite | **1** |
| 8d Schema | **2** |
| 3 books.db | **3** |
| 8c Chat-UI | **4** |
| 9a/9e/9f | **5** |
| 9b–9d | **6** |
| 8a Watermelon | **7** |
| 8b Expo | **8** |
| 4 Corpus-Update | **9** |
| 7 OAuth-Vortest | **10** |
| 10 MCP lesen | **11** |
| 11 OAuth+Consent | **12** |
| 11c Schreiben | **13** |
| 12 Links | **14** |
| 13 Setup/Handoff/Tab | **15** |
| 14 Test | **16** |
| 15 Cleanup | **17** |
| 16 Desktop | **18** |
