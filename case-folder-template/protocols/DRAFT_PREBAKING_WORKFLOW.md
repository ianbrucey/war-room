# Protocol: Enhanced Outline Creation (Draft Pre-Baking)

**Status:** Ready for use
**Owner:** Drafting Layer
**Last Updated:** 2025-01-30

---

## Purpose

Create detailed outlines that serve as complete drafting blueprints, ensuring drafts emerge 90%+ complete with minimal post-draft editing.

**Reference Linking:** All work products use reference IDs tracked in `.manifest.json` to create explicit, verifiable connections between strategy → evidence → outline → draft.

---

## When to Use This Protocol

**Trigger Conditions:**

1. **User requests outline creation**:
   - "Create outline for [document type]"
   - "I'm ready to plan the draft"
   - "Let's outline the motion"

2. **Step 2.75 (Draft Planning) active**:
   - Strategy development complete (Step 2)
   - Evidence planning complete (Step 2.5)
   - User ready to transition to drafting

3. **Before any Step 3 drafting**:
   - NEVER proceed to drafting without approved outline
   - Outline must be enhanced with semantic guidance

---

## Prerequisites

Before creating outline, verify:
- [ ] STRATEGIC_INTENT.md exists (from Step 2)
- [ ] Claims folder exists with completed claims (from Step 2.5 - Claim Building via CLAIM_BUILDER.md)
- [ ] Evidence bundles exist (from Step 2.5 - Evidence Planning)
- [ ] Case_Summary_and_Timeline.md current

**If missing:** Prompt user to complete prerequisite steps first.

**Note:** Claims should be created using `.augment/protocols/CLAIM_BUILDER.md` during Strategy Development Phase 2.5. Each claim folder contains:
- `element_checklist.md` - IRAC passages, legal standards, fact-to-element mappings
- `viability_assessment.md` - Adversarial testing, viability scores
- `evidence_mapping.md` - Evidence-to-element connections
- `adversarial_analysis.md` - Opponent's defense and our rebuttals

**Claims Folder Structure:**
```
step_2_strategy_research/strategy_[###]_[name]/claims/
├── _claims_index.json
├── count_1_[claim_name]/
├── count_2_[claim_name]/
└── count_3_[claim_name]/
```

---

## Outline Creation Process

### Step 1: Generate Reference ID and Initialize Manifest

**Agent Actions:**

1. **Generate reference ID:**
   ```
   Format: outline_[SEQUENCE]_[DOCUMENT_TYPE]
   Example: outline_001_mtd_response
   ```

2. **Get parent strategy reference ID** from STRATEGIC_INTENT.md frontmatter

3. **Update manifest:**
   ```bash
   python scripts/manifest_manager.py \
     --action add_outline \
     --reference_id outline_001_mtd_response \
     --parent_strategy strategy_001_mtd_response \
     --file_path "step_2_75_draft_planning/outlines/response_mtd_outline_001.md"
   ```

**Manifest validates:**
- Parent strategy exists
- All evidence bundles referenced exist
- All element checklists referenced exist

**If validation fails:** Prompt user to create missing work products first.

---

### Step 2: Load All Context

**Agent Actions:**
```python
# Load required files
strategic_intent = load_file("STRATEGIC_INTENT.md")

# Load claims from claims folder (NEW STRUCTURE)
claims_index = load_file("step_2_strategy_research/*/claims/_claims_index.json")
for claim in claims_index["claims"]:
    claim_folder = claim["folder"]
    element_checklist = load_file(f"{claim_folder}/element_checklist.md")
    viability_assessment = load_file(f"{claim_folder}/viability_assessment.md")
    evidence_mapping = load_file(f"{claim_folder}/evidence_mapping.md")
    adversarial_analysis = load_file(f"{claim_folder}/adversarial_analysis.md")

# Load evidence bundles
evidence_bundles = load_files("step_2_5_evidence_planning/evidence_bundles/*.md")

# Load case summary
case_summary = load_file("Case_Summary_and_Timeline.md")
```

