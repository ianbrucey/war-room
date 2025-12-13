# Protocol: Claim Builder v2 (Gemini API Integration)

**Status:** Production Ready
**Owner:** Strategy Layer
**Last Updated:** 2025-11-04

---

## Purpose

Automate claim element analysis using a three-step research process with Gemini API integration:
- **Phase 2 (Web Research):** Research legal elements and controlling authority
- **Phase 3 (Local Research):** Extract case facts from documents
- **Phase 4 (Gemini Integration):** Automated fact-to-element mapping with IRAC analysis
- **Phase 5 (Agent Review):** Strategic refinement and quality control

**Advantages over v1:**
- 30-40% faster (18-29 min vs 30-40 min per claim)
- Consistent quality (Gemini follows structured prompt)
- Systematic citations (every fact linked to source)
- Scalable (handles multi-claim cases efficiently)
- Agent focuses on strategy, not mechanical mapping
- Cost-effective ($0.005-0.015 per claim)

---

## When to Use

**Use Claim Builder v2 (Gemini Integration) when:**
- Building standard claims with well-defined elements
- Have complete case facts in Case_Summary_and_Timeline.md
- Need fast, reliable element analysis with systematic citations
- Working with 1-5 claims
- Want automated fact-to-element mapping

**Use Claim Builder v1 (Manual) when:**
- Need interactive refinement with user during mapping
- Claim requires highly nuanced legal judgment
- User wants step-by-step guidance through each element
- Building novel or complex legal theories

---

## Quick Start: Automated Pipeline (Recommended)

**Use `scripts/build_claim_automated.py` for fully automated execution:**

```bash
# Interactive mode (with approval gates)
python scripts/build_claim_automated.py \
    --claim-name "fdcpa_cease_communication_violation" \
    --claim-number 2

# Fully automated (skip approval gates)
python scripts/build_claim_automated.py \
    --claim-name "fdcpa_cease_communication_violation" \
    --claim-number 2 \
    --auto-approve
```

**Time:** 8-10 minutes per claim
**Output:** `claims/count_[N]_[claim_name]/element_checklist.md`

**What it does:**
1. Auto-loads active case and strategy from `settings.json`
2. Prepares staging directory (includes `_index.json` for document metadata)
3. Submits Phase 2 and Phase 3 research requests (parallel execution)
4. Monitors progress until both complete
5. Runs Gemini integration (creates `claims/count_[N]_[claim_name]/element_checklist.md`)
6. Optional approval gates for agent review

**Critical:** Output is written to `claims/count_[N]_[claim_name]/element_checklist.md`, NOT `claims/count_[N]_[claim_name]_element_checklist.md`

---

## Folder Structure

**Organized by claim for clean separation:**

```
step_2_strategy_research/[STRATEGY_ID]/
├── supporting_docs/
│   ├── count_1_accord_satisfaction/
│   │   ├── elements.md          (Phase 2 output: legal elements)
│   │   └── facts.md             (Phase 3 output: case facts)
│   ├── count_2_fdcpa_cease_communication_violation/
│   │   ├── elements.md
│   │   └── facts.md
│   ├── count_3_fdcpa_validation_violations/
│   │   ├── elements.md
│   │   └── facts.md
│   └── _archive/                (old test files)
│
└── claims/
    ├── _claims_index.json           (Master index with completion tracking)
    ├── count_1_accord_satisfaction/
    │   ├── element_checklist.md     (Phase 4 output: IRAC analysis)
    │   ├── case_law_supplement.md   (Phase 4.5 output: Comprehensive case law arsenal)
    │   ├── evidence_mapping.md      (Phase 5 output: Facts → Evidence → Elements)
    │   ├── adversarial_analysis.md  (Phase 6 output: Opponent's defense + rebuttals)
    │   ├── viability_assessment.md  (Phase 7 output: Element scoring + claim strength)
    │   └── .claim_metadata.json     (Status, reference_id, timestamps)
    ├── count_2_fdcpa_cease_communication_violation/
    │   ├── element_checklist.md
    │   ├── evidence_mapping.md
    │   ├── adversarial_analysis.md
    │   ├── viability_assessment.md
    │   └── .claim_metadata.json
    └── count_3_fdcpa_validation_violations/
        ├── element_checklist.md
        ├── evidence_mapping.md
        ├── adversarial_analysis.md
        ├── viability_assessment.md
        └── .claim_metadata.json
```

**Key Points:**
- Each claim gets its own subfolder in both `supporting_docs/` and `claims/`
- Naming convention: `count_[N]_[claim_name]`
- Research outputs (elements.md, facts.md) go in `supporting_docs/count_[N]_[claim_name]/`
- Claim analysis outputs go in `claims/count_[N]_[claim_name]/`
- All four analysis files (element_checklist, evidence_mapping, adversarial_analysis, viability_assessment) are **required** for complete claim development

---

## Workflow Overview

**Total Time:** 80-155 minutes per claim (complete analysis with case law research)

| Phase | Task | Output | Tool | Time |
|-------|------|--------|------|------|
| Phase 2 | Research legal elements | `elements.md` | GPT Researcher (web) | 5-7 min |
| Phase 3 | Extract case facts | `facts.md` | GPT Researcher (local) | 5-7 min |
| Phase 4 | Automated IRAC integration | `element_checklist.md` | Gemini API | 3-5 min |
| **Phase 4.5** | **Case law discovery** | `case_law_supplement.md` | CourtListener + GPT Researcher | **45-100 min** |
| Phase 5 | Evidence mapping | `evidence_mapping.md` | Manual/Agent | 5-10 min |
| Phase 6 | Adversarial analysis | `adversarial_analysis.md` | Manual/Agent | 10-15 min |
| Phase 7 | Viability assessment | `viability_assessment.md` | Manual/Agent | 5-10 min |
| Phase 8 | Agent review & finalization | All files refined | Manual | 5-10 min |

