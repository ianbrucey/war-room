/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { CaseSummaryGenerator } from '@/process/documents/services/CaseSummaryGenerator';
import { AuthMiddleware } from '@/webserver/auth/middleware/AuthMiddleware';
import { CaseFileRepository } from '@/webserver/auth/repository/CaseFileRepository';
import { apiRateLimiter, authenticatedActionLimiter } from '@/webserver/middleware/security';
import { emitSummaryComplete, emitSummaryFailed, emitSummaryGenerating } from '@/webserver/websocket/caseSummaryProgress';
import type { Express, Request, Response } from 'express';

export function registerCaseRoutes(app: Express): void {
  /**
   * List all case files for the authenticated user
   * GET /api/cases
   */
  app.get('/api/cases', apiRateLimiter, AuthMiddleware.authenticateToken, (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const cases = CaseFileRepository.findByUserId(userId);

      res.json({
        success: true,
        cases,
      });
    } catch (error) {
      console.error('[CaseRoutes] List cases error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  });

  /**
   * Create a new case file
   * POST /api/cases
   */
  app.post('/api/cases', apiRateLimiter, AuthMiddleware.authenticateToken, authenticatedActionLimiter, (req: Request, res: Response) => {
    try {
      const { title, case_number } = req.body;
      const userId = req.user!.id;

      // Validate input
      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: 'Title is required',
        });
        return;
      }

      // Create case file
      const caseFile = CaseFileRepository.create(title.trim(), userId, case_number);

      res.json({
        success: true,
        case: caseFile,
      });
    } catch (error) {
      console.error('[CaseRoutes] Create case error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  });

  /**
   * Get a specific case file by ID
   * GET /api/cases/:id
   */
  app.get('/api/cases/:id', apiRateLimiter, AuthMiddleware.authenticateToken, (req: Request, res: Response) => {
    try {
      const caseFileId = req.params.id;
      const userId = req.user!.id;

      const caseFile = CaseFileRepository.findById(caseFileId);

      if (!caseFile) {
        res.status(404).json({
          success: false,
          error: 'Case file not found',
        });
        return;
      }

      // Check ownership
      if (caseFile.user_id !== userId) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      res.json({
        success: true,
        case: caseFile,
      });
    } catch (error) {
      console.error('[CaseRoutes] Get case error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  });

  /**
   * Get case file by workspace path
   * GET /api/cases/by-workspace?path=...
   */
  app.get('/api/cases/by-workspace', apiRateLimiter, AuthMiddleware.authenticateToken, (req: Request, res: Response) => {
    try {
      const workspacePath = req.query.path as string;
      const userId = req.user!.id;

      if (!workspacePath) {
        res.status(400).json({
          success: false,
          error: 'Workspace path is required',
        });
        return;
      }

      const caseFile = CaseFileRepository.findByWorkspacePath(workspacePath);

      if (!caseFile) {
        res.status(404).json({
          success: false,
          error: 'Case file not found for this workspace',
        });
        return;
      }

      // Check ownership
      if (caseFile.user_id !== userId) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      res.json({
        success: true,
        case: caseFile,
      });
    } catch (error) {
      console.error('[CaseRoutes] Get case by workspace error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  });

  /**
   * Update a case file
   * PATCH /api/cases/:id
   */
  app.patch('/api/cases/:id', apiRateLimiter, AuthMiddleware.authenticateToken, authenticatedActionLimiter, (req: Request, res: Response) => {
    try {
      const caseFileId = req.params.id;
      const userId = req.user!.id;
      const { title, case_number } = req.body;

      // Check ownership
      if (!CaseFileRepository.existsForUser(caseFileId, userId)) {
        res.status(404).json({
          success: false,
          error: 'Case file not found',
        });
        return;
      }

      // Build updates object
      const updates: Partial<{ title: string; case_number: string | null }> = {};
      if (title !== undefined) {
        if (typeof title !== 'string' || title.trim().length === 0) {
          res.status(400).json({
            success: false,
            error: 'Title must be a non-empty string',
          });
          return;
        }
        updates.title = title.trim();
      }
      if (case_number !== undefined) {
        updates.case_number = case_number;
      }

      // Update case file
      const updatedCase = CaseFileRepository.update(caseFileId, updates);

      res.json({
        success: true,
        case: updatedCase,
      });
    } catch (error) {
      console.error('[CaseRoutes] Update case error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  });

  /**
   * Delete a case file
   * DELETE /api/cases/:id
   */
  app.delete('/api/cases/:id', apiRateLimiter, AuthMiddleware.authenticateToken, authenticatedActionLimiter, (req: Request, res: Response) => {
    try {
      const caseFileId = req.params.id;
      const userId = req.user!.id;

      // Check ownership
      if (!CaseFileRepository.existsForUser(caseFileId, userId)) {
        res.status(404).json({
          success: false,
          error: 'Case file not found',
        });
        return;
      }

      // Delete case file (will cascade delete all conversations)
      const deleted = CaseFileRepository.delete(caseFileId);

      if (!deleted) {
        res.status(500).json({
          success: false,
          error: 'Failed to delete case file',
        });
        return;
      }

      res.json({
        success: true,
      });
    } catch (error) {
      console.error('[CaseRoutes] Delete case error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  });

  /**
   * Get case summary status
   * GET /api/cases/:id/summary/status
   */
  app.get('/api/cases/:id/summary/status', apiRateLimiter, AuthMiddleware.authenticateToken, (req: Request, res: Response) => {
    try {
      const caseId = req.params.id;
      const userId = req.user!.id;

      // Verify case ownership
      const caseFile = CaseFileRepository.findById(caseId);
      if (!caseFile) {
        res.status(404).json({
          success: false,
          error: 'Case not found',
        });
        return;
      }

      if (caseFile.user_id !== userId) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      // Get summary status
      const status = CaseFileRepository.getSummaryStatus(caseId);

      res.json({
        success: true,
        status,
      });
    } catch (error) {
      console.error('[CaseRoutes] Get summary status error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  });

  /**
   * Generate new case summary
   * POST /api/cases/:id/summary/generate
   */
  app.post('/api/cases/:id/summary/generate', apiRateLimiter, AuthMiddleware.authenticateToken, authenticatedActionLimiter, async (req: Request, res: Response) => {
    try {
      const caseId = req.params.id;
      const userId = req.user!.id;

      // Verify case ownership
      const caseFile = CaseFileRepository.findById(caseId);
      if (!caseFile) {
        res.status(404).json({
          success: false,
          error: 'Case not found',
        });
        return;
      }

      if (caseFile.user_id !== userId) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      // Check if already generating
      const currentStatus = CaseFileRepository.getSummaryStatus(caseId);
      if (currentStatus?.status === 'generating') {
        res.status(409).json({
          success: false,
          error: 'Summary generation already in progress',
        });
        return;
      }

      // Start generation in background
      const generator = new CaseSummaryGenerator();

      // Don't await - let it run in background
      generator.generate(caseId, (percent, currentBatch, totalBatches) => {
        emitSummaryGenerating(caseId, percent, currentBatch, totalBatches);
      }).then(() => {
        const status = CaseFileRepository.getSummaryStatus(caseId);
        emitSummaryComplete(caseId, status?.version ?? 1, status?.documentCount ?? 0);
      }).catch((error) => {
        emitSummaryFailed(caseId, error.message);
      });

      res.json({
        success: true,
        message: 'Summary generation started',
      });
    } catch (error) {
      console.error('[CaseRoutes] Generate summary error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  });

  /**
   * Update existing case summary with new documents
   * POST /api/cases/:id/summary/update
   */
  app.post('/api/cases/:id/summary/update', apiRateLimiter, AuthMiddleware.authenticateToken, authenticatedActionLimiter, async (req: Request, res: Response) => {
    try {
      const caseId = req.params.id;
      const userId = req.user!.id;

      // Verify case ownership
      const caseFile = CaseFileRepository.findById(caseId);
      if (!caseFile) {
        res.status(404).json({
          success: false,
          error: 'Case not found',
        });
        return;
      }

      if (caseFile.user_id !== userId) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      // Check if already generating
      const currentStatus = CaseFileRepository.getSummaryStatus(caseId);
      if (currentStatus?.status === 'generating') {
        res.status(409).json({
          success: false,
          error: 'Summary generation already in progress',
        });
        return;
      }

      // Start update in background
      const generator = new CaseSummaryGenerator();

      generator.update(caseId, (percent, currentBatch, totalBatches) => {
        emitSummaryGenerating(caseId, percent, currentBatch, totalBatches);
      }).then(() => {
        const status = CaseFileRepository.getSummaryStatus(caseId);
        emitSummaryComplete(caseId, status?.version ?? 1, status?.documentCount ?? 0);
      }).catch((error) => {
        emitSummaryFailed(caseId, error.message);
      });

      res.json({
        success: true,
        message: 'Summary update started',
      });
    } catch (error) {
      console.error('[CaseRoutes] Update summary error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  });

  /**
   * Regenerate case summary from scratch
   * POST /api/cases/:id/summary/regenerate
   */
  app.post('/api/cases/:id/summary/regenerate', apiRateLimiter, AuthMiddleware.authenticateToken, authenticatedActionLimiter, async (req: Request, res: Response) => {
    try {
      const caseId = req.params.id;
      const userId = req.user!.id;

      // Verify case ownership
      const caseFile = CaseFileRepository.findById(caseId);
      if (!caseFile) {
        res.status(404).json({
          success: false,
          error: 'Case not found',
        });
        return;
      }

      if (caseFile.user_id !== userId) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      // Check if already generating
      const currentStatus = CaseFileRepository.getSummaryStatus(caseId);
      if (currentStatus?.status === 'generating') {
        res.status(409).json({
          success: false,
          error: 'Summary generation already in progress',
        });
        return;
      }

      // Start regeneration in background
      const generator = new CaseSummaryGenerator();

      generator.regenerate(caseId, (percent, currentBatch, totalBatches) => {
        emitSummaryGenerating(caseId, percent, currentBatch, totalBatches);
      }).then(() => {
        const status = CaseFileRepository.getSummaryStatus(caseId);
        emitSummaryComplete(caseId, status?.version ?? 1, status?.documentCount ?? 0);
      }).catch((error) => {
        emitSummaryFailed(caseId, error.message);
      });

      res.json({
        success: true,
        message: 'Summary regeneration started',
      });
    } catch (error) {
      console.error('[CaseRoutes] Regenerate summary error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  });
}
