# RAG Run Side Implementation Plan

## Compatibility Check with Current Codebase

✅ **Database Layer (LocalVectorStoreManager)**: **FULLY COMPATIBLE**
- All required methods exist: `upsert_vectors`, `query_vectors`, `delete_vectors`, `delete_by_filter`, `count_by_filter`, `list_collections`, etc.
- Filter conversion (`_convert_filter_to_where`) supports Pinecone-style filters
- Metadata sanitization handles complex types correctly

❌ **API Layer (upload_chunks endpoint)**: **PARTIALLY COMPATIBLE - NEEDS ENHANCEMENT**
- Current `UploadChunksRequest` missing: `dry_run`, `cleanup_obsolete`, `assistant_name`
- Current `UploadChunksResponse` missing: `deleted`, `is_dry_run`, `sync_summary`, `sync_details`
- No sync analysis or dry-run logic implemented

✅ **Migration Strategy**: **CORRECT APPROACH FOR CHROMADB**
- No SQL migrations needed - replaced with ChromaDB metadata migration
- Collection evolution through metadata updates is the right approach

## Overview

This plan outlines the changes required on the ragrun side to support the enhanced `rag:upload` command. The ragrun system provides the API endpoints and vector database management that the ragprep CLI calls.

## Current Architecture

Based on `ANALYSIS.md`, the ragrun side includes:
- **API Endpoints**: `/api/v1/rag/upload-chunks` for chunk uploads
- **Vector Database**: ChromaDB via `LocalVectorStoreManager`
- **Embeddings**: Personal embeddings service for text vectorization
- **CLI Scripts**: Various Python scripts in `scripts/rag-cli/`

## Required Changes

### 1. API Endpoint Updates

#### 1.1 Enhanced Upload Chunks Endpoint
**File:** `app/api/endpoints/rag/upload_chunks.py`

**CRITICAL: Current implementation is missing dry-run and synchronization features. The existing code must be enhanced with:**

1. **Updated Pydantic models** (add missing fields shown below)
2. **DataSyncService integration** for change analysis
3. **Dry-run logic** that analyzes without executing changes
4. **Cleanup obsolete logic** for removing outdated items

**Current Request Model:**
```python
class UploadChunksRequest(BaseModel):
    chunks_jsonl_path: Optional[str] = None
    chunks_jsonl_content: Optional[str] = None
    collection_name: Optional[str] = None
    batch_size: int = 64
```

**New Request Model:**
```python
class UploadChunksRequest(BaseModel):
    chunks_jsonl_path: Optional[str] = None
    chunks_jsonl_content: Optional[str] = None
    collection_name: Optional[str] = None
    batch_size: int = 64

    # New synchronization fields
    dry_run: bool = False
    cleanup_obsolete: bool = False
    assistant_name: Optional[str] = None  # For validation and logging
```

**Response Model Enhancement:**
```python
class UploadChunksResponse(BaseModel):
    success: bool
    total_lines: int
    processed: int
    upserted: int
    skipped: int
    deleted: int  # New field for cleanup operations
    errors: List[str]
    collection: str
    processing_time_ms: float

    # Dry-run specific fields
    is_dry_run: bool = False
    sync_summary: Optional[Dict[str, int]] = None  # add/update/skip/delete counts
    sync_details: Optional[List[Dict[str, Any]]] = None  # detailed change list
```

### 2. Metadata Schema Updates

#### 2.1 Vector Metadata Enhancement
**File:** `app/db/local_vector_db.py`

**Current Metadata Sanitization:**
```python
metadata: Dict[str, Any] = {}
for mk, mv in raw_metadata.items():
    if isinstance(mv, (str, int, float, bool)) or mv is None:
        metadata[mk] = mv
    elif isinstance(mv, (list, dict)):
        metadata[mk] = json.dumps(mv, ensure_ascii=False)
    else:
        metadata[mk] = str(mv)
```

