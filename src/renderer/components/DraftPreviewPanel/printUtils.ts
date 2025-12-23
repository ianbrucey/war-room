/**
 * Print and PDF export utilities for legal drafts
 */

import type { DraftBlock, DraftDocument } from './types';

/**
 * Generate the CSS styles for the printed document
 */
const getPrintStyles = (): string => `
  @page {
    size: Letter;
    margin: 1in;
  }
  body {
    font-family: "Times New Roman", serif;
    font-size: 14pt;
    line-height: 2.0;
    color: black;
    background: white;
    margin: 0;
    padding: 0;
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
  p.numbered .para-num {
    font-weight: bold;
  }
  p.list-item {
    margin-left: 2em;
    text-indent: -1.5em;
    padding-left: 1.5em;
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
`;

/**
 * Compute paragraph number for a block
 */
const getParagraphNumber = (body: DraftBlock[], blockId: string): number => {
  let num = 0;
  for (const block of body) {
    if (block.type === 'numbered_paragraph') num++;
    if (block.id === blockId) return num;
  }
  return 0;
};

/**
 * Compute list item label (a, b, c or i, ii, iii)
 */
const getListItemLabel = (body: DraftBlock[], blockId: string, style: DraftBlock['list_style']): string => {
  let count = 0;
  for (const block of body) {
    if (block.type === 'list_item' && block.list_style === style) {
      count++;
      if (block.id === blockId) break;
    } else if (block.type !== 'list_item') {
      count = 0;
    }
  }

  if (style === 'roman') {
    const romanNumerals = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii'];
    return `(${romanNumerals[count - 1] || count})`;
  } else if (style === 'bullet') {
    return '•';
  } else {
    return `(${String.fromCharCode(96 + count)})`;
  }
};

/**
 * Render a draft document to a complete HTML string for printing
 */
/**
 * Print the draft document using a hidden iframe
 */
export const printDraft = (draft: DraftDocument): void => {
  const html = renderDraftToHtml(draft);

  // Create a hidden iframe for printing
  const iframe = document.createElement('iframe');
  iframe.style.position = 'absolute';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  iframe.style.left = '-9999px';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    console.error('Failed to access iframe document');
    document.body.removeChild(iframe);
    return;
  }

  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  // Wait for content to load, then print
  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.print();
      // Remove iframe after a delay to allow print dialog to complete
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 250);
  };

  // Trigger load event manually for already-loaded content
  if (iframeDoc.readyState === 'complete') {
    iframe.onload?.(new Event('load'));
  }
};

/**
 * Render just the body content (without html/head wrapper) for PDF export
 */