**Validation:**
- [ ] All files loaded successfully
- [ ] No broken references
- [ ] All claims marked as `complete` in `_claims_index.json`

---

### Step 3: Create Outline Structure

**Agent Actions:**

1. **Select template** based on document type:
   - Motion: `templates/enhanced_outline_template.md`
   - Complaint: `templates/enhanced_outline_complaint.md`
   - Brief: `templates/enhanced_outline_brief.md`

2. **Populate global semantic guidance** from STRATEGIC_INTENT.md:
   - Terminology preferences (✅ use / ❌ avoid)
   - Overall tone directive
   - Emphasis/de-emphasis strategy
   - Narrative approach

3. **Create section structure** following template

4. **Add frontmatter with reference IDs:**
   ```markdown
   ---
   reference_id: outline_001_mtd_response
   parent_strategy: strategy_001_mtd_response
   evidence_bundles_used: [evidence_bundle_001_standing, evidence_bundle_002_wrongful_withholding]
   element_checklists_used: [element_checklist_conversion]
   created: 2025-01-30T13:00:00Z
   approved: false
   ---
   ```

---

### Step 4: Add Semantic Guidance Layer

**For EACH major section, add:**

**A. Tone Directive**
```markdown
### Tone Directive
[Assertive / Defensive / Neutral / Conciliatory]

**Why this tone:**
[Strategic rationale from STRATEGIC_INTENT.md]
```

**B. Emphasis Points**
```markdown
### Emphasis Points
**Emphasize:**
- [Point 1 from STRATEGIC_INTENT.md]
- [Point 2 from STRATEGIC_INTENT.md]

**De-emphasize:**
- [Point 1 to downplay]
```

**C. Terminology Preferences**
```markdown
### Terminology
✅ **Use:** "[Preferred term]" (not "[alternative]")
❌ **Avoid:** "[Term to avoid]" - [Why it hurts case]
```

---

### Step 5: Draft Key Passages

**For critical sections, draft opening passages:**

**Agent Actions:**

1. **Draft introduction** (2-3 sentences):
   - Sets tone
   - Establishes framing
   - Incorporates terminology preferences

2. **Draft transitions** between major sections:
   - Ensures logical flow
   - Maintains strategic continuity

3. **Draft critical framings** where word choice matters:
   - Use element checklists for guidance
   - Apply strategic framing from STRATEGIC_INTENT.md

**Example:**
```markdown
### Drafted Opening Passage
```
"Bank of America wrongfully converted Plaintiff's chose in action—his right to trust property—by repeatedly refusing to honor valid documentation establishing his entitlement. Despite receiving a Certification of Trust explicitly naming Plaintiff as beneficiary, Bank demanded additional paperwork in a transparent effort to delay payment."
```
```

---

### Step 6: Create Element-by-Element Roadmap

**For EACH claim, create detailed roadmap:**

**Agent Actions:**

1. **Load claim folder** for this claim:
   - `element_checklist.md` - IRAC passages, legal standards
   - `viability_assessment.md` - Strengths/weaknesses
   - `evidence_mapping.md` - Evidence-to-element connections
   - `adversarial_analysis.md` - Opponent's defense and rebuttals

2. **For each element, include:**

```markdown
#### Element [X]: [ELEMENT NAME]

##### Legal Standard
**Controlling Authority:** [Case from element_checklist.md]
**Definition:** [How courts define this element]

##### Our Facts
- [Fact 1 from element_checklist.md]
- [Fact 2 from element_checklist.md]

##### Evidence
- {{EVIDENCE:[bundle_id]}} → Exhibit [X], page [Y] (from evidence_mapping.md)
- **Key Quote:** "[Quote from exhibit]"

##### Strategic Framing
**Emphasis:** [From element_checklist.md]
**Terminology:** ✅ "[Preferred]" ❌ "[Avoid]"

##### Adversarial Considerations
**Anticipated Defense:** [From adversarial_analysis.md]
**Our Rebuttal:** [From adversarial_analysis.md]

##### Drafted Passage
```
[2-4 paragraphs from element_checklist.md incorporating:
- Legal standard with citation
- Facts with evidence citations
- Strategic framing
- Terminology preferences
- Preemptive rebuttal to anticipated defense]
```
```

