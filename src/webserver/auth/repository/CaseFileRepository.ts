/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { getDatabase } from '@process/database/export';
import type { ICaseFile, IQueryResult } from '@process/database/types';

/**
 * Unwrap database query result, throw error on failure
 * 解包数据库查询结果，失败时抛出异常
 */
function unwrap<T>(result: IQueryResult<T>, errorMessage: string): T {
  if (!result.success || typeof result.data === 'undefined' || result.data === null) {
    throw new Error(result.error || errorMessage);
  }
  return result.data;
}

/**
 * Case File Repository - Provides case file data access interface
 * 案件文件仓库 - 提供案件文件数据访问接口
 */
export const CaseFileRepository = {
  /**
   * Create a new case file
   * 创建新案件文件
   */
  create(title: string, userId: string, caseNumber?: string): ICaseFile {
    const db = getDatabase();
    const result = db.createCaseFile(title, userId, caseNumber);
    return unwrap(result, 'Failed to create case file');
  },

  /**
   * Get case file by ID
   * 通过 ID 获取案件文件
   */
  findById(caseFileId: string): ICaseFile | null {
    const db = getDatabase();
    const result = db.getCaseFile(caseFileId);
    if (!result.success) {
      return null;
    }
    return result.data ?? null;
  },

  /**
   * Get all case files for a user
   * 获取用户的所有案件文件
   */
  findByUserId(userId: string, page = 0, pageSize = 50): ICaseFile[] {
    const db = getDatabase();
    const result = db.getUserCaseFiles(userId, page, pageSize);
    return result.data;
  },

  /**
   * Update case file
   * 更新案件文件
   */
  update(caseFileId: string, updates: Partial<Pick<ICaseFile, 'title' | 'case_number'>>): ICaseFile {
    const db = getDatabase();
    const result = db.updateCaseFile(caseFileId, updates);
    return unwrap(result, 'Failed to update case file');
  },

  /**
   * Delete case file
   * 删除案件文件
   */
  delete(caseFileId: string): boolean {
    const db = getDatabase();
    const result = db.deleteCaseFile(caseFileId);
    return unwrap(result, 'Failed to delete case file');
  },

  /**
   * Check if case file exists and belongs to user
   * 检查案件文件是否存在且属于用户
   */
  existsForUser(caseFileId: string, userId: string): boolean {
    const caseFile = this.findById(caseFileId);
    return caseFile !== null && caseFile.user_id === userId;
  },

  /**
   * Find case file by workspace path
   * 通过工作空间路径查找案件文件
   */
  findByWorkspacePath(workspacePath: string): ICaseFile | null {
    const db = getDatabase();
    try {
      const row = db.querySingle('SELECT * FROM case_files WHERE workspace_path = ?', workspacePath);
      return row ? (row as ICaseFile) : null;
    } catch (error) {
      console.error('[CaseFileRepository] Failed to find by workspace path:', error);
      return null;
    }
  },

  // ========== Case Summary Methods ==========

  /**
   * Get summary status for a case
   * 获取案件摘要状态
   */
  getSummaryStatus(caseFileId: string): {
    status: 'generating' | 'generated' | 'stale' | 'failed' | null;
    generatedAt: number | null;
    version: number;
    documentCount: number;
  } | null {
    const caseFile = this.findById(caseFileId);
    if (!caseFile) {
      return null;
    }
    return {
      status: caseFile.case_summary_status ?? null,
      generatedAt: caseFile.case_summary_generated_at ?? null,
      version: caseFile.case_summary_version ?? 0,
      documentCount: caseFile.case_summary_document_count ?? 0,
    };
  },

  /**
   * Update summary status
   * 更新摘要状态
   */
  updateSummaryStatus(caseFileId: string, status: 'generating' | 'generated' | 'stale' | 'failed'): void {
    const db = getDatabase();
    try {
      db.exec(
        `UPDATE case_files
         SET case_summary_status = ?, updated_at = ?
         WHERE id = ?`,
        status,
        Date.now(),
        caseFileId
      );
      console.log(`[CaseFileRepository] Updated summary status to '${status}' for case ${caseFileId}`);
    } catch (error) {
      console.error('[CaseFileRepository] Failed to update summary status:', error);
      throw error;
    }
  },

  /**
   * Mark summary as generated (successful completion)
   * 标记摘要为已生成（成功完成）
   */
  markSummaryGenerated(caseFileId: string, documentCount: number): void {
    const db = getDatabase();
    try {
      db.exec(
        `UPDATE case_files
         SET case_summary_status = 'generated',
             case_summary_generated_at = ?,
             case_summary_version = case_summary_version + 1,
             case_summary_document_count = ?,
             updated_at = ?
         WHERE id = ?`,
        Date.now(),
        documentCount,
        Date.now(),
        caseFileId
      );
      console.log(`[CaseFileRepository] Marked summary as generated for case ${caseFileId} (${documentCount} documents)`);
    } catch (error) {
      console.error('[CaseFileRepository] Failed to mark summary as generated:', error);
      throw error;
    }
  },

  /**
   * Mark summary as stale (new documents added)
   * 标记摘要为过期（添加了新文档）
   */
  markSummaryStale(caseFileId: string): void {
    const db = getDatabase();
    try {
      // Only update if current status is 'generated'
      db.exec(
        `UPDATE case_files
         SET case_summary_status = 'stale', updated_at = ?
         WHERE id = ? AND case_summary_status = 'generated'`,
        Date.now(),
        caseFileId
      );
      console.log(`[CaseFileRepository] Marked summary as stale for case ${caseFileId}`);
    } catch (error) {
      console.error('[CaseFileRepository] Failed to mark summary as stale:', error);
      throw error;
    }
  },

  /**
   * Mark summary as failed
   * 标记摘要为失败
   */
  markSummaryFailed(caseFileId: string): void {
    const db = getDatabase();
    try {
      db.exec(
        `UPDATE case_files
         SET case_summary_status = 'failed', updated_at = ?
         WHERE id = ?`,
        Date.now(),
        caseFileId
      );
      console.log(`[CaseFileRepository] Marked summary as failed for case ${caseFileId}`);
    } catch (error) {
      console.error('[CaseFileRepository] Failed to mark summary as failed:', error);
      throw error;
    }
  },
};
