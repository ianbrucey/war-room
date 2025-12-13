# Agent 2: Document List & Progress Tracking

## Your Mission

Build the document list component with real-time WebSocket progress updates, pagination, and action buttons (preview/download) for completed documents.

## Context

Agent 1 has created the modal shell and dropzone. Your job is to display the list of uploaded documents with real-time progress tracking via WebSocket.

**Read these files first:**
- `context-engine/specs/upload-case-files-modal/00-Brief.md` - Feature requirements
- `context-engine/specs/upload-case-files-modal/02-reusable-components.md` - WebSocket documentation
- `context-engine/specs/upload-case-files-modal/03-ui-component-structure.md` - Component architecture
- `src/webserver/websocket/documentProgress.ts` - WebSocket event types

## Your Tasks

### Task 1: Create WebSocket Progress Hook
**File:** `src/renderer/hooks/useWebSocketProgress.ts`

Create a hook to listen for document progress events:

```typescript
import { useEffect } from 'react';
import type { DocumentProgressEvent } from '@webserver/websocket/documentProgress';

interface UseWebSocketProgressOptions {
  caseFileId: string;
  enabled: boolean;
  onProgress: (event: DocumentProgressEvent) => void;
}

export const useWebSocketProgress = ({
  caseFileId,
  enabled,
  onProgress
}: UseWebSocketProgressOptions) => {
  useEffect(() => {
    if (!enabled) return;

    // Get WebSocket connection (assuming it's already established)
    const ws = (window as any).__websocket;
    if (!ws) {
      console.warn('[WebSocket] Connection not available');
      return;
    }

    // Subscribe to case file updates
    ws.send(JSON.stringify({
      type: 'subscribe-case-file',
      caseFileId
    }));

    // Listen for progress events
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === 'document:progress') {
          onProgress(data.data);
        }
      } catch (error) {
        console.error('[WebSocket] Failed to parse message:', error);
      }
    };

    ws.addEventListener('message', handleMessage);

    // Cleanup
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

**Acceptance Criteria:**
- [ ] Hook subscribes to case file on mount
- [ ] Hook listens for `document:progress` events
- [ ] Hook calls `onProgress` callback with event data
- [ ] Hook unsubscribes on unmount
- [ ] Hook handles missing WebSocket gracefully

---

### Task 2: Create Document List Section
**File:** `src/renderer/components/UploadCaseFilesModal/DocumentListSection.tsx`

Build the document list with tabs and pagination:

```typescript
import React, { useMemo } from 'react';
import { Tabs, Pagination } from '@arco-design/web-react';
import type { ICaseDocument } from '@process/documents/types';
import { DocumentListItem } from './DocumentListItem';

const { TabPane } = Tabs;

interface DocumentListSectionProps {
  documents: ICaseDocument[];
  activeTab: 'documents' | 'failed';
  onTabChange: (tab: 'documents' | 'failed') => void;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPreview: (documentId: string) => void;
  onDownload: (documentId: string) => void;
}

export const DocumentListSection: React.FC<DocumentListSectionProps> = ({
  documents,
  activeTab,
  onTabChange,
  page,
  pageSize,
  onPageChange,
  onPreview,
  onDownload
}) => {
  // Filter documents based on active tab
  const filteredDocuments = useMemo(() => {
    if (activeTab === 'failed') {
      return documents.filter(doc => doc.processing_status === 'failed');
    }
    return documents;
  }, [documents, activeTab]);

  // Paginate documents
  const paginatedDocuments = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filteredDocuments.slice(start, end);
  }, [filteredDocuments, page, pageSize]);

  const allDocsCount = documents.length;
  const failedDocsCount = documents.filter(doc => doc.processing_status === 'failed').length;

  return (
    <div className="document-list-section">
      <Tabs activeTab={activeTab} onChange={onTabChange}>
        <TabPane key="documents" title={`Documents (${allDocsCount})`}>
          <div className="document-list">
            {paginatedDocuments.map(doc => (
              <DocumentListItem
                key={doc.id}
                document={doc}
                onPreview={onPreview}
                onDownload={onDownload}
              />
            ))}
          </div>
        </TabPane>
        <TabPane key="failed" title={`Failed (${failedDocsCount})`}>
          <div className="document-list">
            {paginatedDocuments.map(doc => (
              <DocumentListItem
                key={doc.id}
                document={doc}
                onPreview={onPreview}
                onDownload={onDownload}
              />
            ))}
          </div>
        </TabPane>
      </Tabs>

      <Pagination
        current={page}
        pageSize={pageSize}
        total={filteredDocuments.length}
        onChange={onPageChange}
        showTotal
        sizeCanChange={false}
      />
    </div>
  );
};
```

**Acceptance Criteria:**
- [ ] Two tabs: "Documents" and "Failed"
- [ ] Tab counts show correct numbers
- [ ] Documents are filtered by tab
- [ ] Pagination works correctly
- [ ] 10 documents per page

---

### Task 3: Create Document List Item
**File:** `src/renderer/components/UploadCaseFilesModal/DocumentListItem.tsx`

Build individual document row with progress indicator and action buttons:

```typescript
import React from 'react';
import { Button, Badge } from '@arco-design/web-react';
import { Preview, Download } from '@icon-park/react';
import type { ICaseDocument, ProcessingStatus } from '@process/documents/types';
import { ProgressIndicator } from './ProgressIndicator';

interface DocumentListItemProps {
  document: ICaseDocument;
  onPreview: (documentId: string) => void;
  onDownload: (documentId: string) => void;
}

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

