/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { execSync } from 'child_process';
import fs from 'fs';
import { unlink, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { CaseFileRepository } from '../../../webserver/auth/repository/CaseFileRepository';

/**
 * Party information extracted from narrative
 */
export interface IParty {
  name: string;
  role: string; // e.g., 'plaintiff', 'defendant', 'witness', 'employer'
  relationship: string | null; // e.g., 'former employer', 'landlord'
  notes: string | null;
}

/**
 * Service for extracting parties from user narrative using AI
 */
export class PartyExtractor {
  /**
   * Extract parties from narrative content using Gemini
   */
  static async extractParties(caseFileId: string, narrativeContent: string): Promise<{ success: boolean; parties: IParty[]; filePath: string }> {
    try {
      console.log('[PartyExtractor] Extracting parties from narrative for case:', caseFileId);

      // Get case file to find workspace path
      const caseFile = CaseFileRepository.findById(caseFileId);
      if (!caseFile) {
        throw new Error(`Case file not found: ${caseFileId}`);
      }

      // Build prompt for party extraction
      const prompt = this.buildExtractionPrompt(narrativeContent);

      // Call Gemini CLI
      const response = await this.callGeminiCLI(prompt);

      // Parse response
      const parties = this.parseGeminiResponse(response);

      // Save to parties.json
      const filePath = await this.saveParties(caseFile.workspace_path, parties);

      console.log(`[PartyExtractor] Extracted ${parties.length} parties for case ${caseFileId}`);

      return { success: true, parties, filePath };
    } catch (error) {
      console.error('[PartyExtractor] Failed to extract parties:', error);
      throw error;
    }
  }

  /**
   * Build prompt for party extraction
   */
  private static buildExtractionPrompt(narrativeContent: string): string {
    return `You are a legal assistant analyzing a user's narrative about their case.

Extract all parties mentioned in the narrative and classify them by their role.

USER NARRATIVE:
${narrativeContent}

INSTRUCTIONS:
1. Identify all people, organizations, or entities mentioned
2. Classify each party's role (plaintiff, defendant, witness, employer, landlord, etc.)
3. Note their relationship to the user if mentioned
4. Include any relevant context in the notes field

Return ONLY valid JSON in this exact format:
{
  "parties": [
    {
      "name": "Party Name",
      "role": "plaintiff|defendant|witness|employer|other",
      "relationship": "relationship to user or null",
      "notes": "any relevant context or null"
    }
  ]
}

IMPORTANT:
- Return ONLY valid JSON, no markdown formatting
- Use null for missing fields
- Include the user themselves as a party with role "plaintiff" or "self"
- Be thorough but only include parties explicitly mentioned`;
  }

  /**
   * Call Gemini CLI with prompt
   */
  private static async callGeminiCLI(prompt: string): Promise<string> {
    const tempPromptFile = path.join(tmpdir(), `party-extraction-prompt-${Date.now()}.txt`);

    try {
      // Write prompt to temporary file
      await writeFile(tempPromptFile, prompt, 'utf-8');

      // Build command using stdin
      const command = `cat "${tempPromptFile}" | gemini -m gemini-2.5-flash`;

      console.log('[PartyExtractor] Calling Gemini CLI...');

      const output = execSync(command, {
        encoding: 'utf-8',
        timeout: 60000, // 1 minute timeout
        maxBuffer: 5 * 1024 * 1024, // 5MB buffer
      });

      return output.trim();
    } catch (error) {
      console.error('[PartyExtractor] Gemini CLI call failed:', error);
      throw new Error(`Failed to extract parties: ${error}`);
    } finally {
      // Clean up temp file
      try {
        await unlink(tempPromptFile);
      } catch (cleanupError) {
        console.warn('[PartyExtractor] Failed to clean up temp prompt file:', cleanupError);
      }
    }
  }

  /**
   * Parse Gemini JSON response
   */
  private static parseGeminiResponse(responseText: string): IParty[] {
    try {
      // Remove markdown code blocks if present
      let cleaned = responseText.trim();

      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\s*/, '').replace(/```\s*$/, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\s*/, '').replace(/```\s*$/, '');
      }

      const parsed = JSON.parse(cleaned);

      // Validate structure
      if (!parsed.parties || !Array.isArray(parsed.parties)) {
        throw new Error('Invalid response structure: missing parties array');
      }

      return parsed.parties;
    } catch (error) {
      console.error('[PartyExtractor] Failed to parse Gemini response:', error);
      console.error('[PartyExtractor] Response text:', responseText.substring(0, 500));

      // Return empty array if parsing fails
      return [];
    }
  }

  /**
   * Save parties to parties.json
   */
  // eslint-disable-next-line require-await
  private static async saveParties(workspacePath: string, parties: IParty[]): Promise<string> {
    const caseContextDir = path.join(workspacePath, 'case-context');

    // Ensure directory exists
    if (!fs.existsSync(caseContextDir)) {
      fs.mkdirSync(caseContextDir, { recursive: true });
    }

    const filePath = path.join(caseContextDir, 'parties.json');
    fs.writeFileSync(filePath, JSON.stringify(parties, null, 2), 'utf-8');

    console.log(`[PartyExtractor] Saved parties to ${filePath}`);

    return filePath;
  }
}
