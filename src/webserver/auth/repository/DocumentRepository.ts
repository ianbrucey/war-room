/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { getDatabase } from '@process/database/export';
import type { ICaseDocument, ProcessingStatus } from '@process/documents/types';
import { randomUUID } from 'crypto';

/**
 * Document Repository - Provides case document data access interface
 *
 * Follows the repository pattern established by CaseFileRepository.
 * Uses the AionUIDatabase query/exec methods for raw SQL access.
 */
export const DocumentRepository = {
  /**
   * Create a new case document
   */
  create(doc: Omit<ICaseDocument, 'id'>): ICaseDocument {
    const id = randomUUID();
    const db = getDatabase();

    try {
      db.exec(
        `INSERT INTO case_documents (
          id, case_file_id, filename, folder_name, document_type, file_type,
          page_count, word_count, processing_status,
          has_text_extraction, has_metadata, rag_indexed,
          file_search_store_id, gemini_file_uri,
          uploaded_at, processed_at,
          s3_key, s3_bucket, s3_uploaded_at, s3_version_id, content_type, file_size_bytes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        doc.case_file_id,
        doc.filename,
        doc.folder_name,
        doc.document_type || null,
        doc.file_type,
        doc.page_count || null,
        doc.word_count || null,
        doc.processing_status || 'pending',
        doc.has_text_extraction || 0,
        doc.has_metadata || 0,
        doc.rag_indexed || 0,
        doc.file_search_store_id || null,
        doc.gemini_file_uri || null,
        doc.uploaded_at,
        doc.processed_at || null,
        // S3 storage fields
        doc.s3_key || null,
        doc.s3_bucket || null,
        doc.s3_uploaded_at || null,
        doc.s3_version_id || null,
        doc.content_type || null,
        doc.file_size_bytes || null
      );

      const result = this.findById(id);
      if (!result) {
        throw new Error('Failed to retrieve created document');
      }

      return result;
    } catch (error) {
      console.error('[DocumentIntake] Failed to create document:', error);
      throw error;
    }
  },

  /**
   * Find document by ID
   */
  findById(id: string): ICaseDocument | null {
    const db = getDatabase();

    try {
      const row = db.querySingle('SELECT * FROM case_documents WHERE id = ?', id) as ICaseDocument | undefined;
      return row || null;
    } catch (error) {
      console.error('[DocumentIntake] Failed to find document by ID:', error);
      return null;
    }
  },

  /**
   * Find all documents for a case file
   */
  findByCaseFileId(caseFileId: string): ICaseDocument[] {
    const db = getDatabase();

    try {
      const rows = db.query(
        `SELECT * FROM case_documents
         WHERE case_file_id = ?
         ORDER BY uploaded_at DESC`,
        caseFileId
      ) as ICaseDocument[];
      return rows;
    } catch (error) {
      console.error('[DocumentIntake] Failed to find documents by case file ID:', error);
      return [];
    }
  },

  /**
   * Update document processing status
   */
  updateStatus(id: string, status: ProcessingStatus): void {
    const db = getDatabase();

    try {
      db.exec(
        `UPDATE case_documents
         SET processing_status = ?
         WHERE id = ?`,
        status,
        id
      );
    } catch (error) {
      console.error('[DocumentIntake] Failed to update document status:', error);
      throw error;
    }
  },

  /**
   * Update processing flags and metadata
   */
  updateProcessingFlags(id: string, flags: Partial<ICaseDocument>): void {
    const db = getDatabase();

    try {
      const updates: string[] = [];
      const values: unknown[] = [];

      // Build dynamic UPDATE statement based on provided flags
      if (typeof flags.has_text_extraction !== 'undefined') {
        updates.push('has_text_extraction = ?');
        values.push(flags.has_text_extraction);
      }
      if (typeof flags.has_metadata !== 'undefined') {
        updates.push('has_metadata = ?');
        values.push(flags.has_metadata);
      }
      if (typeof flags.rag_indexed !== 'undefined') {
        updates.push('rag_indexed = ?');
        values.push(flags.rag_indexed);
      }
      if (flags.processing_status) {
        updates.push('processing_status = ?');
        values.push(flags.processing_status);
      }
      if (flags.document_type) {
        updates.push('document_type = ?');
        values.push(flags.document_type);
      }
      if (typeof flags.page_count !== 'undefined') {
        updates.push('page_count = ?');
        values.push(flags.page_count);
      }
      if (typeof flags.word_count !== 'undefined') {
        updates.push('word_count = ?');
        values.push(flags.word_count);
      }
      if (flags.file_search_store_id) {
        updates.push('file_search_store_id = ?');
        values.push(flags.file_search_store_id);
      }
      if (flags.gemini_file_uri) {
        updates.push('gemini_file_uri = ?');
        values.push(flags.gemini_file_uri);
      }
      if (typeof flags.processed_at !== 'undefined') {
        updates.push('processed_at = ?');
        values.push(flags.processed_at);
      }
      // S3 storage fields
      if (typeof flags.s3_key !== 'undefined') {
        updates.push('s3_key = ?');
        values.push(flags.s3_key);
      }
      if (typeof flags.s3_bucket !== 'undefined') {
        updates.push('s3_bucket = ?');
        values.push(flags.s3_bucket);
      }
      if (typeof flags.s3_uploaded_at !== 'undefined') {
        updates.push('s3_uploaded_at = ?');
        values.push(flags.s3_uploaded_at);
      }
      if (typeof flags.s3_version_id !== 'undefined') {
        updates.push('s3_version_id = ?');
        values.push(flags.s3_version_id);
      }
      if (typeof flags.content_type !== 'undefined') {
        updates.push('content_type = ?');
        values.push(flags.content_type);
      }
      if (typeof flags.file_size_bytes !== 'undefined') {
        updates.push('file_size_bytes = ?');
        values.push(flags.file_size_bytes);
      }

      if (updates.length === 0) {
        return; // Nothing to update
      }

      values.push(id); // Add ID for WHERE clause

      db.exec(
        `UPDATE case_documents
         SET ${updates.join(', ')}
         WHERE id = ?`,
        ...values
      );
    } catch (error) {
      console.error('[DocumentIntake] Failed to update processing flags:', error);
      throw error;
    }
  },

  /**
   * Delete document
   */
  delete(id: string): void {
    const db = getDatabase();

    try {
      db.exec('DELETE FROM case_documents WHERE id = ?', id);
    } catch (error) {
      console.error('[DocumentIntake] Failed to delete document:', error);
      throw error;
    }
  },

  /**
   * Check if document exists and belongs to case file
   */
  existsForCaseFile(id: string, caseFileId: string): boolean {
    const doc = this.findById(id);
    return doc !== null && doc.case_file_id === caseFileId;
  },

  /**
   * Get documents by processing status
   */
  findByStatus(status: ProcessingStatus): ICaseDocument[] {
    const db = getDatabase();

    try {
      const rows = db.query(
        `SELECT * FROM case_documents
         WHERE processing_status = ?
         ORDER BY uploaded_at DESC`,
        status
      ) as ICaseDocument[];
      return rows;
    } catch (error) {
      console.error('[DocumentIntake] Failed to find documents by status:', error);
      return [];
    }
  },

  /**
   * Get processing statistics for a case file
   */
  getStats(caseFileId: string): {
    total: number;
    pending: number;
    extracting: number;
    analyzing: number;
    indexing: number;
    complete: number;
    failed: number;
  } {
    const db = getDatabase();

    try {
      const result = db.querySingle(
        `SELECT
          COUNT(*) as total,
          SUM(CASE WHEN processing_status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN processing_status = 'extracting' THEN 1 ELSE 0 END) as extracting,
          SUM(CASE WHEN processing_status = 'analyzing' THEN 1 ELSE 0 END) as analyzing,
          SUM(CASE WHEN processing_status = 'indexing' THEN 1 ELSE 0 END) as indexing,
          SUM(CASE WHEN processing_status = 'complete' THEN 1 ELSE 0 END) as complete,
          SUM(CASE WHEN processing_status = 'failed' THEN 1 ELSE 0 END) as failed
        FROM case_documents
        WHERE case_file_id = ?`,
        caseFileId
      ) as Record<string, number>;

      return {
        total: result.total || 0,
        pending: result.pending || 0,
        extracting: result.extracting || 0,
        analyzing: result.analyzing || 0,
        indexing: result.indexing || 0,
        complete: result.complete || 0,
        failed: result.failed || 0,
      };
    } catch (error) {
      console.error('[DocumentIntake] Failed to get stats:', error);
      return {
        total: 0,
        pending: 0,
        extracting: 0,
        analyzing: 0,
        indexing: 0,
        complete: 0,
        failed: 0,
      };
    }
  },
};