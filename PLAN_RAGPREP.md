# RAG Upload Enhancement Plan

## Overview

This plan outlines enhancements to the `rag:upload` command to make assistants the central reference point for uploads, with support for different content types and organizational structures based on the assistant-manifest.yaml configuration.

## Current State Reference

See `ANALYSIS.md` for detailed analysis of the current rag:upload implementation across ragprep (CLI) and ragrun (API server).

## Key Changes

### 1. Metadata Schema Enhancements

#### New Metadata Fields
Add three new fields to the `ChunkOutput.metadata` schema:

- `worldview: string | null` - The worldview context (e.g., "Mathematismus", "Idealismus")
- `chunk_type: string` - Content type enumeration:
  - `"book"` - Primary book content
  - `"secondary_book"` - Secondary source content
  - `"chapter_summary"` - Chapter summaries
  - `"concept"` - Concept explanations
  - `"question"` - Questions
  - `"essay"` - Essays
  - `"quote"` - Quotes
  - `"example"` - Examples
  - `"explanation"` - Explanations
  - `"order"` - Instructions/orders
- `chunk_index: number` - Sequential index within the content source (replaces current `chunk_index` usage)

#### Field Renaming & Legacy Cleanup
- Rename `chapter_level_1` → `chapter` for simplicity.
- `chapter_level_2` and `chapter_level_3` are no longer part of the public schema; they are treated as **legacy-only**.
- Any remaining legacy fields should be **purged at the edge** of the upload pipeline:
  - When reading existing artifacts (old `chunks.jsonl` or other legacy formats), map:
    - `chapter = chapter_level_1` (if `chapter` is not already set)
  - Then **drop** `chapter_level_1`, `chapter_level_2`, `chapter_level_3` from the outgoing `ChunkOutput.metadata`.
  - New code MUST NOT introduce or rely on these legacy fields.

### 2. CLI Interface Changes

#### Command Signature Change
**Current:**
```bash
rag:upload <book-dir> [--assistant <name>] [--batch-size <n>] [--filter <json>]
```

**New:**
```bash
rag:upload <assistant> [--bookDir <path>] [--worldview <name>] [--filter <json>] [--batch-size <n>]
```

**Changes:**
- `<assistant>` becomes a required parameter (was optional)
- `<book-dir>` becomes `--bookDir` option (was required parameter)
- Assistant selection is now mandatory and central to the operation

#### New Options
- `--bookDir <path>`: Upload specific book directory (optional)
- `--worldview <name>`: Upload specific worldview content (optional)
- `--chunk-types <types>`: Comma-separated list of chunk types to upload (default: "book")

#### Enhanced Filtering
The `--filter` option supports multiple filter types:

- **Chapter Names**: `{"chapters": ["I DAS BEWUSSTE MENSCHLICHE HANDELN", "II DER GRUNDTRIEB ZUR WISSENSCHAFT"]}` - filter by specific chapter names from manifest
- **Chunk IDs**: `{"chunkIds": ["id1", "id2"]}` - filter by specific chunk IDs

### 3. Upload Modes

The command now supports different upload modes based on assistant manifest structure:

#### Mode 1: Default - Global Books
```bash
rag:upload sophia-von-einklang
```
- Uploads all books listed in the assistant's `books:` section
- Sets `chunk_type: "book"`
- `worldview: null` (global context)

#### Mode 2: Specific Book Directory
```bash
rag:upload sophia-von-einklang --bookDir /path/to/book
```
- Uploads specific book if it exists in the assistant manifest
- Validates book is defined in manifest (books, secondary-books, or worldview books)
- Sets appropriate `chunk_type` and `worldview` based on manifest location
- Error if book not found in manifest with guidance on how to add it

#### Mode 3: Worldview Content
```bash
rag:upload sophia-von-einklang --worldview Mathematismus
```
- Uploads all books under the specified worldview
- Sets `worldview: "Mathematismus"`
- Sets `chunk_type: "book"`

#### Mode 4: Filtered Upload (enhanced)
```bash
rag:upload sophia-von-einklang --filter '{"chapters": ["I DAS BEWUSSTE MENSCHLICHE HANDELN"]}'
```
- Filter by specific chapter names from assistant manifest

## Assistant Manifest Structure

The assistant-manifest.yaml defines the content organization:

```yaml
name: Sophia von Einklang
rag-collection: sophia-von-einklang
books: # Global books - chunk_type: "book", worldview: null
  - Rudolf_Steiner#Die_Philosophie_der_Freiheit#4
  - Rudolf_Steiner#Wahrheit_und_Wissenschaft#3

secondary-books: # Secondary sources - chunk_type: "secondary_book", worldview: null
  - Sigismund_von_Gleich#Die_Wahrheit_als_Gesamtumfang_aller_Weltansichten

worldviews:
  Mathematismus: # worldview: "Mathematismus"
    books: # chunk_type: "book"
      "Rudolf_Steiner#Die_Philosophie_der_Freiheit#4":
        chapters: [...]
        importance: 0.99
  Idealismus:
    books: [...]
```

## Implementation Plan

### Phase 1: Data Model Updates

#### 1.1 Update TypeScript Types (ragprep)
**File:** `src/types/ragSchemas.ts`

```typescript
export type ChunkOutput = {
    text: string;
    metadata: {
        chunk_id: string;
        chunk_index: number; // Sequential index within source
        book_id: string;
        author: string;
        book_index: number;
        book_title: string;
        book_subtitle: string | null;
        chapter: string; // renamed from chapter_level_1
        chapter_level_2?: string | null; // deprecated
        chapter_level_3?: string | null; // deprecated
        paragraph_numbers: number[];
        paragraph_page: number | null;
        content_length: number;
        chunk_type: ChunkType;
        worldview: string | null;
        created_at: string;
        importance: number;
    };
};

export type ChunkType =
    | 'book'
    | 'secondary_book'
    | 'chapter_summary'
    | 'concept'
    | 'question'
    | 'essay'
    | 'quote'
    | 'example'
    | 'explanation'
    | 'order';
```

#### 1.2 Update Python Types (ragrun)
**File:** `app/api/endpoints/rag/upload_chunks.py`

Update Pydantic models to include new metadata fields.

### Phase 2: CLI Interface Updates

#### 2.1 Command Registration
**File:** `src/cli/commands/ragUpload/index.ts`

```typescript
program
    .command('rag:upload')
    .description('Upload content to assistant collections with enhanced metadata and filtering')
    .argument('<assistant>', 'Assistant name (required)')
    .option('--bookDir <path>', 'Path to specific book directory')
    .option('--worldview <name>', 'Upload specific worldview content')
    .option('--chunk-types <types>', 'Comma-separated chunk types to upload (default: "book")')
    .option('--dry-run', 'Preview changes without executing them')
    .option('--cleanup-obsolete', 'Delete items no longer in source files')
    .option('--batch-size <n>', 'Embedding/upsert batch size (default: 64)')
    .option(
        '--filter <json>',
        'JSON filter: {"chapters": ["Chapter Name"]} for specific chapters, ' +
        '{"chunkIds": ["id1", "id2"]} for specific chunks'
    )
    .action(async (assistantName: string, opts: RagUploadOptions) => {
        // Implementation
    });
```

**Examples:**
```bash
# Upload all global books for assistant (default chunk-types: "book")
rag:upload sophia-von-einklang

# Upload specific book
rag:upload sophia-von-einklang --bookDir /path/to/book

# Upload Mathematismus worldview content
rag:upload sophia-von-einklang --worldview Mathematismus

# Upload only quotes and examples
rag:upload sophia-von-einklang --chunk-types "quote,example"

# Upload multiple chunk types
rag:upload sophia-von-einklang --chunk-types "book,concept,question"

# Upload all available chunk types
rag:upload sophia-von-einklang --chunk-types "book,secondary_book,chapter_summary,concept,question,essay,quote,example,explanation,order"


# Filter by specific chapter names
rag:upload sophia-von-einklang --filter '{"chapters": ["I DAS BEWUSSTE MENSCHLICHE HANDELN"]}'

# Filter by multiple chapter names
rag:upload sophia-von-einklang --filter '{"chapters": ["I DAS BEWUSSTE MENSCHLICHE HANDELN", "II DER GRUNDTRIEB ZUR WISSENSCHAFT"]}'

# Filter by specific chunk IDs
rag:upload sophia-von-einklang --filter '{"chunkIds": ["chunk_001", "chunk_002"]}'
```

