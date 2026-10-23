# Front 3 — Zitate, Posts, Essays

**Stand:** 2026-10-21  
**Status:** Begriffe und Typologie haben Pipelines; Zitate/Posts/Essays brauchen eine neue Linie  
**Repos:** ragkeep (Texte), ragprep (Chunk / Augment), ragrun (Retrieval)

Gehört zu Front 3 neben [`typology-tree-chunks.md`](./typology-tree-chunks.md), [`augment-thoughts-extract-associate-graph.md`](./augment-thoughts-extract-associate-graph.md) und `ragprep/plans/in_progress/authentic-concept-retrieval.md`.

---

## Begriffe

`sources/concepts/concepts.yaml` ist gefüllt. Die `references` sind oft generisch („Hohe semantische Aehnlichkeit zum finalen Text“).

- Beschreibungen so schreiben, dass sie sagen, **warum** die Stelle den Begriff trägt.
- Referenzen neu ziehen (Retrieval + Bewertung), nicht die alten Cosine-Zeilen stehen lassen.

## Zitate

**SSOT (Soll, siehe [`mcp-architektur.md`](./mcp-architektur.md) §3b — noch zu schreiben aus Konsolidierungsplan):**

- **Steiner-Katalog:** `sources/quotes/*.yaml` (kurze, zitierbare Passagen), gebaut durch **`rag:augment:quotes:export-yaml`** aus colocated **`references`** (`typologies/`, `concepts/`, `curated-texts/*.references.yaml`), ergänzt Kursiv aus `rag_paragraphs`, optional einmalig legacy `books/…/quotes.md`.
- **Philo-Assistentenzitate** (`sources/quotes/*.quote.md`, `writings/co-created/quotes/`) **entfallen** — kein `assistant:chunk --type quotes` für Philo.
- Deprecated **`rag:augment:quotes`** (Buch → `quotes.md`) bleibt eigene Pipeline; nicht verwechseln mit `export-yaml`.

**MCP/App:** Belege für Steiner weiter über Körper/`paragraph_id` und `return_url`. Ob der YAML-Katalog als eigene Treffer-Art in `search_corpus` (`types=quote`) oder nur in der App rankt, ist offen — keine dritte `search_*`-Funktion (Front 2).

## Posts und Essays — wie chunken?

**SSOT für MCP/Einbettung (Soll):** [`ragkeep/assistants/philo-von-freisinn/sources/curated-texts/`](../../../ragrun/ragkeep/assistants/philo-von-freisinn/sources/curated-texts/) mit `chunk_type: curated_text` (siehe MCP-Plan §5a). Migration aus `writings/talks/` und `projects/…` (z. B. „Das Korn …“).

Ist noch verstreut: Talks unter `writings/talks/`, Blog-Posts unter `projects/Band 1 …/blog-posts/`.

Offen:

- Ein Chunk-Typ `talk` / `essay` / `post`, oder alles `book`-artig mit eigenem `source_type`?
- Absatz vs. Abschnitt vs. ganzer Text. Essays sind länger als ein Talk und kürzer als ein Buch.
- `source_id`: Assistenten-Pfad, nicht Buch-UUID. Suffices `:quotes` / `:summary` nur wenn wirklich Zitat- oder Summary-Chunks entstehen.

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
