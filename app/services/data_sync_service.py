from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional, Iterable


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
    """Service responsible for analyzing changes between source items and existing vectors.

    It uses LocalVectorStoreManager helpers to:
    - Look up existing items by their canonical ID (chunk_id).
    - Compute server-side content hashes for incoming items.
    - Determine which items should be added, updated, skipped, or deleted.
    """

    def __init__(self, vector_store):
        self.vector_store = vector_store

    def analyze_changes(
        self,
        source_items: List[Dict[str, Any]],
        id_field: str = "chunk_id",
    ) -> List[SyncItem]:
        """Analyze what changes are needed between source and existing data."""
        sync_items: List[SyncItem] = []

        # Map of source_id -> source_item
        source_ids: List[str] = []
        for source_item in source_items:
            item_id = self._extract_id(source_item, id_field)
            if not item_id:
                continue
            source_ids.append(item_id)

        # Fetch existing items by IDs for fast ADD/UPDATE/SKIP decisions
        existing_items = self._get_existing_items_by_id(source_ids, id_field)

        # Analyze source items
        for source_item in source_items:
            item_id = self._extract_id(source_item, id_field)
            if not item_id:
                continue

            existing = existing_items.get(item_id)
            source_hash = self._calculate_item_hash(source_item)

            if not existing:
                sync_items.append(SyncItem(item_id, SyncAction.ADD, "New item"))
            else:
                existing_hash = existing.get("content_hash")
                if existing_hash != source_hash:
                    sync_item = SyncItem(item_id, SyncAction.UPDATE, "Content changed")
                    sync_item.existing_hash = existing_hash
                    sync_item.new_hash = source_hash
                    sync_items.append(sync_item)
                else:
                    sync_items.append(SyncItem(item_id, SyncAction.SKIP, "Unchanged"))

        # Detect obsolete items within the same logical group (e.g. same source/worldview)
        obsolete_ids = self._find_obsolete_ids(source_items, existing_items.keys(), id_field)
        for obsolete_id in obsolete_ids:
            sync_items.append(SyncItem(obsolete_id, SyncAction.DELETE, "Obsolete"))

        return sync_items

    def _extract_id(self, item: Dict[str, Any], id_field: str) -> Optional[str]:
        # Support both flattened and nested metadata structures
        if id_field in item and isinstance(item[id_field], str):
            return item[id_field]
        metadata = item.get("metadata", {})
        if isinstance(metadata, dict):
            value = metadata.get(id_field)
            if isinstance(value, str):
                return value
        return None

    def _get_existing_items_by_id(
        self,
        source_ids: Iterable[str],
        id_field: str,
    ) -> Dict[str, Dict[str, Any]]:
        """Query existing items by their IDs using the vector store helper."""
        ids_list = list(source_ids)
        if not ids_list:
            return {}
        # LocalVectorStoreManager.get_items_by_ids returns a mapping id -> {content_hash, metadata, document}
        return self.vector_store.get_items_by_ids(ids_list)

    def _calculate_item_hash(self, item: Dict[str, Any]) -> str:
        """Calculate hash for an item using the vector store's canonical hashing."""
        metadata = item.get("metadata", {}) or {}
        if not isinstance(metadata, dict):
            metadata = {}
        # Ensure content fields are present in metadata for hashing
        for field in ("text", "summary", "content"):
            if field in item and field not in metadata and isinstance(item[field], str):
                metadata[field] = item[field]
        return self.vector_store.get_content_hash(metadata)

    def _find_obsolete_ids(
        self,
        source_items: List[Dict[str, Any]],
        known_existing_ids: Iterable[str],
        id_field: str,
    ) -> List[str]:
        """Find IDs present in the collection but no longer in the source set.

        Strategy:
        - Build a metadata filter from the first source item's metadata (e.g. source_id/worldview/chunk_type)
          to limit the scope of cleanup.
        - Query a large batch of items matching that filter.
        - Any item ID in that batch that is not in the source_ids set is considered obsolete.
        """
        source_ids_set = {
            self._extract_id(item, id_field) for item in source_items if self._extract_id(item, id_field)
        }
        if not source_items or not source_ids_set:
            return []

        first_metadata = source_items[0].get("metadata", {}) or {}
        if not isinstance(first_metadata, dict):
            first_metadata = {}

        # Build a conservative filter to stay within the relevant logical group
        metadata_filter: Dict[str, Any] = {}
        # Prefer the new source_id field for logical grouping, but keep book_id for back-compat
        for key in ("source_id", "book_id", "worldview", "chunk_type", "assistant_name"):
            value = first_metadata.get(key)
            if isinstance(value, str) and value.strip():
                metadata_filter[key] = value

        # If we cannot build a meaningful filter, fall back to only using known_existing_ids
        if not metadata_filter:
            return [
                existing_id
                for existing_id in known_existing_ids
                if existing_id not in source_ids_set
            ]

        # Query a reasonably large number of items in the same group
        existing_group_items = self.vector_store.query_by_metadata_filter(metadata_filter, top_k=100_000)
        obsolete_ids: List[str] = []
        for item in existing_group_items:
            item_id = item.get("id")
            if not item_id:
                continue
            if item_id not in source_ids_set:
                obsolete_ids.append(item_id)

        return obsolete_ids



