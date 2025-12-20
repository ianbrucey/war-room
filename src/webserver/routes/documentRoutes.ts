/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Request, Response } from 'express';
import { Router } from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { S3StorageService } from '../../process/documents/services/S3StorageService';
import { TextExtractor } from '../../process/documents/services/TextExtractor';
import { getContentType, getPreviewType, isPreviewable } from '../../process/documents/utils/contentTypeMapper';
import { detectFileType } from '../../process/documents/utils/fileTypeDetector';
import { AuthMiddleware } from '../auth/middleware/AuthMiddleware';
import { CaseFileRepository } from '../auth/repository/CaseFileRepository';
import { DocumentRepository } from '../auth/repository/DocumentRepository';

const router = Router();
const upload = multer({ dest: 'uploads/' });

// All routes require authentication
router.use(AuthMiddleware.authenticateToken);

/**
 * POST /api/cases/:caseFileId/templates/upload-sample
 *
 * Upload a sample document to templates/_samples/ folder for template generation.
 * These are reference documents that will be analyzed to create HTML templates.
 */
router.post('/cases/:caseFileId/templates/upload-sample', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const { caseFileId } = req.params;
    const file = req.file;
    const user = req.user;

    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    if (!user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Get workspace path from case file
    const caseFile = CaseFileRepository.findById(caseFileId);
    if (!caseFile) {
      res.status(404).json({ error: 'Case file not found' });
      return;
    }

    // Validate file type (only PDF and Word docs)
    const ext = path.extname(file.originalname).toLowerCase();
    if (!['.pdf', '.docx', '.doc'].includes(ext)) {
      res.status(400).json({ error: 'Only PDF and Word documents are supported' });
      return;
    }

    // Create templates/_samples/ directory
    const workspacePath = caseFile.workspace_path;
    const samplesPath = path.join(workspacePath, 'templates', '_samples');
    fs.mkdirSync(samplesPath, { recursive: true });

    // Move file to samples folder
    const targetPath = path.join(samplesPath, file.originalname);
    fs.renameSync(file.path, targetPath);

    console.log(`[TemplateSample] Saved sample to ${targetPath}`);

    res.json({
      success: true,
      filename: file.originalname,
      path: `templates/_samples/${file.originalname}`,
    });
  } catch (error) {
    console.error('[TemplateSample] Upload failed:', error);
    res.status(500).json({ error: 'Failed to upload template sample' });
  }
});

/**
 * POST /api/cases/:caseFileId/documents/upload
 *
 * Upload a document to a case file.
 * Documents are uploaded to S3 first (source of truth), then saved to local cache for processing.
 */