**Enhanced Metadata Handling & Back-Compat Normalization:**
```python
def sanitize_metadata(raw_metadata: Dict[str, Any]) -> Dict[str, Any]:
    """Enhanced metadata sanitization supporting new fields and cleaning up legacy ones."""
    metadata: Dict[str, Any] = {}

    # 1) Normalize legacy chapter fields -> chapter
    legacy_chapter = raw_metadata.get('chapter_level_1')
    if 'chapter' not in raw_metadata and isinstance(legacy_chapter, str) and legacy_chapter.strip():
        metadata['chapter'] = legacy_chapter.strip()

    # 2) Copy over all other keys, dropping legacy-only ones
    for mk, mv in raw_metadata.items():
        # Skip legacy chapter fields entirely
        if mk in ['chapter_level_1', 'chapter_level_2', 'chapter_level_3']:
            continue

        if mk in ['worldview', 'chunk_type', 'chunk_index', 'chapter']:
            # Preserve new core metadata fields
            if isinstance(mv, (str, int, float, bool)) or mv is None:
                metadata[mk] = mv
            else:
                metadata[mk] = str(mv)
        elif isinstance(mv, (str, int, float, bool)) or mv is None:
            metadata[mk] = mv
        elif isinstance(mv, (list, dict)):
            metadata[mk] = json.dumps(mv, ensure_ascii=False)
        else:
            metadata[mk] = str(mv)

    return metadata
```

Back-compat implications:
- Any existing vectors that still have `chapter_level_1` but no `chapter` will transparently get `chapter` set on the next upsert.
- Legacy fields `chapter_level_1`, `chapter_level_2`, `chapter_level_3` are not persisted anymore for new or updated chunks; over time, they disappear from the collection as content is refreshed.

#### 2.2 Canonical Content Fields for Hashing

For book chunks, canonical content is `text`; for summaries and other augmentations, canonical content is `summary`.

#### 2.3 Content Hashing for Change Detection (Authoritative)
`content_hash` is the **server-authored source of truth** for change detection. It is always computed on ragrun from canonical content fields, regardless of any hashes sent by clients.

**New Method in LocalVectorStoreManager:**
```python
def get_content_hash(self, metadata: Dict[str, Any]) -> str:
    """Generate content hash for change detection."""
    content_fields = ['text', 'summary', 'content']  # Priority order
    content = None

    for field in content_fields:
        if field in metadata and isinstance(metadata[field], str):
            content = metadata[field]
            break

    if not content:
        # Fallback to full metadata serialization
        content = json.dumps(metadata, sort_keys=True, ensure_ascii=False)

    return hashlib.sha256(content.encode('utf-8')).hexdigest()
```

#### 2.4 Hybrid Hashing Strategy with Client Hints

To balance correctness and performance:

- **Server (ragrun)**:
  - Always recomputes `content_hash` from the received content using `get_content_hash`.
  - Treats this value as the **only** authoritative hash stored in the vector DB.
  - Uses `content_hash` for deciding add/update/skip/delete during synchronization.
- **Client (ragprep)**:
  - May compute a **client-side hash** (same algorithm) to:
    - Improve dry-run reports.
    - Avoid unnecessary uploads when it can safely determine no change.
  - May send this as a non-authoritative field (e.g. `client_hint_hash`).
- **Ragrun must not rely on client hashes**:
  - Any client-provided hash is treated as a hint for logging/diagnostics at most.
  - All stored `content_hash` values are generated on ragrun, ensuring one single source of truth.

Consequences for the rest of this plan:
- The synchronization logic in `DataSyncService` uses `existing.content_hash` values that were **computed on ragrun**.
- When it needs a hash for incoming items, it uses `get_content_hash(...)` on the server side, even if a client hint is present.

### 4. Data Synchronization Implementation

#### 4.0 ID Convention: chunk_id Everywhere

To avoid ambiguity between different ID fields, the ragrun side uses **`chunk_id` as the single canonical identifier for all stored items**, independent of their origin (book chunks, chapter summaries, other augmentations).

Rules:
- Every vector entry in the collection **must have a `chunk_id` metadata field**.
- Any source-local IDs (e.g. `augmentId` in summary artifacts) are:
  - Either converted to `chunk_id` on ragprep before upload, or
  - Normalized to `chunk_id` at the API boundary before insertion.
