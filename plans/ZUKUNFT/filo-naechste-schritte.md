# Filo × KI — die nächsten Schritte

Stand 30.9.2026. Arbeitsgrundlage für die nächste Runde in **ragapp**, **ragrun** und dem Supabase-Schema (**ragxxx**, Dev und Staging).

Dieses Dokument fasst drei Quellen zusammen und gilt ab hier als Ausführungsplan:

- die Übergabe vom 29.9.2026 (vier Bereiche; in Filo Staging liegt eine kürzere Fassung als Arbeitstext `79f076ff-2c7c-4ddb-a828-3f7fa4224485`, dort fehlt Bereich 4)
- [`filo-claude-integration-plan-v2.md`](../legacy/filo-claude-integration-plan-v2.md) (24.9.2026; Archiv — bindend ist Abschnitt 1 dieses Dokuments)
- [`lecture-sources-plan.md`](../lecture-sources-plan.md), ergänzt um den Befund aus [`philo-claude-consistency-plan.md`](./philo-claude-consistency-plan.md) (29.9.2026)

Weiter gültig und hier nicht wiederholt: [`corpus-promotion.md`](./corpus-promotion.md). `philo-tab-konzept.md` ist in der Übergabe genannt und liegt nicht im Repo; der Werkstatt-Tab folgt Abschnitt 5 dieses Dokuments. Plan v1/v2 liegen unter [`../legacy/`](../legacy/).

Wo sich die Quellen widersprechen, gilt dieses Dokument. Alle Entscheidungen aus v2, Abschnitt A, bleiben verbindlich und stehen in Abschnitt 1. Produktion nur nach ausdrücklicher Freigabe durch Michael.

---

## 0. Arbeitsregeln

Erster Punkt ist der Abschluss von `philo-claude-integration` in ragapp, ragrun und ragkeep. Der Branch enthält `main` und die vorhandene Umsetzung von v2. Die Arbeit geht auf diesem Branch weiter. Ein frischer Branch von `main`, der dieselbe Umsetzung noch einmal baut, entfällt. Der Abschluss steht in Abschnitt 9 vor Phase 0.

Migrationen zuerst auf Dev, dann Staging. Nichts löschen, was alte TestFlight-Builds brauchen (v2, Schritt 17).

Alle neuen Schreibwege auf `app_notes` laufen über RPCs (`create_note`, `save_note`, `delete_note`, `undelete_note`, später `fork_note`). Keine direkten INSERT/UPDATE-Policies.

MCP-Datenzugriff auf Nutzerdaten mit dem User-Token (RLS). Service-Key nur für Korpusdaten.

Konfiguration, die sich ohne App-Release ändern soll, liegt serverseitig in `ragrun/app/mcp_server/config/` und wird über `/app/*`-Endpunkte ausgeliefert.

Texte für Nutzer auf Deutsch. In Markdown-Dokumenten keine Zeilenumbrüche innerhalb eines Absatzes, Indikativ statt Konjunktiv, kein Dativ-e.

Belege der Korpus-Bände nach Philo-Band, Kapitel bzw. Vortrag und Absatz. Die GA-Nummer bleibt dort ein internes Feld (`rag_sources.ga`, Katalog). Sie erscheint nicht in `zitierform` und nicht in Titeln, die Claude oder die App für diese Bände dem Nutzer zeigen. Die GA selbst liegt zusätzlich als Qdrant-Collection `rudolf-steiner-ga` mit eigenen Funktionen. Belege daraus bleiben in der Form „GA 23, S. 32“.

Bei offenen Entscheidungen (Abschnitt 11) nicht raten: Varianten kurz darstellen, dann fragen.

---

## 1. Verbindliche Entscheidungen aus v2


| Thema                           | Entscheidung                                                                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Bücher offline                  | Gebündelte SQLite `books.db`, kein WatermelonDB                                                                                |
| Nutzerdaten                     | Direkt Supabase, Arbeitstexte über RPCs                                                                                        |
| Arbeitstexte                    | Soft-Delete, Versionierung, Anlegen durch die KI nur auf Wunsch                                                                |
| Protokolle                      | Pro Kapitel bzw. Vortrag; Eintrag optional mit `paragraph_id`                                                                  |
| Handoff                         | Kurz-ID aus der DB; Anweisungen in `handoff_instructions.md` auf dem Server                                                    |
| Claude-App                      | Nicht voraussetzen; der Browser reicht                                                                                         |
| Detail-Default                  | Immer `"kurz"`; kein Tarif abfragen                                                                                            |
| Connector-Status                | Tabelle `connector_grants` plus `GET /app/claude-status`                                                                       |
| Status-Werte                    | `not_connected`, `connected_unused`, `connected`, `revoked`                                                                    |
| Auth-Consent                    | Selbst gebaut auf `ragxxx.com`: Email-OTP, Apple, Google                                                                       |
| Registrierung                   | Offen, kein Invite-Gate; MCP-first ist möglich                                                                                 |
| OAuth-Grant                     | Jeder erfolgreiche MCP-Grant (client_id aus der dynamischen Client-Registrierung), nicht an eine Claude-Redirect-URI gekoppelt |
| Connector-Setup                 | Prefill-Deep-Link, dann Add, dann Connect, dann OAuth. Add allein erzeugt keinen Grant                                         |
| Deep-Link                       | HTTPS `https://claude.ai/new?q=…`, getestet auf iOS und Android (23.9.2026). Prompt wird nie automatisch gesendet              |
| Domain                          | `ragxxx.com`                                                                                                                   |
| Chat, Problem-Solver, App-Tools | Entfallen zugunsten der KI plus MCP                                                                                            |
| DeepSeek                        | Bleibt nur für die Pipeline                                                                                                    |
| Absatz-ID                       | UUID `rag_paragraphs.id`. Keine neue ID-Schicht                                                                                |
| Korpus-Redirect                 | `passage_redirect` in 1.0 leer, Pass-through                                                                                   |


