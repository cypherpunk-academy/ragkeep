# Quotes — Nachmittag 2026-10-26

**Ziel:** Steiner-Zitat-Katalog als **Markierung am Körper**, nicht als eigener Chunk-Typ.  
**Pläne:** [`mcp-architektur.md`](./mcp-architektur.md) §3b / Schritt 8b, [`posts-essays-quotes.md`](./posts-essays-quotes.md).  
**Repos:** ragkeep (YAML-SSOT), ragprep (Harvest / Vet / Mark), ragrun (Hit-Anreicherung).  

---

## Modell

```text
A Legacy quote-Chunks ──► quotes:vet ──┐
C Kursiv (italics)    ──► harvest ──► vet ──┼──► quotes.yaml ──► quotes:mark
D Refs (begriff/typo/curated) harvest ──► vet ──┤         │
B <q> foreign_quotes  ──► harvest (kein Vet) ──┘         ▼
                                              metadata.quote_marks[] + quotes(none|author|quoted) am Körper
```

| Entscheidung | Inhalt |
|--------------|--------|
| Kein Minen | `rag:augment:quotes` → `quotes.md` **entfällt** |
| Kein Quote-Chunk für Katalog | Markierung am Körper; E10 obsolet |
| YAML | `sources/quotes/quotes.yaml` — `id`, `text`, `author`, `source_id`, `segment_slug`, `paragraph_number` |
| Laufzeit-Wortlaut | aus DB/`text_raw` über Span |
| CLI | `quotes:harvest` (Quellen) · `quotes:vet` (LLM) · `quotes:mark` (DB) |

---

## Nachschub A–D

| ID | Quelle | LLM-Vet? | Befehl |
|----|--------|----------|--------|
| **A** | Legacy `chunk_type=quote` (6191 Dev) | ja | `quotes:vet` → `--export-yaml` |
| **B** | `annotations.foreign_quotes` (`<q>`) | **ja** (Kontextabhängigkeit) | `quotes:harvest --source q` → Kandidaten → `quotes:vet` (Purge früherer Direct-Imports) |
| **C** | `annotations.italics` (Aufmerksamkeits-Marker) | ja (Expand + Vet) | `quotes:harvest --source italics` (DeepSeek expandiert zu Sätzen) → `quotes:vet` |
| **D** | Refs an `begriff` / `typology` / `curated_text` | ja | `quotes:harvest --source refs` → Kandidaten → `quotes:vet` |

**Kursiv vs. `<q>`:** Italic-Spans, die mit einem `foreign_quotes`-Span überlappen oder darin liegen, werden beim Italics-Harvest **übersprungen** (kein Doppel aus Kursiv in Zitat-Markup).

**Autor:** Pflicht. Bei `<q>` aus `quoted_author` (ohne Autor → skip). Bei Legacy/Refs/Kursiv aus Chunk-/Buch-Meta.

### Reihenfolge vor Mark

1. Legacy: `quotes:vet … --resume --export-yaml`
2. `quotes:harvest --source q` (merge YAML)
3. `quotes:harvest --source italics` → `quotes:vet --candidates … --export-yaml` (merge)
4. `quotes:harvest --source refs` → `quotes:vet --candidates … --export-yaml` (merge)
5. `quotes:mark`

---

## Spec `quotes.yaml`

```yaml
quotes:
  - id: kommunion-idee
    text: "…"
    author: Rudolf Steiner
    source_id: <bare uuid>
    segment_slug: …
    paragraph_number: …
```

Nur diese sechs Felder. Sync: YAML-`text` in `text_raw` finden → Span; sonst Fehler.

---

## Inventur (Legacy)

| Metrik | Wert |
|--------|------|
| DB `quote` / `quote_explanation` | 6191 / 6191 |
| Vet JSONL | 6191 (keep ~2409, shorten ~888, reject ~2894) |
| Philo `*.quote.md` | 6 + 4 co-created (entfallen) |

---

## Checkliste

- [x] YAML-Schema (+ `author`)
- [x] Inventur + Legacy-Vet (6191)
- [x] `quotes:mark` + Search-`quotes[]`
- [x] Plan A–D / CLI-Split dokumentiert
- [ ] Legacy `--export-yaml` → YAML
- [ ] Harvest `q` → merge YAML
- [ ] Harvest `italics` → vet → merge
- [ ] Harvest `refs` → vet → merge
- [ ] `quotes:mark`
- [ ] Legacy-Chunks / Mine aufräumen (später)

## Nicht im Scope jetzt

Essays, Staging→Prod, GA als Quote-Quelle, Mine wiederbeleben.
