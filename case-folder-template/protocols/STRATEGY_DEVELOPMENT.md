# Protocol: Strategy Development (User-Friendly)

**Status:** Ready for use
**Owner:** Strategy Layer
**Last Updated:** October 28, 2025

---

## Purpose

Develop legal strategies through high-level conversation → documented planning → execution. This protocol prioritizes user-friendliness and intuitive workflow over technical complexity.

**Philosophy:** Like generals planning before infantry moves, we start with strategic conversation, then create a documented plan, then execute.

**Reference Linking:** All strategies use reference IDs tracked in `.manifest.json` to create explicit connections to downstream work products (evidence bundles, outlines, drafts).

---

## Core Principles

1. **Conversation First** - Always start with high-level strategic discussion
2. **Plan Before Execute** - Document the plan and get approval before research/drafting
3. **North Star Strategy** - Active strategy guides all downstream work (drafts, evidence, etc.)
4. **Context Continuity** - Strategy maintains context across multiple documents
5. **Iterative** - Strategies can be updated/refined as case evolves

---

## When to Use This Protocol

**Trigger Conditions**:

1. **User requests strategy development**:

   - "Let's strategize this case"
   - "I need to respond to [opponent's motion]"
   - "Help me plan our approach"
   - "What should we do about [issue]?"
2. **New case development** (after Step 1 complete)
3. **Responding to opponent's filing**
4. **Planning next move** (motion, discovery, settlement)
5. **Case direction change** (new evidence, new legal theory)

---

## Three-Phase Workflow

```
Phase 1: CONVERSATION (High-Level Strategic Discussion)
    ↓
Phase 2: PLANNING (Documented Strategy Plan)
    ↓
Phase 3: EXECUTION (Research, Evidence, Drafting)
```

---

## Phase 1: CONVERSATION (5-15 minutes)

**Purpose:** Have a strategic conversation like generals planning before battle. Understand the situation, explore options, decide direction.

### Step 1.1: Create Strategy Folder

**Agent Actions**:

1. Create new strategy folder: `step_2_strategy_research/strategy_[###]_[descriptive_name]/`
2. Initialize STRATEGIC_INTENT.md from template
3. Initialize .session_context.md for this conversation

**Inform User**:

```
"I've created a new strategy folder: strategy_001_motion_to_dismiss

Let's have a strategic conversation about your case. I'll ask some questions to understand the situation, then we'll explore options together."
```

---

### Step 1.2: Strategic Conversation

**Agent Role:** Act as strategic advisor, not just executor. Ask questions, provide feedback, explore options.

**Conversation Flow**:

**1. Understand the Situation**

```
Agent: "Let's start with the big picture. What's happening in your case right now?"

[User explains situation]

Agent: "Got it. So [summarize situation]. Let me ask a few clarifying questions:
- What triggered this? (opponent filing, deadline, new evidence, etc.)
- What's your main concern or goal?
- What's the timeline/deadline pressure?
- How confident are you about the direction? (uncertain → need guidance, confident → validate approach)"
```

**2. Provide Context & Feedback**

```
Agent: "Based on what you've told me and the case file, here's what I see:

SITUATION:
- [Summarize key facts]
- [Identify opponent's position if applicable]
- [Note any deadlines or constraints]

INITIAL THOUGHTS:
- [Strategic observation 1]
- [Strategic observation 2]
- [Potential concern or opportunity]

Does this match your understanding? Anything I'm missing?"
```

**3. Explore Options**

```
Agent: "I see a few possible directions we could go:

OPTION A: [Defensive approach]
- What: [Brief description]
- Why: [Strategic rationale]
- Pros: [Key advantages]
- Cons: [Key risks]

OPTION B: [Offensive approach]
- What: [Brief description]
- Why: [Strategic rationale]
- Pros: [Key advantages]
- Cons: [Key risks]

OPTION C: [Hybrid/Alternative approach]
- What: [Brief description]
- Why: [Strategic rationale]
- Pros: [Key advantages]
- Cons: [Key risks]

What's your initial reaction? Which direction feels right, or do you want to explore something different?"
```

**4. Refine Direction**