Nicht mehr im Plan, weil erledigt, entfallen oder verworfen: Deep-Link-Test als eigener Arbeitsschritt, `user_profiles`, `claude_tier`, Weiterentwicklung des Einladungs-Gates, Spezial-Korpusabgleich und Qdrant-Payload-Umbau für 1.0.

---

## 2. Zielbild Daten und Abbau


| Datentyp                           | Ziel                                                                                     |
| ---------------------------------- | ---------------------------------------------------------------------------------------- |
| Buch- und Vortragsinhalte, Katalog | `books.db` (Bundle und OTA) plus `rag_lecture_catalog` / `rag_sources`                   |
| Arbeitstexte                       | `app_notes` und `app_note_versions` über RPCs                                            |
| Formen eines Arbeitstexts          | Eigene Zeilen mit `format` und `parent_id`, sofern Michael das in Abschnitt 11 bestätigt |
| Bibliothek                         | `app_notes.visibility = 'library'`, Fork über `fork_note`                                |
| Lesezeichen                        | `app_bookmarks`                                                                          |
| Leseposition                       | AsyncStorage zuerst, danach Sync nach Supabase                                           |
| Protokolle                         | `protocols` und `protocol_entries`                                                       |
| Handoffs                           | `handoffs` und `create_handoff()`, erweitert um Funktion und mitgegebene Texte           |
| Connector                          | `connector_grants`, ergänzt um `client_kind` und `redirect_host`                         |
| Aktivität                          | `mcp_activity`, nur Metadaten                                                            |
| Chat, Starter-Prompts, Invite      | Entfernt, sobald kein alter Build sie mehr braucht                                       |


Abbau, sobald Lesen und Nutzerdaten ohne die alte Schicht laufen:

- **ragapp:** WatermelonDB (`database`, Schema, Models, Sync, seedLoader, `db-snapshot.json`), Chat-UI, Invite-UI, Abhängigkeit `@nozbe/watermelondb`.
- **ragrun:** Chat-Endpunkte, Problem-Solver, `app/tools/`, Sync-Endpunkte, Invite-API, falls noch vorhanden.
- **Supabase, spät:** `pull_changes`, `push_changes`, `ms_to_ts`, `ts_to_ms`, `app_starter_prompts`, `invitations`. Chat-Tabellen archivieren und nicht mehr ansprechen. DeepSeek, `rag_usage` und `llm_pricing` bleiben.

---

## 3. Abgelöste Festlegungen

Diese Punkte aus den älteren Plänen gelten nicht mehr.

**Anzeigetitel der Korpus-Bände enthalten keine GA-Nummer.** `sync_lectures.ts` hängt im Fallback noch „(GA …)“ an den Titel (`buildDisplayTitle`). Das widerspricht der Zitierregel in Abschnitt 0. Der Branch-Abschluss nimmt die GA-Nummer aus der bestehenden Funktion. Phase 1 setzt danach die Titelregeln aus Abschnitt 6.1 und synct sie. Das Feld `ga` und der Katalog bleiben. Die Collection `rudolf-steiner-ga` zeigt die GA-Nummer.

**Aufräumen ist nicht Migration 019.** Die Vortragstabellen liegen in `ragkeep/sql/019_lecture_catalog.sql`. Die App-Migrationen in `ragapp/supabase/migrations/` enden bei `018_claude_integration.sql`. Neue App-Migrationen und das späte DROP aus v2 Schritt 17 bekommen die jeweils nächste freie Nummer in dieser Reihe. Die Nummer 019 wird nicht doppelt belegt.

**Der Pre-Push-Hook synct Vorträge noch nicht.** `scripts/hooks/pre-push` ruft `sync_sources.ts` auf, nicht `sync_lectures.ts`. Der Hook schreibt nach Dev. Staging bleibt manuell. Produktion wartet auf Freigabe.

---

## 4. Phase 0 — Bestandsaufnahme

Nach dem Branch-Abschluss, und mit Rückmeldung an Michael, bevor Phase 1 beginnt. Die Bestandsaufnahme gilt `philo-claude-integration`, nicht `main`. Ergebnis als Tabelle in `docs/status-v2.md`: für jeden v2-Schritt 1–18 der Stand erledigt, teilweise oder offen.

Zusätzlich prüfen:

- Ist Migration 018 auf Dev und Staging eingespielt? Welche Spalten hat `connector_grants` tatsächlich?
- Liegt `ragkeep/sql/019_lecture_catalog.sql` auf Dev und auf Staging? Stimmen die Zählungen aus dem Konsistenzplan (Katalog vollständig, Vorträge mit Chunks in `rag_sources`)?
- Nutzt die App noch WatermelonDB? Liest sie schon aus `books.db`?
- Gibt es das Absatz-Kontextmenü und das Übergabe-Sheet (v2, 15b) schon, und in welcher Form?
- Was liefern `GET /app/claude-status` und `GET /app/deep-link-config` heute?
- Erhält `rag:chunk` beim erneuten Lauf die bestehenden Absatz-UUIDs (Upsert auf einem natürlichen Schlüssel), oder erzeugt es neue UUIDs? Das Ergebnis entscheidet die Korpus-Promotion, siehe Abschnitt 6.1.
- Gibt es eine Philo-Band-Zählung für die Zitierform? Sonst gilt der Bandtitel.

Bekannt, ohne die Prüfung auf den Datenbanken zu ersetzen: Der Absprung per `https://claude.ai/new?q=…` funktioniert auf iOS und Android. Absätze haben UUIDs. Der Staging-MCP läuft seit 28.9. als Custom Connector (`https://staging.ragxxx.com/mcp`), Dev über ngrok. Verfügbare Tools: `search_corpus`, `get_passage`, `list_volumes`, `get_protocol`, `append_to_protocol`, `list_work_texts`, `get_work_text`, `create_work_text`, `update_work_text`, `get_handoff`, `whoami`. `create_work_text` und `update_work_text` sind auf Staging getestet. `sync_lectures.ts` schreibt den Katalog nach `rag_lecture_catalog` und chunked Vorträge nach `rag_sources`, inklusive Display-Titel.

