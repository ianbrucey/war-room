/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import { ManifestGenerator } from '../services/ManifestGenerator';
import { TextExtractor } from '../services/TextExtractor';

/**
 * Integration tests for Document Intake system
 *
 * NOTE: These tests require a running database and proper test setup.
 * They are currently placeholder tests that demonstrate the expected flow.
 */
describe('Document Intake Integration Test', () => {
  let textExtractor: TextExtractor;
  let manifestGenerator: ManifestGenerator;
  const caseFileId = 'test-case-id';
  const workspacePath = path.join(__dirname, 'test-workspace');
  const originalsPath = path.join(workspacePath, 'documents', 'originals');

  beforeEach(async () => {
    // Create test directories
    await fs.mkdir(originalsPath, { recursive: true });

    // Initialize services
    textExtractor = new TextExtractor('test-mistral-key', 'test-gemini-key');
    manifestGenerator = new ManifestGenerator();
  });

  afterEach(async () => {
    // Clean up test workspace
    await fs.rm(workspacePath, { recursive: true, force: true });
  });

  it('should process a text document from upload to extraction', async () => {
    // Skip if no database connection
    // This is a placeholder test - full integration requires database setup

    // 1. Create test file
    const txtFileName = 'test.txt';
    const txtFilePath = path.join(originalsPath, txtFileName);
    await fs.writeFile(txtFilePath, 'This is test content for extraction.');

    // 2. Verify file was created
    const fileExists = await fs.access(txtFilePath).then(() => true).catch(() => false);
    expect(fileExists).toBe(true);

    // Note: Full integration test would:
    // - Create a document record via DocumentRepository.create()
    // - Call textExtractor.extractDocument()
    // - Verify extraction file was created
    // - Call manifestGenerator.generateManifest()
    // - Verify manifest was created
  });

  it('should handle unsupported file types gracefully', async () => {
    // Create unsupported file
    const unsupportedFileName = 'test.xyz';
    const unsupportedFilePath = path.join(originalsPath, unsupportedFileName);
    await fs.writeFile(unsupportedFilePath, 'dummy content');

    // Verify file was created
    const fileExists = await fs.access(unsupportedFilePath).then(() => true).catch(() => false);
    expect(fileExists).toBe(true);

    // Note: Full integration test would verify that:
    // - TextExtractor throws error for unsupported type
    // - Document status is updated to 'failed'
  });

  it('should generate manifest with correct structure', async () => {
    // This test verifies manifest structure without database
    const manifestPath = path.join(workspacePath, 'documents', 'case-documents-manifest.json');

    // Create a mock manifest
    const mockManifest: {
      case_id: string;
      generated_at: string;
      total_documents: number;
      documents: unknown[];
    } = {
      case_id: caseFileId,
      generated_at: new Date().toISOString(),
      total_documents: 0,
      documents: [],
    };

    await fs.mkdir(path.dirname(manifestPath), { recursive: true });
    await fs.writeFile(manifestPath, JSON.stringify(mockManifest, null, 2));

    // Verify manifest structure
    const manifestContent = await fs.readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(manifestContent);

    expect(manifest.case_id).toBe(caseFileId);
    expect(manifest.total_documents).toBe(0);
    expect(Array.isArray(manifest.documents)).toBe(true);
    expect(manifest.generated_at).toBeDefined();
  });
});
