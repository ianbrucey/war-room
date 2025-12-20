/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, type FileSearchStore } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';
import { CaseFileRepository } from '../../../webserver/auth/repository/CaseFileRepository';
import { DocumentRepository } from '../../../webserver/auth/repository/DocumentRepository';
import type { IDocumentMetadata } from '../types';

// Polling interval for checking operation status (5 seconds)
const POLL_INTERVAL_MS = 5000;
// Maximum time to wait for indexing (5 minutes)
const MAX_WAIT_MS = 5 * 60 * 1000;

// File extensions that Google File Search can natively parse
const NATIVE_PARSEABLE_EXTENSIONS = ['.pdf', '.docx', '.doc', '.txt', '.html', '.md'];

/**
 * File Search Indexer Service
 *
 * Uploads documents to Gemini File Search for RAG capabilities.
 * Uses the @google/genai SDK for File Search store management.
 *
 * @see https://ai.google.dev/gemini-api/docs/file-search
 */
export class FileSearchIndexer {
  private ai: GoogleGenAI;

  constructor(private geminiApiKey: string) {
    this.ai = new GoogleGenAI({ apiKey: geminiApiKey });
  }

  /**
   * Select the best file to upload to File Search.
   * Prioritizes original files (PDF, DOCX) over extracted text.
   *
   * @param documentFolderPath - Path to the document folder
   * @returns Path to the file to upload
   */
  private selectFileForUpload(documentFolderPath: string): string {
    // First, look for original file with natively parseable extension
    const files = fs.readdirSync(documentFolderPath);
    const originalFile = files.find((f) => f.startsWith('original.'));

    if (originalFile) {
      const ext = path.extname(originalFile).toLowerCase();
      if (NATIVE_PARSEABLE_EXTENSIONS.includes(ext)) {
        const originalPath = path.join(documentFolderPath, originalFile);
        console.log(`[FileSearchIndexer] Using original file: ${originalPath}`);
        return originalPath;
      }
    }

    // Fallback to extracted text
    const extractedTextPath = path.join(documentFolderPath, 'extracted-text.txt');
    if (fs.existsSync(extractedTextPath)) {
      console.log(`[FileSearchIndexer] Using extracted text: ${extractedTextPath}`);
      return extractedTextPath;
    }

    throw new Error(`No uploadable file found in ${documentFolderPath}`);
  }