---

## 5. Bereich 1 — App fertig gestalten

### 5.1 Werkstatt

Tab 0. Bild von Philo oben links, darunter Aktivitäten: zuletzt gelesen, zuletzt bearbeitete Arbeitstexte, Gespräche mit der KI über `conversation_url`. Der Leerzustand zeigt die Möglichkeiten Lesen und KI verbinden. Ist eine Verbindung aktiv, ersetzt der Absprung die Anleitung. Umfasst v2 15a (Connector-Setup) und 15c (Tab-Zustände). Das Übergabe-Sheet aus 15b wandert nach Bereich 4.

Connector-Setup: Claude-Konto, Prefill-Link `claude.ai/customize/connectors?modal=add-custom-connector`, in Claude Add dann Connect dann OAuth, danach `GET /app/claude-status`. Ein Free-Konto hat einen Connector-Platz. Die Claude-App ist keine Voraussetzung. MCP-first bleibt möglich: Connector, Consent mit Registrierung, Grant, später Login in der App, Status ist dann schon verbunden.

Akzeptanz: Die Zustände nicht eingeloggt, nicht verbunden, verbunden ungenutzt, verbunden aktiv und widerrufen zeigen sinnvollen Inhalt. Von der KI angelegte oder geänderte Texte erscheinen in den Aktivitäten.

Die GitHub-Anbindung im Philo-Tab ist in Abschnitt 11 offen. Bis zur Entscheidung gibt es dafür keinen Umfang.

### 5.2 Arbeitstexte

Markdown-Rendering beim Lesen: Überschriften, Zitate, Listen, Hervorhebung, Code. Editor mit Umschalter Bearbeiten und Vorschau.

Titel-Fallback in der App und in `list_work_texts`. Notizen auf Staging vom Juli 2026 haben `title = NULL` und erscheinen leer. Anzeige: erste Überschrift, sonst erster Satz, etwa 60 Zeichen, sonst der Stellenbezug. Die gespeicherten Daten bleiben unverändert. Der Nutzer setzt einen Titel, wenn er einen will.

Kopfzeile mit Stellenbezug aus `zitierform`, tippbar, springt zur Stelle.

Herkunft sichtbar: angelegt von Nutzer oder KI (`created_by`), Version, Verlauf aus `app_note_versions` mit `changed_by`, Papierkorb.

Vor dem Editorumbau stehen die v2-Schritte 5 bis 7, sofern Phase 0 sie noch offen zeigt: Buch-Cache auf `books.db`, Nutzerdaten-Repos über RPCs, WatermelonDB entfernen. Chat-UI (Schritt 4) fällt im selben Branch. Der Branch merged, wenn Lesen, Suche und Bücher wieder laufen.

### 5.3 Arbeitstext als Paket von Formen

Ein Arbeitstext hat einen Kern (Markdown) und abgeleitete Formen. Die KI schlägt Formen vor und legt sie nur auf Wunsch an.

Startliste, sofern Michael sie bestätigt: `markdown` (Kern), `facebook_post` (Philos Stimme, Anschluss an die Post-Manufaktur), `kurzfassung`, `essay`, `zitatsammlung`, `studienfragen`, `arbeitsdiagramm`, `stichwortzettel`.

Vorgeschlagenes Datenmodell. Alternative steht in Abschnitt 11: Fassungen innerhalb eines Textes.

```sql
ALTER TABLE app_notes
  ADD COLUMN IF NOT EXISTS format varchar(32) NOT NULL DEFAULT 'markdown',
  ADD COLUMN IF NOT EXISTS parent_id text REFERENCES app_notes(id),
  ADD COLUMN IF NOT EXISTS parent_version integer;
```

`text_type` bleibt die Art (note, draft, essay). `format` ist der Zweck der Form. Die Tool-Beschreibungen trennen beides.

`create_note` bekommt optionale Parameter `p_format` und `p_parent_id`. `parent_version` setzt die RPC aus der aktuellen Version des Kerns.

Die App zeigt am Kern die Formen als Reiter oder Liste. Ist `parent_version` kleiner als die aktuelle Kern-Version, zeigt die Form den Hinweis „Kern wurde seitdem geändert“.

`create_work_text` bekommt `format` und `parent_id`. `get_work_text` liefert beim Kern die Liste seiner Formen. Jede Form hat Kopieren und Teilen.

Die Liste der Formen mit Kurzbeschreibung liegt in `config/text_formats.yaml`. App und MCP nutzen dieselbe Quelle, ausgeliefert über einen `/app/*`-Endpunkt.

Akzeptanz: Aus einem Kern entsteht über Claude ein Facebook-Post als verknüpfte Form. Die App zeigt beide zusammen. Eine Änderung am Kern markiert die Form als veraltet.

### 5.4 Technische Restarbeiten aus v2

Nach dem Stand aus Phase 0, dort wo sie Voraussetzung sind:


| v2  | Inhalt                                                                                           | Wann                                                   |
| --- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| 4   | Chat-UI raus, Tab 0 vorerst Platzhalter                                                          | Vor dem Werkstatt-Tab, gleicher Branch wie 5–7         |
| 5   | Buch-Cache `books.db`, Lesen offline                                                             | Vor dem Editor                                         |
| 6   | Nutzerdaten-Repos, Editor, Konflikt bei Versionsmismatch                                         | Vor dem Editor                                         |
| 7   | WatermelonDB vollständig entfernen                                                               | Direkt nach 5 und 6, dann Merge nach `main` möglich    |
| 8   | Expo 54 → 57 in Einzelschritten, jeweils `expo-doctor`                                           | Nach 7                                                 |
| 9   | Korpus-OTA: `GET /app/corpus-version`, `user_version`, atomarer Ersatz der DB                    | Nach 5, Hosting der `.db` festlegen                    |
| 14  | Domain, Universal Links, `ragxxx.com/passage/{id}` und `/text/{id}`, `GET /app/deep-link-config` | Mit Bereich 4, damit Rücklinks in den Belegen aufgehen |
| 17  | Aufräumen, DROP der Sync- und Invite-Objekte                                                     | Phase 4, nach dem Tester-Build                         |


