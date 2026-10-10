# Gedankennetz — Implementierungsplan

Aufbau eines typisierten Assoziationsnetzes über extrahierte Gedanken.
Ausgangslage: `*_thoughts.json` pro Quelldokument, erzeugt von der bestehenden
Extraktions-Pipeline (`deepseek-chat`).

Zielfelder im JSON, die dieser Plan füllt: `explained_at`, `associated_at`.

---

## 0. Befunde aus dem Beispiel-JSON

Vor der Implementierung drei Beobachtungen aus
`kann_eine_entscheidung_unfrei_sein_...thoughts.json` (7 Gedanken):

**a) `references[].relevance` sind RRF-Scores, keine Ähnlichkeiten.**
Die Werte sind exakt `1/(60+rank)`: 0.016393 = Rang 1, 0.016129 = Rang 2,
0.015873 = Rang 3. Der Ausreißer 0.031514 ist die Summe zweier Ranglisten.
Konsequenz: **Auf diesen Feldern darf keine semantische Schwelle gesetzt werden.**
Sie sagen "Platz 1 in zwei Läufen", nicht "sehr ähnlich". Wenn ein Qualitätsmaß
für die Belegstellen gebraucht wird, muss der rohe Cosine-Score aus Qdrant
zusätzlich mitgeschrieben werden. → Task 0.1

**b) Null Überlappung der Belegstellen.**
34 Referenzen, 34 verschiedene `chunk_id`. Kein einziger Chunk wird von zwei
Gedanken geteilt — obwohl alle sieben Gedanken desselben Dokuments um Freiheit
und Motiv-Durchschauung kreisen. Das ist unplausibel und deutet auf eine
Dedup- oder Diversitätsregel im Retrieval hin. Bitte prüfen: Wenn Chunks über
Gedanken hinweg unterdrückt werden, geht ein sehr billiger Kandidatengenerator
verloren (geteilte Belegstelle = starkes Verbindungsindiz, ohne einen einzigen
LLM-Call). → Task 0.2

**c) Es gibt bereits ein Near-Duplicate-Paar im Dokument.**
Gedanke 1 und 2 sagen beide: Freiheit liegt nicht im Inhalt, sondern in der
Quelle. Wenn das schon innerhalb von sieben Gedanken passiert, ist Dedup über
den Gesamtkorpus nicht optional, und es muss **auch dokumentintern** laufen.

---

## Phase 1 — Datenmodell und Persistenz

Kanten gehören **nicht** in Qdrant, sondern nach Supabase/Postgres.
Qdrant bleibt reiner Vektorindex.

### 1.1 Qdrant Collection `thoughts`

Named Vectors pro Point — beide mit e5-Präfix `passage:`:

| Vektor  | Inhalt              | Zweck                                    |
|---------|---------------------|------------------------------------------|
| `quote` | `quote` verbatim    | Primärlauf. Trägt die Stimme der Quelle. |
| `text`  | `text` (Filo)       | Zweitmeinung. Stilnormiert, überbrückt Vokabulargräben zwischen Quellen. |

**Kein Kontext-Präfix** (Werktitel o. ä.) in den Embedding-Text. Die Gedanken
sind bereits selbsttragende Propositionen von 25–40 Wörtern. Ein gemeinsames
Titel-Präfix würde alle Gedanken eines Dokuments künstlich zusammenziehen — bei
7 Gedanken pro Dokument ein spürbarer Effekt.

**`explained_at` / Erklärungstext niemals embedden.** Wenn ein Langtext für die
UI erzeugt wird: Payload-Feld, nicht Vektor. Ein LLM-generierter Erklärungstext
über 3.000 Knoten hinweg homogenisiert den Raum und macht Similarity
bedeutungslos.

Payload: `thought_id`, `source_file`, `source_title`, `assistant`, `theme`,
`alignment`, `index`, `ref_chunk_ids[]`, `dedup_group`.

### 1.2 Postgres

