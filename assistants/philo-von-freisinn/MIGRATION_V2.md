# Migration: `philo-von-freisinn` → `philo-von-freisinn-v2`

## Kurz

Qdrant 1.11 erlaubt kein nachträgliches Hinzufügen des Sparse-Slots `text-sparse` zu einer bestehenden Collection. BM25 (Hybrid) braucht diesen Slot schon **bei der Anlage** der Collection.  
Daher: **neue Collection** `philo-von-freisinn-v2`, vollständiger Re-Upload, Verifikation, danach Umschaltung im Manifest (bereits: `rag-collection: philo-von-freisinn-v2`).

## Voraussetzungen (ragrun)

- `RAGRUN_USE_HYBRID_RETRIEVAL=true` in der ragrun-`.env` (Sparse bei Ingestion)
- laufendes RAG-API, erreichbar über `RAGRUN_BASE_URL` (ragprep, Standard z. B. `http://localhost:8000/api/v1`)
- laufendes Qdrant (wie in `RAGRUN_QDRANT_URL`)

## 1. Re-Ingestion in die neue Collection (ohne Manifest vorher anzupassen)

Überschreibt die Ziel-Collection per CLI, **ohne** im Manifest `rag-collection` doppelt ändern zu müssen:

```bash
# Aus ragprep-Projekt, RAGKEEP_PROJECT_ROOT setzen
export RAGKEEP_PROJECT_ROOT=/path/to/ragkeep
cd /path/to/ragprep
npx tsx src/bin/rp.ts rag:upload philo-von-freisinn --collection philo-von-freisinn-v2
```

Optional: `--force` bzw. `--max-delete` nach Bedarf (wie bisher).

## 2. Verifikation: Monitoring + Qdrant sparse

- **Nur lokal vs. DB (ohne Upload):**

  ```bash
  npx tsx src/bin/rp.ts rag:upload philo-von-freisinn --verify-only --collection philo-von-freisinn-v2 --verify-qdrant
  ```

- Dabei:
  - Tabelle **lokal / Collection** (Postgres-Monitoring) wie bisher
  - Zusätzlich: **GET** `.../api/v1/rag/collections/philo-von-freisinn-v2/verify-sparse`
    - prüft Schema (`sparse_vectors.text-sparse`) und sticht BM25-Vektore auf Stichprobenpunkte

Direkter Check per curl:

```bash
curl -s "http://localhost:8000/api/v1/rag/collections/philo-von-freisinn-v2/verify-sparse" | python3 -m json.tool
```

Erwartung: `"ok": true` (u. a. `sparse_slot_configured`, voll befüllte Stichprobe, `hybrid_retrieval_enabled` true).

## 3. Cutover

Das Assistenten-Manifest nutzt `rag-collection: philo-von-freisinn-v2` (Umschaltung).  
Falls eure Runtime Registry ein Rebuild braucht: static/build wie in eurem üblichen Workflow.

## 4. Alte Collection löschen (Cleanup)

**Erst** nach Stabilität, **Backup**/Rollback-Rückkehr klar (Manifest kann vorübergehend auf `philo-von-freisinn` zeigen, falls die alte Collection noch existiert).

Qdrant:

```bash
curl -X DELETE "http://localhost:6333/collections/philo-von-freisinn"
```

## Rollback

- `rag-collection` im Manifest auf `philo-von-freisinn` stellen, Runtime neu laden, solange alte Collection noch existiert.
