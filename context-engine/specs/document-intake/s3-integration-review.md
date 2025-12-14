# S3 Integration Review & Fixes

**Date:** 2025-12-14  
**Status:** Fixed - Ready for Testing  
**Reviewer:** Agent

---

## Issues Found & Fixed

### ✅ Issue 1: Missing Database Migration (CRITICAL)

**Error:**
```
SqliteError: table case_documents has no column named s3_key
```

**Root Cause:**
- Migration v12 was created but `CURRENT_DB_VERSION` was not updated from 11 to 12
- Database never ran the migration to add S3 columns

**Fix Applied:**
- Updated `src/process/database/schema.ts` line 111: `CURRENT_DB_VERSION = 12`
- Migration will run automatically on next app restart

**Columns Added by Migration v12:**
- `s3_key` TEXT
- `s3_bucket` TEXT
- `s3_uploaded_at` INTEGER
- `s3_version_id` TEXT
- `content_type` TEXT
- `file_size_bytes` INTEGER

---

### ✅ Issue 2: SSL Certificate Verification Error (CRITICAL)

**Error:**
```
Error: unable to verify the first certificate
code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'
```

**Root Cause:**
- MinIO/Herd uses self-signed SSL certificates
- AWS SDK rejects self-signed certificates by default

**Fix Applied:**
- Added `AWS_DISABLE_SSL_VERIFICATION` environment variable support
- Updated `S3StorageService.ts` constructor to disable SSL verification when flag is set
- Uses `@smithy/node-http-handler` with custom HTTPS agent

**Code Changes:**
```typescript
// Disable SSL verification for local development (MinIO/Herd with self-signed certs)
if (disableSslVerification) {
  const { NodeHttpHandler } = require('@smithy/node-http-handler');
  const { Agent } = require('https');
  
  clientConfig.requestHandler = new NodeHttpHandler({
    httpsAgent: new Agent({
      rejectUnauthorized: false,
    }),
  });
  console.log(`[S3Storage] SSL verification disabled (for local development only)`);
}
```

---

### ✅ Issue 3: Missing Import in DropzoneSection.tsx

**Error:**
```
TS2304: Cannot find name 'FileService'
```

**Root Cause:**
- `FileService` was used but not imported
- Only `FileMetadata` type was imported

**Fix Applied:**
- Updated import statement in `src/renderer/components/UploadCaseFilesModal/DropzoneSection.tsx`
- Changed from: `import type { FileMetadata } from '@/renderer/services/FileService';`
- Changed to: `import { FileService, type FileMetadata } from '@/renderer/services/FileService';`

---

### ✅ Issue 4: React 19 Incompatibility with Modal.confirm (CRITICAL)

**Error:**
```
[UploadModal] Delete confirmation error: TypeError: CopyReactDOM.render is not a function
```

**Root Cause:**
- React 19.1.0 removed the legacy `ReactDOM.render` API
- Arco Design's `Modal.confirm` uses `ReactDOM.render` internally
- This causes the delete confirmation dialog to fail

**Fix Applied:**
- Replaced `Modal.confirm` with a state-based Modal component
- Added state variables: `deleteConfirmVisible`, `documentToDelete`, `deleting`
- Created three new functions:
  - `handleDelete(documentId)` - Shows confirmation modal
  - `confirmDelete()` - Performs the actual delete
  - `cancelDelete()` - Closes confirmation modal
- Added `<Modal>` component to JSX with proper state management

**Code Changes:**
```typescript
// State variables
const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
const [documentToDelete, setDocumentToDelete] = useState<string | null>(null);
const [deleting, setDeleting] = useState(false);

// Modal component
<Modal
  visible={deleteConfirmVisible}
  title={t('uploadModal.delete.confirmTitle')}
  onOk={confirmDelete}
  onCancel={cancelDelete}
  okText={t('uploadModal.delete.confirmOk')}
  cancelText={t('uploadModal.delete.confirmCancel')}
  okButtonProps={{ status: 'danger', loading: deleting }}
  cancelButtonProps={{ disabled: deleting }}
>
  <p>{t('uploadModal.delete.confirmMessage')}</p>
</Modal>
```

**Why This Works:**
- State-based modals use React's component tree instead of imperative rendering
- Compatible with React 18+ and React 19
- Provides better loading state management during delete operation

---

## Required Environment Variable

Add this to your `.env` file (after line 187):

```bash
# Disable SSL verification for MinIO/Herd (local development only)
AWS_DISABLE_SSL_VERIFICATION=true
```