```sql
create table thought_nodes (
  id            uuid primary key,
  source_file   text not null,
  source_title  text not null,
  idx           int,
  text          text not null,
  quote         text not null,
  theme         text not null,
  alignment     text not null,
  ref_chunk_ids uuid[] default '{}',
  dedup_group   uuid,              -- Repräsentant nach Dedup
  is_canonical  boolean default true,
  in_degree     int default 0,
  created_at    timestamptz default now()
);

create table thought_edges (
  src         uuid references thought_nodes(id),
  dst         uuid references thought_nodes(id),
  label       text not null,       -- siehe Phase 4
  directed    boolean not null,
  confidence  real not null,       -- 0..1 vom Richter
  rationale   text not null,       -- ein Satz, UI + Auditierung
  sim_quote   real,                -- roher Cosine, Primärlauf
  sim_text    real,
  rrf         real,
  intra_doc   boolean not null,
  hop_cached  boolean default false,
  primary key (src, dst, label)
);

create index on thought_edges (src, label);
create index on thought_edges (dst, label);

-- vorberechnete 2-Hop-Nachbarschaft, Query-Time = reines Ranking
create table thought_neighborhood (
  root      uuid primary key references thought_nodes(id),
  payload   jsonb not null,        -- [{id, hop, path:[{via,label}], score}]
  built_at  timestamptz default now()
);
```

---

## Phase 2 — Dedup

Vor allem anderen. Läuft über den Gesamtkorpus **und** dokumentintern.

1. kNN auf `quote`-Vektor, top 10, Cosine.
2. Cluster bei `cos > 0.95` (Schwelle an ~200 Paaren kalibrieren, nicht raten).
3. Repräsentant = längster `text`. Übrige: `is_canonical = false`,
   `dedup_group` auf den Repräsentanten, `ref_chunk_ids` in den Repräsentanten
   mergen.
4. Nur kanonische Knoten gehen in Phase 3.

Report ausgeben: Anzahl Cluster, größtes Cluster, Anteil dokumentinterner
Duplikate. Letzteres ist ein Qualitätssignal für die Extraktions-Stufe — wenn
hoch, ist der Extraktions-Prompt zu redundant.

---

## Phase 3 — Kandidatengenerierung

Pro kanonischem Knoten:

1. **Lauf A:** kNN `quote` → `quote`, top 30.
2. **Lauf B:** kNN `text` → `text`, top 30.
3. **Lauf C (falls 0.2 gelöst):** Jaccard-Overlap auf `ref_chunk_ids ≥ 0.2`.
   Kostenlos, kein LLM, oft die präzisesten Kandidaten.
4. **RRF** über A/B/C zusammenführen, k=60.
5. Selbstbezug und bereits deduplizierte Paare entfernen.
6. **Top 25** an den Richter.

Direkte Nachbarn im selben Dokument (`|idx_a - idx_b| == 1`) **nicht**
ausschließen. Bei diesem Beispiel bilden Gedanke 1→2→3→4 eine
Argumentationskette — genau die zuverlässigsten `setzt_voraus`-Kanten.
Aber `intra_doc` markieren, weil Phase 4 das braucht.

Rohe Cosine-Werte aus A und B mitschreiben (`sim_quote`, `sim_text`).
Deren **Differenz am selben Knoten** ist ein Driftmaß: läuft `text` weit von
`quote` weg, hat Filo beim Umformulieren dazuerfunden. Die 50 schlechtesten
manuell sichten.

---

## Phase 4 — Der Richter (LLM-Klassifikation)

**Modell:** `deepseek-chat`, Non-Thinking. Temperature 0.2. JSON-Modus.
Kein Reasoner — das ist ein Urteil, kein Beweis.

**Batch:** 10 Paare pro Call. Batch-Lauf über Nacht, niemals zur Laufzeit.

### Label-Set (geschlossen, 7 + Null)

Gerichtet (`directed = true`, Richtung A→B):

| Label            | Bedeutung |
|------------------|-----------|
| `setzt_voraus`   | A trägt nur, wenn B gilt. Stärkste Strukturkante, daraus werden Argumentketten. |
| `vertieft`       | A entfaltet B weiter, gleiche Ebene, mehr Detail. |
| `konkretisiert`  | A ist Fall/Anwendung/Beispiel zu Prinzip B. |

Symmetrisch (`directed = false`):

| Label          | Bedeutung |
|----------------|-----------|
| `widerspricht` | Klarer sachlicher Gegensatz. Die wertvollste Kante. |
| `spannung`     | Wirkt unvereinbar, ist aber kein sauberer Widerspruch. Braucht es als eigene Klasse, sonst presst der Richter Halbschiefes in `widerspricht` oder verwirft es. |
| `analog`       | Gleiche Struktur, anderer Bereich. Für diesen Korpus vermutlich die wertvollste Klasse — Geld-Alterung ↔ Key Rotation, EVG ↔ Maintainer-Modell. Kein Vektor findet das. |
| `konvergenz`   | Unabhängig dieselbe Einsicht. **Nur vergeben, wenn `intra_doc = false` und die Quellen verschieden sind.** Innerhalb eines Dokuments ist "bestätigt" nur Redundanz und gehört nach Phase 2. |

