# Document intake & Indexing System - Task Plan

## Executive Summary

Build a document intake and indexing system that processes legal documents into a structured format enabling AI agents to efficiently navigate, search, and draft legal documents.

**Key Architectural Decisions:**
- ✅ **Gemini SDK** (not CLI) for document processing
- ✅ **Mistral API** for OCR with pdf-parse fallback
- ✅ **Database + Filesystem** hybrid approach
- ✅ **HTTP upload endpoint** for WebUI integration

---

## 1. Reference Analysis

### 1.1 Patterns Worth Adopting from `process_intake.py`

| Pattern | Value | Adopt? |
|---------|-------|--------|
| **3-Phase Architecture** (Extract → Summarize → Synthesize) | Clear separation of concerns, resumable | ✅ Yes |
| **Multi-file Type Support** (PDF, DOCX, images, audio, etc.) | Comprehensive intake | ✅ Yes |
| **Parallel Processing** | Performance at scale | ✅ Yes (async) |
| **Centralized Extraction Folder** | Easy RAG ingestion | ✅ Yes |
| **Document Type Detection** (filename patterns) | Auto-classification | ✅ Yes |
| **Page Break Markers** (`--- Page X ---`) | Citation support | ✅ Yes |
| **Processing Log** | Debugging/audit trail | ✅ Yes |

### 1.2 Patterns to Modify

| Reference Pattern | Issue | Proposed Change |
|-------------------|-------|-----------------|
| Python/Gemini CLI | AionUI is TypeScript/Node | **Use Gemini SDK** (see decision below) |
| Mistral OCR API | Adds dependency | **Keep Mistral API** (proven quality) |
| Local file system only | WebUI needs upload | Add HTTP upload endpoint |
| `document_summary.json` structure | Missing agent-friendly metadata | Enrich with structured fields |
| No database tracking | Slow queries, no relationships | **Add `case_documents` table** |

### 1.3 Patterns to Skip

| Pattern | Reason |
|---------|--------|
| Exhibit extraction (Phase 1.5) | Complex, defer to v2 |
| Case summary synthesis (Phase 3) | Separate feature |
| Verification workflow | Separate feature |

### 1.4 Gemini CLI vs SDK Decision

**DECISION: Use Gemini SDK (not CLI)**

**Rationale:**

| Factor | Gemini CLI | Gemini SDK | Winner |
|--------|-----------|------------|--------|
| **File ingestion** | Built-in (point to path) | Requires Files API upload | CLI |
| **Integration** | Subprocess spawning | Native TypeScript | **SDK** |
| **Error handling** | Parse stdout/stderr | Structured exceptions | **SDK** |
| **Streaming** | Limited | Full support | **SDK** |
| **Structured output** | JSON parsing | Native types | **SDK** |
| **Existing codebase** | Not used | Already integrated | **SDK** |
| **Debugging** | Harder (subprocess) | Standard debugging | **SDK** |
| **Performance** | Process overhead | Direct API calls | **SDK** |

**Implementation approach:**
1. Use Gemini Files API (`ai.files.upload()`) to upload extracted text
2. Reference uploaded file in `generateContent()` call
3. Files auto-delete after 48 hours (acceptable for our use case)
4. Alternatively, pass text directly if under 20MB

**Code pattern:**
```typescript
// Upload file to Gemini Files API
const uploadedFile = await ai.files.upload({
  file: extractedTextPath,
  config: { mimeType: 'text/plain' }
});

// Use in prompt
const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: createUserContent([
    createPartFromUri(uploadedFile.uri, uploadedFile.mimeType),
    'Extract parties, dates, and key arguments from this legal document...'
  ])
});
```

---

## 2. Proposed Data Structures

### 2.1 Database Schema (`case_documents` table)

**Purpose:** Fast queries, relationships, integrity constraints

**Migration v11:** Add `case_documents` table

