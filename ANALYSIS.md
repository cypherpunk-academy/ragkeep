# RAG Upload Command Analysis

## Overview

This document analyzes the current implementation of the `rag:upload` command across two systems:

1. **ragprep** - The calling side (CLI client)
2. **ragrun** - The called side (API server)

The `rag:upload` command uploads pre-chunked text data (chunks.jsonl) from ragprep to the ragrun vector database system for semantic search and retrieval.

## Architecture Overview

```
ragprep (CLI)                   ragrun (API Server)
├── rag:upload command          ├── /api/v1/rag/upload-chunks endpoint
├── FileService                 ├── LocalVectorStoreManager
├── Chunk filtering logic       ├── PersonalEmbeddingsService
└── HTTP client                 └── ChromaDB backend
```

## Data Flow

1. **Preparation**: CLI resolves book directory and assistant manifest
2. **Chunk Loading**: Reads `chunks.jsonl` or generates chunks if missing
3. **Filtering**: Applies chapter level or chunk ID filters if specified
4. **Upload**: Sends JSONL content to ragrun API endpoint
5. **Processing**: ragrun processes chunks in batches, generates embeddings, upserts to vector DB

---

## ragprep Side (Calling Side)

### Command Implementation

**Location**: `src/cli/commands/ragUpload/index.ts`

**Command Signature**:
```bash
rag:upload <book-dir> [--assistant <name>] [--batch-size <n>] [--filter <json>]
```

**Key Components**:

#### Command Options
- `book-dir`: Path to book directory (absolute or relative)
- `--assistant`: Assistant name for collection determination (optional, uses memory)
- `--batch-size`: Embedding/upsert batch size (default: 64)
- `--filter`: JSON filter for selective upload:
  - `{ "chapters": 1 }` - Upload only top-level chapters
  - `{ "chunkIds": ["id1", "id2"] }` - Upload specific chunks

#### Server Configuration
```typescript
function getServerBaseUrl(): string {
    const env = process.env.RAGRUN_BASE_URL;
    const base = env || 'http://localhost:8000/api/v1';
    return base.replace(/\/$/, '');
}
```

#### Chunk Filtering Logic

**Chapter Level Filtering**:
```typescript
function matchesChapterLevel(md: Record<string, unknown>, level: 1 | 2 | 3): boolean {
    if (level === 1) return typeof md['chapter_level_1'] === 'string' && !!md['chapter_level_1'];
    if (level === 2) return typeof md['chapter_level_2'] === 'string' && !!md['chapter_level_2'];
    if (level === 3) return typeof md['chapter_level_3'] === 'string' && !!md['chapter_level_3'];
    return true;
}
```

**Chunk ID Filtering**:
```typescript
const idSet = new Set(filter.chunkIds);
for (const ln of lines) {
    const obj = JSON.parse(ln) as { metadata?: Record<string, unknown> };
    const md = (obj?.metadata ?? {}) as Record<string, unknown>;
    const cid = md['chunk_id'];
    if (typeof cid === 'string' && idSet.has(cid)) selected.push(ln);
}
```

#### Auto-Generation of Missing Chunks

If `chunks.jsonl` is missing, the command automatically runs the full rag chunking pipeline:

1. Parse book structure
2. Plan chunks with default parameters
3. Build chunk boundaries
4. Persist artifacts
5. Use in-memory chunks for upload

**Default Chunking Parameters**:
```typescript
const params = {
    targetSize: 1500,
    minSize: 1000,
    maxSize: 2000,
    overlapRatio: 0.2,
};
```

#### Request Payload

**Endpoint**: `POST /api/v1/rag/upload-chunks`

**Request Body**:
```typescript
{
    chunks_jsonl_content: string,  // Full JSONL content as string
    collection_name: string,       // From assistant manifest
    batch_size: number            // Optional, defaults to 64
}
```

#### Error Handling

- **Network Errors**: Detects ECONNREFUSED, ENOTFOUND, timeout signatures
- **HTTP Errors**: Returns status code and response text
- **File Errors**: Generates chunks if missing, provides clear error messages
- **Filter Errors**: Validates JSON filter syntax

#### Dependencies

- `resolveBookDirInteractive()` - Book directory resolution with memory
- `resolveAssistantInteractive()` - Assistant selection with memory
- `FileService.readBookManifest()` - Book metadata reading
- `FileService.readAssistantManifest()` - Assistant configuration
- Full rag chunking pipeline imports when auto-generating chunks

---

