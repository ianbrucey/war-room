# Protocol: Document Annotation (User Notes)

**Status:** Active
**Owner:** Document Processing Layer
**Last Updated:** January 2025

---

## Purpose

Enable users to add contextual annotations to documents that provide critical information AI cannot infer from document content alone. User notes bridge the gap between what AI can extract and what only the user knows.

---

## When to Use This Protocol

**Trigger Conditions:**

1. **Proactive (After Document Processing):**
   - After `process_intake.py` completes Phase 2 (Document Indexing)
   - Agent prompts user: "Would you like to add contextual notes to any documents?"

2. **On-Demand (User-Initiated):**
   - User commands: "add notes to [document_name]"
   - User commands: "annotate [document_name]"
   - User commands: "add context to [document_name]"

3. **During Case Development:**
   - User discovers new context about existing document
   - User commands: "update notes for [document_name]"

---

## User Note Examples

**Good User Notes (Contextual Information AI Cannot Infer):**
- "Delivery confirmed via certified mail on 2024-03-15 (tracking #1234567890)"
- "Check #1234 visible in photo shows 'Final Payment' notation in memo line"
- "Contract was hand-delivered to HR manager Sarah Johnson at 2pm"
- "Email thread includes verbal agreement discussed in phone call (not documented)"
- "Photo shows handwritten note on back: 'Approved by CEO'"
- "Document references 'Exhibit A' which was never provided"

**Poor User Notes (Information AI Can Extract):**
- "This is an employment contract" (AI can classify document type)
- "Dated January 15, 2024" (AI can extract dates)
- "Signed by John Doe" (AI can extract signatories)

---

## Storage Structure

### Primary Location: Document Metadata JSON

**File:** `documents/[Document_Folder]/.document_metadata.json`

```json
{
  "document_id": "Contract_Employment_a1b2c3d4",
  "original_filename": "employment_contract.pdf",
  "document_type": "Contract",
  "user_notes": {
    "added_by": "user",
    "created_at": "2025-01-15T10:30:00Z",
    "last_modified": "2025-01-15T14:20:00Z",
    "modification_history": [
      {
        "timestamp": "2025-01-15T10:30:00Z",
        "action": "created",
        "notes": "Initial notes added"
      },
      {
        "timestamp": "2025-01-15T14:20:00Z",
        "action": "updated",
        "notes": "Added delivery confirmation details"
      }
    ],
    "notes": "Delivery confirmed via certified mail on 2024-03-15. Check #1234 visible in photo shows 'Final Payment' notation. Contract was hand-delivered to HR manager Sarah Johnson."
  },
  "ai_summary_path": "document_summary.md",
  "full_text_path": "full_text_extraction.txt",
  "has_full_text": true
}
```

### Secondary Location: Document Index

**File:** `documents/_index.json`

```json
{
  "documents": [
    {
      "document_id": "Contract_Employment_a1b2c3d4",
      "has_user_notes": true,
      "user_notes_preview": "Delivery confirmed via certified mail on 2024-03-15...",
      "user_notes_last_modified": "2025-01-15T14:20:00Z"
    }
  ]
}
```

### Tertiary Location: Full Text Extraction File

**File:** `documents/[Document_Folder]/full_text_extraction.txt`

```
=== USER CONTEXTUAL NOTES ===
Added: 2025-01-15T10:30:00Z
Last Modified: 2025-01-15T14:20:00Z

Delivery confirmed via certified mail on 2024-03-15. Check #1234 visible in photo shows 'Final Payment' notation. Contract was hand-delivered to HR manager Sarah Johnson.

=== END USER NOTES ===
=== DOCUMENT TEXT BEGINS ===

[original extracted text...]
```

---

## Protocol Instructions

### Phase 1: Proactive Prompt (After Document Processing)

**After `process_intake.py` Phase 2 completes:**

1. Display processed documents summary
2. Prompt user:
   ```
   ✅ Processed [N] documents successfully
   
   Would you like to add contextual notes to any documents?
   These notes help AI understand details that aren't evident from the document itself.
   
   Examples of useful notes:
   - Delivery confirmation details
   - Handwritten text visible in photos
   - Verbal agreements not documented
   - Missing referenced exhibits
   
   Options:
   (1) Add notes now
   (2) Skip for now (you can add notes later)
   ```

