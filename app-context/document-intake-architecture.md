# Document Intake Architecture

**Last Updated:** 2025-12-13  
**Status:** Production (Implemented)

---

## Overview

The document intake system is a **4-phase asynchronous pipeline** that processes uploaded documents from raw files to fully-indexed, searchable legal documents. The system is designed for **fire-and-forget** operation: upload returns immediately while processing happens in the background with real-time WebSocket progress updates.

---

## High-Level Flow

```
User Upload → HTTP Endpoint → Immediate Storage → Database Record → Background Pipeline
                                      ↓
                              [Phase 1: Extract]
                                      ↓
                              [Phase 2: Analyze]
                                      ↓
                              [Phase 3: Index]
                                      ↓
                              [Phase 4: Complete]
```

**Key Principle:** Each phase is **atomic** and **resumable**. If any phase fails, the document status is marked as `failed` and processing stops.

---

## Phase-by-Phase Breakdown

### Phase 0: Upload (Synchronous)

**Entry Point:** `POST /api/cases/:caseFileId/documents/upload`  
**File:** `src/webserver/routes/documentRoutes.ts` (lines 23-79)

**What Happens:**

1. **Multer receives file** → Temporarily stored in `uploads/` directory
2. **Validate case file exists** → Query `CaseFileRepository.findById(caseFileId)`
3. **Create originals directory** → `{workspace}/documents/originals/`
4. **Move file immediately** → `fs.renameSync(tempPath, originalsPath/filename)`
5. **Detect file type** → `detectFileType(filename)` → Returns `'pdf' | 'docx' | 'txt' | ...`
6. **Create database record** → `DocumentRepository.create()` with status `'pending'`
7. **Fire background extraction** → `textExtractor.extractDocument().catch(...)` (non-blocking)
8. **Return success immediately** → `{ success: true, documentId: "uuid" }`

**Database State After Upload:**
```sql
INSERT INTO case_documents (
  id, case_file_id, filename, folder_name, file_type,
  processing_status, has_text_extraction, has_metadata, rag_indexed,
  uploaded_at
) VALUES (
  'uuid', 'case-id', 'complaint.pdf', 'complaint_pdf', 'pdf',
  'pending', 0, 0, 0,
  1702468800000
);
```

**Filesystem State After Upload:**
```
~/.justicequest/case-name-timestamp/
└── documents/
    └── originals/
        └── complaint.pdf  ← File is HERE immediately
```

**Critical Detail:** The file is **moved** (not copied) from the temp upload directory to the originals folder **before** the database record is created. This ensures the file is safely stored even if the database write fails.

---

### Phase 1: Text Extraction (Asynchronous)

**Entry Point:** `TextExtractor.extractDocument()`  
**File:** `src/process/documents/services/TextExtractor.ts` (lines 27-79)

**What Happens:**

1. **Update status to `'extracting'`** → `DocumentRepository.updateStatus(documentId, 'extracting')`
2. **Emit WebSocket event** → `emitDocumentExtracting(documentId, caseFileId, filename)`
3. **Route to handler** → Based on file extension:
   - `.pdf` → Mistral OCR API (TODO: not yet implemented, returns placeholder)
   - `.txt`, `.md` → Read file directly
   - `.docx` → DOCX handler (TODO: not yet implemented)
4. **Extract text with page breaks** → Format: `--- Page 1 ---\nText...\n--- Page 2 ---\n...`
5. **Save extracted text** → `{workspace}/documents/extractions/{filename}.txt`
6. **Calculate metrics** → Count pages (by `--- Page X ---` markers) and words
7. **Update database** → Set `has_text_extraction=1`, `page_count`, `word_count`, status=`'analyzing'`

**Database State After Extraction:**
```sql
UPDATE case_documents SET
  processing_status = 'analyzing',
  has_text_extraction = 1,
  page_count = 15,
  word_count = 4523
WHERE id = 'uuid';
```

**Filesystem State After Extraction:**
```
~/.justicequest/case-name-timestamp/
└── documents/
    ├── originals/
    │   └── complaint.pdf
    └── extractions/
        └── complaint.txt  ← Extracted text saved HERE
```

