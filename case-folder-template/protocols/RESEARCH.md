# Protocol: Legal Research

**Trigger**: User asks a question requiring legal research, case law, or external information

**Purpose**: Determine appropriate research approach, execute research, and decide whether to save results or return inline

---

## Part 1: The Decision Tree

### Step 1: Assess the Request

Ask yourself:

| Question | If Yes → | If No → |
|----------|----------|---------|
| Is this a quick factual question? | Consider inline response | Continue assessment |
| Will this research inform multiple strategies/drafts? | Save to research folder | Continue assessment |
| Is this exploratory (broad topic)? | Save to research folder | Continue assessment |
| Is this a one-off clarification? | Inline response | Continue assessment |
| Did user explicitly say "research this"? | Save to research folder | Use judgment |

**Default rule**: When in doubt, save to research folder. It's better to have it documented than lost.

### Step 2: Choose Your Tools

You have access to these MCP tools:

**Court Listener (Legal Cases)**:
- `search_cases_legal-hub` - Search by keyword, party name, or citation
- `lookup_citation_legal-hub` - Look up specific citations (e.g., "384 U.S. 436")
- `get_opinion_legal-hub` - Retrieve full opinion text by ID

**Research & Web**:
- `deep_research_legal-hub` - Comprehensive research on a topic (generates report)
- `quick_search_legal-hub` - Quick web search (5-10 results)
- `web_search_legal-hub` - Gemini-powered web search with grounding
- `web-search` - Google Custom Search
- `web-fetch` - Fetch specific webpage and convert to markdown

**Decision matrix**:

| User Request | Primary Tool | Secondary Tools |
|--------------|--------------|-----------------|
| "Find cases about [topic]" | `search_cases_legal-hub` | `deep_research_legal-hub` if broad |
| "What does [citation] say?" | `lookup_citation_legal-hub` | `get_opinion_legal-hub` for full text |
| "Research [legal concept]" | `deep_research_legal-hub` | `search_cases_legal-hub` for cases |
| "What's the law on [topic]?" | `deep_research_legal-hub` | `web_search_legal-hub` |
| "Find information about [company/person]" | `web-search` or `quick_search_legal-hub` | `web-fetch` for specific pages |
| "Is there case law on [specific issue]?" | `search_cases_legal-hub` | `deep_research_legal-hub` if complex |

---

## Part 2: Execution Process

### For Inline Responses (Quick Questions)

1. **Execute** the appropriate tool(s)
2. **Synthesize** the answer clearly
3. **Cite sources** (case citations, URLs)
4. **Ask** if user wants this saved to research folder

Example:
```
Based on my search, the statute of limitations for breach of contract 
in Georgia is 6 years (O.C.G.A. § 9-3-24).

Would you like me to save this research to the research folder for 
future reference?
```

### For Research Folder (Documented Research)

1. **Execute** the appropriate tool(s)
2. **Create research file** in `research/` folder
3. **Update tracking** (see Part 3)
4. **Present** to user with summary

---

## Part 3: Research File Structure

### Naming Convention

Format: `[topic]_[YYYYMMDD].md`

Examples:
- `fdcpa_damages_20241219.md`
- `statute_of_limitations_breach_20241219.md`
- `qualified_immunity_standards_20241219.md`

### File Template

```markdown
# Research: [Topic]

**Date**: [YYYY-MM-DD]
**Requested by**: [User context if relevant]
**Related to**: [Workspace name if applicable, or "General case research"]

---

## Research Question

[Clear statement of what was researched]

---

## Summary

[2-3 sentence executive summary of findings]

---

## Findings

[Detailed research results organized by subtopic]

### [Subtopic 1]

[Content]

### [Subtopic 2]

[Content]

---

## Key Cases

[If applicable - list relevant cases with citations and brief holdings]

- **[Case Name], [Citation]**: [Brief holding/relevance]
- **[Case Name], [Citation]**: [Brief holding/relevance]

---

## Sources

[List all sources used]

1. [Source 1]
2. [Source 2]

---

## Notes

[Any caveats, limitations, or follow-up questions]
```

---

## Part 4: Tracking Research

### Update Workspace (if applicable)

If research was done for a specific workspace, update that workspace's `WORKSPACE.json`:

```json
{
  "linked_research": [
    "research/fdcpa_damages_20241219.md",
    "research/statute_of_limitations_breach_20241219.md"
  ]
}
```

### Research Index (Optional)

For cases with extensive research, consider creating `research/INDEX.md`:

```markdown
# Research Index

## By Topic

### FDCPA Claims
- [FDCPA Damages](fdcpa_damages_20241219.md) - 2024-12-19

### Contract Law
- [Statute of Limitations](statute_of_limitations_breach_20241219.md) - 2024-12-19

## By Date

- 2024-12-19: FDCPA Damages, Statute of Limitations
```

---

## Part 5: Tool-Specific Guidance

### Using `deep_research_legal-hub`

**When**: Broad topics requiring comprehensive analysis
**Output**: Generates full research report
**Action**: Save entire report to research folder

```python
# Example call
deep_research_legal-hub(
    query="FDCPA damages for violations",
    report_type="research_report",
    max_sources=10
)
```

### Using `search_cases_legal-hub`

**When**: Looking for specific case law
**Output**: List of cases with metadata
**Action**: Extract relevant cases, summarize in research file

```python
# Example call
search_cases_legal-hub(
    query="Fair Debt Collection Practices Act damages",
    court="ca11",  # 11th Circuit (Georgia)
    max_results=10
)
```

### Using `lookup_citation_legal-hub`

**When**: User provides specific citation
**Output**: Case details
**Action**: Usually inline response, save if part of larger research

```python
# Example call
lookup_citation_legal-hub(
    citation="384 U.S. 436"
)
```

---

## Part 6: Presentation to User

### After Saving Research

```
✅ Research complete: [Topic]

I've saved the research to: research/[filename].md

Key findings:
- [Finding 1]
- [Finding 2]
- [Finding 3]

[If workspace active] I've linked this research to the current workspace.

Would you like me to explain any of these findings in more detail?
```

### After Inline Response

```
[Answer with citations]

This was a quick lookup. Would you like me to:
1. Save this to the research folder for future reference
2. Conduct deeper research on this topic
3. Move on
```

---

## Part 7: Never Do / Always Do

### NEVER:
- Invent case citations or legal standards
- Provide legal advice (you're a research assistant)
- Skip citing sources
- Save trivial lookups to research folder without asking
- Use tools you don't have access to

### ALWAYS:
- Cite sources for every legal statement
- Use actual MCP tools (don't simulate)
- Ask if unsure whether to save or respond inline
- Update workspace `linked_research` when applicable
- Include research date in filename
- Verify citations before presenting them

