#!/usr/bin/env python3
"""
Sanity checks for the new ChunkMetadata schema and enum handling.

This script is intended for manual execution during development:
    python -m scripts.testing.test_chunk_metadata_schema
"""

import logging

from app.models.chunks import ChunkMetadata, ChunkType, Worldview, Importance


logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


def build_sample_metadata() -> ChunkMetadata:
    """Build a sample ChunkMetadata instance mirroring the TS model."""
    sample = {
        "author": "Test Author",
        "source_id": "Test_Author#Test_Source#1",
        "source_title": "Test Source Title",
        "source_index": 1,
        "segment_id": "segment-1",
        "segment_title": "Einleitung",
        "segment_index": 1,
        "parent_id": None,
        "chunk_id": "chunk-1",
        "chunk_type": "book",
        "worldview": "idealismus",
        "importance": 2,
    }
    md = ChunkMetadata(**sample)
    return md


def main():
    md = build_sample_metadata()
    logger.info("ChunkMetadata instance created successfully:")
    logger.info(md)

    chroma_md = md.to_chromadb_metadata()
    logger.info("Chroma-compatible metadata:")
    logger.info(chroma_md)

    assert chroma_md["chunk_type"] == ChunkType.BOOK.value
    assert chroma_md["importance"] == int(Importance.NORMAL)
    assert chroma_md["worldview"] == Worldview.IDEALISMUS.value

    print("✅ ChunkMetadata schema sanity check passed.")


if __name__ == "__main__":
    main()


