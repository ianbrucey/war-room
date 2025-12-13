# Protocol: Draft Complaint

**Trigger**: User requests to draft a complaint, create first amended complaint, or generate court filing from approved outline

**Purpose**: Create professional HTML complaint document following HTML-first ContentEditable workflow with proper legal formatting, factual accuracy, and verified legal authorities

---

## Phase 0: Context Loading (MANDATORY)

**Before drafting ANYTHING, read these files in order:**

### 1. System Configuration
- `settings.json` → Get active case ID, workflow step, operating mode

### 2. Case Context Files (Auto-load from settings.json)
- `[ACTIVE_CASE]/step_1_interview/1.4_fact_gathering/Case_Summary_and_Timeline.md` → **PRIMARY SOURCE OF TRUTH** for all dates, facts, sequence of events
- `[ACTIVE_CASE]/STRATEGIC_INTENT.md` → Strategic direction, priorities, nuanced angles
- `[ACTIVE_CASE]/.session_context.md` → Current session working memory

### 3. Approved Outline (MANDATORY - NEVER draft without this)
- `[ACTIVE_CASE]/step_2_75_draft_planning/outlines/[outline_name].md` → Approved outline with:
  - Count structure and order
  - Semantic guidance (tone, emphasis, framing)
  - Integrated legal authorities
  - Evidence mapping
  - Tactical priorities

### 4. Legal Research Files
- `[ACTIVE_CASE]/step_2_strategy_research/strategy_[###]_[name]/automated_research/` → Verified case law and authorities
- `[ACTIVE_CASE]/step_2_strategy_research/strategy_[###]_[name]/claims/` → Claim-specific research (element checklists, viability assessments, adversarial analysis)

### 5. HTML Drafting Standards (CRITICAL - Must understand before drafting)
- `workflows/step_3_drafting_workflow.md` → HTML-first workflow, ContentEditable system, draft creation process, manifest linking
- `workflows/html_formatting_standards.md` → CSS rules, formatting patterns, legal document structure, auto-numbering system
- `workspace/templates/html/complaint.html` → Base template with:
  - CSS counters for auto-numbered paragraphs
  - ContentEditable interface
  - Professional legal formatting (Times New Roman 14pt, double-spaced, 1-inch margins)
  - Print-optimized design
  - Footnote support

### 6. Supporting Documents (if needed)
- `[ACTIVE_CASE]/documents/_index.json` → Document registry for locating exhibits, evidence
- Original complaint (if creating amended complaint) → Use document index to locate

---

## Phase 1: Pre-Draft Validation

**STOP if any of these fail:**

### A. Outline Approval Check
```bash
python scripts/manifest_manager.py --action verify
```
- [ ] Approved outline exists
- [ ] Outline is marked as approved in manifest
- [ ] Parent strategy exists
- [ ] All evidence bundles referenced in outline exist

**If validation fails**: STOP. Prompt user to complete Step 2.75 (outline creation) first.

### B. Required Context Files Check
- [ ] Case_Summary_and_Timeline.md exists and is current
- [ ] STRATEGIC_INTENT.md exists
- [ ] Legal research files exist in Step 2 folders
- [ ] Outline contains integrated legal authorities

**If missing**: STOP. Prompt user to complete missing prerequisites.

---

## Phase 2: Draft Initialization

### A. Generate Reference ID and Update Manifest
```bash
python scripts/manifest_manager.py \
  --action add_draft \
  --reference_id draft_001_complaint \
  --parent_strategy strategy_001_complaint \
  --parent_outline outline_001_complaint \
  --file_path "step_3_drafting/complaint_001/first_amended_complaint.html"
```

### B. Create Draft Folder Structure
```
step_3_drafting/
└── [draft_name]_001/
    ├── [draft_name].html          # Main HTML file
    ├── REVISION_SUMMARY.md        # Change log (if amended)
    └── exhibits/                  # Supporting documents
```

### C. Load HTML Template
**Source**: `workspace/templates/html/complaint.html`

**Template contains:**
- Complete CSS styling (page setup, typography, counters)
- ContentEditable JavaScript
- Court caption structure
- Auto-numbered paragraph system
- Section header classes
- Print optimization

---

## Phase 3: HTML Structure and Formatting Rules

### A. Document Structure (NEVER deviate from this)
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>[Document Title]</title>
  <style>
    /* CSS from template - PRESERVE ALL */
  </style>