```sql
CREATE TABLE case_documents (
  id TEXT PRIMARY KEY,
  case_file_id TEXT NOT NULL,  -- FK to case_files.id (NOT case_id!)
  filename TEXT NOT NULL,
  folder_name TEXT NOT NULL,
  document_type TEXT,           -- Complaint, Motion, Evidence, etc.
  file_type TEXT NOT NULL,      -- pdf, docx, txt, etc.
  page_count INTEGER,
  word_count INTEGER,

  -- Processing status
  processing_status TEXT DEFAULT 'pending' CHECK(processing_status IN ('pending', 'extracting', 'analyzing', 'indexing', 'complete', 'failed')),
  has_text_extraction INTEGER DEFAULT 0,  -- SQLite boolean (0/1)
  has_metadata INTEGER DEFAULT 0,
  rag_indexed INTEGER DEFAULT 0,

  -- RAG
  file_search_store_id TEXT,
  gemini_file_uri TEXT,         -- URI from Files API upload

  -- Timestamps
  uploaded_at INTEGER NOT NULL,
  processed_at INTEGER,

  FOREIGN KEY (case_file_id) REFERENCES case_files(id) ON DELETE CASCADE
);

CREATE INDEX idx_case_documents_case_file_id ON case_documents(case_file_id);
CREATE INDEX idx_case_documents_status ON case_documents(processing_status);
CREATE INDEX idx_case_documents_type ON case_documents(document_type);
```

**TypeScript interface:**

```typescript
export interface ICaseDocument {
  id: string;
  case_file_id: string;  // Matches DB column name
  filename: string;
  folder_name: string;
  document_type?: string;
  file_type: string;
  page_count?: number;
  word_count?: number;
  processing_status: 'pending' | 'extracting' | 'analyzing' | 'indexing' | 'complete' | 'failed';
  has_text_extraction: boolean;
  has_metadata: boolean;
  rag_indexed: boolean;
  file_search_store_id?: string;
  gemini_file_uri?: string;
  uploaded_at: number;
  processed_at?: number;
}
```

### 2.2 Case Documents Manifest (`case-documents-manifest.json`)

**Purpose:** Generated view from database for agent consumption (not manually maintained)

**Generation strategy:** Query DB and aggregate metadata on-demand

```json
{
  "schema_version": "1.0",
  "case_file_id": "uuid",
  "last_updated": "2025-12-13T00:00:00Z",
  "document_count": 5,
  "documents": [
    {
      "id": "doc-uuid",
      "filename": "complaint.pdf",
      "folder_name": "complaint",
      "document_type": "Complaint",
      "relevance": {
        "breach_of_contract": "high",
        "negligence": "medium"
      },
      "key_parties": ["Ian Bruce", "Bank of America"],
      "important_dates": ["2024-05-13", "2025-06-17"],
      "page_count": 29,
      "has_text_extraction": true,
      "has_metadata": true,
      "rag_indexed": true,
      "processing_status": "complete",
      "added_at": "2025-12-13T00:00:00Z"
    }
  ],
  "parties_registry": {
    "Ian Bruce": { "role": "Petitioner", "documents": ["doc-uuid"] },
    "Bank of America": { "role": "Respondent", "documents": ["doc-uuid"] }
  },
  "timeline": [
    { "date": "2024-05-13", "event": "Angela Bruce passed away", "source_doc": "doc-uuid" }
  ],
  "claims": ["Breach of Trust", "Conversion", "Negligence"]
}
```

**Note:** This file is **generated** from the database, not the source of truth.

### 2.3 Document Metadata (`document-metadata.json`)

Purpose: Enriched per-document metadata for agent strategy and filtering.