#### 2.2 Upload Mode Logic
Implement upload mode detection and content selection:

```typescript
type UploadMode = 'global' | 'bookDir' | 'worldview';

function determineUploadMode(opts: RagUploadOptions): UploadMode {
    if (opts.worldview) return 'worldview';
    if (opts.bookDir) return 'bookDir';
    return 'global';
}

async function getContentToUpload(
    assistantName: string,
    mode: UploadMode,
    opts: RagUploadOptions
): Promise<ContentSelection> {
    const manifest = await loadAssistantManifest(assistantName);

    switch (mode) {
        case 'global':
            return getGlobalBooksContent(manifest);
        case 'bookDir':
            return getBookDirContent(manifest, opts.bookDir!);
        case 'worldview':
            return getWorldviewContent(manifest, opts.worldview!);
    }
}
```

#### 2.3 Enhanced Filtering Logic
Update the filter parsing and application logic to support chapter names:

```typescript
type RagUploadOptions = {
    bookDir?: string;
    worldview?: string;
    chunkTypes?: string; // comma-separated list, default "book"
    batchSize?: string;
    filter?: string; // JSON string
};

type UploadFilter = {
    chapters?: string[]; // array of chapter names from manifest
    chunkIds?: string[];
    chunkTypes?: ChunkType[]; // additional filter for chunk types
};

function matchesChapterFilter(
    md: Record<string, unknown>,
    chapters: string[]
): boolean {
    // Support chapter name filtering
    if (Array.isArray(chapters)) {
        const chapterName = md['chapter'] || md['chapter_level_1'];
        return typeof chapterName === 'string' && chapters.includes(chapterName);
    }

    return true;
}

function shouldIncludeChunk(
    chunk: any,
    filter: UploadFilter,
    allowedChunkTypes: ChunkType[]
): boolean {
    const md = chunk.metadata || {};

    // Check chunk type filter (from --chunk-types option)
    if (allowedChunkTypes.length > 0) {
        const chunkType = md['chunk_type'];
        if (!allowedChunkTypes.includes(chunkType)) {
            return false;
        }
    }

    // Check JSON filter options
    if (filter.chunkIds && Array.isArray(filter.chunkIds)) {
        const chunkId = md['chunk_id'];
        return typeof chunkId === 'string' && filter.chunkIds.includes(chunkId);
    }

    if (filter.chunkTypes && Array.isArray(filter.chunkTypes)) {
        const chunkType = md['chunk_type'];
        return typeof chunkType === 'string' && filter.chunkTypes.includes(chunkType);
    }

    if (filter.chapters !== undefined) {
        return matchesChapterFilter(md, filter.chapters);
    }

    return true; // No filter means include all
}

function parseChunkTypes(chunkTypesStr: string): ChunkType[] {
    if (!chunkTypesStr || chunkTypesStr.trim() === '') {
        return ['book']; // default
    }
    return chunkTypesStr.split(',').map((type: string) => type.trim()) as ChunkType[];
}
```

### Phase 3: Content Resolution Logic

#### 3.1 Assistant Manifest Loading
Create utility to load and validate assistant manifests:

```typescript
interface AssistantManifest {
    name: string;
    'rag-collection': string;
    books?: string[];
    'secondary-books'?: string[];
    worldviews?: Record<string, WorldviewConfig>;
}

interface WorldviewConfig {
    books?: Record<string, BookConfig>;
}

interface BookConfig {
    chapters?: string[];
    importance?: number;
}
```

#### 3.2 Content Selection Functions

**Global Books Mode:**
- Load all books from `manifest.books` and `manifest.secondary-books`
- Set appropriate `chunk_type` and `worldview: null`

**Book Directory Mode:**
- Validate book exists in manifest
- Determine location (books/secondary-books/worldviews/X/books)
- Set appropriate metadata

**Worldview Mode:**
- Load all books under specified worldview
- Set `worldview: worldviewName` and `chunk_type: "book"`

