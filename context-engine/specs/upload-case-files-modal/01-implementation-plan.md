# Upload Case Files Feature - Implementation Plan

## Overview

This plan breaks down the "Upload Case Files" feature into atomic, sequenceable tasks following the "Backend-Out" principle. Each task is independently testable and can be completed in isolation.

## Task Sequencing Strategy

**Phase 1: Backend Verification** (Tasks 1-2)
- Verify existing API endpoints work correctly
- Test WebSocket progress events

**Phase 2: Core UI Components** (Tasks 3-5)
- Create modal component structure
- Implement dropzone with drag-and-drop
- Add file upload logic

**Phase 3: Real-Time Updates** (Tasks 6-7)
- Integrate WebSocket progress tracking
- Implement document list with pagination

**Phase 4: Integration & Polish** (Tasks 8-10)
- Add button to workspace panel
- Wire up all components
- Add error handling and edge cases

---

## Task 1: Verify Document Upload API

**Goal:** Confirm the existing upload endpoint works correctly

**Files to Test:**
- `src/webserver/routes/documentRoutes.ts` (lines 23-79)
- `src/webserver/auth/repository/DocumentRepository.ts`

**Acceptance Criteria:**
- [ ] POST `/api/cases/:caseFileId/documents/upload` accepts multipart/form-data
- [ ] File is saved to `{workspace}/documents/originals/`
- [ ] Document record is created in database with status `pending`
- [ ] Response includes `documentId`
- [ ] Text extraction starts asynchronously

**Testing:**
```bash
# Test with curl
curl -X POST http://localhost:25808/api/cases/{caseFileId}/documents/upload \
  -H "Authorization: Bearer {token}" \
  -F "file=@test-document.pdf"
```

---

## Task 2: Verify WebSocket Progress Events

**Goal:** Confirm WebSocket events are emitted correctly during document processing

**Files to Test:**
- `src/webserver/websocket/documentProgress.ts`
- `src/webserver/websocket/WebSocketManager.ts`

**Acceptance Criteria:**
- [ ] WebSocket connection established on client
- [ ] Client can subscribe to case file updates
- [ ] `document:progress` events are received
- [ ] Events contain: documentId, caseFileId, filename, progress, message, timestamp
- [ ] Progress values match status: pending (10%), extracting (30%), analyzing (60%), indexing (85%), complete (100%)

**Testing:**
```javascript
// Test WebSocket connection
const ws = new WebSocket('ws://localhost:25808');
ws.send(JSON.stringify({ type: 'subscribe-case-file', caseFileId: 'case_123' }));
ws.onmessage = (event) => console.log('Progress:', JSON.parse(event.data));
```

---

## Task 3: Create UploadCaseFilesModal Component

**Goal:** Build the modal shell with basic structure

**New File:** `src/renderer/components/UploadCaseFilesModal.tsx`

**Component Structure:**
```typescript
interface UploadCaseFilesModalProps {
  visible: boolean;
  caseFileId: string;
  onClose: () => void;
}

export const UploadCaseFilesModal: React.FC<UploadCaseFilesModalProps> = ({
  visible,
  caseFileId,
  onClose
}) => {
  return (
    <ModalWrapper
      visible={visible}
      onCancel={onClose}
      title="Upload Case Files"
      style={{ width: '90vw', height: '90vh' }}
    >
      {/* Content will be added in next tasks */}
    </ModalWrapper>
  );
};
```

**Acceptance Criteria:**
- [ ] Modal renders when `visible={true}`
- [ ] Modal closes when clicking X button
- [ ] Modal closes when pressing ESC key
- [ ] Modal has title "Upload Case Files"
- [ ] Modal is full-screen (90vw x 90vh)

---

## Task 4: Implement Dropzone Component

**Goal:** Add drag-and-drop file upload zone

**File to Modify:** `src/renderer/components/UploadCaseFilesModal.tsx`

**Implementation:**
```typescript
const { isFileDragging, dragHandlers } = useDragUpload({
  supportedExts: ['pdf', 'docx', 'txt', 'md', 'jpg', 'png', 'mp3', 'wav', 'm4a'],
  onFilesAdded: handleFilesAdded
});

const handleFilesAdded = useCallback((files: FileMetadata[]) => {
  // Upload files to backend
  files.forEach(file => uploadFile(file));
}, []);
```

**Acceptance Criteria:**
- [ ] Dropzone displays at top of modal
- [ ] Drag-and-drop works for multiple files
- [ ] Click-to-browse opens file picker
- [ ] Only supported file types are accepted
- [ ] Visual feedback when dragging files over zone
- [ ] Instructions text: "Drag and drop files here, or click to browse"

---

## Task 5: Implement File Upload Logic

**Goal:** Upload files to backend API and track upload state

**File to Modify:** `src/renderer/components/UploadCaseFilesModal.tsx`

**Implementation:**
```typescript
const uploadFile = async (file: FileMetadata) => {
  const formData = new FormData();
  const blob = await fetch(file.path).then(r => r.blob());
  formData.append('file', blob, file.name);

  const response = await fetch(
    `/api/cases/${caseFileId}/documents/upload`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    }
  );

  const result = await response.json();
  return result.documentId;
};
```

**Acceptance Criteria:**
- [ ] Files are uploaded to backend API
- [ ] Upload progress is tracked (0-100%)
- [ ] Multiple files can upload simultaneously
- [ ] Upload errors are caught and displayed
- [ ] Document ID is returned from API

---

## Task 6: Integrate WebSocket Progress Tracking

**Goal:** Listen for real-time progress updates via WebSocket

**File to Modify:** `src/renderer/components/UploadCaseFilesModal.tsx`