```json
{
  "schema_version": "1.0",
  "document_id": "uuid",
  "original_filename": "complaint.pdf",
  "file_type": "pdf",
  "document_type": "Complaint",
  "classification_confidence": 0.95,
  
  "extraction": {
    "method": "pdf-parse",
    "page_count": 29,
    "word_count": 8500,
    "extracted_at": "2025-12-13T00:00:00Z"
  },
  
  "summary": {
    "executive_summary": "Ian Bruce, as successor trustee...",
    "main_arguments": ["Breach of Trust", "Conversion"],
    "requested_relief": "Order compelling release of trust funds..."
  },
  
  "entities": {
    "parties": [
      { "name": "Ian Bruce", "role": "Petitioner/Successor Trustee", "mentions": 47 },
      { "name": "Bank of America", "role": "Respondent", "mentions": 23 }
    ],
    "dates": [
      { "date": "2024-05-13", "context": "Angela Bruce passed away", "page": 3 }
    ],
    "authorities": [
      { "citation": "Cal. Probate Code § 17000", "context": "Trust administration" }
    ]
  },
  
  "relevance_scores": {
    "breach_of_contract": 0.9,
    "negligence": 0.7,
    "emotional_distress": 0.6
  },
  
  "relationships": {
    "references": ["exhibit-a-uuid"],
    "contradicts": [],
    "supports": []
  },
  
  "rag": {
    "file_search_store_id": "store-id",
    "indexed_at": "2025-12-13T00:00:00Z",
    "chunk_count": 45
  },
  
  "agent_notes": ""
}
```

---

## 3. Processing Pipeline

### 3.1 Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      DOCUMENT intake PIPELINE                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │  intake  │ -> │ EXTRACT  │ -> │ ANALYZE  │ -> │  INDEX   │  │
│  │  (Upload)│    │  (Text)  │    │  (AI)    │    │  (RAG)   │  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│       │              │               │               │          │
│       v              v               v               v          │
│  [intake/]     [extracted-    [document-      [Gemini File     │
│               text.txt]     metadata.json]   Search Store]     │
│                                     │                          │
│                                     v                          │
│                           [case-documents-manifest.json]       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Phase Details

#### Phase 1: intake (Upload)
- **Input**: Files uploaded via HTTP endpoint or drag-drop
- **Output**: Files moved to `documents/{doc-name}/original.{ext}`
- **Actions**:
  1. Validate file type (supported formats)
  2. Create document folder with sanitized name
  3. Move/copy original file
  4. Create initial manifest entry with `processing_status: "pending"`

#### Phase 2: Extract (Text)
- **Input**: Original file in document folder
- **Output**: `documents/{doc-name}/extracted-text.txt`
- **Actions**:
  1. Route to appropriate extractor (PDF, DOCX, images, etc.)
  2. Insert page break markers (`--- Page X ---`)
  3. Save extracted text
  4. Copy to centralized `full_text_extractions/` folder (for RAG)
  5. Update manifest: `has_text_extraction: true`

#### Phase 3: Analyze (AI Summary)
- **Input**: Extracted text
- **Output**: `documents/{doc-name}/document-metadata.json`
- **Actions**:
  1. Call LLM with document text + structured output prompt
  2. Extract: summary, parties, dates, arguments, authorities
  3. Classify document type
  4. Calculate relevance scores
  5. Update manifest with extracted metadata

#### Phase 4: Index (RAG)
- **Input**: Extracted text file
- **Output**: File indexed in Gemini File Search store
- **Actions**:
  1. Create/get File Search store for case
  2. Upload file with metadata (doc type, parties as custom metadata)
  3. Wait for indexing completion
  4. Update manifest: `rag_indexed: true`, store reference

### 3.3 Folder Structure

```
CaseWorkspace/
├── case-documents-manifest.json     # Master index
├── intake/                          # Drop zone for new files
│   └── (files waiting to be processed)
├── documents/
│   ├── complaint/
│   │   ├── original.pdf
│   │   ├── extracted-text.txt
│   │   └── document-metadata.json
│   ├── exhibit-a/
│   │   ├── original.pdf
│   │   ├── extracted-text.txt
│   │   └── document-metadata.json
│   └── ...
└── full_text_extractions/           # Flat folder for RAG
    ├── complaint.txt
    ├── exhibit-a.txt
    └── ...
```

---

## 4. Integration Points

### 4.1 Existing AionUI Infrastructure

| Component | Integration |
|-----------|-------------|
| `CaseFileRepository` | Get case workspace path |
| `caseRoutes.ts` | Add document intake endpoints |
| WebSocket (`WebSocketManager`) | Real-time progress updates |
| Gemini API (existing) | Document summarization |
| Google File Search API | RAG indexing (new) |
| Database migrations | Add migration v11 for `case_documents` |

