# Case Summary Generation - Integration Test Checklist

## ✅ Implementation Complete

All 10 tickets have been implemented. This checklist verifies end-to-end integration.

---

## Pre-Test Setup

### 1. Database Migration
- [ ] Verify migration v14 runs successfully on app startup
- [ ] Check that `case_files` table has new columns:
  - `case_summary_status`
  - `case_summary_generated_at`
  - `case_summary_version`
  - `case_summary_document_count`
- [ ] Verify index exists: `idx_case_files_summary_status`

### 2. Backend Services
- [ ] Verify `CaseSummaryGenerator` class is instantiated correctly
- [ ] Verify API routes are registered in `caseRoutes.ts`
- [ ] Verify WebSocket progress emitter is initialized in `adapter.ts`

### 3. Frontend Components
- [ ] Verify `CaseSummaryControls` component renders in upload modal
- [ ] Verify CSS styles are loaded from `styles.css`

---

## Test Scenarios

### Scenario 1: Generate Summary (First Time)

**Setup:**
1. Create a new case
2. Upload 3-5 documents
3. Wait for all documents to complete processing (status = 'complete')

**Test Steps:**
1. Open Upload Case Files modal
2. Verify summary status shows "Not Generated" badge
3. Click "Generate Summary" button
4. Verify:
   - Status changes to "Generating..." with animated badge
   - Progress bar appears showing batch progress
   - WebSocket events update progress in real-time
5. Wait for generation to complete
6. Verify:
   - Status changes to "Generated" with green badge
   - Timestamp shows current date/time
   - Version shows "v1"
   - Document count matches number of processed documents
   - "View Summary" and "Regenerate" buttons appear
7. Check filesystem:
   - `~/.justicequest/{case-name}/case-context/case_summary.md` exists
   - File contains all 10 required sections (see 06-summary-schema.md)

**Expected API Calls:**
- `POST /api/cases/:id/summary/generate` → 200 OK
- WebSocket events: `summary:generating` → `summary:complete`

---

### Scenario 2: Upload New Document (Staleness Detection)

**Setup:**
- Use case from Scenario 1 with generated summary

**Test Steps:**
1. Upload a new document to the case
2. Wait for document to complete processing
3. Verify:
   - Summary status automatically changes to "Needs Update" (orange badge)
   - Warning message appears: "New documents have been added since last summary"
   - Three buttons appear: "View", "Update Summary", "Regenerate"

**Expected Behavior:**
- Staleness hook in `FileSearchIndexer.ts` triggers on document completion
- `CaseFileRepository.markSummaryStale()` is called
- UI reflects status change via polling or WebSocket

---

### Scenario 3: Update Summary (Incremental)

**Setup:**
- Use case from Scenario 2 with stale summary

**Test Steps:**
1. Click "Update Summary" button
2. Verify:
   - Status changes to "Generating..."
   - Progress bar shows batch processing
3. Wait for update to complete
4. Verify:
   - Status changes back to "Generated"
   - Version increments (e.g., v1 → v2)
   - Document count increases
   - Timestamp updates
5. Check filesystem:
   - `case_summary.md.bak` exists (backup of previous version)
   - `case_summary.md` contains updated content with new document info

**Expected API Calls:**
- `POST /api/cases/:id/summary/update` → 200 OK

---

### Scenario 4: Regenerate Summary (Full Rebuild)

**Setup:**
- Use any case with existing summary

**Test Steps:**
1. Click "Regenerate" button
2. Verify confirmation dialog appears:
   - Title: "Regenerate Summary"
   - Message: "This will rebuild the entire summary from scratch. Continue?"
3. Click "OK"
4. Verify generation process (same as Scenario 1)
5. Check filesystem:
   - Backup created before regeneration
   - New summary replaces old one

**Expected API Calls:**
- `POST /api/cases/:id/summary/regenerate` → 200 OK

---

### Scenario 5: Failed Generation

**Setup:**
- Simulate failure (e.g., Gemini CLI not available, invalid API key)

**Test Steps:**
1. Trigger generation
2. Verify:
   - Status changes to "Failed" (red badge)
   - Error message appears
   - "Retry Generate" button appears
3. Click "Retry Generate"
4. Verify generation restarts

**Expected Behavior:**
- `CaseFileRepository.markSummaryFailed()` is called on error
- Old summary is preserved (not deleted)

---

## Integration Points to Verify

### Backend → Database
- [ ] `CaseFileRepository` methods work correctly:
  - `getSummaryStatus()`
  - `updateSummaryStatus()`
  - `markSummaryGenerated()`
  - `markSummaryStale()`
  - `markSummaryFailed()`

### Backend → Filesystem
- [ ] Summary written to correct path: `{workspace}/case-context/case_summary.md`
- [ ] Backups created with `.bak` extension
- [ ] Metadata files loaded from `{workspace}/documents/{folder}/metadata.json`

### Backend → AI Service
- [ ] Gemini CLI called with correct prompt templates
- [ ] Batch processing works (5 documents per batch)
- [ ] Hierarchical summarization builds cumulative summary

### Backend → WebSocket
- [ ] Progress events emitted correctly:
  - `summary:generating` with batch progress
  - `summary:complete` with version and document count
  - `summary:failed` with error message
- [ ] Events scoped to correct case file ID

### Frontend → Backend
- [ ] API calls use cookie authentication (`credentials: 'include'`)
- [ ] Error handling displays user-friendly messages
- [ ] Loading states prevent duplicate requests

### Frontend → WebSocket
- [ ] Component subscribes to WebSocket events (TODO: implement subscription)
- [ ] Progress updates reflected in UI in real-time
- [ ] Status changes trigger UI re-render

---

## Known Limitations

1. **File Search Indexing:** Placeholder implementation - will be completed when File Search API is integrated
2. **WebSocket Subscription:** Frontend polling is used; WebSocket subscription not yet implemented
3. **Summary Viewer:** "View Summary" button shows placeholder message - viewer not yet implemented
4. **Cancel Generation:** Not implemented in MVP

---

## Success Criteria

- [ ] All 5 UI states render correctly
- [ ] All 4 API endpoints work without errors
- [ ] Database migrations apply successfully
- [ ] Staleness detection triggers automatically
- [ ] Progress updates work in real-time
- [ ] Error handling is graceful
- [ ] No TypeScript compilation errors
- [ ] No console errors during normal operation