---

### Step 6.5: Create Citation-Level Blueprint (NEW - MANDATORY)

**Purpose:** Transform element-organized case law into paragraph-level citation instructions for drafting.

**Time:** 30-45 minutes per claim

**Why This Step is Critical:**
- Step 6 creates element-by-element roadmap with case law references
- But drafting requires **paragraph-level instructions**: which case to cite in which paragraph, with what format
- Without this step, agent must make strategic decisions during drafting (causing turbulence)
- With this step, agent executes blueprint (95%+ complete on first pass)

**Input:**
- `element_checklist.md` (Phase 4 - IRAC analysis)
- `case_law_supplement.md` (Phase 4.5 - comprehensive case law)
- `evidence_mapping.md` (Phase 5 - evidence sources)
- `adversarial_analysis.md` (Phase 6 - anticipated defenses)

**Output:** Enhanced outline with paragraph-level citation map

---

#### Step 6.5.1: For Each Element, Create Paragraph Structure

**Determine how many paragraphs needed for this element:**

**Typical Structure:**
- ¶1: Introduce legal standard (statutory definition)
- ¶2: Apply Supreme Court/Circuit precedent (controlling authority)
- ¶3: Apply analogous case law (factual similarity)
- ¶4-5: Apply facts to standard (with evidence citations)
- ¶6: Adversarial preemption (rebut anticipated defense)
- ¶7: Conclude element satisfied

**Adjust based on element complexity** (simple elements may need 3-4 paragraphs, complex elements may need 8-10)

---

#### Step 6.5.2: For Each Paragraph, Specify Citation Details

**Add to outline under each element:**

```markdown
### Citation-Level Blueprint: [Element Name]

#### ¶[N]: [Purpose of Paragraph]

**Primary Citation:**
- **Case:** [Case name from case_law_supplement.md]
- **Citation:** [Full citation]
- **Format:** [Full quote / Parenthetical / Signal]
- **Quote/Parenthetical:** "[Exact text to include]"
- **Pinpoint:** [Specific page]
- **Strategic Note:** [Why this citation here, why this format]

**Supporting Citation(s):** (if applicable)
- **Case:** [Case name]
- **Citation:** [Full citation]
- **Format:** [Parenthetical / Signal]
- **Signal:** [See / See also / Cf. / But see]
- **Parenthetical:** "[Exact text]"
- **Pinpoint:** [Page]

**Evidence Reference:** (if applicable)
- **Exhibit:** [Exhibit letter/number]
- **Document:** [Document name from evidence_mapping.md]
- **Page:** [Page number]
- **Lines:** [Line numbers if applicable]
- **Quote:** "[Exact quote from exhibit]"
- **Strategic Framing:** [How to present this evidence]

**Adversarial Preemption:** (if applicable)
- **Anticipated Defense:** [From adversarial_analysis.md]
- **Rebuttal:** [Our response]
- **Supporting Citation:** [Case/Evidence]

**Drafted Passage:** (optional but recommended)
```
[2-4 sentences showing how to weave together citation, evidence, and strategic framing]
```
```

---

#### Step 6.5.3: Determine Citation Order and Format

**For each paragraph, apply these rules:**

**Citation Order:**
1. **Lead with strongest authority** (Supreme Court > Circuit > District)
2. **Follow with most analogous facts** (factual similarity strengthens argument)
3. **End with synthesis** (how cases work together)

**Citation Format Decision Tree:**

**Use Full Citation with Direct Quote when:**
- Key holding that's central to argument
- Language is particularly favorable
- Supreme Court or Circuit precedent
- Example: *Henson v. Santander*, 137 S. Ct. 1718, 1724 (2017) ("you have to attempt to collect debts owed another")