const renderDraftBodyForPdf = (draft: DraftDocument): string => {
  const c = draft.caption;

  // Build body HTML
  const bodyHtml = draft.body.map((block) => {
    if (block.type === 'section_heading') {
      return `<div class="section-header">${block.content}</div>`;
    }
    if (block.type === 'numbered_paragraph') {
      const num = getParagraphNumber(draft.body, block.id);
      return `<p class="numbered"><span class="para-num">${num}.</span> ${block.content}</p>`;
    }
    if (block.type === 'list_item') {
      const label = getListItemLabel(draft.body, block.id, block.list_style || 'letter');
      return `<p class="list-item"><span class="list-label">${label}</span> ${block.content}</p>`;
    }
    if (block.type === 'block_quote') {
      return `<blockquote>${block.content}</blockquote>`;
    }
    return `<p>${block.content}</p>`;
  }).join('\n');

  // Build signature block HTML
  let signatureHtml = '';
  if (draft.signature_block) {
    const s = draft.signature_block;
    signatureHtml = `
      <div class="signature-block">
        <p>Respectfully submitted this ${s.respectfully_submitted_date || '[DATE]'}.</p>
        <p style="margin-top: 2em">/s/ ${s.attorney_name || '[ATTORNEY NAME]'}</p>
        <p>
          <strong>${s.attorney_name || ''}</strong>
          ${s.bar_number ? `<br/>${s.bar_number}` : ''}
          ${s.firm_name ? `<br/>${s.firm_name}` : ''}
          <br/>${s.address || ''}
          ${s.phone ? `<br/>Tel: ${s.phone}` : ''}
          ${s.email ? `<br/>Email: ${s.email}` : ''}
          ${s.representing ? `<br/><em>Attorney for ${s.representing}</em>` : ''}
        </p>
      </div>
    `;
  }

  return `
    <div class="court-caption">
      ${c.court_name || ''}
      ${c.court_division ? `<br/>${c.court_division}` : ''}
    </div>
    <table class="case-caption">
      <tbody>
        <tr>
          <td class="case-left">
            ${c.plaintiff || '[PLAINTIFF]'},<br/><br/>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Plaintiff,<br/><br/>
            v.<br/><br/>
            ${c.defendant || '[DEFENDANT]'},<br/><br/>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Defendant.
          </td>
          <td class="case-right">
            <br/><br/><br/><br/>
            Civil Action File No.<br/>
            ${c.case_number || '[CASE NUMBER]'}
          </td>
        </tr>
      </tbody>
    </table>
    <div class="motion-title">${c.document_title || 'LEGAL DOCUMENT'}</div>
    ${bodyHtml}
    ${signatureHtml}
  `;
};

/**
 * Export the draft document to PDF
 */
