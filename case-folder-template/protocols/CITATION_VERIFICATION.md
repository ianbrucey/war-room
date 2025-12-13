# Protocol: Citation Verification (Case Law & Statutory Authorities)

**Status:** Ready for use (Auggie sub-agent handles entire workflow)
**Owner:** Accuracy Layer
**Last Updated:** October 28, 2025

---

## Purpose

Verify all legal citations (case law, statutes, regulations) in draft legal documents (motions, complaints, briefs, discovery documents) using CourtListener API to ensure:

1. **Citation Validity**: Citations exist and are correctly formatted
2. **Citation Accuracy**: Case names, reporters, and page numbers are accurate
3. **Proposition Support**: Citations actually support the legal propositions claimed (optional, high-stakes only)

This protocol prevents citation errors, fabricated cases, and misapplied legal authority from reaching court filings.

---

## Who Does What

- **Primary Agent (YOU)**: Decides when to verify citations, invokes Auggie sub-agent with document path
- **Sub-Agent (Auggie)**: Handles ENTIRE workflow - extracts citations, calls CourtListener API via curl, analyzes results, generates reports
- **No Script Required**: Auggie uses curl commands directly to call CourtListener API

---

## Trigger Conditions

**Stage 1 - Citation Validity (Mandatory):**

1. **After completing any draft in Step 3** that contains case law citations or statutory authorities
2. **Before finalizing any document for court filing** (motions, complaints, briefs, discovery)
3. **When user explicitly requests**: "verify citations" or "check citations"

**Stage 2 - Proposition Validation (Optional, High-Stakes Only):**

1. **High-stakes filings**: Motions for summary judgment, appeals, dispositive motions
2. **Final filings before court submission**
3. **When user explicitly requests**: "verify propositions" or "run full verification"
4. **When Stage 1 finds valid citations that need deeper analysis**

**User Prompt Template**:
```
"I found [N] citations in this draft. Would you like me to verify them?

Stage 1 (Recommended): Citation validity check (~30 seconds, free)
  - Verifies citations exist and are correctly formatted via CourtListener API

Stage 2 (Optional): Proposition validation (~2-5 minutes per citation, uses GPT Researcher)
  - Verifies citations actually support claimed propositions
  - Checks quote accuracy and context (holding vs. dicta)
  - Recommended for high-stakes filings (MSJ, appeals, etc.)

Run Stage 1 only, or both Stage 1 + Stage 2?"
```

---

## Sub-Agent Invocation

### Primary Agent Command

When citation verification is needed, the primary agent invokes Auggie with this command:

