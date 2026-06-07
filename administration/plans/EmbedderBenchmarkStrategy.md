# Embedder Benchmark Strategy

**Status:** Plan
**Datum:** 2026-05-31
**Betroffene Systeme:** ragprep (CLI), ragrun (retrieval), personal-embeddings-service, Supabase, Qdrant

---

## Ziel

Vergleich von Embedding-Strategien (dense + sparse/hybrid) für einen konkreten Assistenten auf echten Daten, um die optimale Kombination aus Embedder und Retrieval-Gewichtung zu ermitteln — bevor die Produktions-Collection neu eingebettet wird.

---

## 1. Manifest-Erweiterung

### 1.1 Neues Feld `embedders` in `assistant-manifest.yaml`

```yaml
embedders:
  - key: e5
    model: intfloat/multilingual-e5-large
    prefix_query: "query: "
    prefix_passage: "passage: "
    test-collection: philo-von-freisinn-test-e5

  - key: bge
    model: BAAI/bge-m3
    pooling: cls
    test-collection: philo-von-freisinn-test-bge

  - key: qwen3
    model: Qwen/Qwen3-Embedding-8B
    instruction: "Instruct: Gegeben eine philosophische Frage zu Rudolf Steiner, finde die relevante Textpassage.\nQuery: "
    test-collection: philo-von-freisinn-test-qwen3

  - key: cross
    model: T-Systems-onsite/cross-en-de-roberta-sentence-transformer
    test-collection: philo-von-freisinn-test-cross

  - key: bm25
    model: bm25
    test-collection: philo-von-freisinn-test-bm25
```

> Jede Test-Collection enthält zusätzlich einen BM25-Sparse-Vektor (Qdrant named sparse vector `sparse`),
> außer `bm25` das nur Sparse enthält.

### 1.2 Testdaten-Quelle

Fest in `assistant-manifest.yaml` definiert (gilt für alle Embedder):

```yaml
benchmark:
  books:
    - Rudolf_Steiner#Die_Philosophie_der_Freiheit#4
    - Rudolf_Steiner#Die_Kernpunkte_der_sozialen_Frage#23
  chunk-types:
    - book        # ~472 Chunks  (301 + 171)
    - summaries   # ~36 Chunks
    - quotes      # ~753 Chunks  (612 + 141)
  query-file: benchmarks/embedder-queries.md

# Quelle aller Chunks: Supabase (PostgreSQL)
# Nicht die JSONL-Dateien — die sind nur Export-Artefakte
```

---

## 2. Test-Collection Struktur (Qdrant)

Jede Test-Collection hat **zwei benannte Vektoren**:

```
dense   → float vector (dim je nach Modell: 768/1024/4096)
sparse  → sparse vector (BM25-Gewichte, tokenisiert)
```

Ausnahme: `philo-von-freisinn-test-bm25` hat nur `sparse`.

### 2.1 Warum BM25 als sparse Vektor in Qdrant (nicht als separates System)?

- Qdrant unterstützt native benannte Sparse-Vektoren und Hybrid-Suche (RRF, DBSF)
- Kein extra Laufzeit-System nötig
- Alpha-Parameter kontrolliert dense/sparse-Gewichtung direkt in der Qdrant-Query
- Konsistente Datenbasis: ein Qdrant-Call liefert hybrid Ergebnis

### 2.2 Chunk-Payload

Jeder Chunk enthält bereits ein `metadata`-Feld mit allen relevanten Attributen (`chunk_id`, `chunk_type`, `source_title`, `segment_id` usw.) — diese werden unverändert aus Supabase übernommen.

Einziges zusätzliches Feld für die Test-Collections:

| Feld | Inhalt |
|------|--------|
| `embedder_key` | z.B. `e5` — identifiziert welcher Embedder diese Collection befüllt hat |

---

## 3. Kommando-Struktur

### Zwei Kommandos (getrennte Phasen)

```
rag:benchmark:embedder:index  <assistant>  [--embedder <key>]  [--force]
rag:benchmark:embedder         <assistant>  [--embedder <key>]  [--config <pfad>]
```

Beide in ragprep (TypeScript, Commander.js), analog zu `rag:embed`.

---

## 4. Phase 1: `rag:benchmark:embedder:index`

**Was es macht:**