**⚠️ SECURITY WARNING:** Only use `AWS_DISABLE_SSL_VERIFICATION=true` for local development with MinIO/Herd. Never use this in production with real AWS S3.

---

## Testing Checklist

### Phase 1: Verify Database Migration
- [ ] Stop the application
- [ ] Restart the application
- [ ] Check logs for: `[Migrations] Running migration v12: Add S3 storage columns to case_documents`
- [ ] Verify migration completed: `[Migrations] ✓ Migration v12 completed`

### Phase 2: Verify S3 Upload
- [ ] Add `AWS_DISABLE_SSL_VERIFICATION=true` to `.env`
- [ ] Restart the application
- [ ] Upload a document to a case
- [ ] Check logs for: `[S3Storage] SSL verification disabled (for local development only)`
- [ ] Verify no SSL errors in logs
- [ ] Check database: `SELECT s3_key, s3_bucket, content_type FROM case_documents;`
- [ ] Verify S3 columns are populated

### Phase 3: Verify Document Operations
- [ ] Preview document (should generate signed URL)
- [ ] Download document (should generate signed URL)
- [ ] Delete document (should remove from S3 and database)

---

## Current S3 Configuration (from .env)

```bash
AWS_BUCKET=herd-bucket
AWS_ACCESS_KEY_ID=herd
AWS_USE_PATH_STYLE_ENDPOINT=true
AWS_SECRET_ACCESS_KEY=secretkey
AWS_DEFAULT_REGION=us-east-1
AWS_URL=https://minio.herd.test/herd-bucket
AWS_ENDPOINT=https://minio.herd.test
```

---

## Next Steps

1. **Add environment variable** to `.env`:
   ```bash
   AWS_DISABLE_SSL_VERIFICATION=true
   ```

2. **Restart the application** to trigger migration v12

3. **Test document upload** and verify S3 integration works

4. **Review S3 implementation** for completeness (see next section)

---

## Implementation Status

### ✅ Fully Implemented
- S3StorageService class with full CRUD operations
- Database migration v12 for S3 columns (6 new columns)
- Upload integration with S3 (with fallback to local)
- SSL verification bypass for local development
- Error handling and fallback to local storage
- Preview/Download endpoints with signed URL generation
- Content type mapper utility (`contentTypeMapper.ts`)
- Delete endpoint with S3 integration
- Local file fallback for non-S3 documents

### ⚠️ Not Yet Tested
- End-to-end upload → preview → download → delete flow
- Signed URL expiration behavior
- S3 error handling and fallback logic
- Multiple file type uploads (PDF, images, audio, video)

### ❌ Not Implemented (Future Enhancements)
- Frontend DocumentPreview modal component
- Word document preview conversion (DOCX → PDF)
- Backfill script for existing documents
- Unit tests for S3StorageService
- Monitoring/metrics for S3 operations

---

## Files Modified

1. `src/process/database/schema.ts` - Updated CURRENT_DB_VERSION to 12
2. `src/process/documents/services/S3StorageService.ts` - Added SSL verification bypass
3. `src/renderer/components/UploadCaseFilesModal/DropzoneSection.tsx` - Fixed FileService import
4. `src/renderer/components/UploadCaseFilesModal/index.tsx` - Replaced Modal.confirm with state-based Modal (React 19 compatibility)

---

## Detailed Testing Plan

### Test 1: Database Migration
**Objective:** Verify migration v12 runs successfully

**Steps:**
1. Stop the application
2. Check current database version: `sqlite3 ~/.justicequest/aionui/config/aionui.db "PRAGMA user_version;"`
3. Start the application
4. Check logs for migration messages
5. Verify new columns exist: `sqlite3 ~/.justicequest/aionui/config/aionui.db "PRAGMA table_info(case_documents);"`

**Expected Results:**
- Migration v12 runs automatically
- Logs show: `[Migrations] Running migration v12: Add S3 storage columns to case_documents`
- Database has 6 new columns: `s3_key`, `s3_bucket`, `s3_uploaded_at`, `s3_version_id`, `content_type`, `file_size_bytes`

---

### Test 2: S3 Upload (PDF)
**Objective:** Verify PDF uploads to S3 successfully

**Steps:**
1. Add `AWS_DISABLE_SSL_VERIFICATION=true` to `.env`
2. Restart application
3. Navigate to a case
4. Upload a PDF document
5. Check logs for S3 upload messages
6. Query database: `SELECT id, filename, s3_key, s3_bucket, content_type FROM case_documents ORDER BY uploaded_at DESC LIMIT 1;`
7. Check MinIO dashboard: `https://minio.herd.test` → `herd-bucket` → verify file exists