**Sequential Dependencies:**
- Phase 4.5 (Case Law Discovery) requires Phase 4 (Element Checklist) to be complete
- Phase 5 (Evidence Mapping) requires Phase 4.5 (Case Law Discovery) to be complete
- Phase 6 (Adversarial Analysis) requires Phase 4.5 (Case Law Discovery) to be complete
- Phase 7 (Viability Assessment) requires Phase 6 (Adversarial Analysis) to be complete
- Phase 8 (Finalization) requires all previous phases to be complete

**CRITICAL:** Phase 4.5 (Case Law Discovery) is MANDATORY before proceeding to outline creation. Element checklists from Phase 4 contain only 1-2 foundational cases from GPT Researcher. Phase 4.5 provides the comprehensive case law arsenal (10-20 cases per claim) needed for drafting.

---

## Phase 2: Research Legal Elements (Web Research)

**Purpose:** Research legal elements, controlling authority, and burden of proof

**⚠️ IMPORTANT: Async Execution Pattern**

Research tasks can take 3-5 minutes. **DO NOT** wait synchronously. Instead:
1. Submit research request (returns immediately with request_id)
2. Continue with other work or monitor progress
3. Check status periodically
4. Retrieve results when complete

### Step 2.1: Submit Research Request

```bash
python scripts/research_strategy.py \
    --case-id "[CASE_ID]" \
    --strategy-id "[STRATEGY_ID]" \
    --query "What are the legal elements of [CLAIM_NAME] under [JURISDICTION] law? Include controlling authority, statutory citations, and burden of proof for each element." \
    --mode single_agent \
    --source web \
    --output-name "count_[N]_elements" \
    --async
```

**Note:** The `--async` flag (if implemented) would return immediately. If not available, submit the request and note the request_id from output.

### Step 2.2: Monitor Progress

```bash
# Get request_id from previous output
REQUEST_ID="research-xxxxx"

# Check status
curl -s http://localhost:8000/api/v1/research/$REQUEST_ID | python3 -m json.tool

# Monitor until complete
while true; do
  STATUS=$(curl -s http://localhost:8000/api/v1/research/$REQUEST_ID | python3 -c "import sys, json; print(json.load(sys.stdin)['status'])")
  echo "Status: $STATUS"
  if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then
    break
  fi
  sleep 10
done
```

### Step 2.3: Verify Output

```bash
# Check output file exists
ls -lh [CASE_FOLDER]/step_2_strategy_research/[STRATEGY_ID]/supporting_docs/count_[N]_[claim_name]/elements.md

# Preview content
head -50 [CASE_FOLDER]/step_2_strategy_research/[STRATEGY_ID]/supporting_docs/count_[N]_[claim_name]/elements.md
```

**Output Location:** `supporting_docs/count_[N]_[claim_name]/elements.md`

**Output Should Contain:**
- Legal elements with definitions
- Controlling authority (cases, statutes)
- Burden of proof for each element
- Procedural requirements

---

## Phase 3: Extract Case Facts (Local Research)

**Purpose:** Extract case-specific facts from documents

### Step 3.1: Prepare Staging Directory

```bash
# Create staging directory
STAGING_DIR="runtime/_staging/claim_[N]_[claim_name]"
mkdir -p "$STAGING_DIR"

# Copy primary fact source
cp [CASE_FOLDER]/step_1_interview/1.4_fact_gathering/Case_Summary_and_Timeline.md \
   "$STAGING_DIR/"

# Copy supporting evidence
cp [CASE_FOLDER]/documents/*.txt "$STAGING_DIR/"
cp [CASE_FOLDER]/documents/*.pdf "$STAGING_DIR/"

# Verify
ls -la "$STAGING_DIR/"
```

### Step 3.2: Submit Local Research Request (Async)

```bash
python scripts/research_strategy.py \
    --case-id "[CASE_ID]" \
    --strategy-id "[STRATEGY_ID]" \
    --query "Extract all facts from case documents that support or relate to [CLAIM_NAME]. Include dates, parties, actions, communications, and evidence. Organize chronologically." \
    --mode single_agent \
    --source local \
    --doc-path "[ABSOLUTE_PATH_TO_STAGING_DIR]" \
    --output-name "count_[N]_facts" \
    --async
```

**⚠️ ASYNC PATTERN:** Same as Phase 2 - submit request, monitor progress, retrieve results.

### Step 3.3: Monitor and Verify

```bash
# Monitor progress (same pattern as Phase 2)
REQUEST_ID="research-yyyyy"

# Check status periodically
curl -s http://localhost:8000/api/v1/research/$REQUEST_ID | python3 -m json.tool

# Verify output
ls -lh [CASE_FOLDER]/step_2_strategy_research/[STRATEGY_ID]/supporting_docs/count_[N]_[claim_name]/facts.md
```

**Output Location:** `supporting_docs/count_[N]_[claim_name]/facts.md`

**Output Should Contain:**
- Chronological fact timeline
- Key events with dates
- Party actions and communications
- Evidence references

---

## Phase 4: Automated Integration (Gemini API)

**Purpose:** Use Gemini API to map facts to legal elements and generate complete element checklist

**Time:** 3-5 minutes
**Cost:** $0.005-0.015 per claim

### Step 4.1: Run Integration Script

```bash
python scripts/integrate_claim_elements.py \
    --case-id "[CASE_ID]" \
    --strategy-id "[STRATEGY_ID]" \
    --claim-name "[CLAIM_NAME]" \
    --elements-file "count_[N]_elements.md" \
    --facts-file "count_[N]_facts.md" \
    --output-name "count_[N]_[claim_name]"
```

**Example:**
```bash
python scripts/integrate_claim_elements.py \
    --case-id "20251006_214823_consumer_portfolio_services" \
    --strategy-id "strategy_001_amended_complaint" \
    --claim-name "accord_and_satisfaction" \
    --elements-file "count_1_accord_satisfaction/elements.md" \
    --facts-file "count_1_accord_satisfaction/facts.md" \
    --output-name "count_1_accord_satisfaction"
```

