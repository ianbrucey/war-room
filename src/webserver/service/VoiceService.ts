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
  fileExtension: string;
}

export class VoiceService {
  private static instance: VoiceService;
  private sessions: Map<string, VoiceSession> = new Map();
  private openai: OpenAI | null = null;

  private constructor() {
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
   * Transcribe a complete audio file (new simplified API)
   * This receives the complete audio blob from the frontend
   */
  public async transcribeAudio(audioData: number[], fileExtension: string): Promise<string> {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }

    const buffer = Buffer.from(audioData);
    const tempFilePath = path.join(os.tmpdir(), `voice-${randomUUID()}.${fileExtension}`);

    console.log(`[VoiceService] Transcribing complete audio file, format: ${fileExtension}, size: ${buffer.length} bytes`);

    try {
      // Write buffer to temp file
      await fs.promises.writeFile(tempFilePath, buffer);

      // Call OpenAI Whisper API
      const response = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(tempFilePath),
        model: 'whisper-1',
        language: 'en',
        prompt: 'This is a voice message with proper punctuation, capitalization, and formatting.',
      });

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
   * Reset the audio buffer for a session
   */
  public startSession(sessionId: string): void {
    this.sessions.set(sessionId, {
      buffer: Buffer.alloc(0),
      lastActivity: Date.now(),
      fileExtension: 'webm', // Default, will be updated by first chunk
    });
    // console.log(`[VoiceService] Started session ${sessionId}`);
  }

  /**
   * Append audio chunk to session buffer
   */
  public appendAudio(
    sessionId: string,
    chunk: { data: { type: string; data: number[] }; fileExtension?: string } | Buffer,
    fileExtension?: string
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      // Auto-start if missing (resilience)
      this.startSession(sessionId);
      this.appendAudio(sessionId, chunk, fileExtension);
      return;
    }

    let bufferToAppend: Buffer;

    // Handle serialized Buffer object from JSON
    if (chunk && typeof chunk === 'object' && 'data' in chunk && Array.isArray((chunk as any).data)) {
      bufferToAppend = Buffer.from((chunk as any).data);
      // Update file extension if provided
      if ((chunk as any).fileExtension) {
        session.fileExtension = (chunk as any).fileExtension;
      }
    } else if (Buffer.isBuffer(chunk)) {
      bufferToAppend = chunk;
    } else {
      console.warn('[VoiceService] Invalid chunk format received');
      return;
    }

    // Update file extension from parameter if provided
    if (fileExtension) {
      session.fileExtension = fileExtension;
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

    // Use the correct file extension based on the audio format
    const fileExtension = session.fileExtension || 'webm';
    const tempFilePath = path.join(os.tmpdir(), `voice-${sessionId}-${randomUUID()}.${fileExtension}`);

    console.log(`[VoiceService] Transcribing audio with format: ${fileExtension}, size: ${session.buffer.length} bytes`);

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
  public cleanupInactiveSessions(maxAgeMs = 300000): void {
    // 5 minutes
    const now = Date.now();
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.lastActivity > maxAgeMs) {
        this.sessions.delete(id);
      }
    }
  }
}
