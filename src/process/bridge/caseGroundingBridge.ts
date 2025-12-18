/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { NarrativeService } from '@process/documents/services/NarrativeService';
import { PartyExtractor } from '@process/documents/services/PartyExtractor';
import { CaseFileRepository } from '../../webserver/auth/repository/CaseFileRepository';

/**
 * Initialize case grounding IPC bridge
 */
export function initCaseGroundingBridge(): void {
  // Get narrative status
  ipcBridge.caseGrounding.getNarrativeStatus.provider(async ({ caseFileId }) => {
    try {
      const status = await NarrativeService.getNarrativeStatus(caseFileId);
      return { success: true, data: status };
    } catch (error: any) {
      console.error('[CaseGroundingBridge] Error getting narrative status:', error);
      return { success: false, error: error.message };
    }
  });

  // Save narrative
  ipcBridge.caseGrounding.saveNarrative.provider(async ({ caseFileId, content, captureMethod }) => {
    try {
      const result = await NarrativeService.saveNarrative(caseFileId, content, captureMethod);
      return { success: true, data: result };
    } catch (error: any) {
      console.error('[CaseGroundingBridge] Error saving narrative:', error);
      return { success: false, error: error.message };
    }
  });

  // Get grounding status
  // eslint-disable-next-line require-await
  ipcBridge.caseGrounding.getGroundingStatus.provider(async ({ caseFileId }) => {
    try {
      const status = CaseFileRepository.getGroundingStatus(caseFileId);

      if (!status) {
        return { success: false, error: 'Case not found' };
      }

      return { success: true, data: status };
    } catch (error: any) {
      console.error('[CaseGroundingBridge] Error getting grounding status:', error);
      return { success: false, error: error.message };
    }
  });

  // Extract parties from narrative
  ipcBridge.caseGrounding.extractParties.provider(async ({ caseFileId, narrativeContent }) => {
    try {
      const result = await PartyExtractor.extractParties(caseFileId, narrativeContent);
      return { success: true, data: result };
    } catch (error: any) {
      console.error('[CaseGroundingBridge] Error extracting parties:', error);
      return { success: false, error: error.message };
    }
  });
}