```
[User chooses direction or proposes alternative]

Agent: "Okay, so we're going with [CHOSEN DIRECTION]. Let me make sure I understand the nuances:

- [Clarifying question about user's intent]
- [Clarifying question about priorities]
- [Clarifying question about any specific angles]

[User provides nuances]

Agent: "Perfect. So to summarize our strategic direction:

PRIMARY OBJECTIVE: [What we're trying to achieve]
STRATEGIC APPROACH: [How we're going to do it]
KEY PRIORITIES: [What matters most]
NUANCES: [Any specific angles or interpretations]

Does this capture it?"
```

**5. Document Strategic Intent**

```
Agent: "Great. I'm documenting this in STRATEGIC_INTENT.md so we don't lose context as we work through this.

[Update STRATEGIC_INTENT.md with conversation outcomes]

Now, before we start any research or drafting, let me create a detailed plan for what we're going to do."
```

---

### Step 1.3: Generate Reference ID and Initialize Manifest

**Agent Actions**:

1. **Generate reference ID:**
   ```
   Format: strategy_[SEQUENCE]_[NAME]
   Example: strategy_001_mtd_response
   ```

2. **Update manifest:**
   ```bash
   python scripts/manifest_manager.py \
     --action add_strategy \
     --reference_id strategy_001_mtd_response \
     --file_path "step_2_strategy_research/strategy_001_mtd_response/STRATEGIC_INTENT.md"
   ```

3. **Add frontmatter to STRATEGIC_INTENT.md:**
   ```markdown
   ---
   reference_id: strategy_001_mtd_response
   created: 2025-01-30T10:00:00Z
   status: active
   ---
   ```

---

### Step 1.4: Update Strategic Intent

**Agent Actions**:

1. Update `STRATEGIC_INTENT.md` with conversation outcomes:

   - Primary Objective
   - Strategic Approach
   - Tactical Priorities
   - Key Decisions Made (document this conversation)
   - Nuanced Angles (any specific interpretations discussed)
   - Emphasis/De-emphasis (what to focus on, what to avoid)
2. Update `.session_context.md` with working notes from conversation

**Output**: `step_2_strategy_research/strategy_[###]_[name]/STRATEGIC_INTENT.md`

---

## Phase 2: PLANNING (5-10 minutes, or 15-25 with systematic analysis)

**Purpose:** Create a documented plan that explains what we're going to do, why, and how. Get user approval before executing.

### Step 2.1: Analyze the Situation

**Agent Decision Logic:**

```
IF opponent_filing_with_multiple_claims (3+) OR
   user_exploring_multiple_claims (5+) OR
   user_expressed_uncertainty OR
   complex_multi_claim_litigation:

   → OFFER systematic analysis (optional)

ELSE:
   → PROCEED with manual analysis (faster)
```

---

#### Option A: Manual Analysis (Default, 5 minutes)

**Agent Actions** (Internal analysis, not shown to user yet):

1. **Read case context**:

   - Case_Summary_and_Timeline.md
   - Opponent's filing (if applicable)
   - Evidence inventory
   - Prior strategies (if any)