router.post('/cases/:caseFileId/documents/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const { caseFileId } = req.params;
    const file = req.file;
    const user = req.user;

    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    if (!user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Get workspace path from case file
    const caseFile = CaseFileRepository.findById(caseFileId);
    if (!caseFile) {
      res.status(404).json({ error: 'Case file not found' });
      return;
    }

    // Detect file type and content type
    const fileType = await detectFileType(file.originalname);
    const contentType = getContentType(file.originalname);

    // Create folder name from filename (sanitized)
    const folderName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');

    // Generate document ID early so we can use it for S3 key
    const documentId = require('crypto').randomUUID();
    const s3FileName = `original${path.extname(file.originalname)}`;

    // Initialize S3 service and upload
    const s3Service = new S3StorageService();
    const s3Key = s3Service.generateKey(user.id, caseFileId, documentId, s3FileName);

    let s3Result: { key: string; versionId?: string; bucket: string } | null = null;

    try {
      // Upload to S3 (source of truth)
      s3Result = await s3Service.uploadFile(file.path, s3Key, contentType);
      console.log(`[DocumentIntake] Uploaded to S3: ${s3Key}`);
    } catch (s3Error) {
      console.error('[DocumentIntake] S3 upload failed, continuing with local storage only:', s3Error);
      // Continue without S3 - fall back to local-only mode
    }

    // Move file to local cache for processing
    const workspacePath = caseFile.workspace_path;
    const intakePath = path.join(workspacePath, 'intake');
    fs.mkdirSync(intakePath, { recursive: true });

    const newFilePath = path.join(intakePath, file.originalname);
    fs.renameSync(file.path, newFilePath);

    // Create database record with S3 info
    const createdDoc = DocumentRepository.create({
      case_file_id: caseFileId,
      filename: file.originalname,
      folder_name: folderName,
      file_type: fileType,
      content_type: contentType,
      file_size_bytes: file.size,
      processing_status: 'pending',
      has_text_extraction: 0,
      has_metadata: 0,
      rag_indexed: 0,
      uploaded_at: Date.now(),
      // S3 storage fields
      s3_key: s3Result?.key || null,
      s3_bucket: s3Result?.bucket || null,
      s3_version_id: s3Result?.versionId || null,
      s3_uploaded_at: s3Result ? Date.now() : null,
    });

    // Start async text extraction (full pipeline)
    const textExtractor = new TextExtractor(process.env.MISTRAL_API_KEY || '', process.env.GEMINI_API_KEY || '');
    textExtractor.extractDocument(createdDoc.id, caseFileId, newFilePath).catch((err) => {
      console.error('[DocumentIntake] Background processing failed:', err);
    });

    res.json({
      success: true,
      documentId: createdDoc.id,
      s3Key: s3Result?.key,
    });
  } catch (error) {
    console.error('[DocumentIntake] Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

/**
 * GET /api/cases/:caseFileId/documents
 *
 * List all documents for a case file.
 */
router.get('/cases/:caseFileId/documents', async (req: Request, res: Response) => {
  try {
    const { caseFileId } = req.params;
    const documents = DocumentRepository.findByCaseFileId(caseFileId);
    res.json(documents);
  } catch (error) {
    console.error('[DocumentIntake] List documents error:', error);
    res.status(500).json({ error: 'Failed to list documents' });
  }
});

/**
 * GET /api/documents/:documentId
 *
 * Get a single document by ID.
 */
router.get('/documents/:documentId', async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const document = DocumentRepository.findById(documentId);
    if (document) {
      res.json(document);
    } else {
      res.status(404).json({ error: 'Document not found' });
    }
  } catch (error) {
    console.error('[DocumentIntake] Get document error:', error);
    res.status(500).json({ error: 'Failed to get document' });
  }
});

/**
 * GET /api/documents/:documentId/preview-url
 *
 * Returns a pre-signed URL for inline preview (Content-Disposition: inline)
 */
router.get('/documents/:documentId/preview-url', async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const document = DocumentRepository.findById(documentId);

    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    if (!document.s3_key) {
      // Fallback: document not in S3, try to serve preview info for local file
      const caseFile = CaseFileRepository.findById(document.case_file_id);
      if (!caseFile) {
        res.status(404).json({ error: 'Case file not found' });
        return;
      }

      const docFolderPath = path.join(caseFile.workspace_path, 'documents', document.folder_name);
      const originalFileName = `original${path.extname(document.filename)}`;
      const filePath = path.join(docFolderPath, originalFileName);

      if (!fs.existsSync(filePath)) {
        res.status(404).json({ error: 'Document file not found on disk' });
        return;
      }

      // For local files, provide a direct download URL
      res.json({
        url: `/api/documents/${documentId}/download`,
        contentType: document.content_type || getContentType(document.filename),
        previewType: getPreviewType(document.content_type || getContentType(document.filename)),
        filename: document.filename,
        isLocal: true,
        expiresIn: null,
      });
      return;
    }

    const s3Service = new S3StorageService();
    const contentType = document.content_type || getContentType(document.filename);
    const previewType = getPreviewType(contentType);

    // Generate pre-signed URL with inline disposition for preview
    const signedUrl = await s3Service.getPresignedUrl(document.s3_key, 3600, {
      responseContentType: contentType,
      responseContentDisposition: `inline; filename="${encodeURIComponent(document.filename)}"`,
    });

    res.json({
      url: signedUrl,
      contentType,
      previewType,
      filename: document.filename,
      isPreviewable: isPreviewable(contentType),
      expiresIn: 3600,
    });
  } catch (error) {
    console.error('[DocumentIntake] Preview URL error:', error);
    res.status(500).json({ error: 'Failed to generate preview URL' });
  }
});

