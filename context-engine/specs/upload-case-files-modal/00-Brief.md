# Upload Case Files Feature - Brief

## Executive Summary

Add a "Upload Case Files" button to the workspace panel that opens a full-screen modal for bulk document upload. The modal provides a drag-and-drop interface for uploading multiple documents simultaneously, with real-time progress tracking via WebSocket as documents flow through the existing intake pipeline (text extraction → analysis → indexing).

## Business Context

**Problem:** Users currently have no way to upload case documents directly from the workspace panel. The existing document intake API (`POST /api/cases/:caseFileId/documents/upload`) is functional but has no UI entry point.

**Solution:** Provide a dedicated upload interface in the workspace panel that:
- Allows bulk document uploads (multiple files at once)
- Shows real-time processing progress for each document
- Displays a paginated list of all uploaded documents
- Integrates seamlessly with the existing document intake pipeline

**Success Criteria:**
1. Users can upload multiple documents in a single interaction
2. Real-time progress updates are visible for each document being processed
3. Users can see a list of all documents uploaded to the current case
4. The modal is dismissible and doesn't block other application functionality
5. All uploaded documents successfully complete the intake pipeline (extraction → analysis → indexing)

## Technical Constraints

### Existing Infrastructure (MUST REUSE)
- **Document Intake API:** `POST /api/cases/:caseFileId/documents/upload` (already implemented)
- **WebSocket Progress Events:** `document:progress` events via `documentProgress.ts` (already implemented)
- **Document Repository:** `DocumentRepository` for database operations (already implemented)
- **Processing Pipeline:** TextExtractor → DocumentAnalyzer → FileSearchIndexer (already implemented)
- **File Upload Handling:** `multer` middleware for multipart/form-data (already configured)

### UI Patterns (MUST FOLLOW)
- **Modal Component:** Use `ModalWrapper` from `@/renderer/components/base/ModalWrapper.tsx`
- **Drag-and-Drop:** Use `useDragUpload` hook from `@/renderer/hooks/useDragUpload.ts`
- **File Preview:** Use `FilePreview` component from `@/renderer/components/FilePreview.tsx`
- **Icon Library:** Use `@icon-park/react` for icons (consistent with existing UI)
- **Styling:** Use UnoCSS utility classes (consistent with existing components)

### Technical Stack
- **Frontend:** React + TypeScript + UnoCSS
- **Backend:** Express + WebSocket (already running on port 25808)
- **State Management:** React hooks (useState, useEffect, useCallback)
- **HTTP Client:** Fetch API for document upload
- **WebSocket Client:** Existing WebSocket connection for progress updates

## Functional Requirements

### FR1: Upload Button in Workspace Panel
- Add "Upload Case Files" button next to File icon and Refresh icon in workspace header
- Button should use `FileAddition` icon from `@icon-park/react`
- Button should have tooltip: "Upload Case Files"
- Clicking button opens the upload modal

### FR2: Full-Screen Upload Modal
- Modal overlays entire application
- Modal has close button (X) in top-right corner
- Modal is dismissible by clicking outside or pressing ESC
- Modal title: "Upload Case Files"

### FR3: Drag-and-Drop Upload Zone
- Top section of modal contains dropzone
- Dropzone accepts multiple files
- Dropzone supports both drag-and-drop and click-to-browse
- Supported file types: PDF, DOCX, TXT, MD, JPG, PNG, MP3, WAV, M4A
- Visual feedback when dragging files over dropzone
- Clear instructions: "Drag and drop files here, or click to browse"

### FR4: Real-Time Progress Tracking
- Each uploaded document shows progress indicator
- Progress states: Pending (10%) → Extracting (30%) → Analyzing (60%) → Indexing (85%) → Complete (100%)
- Progress updates received via WebSocket `document:progress` events
- Error states displayed with error message
- Progress indicators use color coding: blue (processing), green (complete), red (error)

### FR5: Document List with Pagination
- Bottom section of modal shows list of uploaded documents
- List displays: filename, status, progress percentage, upload timestamp
- Pagination: 10 documents per page
- Sorting: Most recent uploads first
- Two tabs: "Documents" (all documents) and "Failed" (only failed documents)
- Completed documents show preview button and download button

### FR6: WebSocket Integration
- Subscribe to case file updates when modal opens
- Listen for `document:progress` events
- Update document status in real-time
- Unsubscribe when modal closes

## Non-Functional Requirements

### NFR1: Performance
- Modal should open in < 200ms
- File upload should start immediately after selection
- Progress updates should appear within 500ms of status change
- Pagination should handle 1000+ documents without performance degradation

### NFR2: Usability
- Drag-and-drop should work on first attempt (no learning curve)
- Progress indicators should be self-explanatory
- Error messages should be actionable
- Modal should be keyboard-accessible (ESC to close, Tab navigation)

### NFR3: Reliability
- Failed uploads should be retryable
- WebSocket disconnections should not break the UI
- Large files (>100MB) should upload without timeout
- Multiple simultaneous uploads should not cause race conditions

## Out of Scope

- Document preview/viewer (future enhancement)
- Document editing/annotation (future enhancement)
- Batch delete functionality (future enhancement)
- Advanced filtering/search (future enhancement)
- Document versioning (future enhancement)

## Dependencies

- Existing document intake API must be functional
- WebSocket server must be running and accessible
- Case file must exist before uploading documents
- User must be authenticated (JWT token required)

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| WebSocket connection drops during upload | High | Implement reconnection logic + fallback to polling |
| Large file uploads timeout | Medium | Increase timeout limits + show upload progress |
| Multiple users uploading to same case | Low | Use optimistic UI updates + refresh on conflict |
| Browser compatibility issues | Low | Test on Chrome, Firefox, Safari, Edge |

## Acceptance Criteria

1. ✅ "Upload Case Files" button appears in workspace panel header
2. ✅ Clicking button opens full-screen modal
3. ✅ Drag-and-drop zone accepts multiple files
4. ✅ Click-to-browse file selection works
5. ✅ Files upload to backend API successfully
6. ✅ Real-time progress updates appear for each document
7. ✅ Document list shows all uploaded documents with pagination
8. ✅ Modal is dismissible (close button, ESC key, click outside)
9. ✅ WebSocket events update UI in real-time
10. ✅ Error states are displayed clearly with actionable messages

