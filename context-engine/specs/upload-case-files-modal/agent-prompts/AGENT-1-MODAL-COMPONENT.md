# Agent 1: Modal Component & Dropzone

## Your Mission

Build the `UploadCaseFilesModal` component with drag-and-drop file upload functionality. This is the main modal container that users will interact with to upload case documents.

## Context

You are building a feature for AionUI, a legal case management application. The document intake pipeline (API + WebSocket progress) already exists. Your job is to create the UI entry point.

**Read these files first:**
- `context-engine/specs/upload-case-files-modal/00-Brief.md` - Feature requirements
- `context-engine/specs/upload-case-files-modal/02-reusable-components.md` - Existing infrastructure
- `context-engine/specs/upload-case-files-modal/03-ui-component-structure.md` - Component architecture
- `context-engine/specs/upload-case-files-modal/04-html-mockup.html` - Visual reference

## Your Tasks

### Task 1: Create Modal Component Shell
**File:** `src/renderer/components/UploadCaseFilesModal/index.tsx`

Create the main modal component using `ModalWrapper`:

```typescript
import React, { useState, useCallback } from 'react';
import { ModalWrapper } from '@/renderer/components/base/ModalWrapper';
import type { ICaseDocument } from '@process/documents/types';

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
  const [documents, setDocuments] = useState<ICaseDocument[]>([]);
  const [uploading, setUploading] = useState<Map<string, number>>(new Map());

  return (
    <ModalWrapper
      visible={visible}
      onCancel={onClose}
      title="Upload Case Files"
      style={{ width: '90vw', height: '90vh' }}
      showCustomClose={true}
    >
      <div className="upload-modal-body">
        {/* Dropzone will go here */}
        {/* Document list will go here */}
      </div>
    </ModalWrapper>
  );
};
```

**Acceptance Criteria:**
- [ ] Modal renders when `visible={true}`
- [ ] Modal closes when clicking X button
- [ ] Modal closes when pressing ESC key
- [ ] Modal has title "Upload Case Files"
- [ ] Modal is 90vw x 90vh

---

### Task 2: Create Dropzone Component
**File:** `src/renderer/components/UploadCaseFilesModal/DropzoneSection.tsx`

Implement drag-and-drop file upload using the existing `useDragUpload` hook:

```typescript
import React, { useRef, useCallback } from 'react';
import { Button } from '@arco-design/web-react';
import { FileAddition } from '@icon-park/react';
import { useDragUpload } from '@/renderer/hooks/useDragUpload';
import { iconColors } from '@/renderer/utils/iconColors';
import type { FileMetadata } from '@/renderer/services/FileService';

interface DropzoneSectionProps {
  onFilesAdded: (files: FileMetadata[]) => void;
}

export const DropzoneSection: React.FC<DropzoneSectionProps> = ({
  onFilesAdded
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { isFileDragging, dragHandlers } = useDragUpload({
    supportedExts: ['pdf', 'docx', 'txt', 'md', 'jpg', 'png', 'mp3', 'wav', 'm4a'],
    onFilesAdded
  });

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const { FileService } = await import('@/renderer/services/FileService');
      const processedFiles = await FileService.processDroppedFiles(files);
      onFilesAdded(processedFiles);
    }
  }, [onFilesAdded]);

  return (
    <div className="dropzone-section p-24px">
      <div
        {...dragHandlers}
        className={`dropzone ${isFileDragging ? 'dragging' : ''}`}
      >
        <FileAddition size={48} fill={iconColors.secondary} />
        <h3 className="dropzone-title">Drag and drop files here</h3>
        <p className="dropzone-subtitle">or</p>
        <Button type="primary" onClick={handleBrowseClick}>
          Browse Files
        </Button>
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
  );
};
```

**Styling:** Create `src/renderer/components/UploadCaseFilesModal/styles.css`:

```css
.dropzone-section {
  padding: 24px;
}

.dropzone {
  border: 2px dashed var(--color-border-2);
  border-radius: 8px;
  padding: 48px;
  text-align: center;
  transition: all 0.3s;
  cursor: pointer;
}

.dropzone:hover {
  border-color: var(--color-primary-6);
  background-color: var(--color-primary-light-1);
}

.dropzone.dragging {
  border-color: var(--color-primary-6);
  background-color: var(--color-primary-light-1);
}

.dropzone-title {
  font-size: 16px;
  font-weight: 500;
  color: var(--color-text-1);
  margin: 16px 0 8px;
}

.dropzone-subtitle {
  font-size: 14px;
  color: var(--color-text-3);
  margin-bottom: 16px;
}

.supported-formats {
  margin-top: 12px;
  font-size: 12px;
  color: var(--color-text-3);
  text-align: center;
}
```

**Acceptance Criteria:**
- [ ] Dropzone displays at top of modal
- [ ] Drag-and-drop works for multiple files
- [ ] Click-to-browse opens file picker
- [ ] Only supported file types are accepted
- [ ] Visual feedback when dragging files over zone
- [ ] Instructions text is clear and visible

---

### Task 3: Implement File Upload Logic

Add upload functionality to the main modal component:

```typescript
const uploadFile = async (file: FileMetadata): Promise<string | null> => {
  try {
    // Get auth token
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('Not authenticated');
    }

    // Create FormData
    const formData = new FormData();
    const blob = await fetch(file.path).then(r => r.blob());
    formData.append('file', blob, file.name);

    // Upload to backend
    const response = await fetch(
      `/api/cases/${caseFileId}/documents/upload`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      }
    );

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    const result = await response.json();
    return result.documentId;
  } catch (error) {
    console.error('[UploadModal] Upload error:', error);
    Message.error(`Failed to upload ${file.name}`);
    return null;
  }
};

const handleFilesAdded = useCallback(async (files: FileMetadata[]) => {
  for (const file of files) {
    const documentId = await uploadFile(file);
    if (documentId) {
      // Add to documents list with pending status
      setDocuments(prev => [...prev, {
        id: documentId,
        case_file_id: caseFileId,
        filename: file.name,
        folder_name: file.name.replace(/[^a-zA-Z0-9.-]/g, '_'),
        file_type: file.name.split('.').pop() || 'unknown',
        processing_status: 'pending',
        has_text_extraction: 0,
        has_metadata: 0,
        rag_indexed: 0,
        uploaded_at: Date.now()
      }]);
    }
  }
}, [caseFileId]);
```

**Acceptance Criteria:**
- [ ] Files upload to backend API successfully
- [ ] Upload errors are caught and displayed
- [ ] Multiple files can upload simultaneously
- [ ] Document ID is returned from API
- [ ] Documents are added to local state

---

## Reusable Components

**You MUST use these existing components:**
- `ModalWrapper` from `@/renderer/components/base/ModalWrapper`
- `useDragUpload` hook from `@/renderer/hooks/useDragUpload`
- `FileService` from `@/renderer/services/FileService`
- `Button` from `@arco-design/web-react`
- `Message` from `@arco-design/web-react`
- Icons from `@icon-park/react`

**Do NOT create:**
- Custom modal component (use ModalWrapper)
- Custom drag-drop logic (use useDragUpload)
- Custom file processing (use FileService)

---

## Testing

Test your component manually:
1. Open the modal
2. Drag and drop multiple PDF files
3. Verify files upload to backend
4. Check browser console for errors
5. Verify modal closes correctly

---

## Handoff to Next Agent

Once complete, the next agent will:
- Add WebSocket progress tracking
- Build the document list component
- Add pagination and filtering

Your component should export:
- `UploadCaseFilesModal` (main component)
- `DropzoneSection` (dropzone component)

---

## Questions?

If you encounter issues:
1. Check `02-reusable-components.md` for API documentation
2. Look at existing modal usage in `ChatWorkspace.tsx`
3. Review `useDragUpload` hook implementation
4. Test the upload API with curl first (see `00-Brief.md`)

