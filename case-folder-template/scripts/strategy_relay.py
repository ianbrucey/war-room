#!/usr/bin/env python3
"""
Strategy Relay Script - The "Relay Race" Architecture for Legal Strategy Analysis

This script orchestrates multiple LLM calls to analyze legal claims.
Each phase uses a different "costume" (role) but passes artifacts (files) as the baton.

Usage:
    python scripts/strategy_relay.py --workspace ./workspaces/my_workspace --strategy my_strategy
    python scripts/strategy_relay.py --workspace ./workspaces/my_workspace --strategy my_strategy --agent gemini
"""

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path
from datetime import datetime
from typing import Optional

# Configuration
DEFAULT_AGENT = "auggie"
SUPPORTED_AGENTS = ["auggie", "gemini"]

# Agent-specific CLI configurations
AGENT_CONFIG = {
    "auggie": {
        "command": "auggie",
        "prompt_flag": "-p",
        "extra_flags": []
    },
    "gemini": {
        "command": "gemini",
        "prompt_flag": "-p",
        "extra_flags": ["-y", "-m", "gemini-2.5-flash"]
    }
}


def log(message: str, level: str = "INFO"):
    """Simple logging with timestamps."""
    timestamp = datetime.now().strftime("%H:%M:%S")
    icons = {"INFO": "ℹ️", "START": "🚀", "DONE": "✅", "ERROR": "❌", "PHASE": "🔄"}
    icon = icons.get(level, "•")
    print(f"[{timestamp}] {icon} {message}")


def run_agent(agent: str, role: str, task: str, context_files: list[str], output_format: str = "markdown") -> str:
    """
    Call the LLM in non-interactive mode with a specific role.

    Args:
        agent: Which agent to use (auggie or gemini)
        role: The "costume" - who the agent is for this phase
        task: The specific task to accomplish
        context_files: List of file paths to include as context
        output_format: Expected output format (json or markdown)

    Returns:
        The agent's response as a string
    """
    # Load context files
    context_content = ""
    for file_path in context_files:
        if os.path.exists(file_path):
            with open(file_path, 'r') as f:
                context_content += f"\n\n=== {file_path} ===\n{f.read()}"

    # Build the full prompt
    prompt = f"""ROLE: {role}

OUTPUT FORMAT: {output_format}

CONTEXT FILES:
{context_content}

---

TASK:
{task}

---

Respond with ONLY the requested output. No preamble, no explanation."""

    # Build the command based on agent config
    config = AGENT_CONFIG.get(agent, AGENT_CONFIG["auggie"])
    cmd = [config["command"]] + config["extra_flags"] + [config["prompt_flag"], prompt]

    # Call the agent
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300  # 5 minute timeout per call
        )

        if result.returncode != 0:
            log(f"Agent returned error: {result.stderr}", "ERROR")
            return ""

        return result.stdout.strip()

    except subprocess.TimeoutExpired:
        log(f"Agent call timed out", "ERROR")
        return ""
    except FileNotFoundError:
        log(f"Agent '{config['command']}' not found. Is it installed?", "ERROR")
        sys.exit(1)


def phase_research_elements(agent: str, claim: dict, jurisdiction: str, output_dir: Path) -> Path:
    """
    Phase A: The Researcher
    Extract legal elements required to prove this claim.
    Uses MCP legal research tools to find authoritative case law and statutes.
    """
    claim_name = claim["name"]
    claim_theory = claim.get("legal_theory", "")

    task = f"""Research the legal elements required to prove "{claim_name}" under {jurisdiction} law.

Legal Theory: {claim_theory}

## REQUIRED: Use Legal Research MCP Tools

You MUST use the following MCP tools to conduct actual legal research:

1. **search_cases_legal-hub** - Search for relevant case law by keyword or party name
   - Use to find controlling authority for this claim type
   - Search for: "{claim_name}" + "{jurisdiction}"

2. **lookup_citation_legal-hub** - Validate and retrieve specific citations
   - Use to verify any citations you find

3. **web_search_legal-hub** - Search for legal standards and statutory authority
   - Use to find statutes, regulations, or legal tests

4. **deep_research_legal-hub** (optional) - For complex claims requiring comprehensive research
   - Use if the claim involves novel or complex legal issues

## Research Process

1. Search for controlling case law using search_cases_legal-hub
2. Identify the primary statute or regulation (if applicable)
3. Extract the legal elements from authoritative sources
4. Document the legal standard for each element with citations

## Output Format

Return a JSON object with this exact structure:
{{
  "claim_id": "{claim['id']}",
  "claim_name": "{claim_name}",
  "jurisdiction": "{jurisdiction}",
  "source": "[Primary statute or case citation - MUST BE REAL]",
  "controlling_authority": [
    {{
      "citation": "[Full citation]",
      "relevance": "[Why this case/statute is controlling]"
    }}
  ],
  "elements": [
    {{
      "id": "E1",
      "name": "[Element name]",
      "description": "[What must be proven]",
      "legal_standard": "[Specific standard or test]",
      "authority": "[Case or statute citation establishing this element]",
      "facts_mapped": [],
      "status": "unproven"
    }}
  ]
}}

Include 3-6 elements typically. ALL citations must be real and verified using the MCP tools."""

    log(f"Researching elements for: {claim_name}", "PHASE")

    response = run_agent(
        agent=agent,
        role="Legal Research Clerk specializing in element extraction",
        task=task,
        context_files=[],
        output_format="json"
    )

    # Parse and save
    output_file = output_dir / "elements.json"
    try:
        # Try to parse as JSON to validate
        elements_data = json.loads(response)
        with open(output_file, 'w') as f:
            json.dump(elements_data, f, indent=2)
    except json.JSONDecodeError:
        # Save raw response if not valid JSON
        log(f"Warning: Could not parse elements as JSON, saving raw", "ERROR")
        with open(output_file, 'w') as f:
            f.write(response)

    return output_file