Plus `keine`. Der Richter **muss** ablehnen dürfen, sonst erfindet er
Verbindungen. Erwartungswert: 50–65 % `keine`.

### Prompt-Gerüst

```
Du beurteilst Paare philosophischer Gedanken auf ihre inhaltliche Beziehung.

Regeln:
- Beurteile ausschließlich das ZITAT, nicht die Umformulierung.
- Nur die vorgegebenen Labels. Im Zweifel: keine.
- "konvergenz" nur, wenn die Quellen verschieden sind.
- "vertieft" nicht vergeben, wenn A und B dasselbe sagen — dann "keine".
- Begründung: ein Satz, konkret, nennt den gemeinsamen Punkt.

Labels: setzt_voraus | vertieft | konkretisiert | widerspricht |
        spannung | analog | konvergenz | keine

Antworte ausschließlich als JSON-Array:
[{"pair_id":"...","label":"...","direction":"a_to_b|b_to_a|none",
  "confidence":0.0-1.0,"rationale":"..."}]
```

Dem Richter pro Paar mitgeben: `quote_a`, `quote_b`, `source_title_a`,
`source_title_b`, `theme_a`, `theme_b`. **Nicht** `text` — sonst urteilt er
über Filos Interpretation statt über die Quelle, und Extraktionsfehler
potenzieren sich eine Stufe weiter.

### Robustheit

- Retry mit halbierter Batchgröße bei JSON-Parse-Fehler.
- `pair_id` in der Antwort gegen die Anfrage validieren, keine
  Positionsannahmen.
- Unbekanntes Label → verwerfen, loggen.
- Idempotenz: geurteilte Paare in `judged_pairs` mitschreiben, damit der Lauf
  wiederaufsetzbar ist.

**Abnahmekriterium:** 100 Paare manuell nachlabeln, Agreement messen.
Unter ~0,7 ist das Label-Set oder der Prompt das Problem, nicht das Modell.

---

## Phase 5 — Kantenauswahl

Aus den geurteilten Paaren pro Knoten **maximal 5 ausgehende Kanten**:

1. `label != keine` und `confidence >= 0.6`.
2. **Reziprozitätsfilter:** Kante nur behalten, wenn B ebenfalls in den
   Kandidaten von A auftaucht (Phase 3, top 25). Killt Hub-Knoten, die aus
   reiner Allgemeinheit mit allem verbunden sind.
3. **Grad-Kappung:** `in_degree > 25` → Knoten als Hub markieren, weitere
   eingehende Kanten ablehnen.
4. **MMR** statt Top-5 (λ ≈ 0.7, Diversität auf `quote`-Vektor + `theme`).
   Sonst fünfmal fast dasselbe.
5. **Label-Quote:** mindestens eine Nicht-`vertieft`-Kante pro Knoten
   erzwingen, wenn eine mit `confidence >= 0.5` vorliegt. `vertieft` ist sonst
   die dominierende Klasse und frisst alle fünf Plätze.

---

## Phase 6 — Graphdiagnose

`networkx` (oder `igraph` für Leiden). Ein Report-Skript, kein Service.

- **Waisen** (In-Grad 0): meist Extraktionsfehler — zu vage, zu kontextlos.
  Erste Adresse zur Qualitätsprüfung der Extraktion. Liste ausgeben.
- **Hubs** (In-Grad Top 2 %): Allgemeinplätze. Im Betrieb gefährlich, weil jede
  Traversierung dort landet und dann überall hinführt.
- **Kreise:** `simple_cycles`, Länge 3–5. Nur solche behalten, die **nicht
  ausschließlich** aus `vertieft`/`konvergenz` bestehen — reine
  Vertiefungskreise sind Dedup-Kandidaten. Kreise mit einem `widerspricht` oder
  `spannung` darin sind das Gute: geschlossene Denkbewegungen, die zurückkommen.
  Als Einstiegspunkte in der UI anbieten.
- **Brücken:** Edge-Betweenness. Die Kanten zwischen sonst getrennten Clustern
  — dort berühren sich GA und Cypherpunk. Vermutlich das inhaltlich Wertvollste
  im ganzen Netz.
- **Communities:** Leiden, Auflösung 1.0. Pro Cluster von Filo eine kurze
  Charakterisierung schreiben lassen → Karte des eigenen Korpus, direkt für die
  Post-Manufaktur verwertbar.

Metriken in `graph_report.json` + Markdown-Zusammenfassung.

---