```bash
auggie -p "You are a citation verification specialist. Your task is to verify all legal citations in the draft document located at: [DOCUMENT_PATH]

IMPORTANT: Read the complete instructions in .augment/protocols/CITATION_VERIFICATION.md before starting. This protocol contains:
- Citation extraction instructions
- CourtListener API curl commands
- Rate limiting requirements (60 calls/min)
- Response handling for all status codes
- Output format requirements

Follow these steps:

STEP 1: READ THE DOCUMENT
- Load the HTML or Markdown document: [DOCUMENT_PATH]
- Extract plain text from HTML (ignore CSS, scripts, tags)

STEP 2: EXTRACT CITATIONS (Use LLM reasoning, not regex)
Extract ALL legal citations with complete information:

**Case Law Citations** (extract with full party names):
- Format: 'Party1 v. Party2, Volume Reporter Page (Court Year)'
- Examples:
  - 'Bridges v. Bridges, 256 Ga. 348, 349 S.E.2d 172 (1986)'
  - 'Hernandez v. Acosta Tractors, Inc., 898 F.3d 1301 (11th Cir. 2018)'
  - 'Heintz v. Jenkins, 514 U.S. 291, 294 (1995)'
  - 'Johnson v. DeKalb County, 314 Ga. App. 790, 726 S.E.2d 102 (2012)'

**Statutory Citations**:
- Federal statutes: '42 U.S.C. § 1983', '15 U.S.C. § 1692e'
- State statutes: 'O.C.G.A. § 13-3-2'
- Regulations: '29 C.F.R. § 1630.2'

**Important**:
- Extract COMPLETE citations including party names, not just reporter citations
- Include parallel citations (same case in multiple reporters)
- Preserve exact formatting from document

STEP 3: VERIFY CASE LAW CITATIONS (Use curl to call CourtListener API)

**IMPORTANT**: See confluence/docs/COURTLISTENER_API_GUIDE.md for complete API documentation (lines 114-144)

For each case law citation, call CourtListener citation-lookup endpoint:

**Curl Command**:
curl -X POST 'http://localhost:8001/api/v1/citation-lookup/' -H 'Content-Type: application/x-www-form-urlencoded' -d 'text=CITATION_TEXT_HERE'

**Rate Limiting**: Sleep 1 second between calls (60 citations/min limit)

**Handle Responses** (see API guide for details):
- **200 (VALID)**: Extract cluster_id, opinion_id, case_name, court, date_filed
- **300 (AMBIGUOUS)**: Extract all matches, analyze draft context to disambiguate
- **404 (NOT_FOUND)**: Try format variations, then flag for human review
- **400 (INVALID_FORMAT)**: Flag as invalid

**FALLBACK METHOD: If CourtListener API is unavailable or fails**

If CourtListener API is not responding (connection refused, timeout, server error), use GPT Researcher to find complete citations:

**Curl Command to Test API Availability**:
```bash
curl -s http://localhost:8001/health || echo "CourtListener API not available"
```

**If API is unavailable, use GPT Researcher**:

For each incomplete or unverified citation, run GPT Researcher to find complete citation information:

```bash
curl -s -X POST 'http://localhost:8000/api/v1/research' \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "Find the complete legal citation for the case: [CASE_NAME]. Include volume, reporter, page number, court, and year. Verify the citation is accurate and the case exists.",
    "research_mode": "quick",
    "report_format": "markdown",
    "max_iterations": 3
  }'
```

**GPT Researcher Output Location**:
- Outputs saved to: `/Users/ianbruce/Herd/gptr/gpt_researcher_api/outputs/research-[TASK_ID].md`
- Read the markdown file to extract complete citations
- Parse citations from research report and add to verification results

**Batch Multiple Citations**:
For efficiency, batch multiple citations into a single GPT Researcher query:

```bash
curl -s -X POST 'http://localhost:8000/api/v1/research' \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "Find complete legal citations for these cases: 1) [CASE_NAME_1], 2) [CASE_NAME_2], 3) [CASE_NAME_3]. For each case, provide: volume, reporter, page number, court, and year.",
    "research_mode": "quick",
    "report_format": "markdown",
    "max_iterations": 3
  }'