**Input:** `supporting_docs/count_1_accord_satisfaction/elements.md` and `facts.md`
**Output:** `claims/count_1_accord_satisfaction/element_checklist.md`

### Step 4.2: What Gemini Does

Gemini API automatically:
1. Reads legal elements from Phase 2 output
2. Reads case facts from Phase 3 output
3. Maps facts to each legal element with precise citations
4. Generates complete IRAC analysis for each element
5. Adds source citations: `[Source: document.pdf, Page X]`
6. Identifies evidence gaps
7. Suggests strategic framing

### Step 4.3: Monitor Gemini Execution

The script provides real-time progress:
```
======================================================================
CLAIM ELEMENTS INTEGRATION (Gemini API)
======================================================================

Claim: accord_and_satisfaction
Elements file: count_1_elements.md
Facts file: count_1_facts.md
Output: count_1_accord_satisfaction_element_checklist.md

📖 Step 1: Loading input files...
✅ Loaded elements (12,543 chars)
✅ Loaded facts (8,921 chars)

📋 Step 2: Loading element checklist template...
✅ Template loaded

🤖 Step 3: Constructing Gemini prompt...
✅ Prompt constructed (25,432 chars)

🚀 Step 4: Calling Gemini API for fact-to-element mapping...
   Model: gemini-2.5-flash
   Temperature: 0.35
   Timeout: 120s

✅ Element checklist generated: count_1_accord_satisfaction_element_checklist.md

📊 Token Usage:
   - Input tokens: 18,234
   - Output tokens: 9,876
   - Total tokens: 28,110
   - Estimated cost: $0.0041

======================================================================
✅ INTEGRATION COMPLETE
======================================================================
```

### Step 4.4: Verify Output

```bash
# Check output file exists
OUTPUT_FILE="[CASE_FOLDER]/step_2_strategy_research/[STRATEGY_ID]/claims/count_[N]_[claim_name]/element_checklist.md"
ls -lh "$OUTPUT_FILE"

# Preview structure
grep -E "^## Element|^### Issue|^### Rule|^### Application|^### Conclusion" "$OUTPUT_FILE"

# Check for source citations
grep -c "\[Source:" "$OUTPUT_FILE"
```

**Success Criteria:**
- [ ] Output file created in `claims/count_[N]_[claim_name]/element_checklist.md`
- [ ] IRAC structure for each element
- [ ] All legal elements covered
- [ ] Facts have source citations
- [ ] No hallucinated facts or cases
- [ ] Element satisfaction assessments included

**Critical:** File is at `claims/count_[N]_[claim_name]/element_checklist.md`, NOT `claims/count_[N]_[claim_name]_element_checklist.md`

**IMPORTANT:** Element checklist contains only 1-2 foundational cases from GPT Researcher's element research (Phase 2). **Phase 4.5 (Case Law Discovery) is MANDATORY** before proceeding to Phase 5 to build comprehensive case law arsenal for drafting.

---

## Phase 4.5: Case Law Discovery (NEW - MANDATORY)

**Purpose:** Find comprehensive case law to support each element beyond the 1-2 foundational cases from Phase 2.

**Time:** 45-100 minutes per claim (15-20 minutes per element)

**Why This Phase is Critical:**
- Phase 2 (GPT Researcher element research) only provides 1-2 foundational cases per element
- These foundational cases define the element but don't provide the citation arsenal needed for drafting
- Drafting requires 10-20 cases per claim with circuit-specific precedent, analogous facts, recent applications, and defensive cases

**When to Execute:** After Phase 4 (Element Checklist) completes, before Phase 5 (Evidence Mapping)

**Output:** `claims/count_[N]_[claim_name]/case_law_supplement.md`

---

### Step 4.5.1: Identify Case Law Gaps

**For each element in element_checklist.md:**

1. Count existing case citations (usually 1-2 foundational cases)
2. Identify what's missing:
   - Circuit-specific precedent (binding authority)
   - Cases with analogous facts
   - Recent applications (last 5 years)
   - Cases addressing anticipated defenses

---

### Step 4.5.2: Choose Research Method

**Two Options:**

**Option A: Automated Research (Recommended - Default)**
- Hybrid: CourtListener API + GPT Researcher
- Time: 14-20 minutes per element
- Cost: $0.20-$0.40 per element
- Fully automated, no manual work

**Option B: Manual Research (User-Directed)**
- Agent generates research guide for VLex/Westlaw/Lexis
- User performs manual research
- User uploads results
- Agent synthesizes into case_law_supplement.md
- Use when: User has premium database access, automated research insufficient, or user prefers manual control

**Proceed with Option A unless user requests Option B.**

---

### Step 4.5.3: Execute Automated Research (Option A - Default)

**For each element, run 4 targeted searches:**

#### Search 1: Circuit-Specific Precedent (CourtListener API)

**Purpose:** Find binding authority from Supreme Court and Circuit Court

**Method:**
```bash
curl "http://localhost:8001/api/v1/search?type=o&q=[ELEMENT_KEYWORDS]&court=ca11&date_filed__gte=2018-01-01&cited_by__gte=5&page_size=20"
```

**Example (FDCPA Debt Collector Element):**
```bash
curl "http://localhost:8001/api/v1/search?type=o&q=FDCPA+debt+collector+property+manager&court=ca11&date_filed__gte=2018-01-01&cited_by__gte=5&page_size=20" > supporting_docs/count_2_fdcpa/courtlistener_element_1_circuit.json
```

**Parameters:**
- `type=o` - Search opinions (case law)
- `q` - Element keywords
- `court=ca11` - 11th Circuit (adjust for jurisdiction)
- `date_filed__gte=2018-01-01` - Last 7 years
- `cited_by__gte=5` - Influential cases (5+ citations)
- `page_size=20` - Return 20 results