const getStatusLabel = (status: ProcessingStatus): string => {
  switch (status) {
    case 'pending': return 'Pending';
    case 'extracting': return 'Extracting';
    case 'analyzing': return 'Analyzing';
    case 'indexing': return 'Indexing';
    case 'complete': return 'Complete';
    case 'failed': return 'Failed';
    default: return 'Unknown';
  }
};

const formatTimestamp = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  
  if (minutes < 1) return 'Just now';
  if (minutes === 1) return '1 minute ago';
  if (minutes < 60) return `${minutes} minutes ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return '1 hour ago';
  if (hours < 24) return `${hours} hours ago`;
  
  return new Date(timestamp).toLocaleDateString();
};

export const DocumentListItem: React.FC<DocumentListItemProps> = ({
  document,
  onPreview,
  onDownload
}) => {
  const isComplete = document.processing_status === 'complete';

  return (
    <div className="document-list-item">
      <div className="file-icon">
        📄
      </div>
      
      <div className="file-info">
        <div className="file-name">{document.filename}</div>
        <div className="file-meta">
          {formatTimestamp(document.uploaded_at)}
        </div>
      </div>
      
      <div className="progress-section">
        <ProgressIndicator
          status={document.processing_status}
        />
      </div>
      
      <div className="status-badge">
        <Badge status={getStatusColor(document.processing_status)} text={getStatusLabel(document.processing_status)} />
      </div>
      
      {isComplete && (
        <div className="action-buttons">
          <Button
            type="text"
            icon={<Preview />}
            onClick={() => onPreview(document.id)}
          >
            Preview
          </Button>
          <Button
            type="text"
            icon={<Download />}
            onClick={() => onDownload(document.id)}
          >
            Download
          </Button>
        </div>
      )}
    </div>
  );
};
```

**Styling:** Add to `styles.css`:

```css
.document-list-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.document-list {
  flex: 1;
  overflow-y: auto;
  max-height: 400px;
}

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

.file-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.file-info {
  flex: 1;
}

.file-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-1);
  margin-bottom: 4px;
}

.file-meta {
  font-size: 12px;
  color: var(--color-text-3);
}

.progress-section {
  width: 200px;
}

.action-buttons {
  display: flex;
  gap: 8px;
}
```

**Acceptance Criteria:**
- [ ] Document list displays all documents
- [ ] Each item shows filename, timestamp, progress, status
- [ ] Completed documents show Preview and Download buttons
- [ ] Hover effect on list items
- [ ] Status badges use correct colors

---

### Task 4: Create Progress Indicator
**File:** `src/renderer/components/UploadCaseFilesModal/ProgressIndicator.tsx`

```typescript
import React from 'react';
import { Progress } from '@arco-design/web-react';
import type { ProcessingStatus } from '@process/documents/types';

interface ProgressIndicatorProps {
  status: ProcessingStatus;
}

const getProgress = (status: ProcessingStatus): number => {
  switch (status) {
    case 'pending': return 10;
    case 'extracting': return 30;
    case 'analyzing': return 60;
    case 'indexing': return 85;
    case 'complete': return 100;
    case 'failed': return 0;
    default: return 0;
  }
};

const getProgressColor = (status: ProcessingStatus): string => {
  if (status === 'complete') return 'green';
  if (status === 'failed') return 'red';
  return 'blue';
};

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ status }) => {
  const progress = getProgress(status);
  const color = getProgressColor(status);

  return (
    <Progress
      percent={progress}
      status={status === 'failed' ? 'error' : undefined}
      color={color}
      size="small"
    />
  );
};
```

**Acceptance Criteria:**
- [ ] Progress bar shows correct percentage
- [ ] Colors match status (blue=processing, green=complete, red=failed)
- [ ] Progress updates in real-time

---

### Task 5: Integrate WebSocket in Main Modal

Update `UploadCaseFilesModal/index.tsx` to use the WebSocket hook:

```typescript
import { useWebSocketProgress } from '@/renderer/hooks/useWebSocketProgress';

// Inside component:
const handleProgressUpdate = useCallback((event: DocumentProgressEvent) => {
  setDocuments(prev => prev.map(doc => 
    doc.id === event.documentId 
      ? { ...doc, processing_status: event.type.replace('document:', '') as ProcessingStatus }
      : doc
  ));
}, []);

useWebSocketProgress({
  caseFileId,
  enabled: visible,
  onProgress: handleProgressUpdate
});
```

**Acceptance Criteria:**
- [ ] WebSocket subscribes when modal opens
- [ ] Progress events update document status
- [ ] WebSocket unsubscribes when modal closes
- [ ] UI updates in real-time

---

## Reusable Components

**You MUST use:**
- `Tabs`, `Pagination`, `Badge`, `Button`, `Progress` from `@arco-design/web-react`
- Icons from `@icon-park/react`

---

## Testing

1. Upload a document
2. Watch progress update in real-time
3. Verify status changes: pending → extracting → analyzing → indexing → complete
4. Check that Preview/Download buttons appear when complete
5. Test pagination with 10+ documents
6. Test "Failed" tab filtering

---

## Handoff to Next Agent

Once complete, the next agent will:
- Add the upload button to workspace panel
- Wire up preview/download functionality
- Add error handling

Your components should export:
- `useWebSocketProgress` hook
- `DocumentListSection` component
- `DocumentListItem` component
- `ProgressIndicator` component

