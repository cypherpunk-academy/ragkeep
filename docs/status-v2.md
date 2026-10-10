# Stand der v2-Schritte

Stand 30.9.2026. Bestandsaufnahme auf dem Branch `philo-claude-integration` in ragapp, ragrun und ragkeep. Der Branch-Abschluss aus Abschnitt 9 des Plans ist im Code noch nicht gemacht. Diese Tabelle beschreibt den Branch, wie er heute vorliegt.

Datenbanken: Dev und Staging, gelesen über `RAGRUN_POSTGRES_DSN` aus `.env.dev` und `.env.staging`. Die Tabelle `supabase_migrations.schema_migrations` gibt es auf beiden nicht. Der Stand von Migration 018 ist deshalb an den Objekten abgelesen, nicht an einer Versionszeile.


| v2  | Inhalt                                    | Stand     | Befund                                                                                                                                                                                                                                                                                                 |
| --- | ----------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Invite-Gate entfernen                     | erledigt  | In ragapp gibt es keine Invite-UI mehr. Das DROP der Tabelle `invitations` bleibt Phase 4. Die Alembic-Datei `0026_create_invitations.py` liegt in ragrun noch im Repo.                                                                                                                                |
| 2   | Migration 018                             | erledigt  | Auf Dev und auf Staging liegen `connector_grants`, `handoffs`, `protocols`, `app_note_versions` und die RPCs `create_note`, `save_note`, `delete_note`, `undelete_note`, `create_handoff`.                                                                                                             |
| 3   | `books.db`-Pipeline                       | erledigt  | `scripts/fetch-db-seed.mjs` schreibt `assets/seed/books.db`. Die Datei liegt lokal, 43 MB, Datum 25.9.2026.                                                                                                                                                                                            |
| 4   | Chat-UI raus                              | teilweise | Der Pager hat keinen Chat-Screen. Tab 0 ist die Werkstatt. Die Tab-Id der Werkstatt heißt weiter `chat`. ragrun bedient `POST /app/chat/stream` noch.                                                                                                                                                  |
| 5   | Buch-Cache                                | erledigt  | `SourceRepository` und `ParagraphRepository` lesen `books.db`.                                                                                                                                                                                                                                         |
| 6   | Nutzerdaten-Repos und Editor              | erledigt  | `NoteRepository` schreibt über die RPCs. `useNote` und `NoteEditorModal` behandeln den Versionskonflikt.                                                                                                                                                                                               |
| 7   | WatermelonDB weg                          | erledigt  | `package.json` enthält kein `@nozbe/watermelondb`. Vorhanden sind `expo-sqlite` und `better-sqlite3`.                                                                                                                                                                                                  |
| 8   | Expo-Upgrade                              | erledigt  | `expo` ~57, `react-native` 0.86.3. `expo-doctor` ist in dieser Prüfung nicht gelaufen.                                                                                                                                                                                                                 |
| 9   | Korpus-OTA                                | teilweise | `GET /app/corpus-version` und `useCorpusUpdate` sind im Code. Ob die Download-URL auf Dev und Staging eine aktuelle Datei ausliefert, ist nicht geprüft.                                                                                                                                               |
| 10  | OAuth-Vortest                             | erledigt  | Der Staging-Connector läuft. Dev antwortet über den eingetragenen ngrok-Host.                                                                                                                                                                                                                          |
| 11  | MCP lesen                                 | erledigt  | `search_corpus`, `get_passage`, `list_volumes`, `get_protocol`, `list_work_texts`, `get_work_text`, `whoami` sind registriert. Das Belegobjekt aus Abschnitt 6.1 fehlt noch. Das ist Phase 1.                                                                                                          |
| 12  | OAuth und Consent                         | erledigt  | Grants entstehen. `GET /app/claude-status` verlangt einen Bearer-Token und antwortet ohne Token mit 401.                                                                                                                                                                                               |
| 13  | MCP schreiben                             | erledigt  | `create_work_text`, `update_work_text`, `append_to_protocol`, `get_handoff` sind registriert. Der Plan hält die Schreibtools auf Staging für getestet.                                                                                                                                                 |
| 14  | Domain, Universal Links, Deep-Link-Config | teilweise | Staging und der ngrok-Host liefern `GET /app/deep-link-config`. `apple-app-site-association` liegt auf Staging und auf dem ngrok-Host. `https://staging.ragxxx.com/passage/{id}` antwortet für eine unbekannte Id mit „Nicht gefunden“. `https://ragxxx.com` hat kein Zertifikat für diesen Hostnamen. |
| 15a | Connector-Setup                           | teilweise | Die Werkstatt ruft `GET /app/claude-status`. Der Einrichtungslink ist `https://claude.ai/settings/integrations?add=…`. Der Plan nennt `claude.ai/customize/connectors?modal=add-custom-connector`.                                                                                                     |
| 15b | Übergabe                                  | teilweise | Langer Druck öffnet ein Menü mit einer Aktion. Sie legt einen Handoff an und öffnet fest `https://claude.ai/new?q=Handoff {id}`. Das Absatzmenü aus Abschnitt 8.1 gibt es nicht. `deep-link-config` wird dafür nicht gelesen.                                                                          |
| 15c | Werkstatt                                 | teilweise | Zustände nicht eingeloggt, nicht verbunden, widerrufen, verbunden ungenutzt und verbunden sind im Screen. Zuletzt gelesen und Gespräche über `conversation_url` fehlen. Das Bild von Philo fehlt.                                                                                                      |
| 15d | Vortragsdaten                             | teilweise | Dev hat den Katalog. Staging hat ihn nicht. `get_lecture_info` und `list_lectures` fehlen. Details unten.                                                                                                                                                                                              |
| 16  | Tester                                    | offen     | Phase 4.                                                                                                                                                                                                                                                                                               |
| 17  | Aufräumen                                 | offen     | Phase 4. Nächste freie App-Migration nach 018, nicht 019.                                                                                                                                                                                                                                              |
| 18  | Desktop-MCP                               | offen     | Optional. `client_kind` fehlt in `connector_grants`.                                                                                                                                                                                                                                                   |