1. Liest `assistant-manifest.yaml` → `benchmark.books`, `benchmark.chunk-types`, `embedders`
2. Für jeden Embedder (oder den angegebenen via `--embedder`):
   a. Prüft ob Test-Collection in Qdrant existiert
   b. Löscht bei `--force` / überspringt bei unverändertem Hash
   c. **Lädt Chunks aus Supabase** (Query nach `source_id` der definierten Bücher + `chunk_type`)
   d. Sendet an `personal-embeddings-service` → erhält dense Vektoren
   e. Berechnet BM25 Sparse-Vektoren lokal (rank_bm25 oder inline TS)
   f. Schreibt beide Vektoren + Payload in Qdrant

> **Datenquelle:** Supabase ist die Quelle der Wahrheit für alle Chunks.
> Die JSONL-Dateien im ragkeep-Repo sind Export-Artefakte und können vom aktuellen
> Stand abweichen (z.B. mehr Quote-Chunks als in den JSONL-Snapshots).

**BM25 Sparse Berechnung:**

BM25-Gewichte werden mit `rank_bm25` über den gesamten Corpus berechnet und als Qdrant Sparse-Vektoren gespeichert. Der Tokenizer ist derselbe wie im Benchmark-Skript (`_tokenize_de`).

Alternativer Ansatz (Empfehlung für `bge`-Collection): **bge-m3 learned-sparse** statt BM25 — semantisch reicher, kein Qualitätsverlust durch Stoppwörter. Konfigurierbar per Embedder-Eintrag:

```yaml
  - key: bge
    model: BAAI/bge-m3
    sparse: bge-m3-learned   # alternativ: bm25 (default)
    test-collection: philo-von-freisinn-test-bge
```

**Zeitbedarf (geschätzt, CPU, ~1261 Chunks):**

| Embedder | Dense ~1261 Chunks | Sparse | Gesamt |
|----------|-------------------|--------|--------|
| cross (768d) | ~5 min | 10 sek | ~5 min |
| e5 (1024d) | ~9 min | 10 sek | ~9 min |
| bge (1024d) | ~10 min | 15 sek | ~10 min |
| qwen3 (4096d) | ~90–150 min | 10 sek | ~2 h |
| bm25 (sparse only) | — | 10 sek | <1 min |

---

## 5. Query-Datei (`benchmarks/embedder-queries.md`)

Datei liegt unter `assistants/philo-von-freisinn/benchmarks/embedder-queries.md`.

### 5.1 Felder pro Query

| Feld | Pflicht | Bedeutung |
|------|---------|-----------|
| `query` | ja | Die Suchanfrage |
| `type` | ja | Kategorie (siehe unten) |
| `expected` | nein | Primärer `segment_id` für automatisches Scoring |
| `alt` | nein | Weitere akzeptable Treffer |
| `book` | nein | `PhilFreiheit` \| `Kernpunkte` \| leer (cross) |
| `note` | nein | Freitext-Hinweis für qualitative Auswertung |

### 5.2 Query-Typen und Scoring

| Typ | Beschreibung | Automatisches Scoring |
|-----|--------------|-----------------------|
| `keyword` | Einzelbegriff | Recall@10 (kein P@1) |
| `user` | Reale Nutzerfrage, oft lang | MRR@10, P@1, P@3 wenn `expected` vorhanden |
| `detail` | Spezifische Begriffsfrage | MRR@10, P@1, P@3 wenn `expected` vorhanden |
| `complex` | Mehrschichtige Zusammenhänge | MRR@10, P@1, P@3 wenn `expected` vorhanden |
| `cross` | Buchübergreifend | Überwiegend qualitativ |
| `quote` | Zitat-Retrieval (Quote-Chunks) | Qualitativ — testet Quote-Chunk-Ranking |
| `unscored` | Grenzfälle, Negativ-Tests | Nur qualitative Sichtung |

### 5.3 Aktueller Stand der Query-Datei

**37 Queries** in 7 Kategorien:

| Kategorie | Anzahl | Voll scorbar | Nur qualitativ |
|-----------|--------|-------------|----------------|
| keyword | 5 | Recall@10 | P@1 nicht sinnvoll |
| user | 8 | 4 | 4 |
| detail | 9 | 5 | 4 |
| complex | 5 | 3 | 2 |
| cross | 5 | 1 (teilweise) | 4 |
| quote | 2 | 0 | 2 |
| unscored | 3 | 0 | 3 (inkl. echter Negativ-Test) |
| **Gesamt** | **37** | **~13** | **~24** |

