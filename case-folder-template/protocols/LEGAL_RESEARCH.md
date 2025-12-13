# Protocol: Legal Research & Case Law Discovery

**Status:** Ready for use (Auggie sub-agent handles entire workflow)
**Owner:** Research Layer
**Last Updated:** October 28, 2025

---

## Purpose

Find and analyze case law, legal authorities, and claim elements to support litigation strategy using CourtListener API and GPT Researcher.

**Key Capabilities**:

1. Find elements of legal claims
2. Discover controlling authority (jurisdiction-specific)
3. Find cases supporting or opposing arguments
4. Research defenses and counterarguments
5. Analyze recent legal developments

---

## When to Use This Protocol

**Trigger Conditions**:

1. **User explicitly requests legal research**:

   - "Find cases on [legal issue]"
   - "What are the elements of [claim]?"
   - "Research [legal topic]"
   - "Find controlling authority for [proposition]"
2. **During Step 2 (Strategy Development)**:

   - Analyzing claim elements
   - Identifying legal authorities
   - Researching defenses
   - Finding supporting case law
3. **During Step 2.75 (Draft Planning)**:

   - Finding citations for draft outline
   - Verifying legal standards
   - Identifying controlling precedent
4. **When drafting requires authority** (Step 3):

   - Need citation for legal proposition
   - Need to verify claim elements
   - Need to find recent cases

---

## Delegation Decision: When to Spawn Sub-Agents

**CRITICAL**: Before executing research, determine if sub-agent delegation is appropriate.

### STEP 0: Evaluate Delegation Need

**Question**: Should this research be delegated to sub-agents for parallel execution?

**Delegate to Sub-Agents (Parallel Execution) IF**:

1. **Multiple Independent Research Tasks** (3+ tasks):

   - Researching elements of multiple claims (e.g., FDCPA + breach of contract + fraud)
   - Finding case law on multiple distinct legal issues
   - Researching multiple defenses simultaneously
   - Analyzing multiple jurisdictions in parallel
2. **High Volume Research** (5+ research queries):

   - Comprehensive strategy development with many legal issues
   - Multi-claim litigation requiring extensive research
   - Complex cases with numerous legal questions
3. **Time-Sensitive Research** (User needs results quickly):

   - Urgent motion deadline approaching
   - Need comprehensive research in limited time
   - Parallel execution would save significant time
4. **Complex Multi-Dimensional Analysis**:

   - Offensive claims + defensive claims + affirmative defenses
   - Multiple parties with different legal issues
   - Comparative analysis across multiple jurisdictions

**Execute Directly (No Delegation) IF**:

1. **Single Research Task** (1-2 tasks):

   - One claim element analysis
   - One case law search
   - Simple, focused research
2. **Sequential Dependencies**:

   - Research B depends on results of Research A
   - Need to analyze results before proceeding
   - Iterative research process
3. **Quick Research** (< 5 minutes total):

   - Simple CourtListener search
   - Single GPT Researcher query
   - Not worth delegation overhead

### Delegation Threshold Matrix

| Research Tasks | Complexity | Time Pressure | Delegation Decision              |
| -------------- | ---------- | ------------- | -------------------------------- |
| 1-2 tasks      | Simple     | No            | Execute directly                 |
| 1-2 tasks      | Complex    | Yes           | Execute directly (faster)        |
| 3-4 tasks      | Simple     | No            | Consider delegation              |
| 3-4 tasks      | Complex    | Yes           | **Delegate to sub-agents** |
| 5+ tasks       | Any        | Any           | **Delegate to sub-agents** |
| Multi-claim    | High       | Yes           | **Delegate to sub-agents** |

### Delegation Methods

**Method 1: Auggie Sub-Agent Spawning** (Recommended for CourtListener + Verification)

- Spawn Auggie instances via `auggie -p` command with detailed instructions
- Each sub-agent has access to CourtListener API, web search, file operations
- Sub-agents write to separate output files
- Primary agent collects and synthesizes results
- **See detailed invocation guide**: `confluence/docs/SUB_AGENT_INVOCATION_GUIDE.md`

**Method 2: Gemini Sub-Agent Spawning** (Recommended for Legal Analysis + Research)

