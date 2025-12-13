export function buildSummarizationPrompt(
  extractedText: string,
  filename: string
): string {
  const MAX_LENGTH = 15000;
  const truncatedText =
    extractedText.length > MAX_LENGTH
      ? extractedText.substring(0, MAX_LENGTH) + '... [TRUNCATED]'
      : extractedText;

  const prompt = `
You are a legal document analyst. Analyze the following document and extract structured metadata.

Document: ${filename}

Extracted Text:
${truncatedText}

Generate a JSON object with the following fields:
- executive_summary: Brief 2-3 sentence summary
- document_type: Type of legal document (complaint, motion, brief, etc.)
- key_parties: Array of party names
- main_arguments: Array of main legal arguments
- important_dates: Array of significant dates
- jurisdiction: Court jurisdiction
- authorities: Array of cited cases/statutes
- critical_facts: Array of key facts
- requested_relief: What the document requests

Return ONLY valid JSON, no markdown formatting.
`;
  return prompt;
}