#### 3.3 Book Location Resolution
```typescript
function findBookInManifest(manifest: AssistantManifest, bookId: string): BookLocation | null {
    // Check global books
    if (manifest.books?.includes(bookId)) {
        return { type: 'global', chunkType: 'book', worldview: null };
    }

    // Check secondary books
    if (manifest['secondary-books']?.includes(bookId)) {
        return { type: 'secondary', chunkType: 'secondary_book', worldview: null };
    }

    // Check worldview books
    for (const [worldviewName, worldview] of Object.entries(manifest.worldviews || {})) {
        if (worldview.books && bookId in worldview.books) {
            return { type: 'worldview', chunkType: 'book', worldview: worldviewName };
        }
    }

    return null;
}
```

### Phase 4: Metadata Enhancement

#### 4.1 Chunk Generation Updates
Update chunk generation to include new metadata fields:

```typescript
function enhanceChunkMetadata(
    chunk: ChunkOutput,
    location: BookLocation,
    bookIndex: number
): ChunkOutput {
    return {
        ...chunk,
        metadata: {
            ...chunk.metadata,
            chunk_type: location.chunkType,
            worldview: location.worldview,
            chunk_index: bookIndex, // Sequential within book
            chapter: chunk.metadata.chapter_level_1, // Rename field
            chapter_level_1: undefined, // Remove old field
        }
    };
}
```

### Phase 5: Error Handling and Validation

#### 5.1 Book Validation
```typescript
async function validateBookInManifest(
    assistantName: string,
    bookDir: string
): Promise<BookLocation> {
    const bookId = basename(bookDir);
    const manifest = await loadAssistantManifest(assistantName);
    const location = findBookInManifest(manifest, bookId);

    if (!location) {
        const error = createBookNotFoundError(assistantName, bookId, manifest);
        throw error;
    }

    return location;
}

function createBookNotFoundError(
    assistantName: string,
    bookId: string,
    manifest: AssistantManifest
): Error {
    const availableBooks = [
        ...(manifest.books || []),
        ...(manifest['secondary-books'] || []),
        ...Object.values(manifest.worldviews || {})
            .flatMap(w => Object.keys(w.books || {}))
    ];

    return new Error(
        `Book "${bookId}" not found in assistant "${assistantName}" manifest.\\n` +
        `Available books: ${availableBooks.join(', ')}\\n` +
        `To add this book, edit assistants/${assistantName}/assistant-manifest.yaml`
    );
}
```

#### 5.2 Worldview Validation
```typescript
function validateWorldview(manifest: AssistantManifest, worldview: string): void {
    if (!manifest.worldviews?.[worldview]) {
        const available = Object.keys(manifest.worldviews || {});
        throw new Error(
            `Worldview "${worldview}" not found in assistant manifest.\\n` +
            `Available worldviews: ${available.join(', ')}`
        );
    }
}
```

### Phase 6: API Updates

#### 6.1 Request Model Updates
Update `UploadChunksRequest` to include new metadata fields support.

#### 6.2 Metadata Processing
Update metadata sanitization to handle new fields appropriately.

### Phase 7: Testing and Migration

#### 7.1 Feature Tests
- Assistant-centric upload modes
- New metadata fields
- Error handling for missing books/worldviews
- CLI interface changes

#### 7.2 Migration Path
- Create initial assistant manifests with new structure
- Set up test data and collections

## Benefits

1. **Assistant-Centric**: Assistants become the primary organizational unit
2. **Flexible Content Types**: Support for different content types beyond just books
3. **Worldview Organization**: Structured access to philosophical worldviews
4. **Enhanced Filtering**: Filter by specific chapter names from manifest or chunk types
5. **Selective Uploads**: `--chunk-types` option allows uploading specific content types (quotes, concepts, etc.)
6. **Better Metadata**: Richer metadata (worldview, chunk_type, chunk_index) for improved search
7. **Validation**: Manifest-driven validation prevents configuration errors
8. **Clean Implementation**: Modern design without legacy baggage

## Data Accuracy and Synchronization

### Challenge: Keeping Collections Current

When uploading content like chapter summaries, concepts, or quotes, the collection may contain:

- **New items**: Content not yet in the vector database
- **Modified items**: Same `chunk_id` but updated content/text
- **Unchanged items**: Identical content that doesn't need updating
- **Obsolete items**: Content in the database but no longer in the source file

The system must handle these scenarios intelligently to maintain data accuracy without creating duplicates or losing important information.

### Content Synchronization Strategy