**Error Handling:** If extraction fails, status is set to `'failed'` and `emitDocumentError()` is called. Processing stops.

---

### Phase 2: AI Analysis (Asynchronous)

**Entry Point:** `DocumentAnalyzer.analyzeDocument()`
**File:** `src/process/documents/services/DocumentAnalyzer.ts` (lines 40-95)

**What Happens:**

1. **Update status to `'analyzing'`** → `DocumentRepository.updateStatus(documentId, 'analyzing')`
2. **Emit WebSocket event** → `emitDocumentAnalyzing(documentId, caseFileId, filename)`
3. **Read extracted text** → Load from `{workspace}/documents/extractions/{filename}.txt`
4. **Build Gemini prompt** → Structured prompt requesting JSON metadata (see below)
5. **Call Gemini API** → `model.generateContent(prompt)` with retry logic (3 attempts, exponential backoff)
6. **Parse JSON response** → Extract structured metadata (document type, summary, entities, etc.)
7. **Save metadata JSON** → `{workspace}/documents/metadata/{folder_name}.json`
8. **Update database** → Set `has_metadata=1`, `document_type`, status=`'indexing'`

**Gemini Prompt Structure:**
```
You are a legal document analyzer. Analyze this document and return JSON with:
- document_type: "Complaint" | "Motion" | "Response" | "Order" | "Notice" | "Evidence" | "Research" | "Unknown"
- classification_confidence: 0.0 - 1.0
- summary: { executive_summary, main_arguments[], requested_relief }
- entities: { parties[], dates[], authorities[] }
- relevance_scores: { [claim_type]: score }
```

**Database State After Analysis:**
```sql
UPDATE case_documents SET
  processing_status = 'indexing',
  has_metadata = 1,
  document_type = 'Complaint'
WHERE id = 'uuid';
```

**Filesystem State After Analysis:**
```
~/.justicequest/case-name-timestamp/
└── documents/
    ├── originals/
    │   └── complaint.pdf
    ├── extractions/
    │   └── complaint.txt
    └── metadata/
        └── complaint_pdf.json  ← AI-generated metadata HERE
```

**Metadata JSON Example:**
```json
{
  "schema_version": "1.0",
  "document_id": "uuid",
  "original_filename": "complaint.pdf",
  "file_type": "pdf",
  "document_type": "Complaint",
  "classification_confidence": 0.95,
  "extraction": {
    "method": "mistral-ocr",
    "page_count": 15,
    "word_count": 4523,
    "extracted_at": "2025-12-13T10:30:00Z"
  },
  "summary": {
    "executive_summary": "Plaintiff alleges breach of contract...",
    "main_arguments": ["Defendant failed to deliver goods", "Damages exceed $50,000"],
    "requested_relief": "Compensatory damages and attorney fees"
  },
  "entities": {
    "parties": [
      { "name": "John Doe", "role": "Plaintiff", "mentions": 12 },
      { "name": "Acme Corp", "role": "Defendant", "mentions": 8 }
    ],
    "dates": [
      { "date": "2024-01-15", "context": "Contract signed", "page": 3 }
    ],
    "authorities": [
      { "citation": "Smith v. Jones, 123 F.3d 456", "context": "Breach of contract standard" }
    ]
  }
}
```

**Error Handling:** If Gemini API fails after 3 retries, status is set to `'failed'`. Processing stops.

---

### Phase 3: RAG Indexing (Asynchronous)

**Entry Point:** `FileSearchIndexer.indexDocument()`
**File:** `src/process/documents/services/FileSearchIndexer.ts` (lines 33-73)

**What Happens:**

1. **Update status to `'indexing'`** → `DocumentRepository.updateStatus(documentId, 'indexing')`
2. **Emit WebSocket event** → `emitDocumentIndexing(documentId, caseFileId, filename)`
3. **Get or create File Search store** → One store per case file (reused across documents)
4. **Upload to Gemini File Search** → Upload extracted text + metadata for RAG
5. **Get file URI** → Gemini returns URI like `files/{storeId}/{timestamp}`
6. **Update database** → Set `gemini_file_uri`, `rag_indexed=1`, `processed_at`, status=`'complete'`
7. **Emit completion event** → `emitDocumentComplete(documentId, caseFileId, filename)`

