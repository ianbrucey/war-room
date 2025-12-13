# Protocol: Respond to Opponent Filing

**Status:** Ready for use
**Owner:** Strategy Layer
**Last Updated:** October 29, 2025

---

## Purpose

Handle opponent filings (motions, complaints, discovery requests) through autonomous document processing, incremental case summary updates, and strategic response development.

**Key Capabilities**:
1. Autonomous processing (agent runs scripts, user only gives commands)
2. Incremental Case Summary updates (preserves existing context)
3. Dual-format output (JSON + Markdown for programmatic access)
4. Seamless integration with Strategy Development Protocol
5. Optional fact verification of opponent's claims

---

## When to Use This Protocol

**Trigger Conditions**:

1. **User receives opponent filing**:
   - "I want to strategize against this motion to dismiss"
   - "Opponent filed a complaint - help me respond"
   - "I got discovery requests - let's analyze them"
   - "They filed a motion for summary judgment"

2. **Mid-case document arrival**:
   - Opponent's response to our motion
   - Amended complaint
   - Discovery responses
   - Expert reports

3. **Any new opponent document** that requires strategic response

---

## Three-Phase Workflow

```
Phase 1: DOCUMENT PROCESSING (Agent runs process_intake.py)
    ↓
Phase 2: CASE SUMMARY UPDATE (Agent runs update_case_summary.py)
    ↓
Phase 3: STRATEGIC RESPONSE (Integrate with Strategy Development Protocol)
```

---

## Phase 1: DOCUMENT PROCESSING (5-10 minutes)

**Purpose:** Agent autonomously processes opponent's filing through text extraction and document summarization.

**User Responsibility:** Place PDF in Intake folder
**Agent Responsibility:** Run `process_intake.py` and monitor progress

---

### Step 1.1: Agent Instructs User

**Agent Prompt**:
```
Agent: "I'll help you strategize against this filing.

First, please place the opponent's filing (PDF) in the Intake folder:
[CASE_FOLDER]/Intake/

Let me know when it's ready."
```

**User Action**: Places PDF in Intake folder

**User Response**: "Ready"

---

### Step 1.2: Agent Verifies Document

**Agent Actions**:
```python
# Check Intake folder
intake_folder = Path(case_folder) / "Intake"
pdf_files = list(intake_folder.glob("*.pdf"))

if not pdf_files:
    Agent: "I don't see any PDF files in the Intake folder. Please check the path and try again."
    return

# List files found
Agent: f"Found {len(pdf_files)} document(s) in Intake folder:
{[f.name for f in pdf_files]}

Processing now..."
```

---

### Step 1.3: Agent Runs Document Processing

**Agent executes `process_intake.py` autonomously**:

```bash
# Run Phases 1 & 2 only (skip Phase 3 - Case Summary synthesis)
python scripts/process_intake.py [CASE_FOLDER]/Intake --phase extract
python scripts/process_intake.py [CASE_FOLDER]/Intake --phase summarize
```

**Why skip Phase 3?**
- Phase 3 (GPT Researcher synthesis) will be handled separately in Phase 2
- This allows incremental update instead of full regeneration
- Preserves existing Case Summary context

**Agent monitors progress**:
```
Agent: "Processing opponent's filing...

Phase 1: Text Extraction (Mistral OCR)
⏳ Extracting text from motion_to_dismiss.pdf...
✅ Extracted 15 pages in 45 seconds

Phase 2: Document Summary (Gemini)
⏳ Generating structured summary...
✅ Generated document summary with claim detection

Processing complete! (Total time: 2 minutes)"
```

---

### Step 1.4: Agent Presents Processing Summary

**Agent shows user what was processed**:

```
Agent: "Document processing complete! Here's what I found:

DOCUMENT PROCESSED:
📄 motion_to_dismiss.pdf (15 pages)
📋 Document Type: Motion
🎯 Classification: Motion to Dismiss

KEY INFORMATION EXTRACTED:
- Filing Date: 2025-10-25
- Court: N.D. Georgia
- Docket Number: 1:25-cv-12345
- Claims Targeted: [List of claims opponent is attacking]
- Legal Grounds: [Grounds for dismissal]

FILES CREATED:
- Full text: documents/motion_to_dismiss/full_text_extraction.txt
- Document summary: documents/motion_to_dismiss/document_summary.json

Next: I'll update the Case Summary with this new information."
```

---

## Phase 2: CASE SUMMARY UPDATE (3-5 minutes)