Schritt 1 (Invite-Gate entfernen) bleibt Voraussetzung für offene Registrierung. Ist er offen, läuft er vor dem Connector-Setup, nicht erst in Phase 4. Die Tabelle `invitations` fällt erst mit dem Aufräumen.

---

## 6. Bereich 2 — Schnittstelle exakt und durchschaubar

### 6.1 Exakt

**Belegobjekt.** Jede Tool-Antwort, die eine Stelle nennt (`search_corpus`, `get_passage`, `get_protocol`, `get_handoff`, `get_work_text` mit Stellenbezug), liefert dasselbe Objekt:

```json
{
  "paragraph_id": "uuid",
  "band": "Titel des Philo-Bands bzw. der Quelle",
  "segment_kind": "kapitel | vortrag",
  "segment_title": "…",
  "paragraph_number": 12,
  "ort": "… (nur bei Vorträgen)",
  "datum": "… (nur bei Vorträgen)",
  "zitierform": "Band, Kapitel/Vortrag, Absatz 12",
  "return_url": "https://ragxxx.com/passage/{paragraph_id}"
}
```

`zitierform` ist die fertige Zeichenkette für die Korpus-Bände. Die Server-Instructions verlangen, dass die KI sie unverändert übernimmt und nichts selbst zusammensetzt. Keine GA-Nummern in dieser Form. `band` ist der Philo-Bandtitel. Eine eigene Band-Zählung nur, wenn Phase 0 sie findet. Die Collection `rudolf-steiner-ga` nutzt dieses Belegobjekt nicht. Dort bleibt die Stellenangabe „GA 23, S. 32“.

**Vollständige Tool-Antworten.** Kein `null`, wo die KI für den nächsten Schritt eine Angabe braucht: Titel-Fallback aus 5.2, Versionsnummer, Rücklink.

**Gleicher Korpus in allen Umgebungen.** Optionen stehen in `corpus-promotion.md` (A nochmal chunken, B Zeilen kopieren, C direkt gegen Prod, D zentrale Korpus-Tabellen). Phase 0 prüft die UUID-Stabilität von `rag:chunk`. Erzeugt ein erneuter Lauf neue UUIDs, scheidet A aus: Verweise aus Arbeitstexten, Protokollen und Handoffs zeigen dann in Prod ins Leere. B und D halten die UUIDs. Empfehlung an Michael, Entscheidung in Abschnitt 11. Bei jeder Promotion entsteht aus der Ziel-Datenbank ein neues `books.db` für genau dieses Environment.

**Referenztests.** Sammlung `ragrun/tests/mcp_reference/*.yaml` mit Fragen und erwarteten `paragraph_id`s bzw. Belegen. Ein Skript lässt `search_corpus` und `get_passage` dagegen laufen und meldet Trefferquote und Belegformat. Startumfang etwa 20 Fragen. Michael liefert Fragen und Stellen, die Umsetzung baut Gerüst und Skript.

**Saubere Vortragsdaten.** Infrastruktur aus dem Vortragsplan ist im Repo vorhanden und wird nicht neu entworfen:

- Schema: `ragkeep/sql/019_lecture_catalog.sql` (`rag_sources.source_type` und `ga`, `rag_lecture_catalog`, `rag_lecture_cycles`, Lesen für `authenticated`).
- Sync: `ragkeep/scripts/sync_lectures.ts` (`--all` und Git-Diff). Quelle ist `steineroriginals/rudolf-steiner-ga-lecture-catalog.yaml`. Zyklentitel aus dem Zyklus-YAML. Chunked Vorträge (Join `rag_chunks` auf Katalog-UUID) gehen nach `rag_sources` mit `source_type = 'lecture'`.
- `list_volumes` listet nur Bände (`source_type = 'book'`). Die Resource `philo://corpus/volumes` folgt derselben Grenze. Einzelvorträge stehen nicht in dieser Liste. Heute liefert der Aufruf jede Zeile aus `rag_sources`, 333 Einträge, davon 276 Vorträge. Der Katalog hat 5303 Vorträge. Eine Gesamtliste von rund 5000 Titeln entfällt.
- `get_lecture_info` und `list_lectures` werden in Phase 1 auf dem MCP-Server gebaut, nach `lecture-sources-plan.md`. Dort heißt das Listentool `list_ga_lectures`. Dass sie heute fehlen, streicht sie nicht. `list_lectures` nimmt die GA-Nummer als internes Feld und liefert die Vorträge dieses Bandes. `get_lecture_info` liefert zu einer `source_id` Ort, Datum, Zyklus und ob Chunks vorliegen. Titel und `zitierform` bleiben ohne GA-Nummer. Das Belegobjekt benennt die Stelle. Die beiden Tools ersetzen es nicht. `list_volumes` wird erst auf Bände begrenzt, wenn `list_lectures` da ist.

Offen in Phase 1:

