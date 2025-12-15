/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Case Summary Progress WebSocket Events
 * 
 * Emits real-time progress updates during case summary generation
 */

/**
 * Summary progress event types
 */
export type SummaryProgressEventType = 
  | 'summary:generating'
  | 'summary:complete'
  | 'summary:failed';

/**
 * Summary progress event structure
 */
export interface SummaryProgressEvent {
  /** Event type */
  type: SummaryProgressEventType;
  
  /** Case file ID */
  caseFileId: string;
  
  /** Progress percentage (0-100) */
  progress: number;
  
  /** Current batch being processed */
  currentBatch?: number;
  
  /** Total number of batches */
  totalBatches?: number;
  
  /** Human-readable status message */
  message: string;
  
  /** Error message (if type is 'summary:failed') */
  error?: string;
  
  /** Summary version (if type is 'summary:complete') */
  version?: number;
  
  /** Document count (if type is 'summary:complete') */
  documentCount?: number;
  
  /** Timestamp */
  timestamp: number;
}

/**
 * WebSocket manager interface (to avoid circular dependencies)
 */
interface IWebSocketManager {
  emitToCaseFile(caseFileId: string, event: string, data: any): void;
}

/**
 * WebSocket manager instance (injected at runtime)
 */
let wsManager: IWebSocketManager | null = null;

/**
 * Initialize the summary progress emitter with WebSocket manager
 * 
 * @param manager - WebSocket manager instance
 */
export function initializeSummaryProgress(manager: IWebSocketManager): void {
  wsManager = manager;
  console.log('[CaseSummary] Progress emitter initialized');
}

/**
 * Emit summary progress event to WebSocket clients
 * 
 * @param event - Progress event to emit
 */
export function emitSummaryProgress(event: SummaryProgressEvent): void {
  if (!wsManager) {
    console.warn('[CaseSummary] WebSocket manager not initialized, skipping progress event');
    return;
  }

  try {
    // Emit to all clients connected to this case file
    wsManager.emitToCaseFile(event.caseFileId, 'summary:progress', event);
    
    console.log('[CaseSummary] Emitted progress event:', {
      type: event.type,
      caseFileId: event.caseFileId,
      progress: event.progress,
    });
  } catch (error) {
    console.error('[CaseSummary] Failed to emit progress event:', error);
  }
}

/**
 * Emit summary generating event
 * 
 * @param caseFileId - Case file ID
 * @param progress - Progress percentage (0-100)
 * @param currentBatch - Current batch number
 * @param totalBatches - Total batch count
 */
export function emitSummaryGenerating(
  caseFileId: string,
  progress: number,
  currentBatch: number,
  totalBatches: number
): void {
  emitSummaryProgress({
    type: 'summary:generating',
    caseFileId,
    progress,
    currentBatch,
    totalBatches,
    message: `Generating summary... (batch ${currentBatch}/${totalBatches})`,
    timestamp: Date.now(),
  });
}

/**
 * Emit summary complete event
 * 
 * @param caseFileId - Case file ID
 * @param version - Summary version
 * @param documentCount - Number of documents processed
 */
export function emitSummaryComplete(
  caseFileId: string,
  version: number,
  documentCount: number
): void {
  emitSummaryProgress({
    type: 'summary:complete',
    caseFileId,
    progress: 100,
    message: 'Case summary generated successfully',
    version,
    documentCount,
    timestamp: Date.now(),
  });
}

/**
 * Emit summary failed event
 * 
 * @param caseFileId - Case file ID
 * @param error - Error message
 */
export function emitSummaryFailed(
  caseFileId: string,
  error: string
): void {
  emitSummaryProgress({
    type: 'summary:failed',
    caseFileId,
    progress: 0,
    message: 'Summary generation failed',
    error,
    timestamp: Date.now(),
  });
}