def phase_match_facts(agent: str, elements_file: Path, case_context_dir: Path, output_dir: Path, file_search_store_id: Optional[str] = None) -> Path:
    """
    Phase B: The Investigator
    Search case files for facts matching each element.
    Uses File Search for semantic queries, with fallback to local files.
    """
    # Start with elements file
    context_files = [str(elements_file)]

    # Get the workspace root (parent of case-context)
    workspace_root = case_context_dir.parent
    documents_dir = workspace_root / "documents"

    # Load document index if available
    doc_index_path = case_context_dir / "documents_index.json"
    doc_index = None
    if doc_index_path.exists():
        context_files.append(str(doc_index_path))
        with open(doc_index_path, 'r') as f:
            try:
                doc_index = json.load(f)
            except json.JSONDecodeError:
                pass

    # Add case summary if it exists
    case_summary_path = case_context_dir / "case_summary.md"
    if case_summary_path.exists():
        context_files.append(str(case_summary_path))

    # Build document manifest for the agent
    doc_manifest = []
    if documents_dir.exists():
        for doc_folder in documents_dir.iterdir():
            if doc_folder.is_dir() and not doc_folder.name.startswith('_'):
                metadata_path = doc_folder / "metadata.json"
                text_path = doc_folder / "extracted-text.txt"

                doc_entry = {
                    "folder": doc_folder.name,
                    "metadata_path": str(metadata_path) if metadata_path.exists() else None,
                    "text_path": str(text_path) if text_path.exists() else None,
                }

                # Include metadata summary in manifest
                if metadata_path.exists():
                    try:
                        with open(metadata_path, 'r') as f:
                            meta = json.load(f)
                            doc_entry["type"] = meta.get("document_type", "unknown")
                            doc_entry["summary"] = meta.get("summary", {}).get("executive_summary", "")[:500]
                    except:
                        pass

                doc_manifest.append(doc_entry)

    # Build File Search instructions if store ID is available
    file_search_instructions = ""
    if file_search_store_id:
        file_search_instructions = f"""
## PRIMARY METHOD: Google File Search (Semantic Query)

You have access to a semantic search tool that can query case documents intelligently.
Use the `file_search_query_legal-hub` MCP tool with:
- `store_name`: `{file_search_store_id}`
- `query`: Your natural language question about the documents

**Recommended approach for each element:**
1. Query the File Search with a targeted question, e.g.:
   - "What evidence relates to [element name]?"
   - "What facts support [specific requirement]?"
   - "Extract dates and events relevant to [topic]"
2. Use the returned answer and citations to populate facts_mapped
3. If File Search doesn't return relevant results, fall back to reading local files

**Example queries:**
- "What damages or harm did the plaintiff suffer?"
- "What communications occurred between the parties?"
- "What contract terms or obligations were allegedly breached?"
- "What evidence shows the defendant's knowledge or intent?"

## FALLBACK: Local Document Files
"""
    else:
        file_search_instructions = """
## DOCUMENT ACCESS: Local Files
"""

    task = f"""You are investigating facts for a legal claim. Your job is to find evidence in case documents.
{file_search_instructions}
The following documents are available in this case:

```json
{json.dumps(doc_manifest, indent=2)}
```

If you need to examine a document's full text, its path is provided in the manifest.

## YOUR PROCESS
1. First, review the elements.json to understand what facts you need to find
2. Look at the DOCUMENT INDEX (documents_index.json) and CASE SUMMARY to understand what's in each document
3. For EACH element, {"use File Search to query for relevant facts first, then" if file_search_store_id else ""} identify which SPECIFIC document(s) would contain relevant evidence
4. Be selective - only examine documents relevant to specific elements
5. For each fact found, cite the EXACT source document

## IMPORTANT: Be Selective
- If an element is about contract terms, look at contracts
- If an element is about damages, look at financial documents
- If an element is about communications, look at correspondence/emails

## OUTPUT FORMAT
Return the COMPLETE updated elements.json with facts_mapped populated:
{{
  "claim_id": "...",
  "claim_name": "...",
  "jurisdiction": "...",
  "source": "...",
  "elements": [
    {{
      "id": "E1",
      "name": "...",
      "description": "...",
      "legal_standard": "...",
      "documents_searched": ["list of doc folders actually examined"],
      "facts_mapped": [
        {{
          "fact": "[The specific fact - quote if possible]",
          "source": "[Document folder name or 'File Search']",
          "location": "[Page/section if available]",
          "strength": "strong|medium|weak",
          "notes": "[Why this supports the element]"
        }}
      ],
      "status": "proven|partial|unproven"
    }}
  ]
}}

Be thorough but selective. If no evidence exists, mark status as "unproven"."""

    log(f"Matching facts to elements ({len(doc_manifest)} documents available)...", "PHASE")

    response = run_agent(
        agent=agent,
        role="Fact Investigator - selective evidence mapper",
        task=task,
        context_files=context_files,
        output_format="json"
    )

    # Update elements file
    try:
        updated_elements = json.loads(response)
        with open(elements_file, 'w') as f:
            json.dump(updated_elements, f, indent=2)
    except json.JSONDecodeError:
        log(f"Warning: Could not parse fact mapping as JSON", "ERROR")

    return elements_file