**Use Full Citation with Parenthetical when:**
- Supporting point but not central
- Holding can be summarized briefly
- Multiple cases making same point
- Example: *Barbato v. Greystone*, 916 F.3d 260, 265 (3d Cir. 2019) (property manager qualified as debt collector)

**Use Signal + Short Citation when:**
- Additional support for established point
- Showing weight of authority
- Comparing or contrasting
- Signals: "See" (support), "See also" (additional), "Cf." (compare), "But see" (contrary)
- Example: *See also Jeter v. Credit Bureau*, 760 F.2d 1168, 1175 (11th Cir. 1985)

**Use Block Quote when:**
- Quote is 50+ words
- Language is particularly powerful
- Detailed standard needs full articulation
- Format: Indent, no quotes, citation after

---

#### Step 6.5.4: Map Case Law from Supplement to Paragraphs

**For each element:**

1. **Review case_law_supplement.md** for this element
2. **Assign cases to specific paragraphs:**
   - Tier 1 (Controlling Authority) → ¶2-3 (establish legal standard)
   - Tier 2 (Analogous Facts) → ¶3-4 (factual similarity)
   - Tier 3 (Recent Applications) → ¶4-5 (show current law)
   - Tier 4 (Defensive Cases) → ¶6 (adversarial preemption)
3. **Specify citation format** for each case
4. **Extract key quotes** and pinpoint citations
5. **Write strategic notes** explaining why this case here

---

#### Step 6.5.5: Integrate Evidence Citations

**For each paragraph that applies facts:**

1. **Review evidence_mapping.md** for this element
2. **Identify specific evidence** for each fact
3. **Specify exhibit references:**
   - Exhibit letter/number
   - Page numbers
   - Line numbers (if applicable)
   - Exact quotes to use
4. **Determine citation format:**
   - Inline: (Exhibit A, p. 5)
   - With quote: "Text from exhibit." (Exhibit A, p. 5, lines 12-15)
   - Multiple exhibits: (Exhibits A-C)

---

#### Step 6.5.6: Insert Adversarial Preemption Points

**For each anticipated defense (from adversarial_analysis.md):**

1. **Determine where to preempt** (usually after stating our position)
2. **Specify rebuttal language**
3. **Identify supporting citations** (Tier 4 defensive cases)
4. **Write transition language** ("Defendant may argue... This fails because...")

---

#### Step 6.5.7: Validation Checklist

**For each element, verify:**

- [ ] Every paragraph has clear purpose statement
- [ ] Primary citation specified for each paragraph
- [ ] Citation format determined (quote/parenthetical/signal)
- [ ] Pinpoint citations provided for all quotes
- [ ] Evidence references include exhibit, page, line numbers
- [ ] Adversarial preemption points identified
- [ ] Strategic notes explain citation choices
- [ ] No placeholders or "TBD" items
- [ ] Drafted passages provided for critical paragraphs

**If ANY unchecked:** Complete missing details before proceeding.

---

### Step 7: Validate Outline Completeness

**Before presenting to user, verify:**

**Strategy Integration:**
- [ ] Terminology preferences documented
- [ ] Tone directives established for each section
- [ ] Emphasis/de-emphasis guidance provided
- [ ] Strategic intent reflected throughout

**Legal Scaffolding:**
- [ ] All claim folders referenced
- [ ] All element checklists loaded from claim folders
- [ ] Case law supplements loaded (Phase 4.5 output)
- [ ] Legal standards defined with case law (not placeholders)
- [ ] Controlling authority identified for each element
- [ ] Adversarial analysis incorporated (anticipated defenses + rebuttals)

**Evidence Integration:**
- [ ] All evidence bundles referenced
- [ ] Page citations provided for key exhibits
- [ ] Evidence mapped to specific arguments
- [ ] Exhibit references include page and line numbers

**Citation-Level Blueprint (Step 6.5):**
- [ ] Paragraph-level citation map created for each element
- [ ] Primary citation specified for each paragraph
- [ ] Citation format determined (quote/parenthetical/signal)
- [ ] Pinpoint citations provided for all quotes
- [ ] Strategic notes explain citation choices
- [ ] Evidence integration points specified
- [ ] Adversarial preemption points identified