## Phase 7 — Laufzeit: Traversierung für den Denkmodus

Wenn der Nutzer "Denken" einschaltet: nicht mehr Kontext, sondern **gerichteter**
Kontext.

```
Query → (HyDE optional) → Qdrant → Einstiegsknoten (top 3)
      → Beam Search über thought_neighborhood
      → Pfad-Serialisierung → DeepSeek Reasoner
```

**Beam Search:**

- Dämpfung 0.6 pro Hop. Ein Knoten bei Hop 3 muss deutlich stärker sein als
  einer bei Hop 1.
- Pro Ebene nur die besten 3–4 weiterverfolgen. Keine Breitensuche —
  5 Kanten × 3 Hops = 125 Knoten, das ist Rauschen.
- **Kantentyp-Policy:**
  | Label | Hop 1 | Hop 2 | Hop 3 |
  |---|---|---|---|
  | `widerspricht`, `spannung` | 1.0 | 1.0 | 0.9 |
  | `setzt_voraus` | 1.0 | 0.9 | 0.8 |
  | `analog` | 1.0 | 0.9 | 0.7 |
  | `konkretisiert` | 1.0 | 0.7 | 0.4 |
  | `vertieft` | 1.0 | 0.5 | 0.2 |
  | `konvergenz` | 0.8 | 0.4 | 0.2 |

  `vertieft` verwässert transitiv — die dritte Vertiefung derselben Sache ist
  Wiederholung. `widerspricht` trägt auch tief.
- **Hartes Budget: 12–15 Knoten.** Reasoning-Modelle werden von zu viel
  mittelmäßig relevantem Kontext schlechter, nicht besser.

**Serialisierung als Pfad, nicht als Liste.** Das ist der eigentliche Hebel:

```
Ausgangspunkt: [Zitat A] (Quelle, Thema)
  └─ vertieft ──> [Zitat B]
       └─ steht im Widerspruch zu ──> [Zitat C]
       └─ ist analog zu ──────────> [Zitat D] (andere Quelle: ...)
  └─ setzt voraus ──> [Zitat E]
```

DeepSeek bekommt damit eine Struktur zum Nachdenken statt eines Haufens
Schnipsel. Die `rationale` der Kante mitgeben — sie sagt dem Modell, *warum*
die Verbindung besteht.

**Anzeigen:** `text` (Filo). **Übergeben an den Reasoner:** `quote`.

**Cache:** `thought_neighborhood` vorberechnen (2 Hops, JSONB). Query-Time ist
dann reines Ranking — Millisekunden statt Graphsuche. Invalidieren, wenn neue
Dokumente indiziert werden.

---

## Reihenfolge und Abnahme

| # | Schritt | Fertig, wenn |
|---|---|---|
| 0 | Befunde 0.1/0.2 klären | Cosine-Scores werden mitgeschrieben; Chunk-Overlap-Frage beantwortet |
| 1 | Schema + Ingest aller `*_thoughts.json` | Knotenzahl stimmt, Named Vectors in Qdrant |
| 2 | Dedup | Report; Duplikatanteil bekannt |
| 3 | Kandidaten | Mittlere Kandidatenzahl ≈ 25, Drift-Liste gesichtet |
| 4 | Richter | Agreement ≥ 0,7 auf 100 handgelabelten Paaren |
| 5 | Kantenauswahl | ≤ 5 ausgehende Kanten, Label-Verteilung plausibel |
| 6 | Diagnose | `graph_report.json`, Waisenanteil < 10 % |
| 7 | Traversierung | p95 Latenz < 300 ms ohne LLM-Call |

Nach Phase 5: `associated_at` im Quell-JSON setzen.

**Erst Phase 0–2 bauen und die Zahlen ansehen.** Duplikatanteil und
Kandidatenqualität entscheiden, ob Phase 4 überhaupt in der geplanten Form
nötig ist — bei sehr sauberen Kandidaten reicht möglicherweise ein kleineres
Label-Set.

---

## Kostenabschätzung

Bei ~7 Gedanken pro Dokument:

| Dokumente | Gedanken | Paare (×25) | Calls (÷10) |
|---|---|---|---|
| 100 | ~700 | ~17.500 | ~1.750 |
| 500 | ~3.500 | ~87.500 | ~8.750 |

Mit `deepseek-chat` bleibt das im niedrigen einstelligen Euro-Bereich. Laufzeit
mit 8 parallelen Workern: grob 1–3 Stunden für 500 Dokumente. Der Lauf muss
wiederaufsetzbar sein — siehe `judged_pairs`.