```

**Mark Fallback Method in Report**:
- Set `verification_method: "GPT_RESEARCHER_FALLBACK"` in JSON report
- Note in user-facing report: "Citations verified using GPT Researcher (CourtListener API unavailable)"
- Recommend manual verification via Westlaw/LexisNexis for high-stakes filings

**Advantages of GPT Researcher Fallback**:
- ✅ Finds complete citations even when CourtListener is down
- ✅ Can research multiple citations simultaneously
- ✅ Provides case summaries and legal principles
- ✅ Works for federal and state cases across all jurisdictions

**Limitations of GPT Researcher Fallback**:
- ⚠️ Cannot verify citation validity via authoritative database
- ⚠️ Requires manual verification for court filings
- ⚠️ Takes longer than CourtListener API (~2-3 minutes per batch)
- ⚠️ May not catch subtle citation errors (wrong page numbers, etc.)

STEP 4: HANDLE STATUTORY CITATIONS
- Flag statutory citations as 'STATUTE_SKIPPED'
- Note: CourtListener only verifies case law, not statutes
- Recommend manual verification for statutory citations

STEP 5: ANALYZE RESULTS

For AMBIGUOUS citations (300 status):
- Re-read draft document around citation location
- Look for contextual clues: jurisdiction mentioned, court name, date, case facts
- Example: If draft mentions 'Ninth Circuit', select match with court='ca9'
- If no context found, flag for human review with all matches listed

For NOT_FOUND citations (404 status):
- Check for common errors: future dates, typos, fabricated citations
- Suggest corrections based on similar case names or citation patterns
- Flag for human review with explanation

STEP 6: GENERATE VERIFICATION REPORT (JSON)

Save JSON report to: [OUTPUT_PATH]/citation_validity_YYYYMMDD_HHMMSS.json

Use this JSON schema (see protocol for complete schema)

STEP 7: GENERATE USER-FACING REPORT (Markdown)

Save Markdown report to: [CASE_FOLDER]/user_notification/citation_verification_summary.md

Include:
1. Summary statistics (total, valid, ambiguous, not found, statutes)
2. Valid citations (brief list with CourtListener URLs)
3. Issues requiring attention (detailed explanations)
4. Recommendations for corrections

STEP 8: REPORT COMPLETION

Print summary to console:
- Total citations found
- Valid count and percentage
- Issues requiring attention
- Path to JSON report
- Path to user-facing report

Document Path: [DOCUMENT_PATH]
Output Path: [OUTPUT_PATH]
Case Folder: [CASE_FOLDER]

REFERENCE DOCUMENTATION:
- CourtListener API Guide: confluence/docs/COURTLISTENER_API_GUIDE.md
- Citation Verification Protocol: .augment/protocols/CITATION_VERIFICATION.md

---

STAGE 2 (OPTIONAL): PROPOSITION VALIDATION

If user requests Stage 2 verification, continue with these additional steps:

STEP 9: FETCH OPINION TEXT (For each VALID citation from Stage 1)

For each citation with status='VALID', fetch the full opinion text from CourtListener:

**Curl Command**:
curl "http://localhost:8001/api/v1/opinions/{opinion_id}" -o /tmp/opinion_{citation_id}.txt

Extract the 'plain_text' field from JSON response and save to temporary file.

STEP 10: VERIFY PROPOSITION (GPT Researcher)

For each citation, verify that it supports the claimed proposition using GPT Researcher.

**Run GPT Researcher Script**:
python scripts/research_strategy.py \\
    --query \"PROPOSITION_VERIFICATION_QUERY\" \\
    --doc_path \"/tmp/opinion_{citation_id}.txt\" \\
    --output_path \"[CASE_FOLDER]/verification_reports/propositions/\" \\
    --mode \"single-agent\"

**Proposition Verification Query Template**:
\"Analyze the case opinion in the provided document and verify if it supports this proposition:

CASE: [CASE_NAME]
CITATION: [CITATION_TEXT]

PROPOSITION CLAIMED IN BRIEF:
[Extract the specific proposition/claim from the brief around this citation]

VERIFICATION TASKS:
1. Does the opinion contain this exact quote or similar language?
2. If yes, is it from the majority opinion, dissent, or concurrence?
3. Is this statement holding or dicta?
4. Is the case being cited in the correct legal context?
5. Are there any limitations, distinctions, or qualifications that should be noted?

Return ONLY valid JSON in this exact format (no markdown, no explanations):
{
  \\\"proposition_supported\\\": \\\"YES|NO|PARTIAL\\\",
  \\\"quote_found\\\": true|false,
  \\\"exact_quote\\\": \\\"exact text from opinion or null\\\",
  \\\"quote_location\\\": \\\"majority|dissent|concurrence|unclear\\\",
  \\\"legal_status\\\": \\\"HOLDING|DICTA|UNCLEAR\\\",
  \\\"context_appropriate\\\": true|false,
  \\\"limitations\\\": [\\\"list of any limitations or distinctions\\\"],
  \\\"recommendation\\\": \\\"KEEP|REVISE|REMOVE\\\",
  \\\"explanation\\\": \\\"brief explanation of findings\\\"
}\"

**Important Notes**:
- Extract the proposition from the brief text surrounding the citation
- Be specific about what legal principle the brief claims the case supports
- GPT Researcher will analyze the opinion text and return JSON verification results

STEP 11: READ VERIFICATION RESULTS

GPT Researcher saves output to:
[CASE_FOLDER]/verification_reports/propositions/report_YYYYMMDD_HHMMSS.json

Read the JSON output file and parse the verification results.

**Handle JSON Parsing**:
- GPT Researcher may wrap JSON in markdown code blocks
- Strip markdown wrapper: extract text between ```json and ```
- Parse JSON to get verification results

STEP 12: ANALYZE PROPOSITION VALIDATION RESULTS

For each citation, analyze the verification results:

**proposition_supported = \"YES\"**:
- Citation accurately represents the case
- No action needed
- Mark as VERIFIED in report

**proposition_supported = \"PARTIAL\"**:
- Citation needs clarification or qualification
- Add note about limitations or context
- Mark as NEEDS_CLARIFICATION in report

**proposition_supported = \"NO\"**:
- Citation misrepresents the case
- Flag for removal or revision
- Mark as MISREPRESENTATION in report

**quote_found = false** (when brief includes quote):
- Quote not found in opinion
- Possible fabrication or misquote
- Flag as CRITICAL issue

**legal_status = \"DICTA\"** (when brief treats as holding):
- Citation is dicta, not binding precedent
- Flag for user review
- May need to find stronger authority

STEP 13: GENERATE ENHANCED REPORT

Create enhanced user-facing report that includes both Stage 1 and Stage 2 results:

Save to: [CASE_FOLDER]/user_notification/citation_verification_summary_enhanced.md

**Report Sections**:
1. Summary statistics (Stage 1 + Stage 2)
2. Valid and verified citations (passed both stages)
3. Citations needing revision (partial support, dicta, limitations)
4. Citations requiring removal (misrepresentations, fabrications)
5. Recommendations and action items

See 'Enhanced Report Template' section below for complete format.

STEP 14: REPORT COMPLETION

Print enhanced summary to console:
- Total citations verified (Stage 1)
- Total propositions validated (Stage 2)
- Verified citations count
- Citations needing revision count
- Citations requiring removal count
- Path to enhanced report

Document Path: [DOCUMENT_PATH]
Stage 1 Output: [OUTPUT_PATH]/citation_validity_YYYYMMDD_HHMMSS.json
Stage 2 Output: [CASE_FOLDER]/verification_reports/propositions/
Enhanced Report: [CASE_FOLDER]/user_notification/citation_verification_summary_enhanced.md
"
```

