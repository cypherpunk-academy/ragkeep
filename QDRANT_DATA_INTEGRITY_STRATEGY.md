# QDRANT_DATA_INTEGRITY_STRATEGY

## 1. Zielbild und Regeln
- Ziel: Pro `source_id` nur aktuelle Chunks in Qdrant/Spiegel; Embeddings werden nur neu berechnet, wenn sich der abgedeckte Text ändert.
- `chunk_id`: stabiler, deterministischer Schlüssel für den exakten Textausschnitt. Ändert sich nur, wenn sich der abgedeckte Abschnitt verschiebt/teilt/verschmilzt. Metadatenänderungen behalten die `chunk_id`. Empfehlenswert: aus `source_id` + Absatz-/Satzgrenzen ableiten, nicht aus laufender Nummer. Nutze Lemmata der ersten/letzten 3–5 Tokens als Anker und kombiniere sie mit `content_hash` (z. B. `sha1(source_id + anchor_start_lemmas + anchor_end_lemmas + content_hash)`), damit Einfügungen/Löschungen vor dem Chunk die ID nicht ändern.
- `content_hash`: Hash über den kanonisierten Text (z.B. getrimmter Plaintext ohne Markup). Steuert Embedding-Invalidierung: gleicher Hash ⇒ Embedding wiederverwenden; neuer Hash ⇒ neu einbetten. Metadaten-Only-Updates behalten denselben Hash.
- `source_id`: repräsentiert das Artefakt (Buch/Essay/Begriffe). Nach einem Upload/Upsert müssen alle Chunks dieser `source_id` im Zielzustand sein; veraltete `chunk_id`s derselben `source_id` werden entfernt.
- Soll-Ablauf beim Upsert pro Upload:
  1) Eingehende Chunks deduplizieren (`chunk_id`,`content_hash`).
  2) Bestehende Chunks der `source_id` laden (Qdrant + Spiegel).
  3) Pro `chunk_id` vergleichen: gleicher Hash ⇒ keine Einbettung, nur Payload/Metadaten aktualisieren; anderer Hash ⇒ neu einbetten und überschreiben; neue `chunk_id` ⇒ einbetten und anlegen.
  4) Stale Chunks: alle in DB vorhandenen `chunk_id`s der `source_id`, die nicht im Upload sind, löschen (Qdrant + Spiegel).
  5) `updated_at` setzen, `created_at` nur bei neuen Chunks.
- Edge Cases: Teil-Uploads (Filter nach `chunkIds`) sollten optionales `dry_run`/`skip_cleanup` erlauben. Bei Absatz-Splitting müssen neu entstehende Grenzänderungen neue `chunk_id`s bekommen, sonst bleiben alte Stücke liegen.
- Observability: pro Lauf erfassen: Anzahl neu eingebettet / nur payload-updated / gelöscht; Warnungen, falls Upload unvollständig (Teilfilter ohne Cleanup) oder Hash-Mismatch bei fehlender `chunk_id`.

## 2. Aktueller Stand und erforderliche Schritte
- `ragprep/src/cli/commands/ragUpload/index.ts`
  - IST: liest/normalisiert `chunks.jsonl`; setzt `content_hash`, falls fehlt; `chunk_id` kommt aus Input; keine Prüfung gegen bestehende DB; kein Cleanup nach `source_id`; kein Schutz, dass `chunk_id` stabil bleibt.
  - TODO: deterministische `chunk_id`-Herleitung (aus Grenz-Map), `source_id` verpflichtend; optional Manifest-Hash mitschicken; Upload-Request um erwartete `source_id` ergänzen, damit Server gezielt cleanen kann; optional: Preflight, das vorhandene `chunk_id`s der `source_id` abfragt und nur Deltas schickt.