**Purpose:** Update existing Case Summary with new information from opponent's filing using GPT Researcher.

**Script:** `scripts/update_case_summary.py`

---

### Step 2.1: Agent Runs Update Script

**Agent executes `update_case_summary.py` autonomously**:

```bash
python scripts/update_case_summary.py \
    --case-id "[CASE_ID]" \
    --new-documents "documents/motion_to_dismiss/document_summary.json"
```

**What the script does**:
1. Reads existing `Case_Summary_and_Timeline.md` (if exists)
2. Reads new `document_summary.json` file(s)
3. Stages documents for GPT Researcher:
   - `existing_case_summary.md` (subject)
   - `new_document_1.json` (source)
   - `new_document_2.json` (source)
4. Calls GPT Researcher with UPDATE query
5. Parses JSON response
6. Saves both JSON and Markdown formats

**Agent monitors progress**:
```
Agent: "Updating Case Summary...

📁 Case folder: firms/justicequest_llp/cases/[CASE_ID]
✅ Found existing Case Summary (12,450 chars)
📄 Loading 1 new document(s)...
✅ Loaded: document_summary.json

📦 Staging documents...
✅ Staging complete: runtime/_staging/[request_id]

🤖 Running GPT Researcher...
📡 Calling GPT Researcher API...
✅ Request submitted: research-abc123
⏳ Waiting for completion (max 300s)...
   Status: processing (15s elapsed)
   Status: processing (20s elapsed)
✅ Completed in 45s

📊 Parsing response...
✅ Parsed JSON successfully
✅ Saved JSON: step_1_interview/1.4_fact_gathering/Case_Summary_and_Timeline.json

📝 Converting to Markdown...
✅ Saved Markdown: step_1_interview/1.4_fact_gathering/Case_Summary_and_Timeline.md

🧹 Cleaned up staging directory

✅ CASE SUMMARY UPDATE COMPLETE"
```

---

### Step 2.2: What Gets Updated

**Timeline**:
- New dates/events added chronologically
- Opponent's filing date added
- Motion deadlines added

**Claims**:
- Opponent's claims/defenses added
- Status updated (e.g., "Defendant filed MTD on Claim 1")

**Legal Issues**:
- New legal theories identified
- Opponent's arguments documented

**Procedural History**:
- Filing dates added
- Motion types recorded
- Parties' actions documented

**Evidence**:
- References to new evidence in opponent's filing
- Exhibits mentioned

---

### Step 2.3: What Gets Preserved

**Existing Content**:
- ✅ All existing timeline entries
- ✅ Original case facts
- ✅ Prior claims and legal issues
- ✅ User annotations (if any)
- ✅ Context and nuances from initial intake

**GPT Researcher Query** ensures preservation:
```
"INSTRUCTIONS:
1. Preserve ALL existing information from existing_case_summary.md
2. Add new information from new_document_*.json files
3. Integrate new timeline events chronologically
4. Note any contradictions between existing facts and new documents

CRITICAL: Return the COMPLETE updated Case Summary, not just the changes."
```

---

### Step 2.4: Dual-Format Output

**JSON Output** (`Case_Summary_and_Timeline.json`):
```json
{
  "case_metadata": {
    "case_name": "Bruce v. Happy Money",
    "case_number": "1:25-cv-12345",
    "court": "N.D. Georgia",
    "filing_date": "2025-09-28",
    "parties": [...]
  },
  "timeline": [...],
  "claims": [...],
  "legal_issues": [...],
  "key_facts": [...],
  "evidence": [...],
  "procedural_history": [...]
}
```

**Markdown Output** (`Case_Summary_and_Timeline.md`):
- Human-readable format
- Converted from JSON
- Same structure as before
- Compatible with existing workflows

---

### Step 2.5: Agent Presents Update Summary

**Agent shows user what changed**:

```
Agent: "Case Summary updated! Here's what changed:

TIMELINE UPDATES:
✅ Added: 2025-10-25 - Defendant filed Motion to Dismiss
✅ Added: 2025-11-15 - Response deadline

CLAIMS UPDATES:
✅ Updated Claim 1 (FDCPA): Status changed to "Defendant filed MTD"
✅ Added opponent's arguments:
   - Lack of subject matter jurisdiction
   - Failure to state a claim
   - Statute of limitations

LEGAL ISSUES ADDED:
✅ Federal question jurisdiction (28 U.S.C. § 1331)
✅ FDCPA standing requirements
✅ Statute of limitations accrual date

PROCEDURAL HISTORY:
✅ Added: 2025-10-25 - Motion to Dismiss filed by Defendant

FILES UPDATED:
- JSON: step_1_interview/1.4_fact_gathering/Case_Summary_and_Timeline.json
- Markdown: step_1_interview/1.4_fact_gathering/Case_Summary_and_Timeline.md

Ready to develop strategic response?"
```