- CSV der Problemfälle: leere Titel, generische Titel, Dubletten, Bände die zusätzlich als Einzelvorträge erscheinen, Einträge die keine Vorträge sind (Besprechungen, Schlussworte, Seminare). Der Konsistenzplan vom 29.9. nennt als Größenordnung 40 leere Titel, 58 generische Titel, etwa 20 Doppelgruppen, etwa 25 Nicht-Vorträge, und `reihe`/`zyklus` bei den titellosen leer. Phase 0 bestätigt die Zahlen auf der jeweiligen Datenbank.
- Anzeigetitel neu setzen und syncen, nach dieser Reihenfolge. Die Katalog-YAML bleibt unverändert.
  1. `vortragstitel` vorhanden und nicht generisch: diesen Titel. Kommt er mehrfach vor, „ (Ort, Datum)“ anhängen.
  2. Generisch („Vortrag N“, „Erster Vortrag“, …): Zyklustitel und Vortrag, sonst Philo-Bandtitel und Vortrag, sonst „Vortrag N (Ort, Datum)“.
  3. Leer: Zyklustitel und Ort/Datum, sonst Philo-Bandtitel und Ort/Datum, sonst „Vortrag — Ort, Datum“.
  Der Philo-Bandtitel kommt aus der bestehenden GA-Titelzuordnung, ohne die Nummer anzuzeigen. Komma-GAs nutzen für diese Zuordnung die erste Nummer, wie der Sync das schon tut. Die GA-Nummer selbst bleibt nur in `ga`.
- Pre-Push-Hook auf Dev um `sync_lectures.ts` ergänzen, nach dem Muster von `sync_sources.ts`. Staging manuell mit `--env-file`. Produktion erst nach Freigabe.
- Vorträge in `rag_chunks`, deren UUID nicht im Katalog steht, zählt Phase 0. Der Sync erfasst sie heute nicht, weil der Join innen liegt.

Bis Michael entscheidet, bleiben Band und Einzelvorträge beide sichtbar. Nichts davon löschen. Nicht-Vorträge bleiben `lecture`, bis eine eigene `source_type` entschieden ist.

Akzeptanz: `list_volumes` liefert nur Bände, jeder mit unterscheidbarem Titel ohne GA-Nummer. `list_lectures` liefert die Vorträge eines Bandes, nicht den Katalog. `get_passage` für einen Vortrag liefert Autor, Band- bzw. Vortragstitel, Ort, Datum und `zitierform`.

### 6.2 Durchschaubar

**Befehlsübersicht aus einer Quelle.** `config/commands.yaml` beschreibt jedes Tool: Zweck, lesend oder schreibend, Parameter, Beispiel, typischer Satz im Gespräch. Daraus entstehen die MCP-Resource `filo://befehle`, die Hilfeseite in der App über `GET /app/commands` und die Tool-Beschreibungen.

**Kurzbefehle.** Feste Formulierungen in den Server-Instructions, dieselbe Liste auf der Hilfeseite. Startformulierungen: „Filo, suche …“, „Filo, leg das als Arbeitstext ab“, „Filo, mach daraus einen Facebook-Post“, „Filo, was steht im Protokoll zu diesem Kapitel?“.

**Rückmeldung nach jedem Schreiben.** Schreibende Tools liefern Titel, Version und Rücklink. Die Server-Instructions verlangen, dass die KI diese drei Angaben nennt.

**Aktivitätsprotokoll.** Nur Metadaten, keine Inhalte.

```sql
CREATE TABLE mcp_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  grant_id uuid REFERENCES connector_grants(id),
  tool text NOT NULL,
  target_kind varchar(16),
  target_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

`target_kind` ist `note`, `paragraph`, `protocol` oder `handoff`. RLS: SELECT nur eigene Zeilen, Schreiben nur das Backend. Anzeige im Werkstatt-Tab. Von der KI geänderte Texte sind markiert und lassen sich mit der Vorversion vergleichen (Diff aus `app_note_versions`). Welche Aufrufe und wie lange sie bleiben, entscheidet Michael.

**Offene Anweisungen.** Server-Instructions und `handoff_instructions.md` sind in der App lesbar, Hilfeseite, Abschnitt „Was die KI über Filo gesagt bekommt“.

---

## 7. Bereich 3 — Neue Inhalte als Arbeitstexte

### 7.1 Filo-Bibliothek

Startbestand: die vorbereiteten Arbeitstexte aus den Philo-Büchern 1 bis 3, Buch 2 als Arbeitsdiagramm. Später die Essays der Gedankenreisen. Diese Texte sind für alle angemeldeten Nutzer lesbar, nicht veränderbar, und lassen sich in die eigenen Arbeitstexte übernehmen.

```sql
ALTER TABLE app_notes
  ADD COLUMN IF NOT EXISTS visibility varchar(16) NOT NULL DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS forked_from text REFERENCES app_notes(id),
  ADD COLUMN IF NOT EXISTS forked_from_version integer;
