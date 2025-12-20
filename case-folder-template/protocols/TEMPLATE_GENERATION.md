# Template Generation Protocol

## Purpose
Generate custom HTML document templates based on firm-specific samples (PDFs, Word docs) to match their exact formatting standards.

## When to Use
- User uploads a sample document and requests a template
- User says "create a template from this sample"
- User wants to customize document formatting for their firm

---

## Workflow

### Phase 1: Upload Sample Documents

**User Action:** Upload sample documents (PDF, DOCX) that represent the firm's formatting standards.

**Agent Actions:**
1. Receive uploaded files via the upload modal
2. Save samples to `templates/_samples/` folder:
   ```
   templates/
   ├── _samples/
   │   ├── complaint-sample.pdf
   │   ├── motion-sample.docx
   │   └── brief-sample.pdf
   └── html/
       ├── complaint.html (active templates)
       └── motion.html
   ```

### Phase 2: Analyze Sample & Generate Template

**Agent Actions:**
1. Identify the document type from filename or ask user (complaint, motion, brief, etc.)
2. Call Gemini CLI to analyze the sample and generate HTML template:
   ```bash
   cat "templates/_samples/[sample-filename.pdf]" | gemini -m gemini-2.0-flash-exp -y "Analyze this legal document sample and generate an HTML template.

Document type: [complaint/motion/brief/etc]

Extract and replicate:
1. Page setup (margins, line spacing, line numbering if present)
2. Typography (fonts, sizes for body text, headings, captions)
3. Document structure (caption format, section numbering style)
4. Signature block positioning

Generate a complete HTML template with:
- Embedded CSS that precisely matches the formatting
- Placeholder variables using {{VARIABLE_NAME}} syntax for dynamic content
- Comments explaining each section
- Print-ready styling (@media print rules)
- Line numbering CSS if the sample uses it

Common placeholders to include:
- {{COURT_NAME}}
- {{PLAINTIFF_NAME}}
- {{DEFENDANT_NAME}}
- {{CASE_NUMBER}}
- {{ATTORNEY_NAME}}
- {{ATTORNEY_BAR_NUMBER}}
- {{ATTORNEY_ADDRESS}}
- {{DOCUMENT_TITLE}}
- {{FILING_DATE}}

Output only the complete HTML file, no explanations." > templates/html/[document-type]-draft.html
   ```

   **Important**: Use `cat` to pipe the file content to Gemini's stdin. Gemini cannot read files by path - it needs the actual file content piped in.

3. Save generated template to `templates/html/[document-type]-draft.html`

### Phase 3: User Review & Validation

**Agent Actions:**
1. Inform user: "Template generated at `templates/html/[document-type]-draft.html`. Please review it in the Explorer by double-clicking to open in your browser."
2. Wait for user feedback

**User Actions:**
- Double-click the HTML file in Explorer to open in browser
- Review formatting, margins, fonts, structure
- Provide feedback: "Looks good" or "Fix X"

### Phase 4: Finalize or Iterate

**If user approves:**
```bash
# Rename draft to active template
mv templates/html/[document-type]-draft.html templates/html/[document-type].html
```

**If user requests changes:**
- Agent makes manual edits to the HTML/CSS
- Or regenerates with modified prompt
- Repeat Phase 3

---

## File Structure

```
templates/
├── _samples/              # Original samples (for reference)
│   ├── complaint-sample.pdf
│   ├── motion-sample.docx
│   └── brief-sample.pdf
└── html/                  # Active templates (used for drafting)
    ├── complaint.html     # Active complaint template
    ├── motion.html        # Active motion template
    └── brief.html         # Active brief template
```

---

## Template Naming Convention

- **Sample files:** `[document-type]-sample.[ext]` (e.g., `complaint-sample.pdf`)
- **Draft templates:** `[document-type]-draft.html` (e.g., `complaint-draft.html`)
- **Active templates:** `[document-type].html` (e.g., `complaint.html`)

---

## Notes

- Templates are case-specific (stored in each case folder)
- No versioning for MVP - just overwrite when updating
- User validates by viewing HTML in browser (double-click in Explorer)
- Agent should preserve original samples in `_samples/` for reference