**Blueprint Completeness:**
- [ ] Key passages drafted for critical sections
- [ ] Transition language drafted between sections
- [ ] Narrative flow established
- [ ] No ambiguities about "what to say" or "how to say it"
- [ ] No strategic decisions left for drafting phase

**If ANY checkbox is unchecked:** Outline is NOT ready. Complete missing items.

---

### Step 8: Present Outline for Approval

**Agent Prompt:**
```
"I've created a detailed outline for [document type]. This outline includes:

✅ Complete section structure
✅ Strategic guidance for each section (tone, emphasis, terminology)
✅ Drafted key passages for critical sections
✅ Evidence citations with page numbers
✅ Legal authority citations (specific cases, not placeholders)
✅ Element-by-element roadmap
✅ Transition language between sections

The outline is designed to minimize drafting ambiguity. When I draft, I'll be expanding this blueprint rather than making strategic decisions.

Location: [path to outline file]

Would you like to review the outline before I proceed to drafting?"
```

**Wait for user approval.**

**When user approves:**
```bash
python scripts/manifest_manager.py \
  --action approve_outline \
  --reference_id outline_001_mtd_response
```

This marks outline as approved in manifest and timestamps the approval.

---

## Quality Control Checkpoints

### Checkpoint 1: Pre-Creation
- [ ] All prerequisite files exist
- [ ] Strategy development complete
- [ ] Evidence planning complete

### Checkpoint 2: During Creation
- [ ] Semantic guidance added to each section
- [ ] Key passages drafted for critical sections
- [ ] Element roadmaps complete
- [ ] All references resolve

### Checkpoint 3: Pre-Approval
- [ ] Validation checklist complete
- [ ] No placeholders or "TBD" items
- [ ] Outline is 90% complete blueprint

### Checkpoint 4: Post-Approval
- [ ] Human approval obtained
- [ ] Approval logged in approval_log.json
- [ ] Ready for Step 3 transition

---

## Common Issues and Solutions

### Issue 1: Missing Element Checklists
**Problem:** Element checklists don't exist
**Solution:** Prompt user: "Element checklists missing. Build claims first using CLAIM_BUILDER.md: 'Build claim for [claim name]' or complete Strategy Development Phase 2.5."

### Issue 2: Generic Semantic Guidance
**Problem:** Tone directive says "professional" (too vague)
**Solution:** Reference STRATEGIC_INTENT.md for specific guidance. If missing, ask user: "Should this section be assertive, defensive, or neutral?"

### Issue 3: Evidence Without Page Citations
**Problem:** Outline says "Exhibit A" without page numbers
**Solution:** Load evidence bundle and extract page citations. If missing, prompt user: "Evidence bundle needs page citations. Update bundle first."

### Issue 4: Placeholder Legal Citations
**Problem:** Outline says "[Case law TBD]"
**Solution:** This is NOT acceptable. Complete legal research before creating outline.

---

## Integration with Drafting (Step 3)

**When user proceeds to drafting:**

1. **Agent loads approved outline**
2. **For each section:**
   - Read semantic guidance
   - Use drafted key passages as starting points
   - Expand following element roadmap
   - Insert evidence citations from bundles
   - Apply terminology preferences
   - Maintain tone directive

3. **Agent should RARELY need to make strategic decisions** during drafting—outline provides all guidance

---

## Related Documentation

- **Strategy Development:** `.augment/protocols/STRATEGY_DEVELOPMENT.md`
- **Claim Builder:** `.augment/protocols/CLAIM_BUILDER.md` (creates element checklists)
- **Legal Research:** `.augment/protocols/LEGAL_RESEARCH.md`
- **Evidence Planning:** `workflows/step_2_5_evidence_workflow.md`
- **Drafting:** `workflows/step_3_drafting_workflow.md`
- **Templates:** `templates/enhanced_outline_template.md`

