# Philo × Claude — Konsistenzprüfung Vortrags-Daten

Erstellt 29.09.2026. Gehört zu Schritt 15d im Integrationsplan v2.

---

## Ausgangslage

Claude sieht über `list_volumes` 333 Quellen: 57 Bände und 276 Einzelvorträge.
Die Daten fließen so:

```
steineroriginals/rudolf-steiner-ga-lecture-catalog.yaml  (5303 Einträge, SSOT)
        ↓  sync_lectures.ts --all
rag_lecture_catalog  (5303 Zeilen, alle Katalog-Felder)
        ↓  JOIN auf has_chunks
rag_sources  (276 Zeilen mit source_type='lecture', nur title/author/year/ga)
        ↓  list_sources()
list_volumes  →  Claude sieht "{author}: {title}"
```

### Befund (Zahlen aus DB-Abfrage 29.09.2026)

| Problem | Anzahl | Beispiele |
|---------|--------|-----------|
| **Titel leer** | 40 | GA 337b (11×), GA 280/295 (10×), GA 331 (7×), GA 339 (3×), GA 330 (3×), GA 73a (2×), GA 82/324a (1×) |
| **Generischer Titel** | 58 | „Vortrag 1" (7×), „Vortrag 4" (6×), „Vortrag 3" (6×), „Pädagogisches Seminar, Besprechung" (4×) |
| **Doppelter Titel** | ~20 Gruppen | „Proletarische Forderungen…" (2×), „Oberschlesien" mit/ohne Punkt (2×) |
| **Kein `source_type`-Unterschied** | alle | `list_volumes` gibt alles als `"source_type": "book"` aus (hardcoded) |
| **Kein Zyklus** bei titellosen | 40/40 | `reihe` und `zyklus` sind NULL — nur GA, Ort, Datum vorhanden |

---

## Strategie: Display-Name in `rag_sources` anreichern

Die Anreicherung passiert an **einer Stelle**: `sync_lectures.ts`, dort wo `rag_sources` geschrieben wird. Der Titel in der Katalog-YAML bleibt unverändert (SSOT).

### Regel für `display_title` (Prioritätsreihenfolge)

```
1. vortragstitel nicht leer und nicht generisch?
   → vortragstitel verwenden
   → Falls Titel mehrfach vorkommt: " (Ort, DD.MM.YYYY)" anhängen

2. vortragstitel generisch ("Vortrag N", "Erster Vortrag", …)?
   → Zyklus-Titel vorhanden? → "Zyklustitel — Vortrag N"
   → Sonst GA-Titel vorhanden? → "GA NNN — Vortrag N"
   → Sonst: "Vortrag N (Ort, DD.MM.YYYY)"

3. vortragstitel leer?
   → Zyklus-Titel vorhanden? → "Zyklustitel — Ort, DD.MM.YYYY"
   → Sonst: "GA NNN — Ort, DD.MM.YYYY"
```

### Woher kommen die Titel-Quellen?

| Quelle | Tabelle | Verfügbarkeit |
|--------|---------|---------------|
| `vortragstitel` | `rag_lecture_catalog` | Immer (kann leer sein) |
| `ort`, `datum` | `rag_lecture_catalog` | Immer vorhanden |
| `ga` | `rag_lecture_catalog` | Bei 272/276 vorhanden |
| `zyklus` → `titel` | `rag_lecture_cycles` | Nur bei Zyklusvorträgen (~0/40 titellose) |
| Band-Titel aus `rag_sources` | `rag_sources` (book) | Nur für 57 Bände, GA-Overlap gering |

**Problem:** Die 40 titellosen Vorträge haben weder `zyklus` noch einen zugehörigen Band in `rag_sources`. GA-Nummer + Ort + Datum ist die einzige Disambiguierung.

---

## Umsetzungsschritte

### Schritt 1 — GA-Bandtitel-Lookup automatisch laden

Quelle: `ragprep/config/ga_list_numbered.txt` (380 Zeilen, Format: `GA{nr}: Rudolf_Steiner#{Titel_mit_Underscores}#{nr}`)

```typescript
// Beim Start aus Datei oder eingebettet parsen:
// "GA337b: Rudolf_Steiner#Soziale_Ideen._Soziale_Wirklichkeit.…#337b"
// → { '337b': 'Soziale Ideen. Soziale Wirklichkeit. …' }
```