#### 1. Unique Identifier Strategy (chunk_id Convention)
To keep ragprep and ragrun perfectly aligned, **all synchronization logic is based on `chunk_id`**, regardless of the original source format (books, summaries, other augmentations).

High-level convention:
- Every uploaded unit (book chunk, chapter summary, concept, quote, etc.) **must have a stable `chunk_id`**.
- `chunk_id` is the **single canonical identifier** used by:
  - `rag:upload` on ragprep
  - `DataSyncService` on ragrun
  - Vector DB entries in Chroma
- Source-specific IDs (e.g. `augmentId` in `chapters.jsonl`) are treated as **input fields**; ragprep’s upload pipeline is responsible for mapping them into a proper `chunk_id` before emitting `chunks.jsonl`.

Examples:
- **Book chunks**: `chunk_id` already comes from the chunking pipeline (e.g. `rs-pdf-4-chapter-01-001`).
- **Chapter summaries**: `chunk_id` is derived from summary metadata, e.g.:
  - `sophia-von-einklang/summaries/Sigismund_von_Gleich#Die_Wahrheit_als_Gesamtumfang_aller_Weltansichten/i-die-wahrheit-hat-viele-seiten`
- **Other augmentations**: Similar pattern: `<assistant>/<augmentKind>/<bookDir>/<localId>`

For raw summary artifacts like `chapters.jsonl` we keep `augmentId` as source metadata, but the **upload step must convert it to `chunk_id`** in the outgoing chunks.

```json
{
  "assistant": "sophia-von-einklang",
  "augmentKind": "summaries",
  "augmentId": "ee34bad6-df94-43b6-802d-f26322f6c46c",
  "chunk_id": "sophia-von-einklang/summaries/Sigismund_von_Gleich#Die_Wahrheit_als_Gesamtumfang_aller_Weltansichten/i-die-wahrheit-hat-viele-seiten",
  "chapterIndex": 1,
  "chapterId": "i-die-wahrheit-hat-viele-seiten",
  "summary": "...",
  "createdAt": "2025-11-07T07:35:54.660Z"
}
```

#### Canonical Content Fields for Hashing

For book chunks, canonical content is `text`; for summaries and other augmentations, canonical content is `summary`.

#### 2. Content Hashing for Change Detection (Client Hint)
Generate SHA-256 hashes of content on the ragprep side to detect modifications **locally** and drive better UX (e.g. skip obvious no-op uploads, show a meaningful dry-run). This hash is a **client hint**, not the source of truth in storage.

```typescript
function generateContentHash(content: string): string {
    return crypto.createHash('sha256')
        .update(content)
        .digest('hex');
}
```

#### 2.1 Hybrid Hashing Strategy (Single Source of Truth on ragrun)

- The **authoritative** `content_hash` is always computed and stored on the ragrun side from canonical fields (`summary`, `text`, etc.).
- ragprep may:
  - Compute a **client-side hash** (using the same algorithm) to:
    - Decide whether to treat an item as changed in the **local dry-run**.
    - Avoid uploading obviously unchanged content when possible.
  - Optionally send this hash to ragrun as a **hint field** (e.g. `client_hint_hash`), but ragrun is free to ignore it.
- ragrun will:
  - Always recompute its own `content_hash` from the received content.
  - Persist only the server-computed hash.

Implications for this plan:
- `generateContentHash` is used only for **local analysis and dry-run UI** in ragprep.
- The synchronization logic that compares `existing.content_hash !== sourceHash` should be interpreted as:
  - `existing.content_hash`: server-computed value fetched via API.
  - `sourceHash`: ragprep-computed hint used to categorize items before making requests.
- If we ever change the hashing rules, we change them **on ragrun** first; ragprep simply mirrors them as an optimization.

#### 3. Synchronization Algorithm

**Phase 1: Analysis**
- Load all items from source file (e.g., `chapters.jsonl`)
- Map any source-local IDs (e.g. `augmentId`) to a **stable `chunk_id`** for each item
- Query collection for existing items by `chunk_id`
- Compare content hashes to identify changes

