# Protocol: Draft Outline Generation

**Trigger**: User wants to create an outline for a legal document (motion, complaint, response, brief)

**Purpose**: Generate a structured blueprint that organizes arguments, facts, and research gaps before drafting

---

## Overview: Two Entry Points

```
PATH A: From Scratch              PATH B: From Strategy
─────────────────────             ────────────────────
[User Intent + Claims]      OR    [strategy_relay.py output]
        ↓                                 ↓
[Phase 1: Gather Facts]           [Load existing analysis]
        ↓                                 ↓
        └──────────┬──────────────────────┘
                   ↓
           [Phase 2: Structure Outline]
                   ↓
           [Phase 3: Identify Gaps]
                   ↓
           [Output: draft-outline.md]
```

**Key Principle**: Strategy analysis is NOT required—but when available, it dramatically improves the outline by providing pre-validated element mappings and viability scores.

---

## Path A: From Scratch (No Prior Strategy)

### When to Use
- Quick documents where full strategy analysis is overkill
- User has already done research manually and just needs structure
- Initial brainstorming before committing to formal strategy

### Required Inputs
Before starting, gather:
- [ ] **Document Type**: What are we creating? (Motion to Dismiss, Complaint, Response, Brief)
- [ ] **Core Claims/Arguments**: What legal theories are we pursuing?
- [ ] **Key Facts**: What factual basis supports our position?
- [ ] **Jurisdiction**: What court/jurisdiction governs?

### Step A1: Query Case Documents

Use File Search to extract relevant facts:

```
Tool: file_search_query_legal-hub
Parameters:
  store_name: [From case-context/settings.json → case.file_search_store_id]
  query: "What are the key facts relevant to [claim/argument]?"
```

**Suggested queries for common document types:**

| Document Type | Useful Queries |
|---------------|----------------|
| Complaint | "What damages or harm occurred?", "What actions did defendant take?", "Timeline of key events" |
| Motion to Dismiss | "What procedural defects exist?", "What jurisdictional issues?", "What claims are alleged?" |
| Response | "What arguments does the opposing motion make?", "What facts counter their position?" |
| Brief | "What legal standards apply?", "What facts support our interpretation?" |

### Step A2: Build Claim Structure

For each claim/argument:
1. **State the legal theory** in one sentence
2. **List required elements** (research if needed)
3. **Map facts to elements** from File Search results
4. **Note gaps** where evidence is weak or missing

---

## Path B: From Strategy (Post-strategy_relay.py)

### When to Use
- Strategy analysis has already been completed
- `strategies/[name]/` folder exists with analysis files

### Load Existing Artifacts

```
Required files:
├── strategies/[name]/INTENT.md           # The objective
├── strategies/[name]/CLAIMS.json         # Confirmed claims
├── strategies/[name]/GAP_ANALYSIS.md     # Summary of gaps
└── strategies/[name]/claims/
    └── [claim_id]_[claim_name]/
        ├── elements.json                 # Elements + fact mappings
        └── analysis.md                   # Viability + adversarial check
```

