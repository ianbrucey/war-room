# File Search Backfill Script

## Purpose

This script uploads existing case documents to Google File Search for RAG (Retrieval-Augmented Generation) capabilities. It processes documents that have already been uploaded and have extracted text, but were not indexed in Google File Search.

## Prerequisites

1. **GEMINI_API_KEY** environment variable must be set
2. Documents must have `extracted-text.txt` files in their folders
3. Database must be accessible

## Usage

### Dry Run (Preview)

See what would be indexed without making changes:

```bash
npm run backfill-file-search -- --dry-run
```

### Backfill All Documents

Index all documents across all cases:

```bash
npm run backfill-file-search
```

### Backfill Specific Case

Index documents for a specific case only:

```bash
npm run backfill-file-search -- --case-id <case-file-id>
```

## What It Does

1. **Scans** all documents in the database
2. **Filters** to documents that:
   - Have completed text extraction (`has_text_extraction = 1`)
   - Are NOT already indexed (`rag_indexed = 0`)
   - Are in `complete`, `analyzing`, or `indexing` status
3. **Uploads** each document's `extracted-text.txt` to Google File Search
4. **Creates** a File Search store per case (if it doesn't exist)
5. **Updates** the database with:
   - `file_search_store_id` - The Google File Search store name
   - `gemini_file_uri` - The document URI in the store
   - `rag_indexed = 1` - Marks document as indexed
   - `processing_status = 'complete'` - Updates status

## Output

The script provides a summary:

```
[Backfill] ========== SUMMARY ==========
Total documents: 45
Already indexed: 12
No extracted text: 3
Processed: 28
Failed: 2
=====================================
```

## Document Structure

The script expects documents to be stored in this structure:

```
~/.justicequest/{case-name-timestamp}/
└── documents/
    └── {folder_name}/
        ├── original.{ext}          # Original file
        ├── extracted-text.txt      # Required for indexing
        └── metadata.json           # Optional (used for display name)
```

## Error Handling

- **Missing extracted text**: Document is skipped with a warning
- **Missing metadata**: Uses default metadata (filename as display name)
- **Indexing failure**: Document is marked as failed, script continues
- **Fatal errors**: Script exits with error code 1

## Database Updates

For each successfully indexed document, the script updates:

```sql
UPDATE case_documents SET
  file_search_store_id = 'fileSearchStores/abc123',
  gemini_file_uri = 'fileSearchStores/abc123/documents/xyz789',
  rag_indexed = 1,
  processing_status = 'complete',
  processed_at = <timestamp>
WHERE id = <document_id>
```

## Google File Search Store Management

- **One store per case**: Each case gets its own isolated File Search store
- **Store naming**: `Case: {case_title}` (truncated to 128 chars)
- **Store reuse**: If a case already has a store, it's reused
- **Document naming**: Uses metadata summary or filename (truncated to 128 chars)

## Troubleshooting

### "GEMINI_API_KEY environment variable not set"

Set the API key:

```bash
export GEMINI_API_KEY="your-api-key-here"
npm run backfill-file-search
```

### "No extracted text found for document"

The document hasn't completed text extraction yet. Run the document processing pipeline first.

### "File indexing timed out"

Google File Search indexing can take up to 5 minutes per document. If it times out, the document will be marked as failed and you can retry later.

### "Failed to create file search store"

Check your Gemini API key permissions and quota. The File Search API must be enabled for your project.

## Performance

- **Processing time**: ~5-10 seconds per document (including indexing wait time)
- **Rate limits**: Respects Google API rate limits
- **Batch size**: Processes documents sequentially to avoid overwhelming the API
- **Timeout**: 5 minutes per document indexing operation

## Next Steps After Backfill

Once documents are indexed, they can be queried using:

1. **MCP Tool**: `file_search_query` in the legal-hub MCP server
2. **Agent Queries**: Agents can perform semantic search across case documents
3. **Strategy Analysis**: The strategy relay script can use File Search for fact matching

## Related Files

- `src/process/documents/services/FileSearchIndexer.ts` - Core indexing service
- `src/webserver/auth/repository/DocumentRepository.ts` - Database operations
- `src/webserver/auth/repository/CaseFileRepository.ts` - Case file operations
- `src/renderer/components/UploadCaseFilesModal/DocumentListItem.tsx` - UI display

