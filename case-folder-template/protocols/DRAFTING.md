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

The HTML templates solve this. Users get a WYSIWYG editing experience while the underlying structure ensures consistency.

### The Drafting Mindset

1. **Start from template** – Every document type has conventions encoded in templates
2. **Populate metadata first** – Case name, parties, court, date
3. **Write content section by section** – Follow the template's structure
4. **Preserve formatting infrastructure** – CSS and JavaScript make the magic work
5. **Let the system handle numbering** – Never manually number paragraphs

---

## Part 2: Document Types

### Court Filings (Complaint, Motion)

**Template**: `templates/html/complaint.html` or `templates/html/motion.html`

**Structure**:
- Court caption (centered, bold)
- Case caption (parties and case number)
- Document title
- Jurisdiction/Venue (if complaint)
- Factual allegations (auto-numbered paragraphs)
- Legal arguments (section headers + numbered paragraphs)
- Prayer for relief
- Signature block

**Key CSS classes**:
- `p.numbered` – Auto-numbered paragraphs
- `.section-header` – Centered, underlined section titles
- `.page-break-before` – Force new page before element
- `.signature-block` – Signature formatting

### Letters (Demand, Settlement Offer, General)

**Template**: `templates/html/letter.html`

**Structure**:
- Letterhead with firm info
- Date and recipient block
- Reference/subject lines
- Special notice boxes (for demands/offers)
- Letter body
- Closing and signature
- Enclosures/CC

**Key CSS classes**:
- `.letterhead` – Firm header
- `.demand-notice` – Yellow warning box
- `.settlement-offer` – Blue offer box
- `.blockquote` – Indented quoted text

### Settlement Agreements

**Template**: `templates/html/settlement.html`

**Structure**:
- Document header
- Parties section
- Settlement terms (numbered sections)
- Payment schedule (table if applicable)
- Release language
- Confidentiality clause
- Signature section (grid for multiple parties)

**Key CSS classes**:
- `.parties-section` – Party identification
- `.payment-table` – Payment schedule formatting
- `.release-section` – Bordered release language
- `.signature-grid` – Side-by-side signatures

---

## Part 3: Drafting Process

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

Create:
```
001_motion_response/
├── DRAFT.md        # Notes, iterations (optional)
├── motion          # The actual document (no extension shown to user)
└── _metadata.json  # Links to parent outline/strategy
```

### Step 3: Copy and Populate Template

1. Copy template from `templates/html/[type].html`
2. Replace metadata placeholders:
   - `{{ court_name }}` → Actual court
   - `{{ plaintiff_name }}` → Actual plaintiff
   - `{{ case_number }}` → Actual case number or "[To be assigned]"
   - `{{ date }}` → Current date
3. Update `<title>` to reflect document name

### Step 4: Draft Content

For each section:
1. Use the outline if available
2. Write content inside appropriate HTML structure
3. Use `<p class="numbered">` for numbered paragraphs
4. Use section headers as appropriate
5. Cross-reference facts from `case-context/case_summary.md`

**CRITICAL RULES**:
- Every fact must be verifiable in case context files
- Every case citation must be from research files (never invent citations)
- Keep prose professional but clear
- Match tone to purpose (formal for court, measured for letters)

### Step 5: Quality Check

Before considering draft complete:

**Formatting**:
- [ ] All CSS preserved in `<head>`
- [ ] All JavaScript preserved before `</body>`
- [ ] Numbered paragraphs use `<p class="numbered">`
- [ ] Section headers use proper classes
- [ ] No broken HTML tags

**Content**:
- [ ] All metadata fields populated
- [ ] Facts match case summary
- [ ] Citations verified (if any)
- [ ] Appropriate tone
- [ ] Complete (all sections filled)

### Step 6: Present to User

After saving the document:

```
✅ Draft complete: [document_name]

The document is ready for review in the file preview.
You can edit it directly and export to PDF when ready.

Location: workspaces/[workspace]/drafts/[draft_folder]/
```

---

## Part 4: Common HTML Patterns

### Numbered Paragraph
```html
<p class="numbered">Plaintiff is an individual residing in Fulton County, Georgia.</p>
```

### Section Header (no page break)
```html
<div class="section-header">FACTUAL BACKGROUND</div>
```

### Section Header (with page break)
```html
<div class="section-header page-break-before">COUNT I: BREACH OF CONTRACT</div>
```

### Bulleted List
```html
<ul class="disc">
  <li>First item</li>
  <li>Second item</li>
</ul>
```

### Numbered List (inside content, separate from paragraph numbering)
```html
<ol class="decimal">
  <li>First item</li>
  <li>Second item</li>
</ol>
```

### Block Markers (for surgical updates)
```html
<!-- BEGIN: INTRO -->
<p class="numbered">Introduction paragraph here...</p>
<!-- END: INTRO -->
```

Use these markers to identify sections you might need to update later.

---

## Part 5: Never Do / Always Do

### NEVER:
- Write HTML from scratch (use templates)
- Manually number paragraphs (1., 2., etc.)
- Remove CSS counters or ContentEditable JavaScript
- Cite cases not in research files
- Invent facts not in case context
- Show users technical details (HTML extensions, browser instructions)

### ALWAYS:
- Start from appropriate template
- Populate metadata before content
- Use `<p class="numbered">` for numbered paragraphs
- Preserve all CSS and JavaScript
- Verify facts against case summary
- Verify citations against research files
- Present clean, simple completion messages to users

