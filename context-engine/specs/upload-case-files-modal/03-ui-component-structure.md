# UI Component Structure - Upload Case Files Feature

## Component Hierarchy

```
ChatWorkspace (existing)
└── UploadCaseFilesModal (new)
    ├── ModalWrapper (existing)
    │   ├── Header
    │   │   └── Title: "Upload Case Files"
    │   ├── Body
    │   │   ├── DropzoneSection (new)
    │   │   │   ├── DropzoneArea (uses useDragUpload)
    │   │   │   └── FileUploadButton
    │   │   └── DocumentListSection (new)
    │   │       ├── FilterTabs (Documents / Failed)
    │   │       ├── DocumentList
    │   │       │   └── DocumentListItem[] (new)
    │   │       │       ├── FileIcon
    │   │       │       ├── FileName
    │   │       │       ├── ProgressIndicator (new)
    │   │       │       ├── StatusBadge
    │   │       │       ├── Timestamp
    │   │       │       └── ActionButtons (Preview + Download for completed docs)
    │   │       └── Pagination
    │   └── Footer
    │       └── CloseButton
    └── WebSocketListener (hook)
```

---

## Component Specifications

### 1. UploadCaseFilesModal (Main Component)

**File:** `src/renderer/components/UploadCaseFilesModal.tsx`

**Props:**
```typescript
interface UploadCaseFilesModalProps {
  visible: boolean;
  caseFileId: string;
  onClose: () => void;
}
```

**State:**
```typescript
const [documents, setDocuments] = useState<ICaseDocument[]>([]);
const [uploading, setUploading] = useState<Map<string, number>>(new Map());
const [activeTab, setActiveTab] = useState<'documents' | 'failed'>('documents');
const [page, setPage] = useState(1);
const [loading, setLoading] = useState(false);
```

**Hooks:**
```typescript
const { isFileDragging, dragHandlers } = useDragUpload({
  supportedExts: ['pdf', 'docx', 'txt', 'md', 'jpg', 'png', 'mp3', 'wav', 'm4a'],
  onFilesAdded: handleFilesAdded
});

useWebSocketProgress(caseFileId, visible, handleProgressUpdate);
```

**Key Methods:**
```typescript
const handleFilesAdded = async (files: FileMetadata[]) => {
  for (const file of files) {
    await uploadFile(file);
  }
};

const uploadFile = async (file: FileMetadata) => {
  // Upload to backend API
  // Track upload progress
  // Add to documents list
};

const handleProgressUpdate = (event: DocumentProgressEvent) => {
  // Update document status in real-time
  setDocuments(prev => prev.map(doc => 
    doc.id === event.documentId 
      ? { ...doc, processing_status: event.type, progress: event.progress }
      : doc
  ));
};

const fetchDocuments = async () => {
  // Fetch documents from API
  const response = await fetch(`/api/cases/${caseFileId}/documents`);
  const docs = await response.json();
  setDocuments(docs);
};
```

---

### 2. DropzoneSection Component

**File:** `src/renderer/components/UploadCaseFilesModal/DropzoneSection.tsx`

**Props:**
```typescript
interface DropzoneSectionProps {
  isFileDragging: boolean;
  dragHandlers: DragHandlers;
  onFilesSelected: (files: FileList) => void;
}
```

**Layout:**
```tsx
<div className="dropzone-section p-24px">
  <div
    {...dragHandlers}
    className={`dropzone ${isFileDragging ? 'dragging' : ''}`}
  >
    <FileAddition size={48} fill={iconColors.secondary} />
    <h3>Drag and drop files here</h3>
    <p>or</p>
    <Button onClick={handleBrowseClick}>Browse Files</Button>
    <input
      ref={fileInputRef}
      type="file"
      multiple
      accept=".pdf,.docx,.txt,.md,.jpg,.png,.mp3,.wav,.m4a"
      onChange={handleFileChange}
      style={{ display: 'none' }}
    />
  </div>
  <div className="supported-formats">
    Supported formats: PDF, DOCX, TXT, MD, JPG, PNG, MP3, WAV, M4A
  </div>
</div>
```

**Styling:**
```css
.dropzone {
  border: 2px dashed var(--color-border-2);
  border-radius: 8px;
  padding: 48px;
  text-align: center;
  transition: all 0.3s;
}

.dropzone.dragging {
  border-color: var(--color-primary-6);
  background-color: var(--color-primary-light-1);
}
```

---

### 3. DocumentListSection Component

**File:** `src/renderer/components/UploadCaseFilesModal/DocumentListSection.tsx`

**Props:**
```typescript
interface DocumentListSectionProps {
  documents: ICaseDocument[];
  activeTab: 'documents' | 'failed';
  onTabChange: (tab: 'documents' | 'failed') => void;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}
```

**Layout:**
```tsx
<div className="document-list-section">
  <div className="filter-tabs">
    <Tabs activeTab={activeTab} onChange={onTabChange}>
      <TabPane key="documents" title={`Documents (${allDocsCount})`} />
      <TabPane key="failed" title={`Failed (${failedDocsCount})`} />
    </Tabs>
  </div>
  
  <div className="document-list">
    {paginatedDocuments.map(doc => (
      <DocumentListItem key={doc.id} document={doc} />
    ))}
  </div>
  
  <Pagination
    current={page}
    pageSize={pageSize}
    total={filteredDocuments.length}
    onChange={onPageChange}
  />
</div>
```