- `DataSyncService`, `delete_by_filter`, and all sync-related logic **only operate on `chunk_id`**, never on `augmentId` or other ad-hoc IDs.
- For **older documents** that predate `chunk_type`, ragrun must treat:
  - Missing `chunk_type` as `chunk_type = "book"` for all read/query/sync logic.
  - Optionally, normalization code can backfill `chunk_type: "book"` on next update so future reads see an explicit value.

This matches the ragprep plan and guarantees that both sides talk about the same ID when they say “this chunk”.

#### 4.1 Synchronization Service
**New File:** `app/services/data_sync_service.py`

```python
from typing import Dict, List, Any, Optional
from enum import Enum

class SyncAction(Enum):
    ADD = "add"
    UPDATE = "update"
    SKIP = "skip"
    DELETE = "delete"

class SyncItem:
    def __init__(self, item_id: str, action: SyncAction, reason: str = ""):
        self.id = item_id
        self.action = action
        self.reason = reason
        self.existing_hash: Optional[str] = None
        self.new_hash: Optional[str] = None

class DataSyncService:
    def __init__(self, vector_store):
        self.vector_store = vector_store

    def analyze_changes(
        self,
        source_items: List[Dict[str, Any]],
        id_field: str = 'chunk_id'
    ) -> List[SyncItem]:
        """Analyze what changes are needed between source and existing data."""

        sync_items: List[SyncItem] = []

        # Get existing items from vector store using chunk_id
        existing_items = self._get_existing_items_by_id(source_items, id_field)

        # Analyze source items
        for source_item in source_items:
            item_id = source_item.get(id_field)
            if not item_id:
                continue

            existing = existing_items.get(item_id)
            source_hash = self._calculate_item_hash(source_item)

            if not existing:
                sync_items.append(SyncItem(item_id, SyncAction.ADD, "New item"))
            elif existing.get('content_hash') != source_hash:
                sync_item = SyncItem(item_id, SyncAction.UPDATE, "Content changed")
                sync_item.existing_hash = existing.get('content_hash')
                sync_item.new_hash = source_hash
                sync_items.append(sync_item)
            else:
                sync_items.append(SyncItem(item_id, SyncAction.SKIP, "Unchanged"))

        # Check for obsolete items
        source_ids = {item.get(id_field) for item in source_items if item.get(id_field)}
        for existing_id, existing_data in existing_items.items():
            if existing_id not in source_ids:
                sync_items.append(SyncItem(existing_id, SyncAction.DELETE, "Obsolete"))

        return sync_items

    def _get_existing_items_by_id(self, source_items: List[Dict], id_field: str) -> Dict[str, Dict]:
        """Query existing items by their IDs."""
        # Implementation to query vector store efficiently
        pass

    def _calculate_item_hash(self, item: Dict[str, Any]) -> str:
        """Calculate hash for an item."""
        # Implementation using content fields
        pass
```

#### 4.2 Dry-Run Implementation
**Enhanced upload_chunks endpoint:**

```python
@router.post("/upload-chunks", response_model=UploadChunksResponse)
async def upload_chunks(request: UploadChunksRequest, current_user: Optional[User] = Depends(get_optional_user)):
    # ... existing setup code ...

    # NEW: Data synchronization analysis
    if request.dry_run or request.cleanup_obsolete:
        sync_service = DataSyncService(vector_store)
        sync_items = sync_service.analyze_changes(lines)

        # Categorize changes
        sync_summary = {
            'add': len([s for s in sync_items if s.action == SyncAction.ADD]),
            'update': len([s for s in sync_items if s.action == SyncAction.UPDATE]),
            'skip': len([s for s in sync_items if s.action == SyncAction.SKIP]),
            'delete': len([s for s in sync_items if s.action == SyncAction.DELETE])
        }

        if request.dry_run:
            # Return dry-run results without making changes
            return UploadChunksResponse(
                success=True,
                total_lines=len(lines),
                processed=0,
                upserted=0,
                skipped=0,
                deleted=0,
                errors=[],
                collection=vector_store.collection_name,
                processing_time_ms=0,
                is_dry_run=True,
                sync_summary=sync_summary,
                sync_details=[{
                    'id': s.id,
                    'action': s.action.value,
                    'reason': s.reason,
                    'existing_hash': s.existing_hash,
                    'new_hash': s.new_hash
                } for s in sync_items]
            )

    # ... existing processing logic ...

    # NEW: Handle obsolete item cleanup
    if request.cleanup_obsolete:
        delete_items = [s for s in sync_items if s.action == SyncAction.DELETE]
        for item in delete_items:
            # Delete by metadata filter using chunk_id (canonical ID)
            # Include augmentId fallback for legacy cleanup
            vector_store.delete_by_filter({
                '$or': [
                    {'chunk_id': item.id},
                    {'augmentId': item.id}  # Legacy cleanup
                ]
            })
        deleted_count = len(delete_items)
    else:
        deleted_count = 0

    # ... existing response construction ...

    return UploadChunksResponse(
        # ... existing fields ...
        deleted=deleted_count,
        # ... other fields ...
    )
```