**Implementation:**
```typescript
useEffect(() => {
  if (!visible) return;

  // Subscribe to case file updates
  const ws = getWebSocketConnection();
  ws.send(JSON.stringify({
    type: 'subscribe-case-file',
    caseFileId
  }));

  // Listen for progress events
  const handleMessage = (event: MessageEvent) => {
    const data = JSON.parse(event.data);
    if (data.event === 'document:progress') {
      updateDocumentProgress(data.data);
    }
  };

  ws.addEventListener('message', handleMessage);

  return () => {
    ws.removeEventListener('message', handleMessage);
    ws.send(JSON.stringify({
      type: 'unsubscribe-case-file',
      caseFileId
    }));
  };
}, [visible, caseFileId]);
```

**Acceptance Criteria:**
- [ ] WebSocket subscribes to case file on modal open
- [ ] Progress events update document status in real-time
- [ ] WebSocket unsubscribes on modal close
- [ ] Reconnection logic handles dropped connections

---

## Task 7: Implement Document List with Pagination

**Goal:** Display uploaded documents with pagination

**File to Modify:** `src/renderer/components/UploadCaseFilesModal.tsx`

**Implementation:**
```typescript
const [documents, setDocuments] = useState<ICaseDocument[]>([]);
const [page, setPage] = useState(1);
const pageSize = 10;

useEffect(() => {
  // Fetch documents from API
  fetch(`/api/cases/${caseFileId}/documents`)
    .then(r => r.json())
    .then(docs => setDocuments(docs));
}, [caseFileId]);

const paginatedDocs = documents.slice(
  (page - 1) * pageSize,
  page * pageSize
);
```

**Acceptance Criteria:**
- [ ] Document list displays at bottom of modal
- [ ] Shows: filename, status, progress %, upload timestamp
- [ ] Pagination controls (prev/next, page numbers)
- [ ] 10 documents per page
- [ ] Sorted by upload timestamp (newest first)
- [ ] Status colors: blue (processing), green (complete), red (error)

---

## Task 8: Add Upload Button to Workspace Panel

**Goal:** Add entry point to open the modal

**File to Modify:** `src/renderer/pages/conversation/ChatWorkspace.tsx` (lines 921-936)

**Implementation:**
```typescript
<Tooltip content={t('conversation.explorer.uploadCaseFiles')}>
  <span>
    <FileAddition
      className='cursor-pointer flex'
      theme='outline'
      size='16'
      fill={iconColors.secondary}
      onClick={() => setUploadModalVisible(true)}
    />
  </span>
</Tooltip>
```

**Acceptance Criteria:**
- [ ] Button appears next to File and Refresh icons
- [ ] Button uses `FileAddition` icon
- [ ] Tooltip shows "Upload Case Files"
- [ ] Clicking button opens modal

---

## Task 9: Wire Up Modal State Management

**Goal:** Connect button to modal component

**File to Modify:** `src/renderer/pages/conversation/ChatWorkspace.tsx`

**Implementation:**
```typescript
const [uploadModalVisible, setUploadModalVisible] = useState(false);

// Add modal component
<UploadCaseFilesModal
  visible={uploadModalVisible}
  caseFileId={caseFileId}
  onClose={() => setUploadModalVisible(false)}
/>
```

**Acceptance Criteria:**
- [ ] Modal opens when button is clicked
- [ ] Modal closes when X button is clicked
- [ ] Modal closes when ESC is pressed
- [ ] Modal state is managed correctly

---

## Task 10: Add Error Handling & Edge Cases

**Goal:** Handle errors and edge cases gracefully

**Files to Modify:**
- `src/renderer/components/UploadCaseFilesModal.tsx`

**Error Scenarios:**
- Upload fails (network error, server error)
- WebSocket disconnects during upload
- Invalid file type selected
- File too large (>100MB)
- No case file ID provided

**Acceptance Criteria:**
- [ ] Upload errors show error message
- [ ] Retry button for failed uploads
- [ ] WebSocket reconnection on disconnect
- [ ] File size validation before upload
- [ ] Graceful degradation if WebSocket unavailable

---

## Reusable Components & Utilities

### From Existing Codebase:
- `ModalWrapper` - Modal shell with close button
- `useDragUpload` - Drag-and-drop file handling
- `FilePreview` - File preview component
- `FileService.processDroppedFiles()` - Process dropped files
- `iconColors` - Consistent icon colors
- `Message.useMessage()` - Toast notifications

### New Components to Create:
- `UploadCaseFilesModal` - Main modal component
- `DocumentListItem` - Single document row in list
- `ProgressIndicator` - Progress bar with status

---

## Testing Strategy

### Unit Tests:
- Modal open/close behavior
- File upload logic
- WebSocket event handling
- Pagination logic

### Integration Tests:
- End-to-end upload flow
- Real-time progress updates
- Error handling

### Manual Testing:
- Drag-and-drop multiple files
- Click-to-browse file selection
- Progress updates in real-time
- Pagination navigation
- Error scenarios

---

## Estimated Effort

| Task | Complexity | Estimated Time |
|------|-----------|----------------|
| Task 1-2 | Low | 1 hour |
| Task 3-4 | Medium | 3 hours |
| Task 5-6 | High | 4 hours |
| Task 7 | Medium | 3 hours |
| Task 8-9 | Low | 1 hour |
| Task 10 | Medium | 2 hours |
| **Total** | | **14 hours** |

---

## Next Steps

1. Review and approve this implementation plan
2. Begin with Task 1 (Backend Verification)
3. Complete tasks sequentially
4. Test each task before moving to next
5. Document any deviations from plan