**Time:** 2-3 minutes
**Cost:** Free

Save to: `supporting_docs/count_[N]_[claim_name]/courtlistener_element_[X]_circuit.json`

---

#### Search 2: Analogous Fact Patterns (GPT Researcher)

**Purpose:** Find cases with similar facts to strengthen application

**Method:**
```bash
python scripts/research_strategy.py \
    --case-id "[CASE_ID]" \
    --strategy-id "[STRATEGY_ID]" \
    --query "Find cases involving [ELEMENT] with facts similar to: [OUR_KEY_FACTS]. Focus on [JURISDICTION] cases. Include case names, citations, holdings, and factual similarities." \
    --mode single_agent \
    --output-name "count_[N]_element_[X]_analogous_cases"
```

**Example (FDCPA Debt Collector Element):**
```bash
python scripts/research_strategy.py \
    --case-id "20251107_223931_tricon_residential" \
    --strategy-id "strategy_001_claims_exploration" \
    --query "Find FDCPA cases where property management companies were held to be 'debt collectors' when collecting rent/fees for property owners. Focus on 11th Circuit and federal cases. Include case names, citations, holdings, and factual similarities to property managers acting as agents." \
    --mode single_agent \
    --output-name "count_2_element_1_analogous_cases"
```

**Time:** 5-7 minutes
**Cost:** $0.10-$0.20

Output: `supporting_docs/count_[N]_[claim_name]/count_[N]_element_[X]_analogous_cases.md`

---

#### Search 3: Recent Developments (CourtListener API)

**Purpose:** Show current application of law (last 2-5 years)

**Method:**
```bash
curl "http://localhost:8001/api/v1/search?type=o&q=[ELEMENT_KEYWORDS]&court=ca11&date_filed__gte=2023-01-01&page_size=10"
```

**Example (FDCPA Debt Collector Element):**
```bash
curl "http://localhost:8001/api/v1/search?type=o&q=FDCPA+debt+collector+Henson&court=ca11&date_filed__gte=2023-01-01&page_size=10" > supporting_docs/count_2_fdcpa/courtlistener_element_1_recent.json
```

**Time:** 2-3 minutes
**Cost:** Free

Save to: `supporting_docs/count_[N]_[claim_name]/courtlistener_element_[X]_recent.json`

---

#### Search 4: Defensive Cases (GPT Researcher)

**Purpose:** Find cases rejecting anticipated defenses

**Method:**
```bash
python scripts/research_strategy.py \
    --case-id "[CASE_ID]" \
    --strategy-id "[STRATEGY_ID]" \
    --query "Find cases where defendants argued [ANTICIPATED_DEFENSE] and how courts rejected it. Focus on [JURISDICTION]. Include case names, citations, defense arguments, and court's reasoning." \
    --mode single_agent \
    --output-name "count_[N]_element_[X]_defensive_cases"
```

**Example (FDCPA Debt Collector Element):**
```bash
python scripts/research_strategy.py \
    --case-id "20251107_223931_tricon_residential" \
    --strategy-id "strategy_001_claims_exploration" \
    --query "Find FDCPA cases where property managers or management companies argued they were the 'landlord' or 'creditor' (not debt collectors), and how courts rejected this defense. Focus on 11th Circuit and federal cases applying Henson v. Santander." \
    --mode single_agent \
    --output-name "count_2_element_1_defensive_cases"
```

**Time:** 5-7 minutes
**Cost:** $0.10-$0.20

Output: `supporting_docs/count_[N]_[claim_name]/count_[N]_element_[X]_defensive_cases.md`

---

### Step 4.5.4: Generate Manual Research Guide (Option B - On Request)

**When user requests manual research, generate:**

`supporting_docs/count_[N]_[claim_name]/manual_research_guide_element_[X].md`

**Template:** See `templates/manual_research_guide_template.md`

**Guide should include:**
1. Element name and definition
2. Specific search queries for VLex/Westlaw/Lexis
3. Jurisdiction filters
4. Date range recommendations
5. What to look for in each tier
6. How to document findings

**Example guide content:**
```markdown
# Manual Research Guide: Element 1 - Debt Collector Definition

## Search 1: Circuit-Specific Precedent
**Database:** VLex, Westlaw, or Lexis
**Query:** "FDCPA" AND "debt collector" AND "property manager" AND court:ca11
**Date Range:** 2018-present
**Look for:** Binding 11th Circuit authority defining "debt collector"
**Document:** Case name, citation, holding, key quote with pinpoint

## Search 2: Analogous Facts
**Query:** "FDCPA" AND "debt collector" AND "property management" AND "agent"
**Look for:** Cases where property managers collected for owners
**Document:** Facts, holding, factual similarities to our case

[Continue for all 4 searches...]
```

**After user uploads results:** Proceed to Step 4.5.5 to synthesize

---

### Step 4.5.5: Create Case Law Supplement

**Synthesize all research into:** `claims/count_[N]_[claim_name]/case_law_supplement.md`

**Structure:**

```markdown
# Case Law Supplement: [Claim Name]

## Element 1: [Element Name]

### Tier 1: Controlling Authority (Supreme Court / Circuit)
1. **[Case Name], [Citation]**
   - Holding: [Key holding]
   - Key Quote: "[Quote for drafting]"
   - Pinpoint: [Page]
   - Application: [How it helps]

### Tier 2: Analogous Fact Patterns
1. **[Case Name], [Citation]**
   - Facts: [Similar facts]
   - Holding: [How court ruled]
   - Factual Similarity: [Parallels to our case]

### Tier 3: Recent Applications (Last 5 Years)
1. **[Case Name], [Citation]**
   - Date: [Recent date]
   - Holding: [Current application]

### Tier 4: Defensive Cases
1. **[Case Name], [Citation]**
   - Defense Raised: [What opponent argued]
   - Court's Response: [How rejected]
   - Application: [Preempt defense]

## Summary: Citation Arsenal
- Tier 1: [Number] cases
- Tier 2: [Number] cases
- Tier 3: [Number] cases
- Tier 4: [Number] cases
- **Total:** [Number] cases for drafting
```