  /**
   * Index a document for file search
   *
   * @param documentId - Document ID
   * @param caseFileId - Case file ID
   * @param documentFolderPath - Path to document folder (containing original.* and/or extracted-text.txt)
   * @param metadata - Document metadata
   */
  async indexDocument(documentId: string, caseFileId: string, documentFolderPath: string, metadata: IDocumentMetadata): Promise<void> {
    const doc = DocumentRepository.findById(documentId);
    if (!doc) {
      throw new Error(`Document not found: ${documentId}`);
    }

    try {
      // Update status to indexing
      DocumentRepository.updateStatus(documentId, 'indexing');

      // Select the best file to upload (original PDF/DOCX preferred over extracted text)
      const fileToUpload = this.selectFileForUpload(documentFolderPath);

      // Get or create the file search store for this case
      const storeName = await this.getOrCreateStore(caseFileId);

      // Upload the document to the store
      const fileUri = await this.uploadToFileSearch(storeName, fileToUpload, metadata, doc.filename);

      // Update document with file URI and mark as complete
      DocumentRepository.updateProcessingFlags(documentId, {
        gemini_file_uri: fileUri,
        file_search_store_id: storeName,
        rag_indexed: 1,
        processing_status: 'complete',
        processed_at: Date.now(),
      });

      console.log(`[FileSearchIndexer] Document indexed: ${documentId} -> ${fileUri}`);

      // Mark case summary as stale if it exists
      const caseFile = CaseFileRepository.findById(caseFileId);
      if (caseFile && caseFile.case_summary_status === 'generated') {
        CaseFileRepository.markSummaryStale(caseFileId);
        console.log(`[FileSearchIndexer] Marked case summary as stale for case: ${caseFileId}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[FileSearchIndexer] Indexing failed for document: ${documentId}`, error);
      DocumentRepository.updateStatus(documentId, 'failed');
      throw error;
    }
  }

  /**
   * Get or create a file search store for a case.
   * Each case gets its own store for document isolation.
   *
   * @returns The store name (e.g., "fileSearchStores/abc123")
   */
  private async getOrCreateStore(caseFileId: string): Promise<string> {
    const caseFile = CaseFileRepository.findById(caseFileId);
    if (!caseFile) {
      throw new Error(`Case file not found: ${caseFileId}`);
    }

    // Check if case already has a store
    const existingStoreId = CaseFileRepository.getFileSearchStoreId(caseFileId);
    if (existingStoreId) {
      console.log(`[FileSearchIndexer] Using existing store: ${existingStoreId} for case: ${caseFileId}`);
      return existingStoreId;
    }

    // Create a new store for this case
    console.log(`[FileSearchIndexer] Creating new file search store for case: ${caseFileId}`);

    const displayName = `Case: ${caseFile.title || caseFileId}`.substring(0, 128);

    const store: FileSearchStore = await this.ai.fileSearchStores.create({
      config: {
        displayName,
      },
    });

    if (!store.name) {
      throw new Error('Failed to create file search store: no name returned');
    }

    // Save the store ID to the case file
    CaseFileRepository.updateFileSearchStoreId(caseFileId, store.name);

    console.log(`[FileSearchIndexer] Created store: ${store.name} for case: ${caseFileId}`);
    return store.name;
  }

  /**
   * Upload file to Gemini File Search and wait for indexing to complete.
   *
   * @param storeName - The file search store name
   * @param textPath - Path to the extracted text file
   * @param metadata - Document metadata for display name
   * @param originalFilename - Original filename for display
   * @returns The file URI in the store
   */
  private async uploadToFileSearch(
    storeName: string,
    textPath: string,
    metadata: IDocumentMetadata,
    originalFilename: string
  ): Promise<string> {
    console.log(`[FileSearchIndexer] Uploading ${textPath} to store ${storeName}`);

    // Create a display name from metadata or filename
    const displayName = (metadata.summary?.executive_summary?.substring(0, 50) || originalFilename).substring(0, 128);

    // Upload the file to the store - returns UploadToFileSearchStoreOperation
    let operation = await this.ai.fileSearchStores.uploadToFileSearchStore({
      file: textPath,
      fileSearchStoreName: storeName,
      config: {
        displayName,
      },
    });

    // Wait for the indexing operation to complete
    const startTime = Date.now();
    while (!operation.done) {
      if (Date.now() - startTime > MAX_WAIT_MS) {
        throw new Error(`File indexing timed out after ${MAX_WAIT_MS / 1000} seconds`);
      }

      console.log(`[FileSearchIndexer] Waiting for indexing... (${Math.round((Date.now() - startTime) / 1000)}s)`);
      await this.sleep(POLL_INTERVAL_MS);

      // Refresh operation status using operations.get()
      if (operation.name) {
        const refreshed = await this.ai.operations.get({
          operation: operation,
        });
        // Copy the refreshed status back
        operation.done = refreshed.done;
        operation.error = refreshed.error as Record<string, unknown> | undefined;
        operation.response = (refreshed as { response?: typeof operation.response }).response;
      }
    }

    // Check for errors
    if (operation.error) {
      const errorMsg = (operation.error as { message?: string }).message || JSON.stringify(operation.error);
      throw new Error(`File indexing failed: ${errorMsg}`);
    }

    // Extract the document name from the operation response
    // The response contains the indexed document information
    const response = operation.response;
    const fileUri = response?.documentName || `${storeName}/documents/${Date.now()}`;

    console.log(`[FileSearchIndexer] File indexed successfully: ${fileUri}`);
    return fileUri;
  }

  /**
   * Delete a file search store (cleanup)
   */
  async deleteStore(storeName: string): Promise<void> {
    try {
      await this.ai.fileSearchStores.delete({ name: storeName });
      console.log(`[FileSearchIndexer] Deleted store: ${storeName}`);
    } catch (error) {
      console.error(`[FileSearchIndexer] Failed to delete store: ${storeName}`, error);
      throw error;
    }
  }

  /**
   * List all documents in a store
   */
  async listStoreDocuments(storeName: string): Promise<string[]> {
    try {
      const documentNames: string[] = [];
      // Use the documents.list method with the store name as parent
      const pager = await this.ai.fileSearchStores.documents.list({
        parent: storeName,
      });
      for await (const doc of pager) {
        if (doc.name) {
          documentNames.push(doc.name);
        }
      }
      return documentNames;
    } catch (error) {
      console.error(`[FileSearchIndexer] Failed to list documents in store: ${storeName}`, error);
      throw error;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
