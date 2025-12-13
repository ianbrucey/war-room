# Implementation Plan: Agent 2 - Document List & Progress Tracking

## Overview
Build the document list component with real-time WebSocket progress updates, pagination, and action buttons for the Upload Case Files Modal.

## Current State
Agent 1 has completed:
- ✅ Modal shell (`UploadCaseFilesModal/index.tsx`)
- ✅ Dropzone section (`DropzoneSection.tsx`)
- ✅ Basic styles (`styles.css`)
- ✅ File upload functionality

## Tasks to Complete

### Task 1: Create WebSocket Progress Hook
**File:** `src/renderer/hooks/useWebSocketProgress.ts`

**What it does:**
- Subscribes to case file updates via WebSocket
- Listens for `document:progress` events
- Calls callback when progress updates are received
- Unsubscribes on cleanup

**Dependencies:**
- Uses `@webserver/websocket/documentProgress` types
- Assumes WebSocket connection at `(window as any).__websocket`

---

### Task 2: Create Document List Section
**File:** `src/renderer/components/UploadCaseFilesModal/DocumentListSection.tsx`

**What it does:**
- Displays filterable tabs (All Documents / Failed)
- Shows document counts in tab titles
- Filters documents based on active tab
- Paginates documents (10 per page)
- Renders list of `DocumentListItem` components

**Props:**
- documents: ICaseDocument[]
- activeTab: 'documents' | 'failed'
- onTabChange
- page, pageSize
- onPageChange
- onPreview, onDownload

**Uses:**
- `Tabs`, `Pagination` from @arco-design/web-react
- `DocumentListItem` component

---

### Task 3: Create Document List Item
**File:** `src/renderer/components/UploadCaseFilesModal/DocumentListItem.tsx`

**What it does:**
- Displays individual document row
- Shows file icon, name, metadata, progress
- Shows status badge with color coding
- Shows Preview/Download buttons for completed documents

**Features:**
- Status color mapping (pending=gray, processing=blue, complete=green, failed=red)
- Timestamp formatting (relative time)
- Conditional action buttons

**Uses:**
- `Button`, `Badge` from @arco-design/web-react
- `Preview`, `Download` icons from @icon-park/react
- `ProgressIndicator` component

---

### Task 4: Create Progress Indicator
**File:** `src/renderer/components/UploadCaseFilesModal/ProgressIndicator.tsx`

**What it does:**
- Visual progress bar showing processing status
- Maps status to progress percentage (pending=10%, extracting=30%, analyzing=60%, indexing=85%, complete=100%)
- Color coded by status

**Uses:**
- `Progress` from @arco-design/web-react

---

### Task 5: Integrate WebSocket in Main Modal
**File:** Update `src/renderer/components/UploadCaseFilesModal/index.tsx`

**What to add:**
- Import and use `useWebSocketProgress` hook
- Add state for activeTab and pagination
- Handle progress updates to update document status
- Replace placeholder with `DocumentListSection`
- Add preview/download handlers (placeholder for now)

---

### Task 6: Update Styles
**File:** Update `src/renderer/components/UploadCaseFilesModal/styles.css`

**What to add:**
- Styles already mostly in place from Agent 1
- May need minor tweaks for progress bars

---

## Implementation Order

1. **ProgressIndicator** (no dependencies, pure presentation)
2. **DocumentListItem** (depends on ProgressIndicator)
3. **DocumentListSection** (depends on DocumentListItem)
4. **useWebSocketProgress** (standalone hook)
5. **Update index.tsx** (integrate everything)

## Acceptance Criteria

- [ ] WebSocket hook subscribes/unsubscribes correctly
- [ ] Document list shows all documents with pagination
- [ ] Tabs show correct counts and filter properly
- [ ] Progress bars update in real-time via WebSocket
- [ ] Status badges show correct colors
- [ ] Preview/Download buttons appear only for completed docs
- [ ] Timestamp displays relative time
- [ ] Pagination works correctly

## Testing

Manual testing steps:
1. Upload a document
2. Watch progress update from pending → extracting → analyzing → indexing → complete
3. Verify status badge and progress bar update
4. Upload 10+ documents, verify pagination
5. Check "Failed" tab filters correctly

## Handoff

After completion, the next agent (Agent 3) will:
- Add the upload button to workspace panel
- Wire up preview/download functionality
- Add error handling and edge cases