### 5. Enhanced Querying and Filtering

#### 5.1 Metadata-Based Filtering
**Enhance LocalVectorStoreManager:**

```python
def query_by_metadata_filter(
    self,
    metadata_filter: Dict[str, Any],
    top_k: int = 10
) -> List[Dict[str, Any]]:
    """Query items by metadata filters for synchronization."""

    where_clause = self._convert_filter_to_where(metadata_filter)

    results = self.collection.get(
        where=where_clause,
        include=['metadatas', 'documents'],
        limit=top_k
    )

    items = []
    for i, metadata in enumerate(results.get('metadatas', [])):
        item = {
            'id': metadata.get('augmentId') or metadata.get('chunk_id'),
            'content_hash': metadata.get('content_hash'),
            'metadata': metadata,
            'document': results.get('documents', [])[i] if results.get('documents') else None
        }
        items.append(item)

    return items
```

#### 5.2 Batch Query Optimization
**New Method:**
```python
def get_items_by_ids(self, item_ids: List[str]) -> Dict[str, Dict[str, Any]]:
    """Efficiently retrieve multiple items by their IDs."""

    # Use batch querying to avoid N+1 queries
    items = {}

    # Query in batches to avoid memory issues
    batch_size = 100
    for i in range(0, len(item_ids), batch_size):
        batch_ids = item_ids[i:i + batch_size]

        # Query for this batch
        filter_conditions = [{'augmentId': {'$in': batch_ids}}]
        if 'chunk_id' in batch_ids[0]:  # Fallback for older data
            filter_conditions.append({'chunk_id': {'$in': batch_ids}})

        # Combine with OR logic
        where_clause = {'$or': filter_conditions}

        results = self.collection.get(
            where=where_clause,
            include=['metadatas', 'documents']
        )

        # Process results
        for j, metadata in enumerate(results.get('metadatas', [])):
            item_id = metadata.get('augmentId') or metadata.get('chunk_id')
            items[item_id] = {
                'content_hash': metadata.get('content_hash'),
                'metadata': metadata,
                'document': results.get('documents', [])[j] if results.get('documents') else None
            }

    return items
```

### 6. CLI Scripts Enhancement

#### 6.1 New CLI Commands
**File:** `scripts/rag-cli/rag_upload_cli.py` (new)

```python
import click
import requests
import json
from pathlib import Path

@click.group()
def rag_upload():
    """Commands for managing RAG data uploads."""
    pass

@rag_upload.command()
@click.argument('assistant')
@click.option('--book-dir', help='Specific book directory')
@click.option('--worldview', help='Specific worldview')
@click.option('--chunk-types', default='book', help='Chunk types to upload')
@click.option('--dry-run', is_flag=True, help='Preview changes without uploading')
@click.option('--cleanup-obsolete', is_flag=True, help='Delete obsolete items')
@click.option('--batch-size', default=64, help='Batch size for processing')
def upload(assistant, book_dir, worldview, chunk_types, dry_run, cleanup_obsolete, batch_size):
    """Upload content to assistant collections."""

    # This would call the ragprep CLI, but could also have direct API calls
    # Implementation would mirror the ragprep CLI logic but call ragrun APIs directly

    pass

@rag_upload.command()
@click.argument('collection_name')
@click.option('--days', default=30, help='Days to look back')
def cleanup_old(collection_name, days):
    """Clean up old or obsolete data from collections."""

    # Implementation for maintenance operations
    pass
```