---

### Step 4.5.6: Update Element Checklist Reference

**Add to each element's Rule section in element_checklist.md:**

```markdown
**📚 Additional Authority:** See `case_law_supplement.md` for:
- Tier 1: [N] controlling authority cases
- Tier 2: [N] analogous fact cases
- Tier 3: [N] recent applications
- Tier 4: [N] defensive cases
- **Total:** [N] cases available for drafting
```

---

### Step 4.5.7: Validation Checklist

**Before proceeding to Phase 5:**

- [ ] Case law supplement created for ALL elements
- [ ] Each element has 12-20 cases total (3-5 per tier)
- [ ] All cases include pinpoint citations
- [ ] Tier 1 includes circuit-specific binding authority
- [ ] Tier 2 includes factually similar cases
- [ ] Tier 3 includes recent cases (last 5 years)
- [ ] Tier 4 includes defensive cases
- [ ] Element checklist updated with reference
- [ ] All research saved to supporting_docs

**If ANY unchecked:** Complete missing research first.

---

## Phase 5: Evidence Mapping

**Purpose:** Create systematic mapping of facts → evidence → elements

**Time:** 5-10 minutes
**Input:** `element_checklist.md` (Phase 4 output)
**Output:** `evidence_mapping.md`
**Template:** `templates/claim_folder/evidence_mapping_template.md`

### Step 5.1: Create Evidence Mapping File

```bash
# Copy template
cp templates/claim_folder/evidence_mapping_template.md \
   [CASE_FOLDER]/step_2_strategy_research/[STRATEGY_ID]/claims/count_[N]_[claim_name]/evidence_mapping.md
```

### Step 5.2: Map Evidence to Each Element

**For each element in element_checklist.md:**

1. **Extract facts** from element checklist IRAC Application section
2. **Identify evidence sources** for each fact:
   - Document name (from `documents/_index.json`)
   - Page numbers
   - Specific quotes or data points
3. **Link to evidence bundles** (if Step 2.5 complete)
4. **Note evidence gaps** where facts lack documentary support

**Example Mapping:**
```markdown
## Element 1: Bona fide dispute / unliquidated claim
### Our Facts
- Dispute letter mailed 2025-05-23; delivered 2025-06-03
- CRA reports 2025-06-16 show "Account previously in dispute"

### Evidence
- Case_Summary_and_Timeline.md (lines 45-52)
- documents/debt_validation_letter.pdf (Page 1)
- documents/usps_delivery_confirmation.pdf
- documents/credit_report_equifax_2025-06-16.pdf (Page 2, Account Status)

### Evidence Bundles
- {{EVIDENCE:bundle_001_dispute_documentation}}

### Gaps/Weaknesses
- Need certified mail receipt for dispute letter
```

### Step 5.3: Identify Authentication Requirements

**For each piece of evidence:**
- How will it be authenticated at trial?
- Who can testify to authenticate?
- Is it self-authenticating (business records, public records)?

### Step 5.4: Verify Evidence Mapping Completeness

**Checklist:**
- [ ] All elements have evidence mapped
- [ ] All facts have source citations
- [ ] Page numbers provided where applicable
- [ ] Evidence gaps identified
- [ ] Authentication requirements noted
- [ ] Evidence bundles linked (if available)

---

## Phase 6: Adversarial Analysis

**Purpose:** Build opponent's defense strategy and develop our rebuttals

**Time:** 10-15 minutes
**Input:** `element_checklist.md` (Phase 4 output)
**Output:** `adversarial_analysis.md`
**Template:** `templates/claim_folder/adversarial_analysis_template.md`

### Step 6.1: Create Adversarial Analysis File

```bash
# Copy template
cp templates/claim_folder/adversarial_analysis_template.md \
   [CASE_FOLDER]/step_2_strategy_research/[STRATEGY_ID]/claims/count_[N]_[claim_name]/adversarial_analysis.md
```

### Step 6.2: Build Opponent's Defense (Element-by-Element)

**For each element, construct opponent's IRAC argument:**

**Example:**
```markdown
### Element 1: Bona fide dispute

#### Opponent's Argument

**Issue:** Whether a bona fide dispute existed at time of payment

**Rule:** O.C.G.A. § 11-3-311 requires dispute to exist when instrument tendered

**Application:**
- First money order (05/16) predates dispute letter (05/23)
- Payments appear to be routine installments, not settlement offers
- No contemporaneous documentation of dispute intent

**Conclusion:** No bona fide dispute existed; payments were ordinary debt payments

#### Strength of Opponent's Defense
**Defense Strength:** 6/10
- Timing issue is legitimate concern for first payment
- Second payment (06/13) clearly post-dispute
```

### Step 6.3: Develop Our Rebuttals

**For each opponent argument, create counter-strategy:**

```markdown
### Rebuttal to Element 1 Defense

**Opponent's Argument:** No bona fide dispute at time of first payment

**Our Counter:**

1. **Legal Authority Counter:**
   - Pattern of dispute supports bona fide dispute for both payments
   - Alternative pleading under O.C.G.A. § 13-4-103 if marked "payment in full"

2. **Factual Counter:**
   - Second payment (06/13) clearly within dispute period
   - CRA dispute noted 06/16 confirms ongoing dispute
   - Cease-and-desist letter sent 06/20 reinforces dispute posture

3. **Logical Counter:**
   - Defendant's retention of both payments without refund supports acceptance
   - 90-day refund period expired without action

**Strengthened IRAC Passage:**
[Revised passage incorporating rebuttal points for use in drafting]
```

### Step 6.4: Identify Weakest and Strongest Elements

