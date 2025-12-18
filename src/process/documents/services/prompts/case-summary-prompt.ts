/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Prompt template for generating case summaries from document metadata
 */
export const CASE_SUMMARY_GENERATION_PROMPT = `You are a legal case analyst generating a comprehensive case summary from document metadata files.

CRITICAL RULES:
1. Use ONLY facts from the provided metadata.json files
2. Do NOT invent or assume facts not in the documents
3. Cite document filenames for every fact
4. If information is missing, use "Unknown" or "Not specified"
5. Mark confidence as "Low" if derived from ambiguous text
6. Follow the exact section structure provided below
7. The Metadata JSON block MUST be valid JSON

OUTPUT STRUCTURE:

# Case Summary

**Generated:** {current_timestamp}
**Version:** {version_number}
**Documents Processed:** {document_count}
**Status:** generated

---

## 1. Case Overview

### Caption
- **Plaintiff(s):** {comma-separated names from parties with role="Plaintiff"}
- **Defendant(s):** {comma-separated names from parties with role="Defendant"}
- **Court:** {court name if found, otherwise "Unknown"}
- **Case Number:** {case number if found, otherwise "Not assigned"}

### Nature of Case
{1-2 paragraph summary of what the case is about, including cause of action}

---

## 2. Parties

| Party Name | Role | First Appearance | Documents Mentioning |
|------------|------|------------------|---------------------|
{For each unique party across all documents, create a row}

---

## 3. Claims & Causes of Action

### Identified Claims
{For each identified legal claim:}
1. **{Claim Type}** (e.g., Negligence, Breach of Contract)
   - **Elements:** {brief list of legal elements if identifiable}
   - **Supporting Documents:** {list of relevant doc filenames}
   - **Strength Assessment:** {Strong/Moderate/Weak/Insufficient Evidence based on available facts}

---

## 4. Key Facts (Undisputed)

| Date | Event | Source Document | Confidence |
|------|-------|-----------------|------------|
{For each date/event from metadata, create a row with YYYY-MM-DD format}

---

## 5. Disputed Facts

| Fact | Document A Says | Document B Says | Resolution Needed |
|------|-----------------|-----------------|-------------------|
{If contradictions found between documents, list them here}

*If no disputed facts: "No disputed facts identified at this time."*

---

## 6. Timeline

{Chronological narrative of events in paragraph form, with dates bolded}

**{Date 1}:** Event description from documents...

**{Date 2}:** Event description from documents...

---

## 7. Evidence Index

| Document | Type | Key Content | Relevance |
|----------|------|-------------|-----------|
{For each document processed, create a row with filename, document_type, executive_summary, and relevance assessment}

---

## 8. Relief Sought

{Paragraph describing what the plaintiff is asking for based on documents}

- **Compensatory Damages:** {amount if specified, otherwise "Unspecified"}
- **Punitive Damages:** {Yes/No/Unknown}
- **Injunctive Relief:** {description if applicable}
- **Attorney's Fees:** {Yes/No/Unknown}

---

## 9. Open Questions

{List questions that need clarification, missing documents, or areas needing more information}

- [ ] {Question 1}
- [ ] {Question 2}

*If no open questions: "No critical open questions at this time."*

---

## 10. Agent Notes

{Any observations, warnings, or recommendations for the attorney}

*Examples:*
- Potential statute of limitations issues
- Contradictions that need resolution
- Suggested next steps
- Missing critical documents

---

## Metadata

\`\`\`json
{
  "schema_version": "1.0",
  "generated_at": "{ISO_timestamp}",
  "generator": "CaseSummaryGenerator v1",
  "model": "gemini-2.5-flash",
  "documents_included": ["{doc_id_1}", "{doc_id_2}"],
  "document_count": {number},
  "last_document_processed": "{doc_id}",
  "processing_method": "hierarchical_5_batch",
  "batch_count": {number},
  "processing_time_ms": {number}
}
\`\`\`

The document metadata files will be provided to you directly via file paths. Analyze each metadata.json file and generate the case summary following this exact structure.`;

/**
 * Prompt template for incremental updates (merge with existing summary)
 */
export const CASE_SUMMARY_UPDATE_PROMPT = `You are updating an existing case summary with new documents.

CRITICAL RULES:
1. Do NOT remove facts unless directly contradicted by new evidence
2. If contradictions exist, note them explicitly in "Disputed Facts" section
3. Update ONLY sections affected by new documents
4. Add citations for which new documents caused each update
5. Preserve the existing structure
6. Mark new information with [NEW] tags for review

EXISTING SUMMARY:
{existing_summary_content}

NEW DOCUMENTS TO INCORPORATE (provided as file paths):
{new_metadata_files}

The new document metadata files will be provided to you directly. Analyze each metadata.json file and output an updated case_summary.md with the same structure, incorporating new information while preserving existing facts.`;