3. If user chooses (1):
   - List documents with numbers
   - Ask: "Which document(s) would you like to annotate? (enter numbers separated by commas)"
   - For each selected document, execute Phase 2

4. If user chooses (2):
   - Inform user: "You can add notes anytime with: 'add notes to [document_name]'"
   - Proceed to next workflow step

### Phase 2: Add/Update Notes (On-Demand)

**When user requests annotation:**

1. **Identify Document:**
   - Parse document name from user command
   - Search `documents/_index.json` for matching document
   - If multiple matches, ask user to clarify

2. **Check Existing Notes:**
   - Read `.document_metadata.json` from document folder
   - If notes exist, display current notes and ask: "Update existing notes or append?"

3. **Collect User Notes:**
   - Prompt: "Enter your contextual notes for [document_name]:"
   - Provide guidance: "Focus on information AI cannot infer from the document itself"
   - Accept multi-line input (user types notes, then signals completion)

4. **Save Notes:**
   - Update `.document_metadata.json` with new notes
   - Update `documents/_index.json` with `has_user_notes: true` and preview
   - If `full_text_extraction.txt` exists, prepend notes to file
   - Log modification in `modification_history`

5. **Confirm:**
   - Display: "✅ Notes added to [document_name]"
   - Offer: "Would you like to annotate another document?"

### Phase 3: Review Notes

**When user requests "review all notes":**

1. Read `documents/_index.json`
2. Filter documents where `has_user_notes: true`
3. Display summary:
   ```
   Documents with User Notes:
   
   1. Contract_Employment_a1b2c3d4
      Type: Contract
      Notes Preview: Delivery confirmed via certified mail on 2024-03-15...
      Last Modified: 2025-01-15T14:20:00Z
   
   2. Email_Thread_HR_e5f6g7h8
      Type: Email
      Notes Preview: Email thread includes verbal agreement discussed...
      Last Modified: 2025-01-16T09:15:00Z
   ```

4. Offer: "Enter document number to view full notes, or 'done' to exit"

**When user requests "show notes for [document_name]":**

1. Identify document
2. Read `.document_metadata.json`
3. Display full notes with metadata:
   ```
   User Notes for [document_name]:
   
   Added: 2025-01-15T10:30:00Z
   Last Modified: 2025-01-15T14:20:00Z
   
   Notes:
   Delivery confirmed via certified mail on 2024-03-15. Check #1234 visible in photo shows 'Final Payment' notation. Contract was hand-delivered to HR manager Sarah Johnson.
   
   Modification History:
   - 2025-01-15T10:30:00Z: Created
   - 2025-01-15T14:20:00Z: Updated (added delivery confirmation details)
   ```

---

## Integration with Downstream Processes

### Step 2 Strategy Development (Claim Building)

**When building claims:**
- Agent reads `.document_metadata.json` for each relevant document
- User notes included in IRAC analysis prompts
- Contextual information informs element satisfaction analysis

**Example Prompt Enhancement:**
```
Analyze whether Element 1 (Breach of Contract) is satisfied.

Evidence:
- Employment Contract (Contract_Employment_a1b2c3d4)
  AI Summary: [summary]
  User Context: Delivery confirmed via certified mail on 2024-03-15...
```

### Step 2.5 Evidence Mapping

**When creating evidence bundles:**
- User notes included in evidence descriptions
- Helps identify which documents support which elements
- Contextual details guide evidence organization

### Step 2.75 Outline Creation

**When creating draft outlines:**
- User notes inform how evidence is framed
- Contextual details guide strategic emphasis
- Helps draft accurate factual assertions

### Step 3 Drafting

**When citing evidence:**
- User notes available when drafting factual assertions
- Ensures accurate representation of evidence
- Prevents AI hallucinations about document context

---

## File Locations

**Document Metadata:** `[ACTIVE_CASE]/documents/[Document_Folder]/.document_metadata.json`
**Document Index:** `[ACTIVE_CASE]/documents/_index.json`
**Full Text (if exists):** `[ACTIVE_CASE]/documents/[Document_Folder]/full_text_extraction.txt`

---

## Success Criteria

1. User can add contextual notes to any document
2. Notes are editable with modification history tracked
3. Notes are accessible to all downstream AI processes
4. Notes are searchable via document index
5. Notes prepended to full text files for AI context
6. User can review all notes across all documents

