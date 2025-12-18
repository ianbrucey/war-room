/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import type { DocumentProgressEvent } from '../../webserver/websocket/documentProgress';

interface UseWebSocketProgressOptions {
  caseFileId: string;
  enabled: boolean;
  onProgress: (event: DocumentProgressEvent) => void;
}

/**
 * Custom hook to listen for document progress events via WebSocket
 *
 * Subscribes to case file updates when enabled and calls the onProgress
 * callback when document:progress events are received.
 *
 * @param caseFileId - Case file ID to subscribe to
 * @param enabled - Whether to enable the subscription
 * @param onProgress - Callback to handle progress events
 */
export const useWebSocketProgress = ({ caseFileId, enabled, onProgress }: UseWebSocketProgressOptions) => {
  useEffect(() => {
    if (!enabled) return;

    // Get WebSocket connection (assuming it's already established)
    const ws = (window as any).__websocket;
    if (!ws) {
      console.warn('[WebSocket] Connection not available');
      return;
    }

    // Subscribe to case file updates
    ws.send(
      JSON.stringify({
        type: 'subscribe-case-file',
        caseFileId,
      })
    );

    console.log('[WebSocket] Subscribed to case file:', caseFileId);

    // Listen for progress events
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === 'document:progress') {
          console.log('[WebSocket] Received progress event:', data.data);
          onProgress(data.data);
        }
      } catch (error) {
        console.error('[WebSocket] Failed to parse message:', error);
      }
    };

    ws.addEventListener('message', handleMessage);

    // Cleanup
    return () => {
      ws.removeEventListener('message', handleMessage);
      ws.send(
        JSON.stringify({
          type: 'unsubscribe-case-file',
          caseFileId,
        })
      );
      console.log('[WebSocket] Unsubscribed from case file:', caseFileId);
    };
  }, [caseFileId, enabled, onProgress]);
};