**Weakest Element:**
- Which element is most vulnerable to attack?
- What is opponent's likely strategy?
- How do we mitigate this weakness?

**Strongest Element:**
- Which element is our strongest point?
- How do we leverage this in drafting?
- Can we use this to offset weaknesses?

### Step 6.5: Anticipate Procedural Defenses

**Consider:**
- Motion to Dismiss (12(b)(6)) arguments
- Summary Judgment arguments
- Affirmative defenses (statute of limitations, waiver, etc.)

### Step 6.6: Verify Adversarial Analysis Completeness

**Checklist:**
- [ ] Opponent's defense built for each element
- [ ] Defense strength scored (0-10)
- [ ] Rebuttals developed for each defense
- [ ] Weakest element identified with mitigation strategy
- [ ] Strongest element identified with leverage strategy
- [ ] Procedural defenses anticipated
- [ ] Strengthened IRAC passages drafted

---

## Phase 7: Viability Assessment

**Purpose:** Score claim strength element-by-element and assess overall viability

**Time:** 5-10 minutes
**Input:** `adversarial_analysis.md` (Phase 6 output)
**Output:** `viability_assessment.md`
**Template:** `templates/claim_folder/viability_assessment_template.md`

### Step 7.1: Create Viability Assessment File

```bash
# Copy template
cp templates/claim_folder/viability_assessment_template.md \
   [CASE_FOLDER]/step_2_strategy_research/[STRATEGY_ID]/claims/count_[N]_[claim_name]/viability_assessment.md
```

### Step 7.2: Score Each Element

**Create element-by-element comparison table:**

```markdown
| Element | Our Strength (0-10) | Their Defense (0-10) | Net Advantage | Winner |
|---------|---------------------|----------------------|---------------|--------|
| Element 1: Bona fide dispute | 7 | 6 | +1 | Us |
| Element 2: Good-faith tender | 8 | 4 | +4 | Us |
| Element 3: Conspicuous statement | 6 | 7 | -1 | Them |
| Element 4: Payment obtained | 10 | 2 | +8 | Us |
| Element 5: Exceptions inapplicable | 7 | 5 | +2 | Us |

**Overall Viability Score:** 7.6 / 10
```

**Scoring Guidance:**
- **Our Strength:** How well can we prove this element? (0-10)
  - 0-3: Weak/insufficient evidence
  - 4-6: Moderate evidence, some gaps
  - 7-8: Strong evidence, minor gaps
  - 9-10: Overwhelming evidence, no gaps
- **Their Defense:** How strong is opponent's counter-argument? (0-10)
  - 0-3: Weak defense, easily rebutted
  - 4-6: Moderate defense, requires work to rebut
  - 7-8: Strong defense, difficult to rebut
  - 9-10: Devastating defense, may defeat element

### Step 7.3: Calculate Overall Viability Score

**Formula:**
```
Overall Viability Score = Average of "Our Strength" scores
```

**Interpretation:**
- **8-10:** Highly viable (strong claim, proceed with confidence)
- **6-7:** Viable (moderate claim, proceed with caution)
- **4-5:** Weak (risky claim, consider strengthening or dropping)
- **0-3:** Not viable (abandon or significantly strengthen before filing)

### Step 7.4: Assess Litigation Risk

**Best Case Scenario:**
- What happens if everything goes our way?
- Likelihood: X%

**Most Likely Scenario:**
- What is most likely to happen?
- Likelihood: X%

**Worst Case Scenario:**
- What happens if opponent's defense succeeds?
- Likelihood: X%

### Step 7.5: Make Recommendation

**Recommendation Options:**
1. **Proceed:** Claim is viable, proceed to outline/drafting
2. **Conditional:** Proceed if specific evidence obtained or legal issue resolved
3. **Strengthen:** Claim needs additional work before filing
4. **Abandon:** Claim not viable, do not pursue

### Step 7.6: Verify Viability Assessment Completeness

**Checklist:**
- [ ] All elements scored (Our Strength and Their Defense)
- [ ] Net advantage calculated for each element
- [ ] Overall viability score calculated
- [ ] Viability interpretation provided
- [ ] Litigation risk scenarios assessed
- [ ] Clear recommendation made
- [ ] Next steps identified

---

## Phase 8: Agent Review and Finalization

**Purpose:** Final quality control and strategic refinement across all claim documents

**Time:** 5-10 minutes
**Input:** All Phase 4-7 outputs
**Output:** Refined and finalized claim folder

### Step 8.1: Cross-Document Consistency Check

**Verify consistency across all four files:**

1. **Element Checklist ↔ Evidence Mapping:**
   - All facts in element checklist have evidence sources in evidence mapping
   - No orphaned evidence in evidence mapping

2. **Element Checklist ↔ Adversarial Analysis:**
   - All elements analyzed in adversarial analysis
   - Rebuttals address weaknesses identified in element checklist

3. **Adversarial Analysis ↔ Viability Assessment:**
   - Viability scores reflect adversarial analysis findings
   - Weakest/strongest elements consistent across both documents

### Step 8.2: Apply Strategic Framing

**Load strategic direction:**
```bash
# Review strategic intent
cat [CASE_FOLDER]/STRATEGIC_INTENT.md
```

**Refine all documents:**
- Apply terminology preferences from STRATEGIC_INTENT.md
- Adjust tone (assertive, defensive, neutral)
- Incorporate emphasis points
- Use preferred framing for key concepts

### Step 8.3: Verify Factual Accuracy

**Critical verification:**
- [ ] All facts are from source documents (no hallucinations)
- [ ] All citations are correct (document names, page numbers)
- [ ] All case law citations are accurate
- [ ] All statutory references are correct
- [ ] All dates and amounts are accurate

### Step 8.4: Strengthen Weak Areas

**Agent Actions:**

1. **Add missing citations:**
   - If any fact lacks source citation, add it
   - Format: `[Source: document_name.pdf, Page X]`

