# Agent 1: Foundation & Core Services

## ⚠️ CRITICAL: Read Shared Context First

**BEFORE DOING ANYTHING ELSE**, read the shared context document:
```
context-engine/specs/document-intake/agent-prompts/SHARED-CONTEXT.md
```

This document explains:
- What AionUI is and how it works
- WebUI mode architecture
- Database patterns and repository pattern
- Express.js patterns
- Code standards and conventions
- Development commands

**Do not proceed until you have read and understood the shared context.**

---

## Mission
Implement the foundational infrastructure for document intake: TypeScript interfaces, database repository, and core utility functions. Your work enables the other agents to build extraction and analysis services.

## Context Files to Load
**Load these files in order:**
1. `context-engine/specs/document-intake/agent-prompts/SHARED-CONTEXT.md` - **READ FIRST**
2. `context-engine/specs/document-intake/00-task-plan.md` - Complete architectural plan
3. `src/process/database/types.ts` - Existing database type patterns
4. `src/webserver/auth/repository/CaseFileRepository.ts` - Repository pattern reference
5. `src/process/database/migrations.ts` - Migration v11 (already created)
6. `context-engine/specs/document-intake/references/process_intake.py` - Reference implementation

## Your Assigned Tickets

### **Ticket 2: TypeScript Interfaces** (Wave 2)
**File:** `src/process/documents/types.ts` (NEW FILE)

**Requirements:**
- Create `ICaseDocument` interface matching migration v11 schema
- Create `IDocumentMetadata` interface matching `references/document_summary.json`
- Create `ProcessingStatus` type union
- Create `DocumentType` type union
- Follow patterns from `src/process/database/types.ts`

**Acceptance Criteria:**
- All fields from migration v11 represented
- Proper TypeScript types (no `any`)
- JSDoc comments on all interfaces
- Exports all types

---

### **Ticket 4: Document Repository** (Wave 2)
**File:** `src/webserver/auth/repository/DocumentRepository.ts` (NEW FILE)

**Requirements:**
- Follow `CaseFileRepository.ts` pattern exactly
- Implement CRUD operations for `case_documents` table
- Methods needed:
  - `create(doc: Omit<ICaseDocument, 'id'>): ICaseDocument`
  - `findById(id: string): ICaseDocument | null`
  - `findByCaseFileId(caseFileId: string): ICaseDocument[]`
  - `updateStatus(id: string, status: ProcessingStatus): void`
  - `updateProcessingFlags(id: string, flags: Partial<ICaseDocument>): void`
  - `delete(id: string): void`

**Acceptance Criteria:**
- Uses `better-sqlite3` prepared statements
- Proper error handling
- Returns typed results
- Transaction support where needed

---

### **Ticket 8: File Type Detection Utility** (Wave 3)
**File:** `src/process/documents/utils/fileTypeDetector.ts` (NEW FILE)

**Requirements:**
- Detect file type from extension and MIME type
- Map to `DocumentType` enum
- Support: PDF, DOCX, images (JPG, PNG), audio (MP3, WAV, M4A)
- Use `file-type` npm package for MIME detection

**Functions:**
```typescript
export function detectFileType(filePath: string): Promise<string>
export function getDocumentType(fileType: string): DocumentType
export function isSupportedFileType(fileType: string): boolean
```

**Acceptance Criteria:**
- Handles all file types from reference implementation
- Graceful fallback for unknown types
- Proper error messages

---

### **Ticket 11: Document Analyzer Service** (Wave 4)
**File:** `src/process/documents/services/DocumentAnalyzer.ts` (NEW FILE)

**Requirements:**
- Orchestrates Gemini SDK summarization
- Reads extracted text from `{workspace}/documents/extractions/{filename}.txt`
- Calls Gemini with summarization prompt (from Ticket 10)
- Writes metadata JSON to `{workspace}/documents/metadata/{filename}.json`
- Updates database record with `has_metadata = 1`

**Class Structure:**
```typescript
export class DocumentAnalyzer {
  constructor(private geminiApiKey: string)
  
  async analyzeDocument(
    documentId: string,
    caseFileId: string,
    extractedTextPath: string
  ): Promise<IDocumentMetadata>
}
```

**Acceptance Criteria:**
- Uses Gemini SDK (not CLI)
- Proper error handling and retries
- Updates database via `DocumentRepository`
- Logs progress

---

### **Ticket 16: WebSocket Progress Updates** (Wave 5)
**File:** `src/webserver/websocket/documentProgress.ts` (NEW FILE)

**Requirements:**
- Emit progress events during document processing
- Events: `document:upload`, `document:extracting`, `document:analyzing`, `document:indexing`, `document:complete`, `document:error`
- Integrate with existing WebSocket infrastructure

**Event Structure:**
```typescript
interface DocumentProgressEvent {
  type: 'document:upload' | 'document:extracting' | ...
  documentId: string
  caseFileId: string
  filename: string
  progress: number // 0-100
  message: string
  error?: string
}
```

**Acceptance Criteria:**
- Works with existing WebSocket setup
- Emits to correct case file room
- Includes all processing stages

---

## Dependencies & Constraints

**Blocking Dependencies:**
- Ticket 1 (Migration v11) - ✅ COMPLETE
- No other blocking dependencies for your tickets

**You Enable:**
- Agent 2: Needs your interfaces and repository (Tickets 2, 4)
- Agent 3: Needs your file type detector (Ticket 8)

**Standards to Follow:**
- Use `better-sqlite3` for database access
- Follow repository pattern from `CaseFileRepository.ts`
- Use async/await, no callbacks
- Proper TypeScript typing (no `any`)
- Error handling with try/catch
- Logging with `console.log` (prefix with `[DocumentIntake]`)

**Environment:**
- Node.js/TypeScript backend
- SQLite database (better-sqlite3)
- Gemini SDK: `@google/generative-ai`
- File operations: Node.js `fs/promises`

---

## Deliverables Checklist

- [ ] `src/process/documents/types.ts` - All interfaces defined
- [ ] `src/webserver/auth/repository/DocumentRepository.ts` - Full CRUD operations
- [ ] `src/process/documents/utils/fileTypeDetector.ts` - File type detection
- [ ] `src/process/documents/services/DocumentAnalyzer.ts` - Gemini summarization
- [ ] `src/webserver/websocket/documentProgress.ts` - Progress events
- [ ] All files compile without TypeScript errors
- [ ] All files follow existing code patterns

---

## Success Criteria
Your work is complete when:
1. All 5 files created and compile successfully
2. `DocumentRepository` can perform CRUD operations on `case_documents` table
3. File type detector correctly identifies supported formats
4. Document analyzer can call Gemini and save metadata
5. WebSocket events emit during processing
6. Code follows AionUI patterns and standards

