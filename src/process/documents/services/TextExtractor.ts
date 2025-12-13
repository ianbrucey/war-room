/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs/promises';
import path from 'path';
import { CaseFileRepository } from '../../../webserver/auth/repository/CaseFileRepository';
import { DocumentRepository } from '../../../webserver/auth/repository/DocumentRepository';
// import { emitDocumentError, emitDocumentExtracting } from '../../../webserver/websocket/documentProgress';
import { DocumentAnalyzer } from './DocumentAnalyzer';

/**
 * Text Extractor Service
 *
 * Routes documents to appropriate extraction handlers based on file type
 */
export class TextExtractor {
  constructor(
    private mistralApiKey: string,
    private geminiApiKey: string
  ) {}

  /**
   * Extract text from a document
   *
   * @param documentId - Document ID
   * @param caseFileId - Case file ID
   * @param filePath - Path to the original file
   */
  async extractDocument(
    documentId: string,
    caseFileId: string,
    intakeFilePath: string
  ): Promise<void> {
    console.log(`[DocumentIntake] Starting extraction for document: ${documentId}`);

    // Get document to get filename for progress events
    const doc = DocumentRepository.findById(documentId);
    if (!doc) {
      console.error(`[DocumentIntake] Document not found: ${documentId}`);
      return;
    }

    // Get case file to get workspace path
    const caseFile = CaseFileRepository.findById(caseFileId);
    if (!caseFile) {
      console.error(`[DocumentIntake] Case file not found: ${caseFileId}`);
      return;
    }

    try {
      // Update status to extracting
      DocumentRepository.updateStatus(documentId, 'extracting');
      // emitDocumentExtracting(documentId, caseFileId, doc.filename);

      // Create document folder: documents/{folder_name}/
      const workspacePath = caseFile.workspace_path;
      const docFolderPath = path.join(workspacePath, 'documents', doc.folder_name);
      await fs.mkdir(docFolderPath, { recursive: true });

      // Move file from intake to document folder
      const originalFilePath = path.join(docFolderPath, `original${path.extname(intakeFilePath)}`);
      await fs.rename(intakeFilePath, originalFilePath);
      console.log(`[DocumentIntake] Moved file from intake to: ${originalFilePath}`);

      const fileType = path.extname(originalFilePath).toLowerCase();
      const extractedText = await this.routeToHandler(fileType, originalFilePath);

      // Save extracted text to document folder
      const extractionFilePath = path.join(docFolderPath, 'extracted-text.txt');
      await fs.writeFile(extractionFilePath, extractedText, 'utf-8');

      // Calculate page and word counts
      const pageMatches = extractedText.match(/--- Page \d+ ---/g);
      const page_count = pageMatches ? pageMatches.length : 1;
      const word_count = extractedText.split(/\s+/).filter(w => w.length > 0).length;

      // Update document with extraction results
      DocumentRepository.updateProcessingFlags(documentId, {
        processing_status: 'analyzing',
        has_text_extraction: 1,
        page_count,
        word_count,
      });

      console.log(`[DocumentIntake] Finished extraction for document: ${documentId}`);

      // Chain to DocumentAnalyzer
      const analyzer = new DocumentAnalyzer(this.geminiApiKey);
      await analyzer.analyzeDocument(documentId, caseFileId, extractionFilePath);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[DocumentIntake] Extraction failed for document: ${documentId}`, error);
      DocumentRepository.updateStatus(documentId, 'failed');
      // emitDocumentError(documentId, caseFileId, doc.filename, errorMessage);
    }
  }

  /**
   * Route to appropriate handler based on file type
   */
  private async routeToHandler(
    fileType: string,
    filePath: string
  ): Promise<string> {
    switch (fileType) {
      case '.pdf':
        console.log('[DocumentIntake] Routing to Mistral OCR for PDF');
        // TODO: Implement MistralOCRHandler integration
        return `--- Page 1 ---\nExtracted text from PDF: ${filePath}`;
      case '.txt':
      case '.md':
        console.log('[DocumentIntake] Routing to plaintext handler');
        return await fs.readFile(filePath, 'utf-8');
      case '.docx':
        console.log('[DocumentIntake] Routing to DOCX handler');
        // TODO: Implement DOCX handler
        return `Extracted text from DOCX: ${filePath}`;
      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }
  }
}
