# Agent 3: Extraction Handlers & RAG Integration

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
Implement the specific extraction handlers (Mistral OCR, pdf-parse, plaintext), Gemini summarization prompt, and Google File Search RAG integration. Your work completes the document processing pipeline.

## Context Files to Load
**Load these files in order:**
1. `context-engine/specs/document-intake/agent-prompts/SHARED-CONTEXT.md` - **READ FIRST**
2. `context-engine/specs/document-intake/00-task-plan.md` - Complete architectural plan
3. `context-engine/specs/document-intake/references/process_intake.py` - Reference implementation
4. `context-engine/specs/document-intake/references/document_summary.json` - Metadata structure
5. `src/process/documents/types.ts` - Interfaces (created by Agent 1)
6. `src/webserver/auth/repository/DocumentRepository.ts` - Repository (created by Agent 1)
7. `src/process/documents/services/TextExtractor.ts` - Orchestrator (created by Agent 2)

## Your Assigned Tickets

### **Ticket 6: Mistral OCR Handler** (Wave 2)
**File:** `src/process/documents/handlers/MistralOCRHandler.ts` (NEW FILE)

**Requirements:**
- Extract text from PDFs, images using Mistral API
- Add page break markers: `--- Page X ---`
- Handle multi-page documents
- Respect Mistral limits: 50MB max, 1,000 pages max

**Class Structure:**
```typescript
export class MistralOCRHandler {
  constructor(private apiKey: string)
  
  async extractText(filePath: string): Promise<{
    text: string
    pageCount: number
    wordCount: number
  }>
  
  private async callMistralAPI(fileBuffer: Buffer): Promise<string>
  private addPageBreaks(text: string, pageCount: number): string
}
```

**API Integration:**
- Endpoint: `https://api.mistral.ai/v1/chat/completions`
- Model: `pixtral-large-latest`
- Send file as base64 in message content
- Extract text from response

**Acceptance Criteria:**
- Handles PDF and image files
- Adds page break markers
- Returns accurate page/word counts
- Proper error handling for API failures
- Uses retry logic from Agent 2's `retryHandler`

---

### **Ticket 7: pdf-parse Fallback Handler** (Wave 2)
**File:** `src/process/documents/handlers/PdfParseHandler.ts` (NEW FILE)

**Requirements:**
- Fallback for simple PDFs when Mistral unavailable
- Uses `pdf-parse` npm package
- Faster but less accurate than Mistral OCR

**Class Structure:**
```typescript
export class PdfParseHandler {
  async extractText(filePath: string): Promise<{
    text: string
    pageCount: number
    wordCount: number
  }>
  
  private addPageBreaks(pages: string[]): string
}
```

**Acceptance Criteria:**
- Extracts text from PDF text layer
- Adds page break markers
- Returns accurate page/word counts
- Handles PDFs without text layer gracefully

---

### **Ticket 10: Gemini Summarization Prompt** (Wave 3)
**File:** `src/process/documents/prompts/summarizationPrompt.ts` (NEW FILE)

**Requirements:**
- Prompt template for Gemini to generate document metadata
- Outputs structured JSON matching `IDocumentMetadata`
- Based on reference implementation's prompt

**Prompt Structure:**
```typescript
export function buildSummarizationPrompt(
  extractedText: string,
  filename: string
): string
```

**Prompt Template (from reference):**
```
You are a legal document analyst. Analyze the following document and extract structured metadata.

Document: {filename}

Extracted Text:
{extractedText}

Generate a JSON object with the following fields:
- executive_summary: Brief 2-3 sentence summary
- document_type: Type of legal document (complaint, motion, brief, etc.)
- key_parties: Array of party names
- main_arguments: Array of main legal arguments
- important_dates: Array of significant dates
- jurisdiction: Court jurisdiction
- authorities: Array of cited cases/statutes
- critical_facts: Array of key facts
- requested_relief: What the document requests

Return ONLY valid JSON, no markdown formatting.
```

**Acceptance Criteria:**
- Generates valid prompt string
- Includes all metadata fields
- Handles long documents (truncate if needed)
- Clear instructions for JSON output

---

### **Ticket 13: File Search Indexer** (Wave 4)
**File:** `src/process/documents/services/FileSearchIndexer.ts` (NEW FILE)

**Requirements:**
- Indexes documents into Google File Search
- Creates File Search store per case file
- Uploads extracted text with metadata
- Stores `file_search_store_id` in database

**Class Structure:**
```typescript
export class FileSearchIndexer {
  constructor(
    private geminiApiKey: string,
    private documentRepo: DocumentRepository
  )
  
  async indexDocument(
    documentId: string,
    caseFileId: string,
    extractedTextPath: string,
    metadata: IDocumentMetadata
  ): Promise<void>
  
  private async getOrCreateStore(caseFileId: string): Promise<string>
  private async uploadToFileSearch(
    storeId: string,
    textPath: string,
    metadata: IDocumentMetadata
  ): Promise<string>
}
```

**File Search Integration:**
- Use Gemini SDK `ai.files.upload()` to upload text file
- Create File Search store: `ai.fileSearch.createStore()`
- Add file to store: `ai.fileSearch.addFile()`
- Store `file_search_store_id` in `case_files` table
- Store `gemini_file_uri` in `case_documents` table

**Acceptance Criteria:**
- Creates one store per case file
- Uploads all documents to same store
- Includes metadata as custom fields
- Updates database with store/file IDs
- Handles API errors gracefully

