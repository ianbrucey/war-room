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
};
