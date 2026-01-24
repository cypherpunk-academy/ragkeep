---
language:
- de
tags:
- books
- rag
- text-retrieval
license: MIT
pretty_name: ragkeep-weimarer-klassik-books-de
configs:
- default
---

# ragkeep-weimarer-klassik-books-de

Released subset of Weimarer Klassik books curated in `ragkeep` and prepared by `ragprep`.

## Contents (HF subset)
- Released Markdown: `books/**/results/_released.md`
- HTML rendering: `books/**/results/html/<bookname>.html`
- TOC JSON: `books/**/results/toc.json`
- Provenance & corrections: `book-manifest.yaml`, `errata.txt`

`<bookname>` = canonical folder basename `Author#Title#Index`.

## Loading
```python
from datasets import load_dataset

md = load_dataset("michaelschmidt/ragkeep-weimarer-klassik-books-de",
                  data_files={"train": "books/**/results/_released.md"}, split="train")
idx = load_dataset("michaelschmidt/ragkeep-weimarer-klassik-books-de",
                  data_files={"index": "books/index.json"}, split="index")
```

## License
MIT

## Notes
- Full working tree (inputs, intermediates) lives in `ragkeep`; only the HF subset is mirrored here.

## GitHub Pages (publish the HTML books to `github.io`)

This repo can publish a static site under `site/` that lists all books which have an HTML rendering at:
- `books/<bookDir>/html/index.html` (preferred), or
- `books/<bookDir>/results/html/index.html` (legacy)

### Build locally

```bash
npm run build:pages
```

This (re)creates `site/` and writes an `index.html` that links to each book.

### Publish on GitHub Pages

This repo includes a workflow at `.github/workflows/pages.yml` that deploys the `site/` folder to GitHub Pages on every push to `main`/`master`.

To enable it once in GitHub:
- Go to **Settings → Pages**
- Set **Source** to **GitHub Actions**

Your site will be available at `https://<owner>.github.io/<repo>/` and the books index at `https://<owner>.github.io/<repo>/index.html`.