### 4.2 New Components Required

| Component | Purpose |
|-----------|---------|
| `DocumentRepository` | CRUD operations for `case_documents` table |
| `DocumentintakeService` | Orchestrates pipeline |
| `TextExtractorService` | Multi-format text extraction |
| `MistralOCRService` | Mistral API integration |
| `DocumentAnalyzerService` | AI-powered metadata extraction |
| `FileSearchIndexerService` | Google File Search integration |
| `ManifestGeneratorService` | Generate manifest from DB |
| `documentRoutes.ts` | HTTP endpoints for upload/status |

### 4.3 Database-Filesystem Sync Strategy

**Challenge:** Keep database records and filesystem in sync

**Strategy:**

1. **Database is source of truth** for document metadata and status
2. **Filesystem is source of truth** for file content and extracted data
3. **Transactions ensure atomicity:**
   ```typescript
   // Upload flow
   db.transaction(() => {
     const doc = DocumentRepository.create(caseFileId, filename, fileType);
     fs.copyFileSync(uploadPath, documentPath);
     return doc;
   });
   ```

4. **Cleanup on delete:**
   ```typescript
   // Delete flow
   db.transaction(() => {
     const doc = DocumentRepository.findById(docId);
     DocumentRepository.delete(docId);
     fs.rmSync(doc.folderPath, { recursive: true });
   });
   ```

5. **Recovery from inconsistency:**
   - Orphaned DB records (no filesystem): Mark as 'failed', allow retry
   - Orphaned files (no DB record): Cleanup job removes files older than 7 days
   - Partial processing: Status field tracks progress, can resume

6. **Validation on startup:**
   - Optional: Scan workspace and reconcile with DB
   - Log warnings for inconsistencies
   - Provide admin endpoint to trigger reconciliation

---

## 5. Open Questions & Decisions

### 5.1 Decisions Made

| # | Question | Decision | Rationale |
|---|----------|----------|-----------|
| 1 | **Text extraction** | ✅ Mistral API primary, pdf-parse fallback | Proven quality from reference implementation |
| 2 | **AI Backend** | ✅ Gemini SDK with Files API | Better integration, error handling, existing codebase |
| 3 | **Data architecture** | ✅ Database + Filesystem hybrid | Fast queries, relationships, integrity |
| 4 | **File Search store scope** | ✅ One store per case | Isolation, easier cleanup |
| 5 | **Pipeline trigger** | ✅ Auto on upload | Better UX, less friction |
| 6 | **LLM for summarization** | ✅ Gemini 2.5 Flash | Cost/speed balance |

### 5.2 Final Decisions

| # | Question | Decision | Notes |
|---|----------|----------|-------|
| 1 | **Where to store File Search store ID** | ✅ Add `file_search_store_id` column to `case_files` table | Simpler, one store per case |
| 2 | **Handle large files** | ✅ **Reject files over 50MB or 1,000 pages** | Mistral OCR API limits: 50MB max file size, 1,000 pages max |
| 3 | **Gemini Files API cleanup** | ✅ **Let auto-delete (48 hours)** | Simpler, no manual cleanup needed. Files are temporary anyway |

### 5.3 Can Defer to Later

- Audio transcription (Whisper integration)
- Image OCR (Tesseract/Vision API)
- Batch processing UI
- Document versioning
- Exhibit detection and splitting
- DOCX/PPTX support (use Mistral or add libraries)

---

## 6. Differences from Reference Implementation

| Aspect | Reference (`process_intake.py`) | AionUI Implementation |
|--------|--------------------------------|----------------------|
| **Language** | Python | TypeScript/Node.js |
| **Execution** | CLI script | WebUI service with HTTP endpoints |
| **OCR** | Mistral API | **Mistral API** (same - proven quality) |
| **AI Backend** | Gemini CLI subprocess | **Gemini SDK** with Files API |
| **RAG** | Not included | Google File Search API |
| **Data Storage** | Filesystem only | **Database + Filesystem hybrid** |
| **Manifest** | Maintained JSON file | **Generated from DB** |
| **Metadata** | `document_summary.json` | `document-metadata.json` with entities, relevance |
| **Parallelism** | multiprocessing.Pool | async/await with Promise.all |
| **Progress** | Console logging | WebSocket real-time updates |
| **Phase 3** | Case summary synthesis | Deferred (separate feature) |