**Noch offen:** `expected`-Slugs für Kernpunkte-Kapitel müssen nach dem ersten Index-Lauf aus Qdrant nachgetragen werden.

### 5.4 Beispiel-Einträge

```markdown
### Q07
**query:** Ich lese gerade die Philosophie der Freiheit und verstehe nicht, wie Steiner
Freiheit begründet – er sagt, wir seien frei, wenn wir aus Intuition handeln, aber
ist das nicht einfach eine andere Art von Determination durch unsere Gedanken?
**type:** user
**book:** PhilFreiheit
**expected:** ix-die-idee-der-freiheit
**alt:** xii-die-moralische-fantasie-darwinismus-und-sittlichkeit

### Q33
**query:** Steiner schreibt irgendwo sinngemäß, dass der Mensch keiner fremden Norm
gehorchen soll – in welchem Zusammenhang?
**type:** quote
**book:** PhilFreiheit
**note:** Testet ob Quote-Chunks besser ranken als Book-Chunks

### Q37
**query:** Was denkt Steiner über künstliche Intelligenz?
**type:** unscored
**note:** Echter Negativ-Test — kein relevanter Treffer im Corpus zu erwarten
```

---

## 6. Phase 2: `rag:benchmark:embedder`

### 6.1 Was es macht

1. Liest die Query-Datei → parst alle Queries
2. Für jeden Embedder × jede Retrieval-Konfiguration:
   - Führt Qdrant-Query gegen die Test-Collection aus
   - Sammelt Top-K Ergebnisse
3. Berechnet Metriken (wenn `expected` vorhanden): MRR@10, P@1, P@3
4. Schreibt Ergebnis-Report als Markdown

### 6.2 Retrieval-Konfigurationen

| Config-Key | dense (α) | sparse (1−α) | Fusion |
|------------|-----------|--------------|--------|
| `dense_only` | 1.0 | 0.0 | — |
| `sparse_only` | 0.0 | 1.0 | — |
| `hybrid_75d` | 0.75 | 0.25 | RRF |
| `hybrid_50` | 0.50 | 0.50 | RRF |
| `hybrid_25d` | 0.25 | 0.75 | RRF |

Fusion-Methode: **Reciprocal Rank Fusion (RRF)** — bewährt, parameterarm.
Alternative: DBSF (Distribution-Based Score Fusion) für lineare Kombination.

### 6.3 Chunk-Typ Filter

Das Kommando unterstützt `--chunk-types`:

```bash
rag:benchmark:embedder philo  --chunk-types book summaries
rag:benchmark:embedder philo  --chunk-types quotes
rag:benchmark:embedder philo  # alle
```

So kann man sehen, ob Summaries oder raw Chunks besser ranken.

### 6.4 Output-Format

```markdown
# Embedder Benchmark: philo-von-freisinn
**Datum:** 2026-05-31
**Corpus:** Die Philosophie der Freiheit + Kernpunkte (~1261 Chunks aus Supabase)
**Queries:** 35 (10 direkt, 10 paraphrase, 15 abstrakt)

## Gesamt-Ergebnisse

| Embedder       | Config       | MRR@10 | P@1    | P@3    | ms/q |
|----------------|--------------|--------|--------|--------|------|
| e5             | dense_only   | 0.xxx  | xx.x%  | xx.x%  | xx   |
| e5             | hybrid_75d   | 0.xxx  | xx.x%  | xx.x%  | xx   |
| e5             | sparse_only  | 0.xxx  | xx.x%  | xx.x%  | xx   |
| bge            | dense_only   | ...    |        |        |      |
| bm25           | sparse_only  | ...    |        |        |      |
| ...            |              |        |        |        |      |

## Nach Schwierigkeitsstufe

| Embedder | Config | direkt P@1 | paraphrase P@1 | abstrakt P@1 |
|----------|--------|------------|----------------|--------------|
| ...      |        |            |                |              |

## Nach Chunk-Typ

| Embedder | Config | book P@1 | summaries P@1 | quotes P@1 |
|----------|--------|----------|---------------|------------|
| ...      |        |          |               |            |

## Fehlschläge (Top 5 pro Modell)

...
```

---

## 7. Ergänzungen und Empfehlungen

### 7.1 bge-m3 learned-sparse vs. BM25 für die `bge`-Collection