**Phase 2: Categorization**
```typescript
type SyncAction = 'add' | 'update' | 'skip' | 'delete';

interface SyncItem {
    id: string;
    action: SyncAction;
    reason: string;
    existingHash?: string;
    newHash?: string;
}

function categorizeItems(sourceItems: any[], existingItems: any[]): SyncItem[] {
    const syncItems: SyncItem[] = [];

    // Check source items
    for (const sourceItem of sourceItems) {
        const sourceId = sourceItem.chunk_id; // unified ID across all types
        const existing = existingItems.find(e => e.id === sourceId);
        const sourceHash = generateContentHash(sourceItem.summary);

        if (!existing) {
            syncItems.push({
                id: sourceId,
                action: 'add',
                reason: 'New item not in collection'
            });
        } else if (existing.content_hash !== sourceHash) {
            syncItems.push({
                id: sourceId,
                action: 'update',
                reason: 'Content modified',
                existingHash: existing.content_hash,
                newHash: sourceHash
            });
        } else {
            syncItems.push({
                id: sourceId,
                action: 'skip',
                reason: 'Unchanged'
            });
        }
    }

    // Check for obsolete items
    for (const existing of existingItems) {
        const stillExists = sourceItems.some(s => s.chunk_id === existing.id);
        if (!stillExists) {
            syncItems.push({
                id: existing.id,
                action: 'delete',
                reason: 'No longer in source file'
            });
        }
    }

    return syncItems;
}
```

### Dry-Run Feature

#### Feasibility: Yes, Highly Recommended

A dry-run mode should be implemented to preview changes before execution:

#### CLI Enhancement
```bash
# Dry-run to see what would happen
rag:upload sophia-von-einklang --chunk-types "chapter_summary" --dry-run

# Force deletion of obsolete items
rag:upload sophia-von-einklang --chunk-types "chapter_summary" --cleanup-obsolete
```

#### Dry-Run Output:
```
🔍 DRY RUN: Analyzing chapter summaries for sophia-von-einklang

📊 Synchronization Summary:
├── 📥 Add: 5 new chapter summaries
├── 🔄 Update: 3 modified summaries
├── ⏭️  Skip: 12 unchanged summaries
└── 🗑️  Delete: 2 obsolete summaries

📋 Details:
├── New items:
│   ├── Chapter 1: "I. DIE WAHRHEIT HAT VIELE SEITEN"
│   ├── Chapter 2: "II. ÜBERBLICK ÜBER DEN GESAMTUMFANG"
│   └── ...
├── Modified items:
│   ├── Chapter 7: Content hash changed (old: a1b2c3..., new: d4e5f6...)
│   └── ...
└── Obsolete items:
    ├── Chapter 15: "XV. ALTE WELTANSCHAUUNG"
    └── Chapter 16: "XVI. VERGESSENE LEHRE"

⚠️  To apply these changes, run without --dry-run
⚠️  To delete obsolete items, add --cleanup-obsolete
```

#### Implementation Priority
- **High**: Dry-run functionality (prevents data loss)
- **High**: Change detection and categorization
- **Medium**: Obsolete item cleanup (with confirmation)
- **Low**: Advanced diff reporting

### Safety Considerations

#### Confirmation Requirements
- **Additions**: No confirmation needed (safe operation)
- **Updates**: Show diff preview, optional confirmation
- **Deletions**: Always require explicit `--cleanup-obsolete` flag

#### Backup Strategy
- Export collection state before bulk operations
- Provide rollback capability for accidental deletions

#### Error Handling
- **Partial Failures**: Continue processing other items
- **Rollback**: Ability to undo failed operations
- **Logging**: Comprehensive audit trail of all changes

### Performance Considerations

#### Batch Processing
- Process changes in configurable batches (default: 50)
- Parallel embedding generation for new/modified content
- Efficient querying for existence checks

#### Memory Management
- Stream processing for large source files
- Paginated collection queries to avoid memory spikes

## Migration Impact

- **Breaking Change**: CLI interface changes require user adaptation
- **Fresh Start**: No legacy data to migrate in alpha stage
- **New Structure**: Assistant manifests use modern worldview organization

## Implementation Priority

1. **High**: CLI interface and upload mode logic
2. **High**: Metadata schema updates (worldview, chunk_type, chunk_index)
3. **High**: --chunk-types option and filtering
4. **High**: Dry-run functionality and change detection
5. **High**: Data synchronization and obsolete item handling
6. **Medium**: Manifest validation and error handling
7. **Medium**: API updates for new metadata
8. **Low**: Advanced filtering with new metadata fields
