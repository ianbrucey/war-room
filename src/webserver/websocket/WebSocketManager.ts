/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { TokenMiddleware } from '@/webserver/auth/middleware/TokenMiddleware';
import { randomBytes } from 'crypto';
import type { IncomingMessage } from 'http';
import type { WebSocketServer } from 'ws';
import { WebSocket } from 'ws';
import { SHOW_OPEN_REQUEST_EVENT } from '../../adapter/constant';
import { WEBSOCKET_CONFIG } from '../config/constants';
import { VoiceService } from '../service/VoiceService';

interface ClientInfo {
  token: string;
  lastPing: number;
  /** Case files this client is subscribed to */
  subscribedCaseFiles: Set<string>;
}

/**
 * WebSocket 管理器 - 管理客户端连接、心跳检测和消息处理
 * WebSocket Manager - Manages client connections, heartbeat detection, and message handling
 */
export class WebSocketManager {
  private clients: Map<WebSocket, ClientInfo> = new Map();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  /** Singleton instance for global access */
  private static instance: WebSocketManager | null = null;

  constructor(private wss: WebSocketServer) {
    WebSocketManager.instance = this;
  }

  /**
   * Get singleton instance
   */
  static getInstance(): WebSocketManager | null {
    return WebSocketManager.instance;
  }

  /**
   * 初始化 WebSocket 管理器
   * Initialize WebSocket manager
   */
  initialize(): void {
    this.startHeartbeat();
    console.log('[WebSocketManager] Initialized with voice support (randomBytes fix applied)');
  }

