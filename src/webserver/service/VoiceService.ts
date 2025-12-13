/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { randomUUID } from 'crypto';
import fs from 'fs';
import { OpenAI } from 'openai';
import os from 'os';
import path from 'path';

interface VoiceSession {
  buffer: Buffer;
  lastActivity: number;
}

export class VoiceService {
  private static instance: VoiceService;
  private sessions: Map<string, VoiceSession> = new Map();
  private openai: OpenAI | null = null;

  private constructor() {
    // Initialize OpenAI client if key is present
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    } else {
      console.warn('[VoiceService] OPENAI_API_KEY not found. Speech-to-text will not work.');
    }
  }

  public static getInstance(): VoiceService {
    if (!VoiceService.instance) {
      VoiceService.instance = new VoiceService();
    }
    return VoiceService.instance;
  }

  /**
   * Reset the audio buffer for a session
   */
  public startSession(sessionId: string): void {
    this.sessions.set(sessionId, {
      buffer: Buffer.alloc(0),
      lastActivity: Date.now(),
    });
    // console.log(`[VoiceService] Started session ${sessionId}`);
  }

  /**
   * Append audio chunk to session buffer
   */
  public appendAudio(sessionId: string, chunk: { data: { type: string; data: number[] } } | Buffer): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      // Auto-start if missing (resilience)
      this.startSession(sessionId);
      this.appendAudio(sessionId, chunk);
      return;
    }

    let bufferToAppend: Buffer;

    // Handle serialized Buffer object from JSON
    if (chunk && typeof chunk === 'object' && 'data' in chunk && Array.isArray((chunk as any).data)) {
        bufferToAppend = Buffer.from((chunk as any).data);
    } else if (Buffer.isBuffer(chunk)) {
        bufferToAppend = chunk;
    } else {
        console.warn('[VoiceService] Invalid chunk format received');
        return;
    }

    session.buffer = Buffer.concat([session.buffer, bufferToAppend]);
    session.lastActivity = Date.now();
  }

  /**
   * Transcribe the accumulated audio buffer
   */
  public async transcribeSession(sessionId: string): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session || session.buffer.length === 0) {
      return '';
    }

    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }

    const tempFilePath = path.join(os.tmpdir(), `voice-${sessionId}-${randomUUID()}.webm`);

    try {
      // Write buffer to temp file
      await fs.promises.writeFile(tempFilePath, session.buffer);

      // Call OpenAI Whisper API
      // Using a prompt helps Whisper understand context and improves punctuation
      const response = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(tempFilePath),
        model: 'whisper-1',
        language: 'en', // Default to English for now, could be parameterized
        prompt: 'This is a voice message with proper punctuation, capitalization, and formatting.', // Guides the model to include punctuation
      });

      // Clear buffer after successful transcription
      this.sessions.delete(sessionId);

      return response.text || '';
    } catch (error) {
      console.error('[VoiceService] Transcription failed:', error);
      throw error;
    } finally {
      // Clean up temp file
      try {
        await fs.promises.unlink(tempFilePath);
      } catch (e) {
        // Ignore unlink errors
      }
    }
  }

  /**
   * Check for inactive sessions and clean them up
   */
  public cleanupInactiveSessions(maxAgeMs = 300000): void { // 5 minutes
    const now = Date.now();
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.lastActivity > maxAgeMs) {
        this.sessions.delete(id);
      }
    }
  }
}
