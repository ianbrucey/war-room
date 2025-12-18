/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Mistral } from '@mistralai/mistralai';
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
  async extractDocument(documentId: string, caseFileId: string, intakeFilePath: string): Promise<void> {
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
      const word_count = extractedText.split(/\s+/).filter((w) => w.length > 0).length;

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
  private async routeToHandler(fileType: string, filePath: string): Promise<string> {
    switch (fileType) {
      case '.pdf':
        console.log('[DocumentIntake] Routing to Mistral OCR for PDF text extraction');
        return await this.extractPdfWithMistralOcr(filePath);
      case '.txt':
      case '.md':
        console.log('[DocumentIntake] Routing to plaintext handler');
        return await fs.readFile(filePath, 'utf-8');
      case '.docx':
        console.log('[DocumentIntake] Routing to Mistral OCR for DOCX text extraction');
        return await this.extractPdfWithMistralOcr(filePath);
      case '.jpg':
      case '.jpeg':
      case '.png':
      case '.gif':
      case '.bmp':
      case '.tiff':
      case '.webp':
        console.log('[DocumentIntake] Routing to Mistral OCR for image text extraction');
        return await this.extractImageWithMistralOcr(filePath);
      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }
  }

  /**
   * Extract text from PDF/DOCX using Mistral OCR API
   * Uploads file to Mistral, processes with OCR, and returns text with page breaks
   *
   * @param filePath - Path to the PDF or DOCX file
   * @returns Extracted text with page breaks
   */
  private async extractPdfWithMistralOcr(filePath: string): Promise<string> {
    console.log(`[DocumentIntake] Extracting text using Mistral OCR: ${filePath}`);

    const startTime = Date.now();

    try {
      // Initialize Mistral client
      const client = new Mistral({ apiKey: this.mistralApiKey });

      // Step 1: Upload file to Mistral
      console.log('[DocumentIntake] Uploading file to Mistral...');
      const fileBuffer = await fs.readFile(filePath);
      const fileName = path.basename(filePath);

      const uploadedFile = await client.files.upload({
        file: {
          fileName: fileName,
          content: fileBuffer,
        } as any,
        purpose: 'ocr',
      });

      console.log(`[DocumentIntake] File uploaded with ID: ${uploadedFile.id}`);

      // Step 2: Get signed URL
      const signedUrl = await client.files.getSignedUrl({ fileId: uploadedFile.id });
      console.log('[DocumentIntake] Got signed URL for processing');

      // Step 3: Process with Mistral OCR
      console.log('[DocumentIntake] Processing with Mistral OCR...');

      const ocrParams: any = {
        model: 'mistral-ocr-latest',
        document: {
          type: 'document_url',
          documentUrl: signedUrl.url,
        },
        includeImageBase64: false,
      };

      // DOCX files require image_limit=0 when include_image_base64=false
      if (filePath.toLowerCase().endsWith('.docx')) {
        ocrParams.imageLimit = 0;
      }

      const ocrResponse = await client.ocr.process(ocrParams);

      // Step 4: Extract text with page break markers
      let extractedText = '';
      const pageCount = ocrResponse.pages.length;

      for (let i = 0; i < pageCount; i++) {
        extractedText += `--- Page ${i + 1} ---\n`;
        extractedText += ocrResponse.pages[i].markdown + '\n\n';
      }

      const processingTime = (Date.now() - startTime) / 1000;
      console.log(`[DocumentIntake] Successfully processed ${pageCount} pages in ${processingTime.toFixed(2)}s`);

      // Step 5: Clean up uploaded file
      try {
        await client.files.delete({ fileId: uploadedFile.id });
        console.log('[DocumentIntake] Cleaned up uploaded file');
      } catch (cleanupError) {
        console.warn('[DocumentIntake] Failed to cleanup uploaded file:', cleanupError);
      }

      return extractedText.trim();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[DocumentIntake] Mistral OCR extraction failed: ${errorMessage}`);
      throw new Error(`Mistral OCR extraction failed: ${errorMessage}`);
    }
  }

  /**
   * Extract text from image using Mistral OCR API
   * Uploads image to Mistral and processes with OCR
   *
   * @param filePath - Path to the image file
   * @returns Extracted text from image
   */
  private async extractImageWithMistralOcr(filePath: string): Promise<string> {
    console.log(`[DocumentIntake] Extracting text from image using Mistral OCR: ${filePath}`);

    try {
      // Initialize Mistral client
      const client = new Mistral({ apiKey: this.mistralApiKey });

      // Upload image to Mistral
      console.log('[DocumentIntake] Uploading image to Mistral...');
      const fileBuffer = await fs.readFile(filePath);
      const fileName = path.basename(filePath);

      const uploadedFile = await client.files.upload({
        file: {
          fileName: fileName,
          content: fileBuffer,
        } as any,
        purpose: 'ocr',
      });

      // Get signed URL
      const signedUrl = await client.files.getSignedUrl({ fileId: uploadedFile.id });

      // Process with Mistral OCR
      const ocrResponse = await client.ocr.process({
        model: 'mistral-ocr-latest',
        document: {
          type: 'document_url',
          documentUrl: signedUrl.url,
        },
        includeImageBase64: false,
        imageLimit: 0,
      } as any);

      // Extract text (images typically have 1 page)
      let extractedText = '--- Page 1 ---\n';
      if (ocrResponse.pages.length > 0) {
        extractedText += ocrResponse.pages[0].markdown;
      }

      // Clean up uploaded file
      try {
        await client.files.delete({ fileId: uploadedFile.id });
      } catch (cleanupError) {
        console.warn('[DocumentIntake] Failed to cleanup uploaded image:', cleanupError);
      }

      console.log(`[DocumentIntake] Successfully extracted ${extractedText.length} characters from image`);
      return extractedText;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[DocumentIntake] Mistral OCR image extraction failed: ${errorMessage}`);
      throw new Error(`Image text extraction failed: ${errorMessage}`);
    }
  }
}