---

## Phase 3: STRATEGIC RESPONSE (15-45 minutes)

**Purpose:** Transition to Strategy Development Protocol to plan response to opponent's filing.

---

### Step 3.1: Agent Offers Strategic Response

**After Case Summary update complete**:

```
Agent: "Document intake complete! 

I've analyzed opponent's motion to dismiss. Here's what I found:

OPPONENT'S ARGUMENTS:
1. Lack of subject matter jurisdiction
2. Failure to state a claim (FDCPA)
3. Statute of limitations expired

WEAKNESSES I IDENTIFIED:
- Argument 1 ignores federal question jurisdiction
- Argument 2 misapplies Heintz v. Jenkins
- Argument 3 miscalculates accrual date

Ready to develop a strategic response? I can:

OPTION A: Start strategic conversation (Phase 1 of Strategy Protocol)
  - We'll discuss response options together
  - I'll help you decide the best approach
  - Then create a documented plan

OPTION B: Run systematic analysis first
  - Analyze each argument's weakness (objective scores)
  - Identify strongest counterarguments
  - Generate data-driven recommendations
  - Then have strategic conversation

Which would you prefer?"
```

---

### Step 3.2: Transition to Strategy Development Protocol

**If user chooses Option A** (Strategic conversation):

Execute `.augment/protocols/STRATEGY_DEVELOPMENT.md` Phase 1:
- Create new strategy folder: `strategy_002_response_to_mtd`
- Start strategic conversation
- Explore response options
- Document strategic intent

**If user chooses Option B** (Systematic analysis):

Execute `.augment/protocols/STRATEGY_DEVELOPMENT.md` Phase 2.1 Option B:
- Run strategy algorithm on opponent's claims
- Calculate weakness scores for each argument
- Present findings
- Then proceed to strategic conversation

---

### Step 3.3: Optional Fact Verification

**Agent offers to verify opponent's factual claims**:

```
Agent: "I notice opponent's motion makes several factual assertions:

1. 'Plaintiff received notice on June 15, 2024'
2. 'Defendant sent validation notice within 5 days'
3. 'No response was received to settlement offer'

Would you like me to verify these claims against our case documents?

This will:
✅ Check each claim against source documents
✅ Identify contradictions or inaccuracies
✅ Provide exact citations for rebuttal
✅ Takes about 2-3 minutes

Run fact verification? (yes/no)"
```

**If yes**:

Follow `.augment/protocols/DOCUMENT_VERIFICATION.md`:
```bash
python scripts/verify_facts.py \
    --document_path "documents/motion_to_dismiss/document_summary.json" \
    --case_id "[CASE_ID]" \
    --verification_query "Verify opponent's factual claims against case documents"
```

---

## Complete Workflow Example

### User Scenario: Responding to Motion to Dismiss

**User**: "I want to strategize against this motion to dismiss"

**Agent**: "I'll help you strategize. First, please place the motion to dismiss (PDF) in the Intake folder:

firms/justicequest_llp/cases/[CASE_ID]/Intake/

Let me know when it's ready."

**User**: *places motion_to_dismiss.pdf in Intake folder*

**User**: "Ready"

**Agent**: "Found 1 document in Intake folder: motion_to_dismiss.pdf

Processing now..."

*[Agent runs process_intake.py Phases 1 & 2]*

**Agent** (2 minutes later): "Document processing complete!

DOCUMENT PROCESSED:
📄 motion_to_dismiss.pdf (15 pages)
📋 Document Type: Motion
🎯 Classification: Motion to Dismiss

KEY INFORMATION EXTRACTED:
- Filing Date: 2025-10-25
- Court: N.D. Georgia
- Docket Number: 1:25-cv-12345
- Claims Targeted: FDCPA Claim 1
- Legal Grounds: Jurisdiction, Failure to State Claim, Statute of Limitations

FILES CREATED:
- Full text: documents/motion_to_dismiss/full_text_extraction.txt
- Document summary: documents/motion_to_dismiss/document_summary.json

Next: Updating Case Summary with this new information..."

*[Agent runs update_case_summary.py]*

**Agent** (1 minute later): "Case Summary updated!

