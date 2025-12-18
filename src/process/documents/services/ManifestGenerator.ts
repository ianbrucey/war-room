/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs/promises';
import path from 'path';
import { CaseFileRepository } from '../../../webserver/auth/repository/CaseFileRepository';
import { DocumentRepository } from '../../../webserver/auth/repository/DocumentRepository';
import type { ICaseDocument, ICaseDocumentsManifest } from '../types';

/**
 * Manifest Generator Service
 *
 * Generates case-documents-manifest.json for a case file
 */
export class ManifestGenerator {
  /**
   * Generate manifest for a case file
   *
   * @param caseFileId - Case file ID
   */
  async generateManifest(caseFileId: string): Promise<void> {
    console.log(`[DocumentIntake] Generating manifest for case: ${caseFileId}`);
    try {
      // Get case file to get workspace path
      const caseFile = CaseFileRepository.findById(caseFileId);
      if (!caseFile) {
        throw new Error(`Case file not found: ${caseFileId}`);
      }

      const documents = DocumentRepository.findByCaseFileId(caseFileId);

      const manifest: ICaseDocumentsManifest = {
        schema_version: '1.0',
        case_file_id: caseFileId,
        last_updated: new Date().toISOString(),
        document_count: documents.length,
        documents: documents.map((doc) => this.buildManifestDocument(doc)),
      };

      const workspacePath = caseFile.workspace_path;
      const manifestPath = path.join(workspacePath, 'documents', 'case-documents-manifest.json');
      const tempManifestPath = `${manifestPath}.tmp`;

      // Ensure directory exists
      await fs.mkdir(path.dirname(manifestPath), { recursive: true });

      // Atomic write: write to temp file then rename
      await fs.writeFile(tempManifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
      await fs.rename(tempManifestPath, manifestPath);

      console.log(`[DocumentIntake] Manifest generated for case: ${caseFileId}`);
    } catch (error) {
      console.error(`[DocumentIntake] Manifest generation failed for case: ${caseFileId}`, error);
      throw error;
    }
  }

  /**
   * Build a manifest document entry from a case document
   */
  private buildManifestDocument(doc: ICaseDocument): ICaseDocumentsManifest['documents'][0] {
    return {
      id: doc.id,
      filename: doc.filename,
      folder_name: doc.folder_name,
      document_type: doc.document_type || undefined,
      page_count: doc.page_count || undefined,
      has_text_extraction: Boolean(doc.has_text_extraction),
      has_metadata: Boolean(doc.has_metadata),
      rag_indexed: Boolean(doc.rag_indexed),
      processing_status: doc.processing_status,
      added_at: new Date(doc.uploaded_at).toISOString(),
    };
  }
}
