# Agent 3: Integration & Polish

## Your Mission

Integrate the upload modal into the workspace panel, implement preview/download functionality, and add comprehensive error handling.

## Context

Agents 1 and 2 have built the modal component with dropzone and document list. Your job is to wire everything together and make it production-ready.

**Read these files first:**
- `context-engine/specs/upload-case-files-modal/00-Brief.md` - Feature requirements
- `context-engine/specs/upload-case-files-modal/01-implementation-plan.md` - Task 10 (error handling)
- `src/renderer/pages/conversation/ChatWorkspace.tsx` - Where to add the button

## Your Tasks

### Task 1: Add Upload Button to Workspace Panel
**File:** `src/renderer/pages/conversation/ChatWorkspace.tsx`

Find the workspace header (around line 921-936) and add the upload button:

```typescript
import { UploadCaseFilesModal } from '@/renderer/components/UploadCaseFilesModal';

// Inside component:
const [uploadModalVisible, setUploadModalVisible] = useState(false);

// In the header section (after Refresh icon):
<Tooltip content={t('conversation.workspace.uploadCaseFiles')}>
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

// At the end of the component (before closing tag):
<UploadCaseFilesModal
  visible={uploadModalVisible}
  caseFileId={currentCaseFileId}
  onClose={() => setUploadModalVisible(false)}
/>
```

**Acceptance Criteria:**
- [ ] Button appears next to File and Refresh icons
- [ ] Button uses `FileAddition` icon
- [ ] Tooltip shows "Upload Case Files"
- [ ] Clicking button opens modal
- [ ] Modal closes correctly

---

### Task 2: Implement Preview Functionality

Add preview handler to `UploadCaseFilesModal/index.tsx`:

```typescript
import { Modal } from '@arco-design/web-react';

const handlePreview = useCallback(async (documentId: string) => {
  try {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`/api/documents/${documentId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch document');
    }

    const document = await response.json();

    // Show preview modal with extracted text
    Modal.info({
      title: document.filename,
      content: (
        <div style={{ maxHeight: '400px', overflow: 'auto' }}>
          <h4>Extracted Text:</h4>
          <pre style={{ whiteSpace: 'pre-wrap' }}>
            {document.extracted_text || 'No text extracted yet'}
          </pre>
          
          {document.analysis && (
            <>
              <h4>Analysis:</h4>
              <pre style={{ whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(document.analysis, null, 2)}
              </pre>
            </>
          )}
        </div>
      ),
      style: { width: '80vw' }
    });
  } catch (error) {
    console.error('[Preview] Error:', error);
    Message.error('Failed to preview document');
  }
}, []);
```

**Acceptance Criteria:**
- [ ] Preview button opens modal with document details
- [ ] Shows extracted text
- [ ] Shows analysis results
- [ ] Handles errors gracefully

---

### Task 3: Implement Download Functionality

Add download handler to `UploadCaseFilesModal/index.tsx`:

```typescript
const handleDownload = useCallback(async (documentId: string) => {
  try {
    const token = localStorage.getItem('auth_token');
    
    // Get document details first
    const docResponse = await fetch(`/api/documents/${documentId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!docResponse.ok) {
      throw new Error('Failed to fetch document');
    }

    const document = await docResponse.json();

    // Download the original file
    const fileResponse = await fetch(`/api/documents/${documentId}/download`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!fileResponse.ok) {
      throw new Error('Failed to download file');
    }

    const blob = await fileResponse.blob();
    const url = window.URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = document.filename;
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    Message.success(`Downloaded ${document.filename}`);
  } catch (error) {
    console.error('[Download] Error:', error);
    Message.error('Failed to download document');
  }
}, []);
```

**Note:** You may need to add a download endpoint to the backend:

**File:** `src/webserver/routes/documentRoutes.ts`

```typescript
router.get('/documents/:documentId/download', async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const document = DocumentRepository.findById(documentId);
    
    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    const caseFile = CaseFileRepository.findById(document.case_file_id);
    if (!caseFile) {
      res.status(404).json({ error: 'Case file not found' });
      return;
    }

    const filePath = path.join(
      caseFile.workspace_path,
      'documents',
      'originals',
      document.filename
    );

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    res.download(filePath, document.filename);
  } catch (error) {
    console.error('[DocumentIntake] Download error:', error);
    res.status(500).json({ error: 'Failed to download document' });
  }
});
```

**Acceptance Criteria:**
- [ ] Download button downloads original file
- [ ] File downloads with correct filename
- [ ] Success message appears
- [ ] Handles errors gracefully

---

### Task 4: Add Comprehensive Error Handling

Update `UploadCaseFilesModal/index.tsx` with error handling:

```typescript
const [errors, setErrors] = useState<Map<string, string>>(new Map());

const uploadFile = async (file: FileMetadata): Promise<string | null> => {
  try {
    // Validate file size (max 100MB)
    if (file.size > 100 * 1024 * 1024) {
      throw new Error('File size exceeds 100MB limit');
    }

    // Get auth token
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('Not authenticated. Please log in again.');
    }

    // Create FormData
    const formData = new FormData();
    const blob = await fetch(file.path).then(r => r.blob());
    formData.append('file', blob, file.name);

    // Upload with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 min timeout

    const response = await fetch(
      `/api/cases/${caseFileId}/documents/upload`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
        signal: controller.signal
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Upload failed: ${response.statusText}`);
    }

    const result = await response.json();
    
    // Clear any previous errors for this file
    setErrors(prev => {
      const next = new Map(prev);
      next.delete(file.name);
      return next;
    });

    return result.documentId;
  } catch (error) {
    console.error('[UploadModal] Upload error:', error);
    
    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorMessage = 'Upload timeout (file too large or slow connection)';
      } else {
        errorMessage = error.message;
      }
    }

    // Store error for this file
    setErrors(prev => {
      const next = new Map(prev);
      next.set(file.name, errorMessage);
      return next;
    });

    Message.error(`Failed to upload ${file.name}: ${errorMessage}`);
    return null;
  }
};