## Migration 018, Spalten von `connector_grants`

Dev und Staging haben dieselben Spalten: `id`, `user_id`, `client_id`, `client_name`, `created_at`, `last_refresh`, `last_mcp_request`, `revoked_at`. `client_kind` und `redirect_host` fehlen. Das entspricht `018_claude_integration.sql` und noch nicht Abschnitt 8.2.

## Vortragskatalog

`ragkeep/sql/019_lecture_catalog.sql` ist auf Dev eingespielt, auf Staging nicht. Staging hat in `rag_sources` weder `source_type` noch `ga`. Staging hat 55 Zeilen in `rag_sources`.

Dev, verglichen mit dem Konsistenzplan vom 29.9.:


| Größe                                       | Konsistenzplan             | Dev heute                                                          |
| ------------------------------------------- | -------------------------- | ------------------------------------------------------------------ |
| `rag_lecture_catalog`                       | 5303                       | 5303                                                               |
| `rag_lecture_cycles`                        | —                          | 50                                                                 |
| `rag_sources` mit `source_type = 'lecture'` | 276                        | 276                                                                |
| `rag_sources` mit `source_type = 'book'`    | 57                         | 57                                                                 |
| Katalogzeilen mit Chunks (`has_chunks`)     | 276                        | 276                                                                |
| Chunked, `vortragstitel` leer               | 40                         | 40                                                                 |
| Chunked, generischer `vortragstitel`        | 58                         | 55 mit dem Muster „Vortrag N“, „Erster Vortrag“, „Zweiter Vortrag“ |
| Leerer Anzeigetitel in `rag_sources`        | Titel nur „Rudolf Steiner“ | 0 leer                                                             |
| Anzeigetitel mit GA-Nummer                  | —                          | 94 von 276                                                         |