- Spawn Gemini instances via `gemini -p` command with detailed instructions
- **ALWAYS use `-m gemini-2.5-flash -y` flags**
- Each sub-agent has access to web search, reasoning, file operations
- Sub-agents write to separate output files
- Primary agent collects and synthesizes results
- **See detailed invocation guide**: `confluence/docs/SUB_AGENT_INVOCATION_GUIDE.md`

**Method 3: GPT Researcher Direct Execution** (For Deep Research)

- Use `python3 scripts/research_strategy.py` directly
- **Always use `--mode "single_agent"`** (multi-agent mode is faulty)
- Good for comprehensive legal research with citations
- Outputs saved to `supporting_docs/` folder

**Method 4: Agent Swarm (For Very Complex Research)**

- Use agent swarm integration for 10+ research tasks
- Distributed execution across multiple agents
- Automatic result aggregation
- See: `scripts/agent_swarm_integration.py`

---

## Delegation Workflow: Spawning Sub-Agents

**When**: 2+ independent research tasks identified (execute in waves of 2: 1 Auggie + 1 Gemini)

**IMPORTANT**: For detailed sub-agent invocation instructions with complete tool documentation, see:
- **Sub-Agent Invocation Guide**: `confluence/docs/SUB_AGENT_INVOCATION_GUIDE.md`
- **Citation Verification Protocol** (template): `.augment/protocols/CITATION_VERIFICATION.md` (lines 68-363)

This section provides a high-level workflow. For exact curl commands, API endpoints, rate limiting, and error handling, refer to the guides above.

---

### STEP 1: Identify Independent Research Tasks

Break down user request into discrete, independent research tasks.

**Example User Request**:

```
"Research our FDCPA claim, breach of contract claim, and potential defenses
Happy Money might raise. Also find controlling authority in the 11th Circuit
for each issue."
```

**Breakdown into Tasks**:

1. FDCPA claim elements + 11th Circuit case law
2. Breach of contract elements + Georgia case law
3. Defenses to FDCPA claims + case law
4. Defenses to breach of contract + case law

**Total**: 4 independent tasks → **Delegate to sub-agents**

### STEP 2: Create Sub-Agent Task Specifications

For each task, create a specific research specification:

**Task Spec Template**:

```json
{
  "task_id": "research_task_001",
  "task_name": "FDCPA Elements and Case Law",
  "resource": "gpt_researcher",
  "mode": "single_agent",
  "query": "[Specific research query]",
  "output_file": "fdcpa_elements_research.md",
  "estimated_time": "2 minutes"
}
```

### STEP 3: Execute Research Tasks in Parallel

**IMPORTANT: Use Python Script Directly (Not Sub-Agents)**

For parallel execution, run `python3 scripts/research_strategy.py` directly in background. Do NOT use auggie or gemini CLI tools for parallel execution (they fail in background mode).

**Parallel Execution Template**:

```bash
# Launch multiple research tasks in parallel (run in background with &)
python3 scripts/research_strategy.py \
    --case-id "[CASE_ID]" \
    --strategy-id "[STRATEGY_ID]" \
    --query "[RESEARCH_QUERY_1]" \
    --mode "single_agent" \
    --output-name "[OUTPUT_FILE_1]" > /tmp/research_task_001.log 2>&1 &

python3 scripts/research_strategy.py \
    --case-id "[CASE_ID]" \
    --strategy-id "[STRATEGY_ID]" \
    --query "[RESEARCH_QUERY_2]" \
    --mode "single_agent" \
    --output-name "[OUTPUT_FILE_2]" > /tmp/research_task_002.log 2>&1 &

python3 scripts/research_strategy.py \
    --case-id "[CASE_ID]" \
    --strategy-id "[STRATEGY_ID]" \
    --query "[RESEARCH_QUERY_3]" \
    --mode "single_agent" \
    --output-name "[OUTPUT_FILE_3]" > /tmp/research_task_003.log 2>&1 &

# Note: All tasks will run in parallel via Celery job queue
# Monitor progress using list-processes tool
```

**IMPORTANT NOTES**:

- **Always use `--mode "single_agent"`** (multi-agent mode is currently faulty and needs fixes)
- **CourtListener research should be run sequentially** (not in parallel) due to API rate limits
- **GPT Researcher tasks can run in parallel** (handled by Celery job queue)
- Each task will appear as a Celery job and process independently
- Logs are redirected to `/tmp/research_task_*.log` files