Alternativ: Die Map einmalig generieren und als `ga_titles.json` nach `ragkeep/lectures/` schreiben — analog zu den Zyklen-YAMLs.

**Pfad:** `/Users/michael/Reniets/Ai/ragprep/config/ga_list_numbered.txt`

### Schritt 2 — `sync_lectures.ts` erweitern

Neue Funktion `buildDisplayTitle()` die nach obiger Prioritätsregel den Titel baut:

```typescript
function buildDisplayTitle(
  entry: CatalogEntry,
  cycleTitle: string | null,
  duplicateTitles: Set<string>,
): string {
  const title = entry.vortragstitel?.trim() || '';
  const isGeneric = /^(Vortrag \d+|Erster |Zweiter |Dritter |Vierter |Fünfter )/.test(title);
  const location = `${entry.ort}, ${entry.datum}`;
  const gaTitle = GA_TITLES[entry.ga?.split(',')[0]] ?? `GA ${entry.ga}`;

  if (title && !isGeneric) {
    return duplicateTitles.has(title) ? `${title} (${location})` : title;
  }
  if (title && isGeneric) {
    return cycleTitle ? `${cycleTitle} — ${title}` : `${gaTitle} — ${title}`;
  }
  // Titellos
  return cycleTitle ? `${cycleTitle} — ${location}` : `${gaTitle} — ${location}`;
}
```

Änderungen in `syncAll()`:
1. Zyklen in eine Map laden: `zyklus → titel`
2. Duplikat-Titel ermitteln (Titel die >1× vorkommen)
3. `buildDisplayTitle()` statt `entry?.vortragstitel` für den UPSERT verwenden

### Schritt 3 — `list_volumes` source_type korrigieren

In `app/services/app_catalog_repository.py` Zeile 39:

```python
# Alt:
"source_type": "book",

# Neu:
"source_type": row.get("source_type", "book"),
```

Dazu `source_type` in die SELECT-Klausel aufnehmen.

### Schritt 4 — Sync neu laufen lassen

```bash
# Tabellen leeren und neu befüllen
psql "$RAGRUN_POSTGRES_DSN" -c "TRUNCATE rag_lecture_catalog, rag_lecture_cycles CASCADE;"
STEINERORIGINALS_ROOT=../steineroriginals npx tsx scripts/sync_lectures.ts --all
```

### Schritt 5 — Verifizierung

```sql
-- Keine leeren Titel mehr
SELECT COUNT(*) FROM rag_sources
WHERE source_type = 'lecture' AND (title IS NULL OR title = '');
-- Erwartung: 0

-- Keine generischen Titel ohne Kontext
SELECT title FROM rag_sources
WHERE source_type = 'lecture' AND title ~ '^Vortrag \d+$';
-- Erwartung: 0 Zeilen

-- Stichprobe Display-Namen
SELECT title, ga FROM rag_sources
WHERE source_type = 'lecture'
ORDER BY title
LIMIT 20;
```

Claude-seitig: `list_volumes` aufrufen und prüfen, ob alle Einträge unterscheidbar sind.

---

## Offene Fragen

1. **Komma-GAs** (z.B. `280,295` oder `82,324a`): Welche GA für den Bandtitel verwenden? Vorschlag: erste GA nehmen, bei Bedarf beide anzeigen.

2. **Nicht-Vorträge** (Besprechungen, Schlussworte, ~25 Stück): Als eigenen `source_type` markieren (z.B. `discussion`), oder bei `lecture` belassen?

3. **Band-Duplikate**: Manche Vorträge existieren sowohl als Einzelquelle als auch innerhalb eines Bandes. Soll Claude beide sehen, oder eine Form bevorzugen?

---

## Dateien

| Datei | Änderung |
|-------|----------|
| `ragkeep/scripts/sync_lectures.ts` | `buildDisplayTitle()`, GA_TITLES-Map, Duplikat-Erkennung |
| `app/services/app_catalog_repository.py` | `source_type` aus DB statt hardcoded |
| `steineroriginals/rudolf-steiner-ga-lecture-catalog.yaml` | Keine Änderung (SSOT bleibt) |