`BAAI/bge-m3` kann neben Dense auch Learned-Sparse ausgeben (via FlagEmbedding). Das ist semantisch reicher als BM25 (kein Stopwörter-Problem, keine Tokenizer-Heuristik). Empfehlung: In der `bge`-Test-Collection beide Sparse-Varianten vergleichen, d.h.:

```
philo-von-freisinn-test-bge-bm25      → dense: bge-m3 + sparse: BM25
philo-von-freisinn-test-bge-learned   → dense: bge-m3 + sparse: bge-m3-learned
```

Oder als Config-Variante innerhalb einer Collection mit zwei Named Sparse Vectors:
```
sparse-bm25     → BM25-Gewichte
sparse-learned  → bge-m3 learned-sparse Gewichte
```

### 7.2 Chunk-Typ-Gewichtung im Retrieval

Summaries, Quotes und Raw-Chunks haben unterschiedliche Eigenschaften:
- **book-chunks**: dicht, quelltreu, gut für Zitat-Suche
- **summaries**: komprimiert, gut für konzeptuelle Fragen
- **quotes**: kurz, prägnant, gut für direkte Aussagen

Empfehlung: Im Report auswerten, welche Chunk-Typen von welchem Embedder bevorzugt werden. Langfristig: Chunk-Typ-spezifische Boost-Faktoren in der Qdrant-Query.

### 7.3 Produktions-Collection vs. Test-Collection

Die Test-Collections sind **temporär** (Prefix `test-`). Nach dem Benchmark:
- Gewinnender Embedder wird in `assistant-manifest.yaml` als aktiver Embedder eingetragen
- Test-Collections können gelöscht oder als Archiv behalten werden
- Produktions-Collection (`philo-von-freisinn-v2`) wird bei Bedarf neu eingebettet

### 7.4 Query-Datei pflegen

Die `benchmarks/embedder-queries.md` soll langfristig gepflegt werden — nicht nur für diesen Benchmark, sondern als Regressions-Test nach jedem Modell-Upgrade. Neue Queries hinzufügen, wenn Retrieval-Probleme aus der Produktion beobachtet werden.

### 7.5 Qwen3-8B: Praktische Hinweise

- ~16 GB Modell → nur auf Hardware mit ausreichend RAM/VRAM sinnvoll
- Auf Apple Silicon M2/M3 Ultra (96+ GB) via MPS machbar
- Alternativ: `Qwen/Qwen3-Embedding-4B` (~8 GB) als pragmatischer Kompromiss
- Für den ersten Benchmark ohne Qwen3 starten, später ergänzen

---

## 8. Implementierungsreihenfolge

```
[ ] 1. assistant-manifest.yaml erweitern (embedders + benchmark Block)
[ ] 2. benchmarks/embedder-queries.md erstellen (35 Queries aus quality_benchmark.py)
[ ] 3. rag:benchmark:embedder:index implementieren (ragprep TS)
       - Supabase-Query (book/summaries/quotes nach source_id + chunk_type)
       - BM25 Sparse-Berechnung (inline TS oder Python-Hilfsskript)
       - Qdrant Collection Setup (dense + sparse named vectors)
       - Embedding via personal-embeddings-service
[ ] 4. rag:benchmark:embedder implementieren (ragprep TS)
       - Query-Datei Parser (Markdown)
       - Qdrant Hybrid Query (RRF, alle Config-Varianten)
       - Metriken-Berechnung (MRR@10, P@1, P@3)
       - Report-Generator (Markdown)
[ ] 5. Ersten Benchmark-Lauf durchführen (ohne Qwen3)
[ ] 6. Ergebnis auswerten → Embedder für Produktion wählen
[ ] 7. embedder-Feld in manifest für Produktion setzen
```

---

## 9. Abgrenzung zu quality_benchmark.py

| | `quality_benchmark.py` | `rag:benchmark:embedder` |
|--|------------------------|--------------------------|
| System | Offline, Python, direkt ST | Qdrant + ragprep CLI |
| Daten | 18 chapter summaries (JSONL) | ~1261 Chunks aus Supabase (3 Typen, 2 Bücher) |
| Sparse | FlagEmbedding/BM25 | Qdrant named sparse vectors |
| Hybrid | Nicht implementiert | Qdrant RRF nativ |
| Ziel | Schneller Modell-Vergleich | Produktionsnaher End-to-End-Test |

`quality_benchmark.py` bleibt als **schnelles Explorations-Tool** erhalten.
`rag:benchmark:embedder` ist der **produktionsnahe Entscheidungstest**.
