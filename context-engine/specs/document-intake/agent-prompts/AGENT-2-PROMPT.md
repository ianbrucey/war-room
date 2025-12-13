# Agent 2: HTTP Endpoints & Orchestration

## ⚠️ CRITICAL: Read Shared Context First

**BEFORE DOING ANYTHING ELSE**, read the shared context document:
```
context-engine/specs/document-intake/agent-prompts/SHARED-CONTEXT.md
```

This document explains:
- What AionUI is and how it works
- WebUI mode architecture
- Database patterns and repository pattern
- Express.js patterns (especially important for you)
- Code standards and conventions
- Development commands

**Do not proceed until you have read and understood the shared context.**

---

## Mission
Implement the HTTP API endpoints for document upload and the main text extraction orchestrator. Your work connects the WebUI to the document processing pipeline.

## Context Files to Load
**Load these files in order:**
1. `context-engine/specs/document-intake/agent-prompts/SHARED-CONTEXT.md` - **READ FIRST**
2. `context-engine/specs/document-intake/00-task-plan.md` - Complete architectural plan
3. `src/webserver/routes/caseFileRoutes.ts` - Existing route patterns
4. `src/webserver/middleware/authMiddleware.ts` - Authentication patterns
5. `src/process/documents/types.ts` - Interfaces (created by Agent 1)
6. `src/webserver/auth/repository/DocumentRepository.ts` - Repository (created by Agent 1)
7. `context-engine/specs/document-intake/references/process_intake.py` - Reference implementation

## Your Assigned Tickets

### **Ticket 3: HTTP Upload Endpoint** (Wave 2)
**File:** `src/webserver/routes/documentRoutes.ts` (NEW FILE)

**Requirements:**
- `POST /api/cases/:caseFileId/documents/upload` - Upload document
- `GET /api/cases/:caseFileId/documents` - List documents
- `GET /api/documents/:documentId` - Get document details
- `DELETE /api/documents/:documentId` - Delete document
- Use `multer` for file uploads
- Authenticate with `authMiddleware`
- Save files to `{workspace}/documents/originals/`