---

### **Ticket 14: Metadata Filtering Utility** (Wave 4)
**File:** `src/process/documents/utils/metadataFilter.ts` (NEW FILE)

**Requirements:**
- Filter documents by metadata fields
- Support complex queries (AND, OR, date ranges)
- Used by AI agents to find relevant documents

**Functions:**
```typescript
export function filterByDocumentType(
  documents: ICaseDocument[],
  types: DocumentType[]
): ICaseDocument[]

export function filterByDateRange(
  documents: ICaseDocument[],
  startDate: Date,
  endDate: Date
): ICaseDocument[]

export function filterByParty(
  documents: ICaseDocument[],
  partyName: string
): ICaseDocument[]

export function complexFilter(
  documents: ICaseDocument[],
  query: FilterQuery
): ICaseDocument[]
```

**Acceptance Criteria:**
- Supports all metadata fields
- Case-insensitive string matching
- Date range queries
- Combines multiple filters (AND/OR)
- Returns sorted results

---

### **Ticket 15: Agent Tool Integration** (Wave 4)
**File:** `src/process/documents/tools/documentTools.ts` (NEW FILE)

**Requirements:**
- MCP tools for AI agents to query documents
- Integrates with existing agent tool system
- Provides semantic search + metadata filtering

**Tools to Implement:**
```typescript
export const searchDocumentsTool = {
  name: 'search_case_documents',
  description: 'Search documents in a case file using semantic search',
  inputSchema: { ... },
  handler: async (args) => { ... }
}

export const getDocumentTool = {
  name: 'get_document_content',
  description: 'Retrieve full text of a specific document',
  inputSchema: { ... },
  handler: async (args) => { ... }
}

export const filterDocumentsTool = {
  name: 'filter_documents_by_metadata',
  description: 'Filter documents by type, date, party, etc.',
  inputSchema: { ... },
  handler: async (args) => { ... }
}
```

**Acceptance Criteria:**
- Integrates with existing MCP tool system
- Uses File Search for semantic queries
- Uses metadata filter for structured queries
- Returns formatted results for AI consumption
- Proper error handling

---

### **Ticket 18: End-to-End Testing** (Wave 5)
**File:** `src/process/documents/__tests__/e2e.test.ts` (NEW FILE)

**Requirements:**
- Full pipeline test with real files
- Tests all extraction handlers
- Verifies RAG indexing
- Tests agent tool queries

**Test Cases:**
1. Upload PDF → Mistral OCR → Gemini summary → File Search index → Agent query
2. Upload plaintext → Direct extraction → Gemini summary → File Search index
3. Query documents by semantic search
4. Query documents by metadata filter
5. Retrieve full document content
6. Handle extraction failures gracefully
7. Handle indexing failures gracefully

**Acceptance Criteria:**
- All tests pass
- Uses real test files (small PDFs, text files)
- Mocks external APIs or uses test keys
- Cleans up test data
- Can run in CI/CD

---

## Dependencies & Constraints

**Blocking Dependencies:**
- Agent 1 Ticket 2 (Interfaces) - Required for type definitions
- Agent 1 Ticket 4 (Repository) - Required for database access
- Agent 1 Ticket 11 (DocumentAnalyzer) - Required for summarization
- Agent 2 Ticket 5 (TextExtractor) - Required for orchestration
- Agent 2 Ticket 9 (ManifestGenerator) - Required for RAG indexing

**You Enable:**
- Complete document processing pipeline
- AI agent document querying capabilities

**Standards to Follow:**
- Use Gemini SDK (`@google/generative-ai`)
- Use Mistral API for OCR
- Use `pdf-parse` for fallback extraction
- Async/await, no callbacks
- Proper TypeScript typing (no `any`)
- Error handling with try/catch
- Logging with `console.log` (prefix with `[DocumentIntake]`)
- Use retry logic from Agent 2's `retryHandler`

**Environment:**
- Node.js/TypeScript backend
- Mistral API: `https://api.mistral.ai/v1/chat/completions`
- Gemini SDK: `@google/generative-ai`
- File Search: Part of Gemini SDK
- SQLite database (better-sqlite3)

---

## Deliverables Checklist

- [ ] `src/process/documents/handlers/MistralOCRHandler.ts` - Mistral OCR extraction
- [ ] `src/process/documents/handlers/PdfParseHandler.ts` - pdf-parse fallback
- [ ] `src/process/documents/prompts/summarizationPrompt.ts` - Gemini prompt
- [ ] `src/process/documents/services/FileSearchIndexer.ts` - RAG indexing
- [ ] `src/process/documents/utils/metadataFilter.ts` - Metadata filtering
- [ ] `src/process/documents/tools/documentTools.ts` - Agent tools
- [ ] `src/process/documents/__tests__/e2e.test.ts` - End-to-end tests
- [ ] All files compile without TypeScript errors
- [ ] All tests pass
- [ ] RAG indexing works end-to-end

---

## Success Criteria
Your work is complete when:
1. All 7 files created and compile successfully
2. Mistral OCR extracts text from PDFs/images
3. pdf-parse provides fallback extraction
4. Gemini generates structured metadata
5. File Search indexes documents successfully
6. Metadata filtering works correctly
7. Agent tools enable document querying
8. End-to-end tests pass
9. Code follows AionUI patterns and standards

