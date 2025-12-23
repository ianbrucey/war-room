/**
 * HTML generation utilities for draft documents
 */

import type { DraftDocument, DraftBlock, DraftSignatureBlock } from './types';

/** Escape HTML special characters */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Generate body HTML from draft blocks */
function generateBodyHtml(blocks: DraftBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case 'section_heading':
          return `<div class="section-header">${escapeHtml(block.content)}</div>`;
        case 'numbered_paragraph':
          return `<p class="numbered" data-block-id="${block.id}">${escapeHtml(block.content)}</p>`;
        case 'unnumbered_paragraph':
          return `<p data-block-id="${block.id}">${escapeHtml(block.content)}</p>`;
        case 'block_quote':
          return `<blockquote data-block-id="${block.id}">${escapeHtml(block.content)}</blockquote>`;
        default:
          return `<p>${escapeHtml(block.content)}</p>`;
      }
    })
    .join('\n');
}

/** Generate signature block HTML */
function generateSignatureHtml(sig?: DraftSignatureBlock): string {
  if (!sig) return '';
  const addr = escapeHtml(sig.address || '').replace(/\n/g, '<br>');
  return `
    <div class="signature-block">
      <p>Respectfully submitted this ${escapeHtml(sig.respectfully_submitted_date || '[DATE]')}.</p>
      <p style="margin-top: 2em;">/s/ ${escapeHtml(sig.attorney_name || '[ATTORNEY NAME]')}</p>
      <p>
        <strong>${escapeHtml(sig.attorney_name || '')}</strong>
        ${sig.bar_number ? `<br>${escapeHtml(sig.bar_number)}` : ''}
        ${sig.firm_name ? `<br>${escapeHtml(sig.firm_name)}` : ''}<br>
        ${addr}<br>
        ${sig.phone ? `Tel: ${escapeHtml(sig.phone)}<br>` : ''}
        ${sig.email ? `Email: ${escapeHtml(sig.email)}<br>` : ''}
        ${sig.representing ? `<br><em>Attorney for ${escapeHtml(sig.representing)}</em>` : ''}
      </p>
    </div>`;
}

/** Generate complete court-formatted HTML from draft */
export function generateDraftHtml(draft: DraftDocument): string {
  const c = draft.caption;
  const bodyHtml = generateBodyHtml(draft.body);
  const sigHtml = generateSignatureHtml(draft.signature_block);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(c.document_title || 'Draft')}</title>
<style>
body {
  font-family: "Times New Roman", serif;
  font-size: 14pt;
  line-height: 2.0;
  margin: 0;
  padding: 0;
  color: black;
  background: #f5f5f5;
  counter-reset: para;
}
.document {
  max-width: 8.5in;
  margin: 20px auto;
  padding: 1in;
  background: white;
  border: 1px solid #d3d3d3;
  box-shadow: 3px 3px 20px rgba(0,0,0,0.1);
  overflow-wrap: break-word;
}
.court-caption {
  text-align: center;
  font-weight: bold;
  margin-bottom: 2em;
}
.case-caption {
  width: 100%;
  margin-bottom: 2em;
  border-collapse: collapse;
}
.case-caption td {
  vertical-align: top;
  padding: 0.5em;
}
.case-left { width: 50%; }
.case-right {
  width: 50%;
  text-align: center;
  border-left: 1px solid black;
  padding-left: 1em;
}
.motion-title {
  text-align: center;
  font-weight: bold;
  margin: 2em 0;
  text-decoration: underline;
}
.section-header {
  font-weight: bold;
  margin: 1.5em 0 1em 0;
  text-align: center;
  text-decoration: underline;
}
p {
  margin: 1em 0;
  text-align: justify;
}
p.numbered::before {
  counter-increment: para;
  content: counter(para) ". ";
  font-weight: bold;
}
p.numbered:hover {
  background-color: #fffacd;
  cursor: pointer;
}
blockquote {
  margin: 1em 2em;
  padding: 0.5em 1em;
  border-left: 3px solid #ccc;
  font-style: italic;
}
.signature-block {
  margin-top: 3em;
  text-align: left;
}
</style>
</head>
<body>
<div class="document">
  <div class="court-caption">
    ${escapeHtml(c.court_name || '')}${c.court_division ? `<br>${escapeHtml(c.court_division)}` : ''}
  </div>

  <table class="case-caption">
    <tr>
      <td class="case-left">
        ${escapeHtml(c.plaintiff || '[PLAINTIFF]')},<br><br>
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Plaintiff,<br><br>
        v.<br><br>
        ${escapeHtml(c.defendant || '[DEFENDANT]')},<br><br>
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Defendant.
      </td>
      <td class="case-right">
        <br><br><br><br>
        Civil Action File No.<br>
        ${escapeHtml(c.case_number || '[CASE NUMBER]')}
      </td>
    </tr>
  </table>

  <div class="motion-title">
    ${escapeHtml(c.document_title || 'LEGAL DOCUMENT')}
  </div>

  ${bodyHtml}

  ${sigHtml}
</div>
</body>
</html>`;
}
