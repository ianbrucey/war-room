# Protocol: Strategy Development

**Trigger**: User wants to build a legal strategy (complaint, motion, response, discovery)

**Purpose**: Transform intent into actionable legal positions with evidence mapping

---

## Overview: The Strategy Pipeline

```
PHASE 1          PHASE 2           PHASE 3            PHASE 4           PHASE 5
[Intent]    →    [Claims]     →    [Analysis]    →    [Validation]  →   [Output]
Interactive      Interactive       Automated          Checkpoint        Automated
```

**Key Principle**: Phases 1-2 are conversational. Phase 3 is batch automation. Phase 4 is human validation. Phase 5 generates the deliverable.

**Research Integration**: Phase 3 includes automated legal research using MCP tools to find case law, statutes, and legal standards. All citations are verified and real.

---

## Legal Research Tools Available

During strategy development, you have access to these MCP tools:

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `search_cases_legal-hub` | Search CourtListener for case law | Finding controlling authority for claims |
| `lookup_citation_legal-hub` | Validate and retrieve citations | Verifying specific case citations |
| `web_search_legal-hub` | Search for legal standards | Finding statutes, regulations, legal tests |
| `deep_research_legal-hub` | Comprehensive research | Complex or novel legal issues |
| `file_search_query_legal-hub` | Query case documents | Extracting facts from uploaded documents |

**When to use these tools**:
- **Phase 3A (Element Extraction)**: Use search_cases and web_search to find legal elements and standards
- **Phase 3B (Fact Matching)**: Use file_search_query to extract facts from case documents
- **Throughout**: Use lookup_citation to verify any citations before including them

---

## Phase 1: Establish Intent (Interactive)

### What Happens
You have a conversation with the user to understand:
- **The Goal**: What are we trying to accomplish?
- **The Context**: What triggered this? (Motion filed, deadline, new evidence?)
- **The Constraints**: Timeline, jurisdiction, existing filings?

### Your Job
Ask clarifying questions until you can articulate the intent clearly.

### When Complete
Create `strategies/[strategy_name]/INTENT.md`:

```markdown
# Strategy Intent: [Name]

**Created**: [Date]
**Objective**: [One sentence: What we're trying to achieve]

## Context
[What triggered this work? What's the situation?]

## Constraints
- **Jurisdiction**: [State/Federal, Court]
- **Deadline**: [If applicable]
- **Related Filings**: [Any existing documents to reference]

## Success Criteria
[How do we know this strategy worked?]
```

### Announce to User
```
✅ Intent established: strategies/[name]/INTENT.md

Now let's identify the legal claims or arguments that support this objective.
```

---

## Phase 2: Identify Claims (Interactive)

### What Happens
Based on the intent, work with the user to identify:
- **For Complaints/Motions**: What causes of action or legal arguments?
- **For Responses**: What counter-arguments or defenses?
- **For Discovery**: What claims need evidence? (May reference existing claims)

### Your Job
1. Propose potential claims based on the facts
2. Explain the legal theory behind each
3. Let user confirm, add, or remove claims
4. Iterate until user says "these are the claims"

### When Complete
Create `strategies/[strategy_name]/CLAIMS.json`:

```json
{
  "strategy_id": "[strategy_name]",
  "claim_type": "causes_of_action | defenses | counter_arguments",
  "jurisdiction": "[State/Federal]",
  "claims": [
    {
      "id": "001",
      "name": "Breach of Contract",
      "legal_theory": "Defendant failed to perform under the agreement",
      "status": "confirmed",
      "priority": "primary"
    },
    {
      "id": "002", 
      "name": "Fraudulent Inducement",
      "legal_theory": "Defendant made false representations to induce signing",
      "status": "confirmed",
      "priority": "secondary"
    }
  ],
  "confirmed_at": "[timestamp]",
  "confirmed_by": "user"
}
```

### Announce to User
```
✅ Claims confirmed: [X] claims identified

1. Breach of Contract (Primary)
2. Fraudulent Inducement (Secondary)

I'll now analyze each claim - extracting legal elements, mapping facts, 
and assessing viability. This may take a moment.

[Proceeding to automated analysis...]
```