## ragrun Side (Called Side)

### API Endpoint Implementation

**Location**: `app/api/endpoints/rag/upload_chunks.py`

**Endpoint**: `POST /api/v1/rag/upload-chunks`

### Request/Response Models

#### Request Model
```python
class UploadChunksRequest(BaseModel):
    chunks_jsonl_path: Optional[str] = None
    chunks_jsonl_content: Optional[str] = None
    collection_name: Optional[str] = None
    batch_size: int = 64
```

#### Response Model
```python
class UploadChunksResponse(BaseModel):
    success: bool
    total_lines: int
    processed: int
    upserted: int
    skipped: int
    errors: List[str]
    collection: str
    processing_time_ms: float
```

### Processing Flow

1. **Input Validation**: Requires either `chunks_jsonl_path` or `chunks_jsonl_content`
2. **Chunk Loading**: Reads file or uses provided content, splits into lines
3. **JSONL Parsing**: Parses each line as JSON, collects parsing errors
4. **Batch Processing**: Processes chunks in configurable batches
5. **Embedding Generation**: Calls personal-embeddings-service for embeddings
6. **Metadata Sanitization**: Converts complex types to JSON strings for ChromaDB
7. **Vector Upsert**: Stores vectors in ChromaDB collection
8. **Response Aggregation**: Returns comprehensive processing statistics

### Key Processing Details

#### JSONL Line Format
Each line must be a JSON object:
```json
{
    "text": "chunk content here...",
    "metadata": {
        "chunk_id": "unique_id",
        "book_id": "book_identifier",
        "author": "author_name",
        "chapter_level_1": "Chapter Title",
        "paragraph_numbers": [1, 2, 3],
        "content_length": 1534,
        "importance": 5,
        "created_at": "2024-08-15T12:34:56Z"
    }
}
```

#### Chunk ID Synthesis
If no `chunk_id` in metadata, generates: `f"chunk_{processed}_{len(vectors)}"`

#### Metadata Sanitization
```python
# Converts complex types to JSON strings for ChromaDB compatibility
for mk, mv in raw_metadata.items():
    if isinstance(mv, (str, int, float, bool)) or mv is None:
        metadata[mk] = mv
    elif isinstance(mv, (list, dict)):
        metadata[mk] = json.dumps(mv, ensure_ascii=False)
    else:
        metadata[mk] = str(mv)
```

#### Batch Processing Logic
```python
async def flush_batch():
    embeddings = await embeddings_service.get_embeddings(texts_batch, batch_size=request.batch_size)
    # Create vector objects with sanitized metadata
    # Upsert to ChromaDB collection
    vector_store.upsert_vectors(vectors)
```

#### Error Handling
- **Batch-level errors**: Continue processing with error collection
- **Individual line errors**: Skip malformed lines, collect error messages
- **Embedding service errors**: Mark batch as skipped, continue with next batch
- **Upsert errors**: Mark vectors as skipped, continue processing

### Dependencies

- `LocalVectorStoreManager` - ChromaDB wrapper
- `PersonalEmbeddingsService` - Embedding generation via microservice
- `strip_html_preserve_text()` - Text normalization
- `NORMALIZATION_VERSION` - Version tracking for embeddings

---

## Data Models and Types

### ragprep Types (TypeScript)

#### ChunkOutput
```typescript
type ChunkOutput = {
    text: string;
    metadata: {
        chunk_id: string;
        chunk_index: number;
        book_id: string;
        author: string;
        book_index: number;
        book_title: string;
        book_subtitle: string | null;
        chapter_level_1: string;
        chapter_level_2: string | null;
        chapter_level_3: string | null;
        paragraph_numbers: number[];
        paragraph_page: number | null;
        content_length: number;
        chunk_type: 'book' | 'secondary_book';
        created_at: string; // ISO
        importance: number; // 1-10
    };
};
```

#### UploadFilter
```typescript
type UploadFilter = {
    level?: 1 | 2 | 3;
    chapters?: 1 | 2 | 3; // alias of level
    chunkIds?: string[];
};
```

### ragrun Types (Python/Pydantic)

#### UploadChunksRequest
```python
class UploadChunksRequest(BaseModel):
    chunks_jsonl_path: Optional[str] = None
    chunks_jsonl_content: Optional[str] = None
    collection_name: Optional[str] = None
    batch_size: int = 64
```