### STEP 4: Monitor Sub-Agent Progress

**Check for completion**:

```bash
# Check if output files exist
ls -la [CASE_FOLDER]/step_2_strategy_research/[STRATEGY_ID]/supporting_docs/

# Expected files:
# - fdcpa_elements_research.md
# - breach_contract_elements_research.md
# - fdcpa_defenses_research.md
# - contract_defenses_research.md
```

### STEP 5: Collect and Synthesize Results

Once all sub-agents complete:

1. **Read all output files**
2. **Verify completeness** (all tasks completed)
3. **Synthesize findings** into comprehensive research summary
4. **Create master research document** combining all results
5. **Report to user** with paths to all outputs

**Master Research Document Template**:

```markdown
# Comprehensive Research Summary

**Date**: [DATE]
**Case**: [CASE_NAME]
**Research Tasks**: 4 parallel tasks completed

## Task 1: FDCPA Elements and Case Law
[Summary from fdcpa_elements_research.md]

## Task 2: Breach of Contract Elements
[Summary from breach_contract_elements_research.md]

## Task 3: FDCPA Defenses
[Summary from fdcpa_defenses_research.md]

## Task 4: Contract Defenses
[Summary from contract_defenses_research.md]

## Strategic Synthesis
[Cross-cutting analysis and recommendations]

## Detailed Research Files
- FDCPA Elements: fdcpa_elements_research.md
- Contract Elements: breach_contract_elements_research.md
- FDCPA Defenses: fdcpa_defenses_research.md
- Contract Defenses: contract_defenses_research.md
```

---

---

## Time Savings with Delegation

### Sequential Execution (No Delegation)

```
Task 1: FDCPA elements (2 min)
  ↓
Task 2: Contract elements (2 min)
  ↓
Task 3: FDCPA defenses (2 min)
  ↓
Task 4: Contract defenses (2 min)
  ↓
Total Time: 8 minutes
```

### Parallel Execution (With Delegation)

```
Task 1: FDCPA elements (2 min)  ┐
Task 2: Contract elements (2 min) ├─ All run simultaneously
Task 3: FDCPA defenses (2 min)   │
Task 4: Contract defenses (2 min)┘
  ↓
Total Time: 2 minutes (75% time savings!)
```

### When Delegation Provides Maximum Value

**High Value Scenarios** (Use delegation):

- 5+ research tasks → 80% time savings
- Multi-claim litigation → Parallel claim analysis
- Comprehensive strategy development → All issues researched simultaneously
- Urgent deadlines → Get results 4-5x faster

**Low Value Scenarios** (Skip delegation):

- 1-2 simple tasks → Overhead not worth it
- Sequential dependencies → Can't parallelize anyway
- Quick CourtListener searches → Already fast enough

---

## Decision Tree: Which Resource to Use?

### STEP 1: Identify Research Type

**Question 1**: What type of research is needed?

**Type A: Find Specific Cases** → Use CourtListener API (Fast, Precise)

- "Find 11th Circuit cases on arbitration waiver"
- "Find recent Supreme Court FDCPA cases"
- "Find Georgia cases on contract formation"

**Type B: Analyze Legal Elements** → Use GPT Researcher (Comprehensive, Analytical)

- "What are the elements of an FDCPA violation?"
- "What defenses exist to breach of contract?"
- "Analyze the legal standard for summary judgment"

**Type C: Synthesize Multiple Sources** → Use GPT Researcher (Synthesis, Comparison)

- "Compare 11th Circuit and 9th Circuit approaches to arbitration"
- "Analyze evolution of FDCPA attorney liability"
- "Synthesize case law on forum shopping"

**Type D: Find + Analyze** → Use Both (CourtListener → GPT Researcher)

- "Find and analyze controlling authority on [issue]"
- "Research claim elements and find supporting cases"
- "Identify defenses and find case law for each"

---

### STEP 2: Determine Jurisdiction Requirements

**Question 2**: Is jurisdiction-specific authority required?

**YES - Controlling Authority Needed**:

- Use CourtListener API to filter by court
- Prioritize binding precedent (circuit court, state supreme court)
- Example: 11th Circuit cases (binding in N.D. Ga.)

**NO - General Legal Research**:

- Use GPT Researcher for broad analysis
- Can include persuasive authority from other jurisdictions
- Example: General FDCPA elements (federal statute, any jurisdiction)

