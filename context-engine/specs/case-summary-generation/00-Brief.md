# Case Summary Generation - Strategic Brief

## 1. Strategic Intent

**Goal:** Build an AI-powered case summary generation system that synthesizes all case documents into a structured markdown summary, serving as the foundational context for AI agents working on legal cases.

**Success Verdict:**
- [ ] User can click "Generate Summary" button in upload modal and receive a complete `case_summary.md` file
- [ ] Summary follows the defined schema with all 10 sections populated
- [ ] Summary is stored at `{workspace_path}/case-context/case_summary.md`
- [ ] Database tracks summary status (`null` | `generating` | `generated` | `stale` | `failed`)
- [ ] When new documents are added to a case with existing summary, status changes to `stale`
- [ ] User can click "Update Summary" to incrementally update with new documents
- [ ] User can click "Regenerate Summary" to fully rebuild from scratch

## 2. The Claims (Features)

| Claim ID | Description | Verdict (Test) |
|----------|-------------|----------------|
| CLAIM-01 | Generate case summary from document metadata files | `case_summary.md` created with all 10 sections filled from `metadata.json` inputs |
| CLAIM-02 | Track summary freshness in database | Query `case_files` table returns correct `case_summary_status` values |
| CLAIM-03 | Detect staleness when new documents added | After document processing completes, summary status becomes `stale` |
| CLAIM-04 | Incremental update without full rebuild | Update preserves existing facts, adds only new document content |
| CLAIM-05 | Full regeneration on demand | Regenerate ignores existing summary, processes all documents fresh |
| CLAIM-06 | UI controls in upload modal | Generate/Update/Regenerate buttons visible and functional |
| CLAIM-07 | WebSocket progress updates | UI shows real-time progress during generation |
| CLAIM-08 | Index summary in File Search store | Generated summary is added to case's File Search store for RAG |

## 3. The Elements (Required Components)

| Element | Purpose | Belongs To Claim |
|---------|---------|------------------|
| `CaseSummaryGenerator` service | Core generation logic using Gemini CLI | CLAIM-01, CLAIM-04, CLAIM-05 |
| Database migration v14 | Add summary status columns to `case_files` | CLAIM-02, CLAIM-03 |
| `POST /api/cases/:caseId/summary/generate` | Trigger initial generation | CLAIM-01, CLAIM-06 |
| `POST /api/cases/:caseId/summary/update` | Trigger incremental update | CLAIM-04, CLAIM-06 |
| `POST /api/cases/:caseId/summary/regenerate` | Trigger full rebuild | CLAIM-05, CLAIM-06 |
| `GET /api/cases/:caseId/summary/status` | Get current summary status | CLAIM-02, CLAIM-06 |
| WebSocket events `summary:generating`, `summary:complete`, `summary:failed` | Real-time progress | CLAIM-07 |
| `SummaryIndexer` | Add summary to File Search store | CLAIM-08 |
| UI: `CaseSummaryControls` component | Buttons + status display | CLAIM-06 |

## 4. The Evidence (Inputs & Constraints)

**Tech Stack:**
- TypeScript (Node.js)
- Gemini CLI (`gemini` command with `--include-directories`)
- SQLite (better-sqlite3)
- Express.js routes
- WebSocket (existing pattern)
- Google GenAI SDK (File Search indexing)

**External APIs:**
- Gemini CLI: Uses `GEMINI_API_KEY` from environment
- Google File Search: `@google/genai` SDK

**Sample Data:** See `03-fixtures.json`

---

## 5. Existing Infrastructure (CRITICAL)

### Related Existing Tables/Models
| Table/Model | Relationship to This Feature | Location |
|-------------|------------------------------|----------|
| `case_files` | Parent table - add summary columns | `src/process/database/schema.ts` |
| `case_documents` | Source of document list | `src/process/database/schema.ts` |
| `ICaseFile` | TypeScript interface - add fields | `src/common/storage.ts` |
| `ICaseDocument` | Read document metadata paths | `src/process/documents/types.ts` |

### Related Existing Endpoints
| Endpoint | What It Does | Reuse or Extend? |
|----------|--------------|------------------|
| `GET /api/cases/:caseId/documents` | Lists documents for case | REUSE |
| Document WebSocket events | Progress updates | REUSE pattern |
| `FileSearchIndexer` | Indexes documents in File Search | EXTEND for summary |

### Related Existing Components
| Component | Purpose | Location |
|-----------|---------|----------|
| `UploadCaseFilesModal` | Upload modal - add summary controls | `src/renderer/components/UploadCaseFilesModal/` |
| `DocumentAnalyzer` | Uses Gemini CLI pattern | `src/process/documents/services/DocumentAnalyzer.ts` |
| `DocumentRepository` | Database access pattern | `src/webserver/auth/repository/DocumentRepository.ts` |

### Known Constraints
- [x] Must use Gemini CLI (consistent with `DocumentAnalyzer`)
- [x] Must store summary at `{workspace_path}/case-context/case_summary.md`
- [x] Must not block document processing pipeline
- [x] Must handle cases with 0 processed documents gracefully
- [x] Batch size hardcoded to 5 documents at a time

## 6. Pre-Mortem (Risk Assessment)

**What could break?**
- Gemini CLI rate limits during hierarchical summarization (mitigation: add delays between batches)
- Large cases (100+ docs) may hit context limits (mitigation: hierarchical batching)
- metadata.json files missing for some documents (mitigation: fallback to extracted text)

**What assumptions are we making?**
- All documents have `processing_status = 'complete'` before summary generation
- `metadata.json` files exist and follow `IDocumentMetadata` schema
- Case workspace folder exists at `workspace_path`

**What do we NOT know yet?**
- Optimal delay between batch API calls (start with 2 seconds)
- Whether to store summary version history (decision: keep one backup `case_summary.md.bak`)

## 7. Approval Gate

**Status:** [ ] DRAFT  [x] READY FOR REVIEW

**Approved By:** _________________

**Date:** _________________

---

> ⚠️ **EXIT CONDITION:** This Brief is not approved until all Claims have defined Verdicts and the Tech Stack is explicit.