### What You Already Have
- ✅ Elements extracted with legal standards
- ✅ Facts mapped to elements with source citations
- ✅ Viability scores (HIGH/MEDIUM/LOW)
- ✅ Adversarial analysis (opponent's likely attacks)
- ✅ Gap identification

**Skip directly to Phase 2: Structure Outline**

---

## Phase 2: Structure the Outline

### Standard Legal Brief Structure

```markdown
# [Document Title]

## I. Introduction
[1-2 paragraphs framing the document's purpose and key theme]

## II. Statement of Facts
[Chronological or thematic presentation of relevant facts]

## III. Legal Argument
### A. [First Claim/Argument]
#### 1. Legal Standard
#### 2. Application to Facts
#### 3. Conclusion
### B. [Second Claim/Argument]
[Same structure]

## IV. Conclusion
[Summary of relief requested]
```

### Outline Content Per Section

**For each argument section, include:**

```markdown
### A. [Argument Name]

**Legal Theory**: [One sentence]

**Elements Required**:
1. [Element 1] - Status: ✅/⚠️/❌
2. [Element 2] - Status: ✅/⚠️/❌

**Key Facts**:
- [Fact] → Source: [Document/File Search]
- [Fact] → Source: [Document/File Search]

**Supporting Authority**: [CITATION NEEDED] or [Case Name, Citation]

**Anticipated Counter-Argument**:
> [What opponent will say]
**Our Response**: [How we address it]
```

---

## Phase 3: Legal Research & Citations

### Automated Research Using MCP Tools

**You have access to legal research tools** - use them to find real case law and statutes during outline generation.

**Available MCP Tools**:
- `search_cases_legal-hub` - Search CourtListener for case law
- `lookup_citation_legal-hub` - Validate and retrieve specific citations
- `web_search_legal-hub` - Find statutes, regulations, legal standards
- `deep_research_legal-hub` - Comprehensive research for complex issues

### Research Strategy

**If coming from Strategy (Path B)**:
1. ✅ **Inherit citations** from `elements.json` and `analysis.md`
2. ✅ **Use existing research** - strategy already found controlling authority
3. 🔍 **Fill gaps only** - research additional citations if needed for:
   - Supporting cases with similar facts
   - Persuasive authority from other jurisdictions
   - Cases distinguishing adverse authority

**If from scratch (Path A)**:
1. 🔍 **Research each claim/argument**:
   - Use `search_cases_legal-hub` to find controlling authority
   - Use `web_search_legal-hub` to find statutes and legal standards
   - Use `lookup_citation_legal-hub` to verify citations
2. 📝 **Document findings** in outline with proper citations
3. ⚠️ **Mark gaps** with `[CITATION NEEDED]` only if research tools don't return results

### When to Use Placeholders vs. Research

| Situation | Action |
|-----------|--------|
| **Basic legal standard** | Research now using MCP tools |
| **Controlling statute** | Research now using web_search |
| **Leading case for claim type** | Research now using search_cases |
| **Specific fact pattern match** | Research now if time permits, or mark `[CITATION NEEDED]` |
| **Distinguishing adverse authority** | Mark `[CITATION NEEDED]` - requires deeper analysis |
| **Persuasive secondary authority** | Mark `[CITATION NEEDED]` - not critical for outline |

### Citation Format in Outline

**For researched citations**:
```markdown
**Legal Standard**: [Case Name, Citation] - [brief holding]
Example: Smith v. Jones, 123 Ga. App. 456, 458 (2020) - Establishes four elements for breach of contract
```

**For gaps requiring additional research**:
```markdown
[CITATION NEEDED: case with similar fact pattern involving workplace harassment]
```

### Research Quality Check

Before moving forward, verify:
- [ ] All major legal standards have citations
- [ ] All statutes are properly cited
- [ ] Citations are real (verified via lookup_citation tool)
- [ ] Any `[CITATION NEEDED]` items are truly gaps, not findable via MCP tools

---

## Phase 4: Gap Analysis & Research Needs

### Identify What's Missing

For each claim, assess:

| Category | Complete? | Action |
|----------|-----------|--------|
| **Facts** | ✅/❌ | If missing: Query File Search or request from client |
| **Evidence** | ✅/❌ | If missing: Note in "Evidence Gaps" section |
| **Legal Authority** | ✅/❌ | If missing: Mark [CITATION NEEDED] |
| **Counter-Arguments** | ✅/❌ | If missing: Brainstorm opponent's perspective |

### Create Gap Summary

At the end of the outline, add:

```markdown
## Research & Evidence Gaps

### Legal Research Needed
1. [ ] [Citation topic] - for [which section]
2. [ ] [Citation topic] - for [which section]

### Evidence Gaps
1. [ ] [What evidence] - needed to prove [which element]
2. [ ] [What evidence] - needed to prove [which element]

### Client Questions
1. [ ] [Question] - needed to clarify [what]
```

---

## Output Location

Save the outline to:

```
workspaces/[workspace_name]/draft-outline.md
```

Or if organizing by draft:

```
workspaces/[workspace_name]/drafts/[NNN]_[draft_name]/outline.md
```

---

## Part 5: Integration with Other Workflows

### Feeding into Drafting (DRAFTING.md)

When outline is approved:
1. Agent loads outline as drafting blueprint
2. Each section becomes content to write
3. Facts and citations are pre-mapped
4. Gaps are flagged for user attention

### Feeding into Research (RESEARCH.md)

When [CITATION NEEDED] items exist:
1. Extract research questions from placeholders
2. Run targeted legal research
3. Update outline with found authorities
4. Re-present outline for approval

### If No Strategy Exists But Is Needed

For complex documents, suggest running strategy first:

```
"This motion involves multiple claims with complex element analysis.
Would you like me to run a full strategy analysis first?

This would:
- Extract legal elements for each claim
- Map facts from case documents
- Assess viability and risks
- Identify evidence gaps

Run strategy analysis? [Yes/No]"
```

---

## Example: Outline from Strategy Output

Given `strategies/fdcpa_complaint/` with:
- INTENT.md: File FDCPA complaint against debt collector
- CLAIMS.json: 3 counts (§1692c, §1692d, §1692g violations)
- claims/001_communication_violation/elements.json (5 elements mapped)

**Generated Outline:**

```markdown
# COMPLAINT: Bruce v. Consumer Portfolio Services

## I. Introduction
[Frame as debt collector harassment case under FDCPA]

## II. Parties
- Plaintiff: Ian Bruce, consumer
- Defendant: CPS, debt collector under 15 U.S.C. § 1692a(6)

## III. Factual Background
[Chronology from case documents - use File Search to gather timeline]

## IV. Causes of Action

### Count I: Communication Violation (15 U.S.C. § 1692c)

**Legal Standard**: 15 U.S.C. § 1692c(c) - "If a consumer notifies a debt collector in writing that the consumer refuses to pay a debt or that the consumer wishes the debt collector to cease further communication with the consumer, the debt collector shall not communicate further with the consumer..."

**Elements** (from elements.json):
1. ✅ Defendant is debt collector - Status: PROVEN
2. ✅ Plaintiff is consumer - Status: PROVEN
3. ⚠️ Cease communication notice sent - Status: PARTIAL
4. ✅ Continued contact after notice - Status: PROVEN
5. ⚠️ Contact not within exceptions - Status: PARTIAL

**Key Facts**: [From File Search + fact mappings]

**Controlling Authority**:
- Jerman v. Carlisle, McNellie, Rini, Kramer & Ulrich LPA, 559 U.S. 573 (2010) - Defines "debt collector" under FDCPA
- Foti v. NCO Financial Systems, Inc., 424 F. Supp. 2d 643 (S.D.N.Y. 2006) - Workplace calls after cease notice violate § 1692c

**Anticipated Defense**: "Communications were within exceptions under § 1692c(c)"
**Response**: [From adversarial analysis - no exception applies to workplace calls]

### Count II: Harassment (15 U.S.C. § 1692d)

**Legal Standard**: 15 U.S.C. § 1692d - Prohibits harassment or abuse in connection with debt collection

**Authority**:
- Bingham v. Collection Bureau, Inc., 505 F. Supp. 864 (D.N.D. 1981) - Repeated calls to workplace constitute harassment
- [CITATION NEEDED: Recent circuit court case on frequency standard]

### Count III: Validation (15 U.S.C. § 1692g)

**Legal Standard**: 15 U.S.C. § 1692g(b) - Debt collector must cease collection until verification provided

**Authority**:
- Chaudhry v. Gallerizzo, 174 F.3d 394 (4th Cir. 1999) - Defines adequate debt verification
- [CITATION NEEDED: Case on "non-authoritative copy" insufficiency]

## V. Prayer for Relief
- Statutory damages under § 1692k(a)(2)(A) ($1,000 per violation)
- Actual damages under § 1692k(a)(1)
- Attorney's fees and costs under § 1692k(a)(3)

## Research Gaps
- [ ] Recent circuit authority on call frequency standard (Count II)
- [ ] Case law on inadequate validation notices (Count III)
```

---

## Important Rules

### NEVER:
- Invent facts not in case documents
- Make up case citations - **USE MCP TOOLS TO FIND REAL CITATIONS**
- Skip legal research when MCP tools are available
- Proceed to drafting with major legal standards uncited

### ALWAYS:
- Use File Search for document queries when available
- Use MCP legal research tools (search_cases, web_search, lookup_citation) to find real case law
- Load strategy analysis if it exists (inherit citations from elements.json)
- Verify citations using lookup_citation_legal-hub before including them
- Mark unclear elements with status indicators
- Separate what we HAVE from what we NEED
- Save outline as file (not just in memory)

### WHEN IN DOUBT:
- Try MCP research tools first before marking [CITATION NEEDED]
- Ask user to clarify intent
- Suggest running strategy analysis first for complex documents
- Flag ambiguity explicitly in outline

---

## Related Protocols

- **STRATEGY.md** - Full strategy analysis (run before outline for complex cases)
- **DRAFTING.md** - Converting outline to final document
- **RESEARCH.md** - Finding citations for [CITATION NEEDED] items