---

### STEP 3: Determine Recency Requirements

**Question 3**: How recent must the authority be?

**RECENT (Last 1-5 years)**:

- Use CourtListener API with date filters
- Important for evolving areas of law
- Example: Recent arbitration waiver cases

**ESTABLISHED (Any date)**:

- Use GPT Researcher for comprehensive analysis
- Include foundational cases regardless of age
- Example: Basic contract formation elements

---

## Resource Selection Matrix

| Research Need              | Jurisdiction | Recency | Resource             | Method               |
| -------------------------- | ------------ | ------- | -------------------- | -------------------- |
| Find specific cases        | Required     | Any     | CourtListener        | API Search           |
| Find recent cases          | Required     | Recent  | CourtListener        | API + Date Filter    |
| Analyze elements           | Not Required | Any     | GPT Researcher       | Web Research         |
| Find controlling authority | Required     | Recent  | CourtListener → GPT | API → Analysis      |
| Synthesize case law        | Not Required | Any     | GPT Researcher       | Web Research         |
| Compare jurisdictions      | Multiple     | Any     | GPT Researcher       | Web Research         |
| Find + analyze             | Required     | Recent  | Both                 | CourtListener → GPT |

---

## Workflow: CourtListener API Search

**When to Use**: Finding specific cases by jurisdiction, court, or citation count

### STEP 1: Construct Search Query

**CourtListener Search Endpoint**:

```bash
GET /api/v1/search?type=o&q={query}&court={court_id}&date_filed__gte={date}
```

**Key Parameters**:

- `type=o` - Search opinions (case law)
- `q` - Search query (legal issue, case name, keywords)
- `court` - Court ID (e.g., `ca11` for 11th Circuit, `scotus` for Supreme Court)
- `date_filed__gte` - Minimum filing date (YYYY-MM-DD)
- `cited_by__gte` - Minimum citation count (find influential cases)
- `page_size` - Results per page (max 100)

**Court IDs** (Common):

- `scotus` - U.S. Supreme Court
- `ca11` - 11th Circuit Court of Appeals
- `ca9` - 9th Circuit Court of Appeals
- `gand` - N.D. Georgia District Court
- `gasupreme` - Georgia Supreme Court
- `gactapp` - Georgia Court of Appeals

### STEP 2: Execute Search

**Example Searches**:

**Find 11th Circuit arbitration cases**:

```bash
curl "http://localhost:8001/api/v1/search?type=o&q=arbitration+waiver&court=ca11&page_size=20"
```

**Find recent FDCPA cases (last 2 years)**:

```bash
curl "http://localhost:8001/api/v1/search?type=o&q=FDCPA+attorney&date_filed__gte=2023-01-01&page_size=20"
```

**Find highly cited contract cases**:

```bash
curl "http://localhost:8001/api/v1/search?type=o&q=contract+formation&cited_by__gte=50&page_size=20"
```

### STEP 3: Parse Results

**Extract from Response**:

- `case_name` - Full case name
- `citation` - Reporter citation
- `court` - Court ID
- `date_filed` - Filing date
- `absolute_url` - CourtListener URL
- `snippet` - Text snippet showing relevance

### STEP 4: Save Results

**Output Location**: `[CASE_FOLDER]/step_2_strategy_research/[STRATEGY_ID]/supporting_docs/courtlistener_search_YYYYMMDD_HHMMSS.json`

**Format**:

```json
{
  "search_query": "arbitration waiver",
  "court_filter": "ca11",
  "date_filter": "2020-01-01",
  "total_results": 45,
  "cases": [
    {
      "case_name": "Hernandez v. Acosta Tractors, Inc.",
      "citation": "898 F.3d 1301",
      "court": "ca11",
      "date_filed": "2018-08-08",
      "url": "https://www.courtlistener.com/opinion/...",
      "snippet": "...calculated choice to abandon arbitration..."
    }
  ]
}
```

---

## Workflow: GPT Researcher Analysis

**When to Use**: Analyzing legal elements, synthesizing case law, comparing authorities

### STEP 1: Determine Research Mode

**Single-Agent Mode** (Fast, 1-2 minutes, $0.10-$0.20):

- Simple element analysis
- Straightforward legal research
- Quick synthesis of 3-5 sources