export const exportDraftToPdf = async (draft: DraftDocument, filename: string): Promise<void> => {
  // Dynamic import to avoid bundling issues
  const html2pdf = (await import('html2pdf.js')).default;

  // Create a container with inline styles (since we can't use <style> tag)
  const container = document.createElement('div');
  container.style.cssText = `
    font-family: "Times New Roman", serif;
    font-size: 14pt;
    line-height: 2.0;
    color: black;
    background: white;
    width: 8.5in;
    padding: 0;
  `;

  // Add the body content
  container.innerHTML = renderDraftBodyForPdf(draft);

  // Apply inline styles to elements (html2pdf works better with inline styles)
  const courtCaption = container.querySelector('.court-caption') as HTMLElement;
  if (courtCaption) {
    courtCaption.style.cssText = 'text-align: center; font-weight: bold; margin-bottom: 2em;';
  }

  const caseCaption = container.querySelector('.case-caption') as HTMLElement;
  if (caseCaption) {
    caseCaption.style.cssText = 'width: 100%; margin-bottom: 2em; border-collapse: collapse;';
  }

  container.querySelectorAll('.case-left').forEach((el) => {
    (el as HTMLElement).style.cssText = 'width: 50%; vertical-align: top; padding: 0.5em;';
  });

  container.querySelectorAll('.case-right').forEach((el) => {
    (el as HTMLElement).style.cssText = 'width: 50%; text-align: center; border-left: 1px solid black; padding-left: 1em; vertical-align: top; padding: 0.5em;';
  });

  const motionTitle = container.querySelector('.motion-title') as HTMLElement;
  if (motionTitle) {
    motionTitle.style.cssText = 'text-align: center; font-weight: bold; margin: 2em 0; text-decoration: underline;';
  }

  container.querySelectorAll('.section-header').forEach((el) => {
    (el as HTMLElement).style.cssText = 'font-weight: bold; margin: 1.5em 0 1em 0; text-align: center; text-decoration: underline;';
  });

  container.querySelectorAll('p').forEach((el) => {
    el.style.cssText = 'margin: 1em 0; text-align: justify;';
  });

  container.querySelectorAll('.para-num').forEach((el) => {
    (el as HTMLElement).style.cssText = 'font-weight: bold;';
  });

  container.querySelectorAll('p.list-item').forEach((el) => {
    (el as HTMLElement).style.cssText = 'margin: 1em 0; text-align: justify; margin-left: 2em; text-indent: -1.5em; padding-left: 1.5em;';
  });

  container.querySelectorAll('blockquote').forEach((el) => {
    (el as HTMLElement).style.cssText = 'margin: 1em 2em; padding: 0.5em 1em; border-left: 3px solid #ccc; font-style: italic;';
  });

  const signatureBlock = container.querySelector('.signature-block') as HTMLElement;
  if (signatureBlock) {
    signatureBlock.style.cssText = 'margin-top: 3em; text-align: left;';
  }

  // Position off-screen but visible for html2canvas
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  document.body.appendChild(container);

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options: any = {
      margin: [0.75, 0.75, 0.75, 0.75], // inches - slightly larger margins
      filename: filename.endsWith('.pdf') ? filename : `${filename}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        windowWidth: 816, // 8.5 inches at 96 DPI
      },
      jsPDF: {
        unit: 'in',
        format: 'letter',
        orientation: 'portrait'
      },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    await html2pdf()
      .set(options)
      .from(container)
      .save();
  } finally {
    document.body.removeChild(container);
  }
};

/**
 * Render a draft document to a complete HTML string for printing
 */
export const renderDraftToHtml = (draft: DraftDocument): string => {
  const c = draft.caption;
  
  // Build body HTML
  const bodyHtml = draft.body.map((block) => {
    if (block.type === 'section_heading') {
      return `<div class="section-header">${block.content}</div>`;
    }
    if (block.type === 'numbered_paragraph') {
      const num = getParagraphNumber(draft.body, block.id);
      return `<p class="numbered"><span class="para-num">${num}.</span> ${block.content}</p>`;
    }
    if (block.type === 'list_item') {
      const label = getListItemLabel(draft.body, block.id, block.list_style || 'letter');
      return `<p class="list-item"><span class="list-label">${label}</span> ${block.content}</p>`;
    }
    if (block.type === 'block_quote') {
      return `<blockquote>${block.content}</blockquote>`;
    }
    return `<p>${block.content}</p>`;
  }).join('\n');

  // Build signature block HTML
  let signatureHtml = '';
  if (draft.signature_block) {
    const s = draft.signature_block;
    signatureHtml = `
      <div class="signature-block">
        <p>Respectfully submitted this ${s.respectfully_submitted_date || '[DATE]'}.</p>
        <p style="margin-top: 2em">/s/ ${s.attorney_name || '[ATTORNEY NAME]'}</p>
        <p>
          <strong>${s.attorney_name || ''}</strong>
          ${s.bar_number ? `<br/>${s.bar_number}` : ''}
          ${s.firm_name ? `<br/>${s.firm_name}` : ''}
          <br/>${s.address || ''}
          ${s.phone ? `<br/>Tel: ${s.phone}` : ''}
          ${s.email ? `<br/>Email: ${s.email}` : ''}
          ${s.representing ? `<br/><em>Attorney for ${s.representing}</em>` : ''}
        </p>
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${c.document_title || 'Legal Document'}</title>
  <style>${getPrintStyles()}</style>
</head>
<body>
  <div class="court-caption">
    ${c.court_name || ''}
    ${c.court_division ? `<br/>${c.court_division}` : ''}
  </div>
  <table class="case-caption">
    <tbody>
      <tr>
        <td class="case-left">
          ${c.plaintiff || '[PLAINTIFF]'},<br/><br/>
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Plaintiff,<br/><br/>
          v.<br/><br/>
          ${c.defendant || '[DEFENDANT]'},<br/><br/>
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Defendant.
        </td>
        <td class="case-right">
          <br/><br/><br/><br/>
          Civil Action File No.<br/>
          ${c.case_number || '[CASE NUMBER]'}
        </td>
      </tr>
    </tbody>
  </table>
  <div class="motion-title">${c.document_title || 'LEGAL DOCUMENT'}</div>
  ${bodyHtml}
  ${signatureHtml}
</body>
</html>`;
};