**Upload Flow:**
1. Validate file type (use Agent 1's `fileTypeDetector`)
2. Check file size (reject > 50MB)
3. Save to workspace
4. Create database record via `DocumentRepository`
5. Trigger extraction (call `TextExtractor.extractDocument()`)
6. Return document ID and status

**Acceptance Criteria:**
- Proper error handling (400, 401, 413, 500)
- File validation before processing
- Returns JSON responses
- Integrates with existing auth

---

### **Ticket 5: Text Extraction Orchestrator** (Wave 2)
**File:** `src/process/documents/services/TextExtractor.ts` (NEW FILE)

**Requirements:**
- Orchestrates extraction pipeline
- Routes to correct handler based on file type
- Manages processing status updates
- Emits WebSocket progress events

**Class Structure:**
```typescript
export class TextExtractor {
  constructor(
    private documentRepo: DocumentRepository,
    private mistralApiKey: string
  )
  
  async extractDocument(
    documentId: string,
    caseFileId: string,
    filePath: string
  ): Promise<void>
  
  private async routeToHandler(
    fileType: string,
    filePath: string
  ): Promise<string>
}
```

**Extraction Flow:**
1. Update status to `extracting`
2. Emit WebSocket event `document:extracting`
3. Route to handler (Mistral OCR, pdf-parse, plaintext)
4. Add page break markers: `--- Page X ---`
5. Save to `{workspace}/documents/extractions/{filename}.txt`
6. Update database: `has_text_extraction = 1`, `page_count`, `word_count`
7. Update status to `analyzing`
8. Trigger `DocumentAnalyzer.analyzeDocument()`

**Acceptance Criteria:**
- Handles all file types from task plan
- Proper error handling and rollback
- Updates database at each stage
- Emits progress events

---

### **Ticket 9: Manifest Generator Service** (Wave 3)
**File:** `src/process/documents/services/ManifestGenerator.ts` (NEW FILE)

**Requirements:**
- Generates `case-documents-manifest.json` from database
- Called after each document completes processing
- Writes to `{workspace}/documents/case-documents-manifest.json`

**Class Structure:**
```typescript
export class ManifestGenerator {
  constructor(private documentRepo: DocumentRepository)
  
  async generateManifest(caseFileId: string): Promise<void>
  
  private buildManifestEntry(doc: ICaseDocument): ManifestEntry
}
```

**Manifest Structure (from task plan):**
```json
{
  "case_id": "uuid",
  "generated_at": "ISO timestamp",
  "total_documents": 5,
  "documents": [
    {
      "id": "uuid",
      "filename": "complaint.pdf",
      "document_type": "complaint",
      "page_count": 15,
      "processing_status": "complete",
      "paths": {
        "original": "documents/originals/complaint.pdf",
        "extraction": "documents/extractions/complaint.txt",
        "metadata": "documents/metadata/complaint.json"
      }
    }
  ]
}
```

**Acceptance Criteria:**
- Queries all documents for case file
- Generates valid JSON
- Includes all required fields
- Atomic file write (write to temp, then rename)

---

### **Ticket 12: Error Handling & Retry Logic** (Wave 4)
**File:** `src/process/documents/utils/retryHandler.ts` (NEW FILE)

**Requirements:**
- Exponential backoff retry for API calls
- Circuit breaker for repeated failures
- Error classification (retryable vs fatal)

**Functions:**
```typescript
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T>

export function isRetryableError(error: Error): boolean

export class CircuitBreaker {
  constructor(options: CircuitBreakerOptions)
  async execute<T>(fn: () => Promise<T>): Promise<T>
}
```

**Retry Strategy:**
- Max 3 retries
- Delays: 1s, 2s, 4s (exponential backoff)
- Retryable errors: Network errors, 429, 500, 503
- Fatal errors: 400, 401, 403, 404

**Acceptance Criteria:**
- Wraps Mistral API calls
- Wraps Gemini API calls
- Logs retry attempts
- Updates document status on fatal error

---

### **Ticket 17: Integration Testing** (Wave 5)
**File:** `src/process/documents/__tests__/integration.test.ts` (NEW FILE)

**Requirements:**
- End-to-end test of document upload → extraction → analysis → indexing
- Uses test fixtures from `context-engine/specs/document-intake/references/`
- Mocks external APIs (Mistral, Gemini)
- Verifies database state at each stage

**Test Cases:**
1. Upload PDF → Extract with Mistral → Analyze with Gemini → Index in File Search
2. Upload plaintext → Extract directly → Analyze → Index
3. Upload unsupported file → Reject with 400
4. Upload file > 50MB → Reject with 413
5. API failure → Retry → Eventually succeed
6. API failure → Retry → Eventually fail → Mark as failed

**Acceptance Criteria:**
- All tests pass
- Uses Jest or similar framework
- Cleans up test data after run
- Can run in CI/CD pipeline

---

## Dependencies & Constraints

**Blocking Dependencies:**
- Agent 1 Ticket 2 (Interfaces) - Required for type definitions
- Agent 1 Ticket 4 (Repository) - Required for database access
- Agent 1 Ticket 8 (File Type Detector) - Required for upload validation

**You Enable:**
- Agent 3: Needs your `TextExtractor` to trigger handlers (Ticket 5)
- Agent 3: Needs your manifest generator for RAG indexing (Ticket 9)

**Standards to Follow:**
- Express.js route patterns from `caseFileRoutes.ts`
- Use `multer` for file uploads
- Authenticate all routes with `authMiddleware`
- Return JSON responses with proper status codes
- Use async/await, no callbacks
- Proper error handling with try/catch
- Logging with `console.log` (prefix with `[DocumentIntake]`)

**Environment:**
- Node.js/TypeScript backend
- Express.js web framework
- SQLite database (better-sqlite3)
- Mistral API for OCR
- Gemini SDK for summarization

---

## Deliverables Checklist

- [ ] `src/webserver/routes/documentRoutes.ts` - All HTTP endpoints
- [ ] `src/process/documents/services/TextExtractor.ts` - Extraction orchestrator
- [ ] `src/process/documents/services/ManifestGenerator.ts` - Manifest generation
- [ ] `src/process/documents/utils/retryHandler.ts` - Retry logic
- [ ] `src/process/documents/__tests__/integration.test.ts` - Integration tests
- [ ] All files compile without TypeScript errors
- [ ] All tests pass
- [ ] Routes registered in main Express app

---

## Success Criteria
Your work is complete when:
1. All 5 files created and compile successfully
2. Can upload document via HTTP POST
3. Document extraction pipeline runs end-to-end
4. Manifest generates correctly after processing
5. Retry logic handles API failures gracefully
6. Integration tests pass
7. Code follows AionUI patterns and standards