### Template Variables to Replace

When invoking Auggie, the primary agent must replace these variables:

- `[DOCUMENT_PATH]` → Full path to HTML or Markdown draft (e.g., `firms/justicequest_llp/cases/20251028_143022_case_name/step_3_active_drafts/motion_001/html_preview/motion-preview.html`)
- `[OUTPUT_PATH]` → Path to verification reports folder (e.g., `firms/justicequest_llp/cases/20251028_143022_case_name/verification_reports/citations/`)
- `[CASE_FOLDER]` → Root case folder path (e.g., `firms/justicequest_llp/cases/20251028_143022_case_name/`)

---

## Reference Documentation for Sub-Agent

**IMPORTANT**: For complete CourtListener API documentation, see `confluence/docs/COURTLISTENER_API_GUIDE.md` (lines 114-144)

### Quick API Reference

**Endpoint**: `POST http://localhost:8001/api/v1/citation-lookup/`
**Rate Limit**: 60 citations/min (sleep 1 second between calls)
**Content-Type**: `application/x-www-form-urlencoded`

**Curl Template**:
```bash
curl -X POST 'http://localhost:8001/api/v1/citation-lookup/' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'text=CITATION_TEXT_HERE'
```

### Response Status Codes

**200 (VALID)**: Citation found - extract cluster_id, opinion_id, absolute_url, case_name, court, date_filed

**300 (AMBIGUOUS)**: Multiple matches - extract all, analyze draft context to disambiguate (e.g., "Ninth Circuit" → court="ca9")

