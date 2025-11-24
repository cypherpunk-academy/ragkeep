from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any, Optional, List
from pydantic import BaseModel
from app.api.deps import get_optional_user
from app.core.config import settings
from app.models.user import User
from app.models.chunks import ChunkMetadata
import logging
import json
import time


logger = logging.getLogger(__name__)

router = APIRouter()


class UploadChunksRequest(BaseModel):
    chunks_jsonl_path: Optional[str] = None
    chunks_jsonl_content: Optional[str] = None
    collection_name: Optional[str] = None
    batch_size: int = 64

    # Synchronization fields (see PLAN_RAGRUN.md)
    dry_run: bool = False
    cleanup_obsolete: bool = False
    assistant_name: Optional[str] = None


class UploadChunksResponse(BaseModel):
    success: bool
    total_lines: int
    processed: int
    upserted: int
    skipped: int
    errors: List[str]
    collection: str
    processing_time_ms: float

    # Enhanced sync fields
    deleted: int = 0
    is_dry_run: bool = False
    sync_summary: Optional[Dict[str, int]] = None
    sync_details: Optional[List[Dict[str, Any]]] = None


@router.post("/upload-chunks", response_model=UploadChunksResponse)
async def upload_chunks(
    request: UploadChunksRequest,
    current_user: Optional[User] = Depends(get_optional_user)
):
    start = time.time()
    errors: List[str] = []
    sync_summary: Optional[Dict[str, int]] = None
    sync_details: Optional[List[Dict[str, Any]]] = None
    deleted_count: int = 0

    try:
        from app.db.local_vector_db import LocalVectorStoreManager
        from app.services.personal_embeddings_service import PersonalEmbeddingsService
        from app.services.data_sync_service import DataSyncService, SyncAction
        from app.utils.text_utils import strip_html_preserve_text, NORMALIZATION_VERSION
        import hashlib
        import pathlib

        if not request.chunks_jsonl_path and not request.chunks_jsonl_content:
            raise HTTPException(status_code=400, detail="Provide chunks_jsonl_path or chunks_jsonl_content")

        vector_store = LocalVectorStoreManager(
            collection_name=request.collection_name or "philosophical_768"
        )
        embeddings_service = PersonalEmbeddingsService(base_url=settings.LOCAL_EMBEDDING_SERVICE_URL)

        # Read lines
        lines: List[str]
        if request.chunks_jsonl_path:
            p = pathlib.Path(request.chunks_jsonl_path)
            if not p.exists() or not p.is_file():
                raise HTTPException(status_code=400, detail=f"chunks_jsonl_path not found: {p}")
            lines = p.read_text(encoding="utf-8").splitlines()
        else:
            lines = request.chunks_jsonl_content.splitlines()

        total = len(lines)
        processed = 0
        upserted = 0
        skipped = 0

        # Helper to parse a JSONL line safely
        def parse_line(idx: int, raw: str) -> Optional[Dict[str, Any]]:
            s = raw.strip()
            if not s or s.startswith("#"):
                return None
            try:
                return json.loads(s)
            except Exception as e:
                errors.append(f"line {idx+1}: invalid json - {e}")
                return None

        # Prepare items for sync analysis
        source_items: List[Dict[str, Any]] = []

        # Process in batches for embeddings and upsert
        batch: List[Dict[str, Any]] = []
        texts_batch: List[str] = []

        async def flush_batch():
            nonlocal upserted, skipped
            if not batch:
                return
            # For dry-run we never call flush_batch
            try:
                embeddings = await embeddings_service.get_embeddings(texts_batch, batch_size=request.batch_size)
            except Exception as e:
                errors.append(f"embedding batch failed ({len(batch)} items): {e}")
                # skip this batch but continue
                skipped += len(batch)
                batch.clear()
                texts_batch.clear()
                return

            vectors = []
            for item, emb in zip(batch, embeddings):
                metadata = item.get("metadata", {}) or {}
                text_html = item.get("text", "")
                chunk_id = metadata.get("chunk_id")
                if not chunk_id:
                    # If no chunk_id, synthesize one from processed count
                    chunk_id = f"chunk_{processed}_{len(vectors)}"
                    metadata["chunk_id"] = chunk_id

                # Keep original HTML for display; do not store plain text
                # Add traceability for embedding input (hash + normalization version)
                text_plain_for_embed = strip_html_preserve_text(text_html)
                emb_input_hash = hashlib.sha256(text_plain_for_embed.encode("utf-8")).hexdigest()

                vectors.append({
                    "id": chunk_id,
                    "values": emb,
                    "metadata": {
                        **metadata,
                        # Back-compat: keep `text` as HTML for existing consumers
                        "text": text_html,
                        # New explicit field
                        "text_html": text_html,
                        "embedding_text_sha256": emb_input_hash,
                        "normalization_version": NORMALIZATION_VERSION,
                    }
                })

            try:
                vector_store.upsert_vectors(vectors)
                upserted += len(vectors)
            except Exception as e:
                errors.append(f"upsert failed ({len(vectors)} items): {e}")
                skipped += len(vectors)
            finally:
                batch.clear()
                texts_batch.clear()

        # First pass: parse lines and build source_items for sync
        for i, raw in enumerate(lines):
            item = parse_line(i, raw)
            if item is None:
                continue

            text_html = item.get("text", "")
            if not isinstance(text_html, str) or not text_html:
                errors.append(f"line {i+1}: missing or empty 'text'")
                skipped += 1
                continue

            metadata_dict = item.get("metadata", {}) or {}
            if not isinstance(metadata_dict, dict):
                errors.append(f"line {i+1}: invalid 'metadata' (expected object)")
                skipped += 1
                continue

            # Ensure chunk_id exists before validation, falling back to a deterministic ID
            chunk_id = metadata_dict.get("chunk_id")
            if not chunk_id:
                chunk_id = f"chunk_line_{i+1}"
                metadata_dict["chunk_id"] = chunk_id

            # Validate and normalize metadata against the new ChunkMetadata schema
            try:
                chunk_md = ChunkMetadata(**metadata_dict)
            except Exception as e:
                errors.append(f"line {i+1}: invalid metadata - {e}")
                skipped += 1
                continue

            normalized_metadata = chunk_md.to_chromadb_metadata()

            # Build a normalized view for sync analysis, including text for hashing
            sync_metadata = dict(normalized_metadata)
            sync_metadata["text"] = text_html
            source_items.append({
                "chunk_id": chunk_md.chunk_id,
                "metadata": sync_metadata,
            })

            processed += 1

            # For non-dry-run uploads, prepare embedding batches
            if not request.dry_run:
                item["metadata"] = normalized_metadata
                batch.append(item)
                # Compute stripped text for embedding only (not stored)
                texts_batch.append(strip_html_preserve_text(text_html))
                if len(batch) >= request.batch_size:
                    await flush_batch()

        # Synchronization / dry-run analysis
        sync_items = None
        if request.dry_run or request.cleanup_obsolete:
            sync_service = DataSyncService(vector_store)
            sync_items = sync_service.analyze_changes(source_items, id_field="chunk_id")

            sync_summary = {
                "add": len([s for s in sync_items if s.action == SyncAction.ADD]),
                "update": len([s for s in sync_items if s.action == SyncAction.UPDATE]),
                "skip": len([s for s in sync_items if s.action == SyncAction.SKIP]),
                "delete": len([s for s in sync_items if s.action == SyncAction.DELETE]),
            }
            sync_details = [
                {
                    "id": s.id,
                    "action": s.action.value,
                    "reason": s.reason,
                    "existing_hash": s.existing_hash,
                    "new_hash": s.new_hash,
                }
                for s in sync_items
            ]

            logger.info(
                "Sync analysis completed",
                extra={
                    "collection": vector_store.collection_name,
                    "total_items": len(source_items),
                    "sync_summary": sync_summary,
                    "assistant": request.assistant_name,
                },
            )

        # If this is a pure dry-run, return without performing any writes
        if request.dry_run:
            elapsed = (time.time() - start) * 1000.0
            return UploadChunksResponse(
                success=len(errors) == 0,
                total_lines=total,
                processed=0,
                upserted=0,
                skipped=0,
                deleted=0,
                errors=errors,
                collection=vector_store.collection_name,
                processing_time_ms=elapsed,
                is_dry_run=True,
                sync_summary=sync_summary,
                sync_details=sync_details,
            )

        # Flush any remainder for actual uploads
        await flush_batch()

        # Handle cleanup of obsolete items (only in non-dry-run mode)
        if request.cleanup_obsolete and sync_items is not None:
            delete_items = [s for s in sync_items if s.action == SyncAction.DELETE]
            for item in delete_items:
                # Delete by metadata filter using chunk_id (canonical ID) and legacy augmentId
                vector_store.delete_by_filter(
                    {
                        "$or": [
                            {"chunk_id": item.id},
                            {"augmentId": item.id},
                        ]
                    }
                )
            deleted_count = len(delete_items)

        elapsed = (time.time() - start) * 1000.0
        return UploadChunksResponse(
            success=len(errors) == 0,
            total_lines=total,
            processed=processed,
            upserted=upserted,
            skipped=skipped,
            deleted=deleted_count,
            errors=errors,
            collection=vector_store.collection_name,
            processing_time_ms=elapsed,
            is_dry_run=False,
            sync_summary=sync_summary,
            sync_details=sync_details,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to upload chunks: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to upload chunks: {str(e)}")



