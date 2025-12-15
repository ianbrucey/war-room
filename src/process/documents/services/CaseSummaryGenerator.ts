/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { execSync } from 'child_process';
import { copyFile, readFile, unlink, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { CaseFileRepository } from '../../../webserver/auth/repository/CaseFileRepository';
import { DocumentRepository } from '../../../webserver/auth/repository/DocumentRepository';
import { CASE_SUMMARY_GENERATION_PROMPT, CASE_SUMMARY_UPDATE_PROMPT } from './prompts/case-summary-prompt';

/**
 * Case Summary Generator Service
 * 
 * Generates AI-powered case summaries from document metadata using Gemini CLI
 */
export class CaseSummaryGenerator {
  private readonly BATCH_SIZE = 5; // Hardcoded batch size
  private readonly BATCH_DELAY_MS = 2000; // 2 second delay between batches

  /**
   * Generate new case summary from all processed documents
   * 
   * @param caseId - Case file ID
   * @param onProgress - Optional progress callback
   */
  async generate(
    caseId: string,
    onProgress?: (percent: number, currentBatch: number, totalBatches: number) => void
  ): Promise<void> {
    console.log('[CaseSummaryGenerator] Starting generation for case:', caseId);
    const startTime = Date.now();

    try {
      // Update status to generating
      CaseFileRepository.updateSummaryStatus(caseId, 'generating');

      // Get case file
      const caseFile = CaseFileRepository.findById(caseId);
      if (!caseFile) {
        throw new Error(`Case not found: ${caseId}`);
      }

      // Get all completed documents
      const documents = DocumentRepository.findByCaseFileId(caseId);
      const completedDocs = documents.filter((doc: any) => doc.processing_status === 'complete');

      if (completedDocs.length === 0) {
        throw new Error('No processed documents found for this case');
      }

      console.log(`[CaseSummaryGenerator] Found ${completedDocs.length} completed documents`);

      // Load metadata files
      const metadataFiles = await this.loadMetadataFiles(caseFile.workspace_path, completedDocs);

      if (metadataFiles.length === 0) {
        throw new Error('No metadata files found for completed documents');
      }

      // Process in batches
      const summary = await this.processInBatches(
        metadataFiles,
        caseFile.workspace_path,
        onProgress
      );

      // Write summary to disk
      const summaryPath = join(caseFile.workspace_path, 'case-context', 'case_summary.md');
      await writeFile(summaryPath, summary, 'utf-8');

      console.log('[CaseSummaryGenerator] Summary written to:', summaryPath);

      // Index summary in File Search store for RAG access
      try {
        await this.indexSummaryInFileSearch(caseId, summaryPath);
        console.log('[CaseSummaryGenerator] Summary indexed in File Search');
      } catch (error) {
        console.warn('[CaseSummaryGenerator] Failed to index summary in File Search:', error);
        // Don't fail the entire generation if indexing fails
      }

      // Update database status
      CaseFileRepository.markSummaryGenerated(caseId, completedDocs.length);

      const processingTime = Date.now() - startTime;
      console.log(`[CaseSummaryGenerator] Generation complete in ${processingTime}ms`);

    } catch (error) {
      console.error('[CaseSummaryGenerator] Generation failed:', error);
      CaseFileRepository.markSummaryFailed(caseId);
      throw error;
    }
  }

  /**
   * Update existing summary with new documents only
   * 
   * @param caseId - Case file ID
   * @param onProgress - Optional progress callback
   */
  async update(
    caseId: string,
    onProgress?: (percent: number, currentBatch: number, totalBatches: number) => void
  ): Promise<void> {
    console.log('[CaseSummaryGenerator] Starting update for case:', caseId);

    try {
      // Get case file
      const caseFile = CaseFileRepository.findById(caseId);
      if (!caseFile) {
        throw new Error(`Case not found: ${caseId}`);
      }

      // Check if summary exists
      const summaryPath = join(caseFile.workspace_path, 'case-context', 'case_summary.md');
      let existingSummary: string;
      try {
        existingSummary = await readFile(summaryPath, 'utf-8');
      } catch {
        throw new Error('No existing summary to update. Use generate() instead.');
      }

      // Backup existing summary
      const backupPath = summaryPath + '.bak';
      await copyFile(summaryPath, backupPath);
      console.log('[CaseSummaryGenerator] Backed up existing summary to:', backupPath);

      // Update status to generating
      CaseFileRepository.updateSummaryStatus(caseId, 'generating');

      // Get all completed documents
      const documents = DocumentRepository.findByCaseFileId(caseId);
      const completedDocs = documents.filter((doc: any) => doc.processing_status === 'complete');

      // Filter to only new documents (uploaded after last summary generation)
      const lastGenerated = caseFile.case_summary_generated_at ?? 0;
      const newDocs = completedDocs.filter((doc: any) => doc.uploaded_at > lastGenerated);

      if (newDocs.length === 0) {
        throw new Error('No new documents to incorporate');
      }

      console.log(`[CaseSummaryGenerator] Found ${newDocs.length} new documents to incorporate`);

      // Load metadata for new documents only
      const newMetadataFiles = await this.loadMetadataFiles(caseFile.workspace_path, newDocs);

      // Merge with existing summary
      const updatedSummary = await this.mergeWithExisting(
        existingSummary,
        newMetadataFiles,
        caseFile.workspace_path
      );

      // Write updated summary
      await writeFile(summaryPath, updatedSummary, 'utf-8');

      console.log('[CaseSummaryGenerator] Summary updated');

      // Index updated summary in File Search store
      try {
        await this.indexSummaryInFileSearch(caseId, summaryPath);
        console.log('[CaseSummaryGenerator] Updated summary indexed in File Search');
      } catch (error) {
        console.warn('[CaseSummaryGenerator] Failed to index updated summary in File Search:', error);
      }

      // Update database status
      CaseFileRepository.markSummaryGenerated(caseId, completedDocs.length);

    } catch (error) {
      console.error('[CaseSummaryGenerator] Update failed:', error);
      CaseFileRepository.markSummaryFailed(caseId);
      throw error;
    }
  }

  /**
   * Full regeneration (ignores existing summary)
   *
   * @param caseId - Case file ID
   * @param onProgress - Optional progress callback
   */
  async regenerate(
    caseId: string,
    onProgress?: (percent: number, currentBatch: number, totalBatches: number) => void
  ): Promise<void> {
    console.log('[CaseSummaryGenerator] Starting regeneration for case:', caseId);

    try {
      // Get case file
      const caseFile = CaseFileRepository.findById(caseId);
      if (!caseFile) {
        throw new Error(`Case not found: ${caseId}`);
      }

      // Backup existing summary if it exists
      const summaryPath = join(caseFile.workspace_path, 'case-context', 'case_summary.md');
      try {
        const backupPath = summaryPath + '.bak';
        await copyFile(summaryPath, backupPath);
        console.log('[CaseSummaryGenerator] Backed up existing summary to:', backupPath);
      } catch {
        // No existing summary, that's fine
      }

      // Call generate (which processes all documents fresh)
      await this.generate(caseId, onProgress);

    } catch (error) {
      console.error('[CaseSummaryGenerator] Regeneration failed:', error);
      throw error;
    }
  }

  /**
   * Load metadata.json file paths for given documents
   *
   * @private
   */
  private async loadMetadataFiles(
    workspacePath: string,
    documents: Array<{ id: string; folder_name: string; filename: string }>
  ): Promise<Array<{ docId: string; filename: string; filePath: string }>> {
    const metadataFiles: Array<{ docId: string; filename: string; filePath: string }> = [];

    for (const doc of documents) {
      try {
        const metadataPath = join(workspacePath, 'documents', doc.folder_name, 'metadata.json');

        // Verify file exists (but don't read content - Gemini will read it directly)
        await readFile(metadataPath, 'utf-8');

        metadataFiles.push({
          docId: doc.id,
          filename: doc.filename,
          filePath: metadataPath,
        });
      } catch (error) {
        console.warn(`[CaseSummaryGenerator] Could not access metadata for ${doc.filename}:`, error);
        // Continue with other documents
      }
    }

    return metadataFiles;
  }

  /**
   * Process documents in batches of 5 using hierarchical summarization
   *
   * @private
   */
  private async processInBatches(
    metadataFiles: Array<{ docId: string; filename: string; filePath: string }>,
    workspacePath: string,
    onProgress?: (percent: number, currentBatch: number, totalBatches: number) => void
  ): Promise<string> {
    const totalBatches = Math.ceil(metadataFiles.length / this.BATCH_SIZE);
    console.log(`[CaseSummaryGenerator] Processing ${metadataFiles.length} documents in ${totalBatches} batches`);

    let cumulativeSummary = '';

    for (let i = 0; i < metadataFiles.length; i += this.BATCH_SIZE) {
      const batchNum = Math.floor(i / this.BATCH_SIZE) + 1;
      const batch = metadataFiles.slice(i, i + this.BATCH_SIZE);

      console.log(`[CaseSummaryGenerator] Processing batch ${batchNum}/${totalBatches} (${batch.length} documents)`);

      // Build file list for prompt
      const fileList = batch.map(f => `- ${f.filename}`).join('\n');

      // Build prompt with file references
      const prompt = cumulativeSummary
        ? `${CASE_SUMMARY_GENERATION_PROMPT}\n\nPREVIOUS SUMMARY:\n${cumulativeSummary}\n\nNEW DOCUMENTS TO ANALYZE:\n${fileList}`
        : `${CASE_SUMMARY_GENERATION_PROMPT}\n\nDOCUMENTS TO ANALYZE:\n${fileList}`;

      // Extract file paths for Gemini CLI
      const filePaths = batch.map(f => f.filePath);

      // Call Gemini CLI with file paths
      const batchSummary = await this.callGeminiCLI(prompt, filePaths, workspacePath);

      cumulativeSummary = batchSummary;

      // Report progress
      const percent = Math.round((batchNum / totalBatches) * 100);
      if (onProgress) {
        onProgress(percent, batchNum, totalBatches);
      }

      // Delay between batches to avoid rate limits
      if (i + this.BATCH_SIZE < metadataFiles.length) {
        await this.delay(this.BATCH_DELAY_MS);
      }
    }

    return cumulativeSummary;
  }

  /**
   * Merge new documents with existing summary
   *
   * @private
   */
  private async mergeWithExisting(
    existingSummary: string,
    newMetadataFiles: Array<{ docId: string; filename: string; filePath: string }>,
    workspacePath: string
  ): Promise<string> {
    console.log(`[CaseSummaryGenerator] Merging ${newMetadataFiles.length} new documents with existing summary`);

    // Build file list for prompt
    const fileList = newMetadataFiles.map(f => `- ${f.filename}`).join('\n');

    const prompt = CASE_SUMMARY_UPDATE_PROMPT
      .replace('{existing_summary_content}', existingSummary)
      .replace('{new_metadata_files}', fileList);

    // Extract file paths for Gemini CLI
    const filePaths = newMetadataFiles.map(f => f.filePath);

    return await this.callGeminiCLI(prompt, filePaths, workspacePath);
  }

  /**
   * Call Gemini CLI with prompt and file paths
   *
   * Uses a temporary file for the prompt to avoid shell escaping issues
   *
   * @private
   */
  private async callGeminiCLI(
    prompt: string,
    filePaths: string[],
    workspacePath: string
  ): Promise<string> {
    const tempPromptFile = join(tmpdir(), `case-summary-prompt-${Date.now()}.txt`);

    try {
      // Write prompt to temporary file to avoid shell escaping issues
      await writeFile(tempPromptFile, prompt, 'utf-8');

      // Build file arguments using @ syntax: @file1 @file2 @file3
      const fileArgs = filePaths.map(p => `@${p}`).join(' ');

      // Include the documents directory so Gemini can access all metadata files
      const documentsDir = join(workspacePath, 'documents');

      // Build command using stdin to pass the prompt (avoids all shell escaping issues)
      const command = `cat "${tempPromptFile}" | gemini -m gemini-2.5-flash ${fileArgs} --include-directories ${documentsDir}`;

      console.log('[CaseSummaryGenerator] Calling Gemini CLI...');
      console.log(`[CaseSummaryGenerator] Processing ${filePaths.length} files from ${documentsDir}`);

      const output = execSync(command, {
        encoding: 'utf-8',
        timeout: 180000, // 3 minute timeout
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      return output.trim();

    } catch (error) {
      console.error('[CaseSummaryGenerator] Gemini CLI call failed:', error);
      throw new Error(`Failed to generate summary: ${error}`);
    } finally {
      // Clean up temp file
      try {
        await unlink(tempPromptFile);
      } catch (cleanupError) {
        console.warn('[CaseSummaryGenerator] Failed to clean up temp prompt file:', cleanupError);
      }
    }
  }

  /**
   * Delay helper
   *
   * @private
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Index case summary in File Search store for RAG access
   *
   * This allows AI agents to query the summary alongside individual documents.
   * The summary provides high-level context that helps agents understand the case.
   *
   * @private
   */
  private async indexSummaryInFileSearch(caseId: string, summaryPath: string): Promise<void> {
    // Note: This is a placeholder implementation.
    // The actual File Search API integration is not yet fully implemented in FileSearchIndexer.
    // When the File Search API is properly integrated, this method should:
    // 1. Get the case's File Search store ID
    // 2. Upload the summary file to the store
    // 3. Store the file URI for future reference

    console.log(`[CaseSummaryGenerator] Indexing summary for case ${caseId} at ${summaryPath}`);

    // TODO: Implement actual File Search upload when API is ready
    // const indexer = new FileSearchIndexer(this.geminiApiKey);
    // await indexer.uploadSummaryToStore(caseId, summaryPath);

    // For now, just log that we would index it
    console.log('[CaseSummaryGenerator] Summary indexing placeholder - will be implemented when File Search API is integrated');
  }
}