**404 (NOT_FOUND)**: Not found - try format variations (add/remove periods/spaces), check for errors (future dates, typos, fabrications)

**400 (INVALID_FORMAT)**: Invalid format - flag, do not retry

### Format Variations for 404 Responses

Try 2-3 variations, then flag for human review:
1. Add periods: `576 US 644` → `576 U.S. 644`
2. Remove commas: `Obergefell v. Hodges, 576 U.S. 644` → `Obergefell v. Hodges 576 U.S. 644`
3. Just reporter: `Obergefell v. Hodges, 576 U.S. 644` → `576 U.S. 644`

---

### JSON Report Schema (Auggie Must Generate)

**JSON Report Location:**

`[OUTPUT_PATH]/citation_validity_YYYYMMDD_HHMMSS.json`

**JSON Schema:**

```json
{
  "document_path": "path/to/draft.html",
  "timestamp": "2025-10-28T14:30:22Z",
  "total_citations": 10,
  "extracted_citations": [
    {
      "id": 1,
      "text": "Brown v. Board of Education, 347 U.S. 483 (1954)",
      "location": "line 45, paragraph 3",
      "type": "case_law"
    }
  ],
  "verification_results": [
    {
      "citation_id": 1,
      "status": "VALID",
      "cluster_id": 112,
      "opinion_id": 456,
      "courtlistener_url": "https://www.courtlistener.com/opinion/112/456/"
    },
    {
      "citation_id": 3,
      "status": "AMBIGUOUS",
      "matches": [
        {
          "cluster_id": 12345,
          "case_name": "Smith v. Jones",
          "court": "ca9",
          "date_filed": "2007-08-15"
        },
        {
          "cluster_id": 67890,
          "case_name": "Smith v. Jones",
          "court": "ca2",
          "date_filed": "2007-08-20"
        }
      ]
    },
    {
      "citation_id": 10,
      "status": "NOT_FOUND",
      "attempts": 4,
      "tried_formats": [
        "Fake v. Case, 999 F.3d 999 (9th Cir. 2025)",
        "Fake v. Case, 999 F. 3d 999"
      ]
    }
  ],
  "summary": {
    "valid": 7,
    "ambiguous": 2,
    "not_found": 1
  }
}
```

---

### How to Interpret Verification Statuses

**VALID** (status: "VALID"):

- Citation found in CourtListener database
- Case name, reporter, and page number verified
- CourtListener cluster_id and opinion_id provided
- **Action**: No action needed, citation is correct

**AMBIGUOUS** (status: "AMBIGUOUS"):

- Multiple cases match the citation
- Requires contextual disambiguation
- **Action**: Analyze draft document for clues (jurisdiction, date, court mentioned)
- **Example**: Draft mentions "Ninth Circuit" → select match with court="ca9"

**NOT_FOUND** (status: "NOT_FOUND"):

- Citation not found in CourtListener after multiple format attempts
- Likely invalid, fabricated, or unpublished opinion
- **Action**: Flag for human review, suggest manual verification

**STATUTE_SKIPPED** (status: "STATUTE_SKIPPED"):

- Statutory citation detected but not verified (CourtListener is case law only)
- **Action**: Flag statutory citations for manual verification

---

### Additional CourtListener API Information

For complete CourtListener API documentation, see: `confluence/docs/COURTLISTENER_API_GUIDE.md`

**Other Useful Endpoints** (for future enhancements):

- `/api/v1/opinions/{opinion_id}` - Fetch full opinion text (for proposition validation)
- `/api/v1/clusters/{cluster_id}` - Get case cluster metadata
- `/api/v1/search` - Search for cases by name or other criteria

**Rate Limits**:

- 5,000 queries/hour (general API limit)
- 60 valid citations/minute (citation-lookup endpoint)

**Important**: Always sleep 1 second between API calls to respect rate limits

---

## Output Requirements

### JSON Report (Machine-Readable)

**Location:** `[CASE_FOLDER]/verification_reports/citations/citation_validity_YYYYMMDD_HHMMSS.json`

