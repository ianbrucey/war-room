# Protocol: Step 1 Interview Prerequisites

**Status:** Active
**Owner:** Interview Layer
**Last Updated:** January 2025

---

## Purpose

Enforce prerequisite-based workflow for Step 1 Interview to ensure critical contextual information is captured before case summarization. Prevents downstream issues where important nuances are missed during strategy development and drafting.

---

## When to Use This Protocol

**Trigger Conditions:**

1. User attempts to proceed to Step 1.4 (Case Summarization)
2. User requests "process documents" or "create case summary"
3. Agent detects workflow progression to Step 1.4
4. User uploads documents to Intake folder

---

## Workflow Structure

**Step 1.1: Client/User Interview** → Gather user's narrative summary
**Step 1.2: Party Identification** → Auto-derive from interview
**Step 1.3: Document Intake** → Upload and process documents (Phase 1-2 only)
**Step 1.4: Case Summarization** → Synthesize final case summary (Phase 3)

---

## Document Intake Workflow (Updated January 2025)

**Default Behavior (Recommended):**

```bash
# Run Phase 1-2, stop for annotations
python scripts/process_intake.py [INTAKE_PATH]
```

**Workflow:**
1. **Phase 1:** Extract text from all documents (parallel processing)
2. **Phase 2:** Generate document summaries (parallel processing)
3. **STOP** - Prompt user to add contextual annotations
4. User reviews summaries and adds notes (optional):
   ```bash
   python scripts/document_annotator.py --action add --document_id [ID] --notes "[notes]"
   ```
5. User manually triggers Phase 3:
   ```bash
   python scripts/process_intake.py [INTAKE_PATH] --phase synthesize
   ```

**Alternative: Skip Annotation Prompt:**

```bash
# Run all phases without stopping
python scripts/process_intake.py [INTAKE_PATH] --all-phases
```

**Why This Matters:**
- User sees AI-generated summaries before case synthesis
- User can add contextual notes AI cannot infer from documents
- Phase 3 synthesis integrates: client interview + parties + document summaries + user notes
- Better case summaries with fewer hallucinations
- Uses gemini-2.5-pro for Phase 3 (higher quality synthesis)

---

## Protocol Instructions

### Phase 0: Prerequisite Check

**Before allowing Step 1.4 (Case Summarization):**

1. Check if `[ACTIVE_CASE]/step_1_interview/1.1_client_interview/user_summary.md` exists
2. If missing → Execute Phase 1 (User Alert)
3. If exists → Proceed to Phase 2 (Automated Party Identification)

### Phase 1: User Alert (Missing Interview)

**Display warning:**

```
⚠️ No client interview summary found.

Proceeding without it may result in missing contextual nuances that are critical for strategy development and drafting.

Would you like to:
(1) Conduct client interview now (recommended)
(2) Proceed without interview (not recommended)
```

**If user chooses (1):**
- Execute Step 1.1 Client Interview Protocol
- Create `user_summary.md` in `1.1_client_interview/`
- Proceed to Phase 2

**If user chooses (2):**
- Log warning in `[ACTIVE_CASE]/.case_metadata.json`:
  ```json
  {
    "warnings": [{
      "timestamp": "[ISO_TIMESTAMP]",
      "type": "missing_client_interview",
      "message": "Case summarization proceeded without client interview",
      "acknowledged_by_user": true
    }]
  }
  ```
- Proceed to Phase 2

### Phase 2: Automated Party Identification

**After Step 1.1 interview completes:**

1. Read `user_summary.md`
2. Extract party names, roles, relationships
3. Auto-populate `[ACTIVE_CASE]/step_1_interview/1.2_party_identification/parties.json`
4. Mark Step 1.2 complete in `settings.json` → `workflow_settings.step_completion.step_1_interview.party_identification`
5. Proceed to Phase 3

### Phase 3: Document Intake Trigger

**After Steps 1.1-1.2 complete:**