**Database State After Indexing:**
```sql
UPDATE case_documents SET
  processing_status = 'complete',
  rag_indexed = 1,
  gemini_file_uri = 'files/store-123/1702468900000',
  file_search_store_id = 'store-123',
  processed_at = 1702468900000
WHERE id = 'uuid';
```

**Final Filesystem State:**
```
~/.justicequest/case-name-timestamp/
└── documents/
    ├── originals/
    │   └── complaint.pdf
    ├── extractions/
    │   └── complaint.txt
    └── metadata/
        └── complaint_pdf.json
```

**Note:** No new files are created in Phase 3. The document is uploaded to Gemini's cloud storage for RAG queries.

**Error Handling:** If indexing fails, status is set to `'failed'`. The document can be manually re-indexed later.

---

## Processing Status State Machine

```
pending → extracting → analyzing → indexing → complete
   ↓          ↓            ↓           ↓
 failed ← failed ←──── failed ←─── failed
```

**Status Definitions:**
- `pending` (10%): Uploaded, waiting for extraction
- `extracting` (30%): Text extraction in progress
- `analyzing` (60%): AI analysis in progress
- `indexing` (85%): RAG indexing in progress
- `complete` (100%): Fully processed and searchable
- `failed` (0%): Processing failed at any stage

---

## Database Schema

**Table:** `case_documents`

```sql
CREATE TABLE case_documents (
  id TEXT PRIMARY KEY,                    -- UUID
  case_file_id TEXT NOT NULL,             -- Foreign key to case_files
  filename TEXT NOT NULL,                 -- Original filename
  folder_name TEXT NOT NULL,              -- Sanitized folder name
  document_type TEXT,                     -- AI-classified type
  file_type TEXT NOT NULL,                -- Extension (pdf, docx, etc.)
  page_count INTEGER,                     -- Number of pages
  word_count INTEGER,                     -- Total words
  processing_status TEXT NOT NULL,        -- Current status
  has_text_extraction INTEGER DEFAULT 0,  -- Boolean (0/1)
  has_metadata INTEGER DEFAULT 0,         -- Boolean (0/1)
  rag_indexed INTEGER DEFAULT 0,          -- Boolean (0/1)
  file_search_store_id TEXT,              -- Gemini store ID
  gemini_file_uri TEXT,                   -- Gemini file URI
  uploaded_at INTEGER NOT NULL,           -- Unix timestamp (ms)
  processed_at INTEGER,                   -- Unix timestamp (ms)
  FOREIGN KEY (case_file_id) REFERENCES case_files(id) ON DELETE CASCADE
);
```

---

## Real-Time Progress Updates (WebSocket)

**Architecture:** Event-driven pub/sub system

**Components:**
1. **WebSocketManager** (`src/webserver/websocket/WebSocketManager.ts`)
   - Manages client connections
   - Implements case file subscriptions
   - Routes events to subscribed clients

2. **Document Progress Emitter** (`src/webserver/websocket/documentProgress.ts`)
   - Provides helper functions: `emitDocumentExtracting()`, `emitDocumentAnalyzing()`, etc.
   - Emits events to `WebSocketManager.emitToCaseFile(caseFileId, event, data)`

3. **Frontend Hook** (`src/renderer/hooks/useWebSocketProgress.ts`)
   - Subscribes to case file updates
   - Listens for `document:progress` events
   - Updates UI in real-time

**Event Flow:**
```
TextExtractor.extractDocument()
    ↓
emitDocumentExtracting(documentId, caseFileId, filename)
    ↓
WebSocketManager.emitToCaseFile(caseFileId, 'document:progress', event)
    ↓
All clients subscribed to caseFileId receive event
    ↓
useWebSocketProgress hook calls onProgress(event)
    ↓
UI updates progress bar and status
```

