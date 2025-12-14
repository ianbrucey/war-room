# S3 Integration Implementation Handoff

**Date:** 2025-12-13  
**From:** Previous Agent Session  
**To:** Next Agent  
**Status:** Ready for Implementation  
**Priority:** High

---

## 1. Mission Statement

Implement Amazon S3 storage integration for the JusticeQuest document intake system. This will replace local filesystem as the source of truth for uploaded documents, enabling multi-device access, durability, and scalability.

**Architectural Decision:** Custom S3 implementation (Option A) was chosen over leveraging Laravel API (Option B) to maintain single-tenant, self-contained deployment model.

---

## 2. Required Context Loading (MANDATORY)

Before starting implementation, you **MUST** load these documents in this order:

### Step 1: Global Context (Foundation)
📄 **`context-engine/global-context.md`**
- Primary onboarding document for all agents
- Explains WebUI-only architecture, single-tenant model
- Documents technology stack, authentication patterns
- Contains critical reminders and architectural constraints

### Step 2: Domain Context (Business Logic)
📄 **`context-engine/domain-contexts/document-intake-architecture.md`**
- Complete documentation of current document intake system
- 4-phase processing pipeline (Upload → Extract → Analyze → Index)
- File storage structure: `documents/{folder_name}/original.{ext}`
- Database location: `{userData}/config/aionui.db`
- API endpoints and authentication patterns

### Step 3: Implementation Spec (Technical Design)
📄 **`context-engine/specs/document-intake/s3-storage-integration.md`**
- Complete S3 integration specification
- Bucket structure: `justicequest-documents-{environment}`
- S3StorageService class design with full implementation
- Database schema changes (6 new columns for `case_documents`)
- Preview/download flow with pre-signed URLs
- Migration strategy and cost estimation

### Step 4: Standards (Code Patterns)
📄 **`context-engine/standards/coding-patterns.md`** (if exists)
📄 **`context-engine/standards/ui-components.md`** (if exists)
- Reusable patterns and components
- Error handling conventions
- TypeScript typing standards

---

## 3. Key Files to Review

Before making changes, review these existing implementations:

### Backend Files
- **`src/process/documents/services/TextExtractor.ts`** - Current document processing
- **`src/webserver/routes/documentRoutes.ts`** - Upload/download/preview endpoints
- **`src/process/database/repositories/DocumentRepository.ts`** - Database operations
- **`src/process/database/index.ts`** - Database initialization and workspace paths

### Frontend Files
- **`src/renderer/components/UploadCaseFilesModal/DocumentListItem.tsx`** - Document UI component
- **`src/renderer/components/UploadCaseFilesModal/index.tsx`** - Upload modal

### Configuration
- **`.env`** - Environment variables (will need AWS credentials)
- **`package.json`** - Dependencies (will need AWS SDK)

---

## 4. Implementation Checklist

### Phase 1: Foundation (Day 1)
- [ ] Install AWS SDK: `npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`
- [ ] Create `src/process/documents/services/S3StorageService.ts` (full implementation in spec)
- [ ] Create `src/process/documents/utils/contentTypeMapper.ts` (full implementation in spec)
- [ ] Add database migration for 6 new columns (see spec section 3.1)
- [ ] Update `ICaseDocument` interface with S3 fields (see spec section 3.2)

### Phase 2: Upload Integration (Day 2)
- [ ] Modify `src/webserver/routes/documentRoutes.ts` upload handler (see spec section 7.1)
- [ ] Upload to S3 first, then save to local cache
- [ ] Store S3 key, bucket, version_id in database
- [ ] Test upload flow with various file types

### Phase 3: Preview & Download (Day 2-3)
- [ ] Create `/api/documents/:documentId/preview-url` endpoint (see spec section 5.2)
- [ ] Create `/api/documents/:documentId/download-url` endpoint (see spec section 5.2)
- [ ] Create `src/renderer/components/DocumentPreview/index.tsx` (see spec section 5.3)
- [ ] Add preview styles (see spec section 5.4)
- [ ] Test preview for PDF, images, video, audio

### Phase 4: Delete & Cleanup (Day 3)
- [ ] Update delete endpoint to remove from S3 (use `deleteDocument()` method)
- [ ] Test delete flow
- [ ] Add error handling and logging

### Phase 5: Testing
- [ ] Test all file types: PDF, images, video, audio, Word docs
- [ ] Test signed URL expiration (default 1 hour)
- [ ] Test error scenarios (S3 unavailable, invalid credentials)
- [ ] Verify database records have S3 metadata

---

## 5. Environment Setup

Add these to `.env`:

```bash
# AWS Credentials
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...

# S3 Configuration
S3_DOCUMENTS_BUCKET=justicequest-documents-dev
```

**IAM Policy Required:** See spec section 8.2 for full policy JSON.

---

## 6. Critical Reminders

### Architecture Constraints (from global-context.md)
- ✅ **WebUI-Only**: No Electron APIs or IPC bridge
- ✅ **Synchronous DB**: Use synchronous database operations (no async/await for DB calls)
- ✅ **Cookie Auth**: Primary authentication via `aionui-session` cookie
- ✅ **Single-Tenant**: Each tenant has isolated infrastructure

### Document Intake Patterns (from domain-context)
- ✅ **File Structure**: `documents/{folder_name}/original.{ext}`
- ✅ **Processing Status**: `pending` → `extracting` → `analyzing` → `indexing` → `complete`
- ✅ **UI Behavior**: Preview/Download/Delete buttons only show when `processing_status === 'complete'`

### S3 Integration Specifics (from spec)
- ✅ **Bucket Naming**: `justicequest-documents-{environment}` (NOT "aionui")
- ✅ **Key Structure**: `users/{user_id}/cases/{case_file_id}/documents/{document_id}/{filename}`
- ✅ **Signed URLs**: 1-hour expiration, inline for preview, attachment for download
- ✅ **Fallback**: Keep local cache for processing, S3 is source of truth

---

## 7. Success Criteria

Implementation is complete when:

1. ✅ Documents upload to S3 and database records contain `s3_key`, `s3_bucket`, `s3_version_id`
2. ✅ Preview button generates signed URL and displays document in modal
3. ✅ Download button generates signed URL and triggers browser download
4. ✅ Delete button removes document from S3 and database
5. ✅ All file types work: PDF, images, video, audio
6. ✅ Error handling works (S3 unavailable, expired URLs)

---

## 8. Questions or Issues?

If you encounter ambiguity or missing information:

1. **Check the specs first**: `context-engine/specs/document-intake/s3-storage-integration.md`
2. **Check domain context**: `context-engine/domain-contexts/document-intake-architecture.md`
3. **Use codebase-retrieval**: Search for existing patterns (e.g., "how is file upload currently handled?")
4. **Ask the user**: If specs are unclear or incomplete, STOP and ask for clarification

---

## 9. Estimated Timeline

- **Day 1**: Foundation (AWS SDK, S3StorageService, database migration) - 4-6 hours
- **Day 2**: Upload integration + Preview/Download endpoints - 4-6 hours
- **Day 3**: Frontend preview component + Testing - 4-6 hours

**Total: 2-3 days**

---

**Ready to begin? Start by loading `context-engine/global-context.md` and then proceed through the context loading steps above.**