**Multi-Agent Mode** (Thorough, 5-10 minutes, $0.50-$1.00):

- Complex claim analysis
- Comprehensive legal research
- High-stakes strategy development
- Synthesis of 10+ sources

**Decision Criteria**:

- Use **Single-Agent** for routine research during drafting
- Use **Multi-Agent** for critical strategy development (Step 2)

### STEP 2: Construct Research Query

**Query Template for Claim Elements**:

```
Research the legal elements required to establish a claim for [CLAIM_TYPE] under [JURISDICTION] law.

Provide:
1. Complete list of elements with citations
2. Burden of proof for each element
3. Key cases establishing each element
4. Common defenses to this claim
5. Recent developments or changes in the law

Focus on [JURISDICTION] controlling authority (e.g., 11th Circuit, Georgia Supreme Court).
```

**Query Template for Case Law Research**:

```
Find and analyze case law on [LEGAL_ISSUE] in the [JURISDICTION].

Provide:
1. Leading cases establishing the legal standard
2. Recent cases (last 5 years) applying the standard
3. Circuit splits or conflicting authority
4. Trends or evolution in the law
5. Practical application and key takeaways

Prioritize binding precedent from [SPECIFIC_COURT].
```

**Query Template for Defense Research**:

```
Research defenses to a claim of [CLAIM_TYPE] under [JURISDICTION] law.

Provide:
1. Affirmative defenses with elements
2. Procedural defenses (statute of limitations, standing, etc.)
3. Case law supporting each defense
4. Success rate or viability of each defense
5. Strategic considerations for asserting defenses

Focus on [JURISDICTION] law and recent cases.
```

### STEP 3: Execute GPT Researcher

**Using Existing Script**:

```bash
python scripts/research_strategy.py \
    --case-id "[CASE_ID]" \
    --strategy-id "[STRATEGY_ID]" \
    --query "[RESEARCH_QUERY]" \
    --mode "[single_agent|multi_agent]" \
    --output-name "[OUTPUT_NAME]"
```

**Example - Single-Agent**:

```bash
python scripts/research_strategy.py \
    --case-id "20250928_001044_bruce_vs_happy_money" \
    --strategy-id "strategy_001_initial_analysis" \
    --query "What are the elements of an FDCPA violation under 15 U.S.C. § 1692e? Include burden of proof and key 11th Circuit cases." \
    --mode "single_agent" \
    --output-name "fdcpa_elements_research"
```

**Example - Multi-Agent**:

```bash
python scripts/research_strategy.py \
    --case-id "20250928_001044_bruce_vs_happy_money" \
    --strategy-id "strategy_001_initial_analysis" \
    --query "Comprehensive analysis of arbitration waiver through forum shopping in the 11th Circuit. Include elements, case law, defenses, and recent developments." \
    --mode "multi_agent" \
    --output-name "arbitration_waiver_comprehensive"
```

### STEP 4: Review Results

**Output Location**: `[CASE_FOLDER]/step_2_strategy_research/[STRATEGY_ID]/supporting_docs/[OUTPUT_NAME].md`

**Expected Content**:

- Structured analysis with sections
- Citations to cases and statutes
- Synthesis of multiple sources
- Practical takeaways

---

## Workflow: Combined Approach (CourtListener + GPT Researcher)

**When to Use**: Need both specific cases AND comprehensive analysis

### STEP 1: CourtListener Search (Find Cases)

Execute CourtListener search to find relevant cases:

```bash
curl "http://localhost:8001/api/v1/search?type=o&q=[ISSUE]&court=[COURT]&date_filed__gte=[DATE]"
```

Save results to JSON file.

### STEP 2: Extract Case Citations

From CourtListener results, extract:

- Top 5-10 most relevant cases
- Case names and citations
- Brief snippets showing relevance

### STEP 3: GPT Researcher Analysis (Analyze Cases)

Create query that references CourtListener findings:

```
Analyze the following cases on [LEGAL_ISSUE]:

[LIST OF CASES FROM COURTLISTENER]

Provide:
1. Summary of each case's holding
2. How each case applies to [OUR_SITUATION]
3. Which cases provide strongest support
4. Any limitations or distinctions
5. Recommended citation strategy

Focus on cases binding in [JURISDICTION].
```

### STEP 4: Synthesize Results