- `ragrun/app/api/rag.py` + `app/services/ingestion_service.py`
  - IST: parst JSONL, dedupliziert nur innerhalb des Requests (`chunk_id`,`content_hash`); embedden immer alle deduplizierten Chunks; Qdrant-ID = UUIDv5(`chunk_id`) ⇒ Überschreiben bei gleicher ID; Spiegel löscht/ersetzt nur die hochgeladenen `chunk_id`s; keine Löschung veralteter `chunk_id`s einer `source_id`; keine Hash-Vergleiche mit bestehendem Bestand, daher kein Embed-Skip; kein Payload-Update ohne Embedding.
  - TODO: vor Embedding bestehende Chunks pro `chunk_id`/`source_id` laden; wenn Hash identisch, Payload mit bestehendem Vektor aktualisieren (Qdrant `set_payload` oder Upsert mit wiederverwendetem Vektor); wenn Hash neu, embedden und upserten; nach erfolgreichem Lauf alle nicht gelieferten `chunk_id`s der `source_id` löschen (Qdrant + Spiegel), optional `dry_run`/`limit`; Telemetrie über neu/aktualisiert/gelöscht.

- `ragrun/app/services/mirror_repository.py`
  - IST: schreibt gespiegelt, indem hochgeladene `chunk_id`s gelöscht und neu eingefügt werden. Keine Quell-basierten Cleanups.
  - TODO: Hilfsfunktionen, um `chunk_id`s nach `source_id` zu listen und Löschungen auszuführen.

- Qdrant-Funktionalität
  - IST: Upsert überschreibt Points gleicher ID; `delete` per ID/Filter verfügbar; Payload-Update (`set_payload`) möglich, aber nicht genutzt; kein automatisches Cleanup.
  - TODO: Client um `set_payload`/`scroll`/`retrieve` erweitern, damit Embeddings bei Metadaten-Updates wiederverwendet und Stale-Punkte per Filter (`source_id`) entfernt werden können.

- Ablauf-Vorschlag für Implementierung
  1) In `ragUpload`: Chunk-Grenzen deterministisch → stabile `chunk_id`; `source_id` erzwingen; Upload-Body um `source_id` und optional `skip_cleanup` erweitern.
  2) In `ingestion_service.upload_chunks`: vorhandene Chunks der `source_id` laden; Klassifikation (gleiches Hash ⇒ Payload-Update ohne Embedding; neues Hash ⇒ Embedding+Upsert; neu ⇒ Embedding+Insert); Telemetrie zählen.
  3) Cleanup: nach erfolgreichem Upsert alle nicht gelieferten `chunk_id`s der `source_id` löschen (Qdrant + Spiegel), optional `dry_run`.
  4) Tests: End-to-end für „nur Metadaten geändert“, „Text geändert“, „Chunk entfallen“, „Teil-Upload mit skip_cleanup“.

## 3. Stufenplan zur Umsetzung
- Stufe 1: Deterministische `chunk_id`-Erzeugung in ragprep
  - Chunking erweitern: Anker aus Lemmata (erste/letzte 3–5 Tokens) + `content_hash` → `chunk_id`.
  - Validator in `rag:upload`: `chunk_id` muss zu Text/Ankern passen; `source_id` Pflicht.
- Stufe 2: API/Service-Fähigkeiten in ragrun
  - Qdrant-Client um `retrieve`/`set_payload`/`scroll` erweitern.
  - `ingestion_service.upload_chunks`: Bestand pro `source_id` laden, Hash-Vergleich, Embedding nur bei geändertem Hash, Payload-Update sonst, Upsert mit bestehendem Vektor möglich.
- Stufe 3: Cleanup-Pfad pro `source_id`
  - Nach Upsert: fehlende `chunk_id`s der `source_id` (Bestand – Upload) löschen (Qdrant + Spiegel); `skip_cleanup`/`dry_run` optional.
- Stufe 4: Guardrails im Upload
  - Preflight: hohe Quote neuer `chunk_id`s bei identischem Hash → Warnung/Abbruch; optional `force_new_ids`.
  - Batch-Optionen (`batch_size`, `skip_cleanup`) im Request durchreichen.
- Stufe 5: Observability & Tests
  - Telemetrie: gezählt neu/aktualisiert/gelöscht/geskipped; Dauer pro Phase.
  - Tests: E2E-Szenarien (Metadaten-only, Text geändert, Chunk entfernt, Teil-Upload mit/ohne Cleanup), plus Regression für stabile `chunk_id` bei unverändertem Text.