---

## 7. Task Breakdown

### Phase 1: Foundation (Tickets 1-5)

```
[ ] 1. Create database migration v11
    - Add case_documents table with correct FK (case_file_id)
    - Add indexes for performance
    - Update CURRENT_DB_VERSION to 11
    - Test migration up/down

[ ] 2. Define TypeScript interfaces
    - ICaseDocument (matches DB schema)
    - ICaseDocumentsManifest (generated view)
    - IDocumentMetadata (filesystem JSON)
    - IProcessingStatus enum

[ ] 3. Create DocumentRepository
    - create(caseFileId, filename, fileType)
    - findById(documentId)
    - findByCaseFileId(caseFileId)
    - updateStatus(documentId, status)
    - updateProcessingFields(documentId, fields)
    - delete(documentId)

[ ] 4. Create folder structure utilities
    - createDocumentFolder(workspacePath, folderName)
    - sanitizeFolderName(filename)
    - getCaseDocumentPaths(workspacePath) -> { intake, documents, extractions }
    - ensureFoldersExist(workspacePath)

[ ] 5. Add HTTP endpoints for document upload
    - POST /api/cases/:caseFileId/documents/upload (multipart/form-data)
    - GET /api/cases/:caseFileId/documents (list with status)
    - GET /api/cases/:caseFileId/documents/:docId (single doc details)
    - DELETE /api/cases/:caseFileId/documents/:docId
```

### Phase 2: Text Extraction (Tickets 6-9)

```
[ ] 6. Implement Mistral OCR integration
    - Create MistralOCRService
    - uploadDocument(filePath) -> extractedText
    - Handle API errors with retry logic
    - Insert page break markers (--- Page X ---)

[ ] 7. Implement pdf-parse fallback
    - Use pdf-parse library for simple PDFs
    - Fallback when Mistral unavailable or fails
    - Insert page break markers
    - Handle encrypted PDFs gracefully

[ ] 8. Implement plaintext file handling
    - Direct copy for .txt, .md
    - Encoding detection (UTF-8, Latin-1)

[ ] 9. Create TextExtractorService orchestrator
    - Route files by type (PDF -> Mistral, TXT -> direct)
    - Save to documents/{folder}/extracted-text.txt
    - Copy to full_text_extractions/{folder}.txt
    - Update DB: has_text_extraction = true, processing_status = 'analyzing'
```

### Phase 3: AI Analysis (Tickets 10-12)

```
[ ] 10. Design summarization prompt
    - Structured JSON output schema
    - Entity extraction (parties, dates, authorities)
    - Document type classification (Complaint, Motion, Evidence, etc.)
    - Relevance scoring by claim type
    - Main arguments and requested relief

[ ] 11. Implement DocumentAnalyzerService
    - Upload extracted text to Gemini Files API
    - Call generateContent with structured output prompt
    - Parse JSON response into IDocumentMetadata
    - Save to documents/{folder}/document-metadata.json
    - Update DB: has_metadata = true, document_type, page_count, word_count

[ ] 12. Implement manifest generation service
    - Query DB for all documents in case
    - Read metadata JSON files
    - Aggregate parties_registry from all docs
    - Build timeline from all dates
    - Aggregate claims list
    - Generate case-documents-manifest.json on-demand
```

### Phase 4: RAG Integration (Tickets 13-15)

```
[ ] 13. Implement FileSearchIndexerService
    - Create file search store per case (store in case_files table?)
    - Upload extracted text files with custom metadata
    - Custom metadata: document_type, parties (as JSON string)
    - Track indexing status in DB: rag_indexed = true, file_search_store_id
    - Update DB: processing_status = 'complete', processed_at = now

[ ] 14. Add metadata filtering support
    - Query with document_type filter
    - Query with party name filter
    - Return chunks with citations (page numbers)

[ ] 15. Integrate with agent tools (future)
    - Add "search case documents" tool to agent context
    - Return citations with responses
    - Link to original document for verification
```

