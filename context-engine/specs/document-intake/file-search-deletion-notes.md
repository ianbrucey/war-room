# File Search Deletion Implementation Notes

**Date:** 2025-12-14  
**Status:** Partially Implemented - Needs Full Implementation

---

## Current State

### What's Tracked in Database
- `case_files.file_search_store_id` - The File Search store ID for the case (one store per case)
- `case_documents.gemini_file_uri` - The URI of the document in the File Search store
- `case_documents.rag_indexed` - Boolean flag (0/1) indicating if document is indexed

### What's Implemented
- ✅ Document deletion from S3
- ✅ Document deletion from local filesystem
- ✅ Document deletion from database
- ⚠️ **Partial:** File Search deletion (logs warning but doesn't actually delete)

### What's NOT Implemented
- ❌ Actual deletion of documents from File Search store
- ❌ Cleanup of empty File Search stores when all documents are deleted
- ❌ Deletion of File Search store when a case is deleted

---

## File Search Architecture (from Google Docs)

### Key Concepts

1. **File Search Store** - A persistent container for document embeddings
   - One store per case (recommended)
   - Stored indefinitely until manually deleted
   - Name format: `fileSearchStores/{store-id}`

2. **Documents in Store** - Individual documents with embeddings
   - Each document has a URI: `files/{store_id}/{file_id}`
   - Documents are chunked, embedded, and indexed
   - Stored indefinitely until store is deleted

3. **Temporary Files** - Raw files uploaded via Files API
   - Deleted automatically after 48 hours
   - Only used during the upload/import process

### Storage Costs
- **Embeddings at indexing time:** $0.15 per 1M tokens
- **Storage:** FREE
- **Query time embeddings:** FREE
- **Retrieved document tokens:** Charged as regular context tokens

---

## Deletion Strategy

### Option 1: Document-Level Deletion (Recommended)
**Problem:** The File Search API doesn't expose a direct "delete document" method in the documentation.

**Possible Solutions:**
1. **Use Files API deletion** - If we track the temporary file name, we could delete via Files API
   - Issue: Files are auto-deleted after 48 hours anyway
   - Issue: Doesn't remove embeddings from File Search store

2. **Re-implement indexing with new SDK** - Use `@google/genai` instead of `@google/generative-ai`
   - Track file names properly during upload
   - Implement proper deletion using SDK methods

3. **Accept orphaned embeddings** - Since storage is free, leave embeddings in store
   - Pro: Simple, no risk of breaking things
   - Con: Store grows indefinitely, may impact retrieval performance

### Option 2: Store-Level Deletion (Nuclear Option)
**When:** Delete entire File Search store when case is deleted

**Implementation:**
```javascript
const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

await ai.fileSearchStores.delete({
  name: `fileSearchStores/${caseFile.file_search_store_id}`,
  config: { force: true }
});
```

**Pros:**
- Clean deletion of all case documents at once
- Prevents orphaned embeddings

**Cons:**
- Can't delete individual documents
- Requires case deletion feature

---

## Recommended Implementation

### Phase 1: Improve Logging (Current State)
- ✅ Log when documents with `gemini_file_uri` are deleted
- ✅ Warn that File Search embeddings remain
- ✅ Track which documents need cleanup

### Phase 2: Implement Store Deletion on Case Delete
**When:** User deletes an entire case

**Steps:**
1. Check if `case_files.file_search_store_id` exists
2. Call `ai.fileSearchStores.delete()` with `force: true`
3. Delete all case documents from database
4. Delete case from database

**Code Location:** Create new endpoint `DELETE /api/cases/:caseFileId`

### Phase 3: Re-implement File Search Indexing
**Goal:** Use new `@google/genai` SDK properly

**Changes:**
1. Update `FileSearchIndexer.ts` to use `@google/genai` instead of `@google/generative-ai`
2. Implement proper store creation: `ai.fileSearchStores.create()`
3. Implement proper file upload: `ai.fileSearchStores.uploadToFileSearchStore()`
4. Track file names properly for future deletion
5. Store `file_search_store_id` in `case_files` table

### Phase 4: Implement Document Deletion (Future)
**When:** SDK provides document-level deletion API

**Steps:**
1. Check SDK documentation for new deletion methods
2. Implement deletion by file URI or file name
3. Update delete endpoint to call deletion method

---

## Current Delete Endpoint Behavior

**File:** `src/webserver/routes/documentRoutes.ts` (lines 339-377)

**What it does:**
1. ✅ Deletes from S3 (if `s3_key` exists)
2. ✅ Deletes from local filesystem
3. ⚠️ Logs warning about File Search (if `gemini_file_uri` exists)
4. ✅ Deletes from database

**What it logs:**
```
[DocumentIntake] File Search document deletion not yet implemented. URI: files/store-xxx/123456
[DocumentIntake] Note: File will remain in File Search store but database record will be deleted
```

---

## Action Items

### Immediate (Do Now)
- ✅ Log File Search deletion warnings
- ✅ Document current limitations

### Short-Term (Next Sprint)
- [ ] Implement case deletion endpoint
- [ ] Add File Search store deletion on case delete
- [ ] Test store deletion with `force: true`

### Long-Term (Future Enhancement)
- [ ] Re-implement File Search indexing with new SDK
- [ ] Implement document-level deletion (when SDK supports it)
- [ ] Add cleanup job for orphaned embeddings

---

## Testing Checklist

### Test 1: Delete Document with File Search URI
1. Upload and index a document
2. Verify `gemini_file_uri` is populated in database
3. Delete the document
4. Check logs for File Search warning
5. Verify document deleted from database, S3, and filesystem

### Test 2: Delete Case with File Search Store
1. Create a case with multiple indexed documents
2. Note the `file_search_store_id` from `case_files` table
3. Delete the entire case
4. Verify File Search store is deleted (when implemented)
5. Verify all documents deleted from database

---

## References

- **File Search Documentation:** https://ai.google.dev/gemini-api/docs/file-search
- **SDK Package:** `@google/genai` v1.16.0
- **Old SDK (deprecated for File Search):** `@google/generative-ai` v0.24.1