  /**
   * 设置连接处理器
   * Setup connection handler
   */
  setupConnectionHandler(onMessage: (name: string, data: any, ws: WebSocket) => void): void {
    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const token = TokenMiddleware.extractWebSocketToken(req);

      if (!this.validateConnection(ws, token)) {
        return;
      }

      this.addClient(ws, token!);
      (ws as any)._socketId = randomBytes(16).toString('hex');
      this.setupMessageHandler(ws, onMessage);
      this.setupCloseHandler(ws);
      this.setupErrorHandler(ws);

      console.log('[WebSocketManager] Client connected');
    });
  }

  /**
   * 验证连接
   * Validate connection
   */
  private validateConnection(ws: WebSocket, token: string | null): boolean {
    if (!token) {
      ws.close(WEBSOCKET_CONFIG.CLOSE_CODES.POLICY_VIOLATION, 'No token provided');
      return false;
    }

    if (!TokenMiddleware.validateWebSocketToken(token)) {
      ws.close(WEBSOCKET_CONFIG.CLOSE_CODES.POLICY_VIOLATION, 'Invalid or expired token');
      return false;
    }

    return true;
  }

  /**
   * 添加客户端
   * Add client
   */
  private addClient(ws: WebSocket, token: string): void {
    this.clients.set(ws, {
      token,
      lastPing: Date.now(),
      subscribedCaseFiles: new Set(),
    });
  }

  /**
   * 设置消息处理器
   * Setup message handler
   */
  private setupMessageHandler(ws: WebSocket, onMessage: (name: string, data: any, ws: WebSocket) => void): void {
    ws.on('message', (rawData) => {
      try {
        const parsed = JSON.parse(rawData.toString());
        const { name, data } = parsed;

        // Handle pong response - update last ping time
        if (name === 'pong') {
          this.updateLastPing(ws);
          return;
        }

        // Handle file selection request - forward to client
        if (name === 'subscribe-show-open') {
          this.handleFileSelection(ws, data);
          return;
        }

        // Handle case file subscription
        if (name === 'subscribe-case-file') {
          this.handleCaseFileSubscription(ws, data);
          return;
        }

        // Handle case file unsubscription
        if (name === 'unsubscribe-case-file') {
          this.handleCaseFileUnsubscription(ws, data);
          return;
        }

        const voiceService = VoiceService.getInstance();
        const sessionId = (ws as any)._socketId || 'default-session';

        // Voice Handling - New simplified API (complete audio file)
        if (name === 'subscribe-voice-transcribe') {
          const requestId = data?.id || '';
          const audioData = data?.data?.data; // Array of bytes
          const fileExtension = data?.data?.fileExtension || 'webm';

          console.log('[WebSocketManager] Voice transcription request, size:', audioData?.length, 'format:', fileExtension);

          voiceService
            .transcribeAudio(audioData, fileExtension)
            .then((text) => {
              console.log('[WebSocketManager] Transcription received:', text?.substring(0, 100) + '...');
              ws.send(JSON.stringify({ name: 'voice-text', data: { text } }));
              ws.send(JSON.stringify({ name: `subscribe.callback-voice-transcribe${requestId}`, data: undefined }));
            })
            .catch((err) => {
              console.error('[WebSocketManager] Transcription error:', err.message);
              ws.send(JSON.stringify({ name: 'voice-error', data: { message: err.message } }));
              ws.send(JSON.stringify({ name: `subscribe.callback-voice-transcribe${requestId}`, data: undefined }));
            });
          return;
        }

        // Legacy Voice Handling (deprecated - kept for backwards compatibility)
        if (name === 'subscribe-voice-start') {
          const requestId = data?.id || '';
          console.log('[WebSocketManager] [LEGACY] Voice session starting for:', sessionId, 'requestId:', requestId);
          voiceService.startSession(sessionId);
          ws.send(JSON.stringify({ name: `subscribe.callback-voice-start${requestId}`, data: undefined }));
          return;
        } else if (name === 'subscribe-voice-chunk') {
          const requestId = data?.id || '';
          const chunkData = data?.data;
          voiceService.appendAudio(sessionId, chunkData);
          ws.send(JSON.stringify({ name: `subscribe.callback-voice-chunk${requestId}`, data: undefined }));
          return;
        } else if (name === 'subscribe-voice-end') {
          const requestId = data?.id || '';
          console.log('[WebSocketManager] [LEGACY] Voice session ending for:', sessionId, 'requestId:', requestId);
          voiceService
            .transcribeSession(sessionId)
            .then((text) => {
              console.log('[WebSocketManager] Transcription received:', text);
              ws.send(JSON.stringify({ name: 'voice-text', data: { text } }));
              ws.send(JSON.stringify({ name: `subscribe.callback-voice-end${requestId}`, data: undefined }));
            })
            .catch((err) => {
              console.error('[WebSocketManager] Transcription error:', err.message);
              ws.send(JSON.stringify({ name: 'voice-error', data: { message: err.message } }));
              ws.send(JSON.stringify({ name: `subscribe.callback-voice-end${requestId}`, data: undefined }));
            });
          return;
        }

        // Forward other messages to bridge system
        onMessage(name, data, ws);
      } catch (error) {
        ws.send(
          JSON.stringify({
            error: 'Invalid message format',
            expected: '{ "name": "event-name", "data": {...} }',
          })
        );
      }
    });
  }

  /**
   * 处理文件选择请求
   * Handle file selection request
   */
  private handleFileSelection(ws: WebSocket, data: any): void {
    // Extract properties from nested data structure
    const actualData = data.data || data;
    const properties = actualData.properties;

    // Determine if this is file selection mode
    const isFileMode = properties && properties.includes('openFile') && !properties.includes('openDirectory');

    // Send file selection request to client with isFileMode flag
    ws.send(JSON.stringify({ name: SHOW_OPEN_REQUEST_EVENT, data: { ...data, isFileMode } }));
  }

  /**
   * 设置关闭处理器
   * Setup close handler
   */
  private setupCloseHandler(ws: WebSocket): void {
    ws.on('close', () => {
      this.clients.delete(ws);
      console.log('[WebSocketManager] Client disconnected');
    });
  }

  /**
   * 设置错误处理器
   * Setup error handler
   */
  private setupErrorHandler(ws: WebSocket): void {
    ws.on('error', (error) => {
      console.error('[WebSocketManager] Client error:', error);
      this.clients.delete(ws);
    });
  }

  /**
   * 更新最后心跳时间
   * Update last ping time
   */
  private updateLastPing(ws: WebSocket): void {
    const clientInfo = this.clients.get(ws);
    if (clientInfo) {
      clientInfo.lastPing = Date.now();
    }
  }

  /**
   * 启动心跳检测
   * Start heartbeat detection
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.checkClients();
    }, WEBSOCKET_CONFIG.HEARTBEAT_INTERVAL);
  }

  /**
   * 检查所有客户端
   * Check all clients
   */
  private checkClients(): void {
    const now = Date.now();

    for (const [ws, clientInfo] of this.clients) {
      // Check if client timed out
      if (this.isClientTimeout(clientInfo, now)) {
        console.log('[WebSocketManager] Client heartbeat timeout, closing connection');
        ws.close(WEBSOCKET_CONFIG.CLOSE_CODES.POLICY_VIOLATION, 'Heartbeat timeout');
        this.clients.delete(ws);
        continue;
      }

      // Validate if WebSocket token is still valid
      if (!TokenMiddleware.validateWebSocketToken(clientInfo.token)) {
        console.log('[WebSocketManager] Token expired, closing connection');
        ws.send(JSON.stringify({ name: 'auth-expired', data: { message: 'Token expired, please login again' } }));
        ws.close(WEBSOCKET_CONFIG.CLOSE_CODES.POLICY_VIOLATION, 'Token expired');
        this.clients.delete(ws);
        continue;
      }

      // Send heartbeat ping
      this.sendHeartbeat(ws);
    }
  }

  /**
   * 检查客户端是否超时
   * Check if client timed out
   */
  private isClientTimeout(clientInfo: ClientInfo, now: number): boolean {
    return now - clientInfo.lastPing > WEBSOCKET_CONFIG.HEARTBEAT_TIMEOUT;
  }

  /**
   * 发送心跳
   * Send heartbeat
   */
  private sendHeartbeat(ws: WebSocket): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ name: 'ping', data: { timestamp: Date.now() } }));
    }
  }

  /**
   * 向所有客户端广播消息
   * Broadcast message to all clients
   */
  broadcast(name: string, data: any): void {
    const message = JSON.stringify({ name, data });

    for (const [ws, _clientInfo] of this.clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    }
  }

  /**
   * 向订阅特定案件文件的客户端发送消息
   * Emit message to clients subscribed to a specific case file
   *
   * @param caseFileId - Case file ID
   * @param event - Event name
   * @param data - Event data
   */
  emitToCaseFile(caseFileId: string, event: string, data: any): void {
    const message = JSON.stringify({ name: event, data });

    for (const [ws, clientInfo] of this.clients) {
      if (ws.readyState === WebSocket.OPEN && clientInfo.subscribedCaseFiles.has(caseFileId)) {
        ws.send(message);
      }
    }
  }

  /**
   * 处理案件文件订阅
   * Handle case file subscription request
   */
  private handleCaseFileSubscription(ws: WebSocket, data: any): void {
    const caseFileId = data?.caseFileId;
    if (!caseFileId) {
      ws.send(
        JSON.stringify({
          name: 'subscription-error',
          data: { error: 'caseFileId required' },
        })
      );
      return;
    }

    const clientInfo = this.clients.get(ws);
    if (clientInfo) {
      clientInfo.subscribedCaseFiles.add(caseFileId);
      ws.send(
        JSON.stringify({
          name: 'subscribed-case-file',
          data: { caseFileId, success: true },
        })
      );
      console.log(`[WebSocketManager] Client subscribed to case file: ${caseFileId}`);
    }
  }

  /**
   * 处理案件文件取消订阅
   * Handle case file unsubscription request
   */
  private handleCaseFileUnsubscription(ws: WebSocket, data: any): void {
    const caseFileId = data?.caseFileId;
    if (!caseFileId) {
      return;
    }

    const clientInfo = this.clients.get(ws);
    if (clientInfo) {
      clientInfo.subscribedCaseFiles.delete(caseFileId);
      console.log(`[WebSocketManager] Client unsubscribed from case file: ${caseFileId}`);
    }
  }

  /**
   * 获取连接的客户端数量
   * Get connected client count
   */
  getConnectedClientsCount(): number {
    return this.clients.size;
  }

  /**
   * 清理资源
   * Cleanup resources
   */
  destroy(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    // Close all connections
    for (const [ws] of this.clients) {
      ws.close(WEBSOCKET_CONFIG.CLOSE_CODES.NORMAL_CLOSURE, 'Server shutting down');
    }

    this.clients.clear();
    WebSocketManager.instance = null;
    console.log('[WebSocketManager] Destroyed');
  }
}

export default WebSocketManager;