**Expected Results:**
- Logs show: `[S3Storage] SSL verification disabled (for local development only)`
- Logs show: `[DocumentIntake] Uploaded to S3: users/{user_id}/cases/{case_id}/documents/{doc_id}/original.pdf`
- Database record has populated S3 fields
- File exists in MinIO at correct path

---

### Test 3: S3 Upload (Multiple File Types)
**Objective:** Verify different file types upload correctly

**Steps:**
1. Upload each file type: PDF, DOCX, JPG, PNG, MP3, WAV, MP4
2. For each upload, verify:
   - S3 upload succeeds
   - Correct `content_type` in database
   - File exists in MinIO

**Expected Results:**
- All file types upload successfully
- Content types are correct:
  - PDF: `application/pdf`
  - DOCX: `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
  - JPG: `image/jpeg`
  - PNG: `image/png`
  - MP3: `audio/mpeg`
  - WAV: `audio/wav`
  - MP4: `video/mp4`

---

### Test 4: Preview URL Generation
**Objective:** Verify signed URLs are generated for preview

**Steps:**
1. Upload a PDF document
2. Call preview endpoint: `curl http://localhost:3000/api/documents/{doc_id}/preview-url`
3. Verify response contains:
   - `url` (signed URL)
   - `contentType`
   - `previewType`
   - `filename`
   - `expiresIn: 3600`
4. Open the signed URL in browser
5. Verify PDF displays inline

**Expected Results:**
- Endpoint returns 200 with signed URL
- URL contains query parameters: `X-Amz-Algorithm`, `X-Amz-Credential`, `X-Amz-Signature`
- URL opens PDF in browser (inline, not download)
- URL expires after 1 hour

---

### Test 5: Download URL Generation
**Objective:** Verify signed URLs trigger download

**Steps:**
1. Upload a PDF document
2. Call download endpoint: `curl http://localhost:3000/api/documents/{doc_id}/download-url`
3. Verify response contains signed URL
4. Open the signed URL in browser
5. Verify browser downloads the file (not inline preview)

**Expected Results:**
- Endpoint returns 200 with signed URL
- URL triggers browser download
- Downloaded file matches original

---

### Test 6: Delete from S3
**Objective:** Verify documents are removed from S3 on delete

**Steps:**
1. Upload a document
2. Note the `s3_key` from database
3. Verify file exists in MinIO
4. Delete the document via API: `curl -X DELETE http://localhost:3000/api/documents/{doc_id}`
5. Check MinIO - file should be gone
6. Check database - record should be deleted

**Expected Results:**
- API returns 200
- File removed from MinIO
- Database record deleted
- Local files removed

---

### Test 7: Fallback to Local Storage
**Objective:** Verify system works when S3 is unavailable

**Steps:**
1. Stop MinIO or set invalid AWS credentials
2. Upload a document
3. Verify upload succeeds (falls back to local only)
4. Check database - S3 fields should be NULL
5. Verify preview/download still work (using local fallback endpoints)

**Expected Results:**
- Upload succeeds with warning: `[DocumentIntake] S3 upload failed, continuing with local storage only`
- Database has NULL for `s3_key`, `s3_bucket`, `s3_version_id`, `s3_uploaded_at`
- Preview endpoint returns local URL: `/api/documents/{doc_id}/download`
- Download endpoint returns local URL
- Files work normally from local storage

---

### Test 8: Signed URL Expiration
**Objective:** Verify signed URLs expire after 1 hour

**Steps:**
1. Upload a document
2. Generate preview URL
3. Open URL immediately - should work
4. Wait 61 minutes
5. Try to open same URL - should fail

**Expected Results:**
- Fresh URL works
- Expired URL returns S3 error: `AccessDenied` or `Request has expired`

---

## Recommendations

### Immediate Actions (Before Production)
1. ✅ **Test all 8 test scenarios above** - Verify S3 integration works end-to-end
2. **Add error monitoring** - Track S3 upload failures and fallback usage
3. **Document MinIO setup** - Instructions for other developers

### Future Enhancements
4. **Build DocumentPreview modal** - Frontend component for inline preview
5. **Add unit tests** - Test S3StorageService methods in isolation
6. **Implement DOCX preview** - Convert Word docs to PDF for preview
7. **Backfill existing documents** - Migrate old documents to S3
8. **Add S3 metrics** - Track upload/download counts, storage usage

---

**Status:** ✅ All fixes applied. Ready for comprehensive testing.