GPT Researcher will:

- Research each case in detail
- Analyze applicability to your situation
- Provide strategic recommendations
- Identify strongest authorities

---

## Common Research Scenarios

### Scenario 1: Researching Claim Elements

**Situation**: Need to understand elements of FDCPA violation

**Resource**: GPT Researcher (Single-Agent)

**Query**:

```
What are the elements of an FDCPA violation under 15 U.S.C. § 1692e?

Provide:
1. Complete list of elements
2. Burden of proof for each
3. Key Supreme Court and 11th Circuit cases
4. Common defenses
5. Recent developments

Focus on 11th Circuit law.
```

**Output**: Comprehensive element analysis with citations

---

### Scenario 2: Finding Controlling Authority

**Situation**: Need 11th Circuit cases on arbitration waiver

**Resource**: CourtListener API

**Query**:

```bash
curl "http://localhost:8001/api/v1/search?type=o&q=arbitration+waiver+forum+shopping&court=ca11&date_filed__gte=2018-01-01&page_size=20"
```

**Output**: List of 11th Circuit cases with citations and snippets

---

### Scenario 3: Comprehensive Strategy Research

**Situation**: Developing strategy for arbitration waiver argument

**Resource**: Both (CourtListener → GPT Researcher Multi-Agent)

**Step 1 - CourtListener**:

```bash
curl "http://localhost:8001/api/v1/search?type=o&q=arbitration+default+waiver&court=ca11&cited_by__gte=10"
```

**Step 2 - GPT Researcher**:

```
Comprehensive analysis of arbitration waiver through default in the 11th Circuit.

Based on these key cases:
- Hernandez v. Acosta Tractors, 898 F.3d 1301 (11th Cir. 2018)
- [Other cases from CourtListener]

Provide:
1. Elements of arbitration waiver
2. What constitutes "default" of arbitration
3. Forum shopping analysis
4. Defenses to waiver claim
5. Strategic recommendations for our case

Include recent developments and circuit splits.
```

**Output**: Comprehensive strategic analysis with case law synthesis

---

## Output Requirements

### CourtListener Search Results

**Location**: `[CASE_FOLDER]/step_2_strategy_research/[STRATEGY_ID]/supporting_docs/courtlistener_[TOPIC]_YYYYMMDD_HHMMSS.json`

**Required Fields**:

- Search parameters (query, court, date range)
- Total results count
- Top cases with full citations
- Snippets showing relevance
- CourtListener URLs

### GPT Researcher Analysis

**Location**: `[CASE_FOLDER]/step_2_strategy_research/[STRATEGY_ID]/supporting_docs/[OUTPUT_NAME].md`

**Required Sections**:

- Executive summary
- Detailed analysis
- Case law citations
- Practical application
- Strategic recommendations

---

## Best Practices

1. **Start Broad, Then Narrow**:

   - Use GPT Researcher for initial element analysis
   - Use CourtListener to find specific controlling authority
   - Use GPT Researcher again to synthesize findings
2. **Prioritize Binding Precedent**:

   - Always filter CourtListener by relevant court
   - 11th Circuit cases bind N.D. Georgia
   - Georgia Supreme Court cases bind Georgia state courts
3. **Check Recency**:

   - Use date filters for evolving areas of law
   - Verify cases haven't been overruled
   - Look for recent developments
4. **Document Research Trail**:

   - Save all CourtListener searches
   - Save all GPT Researcher outputs
   - Create research log in strategy folder
5. **Verify Critical Citations**:

   - Use citation verification protocol for any cases you plan to cite
   - Don't rely solely on GPT Researcher for citations
   - Verify controlling authority via CourtListener

---

## Reference Documentation

- **CourtListener API Guide**: `confluence/docs/COURTLISTENER_API_GUIDE.md`
- **GPT Researcher Capabilities**: `confluence/docs/GPT_RESEARCHER_CAPABILITIES_SUMMARY.md`
- **Research Strategy Script**: `scripts/research_strategy.py`
- **Citation Verification Protocol**: `.augment/protocols/CITATION_VERIFICATION.md``

---

## Examples

See `confluence/docs/LEGAL_RESEARCH_EXAMPLES.md` for detailed examples of:

- Claim element research
- Controlling authority discovery
- Defense research
- Comparative jurisdiction analysis
- Recent development tracking