**Event Structure:**
```typescript
{
  type: 'document:extracting',
  documentId: 'uuid',
  caseFileId: 'case-uuid',
  filename: 'complaint.pdf',
  progress: 30,
  message: 'Extracting text from: complaint.pdf',
  timestamp: 1702468800000
}
```

**Subscription Flow:**
1. User opens Upload Modal → `useWebSocketProgress` hook activates
2. Hook sends: `{ type: 'subscribe-case-file', caseFileId: 'case-uuid' }`
3. WebSocketManager adds client to subscription list
4. All future events for that case file are sent to this client
5. On unmount, hook sends: `{ type: 'unsubscribe-case-file', caseFileId: 'case-uuid' }`

---

## Code Architecture

### Service Layer (Process)

**Location:** `src/process/documents/services/`

1. **TextExtractor.ts** - Orchestrates text extraction
   - Routes to appropriate handler based on file type
   - Saves extracted text to filesystem
   - Updates database with extraction results

2. **DocumentAnalyzer.ts** - AI-powered metadata generation
   - Calls Gemini API with structured prompt
   - Parses JSON response
   - Saves metadata to filesystem

3. **FileSearchIndexer.ts** - RAG system integration
   - Uploads documents to Gemini File Search
   - Manages file search stores (one per case)
   - Updates database with indexing results

### Repository Layer (Data Access)

**Location:** `src/webserver/auth/repository/DocumentRepository.ts`

**Methods:**
- `create(doc)` - Insert new document record
- `findById(id)` - Get document by ID
- `findByCaseFileId(caseFileId)` - Get all documents for a case
- `updateStatus(id, status)` - Update processing status
- `updateProcessingFlags(id, flags)` - Update multiple fields atomically
- `delete(id)` - Delete document record
- `getStats(caseFileId)` - Get processing statistics

**Design Pattern:** Singleton repository with direct SQLite access via `getDatabase()`

### HTTP Routes (API Layer)

**Location:** `src/webserver/routes/documentRoutes.ts`

**Endpoints:**
- `POST /api/cases/:caseFileId/documents/upload` - Upload document
- `GET /api/cases/:caseFileId/documents` - List all documents for case
- `GET /api/documents/:documentId` - Get document details
- `GET /api/documents/:documentId/download` - Download original file
- `DELETE /api/documents/:documentId` - Delete document
- `GET /api/cases/:caseFileId/documents/stats` - Get processing stats

**Authentication:** All routes require JWT token via `AuthMiddleware.authenticateToken`

### Type Definitions

**Location:** `src/process/documents/types.ts`

**Key Types:**
- `ProcessingStatus` - Status enum
- `ICaseDocument` - Database entity
- `IDocumentMetadata` - AI-generated metadata structure
- `ICaseDocumentsManifest` - Aggregated case view

---

## Error Handling Strategy

### 1. Upload Errors (Synchronous)
- **File validation** → Return 400 Bad Request
- **Case not found** → Return 404 Not Found
- **Filesystem errors** → Return 500 Internal Server Error
- **Database errors** → Return 500 Internal Server Error

### 2. Processing Errors (Asynchronous)
- **Extraction fails** → Set status to `'failed'`, emit error event
- **Analysis fails** → Set status to `'failed'`, emit error event
- **Indexing fails** → Set status to `'failed'`, emit error event

### 3. Retry Logic
- **Gemini API calls** → 3 attempts with exponential backoff (2s, 4s, 8s)
- **No automatic retry** for failed documents (manual re-processing required)

### 4. Error Propagation
```
Service Layer (throws Error)
    ↓
Caught in try/catch
    ↓
DocumentRepository.updateStatus(id, 'failed')
    ↓
emitDocumentError(documentId, caseFileId, filename, errorMessage)
    ↓
WebSocket event sent to frontend
    ↓
UI shows error badge and message
```

---

## Performance Characteristics

### Upload Performance
- **File size limit:** 100MB (configurable via multer)
- **Upload time:** ~1-5 seconds for typical documents (depends on network)
- **Response time:** <100ms (returns immediately after database write)