Der leere Katalogtitel ist bei den 276 Vorträgen mit Chunks noch da. Der Anzeigetitel in `rag_sources` ist gefüllt, bei 94 Einträgen mit GA-Nummer. Im ganzen Katalog sind 578 `vortragstitel` leer, nicht nur bei den Vorträgen mit Chunks.

`rag_chunks` auf Dev hat 624 verschiedene `source_id`, alle UUID-förmig. 326 davon sind weder `rag_sources.id` noch `rag_lecture_catalog.uuid`. Die Abfrage trennt Bücher und Vorträge nicht, wenn die Chunk-Id in keiner der beiden Tabellen steht. Eine eigene Zählung nur der Vorträge ohne Katalogzeile steht noch aus.

## `GET /app/claude-status` und `GET /app/deep-link-config`

`GET /app/claude-status` ohne Token, Staging, 30.9.2026: HTTP 401, `{"detail":"Missing Bearer token"}`. Mit Token liefert der Code einen von `not_connected`, `revoked`, `connected_unused`, `connected`. Bei `connected` kommt `last_active` dazu.

`GET /app/deep-link-config` ist ohne Token erreichbar.

Staging, HTTP 200:

```json
{"strategy":"native_app","claude_base_url":"https://claude.ai/new","auto_send":false,"passage_base_url":"https://staging.ragxxx.com/passage","text_base_url":"https://staging.ragxxx.com/text"}
```

Dev über den ngrok-Host aus `.env.dev`, HTTP 200, dieselbe Form. `passage_base_url` und `text_base_url` zeigen auf diesen ngrok-Host. Der Plan in Abschnitt 8.3 will später eine Liste `clients` mit `url_template` pro `client_kind`. Die liefert der Endpunkt heute nicht.

## App: WatermelonDB, `books.db`, Absatzmenü

Die App auf dem Branch nutzt WatermelonDB nicht mehr. Lesen geht über `books.db`.

Das Absatzmenü ist der lange Druck in `ReadScreen`: Notiz, Lesezeichen, eine Übergabe „vertiefen“. Die Übergabe ist kein Sheet mit Funktionen, mitgegebenen Texten und Protokoll. Sie springt fest zu Claude.

## Absatz-UUIDs bei `rag:chunk`

`rag:chunk` vergibt die Absatz-UUID nicht neu aus einem natürlichen Schlüssel. Der Abgleich in `paragraphChapterMatcher.ts` läuft so. Gleicher Absatzindex und gleicher Lemma-Fingerabdruck: die bestehende UUID bleibt (`keep`). Gleicher Fingerabdruck unter anderem Index: die UUID bleibt, die Nummer ändert sich (`renumber`). Weicht der Text ab: die alte Zeile wird ersetzt, die neue UUID kommt aus `randomUUID()` (`replace` oder `insert`). Der Upsert `ON CONFLICT (source_id, segment_slug, paragraph_number) WHERE deprecated_at IS NULL` schreibt die Id nicht um. Ein Lauf über unveränderten Text behält die UUIDs. Ein Lauf, der den Fingerabdruck verfehlt, erzeugt neue UUIDs. Option A der Korpus-Promotion scheidet damit aus, sobald der erneute Lauf Texte oder Absatzgrenzen ändert. Die Entscheidung A, B, C oder D bleibt bei Michael.

## Philo-Band-Zählung

Eine Zählung der Philo-Bände für die Zitierform gibt es nicht. `primary-books` im Manifest ist eine geordnete Liste von Werktiteln ohne Bandnummer. Die Ordner „Band 1“ und „Band 2“ unter den Projekten sind die Essay-Reihen, keine Korpus-Zählung. Für die Zitierform gilt der Bandtitel.

## Nebenbefund Staging-Konfiguration

In `.env.staging` zeigt `RAGRUN_SUPABASE_URL` auf das Staging-Projekt. Der Service-Role-Key in derselben Datei ist für das Dev-Projekt ausgestellt. Die Datenbankprüfung dieser Bestandsaufnahme lief über `RAGRUN_POSTGRES_DSN`, und der gehört zum Staging-Projekt.