**Purpose:** Programmatic processing, audit trail, reproducibility

**Contents:** Complete verification results including all citations, statuses, CourtListener IDs, and metadata

---

### Markdown Report (User-Facing)

**Stage 1 Only Location:** `[CASE_FOLDER]/user_notification/citation_verification_summary.md`

**Stage 1 + Stage 2 Location:** `[CASE_FOLDER]/user_notification/citation_verification_summary_enhanced.md`

**Purpose:** Human-readable summary for attorney review

**Required Sections (Stage 1 Only)**:

1. **Summary Statistics**:

   - Total citations found
   - Valid citations count and percentage
   - Issues requiring attention (ambiguous, not found)
2. **Valid Citations** (brief list):

   - Citation text
   - CourtListener URL for verification
3. **Issues Requiring Attention** (detailed):

   - **Ambiguous Citations**: List all matches, provide disambiguation recommendation
   - **Not Found Citations**: Explain likely cause, suggest corrections or manual verification
4. **Recommendations**:

   - Specific actions needed (correct citation, verify manually, disambiguate)
   - Priority level (critical, review, informational)

---

### Enhanced Report Template (Stage 1 + Stage 2)

**Location:** `[CASE_FOLDER]/user_notification/citation_verification_summary_enhanced.md`

**Purpose:** Comprehensive verification report including proposition validation

**Required Sections**:

1. **Executive Summary**:
   - Total citations verified (Stage 1)
   - Total propositions validated (Stage 2)
   - Overall accuracy assessment
   - Critical issues requiring immediate attention

2. **Verified Citations** (✅ Passed both stages):
   - Citation text with CourtListener URL
   - Proposition verified as accurate
   - Legal status (holding/dicta)
   - No action needed

3. **Citations Needing Revision** (⚠️ Partial support or limitations):
   - Citation text
   - Issue identified (partial support, dicta, limitations)
   - Specific recommendation for revision
   - Suggested qualification or clarification

4. **Citations Requiring Removal** (❌ Misrepresentations or fabrications):
   - Citation text
   - Critical issue (misrepresentation, fabricated quote, not found)
   - Explanation of problem
   - Recommendation to remove or find alternative authority

5. **Statutory Citations** (📋 Manual verification required):
   - List of statutory citations
   - Note that CourtListener doesn't verify statutes
   - Recommendation for manual verification

6. **Action Items Summary**:
   - Priority 1 (Critical): Citations requiring immediate removal
   - Priority 2 (High): Citations needing revision or clarification
   - Priority 3 (Medium): Citations needing manual verification
   - Priority 4 (Low): Informational notes

**Example Enhanced Report**:

```markdown
# Citation Verification Report (Enhanced)

**Date**: 2025-10-28 16:45:00
**Draft**: reply_brief_motion_lift_stay.html
**Verification**: Stage 1 (Validity) + Stage 2 (Proposition Validation)

## Executive Summary

- **Total Citations**: 11
- **Stage 1 (Validity)**: 8 case law verified, 3 statutory flagged
- **Stage 2 (Propositions)**: 8 propositions validated
- **Overall Accuracy**: 62.5% (5/8 fully verified, 2/8 need revision, 1/8 requires removal)
- **Critical Issues**: 1 citation requires immediate removal (misrepresentation)

## ✅ Verified Citations (5)

### 1. Bridges v. Bridges, 256 Ga. 348, 349 S.E.2d 172 (1986)
- **Status**: VERIFIED
- **Proposition**: "Arbitration agreements are enforceable contracts"
- **Finding**: Proposition accurately stated in majority opinion (page 350)
- **Legal Status**: HOLDING
- **CourtListener**: [View Case](https://www.courtlistener.com/...)
- **Action**: None - citation is accurate

### 2. Hernandez v. Acosta Tractors, Inc., 898 F.3d 1301 (11th Cir. 2018)
- **Status**: VERIFIED
- **Proposition**: "Calculated choice to abandon arbitration after adverse rulings constitutes forum shopping"
- **Finding**: Exact quote found in majority opinion (page 1305)
- **Legal Status**: HOLDING
- **CourtListener**: [View Case](https://www.courtlistener.com/...)
- **Action**: None - citation is accurate

[... 3 more verified citations ...]

## ⚠️ Citations Needing Revision (2)

### 6. Johnson v. DeKalb County, 314 Ga. App. 790, 726 S.E.2d 102 (2012)
- **Status**: NEEDS CLARIFICATION
- **Proposition**: "Courts have discretion to deny arbitration motions"
- **Issue**: Statement is DICTA, not holding
- **Finding**: Quote found in concurring opinion, not majority
- **Recommendation**: REVISE - Add qualifier: "As noted in the concurrence..." or find stronger authority
- **CourtListener**: [View Case](https://www.courtlistener.com/...)

### 7. Bishop v. Ross Earle & Bonan, P.A., 817 F.3d 1268 (11th Cir. 2016)
- **Status**: PARTIAL SUPPORT
- **Proposition**: "FDCPA applies to all debt collection activities"
- **Issue**: Case has important limitation not mentioned in brief
- **Finding**: Holding applies only to attorneys acting as debt collectors
- **Limitation**: "Only when attorney is acting primarily as debt collector, not in traditional legal representation"
- **Recommendation**: REVISE - Add limitation or find broader authority
- **CourtListener**: [View Case](https://www.courtlistener.com/...)

## ❌ Citations Requiring Removal (1)

### 8. Bedgood v. Wyndham, 88 F.4th 1355 (11th Cir. 2023)
- **Status**: CRITICAL - MISREPRESENTATION
- **Issue**: Citation not found in CourtListener database
- **Attempted Verification**: Tried multiple format variations, searched by case name
- **Likely Cause**: Incorrect citation or fabricated case
- **Recommendation**: REMOVE immediately or verify with original source (PACER, Westlaw, Lexis)
- **Priority**: CRITICAL - Do not file brief with this citation

## 📋 Statutory Citations (3)

The following statutory citations were flagged for manual verification (CourtListener only verifies case law):

1. 15 U.S.C. § 1692e - Fair Debt Collection Practices Act
2. 9 U.S.C. § 4 - Federal Arbitration Act
3. O.C.G.A. § 13-3-2 - Georgia Arbitration Code

**Recommendation**: Verify statutory citations with official sources (U.S. Code, Georgia Code)

## Action Items Summary

### Priority 1: CRITICAL (Must address before filing)
- [ ] **Remove or verify**: Bedgood v. Wyndham citation (not found in database)

### Priority 2: HIGH (Should address before filing)
- [ ] **Revise**: Johnson v. DeKalb County (dicta, not holding)
- [ ] **Add limitation**: Bishop v. Ross Earle (important qualification missing)

### Priority 3: MEDIUM (Recommended)
- [ ] **Verify statutes**: Manually verify 3 statutory citations

### Priority 4: LOW (Informational)
- [x] 5 citations fully verified and accurate

## Recommendations Before Filing

1. **Immediate**: Remove or verify Bedgood citation (CRITICAL)
2. **Before filing**: Revise Johnson and Bishop citations (HIGH priority)
3. **Best practice**: Manually verify statutory citations
4. **Consider**: Re-run Stage 2 verification after revisions to confirm accuracy

## Methodology

**Stage 1**: Citation validity verified via CourtListener API
**Stage 2**: Propositions validated via GPT Researcher analysis of full opinion text
**Limitations**: Statutory citations not verified (manual verification required)

---

**Report Generated**: 2025-10-28 16:45:00
**Verification Protocol**: .augment/protocols/CITATION_VERIFICATION.md
```

**Template Example:**