---

## Phase 3: Automated Analysis (Batch)

### What Happens

**You call the strategy relay script** and wait for it to complete:

```bash
python scripts/strategy_relay.py \
  --workspace ./workspaces/[workspace_name] \
  --strategy [strategy_name] \
  --agent auggie
```

The script handles the entire relay race:
- **Phase A (Researcher)**: Extract legal elements for each claim
- **Phase B (Investigator)**: Match facts from case files to elements
- **Phase C (Analyst)**: Score viability and run adversarial check
- **Phase D (Reporter)**: Generate gap analysis

### What the Script Produces

For EACH confirmed claim, the script creates:

#### Step 3A: Element Extraction + Legal Research

**AUTOMATED RESEARCH**: The script uses MCP legal research tools to find authoritative case law and statutes.

**MCP Tools Used**:
- `search_cases_legal-hub` - Search CourtListener for relevant case law
- `lookup_citation_legal-hub` - Validate and retrieve specific citations
- `web_search_legal-hub` - Find statutes, regulations, legal standards
- `deep_research_legal-hub` - Comprehensive research for complex claims

**Process**:
1. Search for controlling authority for the claim type
2. Extract legal elements from authoritative sources
3. Document legal standard for each element with citations
4. Verify all citations are real and accurate

**Create**: `strategies/[name]/claims/[claim_id]_[claim_name]/elements.json`

```json
{
  "claim_id": "001",
  "claim_name": "Breach of Contract",
  "jurisdiction": "Georgia",
  "source": "O.C.G.A. § 13-3-1 et seq.",
  "controlling_authority": [
    {
      "citation": "Smith v. Jones, 123 Ga. App. 456 (2020)",
      "relevance": "Establishes elements for breach of contract in Georgia"
    }
  ],
  "elements": [
    {
      "id": "E1",
      "name": "Valid Contract",
      "description": "A valid and enforceable contract existed",
      "legal_standard": "Offer, acceptance, consideration, capacity",
      "authority": "Smith v. Jones, 123 Ga. App. 456, 458 (2020)",
      "facts_mapped": [],
      "status": "unproven"
    },
    {
      "id": "E2",
      "name": "Performance by Plaintiff",
      "description": "Plaintiff performed or was excused from performance",
      "legal_standard": "Substantial performance or valid excuse",
      "authority": "O.C.G.A. § 13-3-4",
      "facts_mapped": [],
      "status": "unproven"
    }
  ]
}
```

**Note**: All citations must be real and verified. The agent will use MCP tools to ensure accuracy.

#### Step 3B: Fact Matching
**Tool**: Review case context files, evidence, intake documents

For each element, search for supporting facts and map them:

```json
{
  "id": "E1",
  "name": "Valid Contract",
  "facts_mapped": [
    {
      "fact": "Parties signed Service Agreement dated Jan 15, 2024",
      "source": "evidence/contracts/service_agreement.pdf",
      "strength": "strong",
      "notes": "Clear offer, acceptance, and consideration ($5,000/month)"
    }
  ],
  "status": "proven"
}
```

#### Step 3C: Viability Scoring
Calculate based on element coverage:

| Coverage | Score | Meaning |
|----------|-------|---------|
| All elements proven | HIGH | Strong claim, proceed confidently |
| Most elements proven | MEDIUM | Viable but has gaps |
| Few elements proven | LOW | Risky, needs more evidence or reconsider |
| Critical element missing | FATAL | Cannot proceed without this |

#### Step 3D: Adversarial Check
Role-play opposing counsel: "How would you defeat this claim?"

Document the strongest counter-arguments.

**Create**: `strategies/[name]/claims/[claim_id]_[claim_name]/analysis.md`

```markdown
# Analysis: [Claim Name]

## Viability Score: [HIGH/MEDIUM/LOW]

## Element Summary
| Element | Status | Evidence Strength |
|---------|--------|-------------------|
| Valid Contract | ✅ Proven | Strong |
| Performance | ✅ Proven | Medium |
| Breach | ⚠️ Weak | Needs corroboration |
| Damages | ✅ Proven | Strong |

## Supporting Research
[Key cases and statutes found]

## Adversarial Risk
**Likely Counter-Arguments:**
1. [Argument 1]
2. [Argument 2]

**Mitigation Strategy:**
[How we address these]

## Gaps Identified
- [Element X] needs additional evidence
- [Fact Y] should be corroborated
```