#### 6.2 Enhanced Diagnostics
**File:** `scripts/rag-cli/diagnostics/rag_sync_diagnostics.py` (new)

```python
def diagnose_sync_status(collection_name: str) -> Dict[str, Any]:
    """Diagnose synchronization status of a collection."""

    # Check for items without content_hash
    # Check for duplicate IDs
    # Check for missing required metadata
    # Generate sync health report

    pass

def validate_chunk_integrity(collection_name: str) -> Dict[str, Any]:
    """Validate chunk integrity and metadata consistency."""

    # Check required fields presence
    # Validate metadata formats
    # Check for orphaned chunks
    # Verify embedding consistency

    pass
```

### 7. Configuration Updates

#### 7.1 Environment Variables
**File:** `.env.example` (add new variables)

```bash
# Data Synchronization
RAGRUn_SYNC_BATCH_SIZE=100
RAGRUn_MAX_SYNC_ANALYSIS_TIME=300  # seconds
RAGRUn_DRY_RUN_TIMEOUT=60  # seconds

# Content Validation
RAGRUn_REQUIRE_CONTENT_HASH=true
RAGRUn_VALIDATE_CHUNK_TYPES=true
```

#### 7.2 Collection Management
**Enhanced collection configuration:**

```python
COLLECTION_CONFIGS = {
    'philosophical_768': {
        'embedding_model': 'text-embedding-ada-002',
        'metadata_schema': {
            'required': ['chunk_id', 'chunk_type'],
            'optional': ['worldview', 'chapter', 'importance'],
            'indexed': ['augmentId', 'chunk_type', 'worldview']
        }
    }
}
```

### 8. Testing and Validation

#### 8.1 Unit Tests
**New Test Files:**
- `tests/test_data_sync_service.py`
- `tests/test_upload_chunks_enhanced.py`
- `tests/test_dry_run_functionality.py`

#### 8.2 Integration Tests
**Enhanced Test Scenarios:**
- Dry-run accuracy validation
- Synchronization conflict resolution
- Large dataset performance testing
- Cleanup operation verification

#### 8.3 Performance Benchmarks
- Sync analysis time vs collection size
- Memory usage during large uploads
- Embedding service throughput with new metadata

### 9. Monitoring and Observability

#### 9.1 Enhanced Logging
**Structured logging for sync operations:**
```python
logger.info("Sync analysis completed", {
    'collection': collection_name,
    'total_items': len(source_items),
    'sync_summary': sync_summary,
    'duration_ms': duration,
    'assistant': assistant_name
})
```

#### 9.2 Metrics Collection
**New metrics:**
- `rag_sync_analysis_duration`
- `rag_sync_changes_detected`
- `rag_sync_operations_completed`
- `rag_dry_run_requests`

### 10. ChromaDB Collection Evolution

#### 10.1 Collection Metadata Migration
**ChromaDB handles schema evolution through collection metadata updates rather than SQL migrations.**