### Processing Performance
- **Text extraction:** 2-10 seconds per document (depends on file type and size)
- **AI analysis:** 5-15 seconds per document (depends on Gemini API latency)
- **RAG indexing:** 3-8 seconds per document (depends on file size)
- **Total pipeline:** ~10-30 seconds per document

### Concurrency
- **Upload:** Handles multiple simultaneous uploads (Express default: unlimited)
- **Processing:** Sequential per document (no parallel processing within a document)
- **Multiple documents:** Process in parallel (each document has its own async pipeline)

### Database Performance
- **Queries:** All queries use indexed columns (`id`, `case_file_id`)
- **Writes:** Atomic updates with SQLite transactions
- **Locking:** SQLite handles concurrent reads/writes automatically

---

## Security Considerations

### 1. File Upload Security
- **File type validation** → Only allow whitelisted extensions
- **Filename sanitization** → Remove special characters, prevent path traversal
- **Size limits** → Enforce max file size (100MB default)
- **Virus scanning** → Not implemented (TODO: add ClamAV integration)

### 2. Authentication & Authorization
- **JWT tokens** → All API endpoints require valid token
- **Case ownership** → Verify user owns the case file before upload
- **Document access** → Only case owner can view/download documents

### 3. Data Privacy
- **Filesystem isolation** → Each case has separate workspace directory
- **Database isolation** → Foreign key constraints enforce case boundaries
- **API isolation** → No cross-case data leakage

### 4. External API Security
- **Gemini API key** → Stored in environment variable, never exposed to frontend
- **Mistral API key** → Stored in environment variable, never exposed to frontend
- **Rate limiting** → Not implemented (TODO: add rate limiting for API calls)

---

## Troubleshooting Guide

### Problem: Document stuck in "pending" status
**Cause:** Background extraction never started or crashed
**Solution:** Check server logs for errors, manually trigger re-processing

### Problem: Document stuck in "extracting" status
**Cause:** Text extraction failed but error wasn't caught
**Solution:** Check logs for extraction errors, verify file is readable

### Problem: Document stuck in "analyzing" status
**Cause:** Gemini API call failed or timed out
**Solution:** Check Gemini API key, verify network connectivity, check rate limits

### Problem: WebSocket progress not updating
**Cause:** WebSocket connection lost or not subscribed to case file
**Solution:** Refresh page to reconnect, check browser console for errors

### Problem: "Max payload size exceeded" WebSocket error
**Cause:** Trying to send large data (>100MB) through WebSocket
**Solution:** Increase `maxPayload` in WebSocketServer config or reduce message size

---

## Future Enhancements

### Short-Term (Next Sprint)
1. **Implement Mistral OCR handler** - Replace placeholder with real API integration
2. **Implement DOCX handler** - Add support for Word documents
3. **Add retry mechanism** - Allow manual re-processing of failed documents
4. **Add progress persistence** - Store progress in database for page refreshes

### Medium-Term (Next Quarter)
1. **Batch upload** - Support uploading multiple files at once
2. **Drag-and-drop folders** - Upload entire folder structures
3. **Document versioning** - Track document revisions
4. **OCR quality metrics** - Confidence scores for extracted text

### Long-Term (Next Year)
1. **Distributed processing** - Use job queue (Bull/BullMQ) for scalability
2. **Cloud storage** - Store files in S3 instead of local filesystem
3. **Advanced RAG** - Implement semantic chunking and hybrid search
4. **Document comparison** - Diff tool for comparing document versions

---

## Related Documentation

- **Database Schema:** `src/process/database/migrations.ts` (migration v11)
- **API Endpoints:** `src/webserver/routes/documentRoutes.ts`
- **Type Definitions:** `src/process/documents/types.ts`
- **WebSocket Protocol:** `src/webserver/websocket/WebSocketManager.ts`
- **Upload Modal UI:** `context-engine/specs/upload-case-files-modal/`

---

**Document Version:** 1.0
**Last Reviewed:** 2025-12-13
**Maintained By:** Development Team