### Phase 5: Polish (Tickets 16-18)

```
[ ] 16. Add WebSocket progress updates
    - Emit events for each pipeline stage
    - Event types: 'document:extracting', 'document:analyzing', 'document:indexing', 'document:complete'
    - Include progress percentage and current step
    - Frontend progress indicator

[ ] 17. Error handling and recovery
    - Partial failure handling (mark as 'failed' in DB)
    - Retry logic for API calls (exponential backoff)
    - Processing log file per document
    - Manual retry endpoint: POST /api/cases/:caseFileId/documents/:docId/retry

[ ] 18. Testing and documentation
    - Unit tests for each service
    - Integration test for full pipeline
    - Update domain context: document-intake-implementation.md
    - Add API documentation for endpoints
```

---

## 8. Acceptance Criteria

### Minimum Viable Feature

1. ✅ User can upload PDF/TXT files to a case
2. ✅ Files are automatically processed (text extracted)
3. ✅ AI generates document metadata with summary and key info
4. ✅ `case-documents-manifest.json` is updated automatically
5. ✅ Agent can query: "What documents do I have?" and get structured answer
6. ✅ Agent can search documents via RAG and get relevant chunks

### Success Metrics

- Processing time: <30s per document (PDF <50 pages)
- Extraction accuracy: >95% readable text extracted
- Metadata quality: All key fields populated for legal documents
- RAG relevance: Top-3 chunks contain answer >80% of time

---

## 9. Parallel Agent Execution Strategy

### 9.1 Dependency Graph

```
Phase 1 (Foundation)
├─ Ticket 1: Database Migration ← MUST BE FIRST (blocks all)
├─ Ticket 2: TypeScript Interfaces ← After migration
├─ Ticket 3: DocumentRepository ← After interfaces
├─ Ticket 4: Folder Utilities ← Independent (can run parallel with 3)
└─ Ticket 5: HTTP Endpoints ← After repository (3)

Phase 2 (Extraction)
├─ Ticket 6: Mistral OCR Service ← Independent (can start after Phase 1)
├─ Ticket 7: pdf-parse Fallback ← Independent (parallel with 6)
├─ Ticket 8: Plaintext Handler ← Independent (parallel with 6, 7)
└─ Ticket 9: TextExtractor Orchestrator ← After 6, 7, 8

Phase 3 (Analysis)
├─ Ticket 10: Summarization Prompt ← Independent (can start after Phase 1)
├─ Ticket 11: DocumentAnalyzer Service ← After 10
└─ Ticket 12: Manifest Generator ← After 11

Phase 4 (RAG)
├─ Ticket 13: FileSearch Indexer ← After Phase 1
├─ Ticket 14: Metadata Filtering ← After 13
└─ Ticket 15: Agent Tools Integration ← After 14

Phase 5 (Polish)
├─ Ticket 16: WebSocket Updates ← After Phase 2, 3, 4
├─ Ticket 17: Error Handling ← After Phase 2, 3, 4
└─ Ticket 18: Testing ← After all
```

### 9.2 Parallel Execution Waves

**Wave 1: Foundation (Sequential)**
- Agent 1: Ticket 1 (Migration) → MUST COMPLETE FIRST
- Agent 1: Ticket 2 (Interfaces) → After migration
- Agent 1: Ticket 3 (Repository) → After interfaces

**Wave 2: Foundation + Extraction Start (Parallel)**
- Agent 1: Ticket 4 (Folder Utilities)
- Agent 2: Ticket 5 (HTTP Endpoints) - needs Ticket 3 done
- Agent 3: Ticket 6 (Mistral OCR Service)
- Agent 4: Ticket 7 (pdf-parse Fallback)

**Wave 3: Extraction + Analysis Start (Parallel)**
- Agent 1: Ticket 8 (Plaintext Handler)
- Agent 2: Ticket 9 (TextExtractor Orchestrator) - needs 6, 7, 8 done
- Agent 3: Ticket 10 (Summarization Prompt)
- Agent 4: Ticket 13 (FileSearch Indexer)