### When Complete
Create `strategies/[name]/GAP_ANALYSIS.md` (summary across all claims)

---

## Phase 4: Validation Checkpoint

[ITERATION POINT: This is where we need to test what works best]

### Present Results to User
```
✅ Analysis complete for [X] claims

## Summary

| Claim | Viability | Key Risk |
|-------|-----------|----------|
| Breach of Contract | HIGH | Damages calculation disputed |
| Fraudulent Inducement | MEDIUM | Scienter element weak |

## Critical Gaps
- Fraudulent Inducement: Need evidence defendant KNEW statement was false
- [Other gaps...]

## Files Created
- strategies/[name]/claims/001_breach_of_contract/elements.json
- strategies/[name]/claims/001_breach_of_contract/analysis.md
- [etc...]

---

Would you like me to:
1. Explain any claim analysis in detail
2. Re-analyze a specific claim with different parameters
3. Proceed to [outline/discovery] based on this strategy
4. Adjust the claims and re-run analysis
```

### User Actions
- Review the analysis files
- Ask questions about specific claims
- Request re-analysis if something looks wrong
- Confirm to proceed

---

## Phase 5: Output (Based on Intent)

### If Intent = Complaint/Motion/Response
→ Proceed to Outline (see DRAFTING.md protocol)

The strategy feeds into the outline structure:
- Each claim becomes a section
- Elements become sub-arguments  
- Mapped facts become citations

### If Intent = Discovery
→ Branch to Discovery Generation

For each UNPROVEN element:
1. **Target Profile**: What should this evidence look like?
2. **Request Engineering**: Draft specific RFP/Interrogatory
3. **Output**: Discovery packet

[See Part 7 for Discovery workflow]

---

## Part 6: File Structure Reference

```
strategies/
└── [strategy_name]/
    ├── INTENT.md                    # Phase 1 output
    ├── CLAIMS.json                  # Phase 2 output
    ├── GAP_ANALYSIS.md              # Phase 3 summary
    ├── _metadata.json               # Tracking
    └── claims/
        ├── 001_breach_of_contract/
        │   ├── elements.json        # Phase 3A output
        │   └── analysis.md          # Phase 3B-D output
        └── 002_fraudulent_inducement/
            ├── elements.json
            └── analysis.md
```

---

## Part 7: Discovery Branch

When the strategy objective is discovery:

### Step 1: Load or Build Claims
If claims don't exist → Run Phases 1-3 first
If claims exist → Load them

### Step 2: Gap Analysis
Identify all UNPROVEN elements across claims

### Step 3: Target Profiling
For each unproven element, define:
```markdown
## Target Profile: [Element Name]

**Claim**: [Which claim this proves]
**What we need**: [Description of the evidence]
**Likely format**: Email | Document | Record | Testimony
**Likely custodian**: [Who would have this?]
**Date range**: [When would it exist?]
**Keywords**: [Search terms]
**The "perfect" document**: [Describe exactly what it would say]
```

### Step 4: Request Engineering
Draft targeted requests:
- **RFPs**: For documents
- **Interrogatories**: For information they must state
- **RFAs**: For facts they must admit/deny

Each request links back to:
- The Element it proves
- The Target Profile it seeks

### Step 5: Output
Create `strategies/[name]/DISCOVERY_PACKET.md`

---

## Part 8: Important Rules

### NEVER:
- Skip Phase 2 (claim confirmation) - user must approve claims
- Invent facts that aren't in the case files
- Hallucinate case citations (use research tools)
- Proceed to drafting without user confirmation at Phase 4

### ALWAYS:
- Create files as you go (not held in memory)
- Use actual research tools for element extraction
- Show your work (cite sources in analysis.md)
- Present clear checkpoint summaries
- Update WORKSPACE.json with strategy references

### WHEN IN DOUBT:
- Ask the user
- Save what you have so far
- Explain what you need to proceed