```markdown
# Citation Verification Report

**Date**: 2025-10-28 14:30:22  
**Draft**: motion_001.html  
**Total Citations**: 10

## Summary
- ✅ **8 Valid** (80%)
- ⚠️ **1 Requires Review** (10%)
- ❌ **1 Invalid** (10%)

## Valid Citations

1. Brown v. Board of Education, 347 U.S. 483 (1954) - [View on CourtListener](https://...)
2. Obergefell v. Hodges, 576 U.S. 644 (2015) - [View on CourtListener](https://...)
...

## Issues Requiring Attention

### Citation 9: Ambiguous Match ⚠️

**Citation**: Smith v. Jones, 500 F.3d 100

**Issue**: Multiple cases match this citation

**Matches**:
- Smith v. Jones, 500 F.3d 100 (9th Cir. 2007) - [View](https://...)
- Smith v. Jones, 500 F.3d 100 (2nd Cir. 2007) - [View](https://...)

**Recommendation**: Draft mentions "Ninth Circuit" on line 45. Likely intended citation is 9th Cir. case. Please confirm.

---

### Citation 10: Not Found ❌

**Citation**: Fake v. Case, 999 F.3d 999 (9th Cir. 2025)

**Issue**: Citation not found in CourtListener database

**Likely Cause**: Future date (2025) suggests this may be a fabricated citation

**Action Required**: Verify this citation with original source or remove from draft.
```

---

## Human-in-the-Loop Gates

**Mandatory Human Review Required:**

1. **Ambiguous Citations (300 status)**:

   - If sub-agent cannot disambiguate from context
   - User must select correct case from matches
2. **Not Found Citations (404 status)**:

   - All citations not found after script exhausts format variations
   - User must verify manually or correct citation
3. **Statutory Citations**:

   - Script flags but does not verify (CourtListener limitation)
   - User must verify statutory citations manually

**Optional Human Review:**

- Spot-check at least 2 valid citations per document section
- Review CourtListener records to confirm case relevance
- Verify proposition support (does case actually say what draft claims?)

---

## Integration with Step 3 Drafting Workflow

**After Draft Creation/Completion:**

1. Primary agent detects citations in draft (scan for citation patterns)
2. Primary agent prompts user:
   ```
   "I found [N] citations in this draft. Would you like me to verify them now?

   - Citation validity check (CourtListener API) - ~30 seconds
   - Proposition validation (optional, high-stakes only) - ~5 minutes

   Proceed with citation verification? (yes/no)"
   ```
3. If user confirms, primary agent invokes Augie sub-agent with document path
4. Augie executes verification workflow and generates reports
5. Primary agent presents user-facing report to user
6. User reviews issues and confirms corrections

**Mandatory Before Finalizing:**

- Before marking draft as "final" or "ready to file"
- Citation verification must complete with zero unresolved issues
- Block finalization if ambiguous or not found citations exist

---

## Error Handling

**CourtListener API Unavailable:**

- Script retries with exponential backoff (3 attempts)
- If still unavailable, save partial results and notify user
- Offer to retry later or proceed with manual verification

**Script Timeout/Failure:**

- Set timeout: 60 seconds for typical verification
- If timeout, save partial results and flag incomplete citations
- Offer to retry failed citations individually

**Citation Cannot Be Resolved:**

- After 3-4 retry attempts with alternative formats, flag for human review
- Provide user with:
  - Original citation text from draft
  - Attempted formats tried
  - Recommendation to verify manually or correct citation

---

## Quality Thresholds

**Citation Accuracy Targets:**

- Citation validity > 99% (formal validity + correct case retrieved)
- Time to validate 10 citations < 30 seconds (batch lookup)
- Zero silent failures (any uncertainty must surface explicit flag)

**Escalation Triggers:**

- Any citation with 404/300 status → human review
- > 10% of citations flagged → review draft quality
  >
- Repeated failures for same citation format → investigate script logic

---

## Related Documentation

- **CourtListener API Guide**: `confluence/docs/COURTLISTENER_API_GUIDE.md`
- **Accuracy Layer Framework**: `confluence/docs/ACCURACY_LAYER_FRAMEWORK.md`
- **Document Verification Protocol**: `.augment/protocols/DOCUMENT_VERIFICATION.md`
- **Step 3 Drafting Workflow**: `workflows/step_3_drafting_workflow.md`
