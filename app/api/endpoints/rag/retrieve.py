from fastapi import APIRouter, Depends, HTTPException
import json
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import logging

from app.api.deps import get_optional_user
from app.models.user import User
from app.db.local_vector_db import LocalVectorStoreManager, PersonalEmbeddingsService
from app.models.chunks import ChunkType


logger = logging.getLogger(__name__)

router = APIRouter()


class RetrieveFilters(BaseModel):
    book_ids: Optional[List[str]] = None
    authors: Optional[List[str]] = None
    chapters: Optional[List[str]] = None  # Accept str or number as string for v0


class RetrieveRequest(BaseModel):
    prompt: str = Field(..., description="User prompt to retrieve relevant chunks for")
    retrieve: Optional[Dict[str, Any]] = None  # { k?: number, chunk_type?: 'book' }
    filters: Optional[RetrieveFilters] = None
    collection_name: Optional[str] = None  # Vector collection to use


class RetrievedChunk(BaseModel):
    id: str
    parent_id: Optional[str] = None
    title: Optional[str] = None
    chapter: Optional[str] = None
    # Added richer metadata for better prompt context formatting
    chapter_title: Optional[str] = None
    paragraph_numbers: Optional[List[int]] = None
    score: float
    text: str


class RetrieveResponse(BaseModel):
    retrieved: List[RetrievedChunk]
    used_filters: Dict[str, Any]


@router.post("/retrieve", response_model=RetrieveResponse)
async def retrieve_chunks(
    request: RetrieveRequest,
    current_user: Optional[User] = Depends(get_optional_user)
):
    """Return top-k book chunks for the given prompt (retrieval-only)."""
    try:
        k = 10
        if request.retrieve and isinstance(request.retrieve.get("k"), int):
            k = max(1, min(50, request.retrieve["k"]))

        # Enforce chunk_type=book for v0, using the new ChunkType enum
        pinecone_filter: Dict[str, Any] = {"chunk_type": ChunkType.BOOK.value}

        if request.filters:
            if request.filters.book_ids:
                # Map existing book_ids filter to the new source_id field
                pinecone_filter["source_id"] = {"$in": request.filters.book_ids}
            if request.filters.authors:
                pinecone_filter["author"] = {"$in": request.filters.authors}
            if request.filters.chapters:
                pinecone_filter["chapter"] = {"$in": request.filters.chapters}

        # Initialize services
        collection_name = request.collection_name or "philosophical_768"
        vector_store = LocalVectorStoreManager(collection_name=collection_name)
        embeddings_service = PersonalEmbeddingsService()

        # Embed query
        query_embedding = embeddings_service.embed_query(request.prompt)

        # Query vector store
        result = vector_store.query_vectors(query_vector=query_embedding, top_k=k, filter=pinecone_filter)
        matches = result.get("matches", [])

        retrieved: List[RetrievedChunk] = []
        for m in matches:
            md = m.get("metadata", {}) or {}

            # Prefer segment_title as the chapter title when using the new schema,
            # falling back to the legacy chapter_level_* fields.
            chapter_title: Optional[str] = (
                md.get("segment_title")
                or md.get("chapter_level_3")
                or md.get("chapter_level_2")
                or md.get("chapter_level_1")
            )

            # Normalize paragraph_numbers to a list[int]
            paragraph_numbers_raw = md.get("paragraph_numbers")
            paragraph_numbers: Optional[List[int]] = None
            if isinstance(paragraph_numbers_raw, list):
                try:
                    paragraph_numbers = [int(x) for x in paragraph_numbers_raw]
                except Exception:
                    paragraph_numbers = None
            elif isinstance(paragraph_numbers_raw, int):
                paragraph_numbers = [paragraph_numbers_raw]
            elif isinstance(paragraph_numbers_raw, str):
                s = paragraph_numbers_raw.strip()
                try:
                    loaded = json.loads(s)
                    if isinstance(loaded, list):
                        paragraph_numbers = [int(x) for x in loaded]
                    elif isinstance(loaded, int):
                        paragraph_numbers = [loaded]
                except Exception:
                    # Fallback: split by comma
                    try:
                        parts = [p.strip() for p in s.strip("[]").split(",") if p.strip()]
                        if parts:
                            paragraph_numbers = [int(p) for p in parts]
                    except Exception:
                        paragraph_numbers = None

            # Prefer explicit HTML field when present
            text_for_display = md.get("text_html") or md.get("text") or ""

            # Adjust score by importance (linear factor importance/5)
            raw_score = float(m.get("score", 0.0))
            imp_raw = md.get("importance", 5)
            try:
                imp_i = int(imp_raw)
            except Exception:
                imp_i = 5
            imp_i = max(1, min(10, imp_i))
            adjusted_score = raw_score * (imp_i / 5.0)

            retrieved.append(
                RetrievedChunk(
                    id=m.get("id", ""),
                    parent_id=md.get("parent_id") or md.get("source_id") or md.get("book_id") or md.get("document_id"),
                    title=md.get("segment_title")
                    or md.get("source_title")
                    or md.get("book_title")
                    or md.get("title"),
                    chapter=str(md.get("chapter")) if md.get("chapter") is not None else None,
                    chapter_title=chapter_title,
                    paragraph_numbers=paragraph_numbers,
                    score=adjusted_score,
                    text=text_for_display,
                )
            )

        used_filters = {"k": k, **pinecone_filter}
        return RetrieveResponse(retrieved=retrieved, used_filters=used_filters)

    except Exception as e:
        logger.error(f"/rag/retrieve failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Retrieve failed: {str(e)}")



