# MCP Tools — Uebersicht

Stand: 2026-09-27 · MCP Server v0.3.0

---

## Server-Instruktionen (instructions)

Die folgenden Anweisungen werden Claude als `instructions`-Parameter des MCP-Servers uebergeben. Sie steuern das Verhalten ueber alle Tool-Aufrufe hinweg.

| Abschnitt | Inhalt |
|-----------|--------|
| **Korpus** | Primaer- und Sekundaerwerke. `search_corpus` fuer Suche, `get_passage` fuer Volltext. |
| **Stufenlieferung** | Kurz beginnen, nur auf Nachfrage vertiefen. Zitate max. 2–3 Saetze. |
| **Arbeitstexte** | Lesen mit `list_work_texts` / `get_work_text`. Schreiben NUR auf ausdrueckliche Bitte (`create_work_text`, `update_work_text`). Bei Update vorher immer aktuelle Version lesen. |
| **Protokolle** | Lesen mit `get_protocol`. Eintraege hinzufuegen mit `append_to_protocol` auf Bitte. |
| **Uebergaben** | Bei Handoff-ID: `get_handoff` lesen. Enthaelt markierten Text, Frage, Absatzverweis. |
| **Quellenverweise** | Immer vollstaendigen deutschen Titel verwenden. Bei Steiner-Werken GA-Nummer in Klammern (z.B. "Die Kernpunkte der sozialen Frage (GA 23)"). GA-Nummer = Index in der source_id. Nicht-Steiner: nur Titel. |
| **Stil** | Du-Anrede, klar, sachlich, praezise. Keine Ironie, kein Fachjargon, keine Fremdwoerter die Steiner nicht verwendete. |

---

## Tools

### 1. `whoami`

| | |
|---|---|
| **Beschreibung** | Returns the authenticated user's ID and email. |
| **Parameter** | — |
| **Auth** | Ja (MCP access token) |
| **Rueckgabe** | `{user_id, email, authenticated}` |

---

### 2. `search_corpus`

| | |
|---|---|
| **Beschreibung** | Search the philosophical corpus (books, talks, concepts, quotes). Returns ranked results with chunk_id, source metadata, and a short snippet. Use `get_passage` with the `paragraph_id` from results to read the full text. |
| **Parameter** | `query` (str) — Suchbegriff (DE oder EN) · `types` (list, optional) — Filter: `"text"`, `"concept"`, `"quote"`, `"chapter_summary"` · `limit` (int, default 10, max 20) |
| **Auth** | Nein (oeffentlicher Korpus) |
| **Rueckgabe** | Liste mit `{chunk_id, chunk_type, score, snippet, title?, segment_title?, author?, paragraph_id?, source_id?}` |

---

### 3. `get_passage`

| | |
|---|---|
| **Beschreibung** | Read a single paragraph by its UUID. Returns the paragraph text plus source/segment metadata for navigation. |
| **Parameter** | `paragraph_id` (str) — UUID des Absatzes (aus Suchergebnissen oder Protokollen) |
| **Auth** | Nein |
| **Rueckgabe** | `{paragraph_id, source_id, source_title, source_author, segment_index, segment_title, paragraph_number, text}` |

---

### 4. `list_volumes`

| | |
|---|---|
| **Beschreibung** | List all available books/volumes in the corpus. Returns source_id and display_name for each volume. |
| **Parameter** | — |
| **Auth** | Nein |
| **Rueckgabe** | Liste mit `{source_id, display_name}` |

---

### 5. `get_protocol`

| | |
|---|---|
| **Beschreibung** | Read the user's study protocol for a specific chapter. Protocols collect notes, questions, and insights per chapter. |
| **Parameter** | `source_id` (str) — Buch/Quellen-ID · `segment_slug` (str) — Kapitelkennung |
| **Auth** | Ja (user_id aus Token) |
| **Rueckgabe** | `{protocol_id, source_id, segment_slug, created_at, updated_at, entries: [{entry_id, paragraph_id, entry_type, content, created_at}]}` oder `{protocol: null, message}` |

---

### 6. `list_work_texts`

| | |
|---|---|
| **Beschreibung** | List the user's work texts (notes, drafts, essays). |
| **Parameter** | `text_type` (str, optional) — Filter: `"note"`, `"essay"` etc. · `limit` (int, default 20, max 50) |
| **Auth** | Ja |
| **Rueckgabe** | Liste mit `{note_id, title, text_type, status, version, paragraph_id?, created_by, updated_at}` |

---

### 7. `get_work_text`

| | |
|---|---|
| **Beschreibung** | Read a specific work text by its ID. Returns title, content, version, and metadata. |
| **Parameter** | `note_id` (str) |
| **Auth** | Ja |
| **Rueckgabe** | `{note_id, title, content, text_type, status, version, paragraph_id?, conversation_url?, created_by, created_at, updated_at}` |

---

### 8. `create_work_text`

| | |
|---|---|
| **Beschreibung** | Create a new work text (note, draft, essay). Only create work texts when the user explicitly asks for it. |
| **Parameter** | `title` (str) · `content` (str) · `text_type` (str, default `"note"`) · `paragraph_id` (str, optional) · `conversation_url` (str, optional) |
| **Auth** | Ja (user JWT via PostgREST RPC `create_note`) |
| **Rueckgabe** | `{ok, id, version}` oder `{error}` |

---

### 9. `update_work_text`

| | |
|---|---|
| **Beschreibung** | Update an existing work text with version control. Always read the note first (`get_work_text`) to get the current version. Returns `{ok, new_version}` or `{error: "conflict"}` if version changed. |
| **Parameter** | `note_id` (str) · `content` (str) · `expected_version` (int) · `title` (str, optional) · `status` (str, optional: `"draft"` / `"final"`) |
| **Auth** | Ja (user JWT via PostgREST RPC `save_note`) |
| **Rueckgabe** | `{ok, new_version}` oder `{error: "conflict", current_version, current_content, current_title}` |

---

### 10. `append_to_protocol`

| | |
|---|---|
| **Beschreibung** | Append a note/question/insight to the study protocol for a chapter. Creates the protocol automatically if it does not exist yet. |
| **Parameter** | `source_id` (str) · `segment_slug` (str) · `entry_type` (str: `"note"`, `"question"`, `"insight"`, `"summary"`) · `content` (str) · `paragraph_id` (str, optional) · `conversation_url` (str, optional) |
| **Auth** | Ja (direct SQL mit user_id) |
| **Rueckgabe** | `{ok, protocol_id, entry_id}` |

---

### 11. `get_handoff`

| | |
|---|---|
| **Beschreibung** | Retrieve a handoff from the app. A handoff transfers context (marked text, question, paragraph) from the app to Claude. If expired, returns what is still available. |
| **Parameter** | `handoff_id` (str) — 5-Zeichen-ID aus dem App-Deep-Link |
| **Auth** | Ja (direct SQL mit user_id) |
| **Rueckgabe** | `{handoff_id, paragraph_id, source_id, segment_slug, marked_text, user_question, return_url, created_at, expires_at}` oder bei Ablauf: `{expired: true, message, paragraph_id?, user_question?}` |

---

## Resource

### `philo://corpus/volumes`

Markdown-Liste aller Baende im Korpus mit `source_id` und `display_name`.

---

## Prompt

### `philo_voice`

Laedt die Philo-von-Freisinn-Persoenlichkeit und Stilanweisungen aus `assistants/philo-von-freisinn/prompts/instruction.md`.