```

`visibility` ist `private` oder `library`. `chk_created_by` um `'filo'` erweitern. RLS: SELECT auf `visibility = 'library'` für alle `authenticated`, zusätzlich zu den eigenen Zeilen. `save_note` weist Bibliothekstexte für normale Nutzer ab.

Neue RPC `fork_note(p_id)` legt eine private Kopie an und setzt `forked_from` sowie `forked_from_version`.

Import-Skript: Quelle, Format und Stellenbezüge klärt die Umsetzung mit Michael, bevor Zeilen geschrieben werden.

Ein Bibliothekstext bezieht sich meist auf mehrere Stellen. Verknüpfungstabelle `app_note_paragraphs (note_id, paragraph_id)`, damit das Lesen zu jedem Kapitel die passenden Texte findet. `app_notes.paragraph_id` bleibt der Hauptanker.

### 7.2 Finden und Weiterarbeiten

Beim Lesen eines Kapitels der Hinweis „Zu diesem Kapitel gibt es einen Arbeitstext von Filo“.

`list_work_texts` bekommt `scope`: `mine`, `library` oder `all`. Forken auf Wunsch des Nutzers, als Parameter oder eigenes Tool, über `fork_note`.

Handoff mit Arbeitstext: siehe 8.1. `get_handoff` liefert Titel, Version und Inhalt der mitgegebenen Texte. `get_handoff` liefert außerdem die jüngsten Protokolleinträge zum Kapitel. Das Protokoll pro Kapitel ist das Gedächtnis zwischen Gesprächen.

`conversation_url`: seit 26.9. offen, ob die App mehrere Gespräche pro Text zeigt. Vorschlag, Entscheidung in Abschnitt 11:

```sql
CREATE TABLE note_conversations (
  note_id text NOT NULL REFERENCES app_notes(id),
  url text NOT NULL,
  client_kind varchar(32),
  created_at timestamptz NOT NULL DEFAULT now()
);
```

Gesprächsvorlagen (Kapitel durcharbeiten, Begriff klären, eigenen Text an Steiner prüfen, Text zum Post machen) kommen aus derselben Konfiguration wie die Absatzfunktionen in 8.1.

Akzeptanz: Ein Bibliothekstext erscheint beim passenden Kapitel, lässt sich forken, und die KI arbeitet über den Handoff an der Kopie weiter.

---

## 8. Bereich 4 — Überleitung von Filo zur KI

### 8.1 Absatzmenü

Langer Druck auf einen Absatz öffnet ein Sheet. Die Funktionen fragen direkt zu diesem Absatz. Startliste, Entscheidung in Abschnitt 11, Konfiguration änderbar: eigene Frage stellen, Absatz erklären, Begriff klären, mit einem Arbeitstext weiterarbeiten, Gedanken ins Kapitelprotokoll aufnehmen.

Das Sheet zeigt, was zu diesem Absatz schon da ist: eigene Arbeitstexte mit diesem Anker, Protokolleinträge (Stelle zuerst, dann Kapitel), Lesezeichen, Bibliothekstext zum Kapitel. Der Nutzer wählt, was mitgegeben wird.

`config/paragraph_functions.yaml`, ausgeliefert über `GET /app/paragraph-functions`:

```yaml
- key: frage
  label: Eigene Frage stellen
  needs_question: true
  prompt_template: "{zitierform}: {question}"
- key: erklaeren
  label: Absatz erklären
  needs_question: false
  prompt_template: "Erkläre mir diesen Absatz: {zitierform}"
```

Erweiterung von `handoffs` und `create_handoff()`:

```sql
ALTER TABLE handoffs
  ADD COLUMN IF NOT EXISTS function_key varchar(32),
  ADD COLUMN IF NOT EXISTS note_ids text[],
  ADD COLUMN IF NOT EXISTS protocol_entry_ids uuid[],
  ADD COLUMN IF NOT EXISTS target_kind varchar(16);
```

`app_notes.id` ist text, deshalb `note_ids text[]`. `target_kind` ist der `client_kind`, zu dem gesprungen wurde.

`get_handoff` liefert Absatz, Belegobjekt, gewählte Funktion, Frage, mitgegebene Arbeitstexte (Titel, Version, Inhalt), Protokolleinträge und die Anweisungen aus `handoff_instructions.md`. Abgelaufene Handoffs bleiben eine verständliche Meldung, möglichst mit `paragraph_id`.

### 8.2 Herkunft der Verbindung

Früh, in Phase 1. Jede Verbindung ohne diese Angaben bleibt später `unknown`.

Beim OAuth-Grant speichert der Server, von welcher KI die Verbindung kommt. Quelle sind die Metadaten der dynamischen Client-Registrierung (RFC 7591): `client_name`, `redirect_uris`, gegebenenfalls `client_uri`. Verlässlicher als der Name ist die Domain der Redirect-URI.

```sql
ALTER TABLE connector_grants
  ADD COLUMN IF NOT EXISTS client_kind varchar(32) NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS redirect_host text;
