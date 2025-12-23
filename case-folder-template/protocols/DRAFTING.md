# Protocol: Document Drafting

**Trigger**: User wants to create a legal document (motion, complaint, letter, settlement agreement, contract)

**Purpose**: Produce professional documents that users can edit and export to PDF

---

## Part 1: The Philosophy

### Why This System Exists

Legal documents need:
- Automatic paragraph numbering that updates when paragraphs are added/removed
- Precise formatting for court requirements
- Professional appearance without technical knowledge
- Easy editing without requiring users to understand code

### The Block-Based Architecture

Drafts are stored as **JSON files containing content blocks**. The system:

1. **Stores content in JSON** – Each paragraph, heading, and section is a "block"
2. **Computes numbers automatically** – Paragraph numbers are calculated from position, not stored
3. **Renders to HTML for display** – The JSON is combined with HTML templates for court formatting
4. **Enables click-to-edit** – Users click a paragraph to edit just that block

**You never write paragraph numbers.** The renderer calculates them.

### The Drafting Mindset

1. **Populate caption first** – Court, parties, case number
2. **Build content block by block** – Each paragraph is a discrete object
3. **Let the system handle numbering** – Numbers are computed from array position
4. **Keep formatting in templates** – Your job is content, not styling

---

## Part 2: The Draft File Structure

### Schema Location

`templates/schemas/draft.schema.json` – Defines the valid structure

### Draft File Location

`workspaces/[workspace_name]/drafts/[NNN]_[draft_name]/DRAFT.json`

### The DRAFT.json Structure

```json
{
  "document_type": "complaint",
  "metadata": {
    "title": "Complaint for Breach of Contract",
    "created_at": "2025-01-15T10:00:00Z",
    "last_modified": "2025-01-15T14:30:00Z",
    "status": "drafting",
    "linked_outline": "outlines/001_complaint_outline/",
    "linked_strategy": "strategies/001_breach_strategy/"
  },
  "caption": {
    "court_name": "Superior Court of California",
    "court_division": "County of Los Angeles",
    "plaintiff": "JOHN DOE",
    "defendant": "ACME CORPORATION",
    "case_number": "To be assigned",
    "document_title": "COMPLAINT FOR DAMAGES"
  },
  "body": [
    {
      "id": "intro-1",
      "type": "section_heading",
      "content": "INTRODUCTION"
    },
    {
      "id": "intro-2",
      "type": "numbered_paragraph",
      "content": "Plaintiff brings this action against Defendant for breach of contract arising from Defendant's failure to deliver goods as specified in the Agreement dated January 5, 2024."
    },
    {
      "id": "intro-3",
      "type": "numbered_paragraph",
      "content": "Defendant is a Delaware corporation doing business in Los Angeles County, California."
    }
  ],
  "signature_block": {
    "respectfully_submitted_date": "January 15, 2025",
    "attorney_name": "Jane Smith",
    "bar_number": "123456",
    "firm_name": "Smith Law Group",
    "address": "123 Main Street, Los Angeles, CA 90001",
    "phone": "(213) 555-1234",
    "email": "jane@smithlaw.com",
    "representing": "Plaintiff"
  },
  "footnotes": []
}
```

---

## Part 3: Block Types

### section_heading

Major section dividers. **Not numbered.**

```json
{
  "id": "facts-heading",
  "type": "section_heading",
  "content": "STATEMENT OF FACTS"
}
```

### numbered_paragraph

Standard legal paragraphs. **Automatically numbered** based on position in array.

```json
{
  "id": "facts-1",
  "type": "numbered_paragraph",
  "content": "On January 5, 2024, Plaintiff and Defendant entered into a written agreement."
}
```

### unnumbered_paragraph

Introductory or transitional text. **Not numbered.**

```json
{
  "id": "prayer-intro",
  "type": "unnumbered_paragraph",
  "content": "WHEREFORE, Plaintiff prays for judgment as follows:"
}
```

### block_quote

Quoted material (from contracts, statutes, cases). **Not numbered.**

```json
{
  "id": "contract-quote-1",
  "type": "block_quote",
  "content": "Seller shall deliver all goods within thirty (30) days of the order date."
}
```

---

## Part 4: How Numbering Works

**Numbers are COMPUTED, not stored.**

When the body array contains:
```json
[
  { "type": "section_heading", "content": "INTRODUCTION" },
  { "type": "numbered_paragraph", "content": "First point..." },      // → 1.
  { "type": "numbered_paragraph", "content": "Second point..." },     // → 2.
  { "type": "section_heading", "content": "STATEMENT OF FACTS" },
  { "type": "numbered_paragraph", "content": "On January 5..." },     // → 3.
  { "type": "numbered_paragraph", "content": "Defendant knew..." },   // → 4.
  { "type": "block_quote", "content": "Quote from contract..." },
  { "type": "numbered_paragraph", "content": "Despite this..." }      // → 5.
]
```

The renderer counts `numbered_paragraph` blocks sequentially across the entire document.

