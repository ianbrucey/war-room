# Reusable Components & APIs - Upload Case Files Feature

## Overview

This document identifies existing components, APIs, hooks, and utilities that can be reused for the "Upload Case Files" feature. Following the DRY (Don't Repeat Yourself) principle, we maximize code reuse to reduce development time and maintain consistency.

---

## Backend APIs (Already Implemented)

### 1. Document Upload API
**File:** `src/webserver/routes/documentRoutes.ts` (lines 23-79)

**Endpoint:** `POST /api/cases/:caseFileId/documents/upload`

**Usage:**
```typescript
const formData = new FormData();
formData.append('file', fileBlob, filename);

const response = await fetch(
  `/api/cases/${caseFileId}/documents/upload`,
  {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  }
);

const { documentId } = await response.json();
```

**What it does:**
- Accepts multipart/form-data file upload
- Saves file to `{workspace}/documents/originals/`
- Creates document record in database
- Starts async text extraction pipeline
- Returns document ID

**Authentication:** Requires JWT token in Authorization header

---

### 2. List Documents API
**File:** `src/webserver/routes/documentRoutes.ts` (lines 81-90)

**Endpoint:** `GET /api/cases/:caseFileId/documents`

**Usage:**
```typescript
const response = await fetch(
  `/api/cases/${caseFileId}/documents`,
  {
    headers: { 'Authorization': `Bearer ${token}` }
  }
);

const documents: ICaseDocument[] = await response.json();
```

**What it does:**
- Returns all documents for a case file
- Includes: id, filename, status, progress, timestamps
- Sorted by upload timestamp (newest first)

---

### 3. Get Document Details API
**File:** `src/webserver/routes/documentRoutes.ts` (lines 92-105)

**Endpoint:** `GET /api/documents/:documentId`

**Usage:**
```typescript
const response = await fetch(
  `/api/documents/${documentId}`,
  {
    headers: { 'Authorization': `Bearer ${token}` }
  }
);

const document: ICaseDocument = await response.json();
```

**What it does:**
- Returns single document details
- Includes extracted text, analysis, metadata

---

### 4. Document Statistics API
**File:** `src/webserver/routes/documentRoutes.ts` (lines 118-127)

**Endpoint:** `GET /api/cases/:caseFileId/documents/stats`

**Usage:**
```typescript
const response = await fetch(
  `/api/cases/${caseFileId}/documents/stats`,
  {
    headers: { 'Authorization': `Bearer ${token}` }
  }
);

const stats = await response.json();
// { total, pending, extracting, analyzing, indexing, complete, failed }
```

**What it does:**
- Returns document counts by status
- Useful for showing summary statistics

---

## WebSocket Progress System (Already Implemented)

### 1. Document Progress Events
**File:** `src/webserver/websocket/documentProgress.ts`

**Event Type:** `document:progress`

**Event Structure:**
```typescript
interface DocumentProgressEvent {
  type: 'document:upload' | 'document:extracting' | 'document:analyzing' 
      | 'document:indexing' | 'document:complete' | 'document:error';
  documentId: string;
  caseFileId: string;
  filename: string;
  progress: number;  // 0-100
  message: string;
  error?: string;
  timestamp: number;
}
```

**Progress Mapping:**
- `pending` → 10%
- `extracting` → 30%
- `analyzing` → 60%
- `indexing` → 85%
- `complete` → 100%
- `failed` → 0%

**Usage:**
```typescript
// Subscribe to case file updates
ws.send(JSON.stringify({
  type: 'subscribe-case-file',
  caseFileId: 'case_123'
}));

// Listen for progress events
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.event === 'document:progress') {
    const progressEvent: DocumentProgressEvent = data.data;
    updateDocumentStatus(progressEvent);
  }
};
```

---

## Frontend Components (Already Implemented)

### 1. ModalWrapper Component
**File:** `src/renderer/components/base/ModalWrapper.tsx`

**Usage:**
```typescript
import { ModalWrapper } from '@/renderer/components/base/ModalWrapper';

<ModalWrapper
  visible={visible}
  onCancel={onClose}
  title="Upload Case Files"
  style={{ width: '90vw', height: '90vh' }}
  showCustomClose={true}
>
  {/* Modal content */}
</ModalWrapper>
```

**Features:**
- Custom close button with Close icon
- 12px border radius
- Consistent styling with app theme
- ESC key to close
- Click outside to close

---

### 2. useDragUpload Hook
**File:** `src/renderer/hooks/useDragUpload.ts`

**Usage:**
```typescript
import { useDragUpload } from '@/renderer/hooks/useDragUpload';

const { isFileDragging, dragHandlers } = useDragUpload({
  supportedExts: ['pdf', 'docx', 'txt', 'md', 'jpg', 'png'],
  onFilesAdded: (files: FileMetadata[]) => {
    // Handle dropped files
    files.forEach(file => uploadFile(file));
  }
});

// Apply to dropzone element
<div {...dragHandlers} className={isFileDragging ? 'dragging' : ''}>
  Drag files here
</div>
```

**Features:**
- Drag counter to prevent flickering
- File type validation
- Processes dropped files via FileService
- Returns drag state and event handlers

---

### 3. FileService
**File:** `src/renderer/services/FileService.ts`

**Usage:**
```typescript
import { FileService } from '@/renderer/services/FileService';

// Process dropped files
const processedFiles = await FileService.processDroppedFiles(fileList);

// Each file has: name, path, size, type, lastModified
processedFiles.forEach(file => {
  console.log(file.name, file.size);
});
```

**Features:**
- Creates temp files for files without valid paths
- Extracts file metadata
- Handles file system operations

---

### 4. FilePreview Component
**File:** `src/renderer/components/FilePreview.tsx`

**Usage:**
```typescript
import { FilePreview } from '@/renderer/components/FilePreview';

<FilePreview
  file={fileMetadata}
  onRemove={() => removeFile(fileMetadata.id)}
/>
```

**Features:**
- Shows file icon based on type
- Displays filename and size
- Remove button
- Consistent styling

---

### 5. Icon Library
**Package:** `@icon-park/react`

**Commonly Used Icons:**
```typescript
import {
  FileAddition,    // Upload button
  Refresh,         // Refresh button
  Close,           // Close button
  CheckOne,        // Success indicator
  CloseOne,        // Error indicator
  Loading,         // Loading spinner
  FolderOpen,      // Folder icon
  FileText         // Document icon
} from '@icon-park/react';
```

**Usage:**
```typescript
<FileAddition
  theme='outline'
  size='16'
  fill={iconColors.secondary}
  onClick={handleClick}
/>
```

---

## Utility Functions & Hooks

### 1. iconColors
**File:** `src/renderer/utils/iconColors.ts`

**Usage:**
```typescript
import { iconColors } from '@/renderer/utils/iconColors';

<Icon fill={iconColors.primary} />
<Icon fill={iconColors.secondary} />
<Icon fill={iconColors.tertiary} />
```

---

### 2. Message (Toast Notifications)
**Package:** `@arco-design/web-react`

**Usage:**
```typescript
import { Message } from '@arco-design/web-react';

Message.success('Upload complete!');
Message.error('Upload failed');
Message.warning('File too large');
Message.info('Processing...');
```

---

### 3. Tooltip Component
**Package:** `@arco-design/web-react`

**Usage:**
```typescript
import { Tooltip } from '@arco-design/web-react';

<Tooltip content="Upload Case Files">
  <span>
    <FileAddition onClick={handleClick} />
  </span>
</Tooltip>
```

---

## Database Types (Already Defined)

### ICaseDocument Interface
**File:** `src/process/documents/types.ts` (lines 26-74)

```typescript
interface ICaseDocument {
  id: string;
  case_file_id: string;
  filename: string;
  folder_name: string;
  document_type?: string | null;
  file_type: string;
  page_count?: number | null;
  word_count?: number | null;
  processing_status: ProcessingStatus;
  has_text_extraction: number;
  has_metadata: number;
  rag_indexed: number;
  file_search_store_id?: string | null;
  gemini_file_uri?: string | null;
  uploaded_at: number;
  processed_at?: number | null;
}
```

### ProcessingStatus Type
**File:** `src/process/documents/types.ts` (line 10)

```typescript
type ProcessingStatus = 'pending' | 'extracting' | 'analyzing' | 'indexing' | 'complete' | 'failed';
```

---

## Summary: What We DON'T Need to Build

✅ **Backend APIs** - All document upload/list/get endpoints exist
✅ **WebSocket Progress** - Real-time progress events already implemented
✅ **Modal Component** - ModalWrapper provides consistent modal UI
✅ **Drag-and-Drop** - useDragUpload hook handles all drag-drop logic
✅ **File Processing** - FileService handles file metadata extraction
✅ **Icons** - @icon-park/react provides all needed icons
✅ **Notifications** - Arco Message component for toast notifications
✅ **Database Schema** - case_documents table and types already defined

## What We DO Need to Build

❌ **UploadCaseFilesModal Component** - Main modal component (new)
❌ **Document List Component** - Paginated list of documents (new)
❌ **Progress Indicator Component** - Visual progress bar (new)
❌ **WebSocket Integration** - Connect modal to WebSocket events (new)
❌ **Upload Button in Workspace** - Entry point to open modal (new)

---

## Conclusion

**Reuse Ratio: ~70%**

The majority of the infrastructure already exists. We primarily need to:
1. Create the modal UI component
2. Wire up existing APIs and WebSocket events
3. Add the entry point button to workspace panel

This significantly reduces development time and ensures consistency with the existing codebase.