def phase_analyze_viability(agent: str, elements_file: Path, output_dir: Path) -> Path:
    """
    Phase C: The Analyst
    Calculate viability score and simulate adversarial response.
    """
    task = """Analyze the claim based on the elements and fact mapping provided.

Your analysis must include:

1. VIABILITY SCORE
   - HIGH: All or nearly all elements have strong evidence
   - MEDIUM: Most elements have some evidence, gaps are fillable
   - LOW: Critical elements lack evidence
   - FATAL: Cannot proceed without major new evidence

2. ELEMENT SUMMARY TABLE
   For each element: Status (✅/⚠️/❌) and evidence strength

3. ADVERSARIAL CHECK
   Role-play as opposing counsel. What are the 2-3 strongest attacks on this claim?
   How would you try to defeat it?

4. RECOMMENDATIONS
   - What gaps need to be filled?
   - What discovery would strengthen this claim?
   - Should this claim be pursued, modified, or dropped?

Output as markdown with clear sections."""

    log(f"Analyzing viability...", "PHASE")

    response = run_agent(
        agent=agent,
        role="Senior Litigator - strategic case analyst",
        task=task,
        context_files=[str(elements_file)],
        output_format="markdown"
    )

    # Save analysis
    output_file = output_dir / "analysis.md"

    # Add header
    with open(elements_file, 'r') as f:
        try:
            elements = json.loads(f.read())
            claim_name = elements.get("claim_name", "Unknown Claim")
        except:
            claim_name = "Unknown Claim"

    full_content = f"""# Analysis: {claim_name}

**Generated**: {datetime.now().strftime("%Y-%m-%d %H:%M")}

---

{response}
"""

    with open(output_file, 'w') as f:
        f.write(full_content)

    return output_file


def phase_gap_analysis(agent: str, strategy_dir: Path) -> Path:
    """
    Phase D: The Reporter
    Aggregate all claim analyses into a gap analysis summary.
    """
    # Gather all analysis files
    analysis_files = list(strategy_dir.glob("claims/*/analysis.md"))
    elements_files = list(strategy_dir.glob("claims/*/elements.json"))

    context_files = [str(f) for f in analysis_files + elements_files]

    task = """Review all the claim analyses and create a consolidated Gap Analysis report.

Include:

1. EXECUTIVE SUMMARY
   - Overall case strength assessment
   - Number of claims and their viability scores
   - Critical risks

2. CLAIM STATUS TABLE
   | Claim | Viability | Key Strength | Key Weakness |

3. CRITICAL GAPS
   List ALL unproven or weak elements across all claims.
   For each gap:
   - Which claim it affects
   - What evidence is needed
   - Suggested discovery approach

4. PRIORITY ACTIONS
   Ordered list of what to do next:
   - Immediate actions
   - Research needed
   - Discovery to pursue

5. STRATEGIC RECOMMENDATION
   Overall recommendation on how to proceed.

Output as markdown."""

    log(f"Generating gap analysis...", "PHASE")

    response = run_agent(
        agent=agent,
        role="Senior Litigation Partner - strategic advisor",
        task=task,
        context_files=context_files,
        output_format="markdown"
    )

    # Save gap analysis
    output_file = strategy_dir / "GAP_ANALYSIS.md"

    full_content = f"""# Gap Analysis

**Strategy**: {strategy_dir.name}
**Generated**: {datetime.now().strftime("%Y-%m-%d %H:%M")}
**Claims Analyzed**: {len(analysis_files)}

---

{response}
"""

    with open(output_file, 'w') as f:
        f.write(full_content)

    return output_file


