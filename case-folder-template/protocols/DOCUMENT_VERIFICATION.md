# Protocol: Document Verification (Subject vs. Sources)

Status: Ready for use (script-first)
Owner: Accuracy Layer

## Purpose

Verify all factual assertions in a subject document against an explicitly provided set of source documents using GPT Researcher (local doc_path) with JSON-only outputs and audit-ready artifacts.

## Who does what

- Main Agent (YOU): decides when to verify, selects subject and source sets, invokes the script.
- Script (scripts/verify_facts.py): owns staging, naming, execution, JSON validation, artifacts, notifications, cleanup.
- Optional Sub-Agent (Corpus Curator): produces a manifest.json of sources when curation is complex; main agent still invokes the script.

## Inputs (to the script)

- --subject <path_to_subject_document>
- One source selection mode (choose exactly one):
  - --sources-dir `<dir>` (all text files under dir)
  - --source-glob "pattern" (repeatable)
  - --sources-manifest <path_to_manifest.json>
- Optional:
  - --case-id `<string>`
  - --focus procedural|claims|facts (repeatable)
  - --mode single|multi (default: single)
  - --staging-root (default from settings.json, e.g., /app/documents/_staging)
  - --notify-dir <case_notifications_dir>
  - --json-out / --summary-out (defaults: next to subject)
  - --timeout-seconds, --max-retries, --no-cleanup

## Ephemeral staging

- Script creates: {staging_root}/DV_`<CASEID>`_`<YYYYMMDDHHMMSS>`_`<shortid>`/
- Structure:
  - subject/subject.`<ext>`
  - sources/source_001.`<ext>`, source_002.`<ext>`, ...
  - manifest.json (maps staged → original, sha256, size, mtime)
  - query.txt (exact prompt sent)
  - config.json (mode, focus, api, paths)
  - logs/run.log
- Script cleans up staging unless --no-cleanup.

## Execution flow (script)

1) Validate inputs; resolve source set (dir/glob/manifest);
2) Create request_id and staging dir; copy subject and sources with deterministic names;
3) Build strict JSON-only query:
   - Explicitly name the subject file; forbid citing it as evidence;
   - Use only staged sources for verification; return fixed JSON schema only;
4) Call GPT Researcher via HTTP (Bearer auth), poll with timeout and retries;
5) Strip code fences and parse JSON; validate schema; repair once if needed;
6) Persist outputs next to subject and in notifications if issues exist;
7) Cleanup staging; exit with code (0=clean, 2=issues found, 1=error).

## Outputs & notifications

- Next to subject:
  - verification_report_`<timestamp>`.json (full results)
  - verification_report_`<timestamp>`.md (human summary)
- Notifications (if issues or always, per config):
  - <case_root>/notifications/document_verification/`<timestamp>`_DV_`<id>`/
    - status.json (counts, severity, exit_code)
    - results.json (same as JSON report)
    - summary.md (triage-ready)
    - pointers.json (paths to subject and representative sources)

## Exit codes

- 0: Successful run; 0 contradicted and 0 unverifiable claims
- 2: Successful run; issues found (≥1 contradicted or unverifiable)
- 1: Runtime/validation error (transport, timeout, malformed JSON)

## Escalation & policy

- Any CONTRADICTED claim → attorney review.
- UNVERIFIABLE above threshold (config) → re-run in --mode multi or escalate.
- Court-facing drafts must pass verification or have partner waiver on file.

## Example (real case)

Subject:
firms/justicequest_llp/cases/20251006_214823_consumer_portfolio_services/step_1_interview/1.4_fact_gathering/Case_Summary_and_Timeline.md

Sources directory:
firms/justicequest_llp/cases/20251006_214823_consumer_portfolio_services/documents/full_text_extractions

Command:

```
python scripts/verify_facts.py \
  --subject "firms/justicequest_llp/cases/20251006_214823_consumer_portfolio_services/step_1_interview/1.4_fact_gathering/Case_Summary_and_Timeline.md" \
  --sources-dir "firms/justicequest_llp/cases/20251006_214823_consumer_portfolio_services/documents/full_text_extractions" \
  --case-id "20251006_214823_consumer_portfolio_services" \
  --focus procedural --focus claims --focus facts \
  --mode single
```

## Implementation notes (script refactor targets)

- Implement a staging manager (deterministic naming, manifest.json, cleanup).
- Use requests + Bearer auth; unify with research_strategy.py auth patterns.
- Enforce JSON-only output; strip ```json fences; validate schema with clear error messages.
- Write artifacts atomically; include request_id in filenames and JSON metadata.
- Support escalation to multi-agent on threshold breach; attach both results in notifications.
- Align paths and defaults with settings.json (staging_root, notifications_root, api.base_url).
