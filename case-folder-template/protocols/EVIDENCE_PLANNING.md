# Evidence Planning Protocol

## Purpose

Create and manage evidence bundles that map documents to exhibits for use in legal filings. The evidence bundle serves as the **single source of truth** for exhibit references during drafting.

## Source of Truth

**File:** `evidence/evidence-bundle.json`

This JSON file is:
- Read by agents during drafting for exhibit citations
- Editable by users via UI (when available) or directly
- Portable with the case folder
- The authoritative list of what exhibits exist and their metadata

## When to Use This Protocol

- Before drafting any filing that requires exhibits
- When preparing evidence for motions, complaints, or briefs
- When the user requests exhibit planning or evidence organization
- After document intake, to map documents to legal claims

## Workflow

### Phase A: Document Inventory

1. **Review available documents** in `documents/` folder
2. **Read case strategy** from `case-context/case_summary.md` or active workspace
3. **Identify which documents support which claims**

### Phase B: Create/Update Evidence Bundle

1. **Initialize bundle** if `evidence/evidence-bundle.json` is empty:
   ```json
   {
     "bundle_id": "[filing-type]-exhibits",
     "purpose": "Exhibits for [Filing Name]",
     "created_at": "[ISO timestamp]",
     "updated_at": "[ISO timestamp]",
     "exhibits": [],
     "metadata": { "total_exhibits": 0, "total_pages": 0 }
   }
   ```

2. **Add exhibits** in order of presentation:
   - Assign exhibit IDs (A, B, C... or 1, 2, 3...)
   - Reference source document path
   - Write clear descriptions for cover pages
   - Map to legal claims they support

3. **Extract key excerpts** for important documents:
   - Include page numbers (use `--- Page X ---` markers from extracted text)
   - Quote exact language
   - Note relevance to legal elements

### Phase C: Validation

1. **Check coverage**: Every major claim should have exhibit support
2. **Check references**: Every `document_ref` path should exist
3. **Check order**: Exhibits should flow logically (chronological or by claim)
4. **Update metadata**: Count exhibits and pages

## Exhibit Entry Structure

```json
{
  "exhibit_id": "A",
  "label": "Exhibit A",
  "title": "Original Service Agreement",
  "document_ref": "documents/contract-signed/",
  "description": "Service Agreement between Plaintiff and Defendant dated January 15, 2024",
  "page_range": "1-5",
  "key_excerpts": [
    {
      "page": 3,
      "quote": "Payment shall be due within 30 days of invoice.",
      "relevance": "Establishes payment terms - breach element"
    }
  ],
  "supports_claims": ["breach of contract", "consideration"],
  "bates_range": { "start": "ABC000001", "end": "ABC000005" },
  "status": "included"
}
```

## Citation Format

When drafting, use this format for exhibit citations:

- **Single page:** `(Exhibit A, p. 3)`
- **Page range:** `(Exhibit A, pp. 3-5)`
- **With description:** `(Exhibit A, p. 3 (Email dated March 15, 2024))`
- **Quote with citation:** `"Payment shall be due within 30 days." (Exhibit A, p. 3)`

## Agent Commands

| Command | Action |
|---------|--------|
| "plan evidence for [filing]" | Create new evidence bundle |
| "add [document] as exhibit" | Add document to bundle |
| "show evidence bundle" | Display current bundle contents |
| "check evidence coverage" | Validate claims have support |
| "reorder exhibits" | Reorganize exhibit sequence |

## Integration with Drafting

During drafting (see `DRAFTING.md`), agents should:

1. **Read `evidence/evidence-bundle.json`** before drafting
2. **Use exact exhibit labels** from the bundle
3. **Quote key_excerpts** where appropriate
4. **Cite page numbers** for specific references
5. **Flag missing evidence** if a claim lacks exhibit support

## Quality Checklist

- [ ] Every factual claim has exhibit support
- [ ] All document_ref paths are valid
- [ ] Exhibits are logically ordered
- [ ] Descriptions are clear for cover pages
- [ ] Key excerpts include page numbers
- [ ] Claims mapping is complete
- [ ] Metadata totals are accurate

