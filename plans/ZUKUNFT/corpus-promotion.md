# Corpus Promotion: Dev -> Staging -> Production

## Status: Offen

## Problem

Heute gibt es keinen definierten Weg, Korpus-Aenderungen von Dev nach Staging/Production zu bringen:

- `rag:chunk` schreibt `rag_paragraphs` + `rag_chunks` in die Dev-Postgres-DB
- `rag:embed` embeddet lokal gegen lokales Qdrant
- Staging und Production teilen sich eine Qdrant-Cloud-Instanz, haben aber eigene Supabase-Projekte (Postgres)
- `sync_prod_to_dev.mjs` kopiert Prod -> Dev, aber nicht umgekehrt

## Betroffene Tabellen / Services

| Ressource | Dev | Staging/Prod |
|---|---|---|
| `rag_paragraphs` | Dev-Supabase Postgres | jeweils eigenes Supabase-Projekt |
| `rag_chunks` | Dev-Supabase Postgres | jeweils eigenes Supabase-Projekt |
| `rag_sources` | Dev-Supabase Postgres (sync_sources.ts pre-push) | jeweils eigenes Supabase-Projekt |
| Qdrant Embeddings | lokaler Docker | gemeinsame Qdrant Cloud |
| `books.db` (App SQLite) | lokal generiert (fetch-db-seed.mjs) | OTA via Supabase Storage |

## Typischer Kurator-Workflow (Ist)

```
1. phase4-Dateien korrigieren (z.B. 20 Rechtschreibfehler)
2. yarn rp text:annotate <bookDir>        -> phase5
3. yarn rp rag:chunk <bookDir>            -> Dev-Postgres
4. yarn rp rag:embed <assistant>          -> lokales Qdrant
5. Testen in der App gegen Dev
6. ???  -> Staging/Prod-Postgres
7. ???  -> Qdrant Cloud
8. yarn rp rag:publish <assistant>        -> books.db -> Supabase Storage (noch nicht gebaut)
```

## Optionen fuer Promotion (Schritt 6 + 7)

### A) rag:chunk + rag:embed nochmal gegen Prod

- `.env` umschalten auf Prod-DSN, `rag:chunk` + `rag:embed` wiederholen
- Einfach, deterministisch (gleiche phase5-Dateien -> gleiches Ergebnis)
- Doppelte Laufzeit, manuelles Umschalten

### B) rag:promote Befehl

- Neuer Befehl: kopiert `rag_paragraphs` + `rag_chunks` von Dev-Postgres -> Prod-Postgres
- Dann `rag:embed` gegen Prod-ragrun (Qdrant Cloud)
- Weniger doppelte Arbeit, aber neuer Code

### C) Direkt gegen Prod chunken (kein Dev-Zwischenschritt fuer Korpus)

- `rag:chunk` immer gegen Prod-Postgres (Korpus-Daten sind nicht environment-spezifisch)
- `rag:embed` gegen Prod-ragrun -> Qdrant Cloud
- Einfachste Loesung, aber kein Testen vor Prod
- Buchkorrekturen sind deterministisch, Risiko gering

### D) Geteilte Postgres-Tabellen

- `rag_paragraphs`, `rag_chunks`, `rag_sources` in einer zentralen DB
- Staging/Prod haben nur User-Daten (talks, notes, bookmarks) in eigenen Supabase-Projekten
- Sauberste Trennung, aber Architektur-Aenderung

## books.db bei Promotion

Bei jeder Promotion (Dev -> Staging, Staging -> Prod) wird ein neues `books.db` aus der Ziel-Postgres-DB erzeugt und in den Supabase Storage des Ziel-Environments hochgeladen. Der Ablauf:

1. Promotion der `rag_paragraphs` + `rag_chunks` in die Ziel-DB (Strategie siehe oben)
2. `rag:publish` gegen die Ziel-DB ausfuehren -> erzeugt `books.db` mit inkrementierter `user_version`
3. Upload in den Supabase Storage des Ziel-Environments
4. `RAGRUN_CORPUS_VERSION` + `RAGRUN_CORPUS_DOWNLOAD_URL` im Ziel-Environment setzen

Jedes Environment hat also seine eigene `books.db` mit eigener Versionsnummer, passend zum Stand seiner `rag_paragraphs`.

## Entscheidungen (offen)

- [ ] Welche Promotion-Strategie (A/B/C/D)?
- [ ] Reihenfolge: erst Staging testen, dann Prod? Oder direkt Prod?