2. **Identify what needs to be researched**:

   - Legal elements of claims (ours or opponent's)
   - Defenses or counterarguments
   - Controlling authority
   - Procedural requirements
3. **Identify what needs to be verified**:

   - Facts that need verification
   - Citations that need checking
   - Evidence that needs review
4. **Identify what needs to be created**:

   - Documents to draft (motion, complaint, discovery, etc.)
   - Evidence bundles to organize
   - Outlines to create

**Proceed to Step 2.2** (Create Strategy Plan Document)

---

#### Option B: Systematic Analysis (Optional, 10-15 minutes)

**When to Offer:**
- Opponent filing contains 3+ claims
- User exploring 5+ potential affirmative claims
- User expressed uncertainty about direction
- Complex multi-claim litigation
- User explicitly requests "full analysis" or "systematic analysis"

**Agent Prompt to User:**
```
"I notice [opponent has filed 4 claims / you're exploring multiple potential claims / this is a complex case].

Would you like me to run a systematic analysis? This will:

✅ Analyze legal elements for each claim
✅ Map evidence to each element
✅ Calculate objective weakness/viability scores
✅ Generate data-driven strategic recommendations

This takes about 10-15 minutes but gives you:
- Objective scores for each claim (0-20 scale)
- Identification of weakest opponent claims to attack
- Identification of strongest affirmative claims to pursue
- Data-driven strategic routing (defensive/offensive/blended)

Run systematic analysis? (yes/no)

If no, I'll proceed with manual analysis based on our conversation (faster)."
```

**If User Says Yes - Execute Strategy Algorithm:**

Follow `workflows/strategy_algorithm.md` with these phases:

**Phase I: Dual Discovery** (5-10 min)
- **Sub-Phase 1.1: Defensive Analysis** (if opponent filing exists)
  - Detect opponent claims
  - Research legal elements (use `.augment/protocols/LEGAL_RESEARCH.md`)
  - Build element-proof matrix
  - Calculate weakness scores (0-20 scale)

- **Sub-Phase 1.2: Offensive Analysis**
  - Extract facts and harms
  - Generate claim hypotheses
  - Research legal elements (use `.augment/protocols/LEGAL_RESEARCH.md`)
  - Calculate viability scores (0-15 scale)

**Phase II: Vulnerability Mining** (3-5 min)
- Analyze internal contradictions in opponent's filing
- Verify against public records (if Chrome MCP available)
- Tag estoppel/admissions

**Phase III: Strategic Router** (2-3 min)
- Execute strategic routing logic:
  ```
  IF no_opponent_filing → OFFENSIVE
  ELIF weakness_score >= 7.0 AND viability_score < 5.0 → DEFENSIVE
  ELIF viability_score >= 7.0 AND weakness_score < 5.0 → OFFENSIVE
  ELIF both >= 7.0 → BLENDED (maximum leverage)
  ELIF both < 5.0 → PROCEDURAL (discovery needed)
  ELSE → BALANCED
  ```
- Generate recommended moves

**Outputs:**
- `analysis_reports/opponent_claims.json`
- `analysis_reports/defensive_matrix.json`
- `analysis_reports/weakest_element.json`
- `analysis_reports/affirmative_claim_matrix.json`
- `analysis_reports/strategic_focus.json`
- `analysis_reports/recommended_action.json`
- `supporting_docs/[claim_name]_elements.md` (for each claim researched)

**Present Analysis Results to User:**
```
Agent: "Systematic analysis complete! Here are the findings:

DEFENSIVE ANALYSIS (Opponent's Claims):
📊 Claim 1: [Name] - Weakness Score: 8.5/20 (STRONG TARGET)
   - Weakest Element: [Element name]
   - Why: [Explanation]

📊 Claim 2: [Name] - Weakness Score: 4.2/20 (Weak target)
   - Analysis: [Brief summary]

📊 Claim 3: [Name] - Weakness Score: 6.8/20 (Moderate target)
   - Analysis: [Brief summary]

OFFENSIVE ANALYSIS (Our Potential Claims):
📊 Claim A: [Name] - Viability Score: 9.2/15 (HIGHLY VIABLE)
   - Strongest Element: [Element name]
   - Evidence: [What we have]

📊 Claim B: [Name] - Viability Score: 5.5/15 (Moderate viability)
   - Analysis: [Brief summary]

STRATEGIC RECOMMENDATION:
🎯 Focus: BLENDED (Attack + Counterclaim)
   - Primary Move: Motion to Dismiss Claim 1 (weakness score 8.5)
   - Secondary Move: File Counterclaim for Claim A (viability score 9.2)
   - Rationale: [Explanation]

VULNERABILITIES FOUND:
⚠️ [Contradiction 1 in opponent's filing]
⚠️ [Contradiction 2 in opponent's filing]

Full analysis saved to: strategy_[###]_[name]/analysis_reports/

Does this analysis change your strategic thinking, or do you want to proceed with the direction we discussed?"
```

**If User Says No:**

Proceed with manual analysis (Option A above).

---

**After Analysis (Either Option A or B):**

Proceed to Step 2.2 (Create Strategy Plan Document)

---

### Step 2.2: Create Strategy Plan Document

**Agent Actions**:
Create `STRATEGY_PLAN.md` in strategy folder with this structure:

```markdown
# Strategy Plan - [Strategy Name]

**Date:** [YYYY-MM-DD]
**Status:** PENDING APPROVAL

---

## Situation Summary

[2-3 paragraph summary of current situation]

**Key Facts:**
- [Fact 1]
- [Fact 2]
- [Fact 3]

**Opponent's Position:** [If applicable]

**Our Position:** [What we're arguing/seeking]

---

## Strategic Direction

**Primary Objective:** [From STRATEGIC_INTENT.md]

**Strategic Approach:** [From STRATEGIC_INTENT.md]

**Why This Approach:** [Rationale for chosen direction]

---

## What We Need to Research

### Research Task 1: [Topic]
**Why:** [Why this research is needed]
**Resource:** [CourtListener / GPT Researcher / Both]
**Estimated Time:** [X minutes]
**Output:** [What this will produce]

### Research Task 2: [Topic]
**Why:** [Why this research is needed]
**Resource:** [CourtListener / GPT Researcher / Both]
**Estimated Time:** [X minutes]
**Output:** [What this will produce]

[... additional research tasks ...]

**Total Research Time:** [X minutes]
**Delegation:** [Will spawn X sub-agents if 3+ tasks]

---

## What We Need to Verify

### Verification Task 1: [What needs verification]
**Why:** [Why this verification is needed]
**Method:** [Document verification / Citation verification / Fact checking]
**Estimated Time:** [X minutes]

[... additional verification tasks ...]

---

## What We Will Create

### Deliverable 1: [Document/Artifact]
**Type:** [Motion / Complaint / Discovery / Evidence Bundle / etc.]
**Purpose:** [Why we're creating this]
**Dependencies:** [What research/verification must complete first]
**Estimated Time:** [X minutes]

[... additional deliverables ...]

---

## Execution Timeline

1. **Research Phase** (Est. X min)
   - [Research task 1]
   - [Research task 2]
   - [...]

2. **Verification Phase** (Est. X min)
   - [Verification task 1]
   - [Verification task 2]
   - [...]

3. **Creation Phase** (Est. X min)
   - [Deliverable 1]
   - [Deliverable 2]
   - [...]

**Total Estimated Time:** [X minutes]

---

## Risks & Considerations

**Potential Issues:**
- [Risk 1 and mitigation]
- [Risk 2 and mitigation]

**Dependencies:**
- [What we need before we can proceed]

---

## Approval Required

This plan requires your approval before execution. Please review and confirm:
- [ ] Strategic direction is correct
- [ ] Research tasks are appropriate
- [ ] Deliverables match your needs
- [ ] Timeline is acceptable

**Ready to proceed?**
```

---

### Step 2.3: Present Plan to User

**Agent Actions**:

```
Agent: "I've created a detailed strategy plan. Let me walk you through it:

SITUATION:
[Brief summary of situation]

OUR DIRECTION:
[Primary objective and approach]

WHAT I'M GOING TO RESEARCH:
1. [Research task 1] - [Why] - [X min]
2. [Research task 2] - [Why] - [X min]
3. [Research task 3] - [Why] - [X min]
[If 3+ tasks: "I'll spawn sub-agents to research these in parallel"]

WHAT I'M GOING TO VERIFY:
1. [Verification task 1] - [Why]
2. [Verification task 2] - [Why]

WHAT I'M GOING TO CREATE:
1. [Deliverable 1] - [Purpose]
2. [Deliverable 2] - [Purpose]

TOTAL TIME: About [X] minutes

The complete plan is saved here: strategy_[###]_[name]/STRATEGY_PLAN.md

Does this plan make sense? Any changes before I execute?"
```

**Wait for User Approval**

---

### Step 2.4: Refine Plan (If Needed)

**If user requests changes**:

```
Agent: "Got it. Let me update the plan:

[Explain changes]

Updated plan saved. Ready to proceed now?"
```

**If user approves**:

```
Agent: "Perfect. I'm marking the plan as APPROVED and starting execution.

I'll update you as I complete each phase."
```

**Update STRATEGY_PLAN.md**: Change status to "APPROVED" and add approval timestamp

---

## Phase 2.5: CLAIM BUILDING (20-40 minutes)

**Purpose:** Build detailed IRAC-based element checklists for prioritized claims before outline creation.

**When to Execute:**
- After strategy plan approved (Phase 2 complete)
- Before evidence planning (Step 2.5) or outline creation (Step 2.75)
- When developing affirmative claims, defenses, or responses

**Trigger Logic:**
```
IF strategy_plan includes claims_to_develop:
  → Offer claim building

IF systematic_analysis_completed AND viable_claims_identified:
  → Automatically offer claim building for viable claims

IF user_requests "build claims" OR "develop [claim_name]":
  → Execute claim building
```

---

### Step 2.5.1: Identify Claims to Build

**Agent Actions:**

**If Systematic Analysis Was Run (Phase 2, Option B):**
- Load viability scores from `analysis_reports/affirmative_claim_matrix.json`
- Present prioritized list to user (already scored)
- Skip lightweight assessment (already done)

**If Manual Analysis Was Run (Phase 2, Option A):**
- Perform lightweight viability assessment (see CLAIM_BUILDER.md Phase 1)
- Present prioritization matrix to user

**Agent Prompt:**
```
"Based on our strategy, I've identified [N] potential claims to develop:

[Prioritization matrix showing viability scores, strategic fit, complexity]

RECOMMENDATION: Build [X] highly viable claims
Estimated time: [Y] minutes (parallel execution via sub-agents)

Which claims should I build?"
```

**Wait for user selection**

---

### Step 2.5.2: Execute Claim Building

**Agent Actions:**

**Delegate to CLAIM_BUILDER.md protocol:**

```
IF claims_to_build >= 3:
  → Execute Multi-Claim Workflow (parallel sub-agents)
ELSE:
  → Execute Single Claim Workflow (sequential)
```

**Follow:** `.augment/protocols/CLAIM_BUILDER.md`

**Monitor Progress:**
```
Agent: "Building [N] claims using CLAIM_BUILDER.md protocol...

[If parallel execution]
Spawning [N] sub-agents for parallel claim building...
⏳ Sub-agent 1: Building [Claim 1]
⏳ Sub-agent 2: Building [Claim 2]
⏳ Sub-agent 3: Building [Claim 3]

Estimated completion: [X] minutes

[Updates as claims complete]
✅ Sub-agent 1 complete: [Claim 1] built (viability: 8.5/10)
✅ Sub-agent 2 complete: [Claim 2] built (viability: 7.5/10)
✅ Sub-agent 3 complete: [Claim 3] built (viability: 6.0/10)
```

**Outputs:**
- Element checklists with IRAC passages: `supporting_docs/element_checklist_[claim_name].md`
- Viability assessments: `supporting_docs/claim_viability_assessment_[claim_name].md`
- Consolidated report: `supporting_docs/claim_development_report.md`

---

### Step 2.5.3: Present Claim Building Results

**Agent Actions:**

```
Agent: "Claim building complete! Here's what I created:

CLAIMS DEVELOPED:
✅ [Claim 1 name]
   - Element checklist: [path]
   - Viability: [score]/10 ([Highly Viable / Viable / Moderate])
   - Strongest element: [element name] ([score]/10)
   - Weakest element: [element name] ([score]/10)
   - Anticipated defense: [opponent's likely argument]
   - Our rebuttal: [how we counter]

✅ [Claim 2 name]
   - Element checklist: [path]
   - Viability: [score]/10
   - Strongest element: [element name] ([score]/10)
   - Weakest element: [element name] ([score]/10)
   - Anticipated defense: [opponent's likely argument]
   - Our rebuttal: [how we counter]

[... additional claims ...]

EFFICIENCY GAINS:
⚡ Parallel execution: [N] claims built in [X] minutes (vs. [Y] min sequential)
⚡ Research deduplication: Saved [Z] minutes by sharing common elements

SHARED LEGAL STANDARDS:
- [Standard 1] (applies to Claims 1, 2, 3)
- [Standard 2] (applies to Claims 2, 4)

EVIDENCE NEEDS IDENTIFIED:
- [Evidence item 1] (supports Claim 1, Element 2)
- [Evidence item 2] (supports Claims 2 and 3)

STRATEGIC RECOMMENDATION:
✅ Pursue [Claims X, Y] immediately (high viability)
⚠️ Include [Claim Z] as backup (moderate viability)
❌ Abandon [Claim W] (low viability)

All element checklists saved to: strategy_[###]_[name]/supporting_docs/

NEXT STEPS:
1. Organize evidence bundles (Step 2.5 - Evidence Planning)
2. Create enhanced outline (Step 2.75 - Draft Planning)

Ready to proceed to evidence planning?"
```

---

### Step 2.5.4: Update Strategy Documents

**Agent Actions:**

1. **Update STRATEGIC_INTENT.md:**
   - Add claims developed to "Tactical Priorities"
   - Document key decisions from adversarial testing
   - Note any strategic pivots based on viability assessments

2. **Update STRATEGY_PLAN.md:**
   - Mark claim building tasks as complete
   - Update timeline with actual completion times

3. **Update metadata.json:**
   - Link claim reference IDs
   - Track viability scores
   - Record adversarial testing results

---

## Phase 3: EXECUTION (15-45 minutes)

**Updated Purpose:** Execute remaining strategy tasks (evidence organization, verification, final deliverables)

**Note:** Claim building now happens in Phase 2.5, so Phase 3 focuses on:
- Evidence bundle creation (using evidence needs from claim building)
- Fact verification
- Citation verification
- Final strategy document compilation

### Step 3.1: Execute Research Tasks

**Follow:** `.augment/protocols/LEGAL_RESEARCH.md`

**Agent Actions**:

1. For each research task in plan:

   - Execute using appropriate resource (CourtListener, GPT Researcher, Both)
   - If 3+ independent tasks → Delegate to sub-agents (parallel execution)
   - Save outputs to `supporting_docs/`
2. Update user on progress:

   ```
   "Research Phase: 2/3 tasks complete
   - ✅ FDCPA elements researched
   - ✅ Defenses researched
   - ⏳ Controlling authority search in progress..."
   ```

**Outputs**: Research files in `supporting_docs/`

---

### Step 3.2: Execute Verification Tasks

**Follow:**

- `.augment/protocols/DOCUMENT_VERIFICATION.md` (for fact verification)
- `.augment/protocols/CITATION_VERIFICATION.md` (for citation verification)

**Agent Actions**:

1. For each verification task in plan:

   - Execute appropriate verification protocol
   - Save verification reports
   - Flag any issues for user review
2. Update user on progress:

   ```
   "Verification Phase: 1/2 tasks complete
   - ✅ Facts verified against source documents
   - ⏳ Citations being verified..."
   ```

**Outputs**: Verification reports in `verification_reports/`

---

### Step 3.3: Create Deliverables

**Agent Actions**:

1. For each deliverable in plan:

   - Create document/artifact
   - Integrate research findings
   - Apply strategic direction from STRATEGIC_INTENT.md
   - Save to appropriate location
2. Update user on progress:

   ```
   "Creation Phase: Creating motion to dismiss outline...
   - Integrated research on FDCPA elements
   - Incorporated controlling authority
   - Applied strategic emphasis on [key point]"
   ```

**Outputs**: Deliverables in appropriate folders (Step 2.75 for outlines, Step 3 for drafts, etc.)

---

### Step 3.4: Finalize Strategy

**Agent Actions**:

1. **Update STRATEGY.md** (comprehensive strategy document):

   - Executive Summary
   - Strategic Analysis
   - Legal Research Findings
   - Evidence Strategy
   - Implementation Roadmap
   - Risk Assessment
   - Success Metrics
2. **Update metadata.json**:

   - Link to downstream artifacts (evidence bundles, outlines, drafts)
   - Record scores and recommendations
   - Track relationships
3. **Update strategy_index.json**:

   - Add this strategy to master index
4. **Update settings.json**:

   - Set this as active strategy

---

### Step 3.5: Present Results to User

**Agent Actions**:

```
Agent: "Strategy execution complete! Here's what I created:

RESEARCH COMPLETED:
✅ [Research task 1] → [Output file]
✅ [Research task 2] → [Output file]
✅ [Research task 3] → [Output file]

VERIFICATION COMPLETED:
✅ [Verification task 1] → [Result]
✅ [Verification task 2] → [Result]

DELIVERABLES CREATED:
✅ [Deliverable 1] → [Location]
✅ [Deliverable 2] → [Location]

STRATEGY DOCUMENTS:
📋 Strategic Intent: strategy_[###]_[name]/STRATEGIC_INTENT.md
📋 Strategy Plan: strategy_[###]_[name]/STRATEGY_PLAN.md
📋 Full Strategy: strategy_[###]_[name]/STRATEGY.md

This strategy is now your active north star. All future drafts and work will reference this strategy to maintain context.

NEXT STEPS:
[Recommend next actions based on deliverables]

Questions or ready to proceed?"
```

---

## Integration with Other Protocols

### Legal Research

**When:** Phase 3.1 (Execute Research Tasks)**Protocol:** `.augment/protocols/LEGAL_RESEARCH.md`**Triggers:**

- Finding case law
- Analyzing claim elements
- Researching defenses
- Discovering controlling authority

### Document Verification

**When:** Phase 3.2 (Execute Verification Tasks)**Protocol:** `.augment/protocols/DOCUMENT_VERIFICATION.md`**Triggers:**

- Verifying facts in strategy documents
- Checking factual assertions before drafting

### Citation Verification

**When:** Phase 3.2 (Execute Verification Tasks) or after drafting**Protocol:** `.augment/protocols/CITATION_VERIFICATION.md`**Triggers:**

- Verifying citations in research outputs
- Checking citations before finalizing drafts

---

## Strategy as North Star

**Purpose:** Active strategy guides all downstream work

### How Strategy Guides Work

**When creating evidence bundles** (Step 2.5):

- Reference active strategy's evidence needs
- Organize evidence to support strategic priorities
- Link bundle to parent strategy in metadata

**When creating outlines** (Step 2.75):

- Reference active strategy's legal research
- Structure outline around strategic approach
- Emphasize points identified in STRATEGIC_INTENT.md
- Link outline to parent strategy in metadata

**When drafting documents** (Step 3):

- Reference active strategy's findings and citations
- Apply strategic direction and nuances
- Maintain emphasis/de-emphasis from STRATEGIC_INTENT.md
- Link draft to parent strategy in metadata

**Context Continuity:**
Even if drafting 5 different documents, agent always knows:

- Why we're doing this (Primary Objective)
- How we're approaching it (Strategic Approach)
- What to emphasize (Tactical Priorities)
- What nuances to apply (Nuanced Angles)
- What's next (Implementation Roadmap)

---

## Folder Structure

```
step_2_strategy_research/
└── strategy_[###]_[descriptive_name]/
    ├── STRATEGIC_INTENT.md          # High-level strategic direction (from conversation)
    ├── STRATEGY_PLAN.md             # Documented execution plan (Phase 2)
    ├── STRATEGY.md                  # Comprehensive strategy document (Phase 3)
    ├── .session_context.md          # Working notes from conversation
    ├── metadata.json                # Relationships and tracking
    ├── analysis_reports/            # Detailed analysis (if using algorithm)
    └── supporting_docs/             # Research outputs
        ├── [research_output_1].md
        ├── [research_output_2].md
        └── verification_reports/
```

---

## User Commands

**Start new strategy**:

```
"Let's strategize [issue]"
"Help me plan our response to [opponent's motion]"
"I need to develop a strategy for [situation]"
```

**Update existing strategy**:

```
"Update our strategy based on [new information]"
"Revise the strategic plan"
```

**Reference strategy during work**:

```
"What does our strategy say about [topic]?"
"Am I following the strategic direction?"
"Show me the strategic intent"
```

---

## Benefits of This Approach

1. **User-Friendly** - Starts with conversation, not technical workflow
2. **Transparent** - User sees the plan before execution
3. **Flexible** - Can adjust plan before committing resources
4. **Context Continuity** - Strategy maintains context across all work
5. **Efficient** - Plan identifies parallel research opportunities
6. **Quality** - Verification built into workflow
7. **Traceable** - Clear documentation of strategic decisions

---

## Related Documentation

- **Technical Workflow**: `workflows/step_2_strategy_workflow.md` (underlying algorithm)
- **Strategy Algorithm**: `workflows/strategy_algorithm.md` (detailed logic)
- **Legal Research**: `.augment/protocols/LEGAL_RESEARCH.md`
- **Document Verification**: `.augment/protocols/DOCUMENT_VERIFICATION.md`
- **Citation Verification**: `.augment/protocols/CITATION_VERIFICATION.md`
- **Strategic Intent Template**: `templates/STRATEGIC_INTENT_template.md`
