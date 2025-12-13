/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ProcessingStatus } from '@process/documents/types';

/**
 * Document progress event types
 */
export type DocumentProgressEventType = 
  | 'document:upload'
  | 'document:extracting'
  | 'document:analyzing'
  | 'document:indexing'
  | 'document:complete'
  | 'document:error';

/**
 * Document progress event structure
 */
export interface DocumentProgressEvent {
  /** Event type */
  type: DocumentProgressEventType;
  
  /** Document ID */
  documentId: string;
  
  /** Case file ID */
  caseFileId: string;
  
  /** Original filename */
  filename: string;
  
  /** Progress percentage (0-100) */
  progress: number;
  
  /** Human-readable status message */
  message: string;
  
  /** Error message (if type is 'document:error') */
  error?: string;
  
  /** Timestamp */
  timestamp: number;
}

/**
 * WebSocket manager interface (to avoid circular dependencies)
 * The actual implementation should be in the WebSocket server
 */
interface IWebSocketManager {
  emitToCaseFile(caseFileId: string, event: string, data: any): void;
}

/**
 * Singleton WebSocket manager reference
 * This will be injected by the WebSocket server initialization
 */
let wsManager: IWebSocketManager | null = null;

/**
 * Initialize the WebSocket manager for document progress
 * Should be called during server startup
 * 
 * @param manager - WebSocket manager instance
 */
export function initializeDocumentProgress(manager: IWebSocketManager): void {
  wsManager = manager;
  console.log('[DocumentIntake] WebSocket progress initialized');
}

/**
 * Emit document progress event to WebSocket clients
 * 
 * @param event - Progress event to emit
 */
export function emitDocumentProgress(event: DocumentProgressEvent): void {
  if (!wsManager) {
    console.warn('[DocumentIntake] WebSocket manager not initialized, skipping progress event');
    return;
  }

  try {
    // Emit to all clients connected to this case file
    wsManager.emitToCaseFile(event.caseFileId, 'document:progress', event);
    
    console.log('[DocumentIntake] Emitted progress event:', {
      type: event.type,
      documentId: event.documentId,
      progress: event.progress,
    });
  } catch (error) {
    console.error('[DocumentIntake] Failed to emit progress event:', error);
  }
}

/**
 * Create and emit a document upload event
 * 
 * @param documentId - Document ID
 * @param caseFileId - Case file ID
 * @param filename - Original filename
 */
export function emitDocumentUpload(
  documentId: string,
  caseFileId: string,
  filename: string
): void {
  emitDocumentProgress({
    type: 'document:upload',
    documentId,
    caseFileId,
    filename,
    progress: 10,
    message: `Uploaded: ${filename}`,
    timestamp: Date.now(),
  });
}

/**
 * Create and emit a document extracting event
 * 
 * @param documentId - Document ID
 * @param caseFileId - Case file ID
 * @param filename - Original filename
 */
export function emitDocumentExtracting(
  documentId: string,
  caseFileId: string,
  filename: string
): void {
  emitDocumentProgress({
    type: 'document:extracting',
    documentId,
    caseFileId,
    filename,
    progress: 30,
    message: `Extracting text from: ${filename}`,
    timestamp: Date.now(),
  });
}

/**
 * Create and emit a document analyzing event
 * 
 * @param documentId - Document ID
 * @param caseFileId - Case file ID
 * @param filename - Original filename
 */
export function emitDocumentAnalyzing(
  documentId: string,
  caseFileId: string,
  filename: string
): void {
  emitDocumentProgress({
    type: 'document:analyzing',
    documentId,
    caseFileId,
    filename,
    progress: 60,
    message: `Analyzing document: ${filename}`,
    timestamp: Date.now(),
  });
}

/**
 * Create and emit a document indexing event
 * 
 * @param documentId - Document ID
 * @param caseFileId - Case file ID
 * @param filename - Original filename
 */
export function emitDocumentIndexing(
  documentId: string,
  caseFileId: string,
  filename: string
): void {
  emitDocumentProgress({
    type: 'document:indexing',
    documentId,
    caseFileId,
    filename,
    progress: 85,
    message: `Indexing for search: ${filename}`,
    timestamp: Date.now(),
  });
}

/**
 * Create and emit a document complete event
 * 
 * @param documentId - Document ID
 * @param caseFileId - Case file ID
 * @param filename - Original filename
 */
export function emitDocumentComplete(
  documentId: string,
  caseFileId: string,
  filename: string
): void {
  emitDocumentProgress({
    type: 'document:complete',
    documentId,
    caseFileId,
    filename,
    progress: 100,
    message: `Processing complete: ${filename}`,
    timestamp: Date.now(),
  });
}

/**
 * Create and emit a document error event
 * 
 * @param documentId - Document ID
 * @param caseFileId - Case file ID
 * @param filename - Original filename
 * @param error - Error message
 */
export function emitDocumentError(
  documentId: string,
  caseFileId: string,
  filename: string,
  error: string
): void {
  emitDocumentProgress({
    type: 'document:error',
    documentId,
    caseFileId,
    filename,
    progress: 0,
    message: `Error processing: ${filename}`,
    error,
    timestamp: Date.now(),
  });
}

/**
 * Get progress percentage from processing status
 * 
 * @param status - Processing status
 * @returns Progress percentage (0-100)
 */
export function getProgressFromStatus(status: ProcessingStatus): number {
  switch (status) {
    case 'pending':
      return 10;
    case 'extracting':
      return 30;
    case 'analyzing':
      return 60;
    case 'indexing':
      return 85;
    case 'complete':
      return 100;
    case 'failed':
      return 0;
    default:
      return 0;
  }
}

/**
 * Get human-readable message from processing status
 * 
 * @param status - Processing status
 * @param filename - Original filename
 * @returns Status message
 */
export function getMessageFromStatus(status: ProcessingStatus, filename: string): string {
  switch (status) {
    case 'pending':
      return `Queued: ${filename}`;
    case 'extracting':
      return `Extracting text from: ${filename}`;
    case 'analyzing':
      return `Analyzing document: ${filename}`;
    case 'indexing':
      return `Indexing for search: ${filename}`;
    case 'complete':
      return `Processing complete: ${filename}`;
    case 'failed':
      return `Failed to process: ${filename}`;
    default:
      return `Processing: ${filename}`;
  }
}

/**
 * Emit progress event from processing status
 * Convenience function that determines event type from status
 * 
 * @param documentId - Document ID
 * @param caseFileId - Case file ID
 * @param filename - Original filename
 * @param status - Processing status
 * @param error - Optional error message
 */
export function emitProgressFromStatus(
  documentId: string,
  caseFileId: string,
  filename: string,
  status: ProcessingStatus,
  error?: string
): void {
  const eventTypeMap: Record<ProcessingStatus, DocumentProgressEventType> = {
    'pending': 'document:upload',
    'extracting': 'document:extracting',
    'analyzing': 'document:analyzing',
    'indexing': 'document:indexing',
    'complete': 'document:complete',
    'failed': 'document:error',
  };

  const event: DocumentProgressEvent = {
    type: eventTypeMap[status],
    documentId,
    caseFileId,
    filename,
    progress: getProgressFromStatus(status),
    message: getMessageFromStatus(status, filename),
    timestamp: Date.now(),
  };

  if (error) {
    event.error = error;
  }

  emitDocumentProgress(event);
}
