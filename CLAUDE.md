# ragkeep

RAG knowledge base for philosophical assistants. Books are processed by **ragprep**, metadata synced to Supabase, embeddings to Qdrant.

## Architecture

```
ragkeep/
├── assistants/{name}/          # Each assistant is a git submodule (own repo)
│   ├── assistant-manifest.yaml # Central config: books, embedders, paths
│   ├── sources/                # Curated content from source works (PRs welcome)
│   ├── writings/               # Original philosophical texts (PRs welcome)
│   ├── projects/               # Creative works in progress (PRs welcome)
│   ├── prompts/                # AI system prompts (infrastructure)
│   ├── assets/                 # Visual identity
│   └── .generated/             # Pipeline output (.gitignore'd)
├── books/{Author#Title#Index}/ # Book processing directories
│   ├── book-manifest.yaml
│   └── results/rag-chunks/{quotes,summaries,primary}-chunks.jsonl
├── lectures/                   # Lecture YAML index + chunks
└── scripts/                    # Operational scripts (ragprep wrappers)
```

## Assistant Manifest (`assistant-manifest.yaml`)

The manifest drives the entire pipeline. Key fields:

```yaml
paths:                          # Where content lives (ragprep reads these)
  talks: writings/talks
  quotes: sources/quotes
  concepts: sources/concepts
  typologies: sources/typologies
  generated: .generated
primary-books: [...]            # Book IDs for main RAG corpus
secondary-books: [...]          # Additional context books
augmentation-types: [summaries, quotes]  # What to generate per book
concepts: [concepts.jsonl]      # Triggers concept augmentation
typologies: [typologies.jsonl]  # Triggers typology augmentation
```

## Ragprep Commands

All chunking/augmentation goes through ragprep:

```bash
yarn rp rag:chunk <book_dir> --assistant <name>    # Chunk a book
yarn rp rag:augment:summaries <book_dir>           # Generate summaries
yarn rp rag:augment:quotes <book_dir>              # Extract quotes
yarn rp rag:augment:concepts <assistant>            # Explain concepts
yarn rp rag:augment:typologies:explain <assistant>  # Explain typologies
yarn rp assistant:chunk <assistant> --type talks    # Chunk assistant talks
yarn rp assistant:chunk <assistant> --type quotes   # Chunk assistant quotes
yarn rp text:annotate <book_dir>                    # Annotate page refs
```

## ID Conventions

- **Chunk IDs**: UUIDv5, deterministic from `sourceId:contentHash`
  - Quote namespace: `f1e2d3c4-b5a6-4789-90ab-cdef01234567`
  - Summary namespace: `e8f3c4b2-7a91-4d5e-b0c3-2f6e8a9b1c4d`
- **Source IDs**: `{bookId}` for book chunks, `{sourceId}:quotes` suffix for quote chunks (avoids collision)
- **Book IDs**: `Author#Title#Index` (e.g., `Rudolf_Steiner#Die_Philosophie_der_Freiheit#4`)
- **Lecture IDs**: `YYYYMMDD` format, suffix `a/b/c` for multiple lectures on same day
- **Content hashing**: SHA1 of text content; same content = same ID across regenerations

## File Conventions

- **JSONL everywhere**: One JSON object per line, no trailing newlines. Skip empty lines and `#`-comments when parsing.
- **Chunk output**: `books/{id}/results/rag-chunks/{type}-chunks.jsonl` or `.generated/chunk-cache/{type}.jsonl`
- **Talk filenames**: Lowercase kebab-case, no prefixes. Grouped by topic: `3gl/`, `phdf/`, `foss/`
- **Quote files**: `*.quote.md` extension

## Supabase Sync

- `sync_sources.ts` runs as pre-push hook: UPSERTs book metadata to `rag_sources` table
- `upload_covers.ts` runs as pre-push hook: SVG→JPEG conversion via sharp, uploads to Supabase Storage
- Primary books: `is_primary=true`, sort_order from manifest position
- Secondary books: `is_primary=false`, sort_order 100+position

## Scripts (remaining operational)

| Script | Purpose |
|--------|---------|
| `chunk-philo-all.sh` | Full pipeline for an assistant (reads manifest) |
| `export-steiner-books.sh` | Chunk Rudolf Steiner books only |
| `annotate-philo-page-refs.sh` | Re-annotate page references |
| `rechunk-philo-lectures.sh` | Re-chunk lectures |
| `augment-philo-lecture-summaries.sh` | Lecture summaries |
| `reannotate-steiner-books.sh` | Re-annotate Steiner books |
| `build_agent_registry.ts` | Build `site/data/assistants.json` |
| `sync_sources.ts` | Sync metadata to Supabase |
| `upload_covers.ts` | Upload covers to Supabase |
| `publish_to_hf.sh` | Push to HuggingFace |

## Gotchas

- YAML parsing: Prefer text-line parsing over structured parsing when titles contain escaping issues (`\'`)
- GA normalization: `266/1` → `266a` (slash becomes letter)
- Quote stability: If quote text changes, hash changes, ID changes → potential duplicate if old chunk not deleted
- Whitespace: Normalize with `" ".join(s.split()).strip()` before comparison
- Migration scripts are deleted; all used UUIDv5 for idempotent re-runs
- `__dirname` for path resolution, never `process.cwd()`