1. Check if documents exist in `[ACTIVE_CASE]/Intake/`
2. If documents exist → Execute `scripts/process_intake.py`
3. If no documents → Ask user: "Would you like to upload documents now, or proceed without documents?"
4. Mark Step 1.3 complete in `settings.json` → `workflow_settings.step_completion.step_1_interview.document_processing`
5. Proceed to Phase 4

### Phase 4: Final Synthesis

**After Steps 1.1-1.3 complete:**

1. Read `user_summary.md` (Step 1.1)
2. Read `parties.json` (Step 1.2)
3. Read processed documents from `[ACTIVE_CASE]/documents/` (Step 1.3)
4. Synthesize into `[ACTIVE_CASE]/step_1_interview/1.4_fact_gathering/Case_Summary_and_Timeline.md`
5. Mark Step 1.4 complete in `settings.json` → `workflow_settings.step_completion.step_1_interview.case_summary_timeline`

---

## Integration with Existing Systems

### process_intake.py Integration

**Modify process_intake.py to check prerequisites:**

```python
# Before Phase 1 (Document Processing)
if not os.path.exists(f"{case_folder}/step_1_interview/1.1_client_interview/user_summary.md"):
    print("⚠️ Warning: No client interview summary found")
    print("Proceeding without it may result in missing contextual nuances")
    proceed = input("Continue anyway? (y/n): ")
    if proceed.lower() != 'y':
        sys.exit(0)
```

### settings.json Updates

**Add Step 1.1 to workflow instruction mapping:**

```json
"workflow_instruction_mapping": {
  "step_1_1": "workflows/step_1_interview_workflow.md#11-client-interview",
  "step_1_2": "workflows/step_1_interview_workflow.md#12-party-identification",
  "step_1_3": "workflows/step_1_interview_workflow.md#13-document-intake",
  "step_1_4": "workflows/step_1_interview_workflow.md#14-case-summarization"
}
```

**Add Step 1.1 completion tracking:**

```json
"step_1_interview": {
  "client_interview": false,
  "party_identification": false,
  "document_processing": false,
  "case_summary_timeline": false
}
```

---

## File Locations

**Step 1.1 Client Interview:**
- Location: `[ACTIVE_CASE]/step_1_interview/1.1_client_interview/`
- Output: `user_summary.md`
- Template: `workspace/step_1_interview/1.1_client_interview/interview_template.md`

**Step 1.2 Party Identification:**
- Location: `[ACTIVE_CASE]/step_1_interview/1.2_party_identification/`
- Output: `parties.json`
- Auto-populated from Step 1.1

**Step 1.3 Document Intake:**
- Location: `[ACTIVE_CASE]/step_1_interview/1.3_document_intake/`
- Input: `[ACTIVE_CASE]/Intake/`
- Output: `[ACTIVE_CASE]/documents/`
- Registry: `documents.json`

**Step 1.4 Case Summarization:**
- Location: `[ACTIVE_CASE]/step_1_interview/1.4_fact_gathering/`
- Output: `Case_Summary_and_Timeline.md`
- Synthesizes Steps 1.1-1.3

---

## Validation Rules

**Before Step 1.4:**
- Step 1.1 complete OR user acknowledged warning
- Step 1.2 complete (auto-populated from Step 1.1)
- Step 1.3 complete OR no documents uploaded

**Before Step 2 (Strategy):**
- Step 1.4 complete
- `Case_Summary_and_Timeline.md` exists
- File size > 1KB (not empty)

---

## Error Handling

**Missing user_summary.md:**
- Display warning
- Offer to conduct interview
- Log if user proceeds without interview

**Empty parties.json:**
- Auto-populate with "Unknown Party" placeholder
- Flag for user review

**No documents in Intake:**
- Ask user if documents will be uploaded
- Allow progression without documents if user confirms

**Case_Summary_and_Timeline.md validation fails:**
- Run document verification protocol
- Alert user to contradictions/missing information
- Require user approval before Step 2

---

## Success Criteria

1. User interview summary captured in `user_summary.md`
2. Parties auto-identified and populated in `parties.json`
3. Documents processed and organized in `documents/`
4. Final case summary synthesizes all three sources
5. No critical contextual information missing from downstream work