---

### 4. DocumentListItem Component

**File:** `src/renderer/components/UploadCaseFilesModal/DocumentListItem.tsx`

**Props:**
```typescript
interface DocumentListItemProps {
  document: ICaseDocument;
}
```

**Layout:**
```tsx
<div className="document-list-item">
  <div className="file-icon">
    <FileIcon type={document.file_type} />
  </div>

  <div className="file-info">
    <div className="file-name">{document.filename}</div>
    <div className="file-meta">
      {formatFileSize(document.file_size)} •
      {formatTimestamp(document.uploaded_at)}
    </div>
  </div>

  <div className="progress-section">
    <ProgressIndicator
      status={document.processing_status}
      progress={getProgressFromStatus(document.processing_status)}
    />
  </div>

  <div className="status-badge">
    <StatusBadge status={document.processing_status} />
  </div>

  {document.processing_status === 'complete' && (
    <div className="action-buttons">
      <Button
        icon={<Preview />}
        onClick={() => handlePreview(document.id)}
      >
        Preview
      </Button>
      <Button
        icon={<Download />}
        onClick={() => handleDownload(document.id)}
      >
        Download
      </Button>
    </div>
  )}
</div>
```

**Styling:**
```css
.document-list-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border-2);
  transition: background-color 0.2s;
}

.document-list-item:hover {
  background-color: var(--color-fill-2);
}
```

---

### 5. ProgressIndicator Component

**File:** `src/renderer/components/UploadCaseFilesModal/ProgressIndicator.tsx`

**Props:**
```typescript
interface ProgressIndicatorProps {
  status: ProcessingStatus;
  progress: number;  // 0-100
}
```

**Layout:**
```tsx
<div className="progress-indicator">
  <div className="progress-bar-container">
    <div
      className={`progress-bar ${getStatusColor(status)}`}
      style={{ width: `${progress}%` }}
    />
  </div>
  <div className="progress-text">
    {progress}% • {getStatusLabel(status)}
  </div>
</div>
```

**Status Colors:**
```typescript
const getStatusColor = (status: ProcessingStatus): string => {
  switch (status) {
    case 'pending': return 'gray';
    case 'extracting': return 'blue';
    case 'analyzing': return 'blue';
    case 'indexing': return 'blue';
    case 'complete': return 'green';
    case 'failed': return 'red';
    default: return 'gray';
  }
};
```

---

### 6. useWebSocketProgress Hook

**File:** `src/renderer/hooks/useWebSocketProgress.ts`

**Usage:**
```typescript
const useWebSocketProgress = (
  caseFileId: string,
  enabled: boolean,
  onProgress: (event: DocumentProgressEvent) => void
) => {
  useEffect(() => {
    if (!enabled) return;

    const ws = getWebSocketConnection();
    
    // Subscribe to case file
    ws.send(JSON.stringify({
      type: 'subscribe-case-file',
      caseFileId
    }));

    // Listen for progress events
    const handleMessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      if (data.event === 'document:progress') {
        onProgress(data.data);
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
  }, [caseFileId, enabled, onProgress]);
};
```

---

## State Management Strategy

### Local Component State (useState)
- `documents` - List of documents
- `uploading` - Map of document IDs to upload progress
- `filter` - Current filter selection
- `page` - Current page number
- `loading` - Loading state for API calls

### WebSocket State (useEffect)
- Subscribe/unsubscribe on mount/unmount
- Update document status in real-time
- Handle reconnection on disconnect

### API State (useEffect)
- Fetch documents on modal open
- Refresh after upload completes
- Poll for updates if WebSocket unavailable

---

## Event Flow

### Upload Flow:
1. User drops files or clicks browse
2. `useDragUpload` validates file types
3. `handleFilesAdded` called with FileMetadata[]
4. For each file:
   - Call `uploadFile(file)`
   - Show upload progress
   - Add to documents list with status "pending"
5. Backend starts processing
6. WebSocket events update status in real-time

### Progress Update Flow:
1. Backend emits `document:progress` event
2. WebSocket receives event
3. `useWebSocketProgress` hook calls `onProgress`
4. `handleProgressUpdate` updates document in state
5. UI re-renders with new status/progress

---

## Accessibility

- Modal is keyboard-accessible (Tab, ESC)
- Dropzone has ARIA labels
- Progress indicators have ARIA live regions
- Status badges have semantic colors + text labels
- Focus management on modal open/close

---

## Responsive Design

- Modal scales to 90vw x 90vh on all screen sizes
- Document list scrolls independently
- Pagination adapts to available space
- Mobile: Stack file info vertically

---

## Performance Optimizations

- Virtualized list for 1000+ documents (react-window)
- Debounced filter/search
- Memoized document list items
- Lazy load document details on demand
- WebSocket event throttling (max 10 updates/sec)