**If a paragraph is inserted or deleted, all subsequent numbers shift automatically.**


---

## Part 5: Drafting Process

### Step 1: Check Prerequisites

Before drafting:
- [ ] Understand what document type is needed
- [ ] Know the key metadata (parties, court, case number)
- [ ] For complex documents: Outline should exist
- [ ] For documents citing cases: Research should be available

**If outline doesn't exist for complex documents**, suggest creating one first:
> "This motion has multiple arguments. Should we outline the structure first, or draft directly?"

### Step 2: Create Draft Folder

Location: `workspaces/[workspace_name]/drafts/[NNN]_[draft_name]/`

Copy the template:
```
workspaces/_template/drafts/_template/  →  workspaces/[workspace]/drafts/001_complaint/
```

The folder contains:
```
001_complaint/
├── DRAFT.json      # The content (you write here)
└── _metadata.json  # Links to parent outline/strategy
```

### Step 3: Populate Caption

Read case information from `case-context/` and fill the caption:

```json
"caption": {
  "court_name": "[from case_summary.md or user input]",
  "court_division": "[if applicable]",
  "plaintiff": "[from parties.json]",
  "defendant": "[from parties.json]",
  "case_number": "[if known, else 'To be assigned']",
  "document_title": "COMPLAINT FOR DAMAGES"
}
```

### Step 4: Build the Body

Add blocks to the `body` array in order:

1. **Read the outline** (if one exists) for structure
2. **Add section headings** for major divisions
3. **Add numbered paragraphs** for content
4. **Add block quotes** for citations/excerpts

**Block ID Convention**: Use descriptive IDs like:
- `intro-1`, `intro-2` for Introduction paragraphs
- `facts-1`, `facts-2` for Statement of Facts
- `cod1-1`, `cod1-2` for Count I (first cause of action)
- `prayer-1` for Prayer for Relief

### Step 5: Populate Signature Block

```json
"signature_block": {
  "respectfully_submitted_date": "[current date]",
  "attorney_name": "[from case context or user]",
  "bar_number": "[if applicable]",
  "firm_name": "[if applicable]",
  "address": "[attorney address]",
  "phone": "[attorney phone]",
  "email": "[attorney email]",
  "representing": "Plaintiff"
}
```

### Step 6: Quality Check

Before considering draft complete:

**Structure**:
- [ ] Valid JSON (no syntax errors)
- [ ] All required fields populated (document_type, caption, body)
- [ ] Block IDs are unique
- [ ] Block types are valid (section_heading, numbered_paragraph, etc.)

**Content**:
- [ ] Caption matches case context
- [ ] Facts match case summary
- [ ] Citations verified against research files (if any)
- [ ] Appropriate professional tone
- [ ] All sections complete

### Step 7: Update Metadata

Update `_metadata.json`:
```json
{
  "draft_id": "001_complaint",
  "name": "Complaint for Breach of Contract",
  "document_type": "complaint",
  "status": "drafting",
  "created_at": "[timestamp]",
  "last_modified": "[timestamp]",
  "parent_outline": "outlines/001_complaint_outline/",
  "parent_strategy": "strategies/001_breach_strategy/"
}
```

### Step 8: Present to User

After saving:

```
✅ Draft complete: Complaint for Breach of Contract

The document is ready for review.
You can click any paragraph to edit it directly.

Location: workspaces/[workspace]/drafts/001_complaint/
```

---

## Part 6: Cross-References

### Referencing Other Paragraphs

When you need to reference paragraphs (e.g., "Plaintiff incorporates paragraphs 1-15"):

**For MVP**: Write literal numbers based on current positions.

```json
{
  "id": "cod1-1",
  "type": "numbered_paragraph",
  "content": "Plaintiff incorporates paragraphs 1 through 15 above as though fully set forth herein."
}
```

**Important**: If paragraphs are added/removed before the referenced range, you must update these references manually.

---

## Part 7: Document Types

### Complaints

**Typical sections:**
- INTRODUCTION (1-3 paragraphs)
- JURISDICTION AND VENUE (2-4 paragraphs)
- PARTIES (1 paragraph per party)
- STATEMENT OF FACTS (varies)
- CAUSES OF ACTION (one section per count)
- PRAYER FOR RELIEF

### Motions

**Typical sections:**
- INTRODUCTION
- STATEMENT OF FACTS
- ARGUMENT (with subheadings)
- CONCLUSION

### Letters

**Note**: Letters may use `unnumbered_paragraph` throughout instead of `numbered_paragraph`.

---

## Part 8: Never Do / Always Do

### NEVER:
- Write paragraph numbers in content (e.g., "1. Plaintiff...")
- Invent block types not in the schema
- Cite cases not in research files
- Invent facts not in case context
- Put HTML formatting in content (that's the renderer's job)

### ALWAYS:
- Use unique, descriptive block IDs
- Use `numbered_paragraph` for content that should be numbered
- Use `section_heading` for section titles
- Verify facts against case summary
- Verify citations against research files
- Keep prose professional but clear