```

Zuordnung Domain zu `client_kind` in `config/ai_clients.yaml`, zum Beispiel `claude.ai` zu `claude` und `chatgpt.com` zu `chatgpt`. Die Werte nicht raten. Auf Staging die tatsächlichen Registrierungsdaten bei jeder neuen Verbindung loggen und die Tabelle danach füllen. Claude Desktop, Claude Code und Cursor mit durchspielen.

Prüfen, ob Supabase die Registrierungsdaten zur `client_id` speichert. Wenn ja, bestehende Grants einmalig nachträglich zuordnen.

Neuer Endpunkt `GET /app/ai-connections` (Bearer-JWT): aktive Verbindungen mit `client_kind`, `client_name`, Status und `last_mcp_request`. `GET /app/claude-status` bleibt für ältere Builds bestehen. `last_mcp_request` weiterhin gedrosselt, höchstens einmal pro Minute.

v2 Schritt 18 (Desktop-Anleitung, eigener Grant pro Client) ist kein Launch-Blocker. `client_kind` bereitet ihn vor.

### 8.3 Direkt zur richtigen KI

`GET /app/deep-link-config` liefert pro `client_kind` ein URL-Muster. Der Default bleibt HTTPS und `native_app`, ohne App-Release umschaltbar.

```json
{
  "clients": {
    "claude":  { "url_template": "https://claude.ai/new?q={prompt}", "auto_sends": false },
    "chatgpt": { "url_template": null, "auto_sends": null },
    "unknown": { "url_template": null }
  }
}
```

Claude ist getestet (iOS, Android, Browser ohne App). ChatGPT auf echten Geräten prüfen: übernimmt ein `?q=`-Muster den Prompt, und sendet es ihn sofort ab? Sendet ein Muster sofort ab, bleibt `url_template` leer und die App nutzt den Kopierweg.

Mehrere Verbindungen: Sprung zur zuletzt aktiven, die anderen zur Auswahl.

Ohne URL-Muster (Desktop-Clients, unbekannt): Meldung „Deine Verbindung läuft über {client_name}. Dorthin springt Filo noch nicht direkt.“ mit dem fertigen Prompt und einem Kopier-Knopf.

Universal Links aus v2 Schritt 14 gehören hierher: `apple-app-site-association`, `assetlinks.json`, Routen `/passage/{id}` und `/text/{id}`, Fallback-Seiten (Passage sichtbar, Text privat). Die App löst Redirects aus `books.db` auf. Fehlende oder fremde Texte bekommen eine verständliche Meldung.

### 8.4 Ohne Verbindung

Der Prompt enthält dann alles im Klartext: Absatztext, `zitierform`, Funktion und Frage, dazu mitgegebene Arbeitstexte gekürzt. Kopier-Knopf für jede KI, Hinweis auf die Verbindung. Das schließt an die Idee vom 27.9. an, aus Suchtreffern Prompts für beliebige KIs zu bauen.

Akzeptanz: Langer Druck, Funktion, Sprung zu Claude mit vorausgefülltem Prompt. Claude ruft `get_handoff` auf und kennt die vorhandenen Arbeitstexte und Protokolleinträge. Eine ChatGPT- oder unbekannte Verbindung führt zur Meldung mit Kopierweg. Ohne Verbindung entsteht ein vollständiger Klartext-Prompt.

---

## 9. Reihenfolge

1. **Branch-Abschluss.** `philo-claude-integration` auf den Stand bringen, den dieser Plan für den schon vorhandenen Code braucht. Der Abschluss führt nichts ein, was spätere Phasen neu bauen: Belegobjekt, Formpaket, Bibliothek, Aktivitätsprotokoll, Absatzfunktionen und `client_kind` bleiben dort. Geändert wird, was auf dem Branch schon liegt und diesem Plan widerspricht. Die Server-Instructions nennen Stellen der Korpus-Bände mit dem vollständigen deutschen Titel und ohne GA-Nummer. Die Collection `rudolf-steiner-ga` ist nicht Teil dieses Abschlusses. `list_volumes` bleibt im Abschluss die bestehende Gesamtliste und liefert `source_type` aus der Zeile. Die Begrenzung auf Bände und die Tools `get_lecture_info` und `list_lectures` kommen in Phase 1, zusammen. `buildDisplayTitle` hängt keine GA-Nummer mehr an den Anzeigetitel, das Feld `ga` bleibt. Aufräumen referenziert nicht die App-Migration 019. Diese Nummer bleibt `ragkeep/sql/019_lecture_catalog.sql`. Der Handoff-Sprung liest die URL aus `GET /app/deep-link-config`. Die feste Adresse `https://claude.ai/new` fällt hier weg. Der lange Druck bleibt bis Phase 2 eine einzelne Übergabe. Der Merge nach `main` folgt der Rückmeldung aus Phase 0, sobald Lesen, Suche und Bücher auf diesem Stand laufen.
2. **Phase 0.** Bestandsaufnahme auf `philo-claude-integration`, `docs/status-v2.md`, Rückmeldung an Michael. Einschließlich UUID-Prüfung für die Korpus-Promotion und der Frage, ob es eine Philo-Band-Zählung gibt.
3. **Phase 1.** Bereich 2, Unterabschnitt exakt: Belegobjekt, Titel-Fallback in den Tools, Vortrags-CSV, Titelregeln aus Abschnitt 6.1, `get_lecture_info`, `list_lectures`, danach `list_volumes` nur noch Bände, Hook für den Vortrags-Sync auf Dev. Dazu Bereich 4.2: Herkunft der Verbindung speichern. Parallel erlaubt, weil serverseitig: die noch offenen App-Schritte 4 bis 7, sobald Phase 0 sie als offen ausweist. Sie müssen fertig sein, bevor der Editor in Phase 2 umgebaut wird.
4. **Phase 2.** Bereich 1 (Werkstatt, Arbeitstexte, Formpaket) zusammen mit Bereich 4 ohne die schon erledigte Herkunft: Absatzmenü, Sprung, Kopierweg. Parallel Bereich 2, Unterabschnitt durchschaubar: Befehlsübersicht und Aktivitätsprotokoll. Domain und Universal Links (v2 14) in dieser Phase, Expo-Upgrade und Korpus-OTA sobald ihre Abhängigkeiten stehen.
5. **Phase 3.** Bereich 3: Filo-Bibliothek, Forken, Handoff mit Arbeitstext, mehrere Stellen pro Bibliothekstext.
6. **Phase 4.** Tests mit fünf bis zehn Nutzern (v2 16), Tool-Texte und Auszugslängen nachschärfen. Danach Aufräumen (v2 17), erst wenn alle Tester auf einem Build ohne Watermelon und ohne Invite sind.

Die Nummern 4.1 bis 4.4 in der Übergabe meinen die Unterpunkte von Bereich 4 (Absatzmenü, Herkunft, Sprung, Kopierweg). Die Filo-Bibliothek ist Bereich 3 und bleibt Phase 3. Sie rutscht nicht in Phase 2.

Zwei Ketten aus v2, soweit Phase 0 sie noch offen zeigt:

```
Invite ─┐
Schema ─┼─→ Nutzerdaten-Repos ─→ Watermelon weg ─→ Expo
books.db ─→ Buch-Cache ─────────┘
                Buch-Cache ─→ Korpus-OTA

OAuth-Vortest ─→ MCP lesen ─→ OAuth und Consent ─→ MCP schreiben
Schema ────────────────────────────────────────┘
OAuth + Links + Editor ─→ Setup, Handoff, Werkstatt ─→ Test ─→ Aufräumen
```

Früh parallel, falls noch offen: Invite, Schema und `books.db`-Pipeline. OAuth-Vortest neben dem App-Abbau. Links neben dem MCP.

---

## 10. v2-Schritte im neuen Plan


