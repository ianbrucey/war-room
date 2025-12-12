import { ipcBridge } from '@/common';
import { getDatabase } from '@process/database';

export function initCaseBridge(): void {
  // Create new case
  ipcBridge.cases.create.provider(async ({ title, caseNumber, userId }) => {
    try {
      const db = getDatabase();
      const result = db.createCaseFile(title, userId, caseNumber);

      if (!result.success) {
        return { success: false, error: result.error };
      }

      return { success: true, data: result.data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Get all cases for user
  ipcBridge.cases.getAll.provider(async ({ userId, page, pageSize }) => {
    try {
      const db = getDatabase();
      const result = db.getUserCaseFiles(userId, page, pageSize);

      return {
        success: true,
        data: {
          data: result.data,
          total: result.total,
          hasMore: result.hasMore,
          page: result.page,
          pageSize: result.pageSize,
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Get single case
  ipcBridge.cases.get.provider(async ({ caseId }) => {
    try {
      const db = getDatabase();
      const result = db.getCaseFile(caseId);

      if (!result.success) {
        return { success: false, error: result.error };
      }

      return { success: true, data: result.data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Update case
  ipcBridge.cases.update.provider(async ({ caseId, updates }) => {
    try {
      const db = getDatabase();
      const result = db.updateCaseFile(caseId, updates);

      if (!result.success) {
        return { success: false, error: result.error };
      }

      return { success: true, data: result.data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Delete case
  ipcBridge.cases.delete.provider(async ({ caseId }) => {
    try {
      const db = getDatabase();
      const result = db.deleteCaseFile(caseId);

      if (!result.success) {
        return { success: false, error: result.error };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