```python
def migrate_collection_metadata(collection_name: str) -> Dict[str, Any]:
    """
    Migrate existing ChromaDB collection to support new metadata fields.
    Run this during deployment or as a maintenance task.
    """
    vector_store = LocalVectorStoreManager(collection_name=collection_name)

    # Get all existing items
    all_items = vector_store.collection.get(limit=10000, include=['metadatas'])

    migrated_count = 0
    updated_items = []

    for i, metadata in enumerate(all_items.get('metadatas', [])):
        needs_update = False
        updated_metadata = dict(metadata)  # Copy existing

        # Add missing worldview field (default: null)
        if 'worldview' not in updated_metadata:
            updated_metadata['worldview'] = None
            needs_update = True

        # Add missing chunk_type field (default: "book")
        if 'chunk_type' not in updated_metadata:
            updated_metadata['chunk_type'] = "book"  # Default for legacy items
            needs_update = True

        # Add missing chunk_index field
        if 'chunk_index' not in updated_metadata:
            # Try to extract from existing data or set to 0
            chunk_id = updated_metadata.get('chunk_id', '')
            # Extract index from chunk_id if it follows naming convention
            try:
                # Assuming format like "book#chunk_123" -> extract 123
                if 'chunk_' in chunk_id:
                    parts = chunk_id.split('chunk_')
                    if len(parts) > 1:
                        updated_metadata['chunk_index'] = int(parts[1].split('_')[0])
                    else:
                        updated_metadata['chunk_index'] = 0
                else:
                    updated_metadata['chunk_index'] = 0
            except (ValueError, IndexError):
                updated_metadata['chunk_index'] = 0
            needs_update = True

        # Rename chapter_level_1 to chapter
        if 'chapter_level_1' in updated_metadata and 'chapter' not in updated_metadata:
            updated_metadata['chapter'] = updated_metadata['chapter_level_1']
            # Optionally keep old field for backward compatibility
            needs_update = True

        # Compute content_hash if missing
        if 'content_hash' not in updated_metadata:
            # Reconstruct canonical content for hashing
            content = updated_metadata.get('text') or updated_metadata.get('summary') or ''
            if content:
                updated_metadata['content_hash'] = hashlib.sha256(content.encode('utf-8')).hexdigest()
                needs_update = True

        if needs_update:
            updated_items.append({
                'id': updated_metadata.get('chunk_id') or updated_metadata.get('augmentId'),
                'metadata': updated_metadata
            })
            migrated_count += 1

    # Batch update migrated items
    if updated_items:
        vector_store.collection.update(
            ids=[item['id'] for item in updated_items],
            metadatas=[item['metadata'] for item in updated_items]
        )

    return {
        'collection': collection_name,
        'total_items': len(all_items.get('metadatas', [])),
        'migrated_items': migrated_count,
        'migration_complete': True
    }
```

#### 10.2 Collection Management Scripts
**File:** `scripts/maintenance/migrate_collections.py`

```python
#!/usr/bin/env python3
"""
Migrate ChromaDB collections to support new metadata schema.
Run this after deploying the enhanced rag:upload system.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.local_vector_db import LocalVectorStoreManager

def migrate_all_collections():
    """Migrate all collections in the ChromaDB instance."""

    # Get list of all collections
    temp_store = LocalVectorStoreManager()
    collections = temp_store.chroma_client.list_collections()

    results = []
    for collection in collections:
        if collection.name.startswith('philosophical'):  # Target collections
            print(f"Migrating collection: {collection.name}")
            try:
                result = migrate_collection_metadata(collection.name)
                results.append(result)
                print(f"✅ Migrated {result['migrated_items']} items")
            except Exception as e:
                print(f"❌ Failed to migrate {collection.name}: {e}")
                results.append({
                    'collection': collection.name,
                    'error': str(e),
                    'migration_complete': False
                })

    return results

if __name__ == '__main__':
    results = migrate_all_collections()
    print(f"\nMigration Summary:")
    for result in results:
        status = "✅" if result.get('migration_complete') else "❌"
        print(f"{status} {result['collection']}: {result.get('migrated_items', 'failed')}")
```

## Implementation Priority

1. **CRITICAL**: API endpoint models and synchronization logic (UploadChunksRequest/Response updates)
2. **High**: DataSyncService implementation
3. **High**: Dry-run functionality integration
4. **High**: Enhanced metadata handling and content hashing
5. **Medium**: Query optimization for large datasets
6. **Medium**: CLI script enhancements
7. **Low**: Advanced diagnostics and monitoring
8. **Low**: Performance optimizations

## Dependencies

- **ragprep changes**: Must be implemented first for CLI interface
- **New metadata fields**: Requires coordinated rollout
- **Testing**: Comprehensive test coverage before production deployment

## Rollout Strategy

1. **Phase 1**: Core sync functionality (no breaking changes)
2. **Phase 2**: New metadata fields support
3. **Phase 3**: Dry-run and cleanup features
4. **Phase 4**: CLI enhancements and monitoring

## Success Criteria

- ✅ API endpoint accepts all required fields (dry_run, cleanup_obsolete, assistant_name)
- ✅ API endpoint returns enhanced response with sync metadata
- ✅ Dry-run accurately predicts all changes without executing them
- ✅ Synchronization preserves data integrity during updates
- ✅ Cleanup obsolete removes only intended items
- ✅ Performance scales with collection size (tested up to 100k items)
- ✅ Clear error messages and recovery options for all failure modes
- ✅ Comprehensive test coverage including dry-run scenarios
