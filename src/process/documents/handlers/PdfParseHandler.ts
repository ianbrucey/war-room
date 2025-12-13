/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFile } from 'fs/promises';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse');

/**
 * PDF Parse Handler
 *
 * Extracts text from PDFs using pdf-parse library.
 * Used as a fallback when Mistral OCR is not available or for text-based PDFs.
 */
export class PdfParseHandler {
  /**
   * Extract text from a PDF file
   *
   * @param filePath - Path to the PDF file
   * @returns Extracted text with page count and word count
   */
  async extractText(filePath: string): Promise<{
    text: string;
    pageCount: number;
    wordCount: number;
  }> {
    const fileBuffer = await readFile(filePath);
    const data = await pdfParse(fileBuffer);

    const pageCount = data.numpages;
    const textWithBreaks = this.addPageBreaks(data.text, pageCount);
    const wordCount = textWithBreaks.split(/\s+/).filter(w => w.length > 0).length;

    return { text: textWithBreaks, pageCount, wordCount };
  }

  /**
   * Add page break markers to extracted text
   *
   * Note: pdf-parse doesn't give us per-page text, so we estimate
   * page breaks based on line count distribution.
   */
  private addPageBreaks(text: string, pageCount: number): string {
    if (pageCount <= 1) {
      return `--- Page 1 ---\n${text}`;
    }

    // pdf-parse doesn't give us per-page text, so we'll have to assume an even distribution
    // This is a limitation of the library.
    const lines = text.split('\n');
    const linesPerPage = Math.ceil(lines.length / pageCount);
    let result = '';

    for (let i = 0; i < pageCount; i++) {
      result += `--- Page ${i + 1} ---\n`;
      result += lines.slice(i * linesPerPage, (i + 1) * linesPerPage).join('\n');
      result += '\n';
    }

    return result;
  }
}