#### UploadChunksResponse
```python
class UploadChunksResponse(BaseModel):
    success: bool
    total_lines: int
    processed: int
    upserted: int
    skipped: int
    errors: List[str]
    collection: str
    processing_time_ms: float
```

### Vector Storage Format

ChromaDB stores vectors with:
- **ID**: `chunk_id` from metadata
- **Values**: Embedding vector from personal-embeddings-service
- **Metadata**: Sanitized metadata (complex types as JSON strings)
- **Document**: Text content for search/retrieval

---

## Key Interfaces and Integration Points

### LocalVectorStoreManager (ragrun)

**Location**: `app/db/local_vector_db.py`

**Key Methods**:
- `upsert_vectors(vectors: List[Dict])` - Bulk vector insertion
- `query_vectors(query_vector, top_k, filter)` - Vector search
- `delete_by_filter(filter)` - Filtered deletion
- `count_by_filter(filter)` - Count matching vectors
- `_convert_filter_to_where(pinecone_filter)` - Filter conversion

### PersonalEmbeddingsService (ragrun)

**Location**: `app/db/local_vector_db.py`

**Interface**:
- `embed_documents(texts: List[str])` - Bulk text embedding
- `embed_query(text: str)` - Single query embedding
- Integrates with external embeddings microservice

### FileService (ragprep)

**Location**: `src/services/FileService.ts`

**Key Methods**:
- `readBookManifest(bookDir)` - Load book metadata
- `readAssistantManifest(assistantsRoot, assistantName)` - Load assistant config
- `getAssistantsRootDir()` - Path resolution

---

## Configuration and Environment

### ragprep Configuration
- `RAGRUN_BASE_URL` - API server URL (default: `http://localhost:8000/api/v1`)
- `RAGPREP_HTTP_*_TIMEOUT_MS` - Timeout configurations for large uploads

### ragrun Configuration
- `LOCAL_EMBEDDING_SERVICE_URL` - Embeddings microservice URL
- `LOCAL_VECTOR_DB_PATH` - ChromaDB persistence directory
- `EMBEDDINGS_DIMENSION` - Vector dimensionality
- `EMBEDDINGS_MODEL` - Model identifier for tracking

---

## Current Limitations and Issues

### Performance Considerations
- **Large Uploads**: No streaming support, loads entire JSONL into memory
- **Batch Size**: Fixed batch processing, no dynamic adjustment
- **Timeout Handling**: Large uploads may timeout without proper configuration

### Error Recovery
- **Partial Failures**: Batch-level error recovery, but no resumable uploads
- **Validation**: Limited client-side validation of chunk format

### Data Consistency
- **Metadata Sanitization**: Complex types converted to strings may lose structure
- **ID Conflicts**: No duplicate ID handling strategy

### Monitoring and Observability
- **Progress Tracking**: No real-time progress for long uploads
- **Metrics**: Limited performance metrics collection

---

## Enhancement Opportunities

### Short Term
1. **Streaming Upload**: Support for large files without full memory load
2. **Progress Indicators**: Real-time upload progress reporting
3. **Better Error Messages**: More specific error categorization
4. **Dry Run Support**: Preview what would be uploaded without actual upload

### Medium Term
1. **Resumable Uploads**: Continue interrupted uploads
2. **Concurrent Processing**: Parallel batch processing
3. **Data Validation**: Comprehensive chunk format validation
4. **Metrics Collection**: Detailed performance and usage metrics

### Long Term
1. **Advanced Filtering**: Support for complex query filters
2. **Incremental Updates**: Only upload changed chunks
3. **Data Versioning**: Track chunk versions and changes
4. **Multi-Collection Support**: Upload to multiple collections simultaneously

---

## Testing and Validation

### Current Test Coverage
- **ragprep**: CLI command testing, filter logic validation
- **ragrun**: API endpoint testing, error handling scenarios
- **Integration**: End-to-end upload workflows

### Recommended Additional Tests
- **Large File Handling**: Memory usage with large JSONL files
- **Network Resilience**: Connection interruption recovery
- **Data Integrity**: Chunk content validation after upload
- **Performance Benchmarks**: Upload speed vs file size analysis

---

## Migration and Compatibility

### Version Compatibility
- **Chunk Format**: Must match `ChunkOutput` schema
- **API Contract**: Request/response models are stable
- **Metadata Fields**: Extensible metadata with backward compatibility

### Future API Evolution
- **Version Headers**: API versioning for breaking changes
- **Feature Flags**: Gradual rollout of new features
- **Deprecation Notices**: Clear migration paths for deprecated features
