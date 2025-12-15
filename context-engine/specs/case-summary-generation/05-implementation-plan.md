# Case Summary Generation - Implementation Plan

## Sequencing: Backend-Out

```
[Ticket 1: Schema] → [Ticket 2: Types] → [Ticket 3: Repository] 
                                              ↓
[Ticket 4: Generator Service] → [Ticket 5: Routes] → [Ticket 6: WebSocket]
                                                           ↓
                                              [Ticket 7: UI Component]
                                                           ↓
                                              [Ticket 8: Integration]
```

---

## Ticket 1: Database Migration v14

**Priority:** P0 (Blocking)  
**Estimate:** 30 min  
**Dependencies:** None

### Task
Add case summary tracking columns to `case_files` table.

### Files to Modify
- `src/process/database/schema.ts` - Add migration v14
- `src/process/database/schema.ts` - Update `CURRENT_DB_VERSION` to 14

### Acceptance Criteria
- [ ] Migration runs without error on existing databases
- [ ] New columns exist: `case_summary_status`, `case_summary_generated_at`, `case_summary_version`, `case_summary_document_count`
- [ ] Index created on `case_summary_status`

---

## Ticket 2: TypeScript Type Updates

**Priority:** P0 (Blocking)  
**Estimate:** 20 min  
**Dependencies:** Ticket 1

### Task
Update TypeScript interfaces to include new summary fields.

### Files to Modify
- `src/common/storage.ts` - Update `ICaseFile` interface
- `src/process/database/types.ts` - Update `ICaseFileRow` interface
- `src/process/database/types.ts` - Update conversion functions

### Acceptance Criteria
- [ ] `ICaseFile` has all 4 new optional fields
- [ ] `ICaseFileRow` has all 4 new optional fields
- [ ] `caseFileToRow()` and `rowToCaseFile()` handle new fields
- [ ] No TypeScript compilation errors

---

## Ticket 3: CaseFileRepository Summary Methods

**Priority:** P0 (Blocking)  
**Estimate:** 45 min  
**Dependencies:** Ticket 2

### Task
Add repository methods for summary status management.

### Files to Modify
- `src/webserver/auth/repository/CaseFileRepository.ts`

### Methods to Add
```typescript
// Get summary status
getSummaryStatus(caseId: string): ISummaryStatus | null

// Update summary status
updateSummaryStatus(caseId: string, status: string): void

// Mark summary as generated
markSummaryGenerated(caseId: string, documentCount: number): void

// Mark summary as stale
markSummaryStale(caseId: string): void
```

### Acceptance Criteria
- [ ] All methods implemented with proper error handling
- [ ] Status updates include `updated_at` timestamp
- [ ] `markSummaryGenerated` increments version

---

## Ticket 4: CaseSummaryGenerator Service

**Priority:** P0 (Blocking)  
**Estimate:** 3 hours  
**Dependencies:** Ticket 3

### Task
Core service that generates case summaries using Gemini CLI.

### Files to Create
- `src/process/documents/services/CaseSummaryGenerator.ts`
- `src/process/documents/services/prompts/case-summary-prompt.ts`

### Key Methods
```typescript
class CaseSummaryGenerator {
  // Generate new summary from all documents
  async generate(caseId: string): Promise<void>
  
  // Update existing summary with new documents only
  async update(caseId: string): Promise<void>
  
  // Full regeneration (ignores existing)
  async regenerate(caseId: string): Promise<void>
  
  // Internal: Process documents in batches of 5
  private async processInBatches(metadataFiles: string[]): Promise<string>
  
  // Internal: Merge new content with existing summary
  private async mergeWithExisting(existing: string, newContent: string): Promise<string>
}
```

### Acceptance Criteria
- [ ] Uses Gemini CLI (not SDK)
- [ ] Batches documents in groups of 5
- [ ] Outputs schema-compliant markdown
- [ ] Creates backup before update/regenerate
- [ ] Handles errors gracefully (preserves old summary on failure)

---

## Ticket 5: API Routes

**Priority:** P0 (Blocking)  
**Estimate:** 1 hour  
**Dependencies:** Ticket 4

### Task
Add REST endpoints for summary generation.

### Files to Modify
- `src/webserver/routes/caseRoutes.ts` (or create `summaryRoutes.ts`)

### Endpoints
- `POST /api/cases/:caseId/summary/generate`
- `POST /api/cases/:caseId/summary/update`
- `POST /api/cases/:caseId/summary/regenerate`
- `GET /api/cases/:caseId/summary/status`