TIMELINE UPDATES:
✅ Added: 2025-10-25 - Defendant filed Motion to Dismiss
✅ Added: 2025-11-15 - Response deadline

CLAIMS UPDATES:
✅ Updated Claim 1 (FDCPA): Status changed to 'Defendant filed MTD'
✅ Added opponent's arguments:
   - Lack of subject matter jurisdiction
   - Failure to state a claim
   - Statute of limitations

LEGAL ISSUES ADDED:
✅ Federal question jurisdiction (28 U.S.C. § 1331)
✅ FDCPA standing requirements
✅ Statute of limitations accrual date

FILES UPDATED:
- JSON: step_1_interview/1.4_fact_gathering/Case_Summary_and_Timeline.json
- Markdown: step_1_interview/1.4_fact_gathering/Case_Summary_and_Timeline.md

Ready to develop strategic response?

OPTION A: Strategic conversation (we discuss options together)
OPTION B: Systematic analysis first (objective weakness scores)

Your choice?"

**User**: "Option B - run the analysis"

**Agent**: "Running systematic analysis on opponent's 3 arguments..."

*[Agent executes strategy algorithm]*

**Agent** (12 minutes later): "Systematic analysis complete!

DEFENSIVE ANALYSIS (Opponent's Arguments):
📊 Argument 1 (Jurisdiction): Weakness Score 9.2/20 (VERY WEAK - STRONG TARGET)
   - Weakest Element: Federal question jurisdiction clearly established
   - Why: Ignores 28 U.S.C. § 1331 and FDCPA federal question
   
📊 Argument 2 (Failure to State Claim): Weakness Score 7.5/20 (WEAK TARGET)
   - Weakest Element: Misapplies Heintz standard
   - Why: Our complaint meets all Heintz elements
   
📊 Argument 3 (Statute of Limitations): Weakness Score 5.8/20 (MODERATE)
   - Analysis: Accrual date calculation is debatable
   - Why: Some case law supports their interpretation

STRATEGIC RECOMMENDATION:
🎯 Focus: DEFENSIVE (Attack weakest arguments)
   - Primary: Oppose on jurisdiction grounds (weakness 9.2)
   - Secondary: Oppose on failure to state claim (weakness 7.5)
   - Consider: Concede statute of limitations on one claim, preserve others

Now let's have a strategic conversation about your response. What's your initial reaction to these findings?"

*[Transition to Strategy Development Protocol Phase 1]*

---

## Scripts Used

### 1. `scripts/process_intake.py`

**Purpose**: Extract text and generate document summaries

**Usage**:
```bash
# Run Phases 1 & 2 only (skip Phase 3)
python scripts/process_intake.py [CASE_FOLDER]/Intake --phase extract
python scripts/process_intake.py [CASE_FOLDER]/Intake --phase summarize
```

**Outputs**:
- `documents/[DOC_NAME]/full_text_extraction.txt`
- `documents/[DOC_NAME]/document_summary.json`

---

### 2. `scripts/update_case_summary.py`

**Purpose**: Update Case Summary with new documents using GPT Researcher

**Usage**:
```bash
python scripts/update_case_summary.py \
    --case-id "[CASE_ID]" \
    --new-documents "documents/motion_to_dismiss/document_summary.json"
```

**Outputs**:
- `step_1_interview/1.4_fact_gathering/Case_Summary_and_Timeline.json`
- `step_1_interview/1.4_fact_gathering/Case_Summary_and_Timeline.md`

**Features**:
- ✅ Reads existing Case Summary (preserves context)
- ✅ Stages documents for GPT Researcher
- ✅ Generates dual-format output (JSON + Markdown)
- ✅ Incremental updates (not full regeneration)

---

## Benefits

1. **Autonomous** - Agent handles intake, user doesn't run scripts manually
2. **Incremental** - Preserves existing Case Summary context
3. **Dual-Format** - JSON for programmatic access, Markdown for readability
4. **Seamless** - Integrates with Strategy Development Protocol
5. **Verified** - Optional fact verification of opponent's claims
6. **Transparent** - User sees what was processed and found
7. **Strategic** - Immediately transitions to response planning

---

## Related Documentation

- **Strategy Development**: `.augment/protocols/STRATEGY_DEVELOPMENT.md`
- **Document Verification**: `.augment/protocols/DOCUMENT_VERIFICATION.md`
- **Legal Research**: `.augment/protocols/LEGAL_RESEARCH.md`
- **Process Intake Script**: `scripts/process_intake.py`

