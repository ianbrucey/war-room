/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { CaseFileRepository } from '../../../webserver/auth/repository/CaseFileRepository';
import { DocumentRepository } from '../../../webserver/auth/repository/DocumentRepository';
// import { emitDocumentComplete, emitDocumentError, emitDocumentIndexing } from '../../../webserver/websocket/documentProgress';
import type { IDocumentMetadata } from '../types';

/**
 * File Search Indexer Service
 *
 * Uploads documents to Gemini File Search for RAG capabilities
 */
export class FileSearchIndexer {
  private genAI: GoogleGenerativeAI;

  constructor(private geminiApiKey: string) {
    this.genAI = new GoogleGenerativeAI(geminiApiKey);
  }

  /**
   * Index a document for file search
   *
   * @param documentId - Document ID
   * @param caseFileId - Case file ID
   * @param extractedTextPath - Path to extracted text file
   * @param metadata - Document metadata
   */
  async indexDocument(documentId: string, caseFileId: string, extractedTextPath: string, metadata: IDocumentMetadata): Promise<void> {
    const doc = DocumentRepository.findById(documentId);
    if (!doc) {
      throw new Error(`Document not found: ${documentId}`);
    }

    try {
      // Update status to indexing
      DocumentRepository.updateStatus(documentId, 'indexing');
      // emitDocumentIndexing(documentId, caseFileId, doc.filename);

      const storeId = await this.getOrCreateStore(caseFileId);
      const fileUri = await this.uploadToFileSearch(storeId, extractedTextPath, metadata);

      // Update document with file URI and mark as complete
      DocumentRepository.updateProcessingFlags(documentId, {
        gemini_file_uri: fileUri,
        rag_indexed: 1,
        processing_status: 'complete',
        processed_at: Date.now(),
      });

      // emitDocumentComplete(documentId, caseFileId, doc.filename);
      console.log(`[DocumentIntake] Document indexed: ${documentId}`);

      // Mark case summary as stale if it exists
      const caseFile = CaseFileRepository.findById(caseFileId);
      if (caseFile && caseFile.case_summary_status === 'generated') {
        CaseFileRepository.markSummaryStale(caseFileId);
        console.log(`[DocumentIntake] Marked case summary as stale for case: ${caseFileId}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[DocumentIntake] Indexing failed for document: ${documentId}`, error);
      DocumentRepository.updateStatus(documentId, 'failed');
      // emitDocumentError(documentId, caseFileId, doc.filename, errorMessage);
      throw error;
    }
  }

  /**
   * Get or create a file search store for a case
   */
  private async getOrCreateStore(caseFileId: string): Promise<string> {
    const caseFile = CaseFileRepository.findById(caseFileId);
    if (!caseFile) {
      throw new Error(`Case file not found: ${caseFileId}`);
    }

    // TODO: Check if case file has a file_search_store_id field
    // For now, generate a store ID based on case file ID
    // The Gemini SDK for Node.js doesn't yet support file search management.
    const storeId = `store-${caseFileId}`;

    console.log(`[DocumentIntake] Using store: ${storeId} for case: ${caseFileId}`);
    return storeId;
  }

  /**
   * Upload file to Gemini File Search
   */
  private async uploadToFileSearch(storeId: string, textPath: string, metadata: IDocumentMetadata): Promise<string> {
    // This is a placeholder for the actual API call to upload a file.
    // The Gemini SDK for Node.js doesn't yet support file search management.
    // We will simulate the upload and return a fake URI.
    console.log(`[DocumentIntake] Uploading ${textPath} to store ${storeId} with metadata:`, metadata);
    const fileUri = `files/${storeId}/${Date.now()}`;
    return fileUri;
  }
}