| v2       | Inhalt                                    | Lage jetzt                                                                            |
| -------- | ----------------------------------------- | ------------------------------------------------------------------------------------- |
| 1        | Invite-Gate entfernen                     | Phase 0 prüft; falls offen, vor dem Connector-Setup. DROP der Tabelle in Phase 4      |
| 2        | Migration 018                             | Phase 0 prüft Dev und Staging                                                         |
| 3        | `books.db`-Pipeline                       | Voraussetzung für Schritt 5                                                           |
| 4        | Chat-UI raus                              | Phase 2, Branch mit 5–7                                                               |
| 5        | Buch-Cache                                | Vor dem Editor                                                                        |
| 6        | Nutzerdaten-Repos und Editor              | Bereich 1, vor dem Formen- und Markdown-Editor                                        |
| 7        | WatermelonDB weg                          | Nach 5 und 6                                                                          |
| 8        | Expo-Upgrade                              | Nach 7                                                                                |
| 9        | Korpus-OTA                                | Nach 5, gebunden an die Promotion                                                     |
| 10–13    | OAuth und MCP lesen/schreiben             | Phase 0; Staging-Connector läuft, Lücken schließen bevor Phase 1 die Antworten umbaut |
| 14       | Domain, Universal Links, Deep-Link-Config | Phase 2, Abschnitt 8.3                                                                |
| 15a, 15c | Setup und Werkstatt                       | Abschnitt 5.1                                                                         |
| 15b      | Übergabe-Sheet                            | Abschnitt 8.1, nicht mehr ein eigenes Sheet neben dem Tab                             |
| 15d      | Vortragsdaten                             | Abschnitt 6.1, mit `get_lecture_info` und `list_lectures`                             |
| 16       | Tester                                    | Phase 4                                                                               |
| 17       | Aufräumen                                 | Phase 4, nächste freie App-Migration, nicht 019                                       |
| 18       | Desktop-MCP                               | Optional, vorbereitet durch `client_kind`                                             |


---

## 11. Entscheidungen, die Michael trifft

- Datenmodell des Formpakets: eigene Zeilen mit `parent_id`, oder Fassungen innerhalb eines Textes?
- Startliste der Formen.
- Korpus-Promotion: A, B, C oder D, nach der UUID-Prüfung. A scheidet aus, wenn `rag:chunk` neue Absatz-UUIDs vergibt.
- Bände mit Einzelvorträgen: doppelt sichtbar, oder nur in einer Form?
- Einträge, die keine Vorträge sind: bei `source_type = 'lecture'` belassen, oder ein eigener Typ?
- Aktivitätsprotokoll: alle Tool-Aufrufe oder nur schreibende? Wie lange aufbewahren?
- Mehrere Gespräche pro Arbeitstext über `note_conversations`?
- Startliste der Absatzfunktionen.
- GitHub-Anbindung im Philo-Tab: Form und Umfang.

---

## 12. Zu prüfen

Fakten, keine Entscheidungen. Phase 0 und die jeweils genannte Phase.

- Stand der v2-Schritte 1–18 auf `philo-claude-integration` nach dem Branch-Abschluss.
- Spalten von `connector_grants` und Stand von Migration 018 auf Dev und Staging.
- Stand von `ragkeep/sql/019_lecture_catalog.sql` auf Dev und Staging, inklusive Zählung Katalog gegen `rag_sources` mit `source_type = 'lecture'`.
- Ob `rag:chunk` bestehende Absatz-UUIDs erhält.
- Ob es eine Philo-Band-Zählung gibt.
- Welche Registrierungsdaten Claude, ChatGPT, Claude Desktop, Claude Code und Cursor bei der dynamischen Client-Registrierung senden, und ob Supabase sie speichert.
- Verhalten eines ChatGPT-URL-Prompts auf iOS und Android: Übernahme des Textes, automatisches Senden.
- Was `GET /app/claude-status` und `GET /app/deep-link-config` heute zurückgeben.
- Ob die App WatermelonDB noch nutzt und ob sie `books.db` schon liest.
- Ob Absatzmenü und Übergabe-Sheet schon existieren.
- Vorträge in `rag_chunks` ohne Katalogzeile.

---

## 13. Risiken


| Risiko                                                                   | Gegenmaßnahme                                                                                                                                                                  |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| OAuth 2.1 oder dynamische Client-Registrierung bei Supabase unzureichend | Früh prüfen; Fallback eigene Endpunkte `/mcp/authorize`, `/token`, `/register`. Das User-Token-Prinzip bleibt                                                                  |
| Grants ohne `client_kind`                                                | Spalten in Phase 1, bevor weitere Verbindungen entstehen. Bestehende Zeilen einmalig nachziehen, soweit die Registrierungsdaten noch da sind                                   |
| Neue Absatz-UUIDs bei erneutem Chunking                                  | Phase 0 vor der Promotion. Ohne stabile UUIDs keine Option A                                                                                                                   |
| GA-Nummern in Titeln der Korpus-Bände, die Claude zitiert                | Anzeigetitel und `zitierform` der Korpus-Bände ohne GA; Server-Instructions verbieten eigenes Zusammensetzen. Die Collection `rudolf-steiner-ga` zitiert weiter „GA 23, S. 32“ |
| Free-Kontingent der KI                                                   | `detail: "kurz"`, knappe Auszüge                                                                                                                                               |
| Große OTA-`books.db`                                                     | Hintergrund-Download, alte Datei bis zum atomaren Ersatz                                                                                                                       |
| App und KI schreiben parallel                                            | `save_note` mit Sperre und Konflikt in der UI                                                                                                                                  |
| Alte TestFlight-Builds nach dem Aufräumen                                | DROP erst nach Phase 4 und einem Build ohne Watermelon und ohne Invite                                                                                                         |
| Add ohne Connect                                                         | Setup-Text und Status `not_connected` erklären das                                                                                                                             |
| ChatGPT sendet den Prompt sofort                                         | `url_template` bleibt leer, die App nimmt den Kopierweg                                                                                                                        |