2. **Clarify ambiguous applications:**
   - If fact-to-element mapping is unclear, refine
   - Add additional facts if needed

3. **Enhance legal authority:**
   - Add additional case citations if available
   - Strengthen statutory references

4. **Note evidence gaps honestly:**
   - Identify missing evidence
   - Flag areas needing discovery
   - Document weaknesses (don't hide them)

### Step 8.5: Update Claim Metadata

**Update `.claim_metadata.json`:**
```json
{
  "reference_id": "claim_001_accord_and_satisfaction",
  "parent_strategy": "strategy_001_amended_complaint",
  "claim_number": 1,
  "claim_name": "accord_and_satisfaction",
  "status": "complete",
  "viability_score": 7.6,
  "created": "2025-11-03T00:00:00Z",
  "completed": "2025-11-05T14:30:00Z",
  "phases_complete": {
    "phase_2_elements_research": true,
    "phase_3_facts_extraction": true,
    "phase_4_element_checklist": true,
    "phase_5_evidence_mapping": true,
    "phase_6_adversarial_analysis": true,
    "phase_7_viability_assessment": true,
    "phase_8_finalization": true
  }
}
```

### Step 8.6: Final Verification Checklist

**Before marking claim complete:**
- [ ] All four required files exist (element_checklist, evidence_mapping, adversarial_analysis, viability_assessment)
- [ ] All facts accurately cited with sources
- [ ] Legal standards match Phase 2 research
- [ ] IRAC structure complete in element checklist
- [ ] Evidence mapped to all elements
- [ ] Adversarial analysis complete with rebuttals
- [ ] Viability assessment scored and recommendation made
- [ ] Strategic framing applied consistently
- [ ] Terminology consistent across all documents
- [ ] Evidence gaps noted honestly
- [ ] No hallucinations or fabricated facts
- [ ] Claim metadata updated
- [ ] Ready for Step 2.5 (Evidence Planning) or Step 2.75 (Draft Planning)

---

## Async Research Pattern (Critical)

**⚠️ IMPORTANT:** Research tasks can take 3-10 minutes. **DO NOT** block waiting synchronously.

### Pattern 1: Submit and Monitor

```bash
# Submit request (returns immediately)
python scripts/research_strategy.py \
    --case-id "[CASE_ID]" \
    --strategy-id "[STRATEGY_ID]" \
    --query "[QUERY]" \
    --mode single_agent \
    --source web \
    --output-name "output_name"

# Note the request_id from output
REQUEST_ID="research-xxxxx"

# Monitor in background
while true; do
  STATUS=$(curl -s http://localhost:8000/api/v1/research/$REQUEST_ID | \
           python3 -c "import sys, json; print(json.load(sys.stdin)['status'])")
  echo "[$(date +%H:%M:%S)] Status: $STATUS"
  if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then
    break
  fi
  sleep 10
done

# Retrieve results
curl -s http://localhost:8000/api/v1/research/$REQUEST_ID | python3 -m json.tool
```

### Pattern 2: Parallel Execution

When building multiple claims, submit all research requests first, then monitor:

```bash
# Submit Phase 2 for all claims
for i in 1 2 3; do
  python scripts/research_strategy.py \
      --query "Elements for claim $i" \
      --output-name "count_${i}_elements" &
done

# Submit Phase 3 for all claims
for i in 1 2 3; do
  python scripts/research_strategy.py \
      --source local \
      --query "Facts for claim $i" \
      --output-name "count_${i}_facts" &
done

# Monitor all requests
# (Check status of each request_id)
```

---

## Complete Example: Accord and Satisfaction Claim

### Phase 2: Research Elements (Async)

```bash
python scripts/research_strategy.py \
    --case-id "20251006_214823_consumer_portfolio_services" \
    --strategy-id "strategy_001_amended_complaint" \
    --query "What are the legal elements of accord and satisfaction under Georgia law? Include controlling authority, statutory citations, and burden of proof for each element." \
    --mode single_agent \
    --source web \
    --output-name "count_1_elements"

# Note request_id, monitor until complete
```

### Phase 3: Extract Facts (Async)

```bash
# Prepare staging
mkdir -p runtime/_staging/claim_1_accord_satisfaction
cp firms/justicequest_llp/cases/20251006_214823_consumer_portfolio_services/step_1_interview/1.4_fact_gathering/Case_Summary_and_Timeline.md \
   runtime/_staging/claim_1_accord_satisfaction/
cp firms/justicequest_llp/cases/20251006_214823_consumer_portfolio_services/documents/*.txt \
   runtime/_staging/claim_1_accord_satisfaction/

# Submit research
python scripts/research_strategy.py \
    --case-id "20251006_214823_consumer_portfolio_services" \
    --strategy-id "strategy_001_amended_complaint" \
    --query "Extract all facts from case documents that support or relate to accord and satisfaction. Include dates, parties, actions, communications, and evidence. Organize chronologically." \
    --mode single_agent \
    --source local \
    --doc-path "/Users/ianbruce/Documents/2025 LAWSUITS AND COURT CASES/draft_agent/runtime/_staging/claim_1_accord_satisfaction" \
    --output-name "count_1_facts"

# Note request_id, monitor until complete
```

### Phase 4: Gemini Integration

```bash
python scripts/integrate_claim_elements.py \
    --case-id "20251006_214823_consumer_portfolio_services" \
    --strategy-id "strategy_001_amended_complaint" \
    --claim-name "accord_and_satisfaction" \
    --elements-file "count_1_elements.md" \
    --facts-file "count_1_facts.md" \
    --output-name "count_1_accord_satisfaction_element_checklist"
```

### Phase 5: Agent Review

Review output, apply strategic framing, verify accuracy, strengthen weak areas.

---

## Phase Dependencies and Rationale

**Why This Sequential Order?**

### Phase 4 (Element Checklist) Must Come First
- **Foundation for all downstream work:** Establishes legal elements, IRAC structure, and fact-to-element mappings
- **Required by Phase 5:** Evidence mapping needs to know which facts support which elements
- **Required by Phase 6:** Adversarial analysis needs to know our affirmative case before building opponent's defense

### Phase 5 (Evidence Mapping) Before Phase 6 (Adversarial Analysis)
- **Identifies evidence gaps early:** Knowing what evidence we have/lack informs adversarial analysis
- **Strengthens rebuttals:** Can reference specific evidence when countering opponent's arguments
- **Practical efficiency:** Evidence mapping is mechanical; adversarial analysis is strategic

### Phase 6 (Adversarial Analysis) Before Phase 7 (Viability Assessment)
- **Viability depends on adversarial testing:** Can't score claim strength without knowing opponent's defenses
- **Scoring requires both sides:** Viability assessment compares "Our Strength" vs "Their Defense"
- **Identifies weakest elements:** Adversarial analysis reveals which elements are most vulnerable

### Phase 7 (Viability Assessment) Before Phase 8 (Finalization)
- **Informs strategic decisions:** Viability score determines whether to proceed, strengthen, or abandon claim
- **Guides emphasis strategy:** Weakest/strongest element identification informs drafting priorities
- **Quality gate:** Low viability score triggers additional work before finalization

### Phase 8 (Finalization) Last
- **Cross-document consistency:** Ensures all four files are aligned and complete
- **Strategic framing:** Applies STRATEGIC_INTENT.md preferences across all documents
- **Final quality control:** Last chance to catch errors, hallucinations, or gaps

---

## Legal Research: Covered in Phase 2 (No Separate Phase Needed)

**Question:** Should there be a dedicated legal research phase after element checklist creation?

**Answer:** No. Legal research is already comprehensively covered in Phase 2 (Web Research).

**Rationale:**

1. **Phase 2 output (`elements.md`) includes:**
   - Legal elements with definitions
   - Controlling authority (case law)
   - Statutory citations
   - Burden of proof
   - Procedural requirements

2. **Additional research happens in Phase 6 (Adversarial Analysis):**
   - Research opponent's likely case law
   - Find distinguishing authority
   - Identify counter-arguments

3. **Draft Pre-Baking Protocol handles outline-level research:**
   - Step 2.75 (Draft Planning) includes legal research for specific arguments
   - Outline creation loads element checklists and adds case law as needed
   - See `.augment/protocols/DRAFT_PREBAKING_WORKFLOW.md`

4. **Avoiding redundancy:**
   - Claim Builder focuses on element analysis
   - Draft Pre-Baking focuses on argument construction
   - Separating concerns prevents duplicate work

**When to conduct additional legal research:**
- If Phase 2 output lacks sufficient case law → Re-run Phase 2 with refined query
- If adversarial analysis reveals new legal issues → Conduct targeted research in Phase 6
- If outline creation needs specific authority → Research during Step 2.75

---

## Troubleshooting

### Research task times out
**Solution:** Use async pattern. Submit request, monitor progress, don't block waiting.

### Gemini output has hallucinations
**Solution:** Review in Phase 8, correct manually. Consider refining prompt if systematic.

### Missing source citations
**Solution:** Gemini should add automatically. If missing, add manually in Phase 5 (Evidence Mapping) or Phase 8 (Finalization).

### Facts not from case documents
**Solution:** Verify Phase 3 local research used correct staging directory with Case_Summary_and_Timeline.md and all relevant documents.

### Legal elements incomplete
**Solution:** Review Phase 2 output. May need to refine query or use multi-agent mode for complex claims.

### Evidence mapping incomplete
**Solution:** Review `documents/_index.json` for available evidence. Note gaps honestly in evidence_mapping.md.

### Adversarial analysis too weak
**Solution:** Think like opponent's lawyer. What would YOU argue if defending? Build strongest possible defense, then rebut.

### Viability score unclear
**Solution:** Use scoring guidance in Phase 7. When in doubt, score conservatively (lower). Better to identify weaknesses now than in court.

### Missing required files
**Problem:** Claim folder missing one of the four required files
**Solution:** Check which phase was skipped. Complete all phases 4-7 before marking claim complete.

### Inconsistencies across files
**Problem:** Element checklist says one thing, adversarial analysis says another
**Solution:** Phase 8 cross-document consistency check should catch this. Review and align all files.

---

## Next Steps After Claim Builder Complete

**After completing all 8 phases for a claim:**

1. **Update `_claims_index.json`** - Mark claim as complete
2. **Repeat for additional claims** - Build remaining claims using same workflow
3. **Step 2.5: Evidence Planning** - Organize evidence bundles (uses `evidence_mapping.md`)
4. **Step 2.75: Draft Planning** - Create enhanced outline (uses all claim folder files)
5. **Step 3: Drafting** - Generate court-ready document

**Critical:** Do NOT proceed to Step 2.75 (Draft Planning) until ALL claims are complete through Phase 8. The enhanced outline creation protocol (`.augment/protocols/DRAFT_PREBAKING_WORKFLOW.md`) requires all four claim files for each claim:
- `element_checklist.md` - For IRAC passages and legal standards
- `evidence_mapping.md` - For evidence-to-element connections
- `adversarial_analysis.md` - For anticipated defenses and rebuttals
- `viability_assessment.md` - For strengths/weaknesses and strategic emphasis

---

## Related Documentation

- **Main Protocol:** `.augment/protocols/CLAIM_BUILDER.md`
- **Integration Script:** `scripts/integrate_claim_elements.py`
- **Quick Start Guide:** `confluence/docs/CLAIM_BUILDER_V2_QUICK_START.md`
- **Implementation Details:** `confluence/docs/CLAIM_BUILDER_V2_GEMINI_INTEGRATION.md`
- **Hybrid Mode Investigation:** `confluence/docs/HYBRID_MODE_INVESTIGATION_SUMMARY.md`