/**
 * GET /api/documents/:documentId/download-url
 *
 * Returns a pre-signed URL for download (Content-Disposition: attachment)
 */
router.get('/documents/:documentId/download-url', async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const document = DocumentRepository.findById(documentId);

    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    if (!document.s3_key) {
      // Fallback to local download endpoint
      res.json({
        url: `/api/documents/${documentId}/download`,
        filename: document.filename,
        isLocal: true,
        expiresIn: null,
      });
      return;
    }

    const s3Service = new S3StorageService();

    // Generate pre-signed URL with attachment disposition for download
    const signedUrl = await s3Service.getPresignedUrl(document.s3_key, 3600, {
      responseContentDisposition: `attachment; filename="${encodeURIComponent(document.filename)}"`,
    });

    res.json({
      url: signedUrl,
      filename: document.filename,
      expiresIn: 3600,
    });
  } catch (error) {
    console.error('[DocumentIntake] Download URL error:', error);
    res.status(500).json({ error: 'Failed to generate download URL' });
  }
});

/**
 * DELETE /api/documents/:documentId
 *
 * Delete a document from S3, local storage, and database.
 */
router.delete('/documents/:documentId', async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const user = req.user;

    console.log(`[DocumentIntake] Delete request for document: ${documentId}, user: ${user?.id || 'undefined'}`);

    // Get document to find its files
    const document = DocumentRepository.findById(documentId);
    if (!document) {
      console.error(`[DocumentIntake] Document not found: ${documentId}`);
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    console.log(`[DocumentIntake] Found document: ${document.filename}, s3_key: ${document.s3_key || 'none'}`);

    // Get case file to find workspace path
    const caseFile = CaseFileRepository.findById(document.case_file_id);
    if (!caseFile) {
      console.error(`[DocumentIntake] Case file not found: ${document.case_file_id}`);
      res.status(404).json({ error: 'Case file not found' });
      return;
    }

    // Delete from S3 if document has S3 key
    if (document.s3_key) {
      if (!user) {
        console.error('[DocumentIntake] Cannot delete from S3: user not authenticated');
      } else {
        try {
          const s3Service = new S3StorageService();
          console.log(`[DocumentIntake] Attempting S3 delete: users/${user.id}/cases/${caseFile.id}/documents/${documentId}/`);
          await s3Service.deleteDocument(user.id, caseFile.id, documentId);
          console.log(`[DocumentIntake] Successfully deleted from S3: documents/${documentId}`);
        } catch (s3Error) {
          console.error('[DocumentIntake] S3 delete failed, continuing with local delete:', s3Error);
          // Continue with local delete even if S3 fails
        }
      }
    } else {
      console.log('[DocumentIntake] No S3 key, skipping S3 delete');
    }

    // Delete local files (gracefully handle missing files)
    try {
      const docFolderPath = path.join(caseFile.workspace_path, 'documents', document.folder_name);
      console.log(`[DocumentIntake] Checking local folder: ${docFolderPath}`);
      if (fs.existsSync(docFolderPath)) {
        fs.rmSync(docFolderPath, { recursive: true, force: true });
        console.log(`[DocumentIntake] Deleted document folder: ${docFolderPath}`);
      } else {
        console.log(`[DocumentIntake] Local folder not found (already deleted or never created): ${docFolderPath}`);
      }
    } catch (localDeleteError) {
      console.warn('[DocumentIntake] Local file deletion failed, continuing with database deletion:', localDeleteError);
      // Continue with database deletion even if local files can't be deleted
    }

    // Delete from Gemini File Search store if document was indexed
    if (document.gemini_file_uri && document.rag_indexed && document.file_search_store_id) {
      try {
        const { GoogleGenAI } = require('@google/genai');
        const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;

        if (geminiApiKey) {
          const ai = new GoogleGenAI({ apiKey: geminiApiKey });

          console.log(`[DocumentIntake] Attempting to delete document from File Search store`);
          console.log(`[DocumentIntake] Store ID: ${document.file_search_store_id}`);
          console.log(`[DocumentIntake] Document URI: ${document.gemini_file_uri}`);

          try {
            // Delete the document from the File Search store
            // API: DELETE https://generativelanguage.googleapis.com/v1beta/{name=fileSearchStores/*/documents/*}
            await ai.fileSearchStores.documents.delete({
              name: `fileSearchStores/${document.file_search_store_id}/documents/${document.gemini_file_uri}`,
            });

            console.log(`[DocumentIntake] Successfully deleted document from File Search store`);
          } catch (fileSearchError: any) {
            // Gracefully handle deletion errors (e.g., document already deleted, store doesn't exist)
            if (fileSearchError?.message?.includes('NOT_FOUND') || fileSearchError?.message?.includes('404')) {
              console.log(`[DocumentIntake] Document not found in File Search store (may have been already deleted)`);
            } else {
              console.warn('[DocumentIntake] File Search document deletion failed:', fileSearchError?.message || fileSearchError);
            }
            // Continue with database deletion even if File Search deletion fails
          }
        } else {
          console.warn('[DocumentIntake] No Gemini API key found, skipping File Search deletion');
        }
      } catch (error) {
        console.warn('[DocumentIntake] Error during File Search deletion:', error);
        // Continue with database deletion even if File Search initialization fails
      }
    } else {
      console.log('[DocumentIntake] Document not indexed in File Search or missing store ID, no cleanup needed');
    }

    // Delete from database
    console.log(`[DocumentIntake] Deleting from database: ${documentId}`);
    DocumentRepository.delete(documentId);
    console.log(`[DocumentIntake] Successfully deleted document: ${documentId}`);

    res.json({ success: true });
  } catch (error) {
    console.error('[DocumentIntake] Delete document error:', error);
    console.error('[DocumentIntake] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

/**
 * GET /api/documents/:documentId/download
 *
 * Download document directly from local storage (fallback for non-S3 documents).
 */
router.get('/documents/:documentId/download', async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const document = DocumentRepository.findById(documentId);

    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    // Get case file to find workspace path
    const caseFile = CaseFileRepository.findById(document.case_file_id);
    if (!caseFile) {
      res.status(404).json({ error: 'Case file not found' });
      return;
    }

    // Construct file path - files are stored in documents/{folder_name}/original.{ext}
    const docFolderPath = path.join(caseFile.workspace_path, 'documents', document.folder_name);
    const originalFileName = `original${path.extname(document.filename)}`;
    const filePath = path.join(docFolderPath, originalFileName);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`[DocumentIntake] File not found: ${filePath}`);
      res.status(404).json({ error: 'File not found on disk' });
      return;
    }

    // Send file for download
    // Note: dotfiles: 'allow' is required because workspace paths are in ~/.justicequest/
    res.download(filePath, document.filename, { dotfiles: 'allow' }, (err) => {
      if (err) {
        console.error('[DocumentIntake] Download error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Download failed' });
        }
      }
    });
  } catch (error) {
    console.error('[DocumentIntake] Download document error:', error);
    res.status(500).json({ error: 'Failed to download document' });
  }
});

/**
 * GET /api/cases/:caseFileId/documents/stats
 *
 * Get processing statistics for a case file.
 */
router.get('/cases/:caseFileId/documents/stats', async (req: Request, res: Response) => {
  try {
    const { caseFileId } = req.params;
    const stats = DocumentRepository.getStats(caseFileId);
    res.json(stats);
  } catch (error) {
    console.error('[DocumentIntake] Get stats error:', error);
    res.status(500).json({ error: 'Failed to get document stats' });
  }
});

export default router;