**Wave 4: Analysis + RAG (Parallel)**
- Agent 1: Ticket 11 (DocumentAnalyzer Service) - needs Ticket 10
- Agent 2: Ticket 12 (Manifest Generator) - needs Ticket 11
- Agent 3: Ticket 14 (Metadata Filtering) - needs Ticket 13
- Agent 4: Ticket 15 (Agent Tools) - needs Ticket 14

**Wave 5: Polish (Parallel)**
- Agent 1: Ticket 16 (WebSocket Updates)
- Agent 2: Ticket 17 (Error Handling)
- Agent 3: Ticket 18 (Testing) - needs all done

### 9.3 Critical Path

**Longest dependency chain (blocks everything):**
```
Ticket 1 (Migration)
  → Ticket 2 (Interfaces)
  → Ticket 3 (Repository)
  → Ticket 5 (Endpoints)
  → Ticket 9 (Orchestrator)
  → Ticket 16 (WebSocket)
```

**Estimated critical path time:** 6 tickets × 3 hours = 18 hours

**With 4 parallel agents:** ~18-24 hours total (vs 54-72 hours sequential)

### 9.4 Agent Assignment Strategy

**Option A: By Phase (Ownership)**
- Agent 1: Phase 1 (Foundation) - 5 tickets
- Agent 2: Phase 2 (Extraction) - 4 tickets
- Agent 3: Phase 3 (Analysis) - 3 tickets
- Agent 4: Phase 4 (RAG) - 3 tickets
- All: Phase 5 (Polish) - 3 tickets

**Option B: By Wave (Parallel)**
- Follow Wave 1-5 strategy above
- Agents pick up next available ticket in wave
- Better load balancing

**Recommendation: Option B (Wave-based)** - Faster completion, better parallelism

## 10. Implementation Order

**Sequential fallback (single agent):**

1. **Phase 1 (Foundation)** - Database, interfaces, repository, endpoints
2. **Phase 2 (Extraction)** - Mistral OCR, pdf-parse fallback, text extraction
3. **Phase 3 (Analysis)** - Gemini summarization, metadata generation, manifest
4. **Phase 4 (RAG)** - File Search indexing, metadata filtering
5. **Phase 5 (Polish)** - WebSocket updates, error handling, testing

**Estimated effort:**
- Sequential: 18 tickets × 3 hours = 54 hours (1.5 weeks)
- Parallel (4 agents): ~18-24 hours (2-3 days)

---

## 11. Next Steps

1. ✅ **Review this plan** - Architectural decisions confirmed
2. ✅ **File Search store location** - Add column to `case_files` table
3. ⏳ **Research Mistral API limits** - Check file size constraints
4. ⏳ **Decide Gemini Files cleanup** - Auto-delete (48hrs) vs manual
5. ⏳ **Choose execution strategy** - Sequential vs Parallel (Wave-based recommended)
6. ⏳ **Begin implementation** - Start with Wave 1 (Ticket 1: Migration)

---

## 12. Quick Start Commands

### For Sequential Execution (Single Agent):
```bash
# Start with Phase 1, Ticket 1
# Agent will work through tickets 1-18 in order
```

### For Parallel Execution (Multiple Agents):
```bash
# Agent 1: Start Wave 1 (Ticket 1 - MUST COMPLETE FIRST)
# After Ticket 1 completes:
#   Agent 1: Ticket 2, 3
#   Agent 2: Ticket 4
#   Agent 3: Ticket 6
#   Agent 4: Ticket 7
# Continue with Wave 2-5 as dependencies complete
```

### Context Files to Load:
- `context-engine/specs/document-intake/00-task-plan.md` (this file)
- `context-engine/specs/document-intake/references/process_intake.py`
- `context-engine/specs/document-intake/references/document_summary.json`
- `src/process/database/schema.ts`
- `src/process/database/migrations.ts`
- `src/webserver/auth/repository/CaseFileRepository.ts` (pattern reference)