def main():
    parser = argparse.ArgumentParser(description="Strategy Relay - Legal Claim Analysis Pipeline")
    parser.add_argument("--workspace", required=True, help="Path to the workspace directory")
    parser.add_argument("--strategy", required=True, help="Name of the strategy to analyze")
    parser.add_argument("--agent", default=DEFAULT_AGENT, choices=SUPPORTED_AGENTS, help="Which agent to use")
    parser.add_argument("--skip-research", action="store_true", help="Skip element research (use existing)")
    parser.add_argument("--claim", help="Process only a specific claim ID")

    args = parser.parse_args()

    # Resolve paths
    workspace_dir = Path(args.workspace).resolve()
    strategy_dir = workspace_dir / "strategies" / args.strategy
    claims_file = strategy_dir / "CLAIMS.json"
    case_context_dir = workspace_dir.parent / "case-context"

    # Validate
    if not workspace_dir.exists():
        log(f"Workspace not found: {workspace_dir}", "ERROR")
        sys.exit(1)

    if not claims_file.exists():
        log(f"CLAIMS.json not found: {claims_file}", "ERROR")
        sys.exit(1)

    # Load case settings to get file_search_store_id
    file_search_store_id = None
    settings_file = case_context_dir / "settings.json"
    if settings_file.exists():
        try:
            with open(settings_file, 'r') as f:
                settings = json.load(f)
                file_search_store_id = settings.get("case", {}).get("file_search_store_id")
                if file_search_store_id:
                    log(f"File Search enabled: {file_search_store_id}", "INFO")
        except (json.JSONDecodeError, KeyError):
            pass

    # Load claims
    with open(claims_file, 'r') as f:
        claims_data = json.load(f)

    claims = claims_data.get("claims", [])
    jurisdiction = claims_data.get("jurisdiction", "applicable")

    if args.claim:
        claims = [c for c in claims if c["id"] == args.claim]
        if not claims:
            log(f"Claim ID not found: {args.claim}", "ERROR")
            sys.exit(1)

    log(f"Strategy Relay starting: {len(claims)} claim(s) to analyze", "START")
    log(f"Agent: {args.agent} | Strategy: {args.strategy}")

    # Process each claim
    for claim in claims:
        claim_id = claim["id"]
        claim_name = claim["name"].lower().replace(" ", "_")
        claim_dir = strategy_dir / "claims" / f"{claim_id}_{claim_name}"
        claim_dir.mkdir(parents=True, exist_ok=True)

        log(f"Processing claim: {claim['name']}", "PHASE")

        # Phase A: Research Elements
        if not args.skip_research:
            elements_file = phase_research_elements(
                agent=args.agent,
                claim=claim,
                jurisdiction=jurisdiction,
                output_dir=claim_dir
            )
        else:
            elements_file = claim_dir / "elements.json"
            if not elements_file.exists():
                log(f"No existing elements.json found, running research", "INFO")
                elements_file = phase_research_elements(
                    agent=args.agent,
                    claim=claim,
                    jurisdiction=jurisdiction,
                    output_dir=claim_dir
                )

        # Phase B: Match Facts
        phase_match_facts(
            agent=args.agent,
            elements_file=elements_file,
            case_context_dir=case_context_dir,
            output_dir=claim_dir,
            file_search_store_id=file_search_store_id
        )

        # Phase C: Analyze Viability
        phase_analyze_viability(
            agent=args.agent,
            elements_file=elements_file,
            output_dir=claim_dir
        )

        log(f"Claim complete: {claim['name']}", "DONE")

    # Phase D: Gap Analysis (across all claims)
    phase_gap_analysis(agent=args.agent, strategy_dir=strategy_dir)

    log(f"Strategy Relay complete!", "DONE")
    log(f"Results in: {strategy_dir}")


if __name__ == "__main__":
    main()
