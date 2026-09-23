# Filo × Claude — Implementationsplan

Erstellt 21.09.2026, überarbeitet 22.09.2026. Basiert auf dem Briefing `filo-claude-integration-briefing.md`, Code-Bestandsaufnahme von ragrun, ragapp und Supabase, den Änderungen aus `filo-plan-aenderungen.md`, Runde 2 und Runde 3 der Änderungen.

---

## A. Entscheidungen

| Frage | Entscheidung |
|-------|-------------|
| MCP-Server | Existiert nicht, wird neu gebaut. Es gibt nur DeepSeek-Functions. |
| Notes = Arbeitstexte | Ja. `app_notes` ist die bestehende Tabelle, „Arbeitstext" der neue Name. Schema wird erweitert. |
| Absatz-IDs | **Neuanfang.** Stabile Zufalls-IDs von Anfang an, dauerhaft in ragkeep aufbewahrt. Keine Rücksicht auf bestehende Daten. |
| WatermelonDB | **Vollständig entfernen.** Nutzerdaten direkt über Supabase. Bücher als gebundelte SQLite-DB bei Installation. |
| Problem-Solver | **Entfernen.** |
| DeepSeek nach Chat-Entfernung | Schlüssel bleibt für Pipeline-Tools (ACE, Typology-Explain, Thought-Explain, Quote-Explain, Action-Prompt). Kein App-facing-LLM mehr. |
| Embedding-Kosten | Akzeptabel. HuggingFace-API bleibt. |
| Urheberrecht | Nicht-gemeinfreie Bände werden vor Launch entfernt. Kein Blocker für den Plan. |
| Protokolle | Pro Kapitel bzw. Vortrag, nicht pro Absatz. Einträge können optional auf einen Absatz verweisen. |
| Arbeitstexte anlegen | Claude kann neue Arbeitstexte anlegen (über `create_work_text`), nur auf ausdrücklichen Wunsch des Nutzers. |
| Domain | `ragxxx.com` ist die endgültige Domain für Universal Links und App Links. |
| Arbeitstexte löschen | **Soft-Delete** (`deleted_at`-Spalte statt endgültiges Löschen). Papierkorb-Ansicht mit Wiederherstellen. Rücklinks bleiben verständlich, versehentliches Löschen rückgängig. |
| Handoff-Anweisungen | Stehen in Serverkonfiguration (`handoff_instructions.md`), nicht im Handoff-Datensatz. Änderbar ohne App-Release. |
| Handoff-ID | Erzeugt die Datenbank (`create_handoff()`), nicht die App. Alphabet ohne verwechselbare Zeichen. |

---

## B. Bestandsaufnahme — Zusammenfassung

### B.1 ragrun Backend

| Bereich | Befund |
|---------|--------|
| **MCP-Server** | Existiert nicht. Muss komplett neu gebaut werden. |
| **LLM (DeepSeek)** | Chat + 5 Pipeline-Services. Chat entfällt, Pipeline bleibt. |
| **Embeddings** | `intfloat/multilingual-e5-large` über HuggingFace Inference API. Bleibt. |
| **Core-Retrieval** | Hybrid-Suche (dense + BM25) über Qdrant. Unabhängig vom Chat. Wird Basis der MCP-Tools. |
| **Auth** | Supabase JWT (RS256 + HS256-Fallback). Kein OAuth 2.1. |
| **App-Tools** | Registry mit `create_document`, `read_blocks`, `update_document`. Entfällt, wird durch MCP-Tools ersetzt. |

### B.2 ragapp Frontend

| Bereich | Befund |
|---------|--------|
| **Lokale DB** | WatermelonDB 0.28.0 (SQLite), Schema v24, 8 Tabellen. **Wird komplett entfernt.** |
| **Sync** | `pull_changes`/`push_changes`. **Entfällt.** |
| **Absatz-IDs** | Format `{source_id}:{segment_index}:{paragraph_number}`. **Wird durch stabile Zufalls-IDs ersetzt.** |
| **Chat-UI** | `FiloScreen.tsx`, `ChatTab.tsx` (1294 Z.), `GespraecheTab.tsx`, `ArbeitstextTab.tsx`. **Entfällt.** |
| **Deep Links** | Nur `ragapp://` für Auth. Keine Universal Links. **Werden in Schritt 5b gebaut** — nötig für `return_url`-Rückwege von Claude in die App. |
| **Tabs** | [0] Filo (Chat), [1] Bücher, [2] Lesen, [3] Suche. |

### B.3 Supabase-Schema

| Bereich | Befund |
|---------|--------|
| **Tabellen** | 12 Tabellen, 18 Migrationen. |
| **Entfällt** | `rag_talks`, `rag_turns`, `rag_references`, `app_starter_prompts`, `pull_changes`/`push_changes` RPC. |
| **Bleibt** | `rag_paragraphs` (+ `stable_id`, `lemma_fingerprint_hash`, `split_from`), `rag_chunks`, `rag_sources`, `vector_chunks`. |
| **Wird erweitert** | `app_notes` → Arbeitstexte mit Versionierung. `app_bookmarks` → direkt über Supabase. |
| **Neu** | `app_note_versions`, `user_profiles`, `protocols`, `protocol_entries`, `handoffs`, `passage_redirect`. |

### B.4 DeepSeek-Funktionen — Was bleibt, was entfällt

| # | Funktion | Entscheidung | Grund |
|---|----------|-------------|-------|
| 1 | App-Chat (Stream + Sync) | **Entfällt** | Durch Claude ersetzt |
| 2 | Chat-Graph (LangGraph) | **Entfällt** | Unterbau des Chats |
| 3 | Tool-Loop (document tools) | **Entfällt** | Durch MCP-Tools ersetzt |
| 4 | Summarize | **Entfällt** | Keine eigenen Gespräche |
| 5 | Compress | **Entfällt** | Keine eigenen Gespräche |
| 6 | Problem-Solver | **Entfällt** | Entscheidung Michael |
| 7 | Concept-Explain (ACE) | **Bleibt** (Pipeline) | Admin/Augmentation-Tool |
| 8 | Typology-Explain | **Bleibt** (Pipeline) | Admin/Augmentation-Tool |
| 9 | Thought-Explain | **Bleibt** (Pipeline) | Admin/Augmentation-Tool |
| 10 | Quote-Explain | **Bleibt** (Pipeline) | Admin/Augmentation-Tool |
| 11 | Action-Prompt | **Bleibt** (Pipeline) | Admin/interne API |