</head>
<body>
  <div class="document">
    <!-- Court caption -->
    <!-- Case caption -->
    <!-- Document title -->
    <!-- Parties section -->
    <!-- Jurisdiction and Venue -->
    <!-- Factual Allegations -->
    <!-- Counts (one per claim) -->
    <!-- Conclusion -->
    <!-- Prayer for Relief -->
    <!-- Jury Demand -->
    <!-- Signature block -->
  </div>
  <script>
    /* ContentEditable JavaScript - PRESERVE ALL */
  </script>
</body>
</html>
```

### B. CSS Classes (Use exactly as shown)

**Auto-numbered paragraphs:**
```html
<p class="numbered">This is a numbered paragraph.</p>
```

**Section headers (no page break):**
```html
<div class="section-header">COUNT I: CLAIM NAME</div>
```

**Section headers (with page break before):**
```html
<div class="section-header page-break-before">COUNT II: CLAIM NAME</div>
```

**Ordered lists (decimal):**
```html
<ol class="decimal">
  <li>First item</li>
  <li>Second item</li>
</ol>
```

**Ordered lists (alpha):**
```html
<ol class="alpha">
  <li>First item</li>
  <li>Second item</li>
</ol>
```

### C. CSS Counter System (How auto-numbering works)
```css
body { counter-reset: paragraph-counter; }
p.numbered::before {
  counter-increment: paragraph-counter;
  content: counter(paragraph-counter) ". ";
}
```

**Agent responsibility**: 
- Use `<p class="numbered">` for ALL factual and legal paragraphs
- CSS automatically adds "1. ", "2. ", "3. " etc.
- NEVER manually number paragraphs
- Renumbering happens automatically when paragraphs added/removed

---

## Phase 4: Drafting Process (Follow Outline Exactly)

### A. Court Caption
**Source**: Template + Case_Summary_and_Timeline.md
- Court name (e.g., "UNITED STATES DISTRICT COURT NORTHERN DISTRICT OF GEORGIA ATLANTA DIVISION")
- Plaintiff name
- Defendant name
- Case number (if assigned)
- Document title (e.g., "FIRST AMENDED COMPLAINT")

### B. Parties Section
**Source**: Case_Summary_and_Timeline.md + Outline
- Plaintiff identification (name, residence, citizenship)
- Defendant identification (name, state of incorporation, principal place of business, business description)
- Use FTC case reference for CPS if applicable

### C. Jurisdiction and Venue
**Source**: Outline
- Federal question jurisdiction (28 U.S.C. § 1331)
- Supplemental jurisdiction (28 U.S.C. § 1367)
- Venue (28 U.S.C. § 1391)

### D. Factual Allegations
**Source**: Case_Summary_and_Timeline.md (PRIMARY) + Outline

**CRITICAL RULES:**
1. **Every date must match Case_Summary_and_Timeline.md exactly**
2. **Every fact must be verifiable in Case_Summary_and_Timeline.md**
3. **Sequence of events must follow Case_Summary_and_Timeline.md chronology**
4. **Add exhibit references inline**: `(See Exhibit A - Money Order Receipt)`

**Common factual sections:**
- Loan origination (date, vehicle, dealer, amount)
- Servicer involvement (when CPS began servicing)
- Payment history
- Accord and satisfaction timeline (purchase date, mailing date, delivery date, cashing date, 90-day period)
- Validation letter (mailing date, delivery date, CPS response)
- Collection activities (dates, methods, frequency)
- Cease communication request (date, method, CPS violation)

### E. Counts (One per Claim)
**Source**: Outline + Legal Research Files

**Structure for each count:**
```html
<div class="section-header page-break-before">COUNT I: [CLAIM NAME] ([STATUTE])</div>

<p class="numbered">[Incorporate all prior allegations]</p>

<p class="numbered">[Element 1 - Issue statement]</p>
<p class="numbered">[Element 1 - Rule with case law]</p>
<p class="numbered">[Element 1 - Application to facts]</p>
<p class="numbered">[Element 1 - Conclusion]</p>

<p class="numbered">[Element 2 - IRAC...]</p>
...

