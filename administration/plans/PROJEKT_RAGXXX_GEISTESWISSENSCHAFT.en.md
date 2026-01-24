## Project Overview: `ragprep` + `ragkeep` + `ragrun` (RAGxxx)

### What it is (in one sentence)
RAGxxx is an integrated project that curates texts in the context of **Rudolf Steiner’s “spiritual science” (Anthroposophy)**—with a particular focus on the **12 “Weltanschauungen” (worldviews) / “Weltanschauungsstimmungen” (worldview moods)**—into a **searchable, citable corpus**, and on that basis enables an **app** as well as an **AI‑assisted learning and book format** (e.g. for *The Philosophy of Freedom* and Steiner’s *Threefold Social Order* / “Dreigliederung”).

### Conceptual focus
The project aims to make Steiner’s work accessible and to use AI methodically, with a strong emphasis on **precise source references** and **completeness**, leveraging current LLMs.

The **12 worldviews** are understood as a **working framework**: a system of perspectives/moods that helps interpret a broader range of user questions.

---

## Three building blocks — one system

RAGxxx consists of three clearly separated parts that together form a transparent, reproducible workflow:

### 1) `ragprep` — preparing sources (from PDF/scan to a structured textual base)
`ragprep` is the technical workshop. This is where books, PDFs, and scans are **read, OCR‑processed, structurally analyzed, and prepared for further processing**.

Why this matters: especially for historical editions, the quality of OCR and structure (pages, lines, chapters) determines whether later search and comparison results are reliable.

Typical tasks:
- OCR (e.g. Tesseract / PDF text layer) with AI‑assisted merging of multiple OCR sources
- structural normalization (pages/sections) so later citation and navigation are clean
- annotations (quote markers with author attribution, italics, footnotes)
- reproducible processing steps for a growing corpus (up to the complete works)

### 2) `ragkeep` — the curated archive (corpus, provenance, corrections)
`ragkeep` is where the **prepared texts are kept long‑term**—including metadata, provenance, and corrections.

The editorial/archive mindset is key here:
- clear source folders and manifests
- traceable corrections (errata)
- stable export formats (e.g. renderings/HTML, indexes)

In short: `ragkeep` is the **consolidated text archive** that the application builds on.

### 3) `ragrun` — the running application (ingestion = adding to the AI “matrix”, search, explain/study features)
`ragrun` is the app layer: a FastAPI application that **indexes** the corpus from `ragkeep` and makes it accessible through **retrieval‑based** interfaces.

Core features (current and planned):
- an in‑house AI vector database (Qdrant)
- ingestion of text “chunks” into hybrid search (vector + text index/BM25)
- inventory/metadata in a relational DB (sources, titles, IDs)
- an in‑house embedding engine (no extra costs)
- retrieval endpoints, including “Concept Explain”: a term is explained via relevant passages, including context windows

`ragrun` is thus the interface that makes the archive **queryable** and **practically usable** for study and research.

---

## Why this separation makes sense
Without separation, these often get mixed up:
- **editorial/OCR quality** (errors, variants, unclear source chains)
- **interpretation / answer generation** (which then rests on shaky textual ground)

RAGxxx therefore separates:
- text creation & quality (`ragprep`)
- archiving & provenance (`ragkeep`)
- interaction & research features (`ragrun`)

This keeps it clear *which* passage was used, *where* it came from, and *in what context* it stands.

---

## Planned goal: Steiner’s complete works as a corpus + 5 AI books

### Steiner’s complete works as the data basis + works referenced within them
Long‑term, the goal is to make Steiner’s work available as a **consistent, versioned corpus**—not as a loose collection of PDFs, but with:
- stable IDs/metadata
- reliable citation (work/place/context)
- transparent quality levels (OCR/revision)
- a large corpus of AI‑generated study material across the 12 worldviews (concept explanations, essays, summaries, quotes extracted by AI)

### AI book: *The Philosophy of Freedom and the three members of the Social Organism*
The app should be able to do more than “search”:
- **explanations**: passages (sentence, paragraph, chapter) can be explained by AI
- **comments**: passages can be annotated/commented
- **memory**: the app remembers read passages, comments, explanations; your personal learning path becomes visible
- **study materials**: extensive study material for terms, paragraphs, quotes, and chapters
- **communication**: comments by other users can be viewed (if shared) and incorporated
- **worldviews**: Mathematism, Individualism (Monadism)

### Proposed additional AI books
- Inner development and self‑initiation. Worldviews: Psychism and Phenomenalism
- The five Gospels. Worldviews: Pneumatism, Sensualism, Rationalism, Dynamism (Adler)
- Karma, grace, and freedom. Worldviews: Spiritualism and Materialism
- Rudolf Steiner’s spiritual science. Worldviews: Idealism and Realism (balance: Dynamism/Phenomenalism, Individualism/Sensualism, Mathematism/Pneumatism, Idealism)
