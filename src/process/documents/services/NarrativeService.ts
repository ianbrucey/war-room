/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { CaseFileRepository } from '../../../webserver/auth/repository/CaseFileRepository';

/**
 * User Narrative metadata
 */
export interface INarrativeMetadata {
  captured_at: string; // ISO 8601 timestamp
  capture_method: 'voice' | 'text' | 'mixed';
  version: number;
}

/**
 * User Narrative structure
 */
export interface INarrative {
  metadata: INarrativeMetadata;
  content: string;
}

/**
 * Service for managing user narratives
 */
export class NarrativeService {
  /**
   * Save user narrative to case-context/user_narrative.md
   */
  // eslint-disable-next-line require-await
  static async saveNarrative(caseFileId: string, content: string, captureMethod: 'voice' | 'text' | 'mixed'): Promise<{ success: boolean; filePath: string }> {
    try {
      // Get case file to find workspace path
      const caseFile = CaseFileRepository.findById(caseFileId);
      if (!caseFile) {
        throw new Error(`Case file not found: ${caseFileId}`);
      }

      // Ensure case-context directory exists
      const caseContextDir = path.join(caseFile.workspace_path, 'case-context');
      if (!fs.existsSync(caseContextDir)) {
        fs.mkdirSync(caseContextDir, { recursive: true });
      }

      // Build narrative file with frontmatter
      const timestamp = new Date().toISOString();
      const narrativeContent = `---
captured_at: "${timestamp}"
capture_method: "${captureMethod}"
version: 1
---

# User Narrative

${content}

## Extracted Metadata

### Parties Mentioned
(To be populated by PartyExtractor)

### Key Dates
(To be populated by analysis)

### Desired Outcome
(To be populated by analysis)
`;

      // Write to file
      const filePath = path.join(caseContextDir, 'user_narrative.md');
      fs.writeFileSync(filePath, narrativeContent, 'utf-8');

      // Update database timestamp
      CaseFileRepository.updateNarrativeTimestamp(caseFileId, Date.now());

      console.log(`[NarrativeService] Saved narrative for case ${caseFileId} at ${filePath}`);

      return { success: true, filePath };
    } catch (error) {
      console.error('[NarrativeService] Failed to save narrative:', error);
      throw error;
    }
  }

  /**
   * Load narrative from file
   */
  // eslint-disable-next-line require-await
  static async loadNarrative(caseFileId: string): Promise<INarrative | null> {
    try {
      const caseFile = CaseFileRepository.findById(caseFileId);
      if (!caseFile) {
        return null;
      }

      const filePath = path.join(caseFile.workspace_path, 'case-context', 'user_narrative.md');
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const fileContent = fs.readFileSync(filePath, 'utf-8');

      // Parse frontmatter
      const frontmatterMatch = fileContent.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      if (!frontmatterMatch) {
        // No frontmatter, treat entire content as narrative
        return {
          metadata: {
            captured_at: new Date().toISOString(),
            capture_method: 'text',
            version: 1,
          },
          content: fileContent,
        };
      }

      const frontmatterText = frontmatterMatch[1];
      const content = frontmatterMatch[2].trim();

      // Parse frontmatter fields
      const capturedAtMatch = frontmatterText.match(/captured_at:\s*"([^"]+)"/);
      const captureMethodMatch = frontmatterText.match(/capture_method:\s*"([^"]+)"/);
      const versionMatch = frontmatterText.match(/version:\s*(\d+)/);

      return {
        metadata: {
          captured_at: capturedAtMatch?.[1] ?? new Date().toISOString(),
          capture_method: (captureMethodMatch?.[1] as 'voice' | 'text' | 'mixed') ?? 'text',
          version: versionMatch ? parseInt(versionMatch[1], 10) : 1,
        },
        content,
      };
    } catch (error) {
      console.error('[NarrativeService] Failed to load narrative:', error);
      return null;
    }
  }

  /**
   * Check if narrative exists and get status
   */
  static async getNarrativeStatus(caseFileId: string): Promise<{
    exists: boolean;
    updatedAt: number | null;
    captureMethod: 'voice' | 'text' | 'mixed' | null;
  }> {
    try {
      const caseFile = CaseFileRepository.findById(caseFileId);
      if (!caseFile) {
        return { exists: false, updatedAt: null, captureMethod: null };
      }

      const filePath = path.join(caseFile.workspace_path, 'case-context', 'user_narrative.md');
      const exists = fs.existsSync(filePath);

      if (!exists) {
        return { exists: false, updatedAt: null, captureMethod: null };
      }

      const narrative = await this.loadNarrative(caseFileId);

      return {
        exists: true,
        updatedAt: caseFile.narrative_updated_at ?? null,
        captureMethod: narrative?.metadata.capture_method ?? null,
      };
    } catch (error) {
      console.error('[NarrativeService] Failed to get narrative status:', error);
      return { exists: false, updatedAt: null, captureMethod: null };
    }
  }
}