<p class="numbered">[Violation statement]</p>
```

**Legal authority format:**
- Inline citations: `Under O.C.G.A. § 11-3-311(c)(2), CPS had 90 days...`
- Case law: `See *Hartline-Thomas, Inc. v. H.W. Ivey Constr. Co.*, 161 Ga. App. 91 (1982).`
- Multiple authorities: Cite in order of importance (binding > persuasive, recent > old)

**CRITICAL**: Every case cited must be verified in research files. NEVER cite unverified cases.

### F. Conclusion Section
**Location**: After all counts, before Prayer for Relief
**Content**: 2-3 paragraphs summarizing:
- Why each claim succeeds
- Why Plaintiff is entitled to relief
- Aggregate harm/violations

### G. Prayer for Relief (Single Consolidated Section)
**Location**: After Conclusion, before Jury Demand
**Format**:
```html
<div class="section-header page-break-before">PRAYER FOR RELIEF</div>

<p class="numbered">WHEREFORE, Plaintiff respectfully requests that this Court enter judgment in Plaintiff's favor and grant the following relief:</p>

<ol class="decimal">
  <li>Declaratory relief (if applicable)</li>
  <li>Injunctive relief (if applicable)</li>
  <li>Statutory damages</li>
  <li>Actual damages</li>
  <li>Attorney's fees and costs</li>
  <li>Such other and further relief as the Court deems just and proper.</li>
</ol>
```

**NEVER**: Put prayers for relief after individual counts

### H. Jury Demand
```html
<div class="section-header">JURY DEMAND</div>
<p class="numbered">Plaintiff demands trial by jury on all issues so triable.</p>
```

### I. Signature Block
```html
<div class="signature-block">
  <p>Respectfully submitted this [day] day of [month], [year].</p>
  <p style="margin-top: 40px;">/s/ [Name]</p>
  <p>[Name]</p>
  <p>[Pro Se or Attorney Info]</p>
  <p>[Address]</p>
  <p>[Phone]</p>
  <p>[Email]</p>
</div>
```

---

## Phase 5: Quality Control Checklist

**Before completing draft, verify:**

### Factual Accuracy
- [ ] All dates match Case_Summary_and_Timeline.md exactly
- [ ] All names/entities match Case_Summary_and_Timeline.md
- [ ] All amounts match Case_Summary_and_Timeline.md
- [ ] Sequence of events follows Case_Summary_and_Timeline.md chronology
- [ ] No hallucinated facts

### Legal Authority
- [ ] All case law citations verified in research files
- [ ] All statutory citations accurate
- [ ] Case names, citations, holdings correct
- [ ] No unverified authorities cited

### HTML Structure
- [ ] All CSS preserved in `<head>`
- [ ] All JavaScript preserved at end of `<body>`
- [ ] All paragraphs use `<p class="numbered">`
- [ ] Section headers use proper classes
- [ ] Court caption formatted correctly
- [ ] No broken HTML tags

### Outline Compliance
- [ ] All counts from outline present
- [ ] Count order matches outline
- [ ] Semantic guidance incorporated
- [ ] Evidence references match outline

### Document Completeness
- [ ] Court caption complete
- [ ] Parties section complete
- [ ] Jurisdiction and venue complete
- [ ] Factual allegations complete
- [ ] All counts complete with IRAC structure
- [ ] Conclusion section present
- [ ] Single consolidated Prayer for Relief
- [ ] Jury demand present
- [ ] Signature block complete

---

## Phase 6: Output and Next Steps

### A. Save HTML File
**Location**: `[ACTIVE_CASE]/step_3_drafting/[draft_folder]/[draft_name].html`

### B. Open Preview in Browser
```bash
open "[ACTIVE_CASE]/step_3_drafting/[draft_folder]/[draft_name].html"
```

### C. Notify User
"✅ Draft complete! HTML file opened in browser. You can now:
- Edit directly in browser (ContentEditable interface)
- Add/remove paragraphs (auto-renumbering)
- Print to PDF when ready (File → Print → Save as PDF)"

---

## Error Prevention

**NEVER:**
- Draft without approved outline
- Cite unverified case law
- Hallucinate dates or facts
- Manually number paragraphs
- Put prayers for relief after individual counts
- Break HTML structure or CSS
- Skip quality control checklist

**ALWAYS:**
- Cross-reference Case_Summary_and_Timeline.md for ALL facts
- Verify ALL legal authorities in research files
- Follow outline structure exactly
- Preserve HTML template structure
- Use proper CSS classes
- Complete quality control checklist

