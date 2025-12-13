/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Request, Response, Router } from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { TextExtractor } from '../../process/documents/services/TextExtractor';
import { detectFileType } from '../../process/documents/utils/fileTypeDetector';
import { AuthMiddleware } from '../auth/middleware/AuthMiddleware';
import { CaseFileRepository } from '../auth/repository/CaseFileRepository';
import { DocumentRepository } from '../auth/repository/DocumentRepository';

const router = Router();
const upload = multer({ dest: 'uploads/' });

// All routes require authentication
router.use(AuthMiddleware.authenticateToken);

router.post('/cases/:caseFileId/documents/upload',
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      const { caseFileId } = req.params;
      const file = req.file;

      if (!file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      // Get workspace path from case file
      const caseFile = CaseFileRepository.findById(caseFileId);
      if (!caseFile) {
        res.status(404).json({ error: 'Case file not found' });
        return;
      }

      const workspacePath = caseFile.workspace_path;
      const intakePath = path.join(workspacePath, 'intake');
      fs.mkdirSync(intakePath, { recursive: true });

      const newFilePath = path.join(intakePath, file.originalname);
      fs.renameSync(file.path, newFilePath);

      // Detect file type
      const fileType = await detectFileType(file.originalname);

      // Create folder name from filename (sanitized)
      const folderName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');

      const createdDoc = DocumentRepository.create({
        case_file_id: caseFileId,
        filename: file.originalname,
        folder_name: folderName,
        file_type: fileType,
        processing_status: 'pending',
        has_text_extraction: 0,
        has_metadata: 0,
        rag_indexed: 0,
        uploaded_at: Date.now(),
      });

      // Start async text extraction (full pipeline)
      const textExtractor = new TextExtractor(
        process.env.MISTRAL_API_KEY || '',
        process.env.GEMINI_API_KEY || ''
      );
      textExtractor.extractDocument(createdDoc.id, caseFileId, newFilePath).catch(err => {
        console.error('[DocumentIntake] Background processing failed:', err);
      });

      res.json({ success: true, documentId: createdDoc.id });
    } catch (error) {
      console.error('[DocumentIntake] Upload error:', error);
      res.status(500).json({ error: 'Upload failed' });
    }
  }
);

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

router.delete('/documents/:documentId', async (req: Request, res: Response) => {
    try {
        const { documentId } = req.params;
        DocumentRepository.delete(documentId);
        res.json({ success: true });
    } catch (error) {
        console.error('[DocumentIntake] Delete document error:', error);
        res.status(500).json({ error: 'Failed to delete document' });
    }
});

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

        // Construct file path
        const filePath = path.join(caseFile.workspace_path, 'documents', 'originals', document.filename);

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            res.status(404).json({ error: 'File not found on disk' });
            return;
        }

        // Send file for download
        res.download(filePath, document.filename, (err) => {
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