**Folge:** DeepSeek-API-Schlüssel bleibt für Pipeline-Tools (#7–#11). Kein LLM-Aufruf mehr durch App-Nutzer.

---

## C. Entscheidungstabelle: Datentyp × Ziel

| Datentyp | Heute | Ziel 1.0 | Betroffene Dateien |
|----------|-------|----------|-------------------|
| **Arbeitstexte** | `app_notes` in WatermelonDB + Sync | `app_notes` in Supabase direkt, + Version, Typ, Status, Gesprächslink | Neue Supabase-Repositories, Hooks, Editor |
| **Protokolle** | — | Neue Tabellen `protocols` (pro Kapitel/Vortrag) + `protocol_entries` (mit optionalem `paragraph_id`), append-only | Neues MCP-Tool, neues App-Overlay |
| **Lesezeichen** | `app_bookmarks` in WatermelonDB + Sync | `app_bookmarks` in Supabase direkt | Neue Supabase-Repositories |
| **Leseposition** | `is_last_read`-Bookmark | **Lokal-first (AsyncStorage)**, bei Verbindung nach Supabase | BookmarkRepository, AsyncStorage |
| **Buchinhalte** | `paragraphs` in WatermelonDB (Sync via `db-snapshot.json`) | **Gebundelte SQLite-DB** (`books.db`) bei Installation, offline lesbar | Umbau `fetch-db-seed.mjs`, neues Cache-Modul |
| **Bücher-Katalog** | `rag_sources` in Supabase (Sync via `db-snapshot.json`) | **In gebundelter SQLite-DB** + Supabase für MCP | Teil von `fetch-db-seed.mjs` |
| **Chat-Verlauf** | `talks`/`turns`/`references` | **Entfällt komplett** | Alles löschen |
| **Starter-Prompts** | `starter_prompts` | **Entfällt** | Löschen |
| **Einstellungen** | AsyncStorage | Bleibt lokal + `claude_tier` in Supabase | SettingsContext + `user_profiles` |
| **Such-Chunks** | On-demand von ragrun | Bleibt, wird MCP-Tool `search_corpus` | ragrunApi → MCP |
| **Nutzungsdaten** | `rag_usage` + `llm_pricing` | Bleiben für Pipeline-Tracking, kein App-facing-LLM mehr | — |
| **WatermelonDB** | Gesamte Schicht | **Entfällt komplett** | DB, Schema, Migrations, Models, Sync — alles raus |

---

## D. Abbauliste (Was entfernt wird)

### D.1 ragapp — Komplett entfernen

| Modul | Dateien | Zeilen (ca.) |
|-------|---------|-------------|
| WatermelonDB | `database.ts`, `schema.ts`, `migrations.ts`, `models/*.ts` (8), `sync.ts` | ~1.100 |
| Chat-UI | `ChatTab.tsx`, `GespraecheTab.tsx`, `ArbeitstextTab.tsx`, `ConversationDetailScreen.tsx` | ~2.000 |
| Chat-Repositories | `TalkRepository.ts`, `TurnRepository.ts`, `ReferenceRepository.ts`, `StarterPromptRepository.ts` | ~290 |
| Chat-API-Aufrufe | `ragrunApi.ts` (chat/*, compress, summarize) | ~200 |
| WatermelonDB-Dependency | `@nozbe/watermelondb` in `package.json` | — |

### D.2 ragrun — Komplett entfernen

| Modul | Dateien | Beschreibung |
|-------|---------|-------------|
| Chat-Endpunkte | `app/api/app_api.py` (chat-Routen), `app/api/chat.py` | App-Chat + öffentlicher Chat |
| Chat-Services | `app_chat_service.py`, `app_chat_stream_service.py` | Sync + Streaming Chat |
| Chat-Graph | `assistant_chat_graph.py` (47 KB), `intents.py` | LangGraph Chat-Orchestrierung |
| Problem-Solver | `problem_solver_graph.py`, Endpoint | Sokratischer Dialog |
| Tool-Registry | `app/tools/` (registry, types, create_document, read_blocks, update_document) | DeepSeek Function-Calling |

### D.3 Supabase — Entfernen / Archivieren

| Objekt | Aktion |
|--------|--------|
| `pull_changes()`, `push_changes()` RPC | Entfernen |
| `ms_to_ts()`, `ts_to_ms()` | Entfernen (WatermelonDB-spezifisch) |
| `app_starter_prompts` + `increment_starter_prompt_click()` | Entfernen |
| `rag_talks`, `rag_turns`, `rag_references` | Archivieren (Daten lassen, nicht mehr ansprechen) |

---

## E. Implementationsplan

### Schritt 0: Deep-Link-Test (vorgezogen)

Der Deep Link ist das größte Risiko des Vorhabens, hängt von nichts ab und ist schnell erledigt. Sein Ergebnis entscheidet, ob der Absprung nach Claude so funktioniert wie geplant, bevor Aufwand in die übrigen Schritte fließt.

**Warum physische Geräte nötig sind:** Der iOS-Simulator kann keine App-Store-Apps installieren — die Claude-App fehlt. Universal Links und SFSafariViewController verhalten sich anders als auf echtem Gerät. Der Android-Emulator kann mit Play-Store-Image theoretisch Claude installieren, aber App Links und Intent-Handling weichen oft ab. Simulatoren taugen höchstens zum Vorab-Check der eigenen Test-UI, nicht für die eigentlichen Deep-Link-Tests.

**Benötigte Geräte:**
- Ein physisches iOS-Gerät (iPad reicht)
- Ein physisches Android-Gerät (beliebig, aktuelles OS)

**Umsetzung:**

1. Debug-Screen in ragapp bauen: eine Seite mit 4 Buttons (einer pro Link-Variante), konfigurierbar mit Test-Prompt-Text. Nur in Dev-Builds sichtbar.
2. Dev-Build per EAS Build (oder Expo Dev Client) auf das iPad laden.
3. Claude-App aus dem App Store auf dem iPad installieren.
4. Alle 4 Varianten × 4 Zustände auf dem iPad durchspielen, Ergebnis in Tabelle eintragen.
5. Dasselbe auf dem Android-Gerät (Claude aus Play Store, Dev-Build per APK oder EAS).

**Link-Varianten (4):**
1. `Linking.openURL('https://claude.ai/new?q=…')` — HTTPS Universal Link
2. `claude://claude.ai/new?q=…` — custom scheme
3. Android-Intent: `intent://claude.ai/new?q=…#Intent;scheme=https;package=com.anthropic.claude;end` (Android-Paketnamen im Play Store prüfen)
4. In-App-Browser: `expo-web-browser` mit `claude.ai/new?q=…`

**Gerätezustände (4):**
- A: Claude-App nicht installiert
- B: Claude-App installiert, nicht eingeloggt
- C: Claude-App installiert, eingeloggt, MCP-Connector nicht verbunden
- D: Claude-App installiert, eingeloggt, MCP-Connector verbunden (Happy Path)

**Vollständige Testmatrix: 4 Varianten × 4 Zustände × 2 Plattformen = 32 Kombinationen.**

Ergebnis-Tabelle pro Kombination ausfüllen:

| Variante | Zustand | Plattform | Wohin führt der Link? | `?q=` durchgereicht? | Prompt absendbar? | Connector aktiv? | Kodierung OK? | Bemerkung |
|----------|---------|-----------|----------------------|---------------------|-------------------|-----------------|---------------|-----------|
| 1 | D | iOS | | | | | | |
| … | … | … | | | | | | |

Zusätzliche Prüfungen:
- **Connector aktiv?** Ist der Filo-Connector in dem per Link geöffneten neuen Chat verfügbar, oder muss der Nutzer ihn dort erst einschalten?
- **Kodierung:** Überleben Umlaute, ß, Anführungszeichen und ein Prompt von etwa 300 Zeichen die URL-Kodierung unverändert?

Besonders dokumentieren:
- Bei Zustand D (Happy Path): Funktioniert der Absprung sauber? Ist der Prompt vorhanden?
- Bei Zustand C (kein MCP): Was passiert, wenn Claude `get_handoff` aufrufen will? Fehlermeldung? Stiller Fehler?
- Bei Zustand B (nicht eingeloggt): Geht der `?q=`-Parameter durch den Login-Flow verloren?
- Bei Zustand A (nicht installiert): Landet der Nutzer im App Store / Play Store oder auf `claude.ai` im Browser?

**Reihenfolge:** Zuerst Zustand D (Happy Path) auf beiden Plattformen — wenn das nicht funktioniert, muss die Strategie überdacht werden, bevor die anderen Zustände getestet werden. Dann C und B (wahrscheinlichste Erst-Nutzungs-Szenarien). Zustand A zuletzt.

**Grundregel:** Prompt wird NIE automatisch gesendet — der Nutzer tippt auf Senden.

**Bisherige Testergebnisse (23.09.2026, iPad Simulator + physisches iPad):**
- Variante 1 (HTTPS Universal Link) funktioniert auf iOS: `Linking.openURL` → Safari → `claude.ai/new?q=...` → Claude-App
- `?q=`-Parameter wird durchgereicht, Prompt erscheint vollständig im Eingabefeld
- Kodierung OK: Umlaute (äöü), deutsche Anführungszeichen („"), ß — alles korrekt
- Zustand A (App nicht installiert): Safari öffnet `claude.ai/new?q=...` im Browser — funktioniert ebenfalls, Prompt ist da
- Zustand B (nicht eingeloggt): Login wird dazwischengeschaltet, `?q=`-Parameter geht NICHT verloren. Der Prompt ist nach dem Login im Chat.
- Rückweg zur App sichtbar: iOS zeigt „◀ Philo (Staging)" oben links
- Android-Test steht noch aus

- Ergebnis: Ausgefüllte Matrix-Tabelle, Empfehlung für Default-Strategie pro Plattform, Fallback-Strategie pro Zustand
- Betroffene Dateien: neuer Debug-Screen in ragapp
- Testkriterium: Mindestens ein Weg funktioniert pro Plattform in allen 4 Zuständen, oder klare Fallback-Strategie pro Zustand dokumentiert
- Abhängigkeit: keine
- Geschätzter Aufwand: Debug-Screen ~2h, Tests ~1 Nachmittag

### Schritt 0a: Stabile Absatz-IDs vergeben

Jeder Absatz bekommt eine stabile, bedeutungslose Kennung. **Zufällig vergeben, dauerhaft aufbewahrt.** Deterministische IDs aus dem Text sind ausgeschlossen, weil eine Textkorrektur die ID ändern würde und gleichlautende kurze Absätze kollidieren.

Ablauf:
- Beim ersten Lauf bekommt jeder Absatz eine Zufalls-ID (8 Zeichen, base62, Kollisionsprüfung gegen alle vergebenen IDs).
- Die ID wird als Anker im Quelltext gespeichert (ragkeep). Kein Manifest. **ragkeep ist die maßgebliche Quelle der IDs.**
- Jeder weitere ragprep-Lauf liest die Anker aus dem Quelltext und übernimmt die IDs direkt. Die Zuordnung ist sofort klar, kein Fingerprint-Matching nötig.
- Die positionale ID `{source_id}:{segment_index}:{paragraph_number}` bleibt als Nachschlagefeld erhalten, ist aber nie Verweisziel.
- Eine einmal vergebene ID wird nie an einen anderen Text vergeben, auch nicht nach Löschung.

**Ankerprüfung im Normallauf.** Der Normallauf vergleicht die Anker der vorigen Fassung eines Bandes mit den aktuellen und behandelt folgende Fälle:

- **Verschwundene ID** (Anker nicht mehr im Quelltext): Die ID wird nie stillschweigend fallen gelassen. Der Lauf bricht mit einer Liste der verschwundenen IDs ab. Fortsetzen nur mit ausdrücklicher Bestätigung, die für jede verschwundene ID einen Grabstein (`kind = 'deleted'`, `old_text`, Nachbar) anlegt.
- **Zwei oder mehr Anker in einem Absatz:** Gilt als Zusammenlegung. Der erste Anker bleibt die ID, jeder weitere bekommt einen Eintrag `kind = 'merged'`.
- **Absatz ohne Anker direkt nach einem Absatz, dessen Text deutlich geschrumpft ist:** Teilungskandidat. Kommt auf die Prüfliste. Bei Bestätigung bekommt er `split_from`.
- **Übrige Absätze ohne Anker:** Neu, neue ID.
- **Schutz gegen ankerlose Fassungen:** Hat ein bereits erfasster Band mehr als 5 % Absätze ohne Anker, bricht der Normallauf ab und verweist auf den Korpusabgleich (0d). Damit kann eine neu extrahierte Fassung nicht versehentlich alle IDs neu vergeben.

**Fingerabdruck zusätzlich zur ID.** ragprep hat bereits einen Lemma-Fingerprint: `{ head: string[5], tail: string[5] }` — die ersten und letzten 5 normalisierten Lemmas des Absatztexts (`paragraphLemmaFingerprint()` in `paragraphChapterMatcher.ts`). Die bestehende Spalte `lemma_fingerprint` (JSONB) auf `rag_paragraphs` wird direkt verwendet, **keine neue Spalte `fingerprint`.** Der Fingerabdruck ist nie Verweisziel und nie Identität. Er dient ausschließlich der Wiedererkennung im Korpusabgleich (0d). Er wird in ragkeep neben der ID gespeichert. Kollisionen bei kurzen und wiederkehrenden Absätzen sind erwartet. Wechselt der Lemmatisierer oder sein Modell, werden alle Fingerabdrücke neu berechnet, die IDs bleiben unberührt.

**Zusätzlich: `lemma_fingerprint_hash`.** Für die Gleichheitsprüfung im Abgleich eine neue Spalte `lemma_fingerprint_hash text` — Hash aus Kopf und Schwanz des Fingerprints, mit normalem B-Tree-Index. Der GIN-Index auf JSONB eignet sich für Enthaltensein-Prüfungen, nicht für Gleichheit.

**Annotationen (Querverweise in Buchtexten) umstellen.** Das Feld `annotations` in `rag_paragraphs` enthält `page_refs` mit `target_paragraph_id`, die heute auf positionale IDs verweisen. Beim ersten Lauf werden alle `target_paragraph_id`-Einträge auf die neuen stabilen IDs umgeschrieben. In `books.db` stehen dann nur noch stabile IDs. Die App-Seite (`ParagraphRenderer.tsx`) löst `target_paragraph_id` über `booksDb.resolveRedirect()` auf, sodass auch Verweise auf verschobene oder gelöschte Absätze korrekt behandelt werden.

- Betroffene Repos: **ragprep** (Chunking-Pipeline, Annotations-Umschreibung), **ragkeep** (nur Submodul `philo-von-freisinn`)
- Betroffene App-Dateien: `ParagraphRenderer.tsx` (Querverweis-Auflösung über stabile IDs)
**`stable_id` nach Vergabe verpflichtend.** Nach dem ersten vollständigen Lauf von 0a ist jede Zeile in `rag_paragraphs` mit einer stabilen ID versehen. Danach eine Folgemigration:

```sql
ALTER TABLE rag_paragraphs ALTER COLUMN stable_id SET NOT NULL;
```

So kann kein Absatz ohne ID nachrutschen.

- Testkriterium: Zwei aufeinanderfolgende ragprep-Läufe ohne Textänderung erzeugen identische IDs. Ein Lauf nach Einfügen eines Absatzes ändert keine bestehende ID und vergibt genau eine neue. Alle `target_paragraph_id` in Annotationen verweisen auf stabile IDs. Löschen eines Absatzes samt Anker führt zum Abbruch mit Liste. Zwei Anker in einem Absatz erzeugen eine Weiterleitung. Ein Band ohne Anker wird im Normallauf abgelehnt. Nach der Folgemigration: `stable_id` ist NOT NULL.
- Abhängigkeit: Muss VOR allen Verweisen und vor der Bücher-DB geschehen

### Schritt 0b: Bücher-DB Build-Pipeline

**Baut auf bestehendem Skript auf.** ragapp hat bereits `scripts/fetch-db-seed.mjs` (`npm run seed:fetch`), das vor jedem Release-Build einen Supabase-Snapshot holt und als `assets/seed/db-snapshot.json` ablegt. Heute erzeugt es ein WatermelonDB-Sync-Format (JSON mit `{ changes: { created, updated, deleted }, timestamp }`), das `seedLoader.ts` beim ersten Start in WatermelonDB importiert.

**Umbau:** Statt JSON im WatermelonDB-Format erzeugt das Skript eine SQLite-Datei `assets/seed/books.db`. Die Zwischenschicht (JSON → WatermelonDB-Import) entfällt — die App öffnet die SQLite-Datei direkt.

Änderungen an `fetch-db-seed.mjs`:
- Supabase-Abfragen bleiben gleich (+ neue Tabelle `passage_redirect`)
- Ausgabe: SQLite-Datei statt JSON
- SQLite-Erzeugung z.B. via `better-sqlite3` (nur Build-Tool, nicht im App-Bundle)
- `seedLoader.ts` und `db-snapshot.json` entfallen komplett (Teil der WatermelonDB-Entfernung in Schritt 1a)

Schema der erzeugten `books.db`:
  - `paragraphs` (stable_id PK, source_id, segment_index, segment_slug, segment_title, paragraph_number, text_raw, annotations, language, split_from)
  - `sources` (id, title, author, language, year, book_index, is_primary, sort_order)
  - `passage_redirect` (old_id, new_id, corpus_version, kind, old_text)
- Versionsnummer als `PRAGMA user_version`
- Die Datei ist im App-Bundle schreibgeschützt. Beim ersten Start wird sie ins Dokumentenverzeichnis kopiert. Updates ersetzen dort atomar.
- Betroffene Repos: **ragapp** (Umbau `fetch-db-seed.mjs`, Asset-Einbindung `app.config.js`)
- Testkriterium: `books.db` enthält alle Absätze mit stabilen IDs, App kann sie direkt nach Installation lesen, Verweise offline auflösen
- Abhängigkeit: Schritt 0a (stabile IDs existieren in Supabase)

### Schritt 0c: Bücher-Update-Mechanismus

- Endpunkt `GET /app/corpus-version` in ragrun → liefert aktuelle Versionsnummer
- App vergleicht beim Start `PRAGMA user_version` mit Server-Version
- Bei Differenz: neue `books.db` im Hintergrund herunterladen, im Dokumentenverzeichnis atomar ersetzen
- Betroffene Dateien: ragrun `app_api.py`, ragapp neues Modul `src/data/lib/booksDb.ts`
- Testkriterium: Update läuft im Hintergrund, App zeigt während Update alte Version
- Abhängigkeit: Schritt 0b

### Schritt 0d: Korpusabgleich

**Normallauf (`rp rag:chunk`):** Anker lesen und Ankerprüfung durchführen, siehe Schritt 0a. Der Korpusabgleich wird nur ausgelöst, wenn die Ankerprüfung abbricht oder eine neue Korpusfassung ohne Anker eingespielt wird.

**Korpusabgleich (bei strukturellen Änderungen):** Wenn Absätze geteilt, zusammengelegt oder gelöscht werden, ändern sich die Anker im Quelltext. Hier kommt der Fingerprint-Matcher zum Einsatz — ein **neuer, spezialisierter Abgleich** mit den Aktionen `split | merged | deleted`. Dieser läuft nicht automatisch bei `rp rag:chunk`, sondern wird gezielt ausgelöst.

Ablauf des Korpusabgleichs:

1. **Fingerabdruck-Match:** Absätze mit gleichem Fingerprint in alter und neuer Fassung werden direkt zugeordnet und behalten ihre ID. Bei mehrdeutigen Fingerprints entscheidet die Reihenfolge im Abschnitt, bei Unklarheit geht der Fall an Stufe 2.
2. **Textähnlichkeit** für alle übrigen Absätze, beschränkt auf das Umfeld im selben Abschnitt.

Regeln auf das Ergebnis:

- **Unverändert, leicht korrigiert, verschoben:** ID bleibt, Anker im Quelltext bleibt, kein Eintrag in `passage_redirect`.
- **split:** Der erste Teil behält die stabile ID. Weitere Teile bekommen neue stabile IDs und die Spalte `split_from` mit der ursprünglichen ID. Kein Eintrag in `passage_redirect`. Ausnahme: Ist der erste Teil nur ein Splitter (etwa eine abgetrennte Überschrift, deutlich kürzer als der Rest), geht die ID an den Hauptteil. Solche Fälle kommen auf die Prüfliste.
- **merged:** Der zusammengelegte Absatz behält die stabile ID des ersten beteiligten Absatzes. Jede weitere beteiligte ID bekommt einen Eintrag `kind = 'merged'` auf diese ID. **Die alte Zeile wird aus `rag_paragraphs` entfernt** — sie existiert nur noch als Weiterleitung.
- **deleted:** Eintrag `kind = 'deleted'` mit `new_id` = nächster erhaltener Nachbar und dem alten Wortlaut in `old_text`. **Die alte Zeile wird aus `rag_paragraphs` entfernt.**
- **Neu (kein Match in alter Fassung):** Neue stabile ID, kein Eintrag.
- **Unter Ähnlichkeitsschwelle:** Prüfliste, Entscheidung durch Michael.

Nach dem Abgleich: Anker im Quelltext (ragkeep) aktualisieren. Optional: Anker in `app_notes` und `protocols` auf die neuen IDs umschreiben, damit Auflösungsketten kurz bleiben. Die Weiterleitung bleibt trotzdem bestehen.

Ausgabe: aktualisierte Anker in ragkeep, neue Einträge in `passage_redirect`, neue Korpusversion, Prüfliste als Datei.

**Konsequenz für den bestehenden Matcher:** `matchParagraphsInChapter()` mit seinen Aktionen `keep | renumber | replace | insert | ambiguous` wird durch den Anker-Mechanismus im Normallauf abgelöst. Der Code kann perspektivisch vereinfacht oder durch den Korpusabgleich-Matcher ersetzt werden.

- Betroffene Repos: **ragprep** (neuer Korpusabgleich-Matcher, Anker-Leser in Chunking-Pipeline, `supabaseParagraphWriter.ts`)
**IDs mit einem Eintrag in `passage_redirect` (`merged` oder `deleted`) haben keine Zeile mehr in `rag_paragraphs` und nicht in `books.db`.** Die Auflösung „erst `paragraphs`, dann Weiterleitung" setzt das voraus.

- Testkriterium: Nach Einfügen, Teilen, Zusammenlegen und Löschen von Absätzen: korrekte Einträge in `passage_redirect`, keine bestehende stabile ID geändert. Für jede `old_id` in `passage_redirect` gibt es keine Zeile in `rag_paragraphs`.
- Abhängigkeit: Schritt 0a (stabile IDs und Fingerprints existieren)

### Schritt 0e: Qdrant-Payloads ergänzen

Alle Punkte in Qdrant und alle Zeilen in `rag_chunks` bekommen die stabilen Absatz-IDs der enthaltenen Absätze in die Metadaten. **Keine neuen Embeddings.** Vektoren (dense und BM25) und Punkt-IDs bleiben unverändert, geändert wird nur die Payload über `set_payload`. Die Zuordnung positionale ID → stabile ID liefert Schritt 0a.

Vorher prüfen: Ob die positionale Absatz-ID oder andere sich ändernde Metadaten in den eingebetteten Text eingehen. Nur dann wäre für die betroffenen Chunks eine Neuberechnung nötig.

- Betroffene Repos: **ragrun** (Qdrant-Client, rag_chunks-Repository)
- Testkriterium: Jeder Suchtreffer liefert mindestens eine gültige stabile ID. Vektoren sind unverändert.
- Abhängigkeit: Schritt 0a

### Schritt 0f: OAuth-Vortest

Direkt nach Schritt 0, vor allen übrigen MCP-Arbeiten. Klärt das OAuth-Risiko früh.

- Minimaler MCP-Server (Schritt 3a im Kleinen) mit einem einzigen Test-Tool `whoami`, das die Nutzer-ID aus dem Token zurückgibt.
- Supabase als OAuth-2.1-Server mit dynamischer Client-Registrierung aktivieren, minimale Autorisierungsseite.
- Als Custom Connector in Claude eintragen, Anmeldung durchspielen, `whoami` aufrufen.

Ergebnis: Funktioniert der Supabase-Weg, wird 4a später zügig ausgebaut. Funktioniert er nicht, ist früh klar, dass eigene Endpunkte nötig sind, und die Planung wird angepasst.

- Testkriterium: Claude meldet sich über Supabase an, `whoami` liefert die richtige Nutzer-ID, der Token wird erneuert.
- Abhängigkeit: keine
- Betroffene Dateien: ragrun (minimaler MCP-Server), Supabase-Projektkonfiguration

### Schritt 1: WatermelonDB entfernen und Supabase-Schema aufräumen

**Alles auf einem eigenen Branch.** 1a und 1b nehmen Compile-Fehler bewusst in Kauf. Der Branch wird erst gemergt, wenn Lesen, Suchen und Bücherliste mit der neuen Datenschicht (2a, 2e, 2f) wieder funktionieren. TestFlight-Tester haben ab dem Merge keinen Chat mehr, bis Schritt 6 steht. Das ist bewusst so entschieden.

**1a. WatermelonDB komplett entfernen**
- Dependency `@nozbe/watermelondb` aus `package.json` entfernen
- Alle Dateien löschen: `database.ts`, `schema.ts`, `migrations.ts`, `models/*.ts`, `sync.ts`
- Alle Imports in Repositories und Screens entfernen (Compile-Fehler akzeptieren)
- Betroffene Dateien: siehe Abbauliste D.1
- Testkriterium: App kompiliert ohne WatermelonDB (nach Schritt 2)

**1a½. Expo-Upgrade (54 → 57)**
- WatermelonDB ist raus → Blocker für Upgrade entfällt
- `@babel/plugin-proposal-decorators` entfernen (nur für WatermelonDB-Decorators nötig)
- `expo.doctor.reactNativeDirectoryCheck.exclude` für WatermelonDB entfernen
- `npx expo install expo@latest --fix` für jede Major-Version (54→55→56→57)
- React Native steigt mit: 0.81 → 0.85
- Nach jedem Schritt `npx expo-doctor` laufen lassen
- Abhängigkeiten prüfen: `react-native-reanimated`, `react-native-pager-view`, `react-native-worklets`, `@shopify/flash-list`
- Testkriterium: `npx expo-doctor` ohne Fehler, App startet im Simulator

**1b. Chat-Code entfernen**
- Alle Chat-Screens, Repositories, API-Aufrufe löschen (Abbauliste D.1)
- Tab 0 vorübergehend durch Platzhalter-Screen ersetzen
- Betroffene Dateien: `FiloScreen.tsx`, `ChatTab.tsx`, `GespraecheTab.tsx`, `ArbeitstextTab.tsx`, `ConversationDetailScreen.tsx`, `TalkRepository.ts`, `TurnRepository.ts`, `ReferenceRepository.ts`, `StarterPromptRepository.ts`
- Testkriterium: App startet, Tabs [1] Bücher, [2] Lesen, [3] Suche funktionieren (nach Schritt 2)

**1c. Supabase-Schema: Neue Tabellen + Erweiterungen**

Migrationsnummer: Nächste freie Nummer nach den bestehenden 18 Migrationen verwenden.

Migration `018_claude_integration.sql`:

```sql
-- Arbeitstexte erweitern (bestehende app_notes)
ALTER TABLE app_notes
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS text_type varchar(32) DEFAULT 'note',
  ADD COLUMN IF NOT EXISTS status varchar(16) NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS conversation_url text,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

-- Zitatanker (W3C Text Fragment Selectors)
ALTER TABLE app_notes
  ADD COLUMN IF NOT EXISTS quote_exact text,
  ADD COLUMN IF NOT EXISTS quote_prefix text,
  ADD COLUMN IF NOT EXISTS quote_suffix text;

ALTER TABLE app_bookmarks
  ADD COLUMN IF NOT EXISTS quote_exact text,
  ADD COLUMN IF NOT EXISTS quote_prefix text,
  ADD COLUMN IF NOT EXISTS quote_suffix text;

-- Versionshistorie (Titel und Status mitversioniert)
CREATE TABLE app_note_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id text NOT NULL REFERENCES app_notes(id) ON DELETE CASCADE,
  version integer NOT NULL,
  title text,
  content text NOT NULL,
  status varchar(16),
  changed_by varchar(16) NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (note_id, version)
);

-- Stabile IDs in allen Verweisspalten:
-- paragraph_id in app_notes, app_bookmarks, protocol_entries und handoffs
-- enthält immer eine stabile ID, nie eine positionale.

-- Arbeitstexte: Wer hat angelegt?
ALTER TABLE app_notes
  ADD COLUMN IF NOT EXISTS created_by varchar(16) NOT NULL DEFAULT 'user';

-- Transaktionale Speicherfunktion: einziger Schreibweg für bestehende Arbeitstexte.
-- App und MCP-Server rufen beide ausschließlich diese Funktion auf.
-- FOR UPDATE sperrt die Zeile gegen gleichzeitiges Speichern.
CREATE OR REPLACE FUNCTION save_note(
  p_id text,
  p_content text,
  p_expected_version integer,
  p_changed_by varchar DEFAULT 'user',
  p_title text DEFAULT NULL,
  p_status varchar DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_note app_notes%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthenticated');
  END IF;

  SELECT * INTO v_note FROM app_notes
  WHERE id = p_id AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  IF v_note.version <> p_expected_version THEN
    RETURN jsonb_build_object(
      'error', 'conflict',
      'current_version', v_note.version,
      'current_content', v_note.content,
      'current_title', v_note.title
    );
  END IF;

  INSERT INTO app_note_versions (note_id, version, title, content, status, changed_by)
  VALUES (p_id, v_note.version, v_note.title, v_note.content, v_note.status, p_changed_by);

  UPDATE app_notes SET
    content = p_content,
    title = COALESCE(p_title, title),
    status = COALESCE(p_status, status),
    version = version + 1,
    updated_at = now()
  WHERE id = p_id;

  RETURN jsonb_build_object('ok', true, 'new_version', v_note.version + 1);
END;
$$;

-- Einziger Anlegeweg für Arbeitstexte (App und MCP-Server).
CREATE OR REPLACE FUNCTION create_note(
  p_id text,
  p_title text,
  p_content text,
  p_text_type varchar DEFAULT 'note',
  p_paragraph_id text DEFAULT NULL,
  p_conversation_url text DEFAULT NULL,
  p_created_by varchar DEFAULT 'user'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthenticated');
  END IF;

  INSERT INTO app_notes (id, user_id, title, content, text_type, paragraph_id, conversation_url, status, version, created_by)
  VALUES (p_id, auth.uid(), p_title, p_content, p_text_type, p_paragraph_id, p_conversation_url, 'draft', 1, p_created_by);
  RETURN jsonb_build_object('ok', true, 'id', p_id, 'version', 1);
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('error', 'exists');
END;
$$;

-- CHECK: changed_by und created_by nur 'user' oder 'claude'
ALTER TABLE app_note_versions
  ADD CONSTRAINT chk_changed_by CHECK (changed_by IN ('user', 'claude'));
ALTER TABLE app_notes
  ADD CONSTRAINT chk_created_by CHECK (created_by IN ('user', 'claude'));

-- Nutzerprofil
CREATE TABLE user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  claude_tier varchar(16),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Protokolle: eines pro Kapitel bzw. Vortrag, nicht pro Absatz.
-- Prüfen, ob segment_slug über Korpusänderungen stabil ist.
-- Wenn nicht, einen stabilen Kapitelschlüssel verwenden (etwa die stabile ID des ersten Absatzes).
CREATE TABLE protocols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id text NOT NULL,
  segment_slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, source_id, segment_slug)
);

CREATE TABLE protocol_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_id uuid NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
  paragraph_id text,            -- stabile ID der Stelle, auf die sich der Eintrag bezieht (optional)
  entry_type varchar(32) NOT NULL,
  content text NOT NULL,
  conversation_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_protocol_entries_paragraph ON protocol_entries (paragraph_id);

-- Übergabe-Datensätze
-- Keine instructions-Spalte: Anweisungen für Claude stehen in der Serverkonfiguration
-- (app/mcp_server/config/handoff_instructions.md), get_handoff fügt sie beim Abruf hinzu.
CREATE TABLE handoffs (
  id varchar(12) PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paragraph_id text,
  source_id text,
  segment_slug text,
  marked_text text,
  user_question text,
  return_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

-- Kurz-ID erzeugt die Datenbank, nicht die App.
-- Alphabet ohne verwechselbare Zeichen (l, o, 0, 1), da die ID im Prompt sichtbar ist.
CREATE OR REPLACE FUNCTION create_handoff(
  p_paragraph_id text,
  p_source_id text,
  p_segment_slug text,
  p_marked_text text,
  p_user_question text,
  p_return_url text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text;
  v_chars text := 'abcdefghijkmnpqrstuvwxyz23456789';
  i int;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthenticated');
  END IF;
  LOOP
    v_id := '';
    FOR i IN 1..5 LOOP
      v_id := v_id || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    END LOOP;
    BEGIN
      INSERT INTO handoffs (id, user_id, paragraph_id, source_id, segment_slug, marked_text, user_question, return_url)
      VALUES (v_id, auth.uid(), p_paragraph_id, p_source_id, p_segment_slug, p_marked_text, p_user_question, p_return_url);
      RETURN jsonb_build_object('ok', true, 'id', v_id);
    EXCEPTION WHEN unique_violation THEN
      -- neue ID versuchen
    END;
  END LOOP;
END;
$$;

-- Weiterleitungstabelle
CREATE TABLE passage_redirect (
  old_id text PRIMARY KEY,
  new_id text NOT NULL,
  corpus_version integer NOT NULL,
  kind varchar(16) NOT NULL,  -- 'merged' | 'deleted'
  old_text text               -- Grabstein-Wortlaut bei 'deleted'
);

-- Stabile ID, Fingerprint-Hash und Split-Herkunft auf rag_paragraphs
-- lemma_fingerprint (JSONB) existiert bereits, wird weiterverwendet.
-- Keine neue fingerprint-Spalte.
ALTER TABLE rag_paragraphs
  ADD COLUMN IF NOT EXISTS stable_id varchar(12) UNIQUE,
  ADD COLUMN IF NOT EXISTS lemma_fingerprint_hash text,  -- Hash aus head+tail für schnelle Gleichheitsprüfung
  ADD COLUMN IF NOT EXISTS split_from varchar(12);

CREATE INDEX IF NOT EXISTS idx_rag_paragraphs_fp_hash ON rag_paragraphs (lemma_fingerprint_hash);
CREATE INDEX IF NOT EXISTS idx_rag_paragraphs_split_from ON rag_paragraphs (split_from) WHERE split_from IS NOT NULL;

-- Soft-Delete für Arbeitstexte (Entscheidung: markieren statt endgültig löschen)
ALTER TABLE app_notes ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE OR REPLACE FUNCTION delete_note(p_id text) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthenticated');
  END IF;
  UPDATE app_notes SET deleted_at = now(), updated_at = now()
  WHERE id = p_id AND user_id = auth.uid() AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION undelete_note(p_id text) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthenticated');
  END IF;
  UPDATE app_notes SET deleted_at = NULL, updated_at = now()
  WHERE id = p_id AND user_id = auth.uid() AND deleted_at IS NOT NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Auth-Guard in save_note() und create_note(): auth.uid() IS NULL → 'unauthenticated'
-- (bereits in den Funktionsdefinitionen oben enthalten; hier für create_handoff ergänzt)

-- Funktionen gegen nicht angemeldete Aufrufer absichern:
-- Supabase gibt neuen Funktionen standardmäßig Ausführungsrechte auch für anon.
-- Bei SECURITY DEFINER greift RLS nicht. Deshalb:
REVOKE EXECUTE ON FUNCTION save_note(text, text, integer, varchar, text, varchar) FROM anon, public;
REVOKE EXECUTE ON FUNCTION create_note(text, text, text, varchar, text, text, varchar) FROM anon, public;
REVOKE EXECUTE ON FUNCTION delete_note(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION undelete_note(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION create_handoff(text, text, text, text, text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION save_note(text, text, integer, varchar, text, varchar) TO authenticated;
GRANT EXECUTE ON FUNCTION create_note(text, text, text, varchar, text, text, varchar) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_note(text) TO authenticated;
GRANT EXECUTE ON FUNCTION undelete_note(text) TO authenticated;
GRANT EXECUTE ON FUNCTION create_handoff(text, text, text, text, text, text) TO authenticated;
-- resolve_passage (falls als Postgres-Funktion): GRANT an authenticated UND anon
-- (Fallback-Webseite löst ohne Anmeldung auf, aber ohne Nutzerdaten)
```

**`user_profiles` automatisch anlegen:** Trigger auf `auth.users` (nach Insert) oder Upsert in `UserProfileRepository.get()`. Sonst liefert `get()` für neue Nutzer nichts.

Plus: RLS-Policies für alle neuen Tabellen, `set_updated_at()`-Trigger auf `user_profiles`, `protocols`.

RLS-Regeln:
- **`app_notes`: SELECT alle eigenen Texte (`user_id = auth.uid()`), auch gelöschte.** Gelöschte Texte werden in den Abfragen ausgeblendet (`WHERE deleted_at IS NULL`), nicht in der Policy — sonst kann die Papierkorb-Ansicht nichts anzeigen und `get_work_text` kann gelöschte nicht von fehlenden unterscheiden. Keine INSERT-, UPDATE- oder DELETE-Policy für `authenticated`. Schreiben geschieht ausschließlich über `create_note()`, `save_note()`, `delete_note()` und `undelete_note()`.
- `app_note_versions`: Nur SELECT über Parent-Join auf `app_notes.user_id = auth.uid()`. Keine INSERT/UPDATE/DELETE-Policy.
- `user_profiles`: SELECT/UPDATE nur eigenes Profil (`id = auth.uid()`)
- `protocols`, `protocol_entries`: SELECT/INSERT nur eigene (`user_id = auth.uid()`, bzw. Parent-Join)
- `handoffs`: Nur SELECT eigene (`user_id = auth.uid()`). Keine INSERT-Policy — Anlegen nur über `create_handoff()`.
- `passage_redirect`: SELECT für alle authenticated (read-only Korpusdaten)

Testkriterium ergänzen: Ein direktes `UPDATE app_notes …` oder `INSERT INTO app_notes …` über den Supabase-Client mit Nutzer-JWT wird abgewiesen.

~~Migration `019_cleanup_watermelon.sql`~~ → **verschoben nach Schritt 8.** Alte TestFlight-Builds rufen `pull_changes()` und `push_changes()` noch auf und brechen sofort, wenn diese Funktionen fehlen. 019 wird erst eingespielt, wenn alle Tester auf einen Build ohne WatermelonDB aktualisiert haben.

- Testkriterium: Alle Tabellen angelegt, RLS greift, `save_note()` und `create_note()` funktionieren transaktional
- Abhängigkeit: Schritt 0a (stable_id existiert)

### Schritt 2: Neue Datenzugriffsschicht in ragapp

**2a. Buch-Cache-Modul (SQLite direkt)**
- Neues Modul `src/data/lib/booksDb.ts`
- Beim ersten Start: gebundelte `books.db` aus Assets ins Dokumentenverzeichnis kopieren
- Öffnet via expo-sqlite (ohne WatermelonDB-ORM)
- API: `getParagraph(stableId)`, `getParagraphsBySource(sourceId)`, `getParagraphsBySegment(sourceId, segmentIndex)`, `getSources()`, `getCorpusVersion()`, `resolveRedirect(stableId)`
- `resolveRedirect`: Auflösungskette in `passage_redirect` folgen bis zum Ende. Bei `deleted`: Grabstein-Objekt zurückgeben mit `old_text` und `new_id` (Nachbar).
- Betroffene Dateien: neues Modul, `app.config.js` (Asset-Einbindung)
- Testkriterium: Absätze lesbar direkt nach Installation ohne Netzwerk, Verweise offline auflösbar
- Abhängigkeit: Schritt 0b (books.db existiert)

**2b. Supabase-Repositories für Nutzerdaten**
- `src/data/repositories/NoteRepository.ts` — gegen Supabase
  - `create(title, content, textType?, paragraphId?, conversationUrl?)` — ruft `create_note()` RPC auf
  - `list(filter?)`, `get(id)`, `save(id, content, expectedVersion, changedBy?, title?, status?)` — ruft `save_note()` RPC auf
  - `history(id)`, `restore(id, version)`, `delete(id)` — ruft `delete_note()` RPC auf (Soft-Delete), `undelete(id)` — ruft `undelete_note()` RPC auf
  - `listDeleted()` — Papierkorb-Ansicht (SELECT-Policy zeigt auch gelöschte eigene Texte)
  - Bei Konflikt-Antwort von `save_note()`: liefert `{ conflict: true, currentVersion, currentContent, currentTitle }`
- `src/data/repositories/BookmarkRepository.ts` — Supabase-direkt
  - `getLastRead(sourceId)`, `setLastRead(sourceId, paragraphId)`, `listManual(sourceId)`, `create()`, `delete()`
  - **Leseposition lokal-first:** `setLastRead` schreibt zuerst in AsyncStorage, bei Verbindung zusätzlich nach Supabase. Beim Start gilt der neuere Zeitstempel. So geht beim Offline-Lesen keine Position verloren.
  - Manuelle Lesezeichen bleiben online-only (wie Arbeitstexte).
- `src/data/repositories/ProtocolRepository.ts`
  - `getOrCreate(sourceId, segmentSlug)`, `append(protocolId, entry)` — Eintrag mit optionalem `paragraph_id`
  - `list(sourceId, segmentSlug)`, `listForParagraph(paragraphId)` — Einträge des Kapitels, die sich auf diese Stelle beziehen
- `src/data/repositories/UserProfileRepository.ts`
  - `get()`, `updateClaudeTier(tier)`
- `src/data/repositories/HandoffRepository.ts`
  - `create(data)` — ruft `create_handoff()` RPC auf (ID erzeugt die DB)
  - `get(id)`
- Betroffene Dateien: `src/data/repositories/` (komplett neu)
- Testkriterium: CRUD funktioniert über Supabase-Client mit JWT, `save_note` liefert Konflikt bei Versionsmismatch
- Abhängigkeit: Schritt 1c (Tabellen + `save_note()` existieren)

**2c. Hooks mit Statuszuständen**
- `useNote(id)` → `{ data, status, conflict, save, resolveConflict }`
- `useNotes(filter)` → `{ data, status, refresh }`
- `useBookmarks(sourceId)` → `{ lastRead, manual, setLastRead, addBookmark }`
- `useProtocol(sourceId, segmentSlug)` → `{ entries, append }`
- `useUserProfile()` → `{ profile, updateClaudeTier }`
- Status-Enum: `loading | ready | saving | saved | error | offline`
- Auto-Save: Debounce 1s nach Tippen + Save bei `AppState` → background (vor Claude-Absprung)
- Offline: Editor schreibgeschützt mit Hinweis, ungespeicherte Eingaben im Arbeitsspeicher behalten
- Betroffene Dateien: `src/shared/hooks/` (neu)
- Testkriterium: Status korrekt, Auto-Save funktioniert, Offline-Erkennung
- Abhängigkeit: Schritt 2b

**2d. Arbeitstexte-Editor**
- `NoteEditorModal.tsx` umbauen: Supabase statt WatermelonDB
- Speicherstatus sichtbar (speichert / gespeichert / Fehler)
- Versionsanzeige, Verlauf einsehbar
- Konflikdialog: bei `version`-Mismatch beide Fassungen anzeigen, Nutzer wählt
- Betroffene Dateien: `NoteEditorModal.tsx`, `ReadScreen.tsx`
- Testkriterium: Erstellen, Bearbeiten, Versionshistorie, Konflikt-Szenario simulieren
- Abhängigkeit: Schritt 2c

**2e. ParagraphRepository auf Buch-Cache umstellen**
- `ParagraphRepository.ts` neu: liest aus `booksDb` statt WatermelonDB
- API: `findById(stableId)`, `findBySource(sourceId)`, `findBySegment(sourceId, segmentIndex)`, `findBySegmentSlug(sourceId, segmentSlug)`
- Betroffene Dateien: `ParagraphRepository.ts`, `ReadScreen.tsx`
- Testkriterium: Bücher lesbar aus gebundelter DB
- Abhängigkeit: Schritt 2a

**2f. SourceRepository auf Buch-Cache umstellen**
- `SourceRepository.ts` neu: liest aus `booksDb`
- Betroffene Dateien: `SourceRepository.ts`, `OverviewScreen.tsx`
- Testkriterium: Bücherliste korrekt
- Abhängigkeit: Schritt 2a

**Branch-Merge:** Nach 2a, 2e, 2f funktionieren Lesen, Suchen und Bücherliste wieder. Branch kann gemergt werden.

### Schritt 3: MCP-Server (lesend, ohne Auth)

**⚠️ Nicht öffentlich bis Schritt 4.** Der MCP-Server aus Schritt 3 arbeitet mit Dummy-Nutzer und Service-Schlüssel. Bis Schritt 4 steht, ist er nur lokal oder hinter einer Zugangssperre erreichbar, nie öffentlich unter `ragxxx.com`.

**Serverseitige Auflösung von `passage_redirect`.** Als gemeinsame Funktion `resolve_passage(stable_id)` in ragrun — liefert Absatz, Weiterleitungskette oder Grabstein. Genutzt von `get_passage`, `get_protocol`, `get_handoff`, `append_to_protocol` und der Fallback-Webseite (5b). Optional als Postgres-Funktion, dann nutzen MCP-Server und Webseite denselben Code. Bei Weiterleitung: Zielabsatz liefern, mit Hinweis „Stelle wurde zusammengelegt". Bei Grabstein: alten Wortlaut, Hinweis auf Entfernung und ID des Nachbarn.

**3a. FastMCP-Modul einrichten**
- Neues Verzeichnis: `ragrun/app/mcp_server/`
  - `__init__.py` — FastMCP-App-Instanz
  - `server.py` — Streamable HTTP Transport
  - `tools/search_corpus.py`
  - `tools/get_passage.py`
  - `tools/get_protocol.py`
  - `tools/list_work_texts.py`
  - `tools/get_work_text.py`
  - `tools/list_volumes.py`
  - `resources/band_list.py` — Resource mit Bandliste (zusätzlich zu Tool)
  - `prompts/philo_voice.py` — Prompt für die Philo-Stimme (zusätzlich zu Instructions)
  - `config/handoff_instructions.md` — Anweisungen zur Philo-Stimme und Arbeitsweise im Arbeitszimmer. `get_handoff` fügt sie beim Abruf hinzu. Änderungen wirken nach Neustart/Neuladen, ohne App-Release.
- `fastmcp` als Dependency in `requirements.txt`
- Mount auf `/mcp/` in FastAPI
- Betroffene Dateien: `app/main.py`, `requirements.txt`
- Testkriterium: MCP-Inspector listet Tools auf
- Abhängigkeit: keine

**3b. `search_corpus`-Tool**
- Nutzt bestehende Hybrid-Suche: `app/retrieval/utils/retrievers.py` (Qdrant dense + BM25 sparse)
- Parameter: `query: str`, `detail: "kurz" | "normal" | "ausführlich"`, `limit: int` (default 5)
- Stufenweise Auslieferung: nur `stable_id`, Metadaten, Auszug (1–2 Sätze)
- **Auszugsmechanismus:** BM25 auf Satzebene — Chunk-Text in Sätze zerlegen, Stichwortüberlappung mit Query, Top-1–2 Sätze als Originalwortlaut mit Auslassungszeichen
- Metadaten pro Treffer: Band-Titel, Vortragstitel, Ort, Datum, Kapitelüberschrift (eigene Felder, nicht im Fließtext)
- `detail`-Default: liest `claude_tier` aus `user_profiles` (kostenlos → kurz, bezahlt → normal, fehlend → kurz)
- Tool-Beschreibung: „Liefert Kurzauszüge. Für den vollen Text einer Stelle: get_passage aufrufen."
- Testkriterium: Suchergebnisse mit Auszügen, Metadaten, stabilen IDs
- Abhängigkeit: Schritt 0e (stabile IDs in Qdrant-Payloads)

**3c. `get_passage`-Tool**
- Parameter: `paragraph_id: str` (stable_id), `context_size: int` (Absätze drumherum, default 3), `detail`
- `detail`-Default: liest `claude_tier` (wie search_corpus)
- Liefert: Absatztext + Umfeld + `return_url` + Anzahl Protokolleinträge zur Stelle
- Bei `detail` ≥ normal: zusätzlich die letzten 2–3 Protokolleinträge knapp
- Liest direkt aus Supabase `rag_paragraphs`
- `return_url`: `https://ragxxx.com/passage/{stable_id}` (Universal Link)
- Tool-Beschreibung: „Liefert immer eine return_url mit. Jede Antwort mit Stellenbezug muss die return_url enthalten."
- Testkriterium: Absatz mit Kontext, Return-URL und Protokollinfo. Bei weitergeleiteter oder gelöschter ID: korrekte Auflösung über `resolve_passage`.
- Abhängigkeit: Schritt 0a (stabile IDs), Schritt 1c (Protokolltabellen, `passage_redirect`)

**3d. `get_protocol`-Tool**
- Parameter: `paragraph_id: str` (stabile ID) **oder** `source_id` + `segment_slug`, dazu `detail`
- Mit `paragraph_id`: Kapitel ermitteln, Einträge des Kapitelprotokolls liefern. Einträge zu dieser Stelle zuerst, dann die übrigen jüngsten.
- Mit `source_id` + `segment_slug`: Kapitelprotokoll direkt.
- `detail`-Staffelung: kurz = letzte 5, normal = letzte 10, ausführlich = alle
- IDs vor Verwendung über `resolve_passage` auflösen
- Testkriterium: Korrekte Einträge, nur eigene Protokolle, Auflösung weitergeleiteter IDs
- Abhängigkeit: Schritt 1c (Protokoll-Tabellen)

**3e. `list_work_texts` und `get_work_text`-Tools**
- `list_work_texts`: Parameter `filter?`, `since?` — nur Kopfdaten (id, title, status, paragraph_id, updated_at). Blendet gelöschte Texte aus (`deleted_at IS NULL`).
- `get_work_text`: Parameter `id` — Volltext mit `version`-Nummer. Bei gelöschtem Text (`deleted_at` gesetzt): „Dieser Text wurde gelöscht". Bei nicht vorhandenem Text: „Text nicht gefunden". Die Unterscheidung ist möglich, weil die SELECT-Policy alle eigenen Texte zeigt.
- Gefiltert nach User (aus OAuth-Token, in Schritt 3 noch Dummy)
- Testkriterium: Korrekte Daten, nur eigene Texte
- Abhängigkeit: Schritt 1c (erweiterte `app_notes`)

**3f. `list_volumes`-Tool**
- Liefert die Bandliste knapp: ID, Titel, Autor, Jahr, Band-Nummer
- Ersetzt die Resource-basierte Bandliste für Clients, die Resources nicht automatisch laden
- Testkriterium: Alle Bände korrekt aufgelistet
- Abhängigkeit: keine

**3g. Server-Instructions, Prompt und Resource**
- **Server-`instructions`**: Aufbau des Korpus (50 Bände Rudolf Steiner, Vorträge und Bücher), Hinweis auf stufenweise Auslieferung, Regeln zu Arbeitstexten und Protokollen. Enthält auch die Anweisungen zur Philo-Stimme, da Prompts und Resources von Claude nicht automatisch geladen werden.
- **`philo_voice`-Prompt**: Zusätzlich als MCP-Prompt verfügbar (für Nutzer, die ihn manuell auswählen)
- **`band_list`-Resource**: Zusätzlich als Resource verfügbar
- Tool-Beschreibungen enthalten Regeln:
  - „Arbeitstexte nur auf ausdrücklichen Wunsch des Nutzers anlegen oder ändern. Vor dem Anlegen den Titel mit dem Nutzer abstimmen."
  - „Protokolle bekommen Ergänzungen ohne Rückfrage, aber nur für Erkenntnisse, Befunde und offene Fragen."
  - „Jede Antwort mit Stellenbezug enthält die return_url."
- Annotationen: lesende Tools als `readOnly`, schreibende als `destructive: false`
- Testkriterium: Claude verhält sich regelkonform
- Abhängigkeit: keine

### Schritt 4: OAuth über Supabase

**4a. Supabase als OAuth-2.1-Server**

Supabase Auth als OAuth-2.1-Server mit PKCE und dynamischer Client-Registrierung verwenden statt eigener Endpunkte.

- OAuth-2.1-Server und dynamische Registrierung im Supabase-Projekt aktivieren
- Selbst gebaut wird nur die Autorisierungsseite (Anmeldung mit denselben Wegen wie in der App: Email + Apple Sign-In, Zustimmung zum Zugriff)
- Der MCP-Server gibt Supabase als Authorization Server an und prüft eingehende Supabase-Tokens
- **Datenzugriff im MCP-Server mit dem Token des Nutzers, nicht mit dem Service-Schlüssel.** Dann greifen die RLS-Regeln automatisch, und eine vergessene Filterbedingung kann keine fremden Daten preisgeben. Service-Schlüssel nur für Korpusdaten ohne Nutzerbezug (z.B. `rag_paragraphs`, `rag_chunks`).

**Ergebnis aus Schritt 0f übernehmen.** Hat 0f gezeigt, dass der Supabase-Weg nicht trägt, gilt der Fallback mit eigenen Endpunkten (`/mcp/authorize`, `/mcp/token`, `/mcp/register`). Der Grundsatz „User-Token statt Service-Key" bleibt in jedem Fall.

- Betroffene Dateien: Supabase-Projektkonfiguration, ragrun `app/mcp_server/auth/`, `app/main.py`
- Testkriterium: Claude Custom Connector autorisiert sich, Token wird erneuert, MCP-Tools erkennen User
- Abhängigkeit: Schritt 3a (MCP-Server läuft)

**4b. User-Kontext in Tools**
- Alle Tools erhalten User-ID aus OAuth-Token
- `search_corpus`, `get_passage`, `get_protocol` lesen `claude_tier` für Detail-Default
- `list_work_texts` / `get_work_text` filtern nach User (automatisch durch RLS bei User-Token)
- Testkriterium: Verschiedene User sehen nur eigene Daten
- Abhängigkeit: Schritt 4a

**4c. Schreibende Tools**
- `update_work_text`: Parameter `id`, `content`, `expected_version`, optional `title`, `status` → ruft `save_note()` RPC auf mit `changed_by: 'claude'`, erzeugt Versionseintrag
- `create_work_text`: Parameter `title`, `content`, `text_type` (optional), `paragraph_id` (optional, Anker an eine Stelle), `conversation_url` (optional). Ruft `create_note()` mit `p_created_by = 'claude'` auf, ID erzeugt der MCP-Server (UUID). Liefert ID, Version 1 und Rücklink `https://ragxxx.com/text/{note_id}`. Regel in Tool-Beschreibung: „Nur anlegen, wenn der Nutzer ausdrücklich darum bittet, einen Text in Filo abzulegen. Vor dem Anlegen den Titel mit dem Nutzer abstimmen."
- `append_to_protocol`: Parameter entweder `paragraph_id` (stabile ID, Kapitel wird ermittelt) **oder** `source_id` + `segment_slug` (Eintrag betrifft das ganze Kapitel, `paragraph_id` bleibt leer). Wie bei `get_protocol`. Legt Kapitelprotokoll bei Bedarf an, speichert den Eintrag. IDs vor Verwendung über `resolve_passage` auflösen.
- `get_handoff`: Parameter `id` → liefert Übergabe-Datensatz (Stelle, Markierung, Frage, Rückweg) plus Anweisungen aus `config/handoff_instructions.md` im Feld `instructions`, nur wenn `user_id` passt. **Nach Ablauf (`expires_at`):** kein nackter Fehler, sondern verständliche Meldung und, wenn möglich, die Stellenreferenz (`paragraph_id`), damit Claude mit `get_passage` weiterarbeiten kann.
- Betroffene Dateien: `app/mcp_server/tools/`
- Testkriterium: Schreiben nur mit gültigem Token, `save_note()` liefert Konflikt bei Mismatch, abgelaufener Handoff liefert Fallback
- Abhängigkeit: Schritt 4a (Auth), Schritt 1c (Tabellen)

### Schritt 5: Deep Links und Rückwege

**5a. Domain: `ragxxx.com`**
- Domain steht fest. Universal Links und App Links nutzen `ragxxx.com` für `apple-app-site-association` und `assetlinks.json`.
- Testkriterium: DNS konfiguriert, HTTPS erreichbar
- Abhängigkeit: keine

**5b. Universal Links (iOS) / App Links (Android)**
- URL-Schemata:
  - `https://ragxxx.com/passage/{stable_id}` — Stellenlink (Rückweg von Claude)
  - `https://ragxxx.com/text/{note_id}` — Arbeitstextlink (Rücklink auf von Claude angelegte oder geänderte Texte)
- `apple-app-site-association` auf Server: verknüpft Domain mit App-Bundle-ID
- `assetlinks.json` auf Server: verknüpft Domain mit Android-Package
- Fallback-Webseite für `/passage/`: zeigt Stellentext im Browser + „In Filo öffnen"-Link + App-Store-Links. Nutzt `resolve_passage` für Weiterleitungen.
- Fallback-Webseite für `/text/`: „Dieser Text liegt in deiner Filo-App" ohne Inhalt (Arbeitstexte sind privat) + „In Filo öffnen"-Link
- Betroffene Dateien: `app.config.js` (Associated Domains), ragrun (statische Dateien + Fallback-Seite)
- Testkriterium: Link öffnet App an richtiger Stelle; ohne App zeigt Fallback
- Abhängigkeit: Schritt 5a (Domain), Schritt 0a (stabile IDs)

**5c. Deep-Link-Konfiguration vom Backend**
- `GET /app/deep-link-config` → `{ ios: { strategy, url_template }, android: { strategy, url_template } }`
- Strategien: `native_app`, `in_app_browser`, `web_fallback`
- Default basiert auf Ergebnis von Schritt 0 (Deep-Link-Test)
- Umschaltbar ohne App-Release
- Betroffene Dateien: `app_api.py`
- Testkriterium: App verwendet Server-Konfiguration für Link-Strategie
- Abhängigkeit: Schritt 0 (Testergebnis bestimmt Default-Strategie)

**5d. Deep-Link-Handling in der App**
- `app/_layout.tsx` erweitern: `Linking.addEventListener` für `ragxxx.com/passage/{id}` und `ragxxx.com/text/{note_id}`
- **Stellenlinks** (`/passage/{id}`): Auflösungsreihenfolge: `paragraphs` suchen → sonst `passage_redirect` folgen (Kette bis zum Ende) → bei `deleted`: Grabstein-Ansicht mit „Diese Stelle wurde in Korpusversion N entfernt", altem Wortlaut und Sprung zum Nachbarn. Alles aus `books.db`, also auch offline.
- **Arbeitstextlinks** (`/text/{note_id}`): Öffnet den Arbeitstext im Editor. Ist der Text nicht vorhanden, gelöscht (`deleted_at` gesetzt) oder gehört einem anderen Nutzer: verständliche Meldung statt leerem Editor.
- Betroffene Dateien: `app/_layout.tsx`, `ReadingContext.tsx`, `NoteEditorModal.tsx`
- Testkriterium: Externer Link öffnet Buch an korrekter Stelle, Redirect wird aufgelöst, Grabstein wird angezeigt. Rücklink aus einem Claude-Gespräch öffnet den von Claude angelegten Text. Gelöschter oder fremder Text zeigt verständliche Meldung.
- Abhängigkeit: Schritt 5b (Universal Links), Schritt 2a (booksDb mit passage_redirect), Schritt 2d (Arbeitstexte-Editor)

### Schritt 6: Übergabe-Sheet und Einrichtungsweg

**6a. Einrichtungsweg (Connector-Setup)**
- Neuer Screen: `src/features/settings/ConnectorSetupScreen.tsx`
- Anleitung: „So verbindest du Filo mit Claude" (Screenshots, Schritte)
- Hinweis: Free-Nutzer haben nur einen Connector-Platz
- Prüft Connector-Status: Test-Request an MCP-Server mit User-Token
- Claude-Tarif-Abfrage (kostenlos / bezahlt) → `user_profiles.claude_tier`
- Betroffene Dateien: neuer Screen, `UserProfileRepository`, `SettingsScreen.tsx`
- Testkriterium: Nutzer kann Anleitung durchgehen, Tarif wird gespeichert, Status wird angezeigt
- Abhängigkeit: Schritt 4a (OAuth funktioniert)

**6b. Übergabe-Sheet**
- Am Absatz im ReadScreen: Kontextmenü-Punkt „Im Arbeitszimmer vertiefen"
- Öffnet Bottom-Sheet mit:
  - Absatz-Kontext (Band, Kapitel, Textstelle)
  - Bearbeitbare Frage des Nutzers
  - Button „In Claude weiterdenken"
- Prüft zuerst, ob Connector autorisiert ist → sonst führt Menüpunkt zum Einrichtungsweg
- Beim Tap auf Button:
  1. Auto-Save aller offenen Arbeitstexte
  2. `HandoffRepository.create(...)` → ruft `create_handoff()` auf, DB erzeugt kurze ID (z.B. `k7f3d`)
  3. Prompt aufbauen: `Filo, Band 12, Kapitel 3: [Nutzerfrage]. Lade Filo-Kontext k7f3d` — erste Zeile erzeugt brauchbaren Chat-Titel
  4. Deep Link zu Claude mit `?q=`-Prompt (Strategie laut Server-Konfiguration)
- `get_handoff` liefert im `instructions`-Feld die Anweisungen zur Philo-Stimme aus `config/handoff_instructions.md` (serverseitig steuerbar ohne App-Update)
- Leseposition wird beim Wechsel gespeichert, bei Rückkehr wiederhergestellt
- Betroffene Dateien: `ReadScreen.tsx` (Menü), neues Sheet, `HandoffRepository`
- Testkriterium: Sheet erscheint, Handoff in Supabase, Link öffnet Claude, Claude ruft `get_handoff` auf und bekommt Kontext + Anweisungen
- Abhängigkeit: Schritt 4c (`get_handoff`), Schritt 5 (Deep Links funktionieren)

**6c. Tab-Umbau**
- Tab 0 wird von „Filo (Chat)" zu „Werkstatt" (oder „Arbeitszimmer")
- Inhalt:
  - **Mit Claude-Connector:** Arbeitstexte-Liste + „Mit Claude weiterdenken"-Einstieg + letzter Connector-Status
  - **Ohne Claude-Connector:** Arbeitstexte-Liste + „Mit Claude weiterdenken — Einrichten" (führt zu Einrichtungsweg)
  - **Ohne Claude-Konto:** „Filo ist eine Lese- und Such-App. Mit Claude kannst du tiefer einsteigen." + Einrichtungsweg
- Betroffene Dateien: `FiloScreen.tsx` (komplett umbauen), Tab-Layout
- Testkriterium: Tab zeigt sinnvollen Inhalt in allen drei Zuständen
- Abhängigkeit: Schritt 2d (Arbeitstexte-Editor), Schritt 6a (Einrichtungsweg)

### Schritt 7: Testen und Nachschärfen

- 5–10 Tester mit Claude-Connector
- Tool-Beschreibungen anhand von echten Gesprächen nachschärfen
- `detail`-Defaults und Auszugslängen kalibrieren
- Testkriterium: Nutzer finden den Weg Filo → Claude → Filo natürlich, Arbeitstexte und Protokolle funktionieren
- Abhängigkeit: Schritte 1–6 komplett

### Schritt 8: Aufräumen in ragrun + Migration 019

**Migration `019_cleanup_watermelon.sql` einspielen** (aus Schritt 1c verschoben):

```sql
DROP FUNCTION IF EXISTS pull_changes(bigint, bigint);
DROP FUNCTION IF EXISTS push_changes(jsonb, bigint);
DROP FUNCTION IF EXISTS ms_to_ts(bigint);
DROP FUNCTION IF EXISTS ts_to_ms(timestamptz);
DROP TABLE IF EXISTS app_starter_prompts;
DROP FUNCTION IF EXISTS increment_starter_prompt_click(uuid);
```

Voraussetzung: Alle Tester sind auf einem Build ohne WatermelonDB.

- Chat-Endpunkte entfernen: `/app/chat`, `/app/chat/stream`, `/app/chats/*`
- Chat-Services entfernen: `app_chat_service.py`, `app_chat_stream_service.py`
- Chat-Graph entfernen: `assistant_chat_graph.py`, `intents.py`
- Problem-Solver entfernen: `problem_solver_graph.py`, Endpoint
- Alte Tool-Registry entfernen: `app/tools/`
- Nicht mehr gebrauchte Sync-Endpunkte entfernen: `/app/sync/pull`, `/app/sync/push`
- DeepSeek-Client: **bleibt** (wird von Pipeline-Tools genutzt)
- `rag_usage` / `llm_pricing`: bleiben (Pipeline-Tracking)
- Betroffene Dateien: siehe Abbauliste D.2
- Testkriterium: ragrun startet sauber, keine toten Imports, Pipeline-Tools (#7–#11) funktionieren weiter
- Abhängigkeit: Schritt 7 (Tester-Feedback positiv)

---

## F. Abhängigkeitsgraph

```
Schritt 0 (Deep-Link-Test) ──→ 5c (Link-Konfiguration Default)
Schritt 0f (OAuth-Vortest) ──→ 4a (OAuth-Ausbau)

Schritt 0a (Stabile IDs)
    │
    ├──→ 0b (Bücher-DB) ──→ 0c (Update-Mechanismus)
    │         │
    │         └──→ 2a (Buch-Cache) ──→ 2e/2f (Paragraph/Source Repos)
    │
    ├──→ 0d (Korpusabgleich)
    │
    ├──→ 0e (Qdrant-Payloads) ──→ 3b (search_corpus)
    │
    ├──→ 3c (get_passage)
    │
    └──→ 1c (Schema) ──→ 2b (Supabase-Repos) ──→ 2c (Hooks) ──→ 2d (Editor) ──→ 6c (Tab)
                │
                └──→ 3c (get_passage), 3d (get_protocol)

1a (WatermelonDB raus) ──→ 2a–2f (neue Datenschicht)
1b (Chat-Code raus) ──→ 6c (Tab-Umbau)

0f (OAuth-Vortest) ──→ 3a (MCP-Server) ──→ 3b–3g (Tools) ──→ 4a (OAuth) ──→ 4b/4c (User+Schreiben) ──→ 6b (Übergabe)

5a (Domain) ──→ 5b (Universal Links) ──→ 5d (Handling in App) ──→ 6b (Übergabe)

6a–6c ──→ 7 (Testen) ──→ 8 (Aufräumen ragrun + Migration 019)
```

**Branch-Merge-Punkt:** Nach 2a + 2e + 2f (Lesen/Suchen/Bücher funktionieren wieder).

**Parallelisierbar:**
- Schritt 0 (Deep-Link-Test) und 0f (OAuth-Vortest) — sofort, unabhängig voneinander
- Schritt 0a + 1a + 1b — unabhängig voneinander
- Schritt 3 (MCP-Server) parallel zu Schritt 2 (App-Datenschicht)
- Schritt 5a/5b (Domain + Universal Links) parallel zu allem

**Zwei kritische Pfade** (welcher länger ist, entscheidet sich an 0f):
- **Editor-Kette:** 0a → 1c → 2b → 2c → 2d → 6c → 7
- **MCP-Kette:** 0f → 3a → 3b–3g → 4a → 4b/4c → 6b → 7

Der OAuth-Vortest (0f) klärt früh, ob die MCP-Kette aufwändiger wird als geplant.

---

### Schritt 9 (optional): MCP in Claude Desktop / Claude Code / Cursor

Der MCP-Server ist von jedem MCP-Client nutzbar — nicht nur über die App. Voraussetzung: Der User hat sich über die App registriert und den MCP-Server dort verbunden (OAuth aus Schritt 4).

**9a. MCP-Konfiguration für Desktop-Clients**
- Dokumentation/Anleitung: Wie man den Filo-MCP-Server in Claude Desktop, Claude Code oder Cursor einrichtet
- Jeder Client durchläuft seinen eigenen OAuth-Flow gegen denselben Supabase-Account (der über die App erstellt wurde)
- Alle Lese-Tools (Suche, Lesen, Protokolle) und Schreib-Tools (Arbeitstexte, Protokolle) funktionieren

**9b. App-Hinweis im MCP-Server**
- In Tool-Antworten oder `handoff_instructions.md`: „Es gibt eine Filo-App für iOS/Android: ragxxx.com/app"
- Optional: MCP-Tool `get_app_info()` das Download-Links und Features zurückgibt

- Abhängigkeit: Schritte 3 + 4 (MCP + OAuth) müssen stehen
- Kein Blocker für Launch — reines Wachstumsfeature

---

## G. Risiken

| Risiko | Auswirkung | Gegenmaßnahme |
|--------|-----------|----------------|
| Deep Link funktioniert auf keiner Plattform direkt | Kern-UX blockiert | Schritt 0 als Allererstes; Notfall: In-App-Browser als Default-Strategie |
| Free-Claude-Kontingent zu klein | Nutzer frustriert | `detail: "kurz"` Default, knappe Auszüge, Hinweis in App |
| Supabase Auth unterstützt kein OAuth 2.1 mit Dynamic Client Registration | Mehr eigener Code in Schritt 4 | OAuth-Vortest (0f) klärt früh; Fallback: eigene Endpunkte, User-Token-Prinzip bleibt |
| expo-sqlite ohne WatermelonDB: Performance bei 50k Absätzen | Langsames Lesen | Gebundelte DB ist vorindexiert; SQLite-Indizes auf `source_id`, `segment_index` |
| Stabile-ID-Vergabe in ragprep aufwändig | Blockiert alles | Einfacher Algorithmus: `base62(random(8))`, einmal pro Absatz, in ragkeep speichern |
| Korpus-Update im Feld (neue books.db) | Großer Download (~15 MB) | Im Hintergrund laden, alte Version zeigen bis fertig |
| ragprep erzeugt bei neuem Lauf neue IDs | Alle Verweise brechen | IDs aus ragkeep übernehmen, Testkriterium aus 0a (zwei Läufe = identische IDs) |
| Gleichzeitiges Speichern von App und Claude | Verlorene Änderungen | `save_note()` als einzige transaktionale Speicherfunktion mit `FOR UPDATE`, Konflikterkennung in App und MCP |
| Absatz samt Anker im Quelltext gelöscht | ID verschwindet ohne Grabstein, Verweise brechen | Ankerprüfung im Normallauf (0a): Abbruch mit Liste verschwundener IDs |
| Neu extrahierte Fassung ohne Anker läuft durch Normallauf | Alle IDs des Bandes neu, alle Verweise brechen | Abbruch bei mehr als 5 % Absätzen ohne Anker |
| MCP-Tools erhalten weitergeleitete oder gelöschte IDs | Fehler statt Stelle bei Claude | Serverseitige Auflösung `resolve_passage` in allen relevanten Tools |
| Alte TestFlight-Builds nach Migration 019 | App bricht bei Testern | 019 erst in Schritt 8, wenn alle Tester auf neuem Build |