### Acceptance Criteria
- [ ] All endpoints authenticated
- [ ] Proper HTTP status codes (202 for async, 400 for validation, 404 for not found)
- [ ] Async execution (returns immediately, processes in background)
- [ ] Emits WebSocket events

---

## Ticket 6: WebSocket Events

**Priority:** P1
**Estimate:** 45 min
**Dependencies:** Ticket 5

### Task
Add WebSocket events for real-time progress updates.

### Files to Modify
- `src/webserver/websocket/handlers.ts` (or equivalent)

### Events to Emit
- `summary:generating` - Progress updates (percent, batch info)
- `summary:complete` - Generation finished successfully
- `summary:failed` - Generation failed with error

### Acceptance Criteria
- [ ] Events scoped to case ID
- [ ] Progress updates sent at each batch completion
- [ ] Error messages are user-friendly

---

## Ticket 7: Staleness Detection Hook

**Priority:** P1
**Estimate:** 30 min
**Dependencies:** Ticket 3

### Task
When a document completes processing, mark case summary as stale if it exists.

### Files to Modify
- `src/process/documents/services/DocumentProcessor.ts` (or wherever status is updated to 'complete')

### Logic
```typescript
// After document status set to 'complete':
if (caseFile.case_summary_status === 'generated') {
  CaseFileRepository.markSummaryStale(caseFile.id);
}
```

### Acceptance Criteria
- [ ] Summary status changes from 'generated' to 'stale' when new doc completes
- [ ] Does not trigger if summary status is null, generating, or already stale

---

## Ticket 8: UI Component - CaseSummaryControls

**Priority:** P1
**Estimate:** 2 hours
**Dependencies:** Ticket 5, Ticket 6

### Task
Create React component for summary controls in upload modal.

### Files to Create
- `src/renderer/components/UploadCaseFilesModal/CaseSummaryControls.tsx`
- Update `src/renderer/components/UploadCaseFilesModal/styles.css`

### Features
- Status badge (none/generated/stale/generating/failed)
- Progress bar during generation
- Buttons: Generate, Update, Regenerate, View
- Metadata display (version, timestamp, doc count)

### Acceptance Criteria
- [ ] All 5 states render correctly (see 04-ui-specs.md)
- [ ] WebSocket subscription for real-time updates
- [ ] Regenerate button shows confirmation dialog
- [ ] Arco Design components used consistently

---

## Ticket 9: File Search Indexing for Summary

**Priority:** P2
**Estimate:** 45 min
**Dependencies:** Ticket 4

### Task
Index generated summary in case's File Search store for RAG access.

### Files to Modify
- `src/process/documents/services/CaseSummaryGenerator.ts`
- `src/process/documents/services/FileSearchIndexer.ts`

### Logic
After summary is written to disk:
1. Upload `case_summary.md` to File Search store
2. Store the file URI (optional: track in database)

### Acceptance Criteria
- [ ] Summary appears in File Search store
- [ ] RAG queries can retrieve summary content
- [ ] Old summary versions are replaced (not duplicated)

---

## Ticket 10: Integration & Testing

**Priority:** P2
**Estimate:** 1 hour
**Dependencies:** All above

### Task
Wire everything together and test end-to-end.

### Files to Modify
- `src/renderer/components/UploadCaseFilesModal/index.tsx` - Add CaseSummaryControls

### Test Cases
1. Generate summary on case with 3 documents
2. Upload new document, verify status becomes 'stale'
3. Update summary, verify only new doc is incorporated
4. Regenerate summary, verify full rebuild
5. Test failure recovery (kill process mid-generation)
6. Test empty case (0 documents) - should show error

### Acceptance Criteria
- [ ] All Claims from Brief pass their Verdicts
- [ ] No TypeScript errors
- [ ] No console errors during normal operation

---

## Summary

| Ticket | Name | Est. | Priority | Depends On |
|--------|------|------|----------|------------|
| 1 | Database Migration v14 | 30m | P0 | - |
| 2 | TypeScript Type Updates | 20m | P0 | 1 |
| 3 | Repository Methods | 45m | P0 | 2 |
| 4 | Generator Service | 3h | P0 | 3 |
| 5 | API Routes | 1h | P0 | 4 |
| 6 | WebSocket Events | 45m | P1 | 5 |
| 7 | Staleness Detection | 30m | P1 | 3 |
| 8 | UI Component | 2h | P1 | 5, 6 |
| 9 | File Search Indexing | 45m | P2 | 4 |
| 10 | Integration & Testing | 1h | P2 | All |

**Total Estimate:** ~11 hours

