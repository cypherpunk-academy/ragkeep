# Front 3 — Zitate, Posts, Essays

**Stand:** 2026-10-26  
**Status:** `curated_text`-Pipeline auf Dev live; **nächster Fokus: Steiner-Zitat-Katalog (YAML + Markierung am Körper)** — siehe [`quotes-afternoon-2026-10-26.md`](./quotes-afternoon-2026-10-26.md). Essays später.  
**Repos:** ragkeep (Texte), ragprep (Chunk / Augment / Mark-Sync), ragrun (Retrieval)

Gehört zu Front 3 neben [`typology-tree-chunks.md`](./typology-tree-chunks.md), [`augment-thoughts-extract-associate-graph.md`](./augment-thoughts-extract-associate-graph.md) und `ragprep/plans/in_progress/authentic-concept-retrieval.md`.

---

## Begriffe

`sources/concepts/concepts.yaml` ist gefüllt. Die `references` sind oft generisch („Hohe semantische Aehnlichkeit zum finalen Text“).

- Beschreibungen so schreiben, dass sie sagen, **warum** die Stelle den Begriff trägt.
- Referenzen neu ziehen (Retrieval + Bewertung), nicht die alten Cosine-Zeilen stehen lassen.

## Zitate

**SSOT (Soll, siehe [`mcp-architektur.md`](./mcp-architektur.md) §3b und [`quotes-afternoon-2026-10-26.md`](./quotes-afternoon-2026-10-26.md)):**

- **Steiner-Katalog:** eine Datei `sources/quotes/quotes.yaml` — `text`, **`author`**, Anker. **Laufzeit-Wortlaut aus DB**, nicht aus YAML.
- **Markierung:** `rag:augment:quotes:mark` setzt `metadata.quote_marks[]` und Keyword `quotes` (none|author|quoted) an `book` / `secondary_book`. Kein eigener `chunk_type=quote`; Treffer = Körper inkl. Markierungsarray. E10 für Katalog-Hits entfällt.
- **Nachschub:** A Legacy `quotes:vet`; B `<q>` `harvest --source q` (kein Vet); C Kursiv `harvest --source italics` (Skip Overlap mit `q`) → Vet; D Refs `harvest --source refs` → Vet; Abschluss `quotes:mark`.
- **Entfällt:** Buch-Mine `rag:augment:quotes` → `quotes.md`; `quote_explanation` für den Katalog; Philo-Assistentenzitate (`sources/quotes/*.quote.md`, `writings/co-created/quotes/`).

**MCP/App:** Suche findet den Körper; am Hit sichtbar, ob/welche Katalog-Zitate im Chunk liegen. Filter „nur mit Zitat“ über Metadaten — keine dritte `search_*`-Funktion.

## Posts und Essays — `curated_text`

**SSOT:** [`sources/curated-texts/`](../../assistants/philo-von-freisinn/sources/curated-texts/) (siehe MCP-Plan §5a).

| Ebene | Bedeutung |
|-------|-----------|
| Verzeichnis | Sammlung; `source_id` = UUIDv4 in `.uuid` |
| `#` | Vortrag/Artikel (`segment_title`) |
| `##` | Abschnitt (harte Chunk-Grenze, buchähnliches Splitting innerhalb) |

Pipeline: `assistant:chunk --type curated_text` → `rag:augment:references --type curated_text` → `rag:embed`. **Keine Sidecars.** MCP: Curated nie in `hits`/`wegweiser`; Match expandiert Korpus-Belege (+ GA-Angaben `zitierbar: false`, Volltext via `get_ga_chunk`). **Dev: erledigt** (Re-embed / Null-Refs manuell nachziehen bei Bedarf).

Talks unter `writings/talks/` und Blog-Posts unter `projects/…` bleiben Migrationskandidaten in diesen Baum.

### Essays zuerst

Aus den fünf Siegeln (`projects/Band 3 …/fuenf-siegel-fuenf-projekte.yaml`) und dem laufenden Band 3:

| Arbeitstitel | Ort | Bemerkung |
|--------------|-----|-----------|
| **Geld (Korn)** | `3-das-korn-eine-digitale-währung/` | Längstes Manuskript, Kapitel + Paralipomena |
| **Initiative Demokratie** | Siegel 2, „Projektbuffet“ / „Demokratie nächste Stufe“ | Noch kein geschlossenes Essay |
| **Neue Schule** | Siegel 1, „Die Dreigliederungsschule“ | Noch kein geschlossenes Essay |

Alte Essay-MCP-Pläne (`ragprep/plans/future/essay-editor-mcp-yaml-artifacts.md`, `essay-mcp-server-refactor.md`) beschreiben den früheren `.essay`-Stack. Ob der zurückkommt oder Essays wie Talks als Markdown gechunkt werden, ist die Entscheidung dieser Front.

---

## Dokumente

| Dokument | Rolle |
|----------|--------|
| `ragprep/plans/future/essay-editor-mcp-yaml-artifacts.md` | Altes `.essay`-Format + MCP |
| `ragprep/plans/future/essay-mcp-server-refactor.md` | `essay:mcp` stateless |
| ragkeep `plans/legacy/ADDING_ESSAYS_THE_STACK.md` | Wiederaufbau (im Git, nicht im Arbeitsbaum) |
| [`augment-thoughts-extract-associate-graph.md`](./augment-thoughts-extract-associate-graph.md) | Gedanken aus Posts/Talks — anderer Chunk-Typ |