// Add retry functionality
const handleRetry = useCallback(async (documentId: string) => {
  const document = documents.find(doc => doc.id === documentId);
  if (!document) return;

  // Reset status to pending
  setDocuments(prev => prev.map(doc =>
    doc.id === documentId
      ? { ...doc, processing_status: 'pending' }
      : doc
  ));

  // Trigger re-processing on backend
  try {
    const token = localStorage.getItem('auth_token');
    await fetch(`/api/documents/${documentId}/retry`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    Message.success('Retrying document processing');
  } catch (error) {
    console.error('[Retry] Error:', error);
    Message.error('Failed to retry processing');
  }
}, [documents]);
```

**Error Scenarios to Handle:**
- [ ] File too large (>100MB)
- [ ] Network timeout
- [ ] Authentication failure
- [ ] Server error (500)
- [ ] Invalid file type
- [ ] WebSocket disconnection
- [ ] Case file not found

**Acceptance Criteria:**
- [ ] File size validation before upload
- [ ] Upload timeout after 2 minutes
- [ ] Clear error messages for each scenario
- [ ] Retry button for failed uploads
- [ ] Errors don't crash the UI

---

### Task 5: Add Loading States

Add loading indicators:

```typescript
const [loading, setLoading] = useState(false);

// When fetching documents:
useEffect(() => {
  if (!visible) return;

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/cases/${caseFileId}/documents`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const docs = await response.json();
        setDocuments(docs);
      }
    } catch (error) {
      console.error('[FetchDocuments] Error:', error);
      Message.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  fetchDocuments();
}, [visible, caseFileId]);

// In the document list section:
{loading ? (
  <div className="loading-state">
    <Spin />
    <p>Loading documents...</p>
  </div>
) : (
  <DocumentListSection {...props} />
)}
```

**Acceptance Criteria:**
- [ ] Loading spinner when fetching documents
- [ ] Loading state during upload
- [ ] Disabled buttons during loading
- [ ] Clear visual feedback

---

### Task 6: Add Internationalization

Add translation keys to `src/renderer/locales/en.json`:

```json
{
  "conversation": {
    "workspace": {
      "uploadCaseFiles": "Upload Case Files",
      "dragDropFiles": "Drag and drop files here",
      "browseFiles": "Browse Files",
      "supportedFormats": "Supported formats: PDF, DOCX, TXT, MD, JPG, PNG, MP3, WAV, M4A",
      "documentsTab": "Documents",
      "failedTab": "Failed",
      "preview": "Preview",
      "download": "Download",
      "retry": "Retry",
      "uploadSuccess": "Upload successful",
      "uploadFailed": "Upload failed",
      "downloadSuccess": "Download successful",
      "downloadFailed": "Download failed"
    }
  }
}
```

Update components to use `t()` function for all text.

**Acceptance Criteria:**
- [ ] All user-facing text uses i18n
- [ ] English translations complete
- [ ] Easy to add other languages

---

## Testing Checklist

### Manual Testing:
- [ ] Upload single file
- [ ] Upload multiple files
- [ ] Drag and drop files
- [ ] Click to browse files
- [ ] Watch real-time progress updates
- [ ] Preview completed document
- [ ] Download completed document
- [ ] Test "Failed" tab filtering
- [ ] Test pagination with 10+ documents
- [ ] Test error scenarios (large file, network error, etc.)
- [ ] Test retry functionality
- [ ] Test modal close (X button, ESC, click outside)
- [ ] Test WebSocket reconnection

### Edge Cases:
- [ ] Upload while WebSocket disconnected
- [ ] Upload with no auth token
- [ ] Upload to non-existent case file
- [ ] Upload duplicate filename
- [ ] Upload unsupported file type
- [ ] Close modal while upload in progress
- [ ] Multiple simultaneous uploads

---

## Final Deliverables

Your integration should provide:
1. ✅ Upload button in workspace panel
2. ✅ Fully functional modal with all features
3. ✅ Preview functionality
4. ✅ Download functionality
5. ✅ Comprehensive error handling
6. ✅ Loading states
7. ✅ Internationalization support
8. ✅ Production-ready code

---

## Questions?

If you encounter issues:
1. Check existing modal implementations in the codebase
2. Review WebSocket connection setup
3. Test API endpoints with curl first
4. Check browser console for errors
5. Verify authentication token is present

---

## Success Criteria

The feature is complete when:
- [ ] Users can upload documents from workspace panel
- [ ] Real-time progress updates work
- [ ] Preview and download work for completed documents
- [ ] All error scenarios are handled gracefully
- [ ] UI is responsive and performant
- [ ] Code follows existing patterns and conventions
- [ ] All acceptance criteria are met

