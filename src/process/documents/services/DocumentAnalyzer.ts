/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { execSync } from 'child_process';
import { readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { CaseFileRepository } from '../../../webserver/auth/repository/CaseFileRepository';
import { DocumentRepository } from '../../../webserver/auth/repository/DocumentRepository';
import type { IDocumentMetadata } from '../types';
import { FileSearchIndexer } from './FileSearchIndexer';

/**
 * Document Analyzer Service
 *
 * Uses Gemini CLI to analyze extracted text and generate structured metadata
 */
export class DocumentAnalyzer {
  /**
   * Initialize Document Analyzer with Gemini API key
   *
   * @param geminiApiKey - Google Gemini API key (not used with CLI, but kept for compatibility)
   */
  constructor(private geminiApiKey: string) {
    // Gemini CLI uses GEMINI_API_KEY from environment
  }

  /**
   * Analyze a document and generate metadata
   *
   * @param documentId - Document ID from database
   * @param caseFileId - Case file ID
   * @param extractedTextPath - Path to extracted text file
   * @returns Generated document metadata
   */
  async analyzeDocument(documentId: string, caseFileId: string, extractedTextPath: string): Promise<IDocumentMetadata> {
    console.log('[DocumentIntake] Starting document analysis:', documentId);

    try {
      // Read extracted text
      const extractedText = await readFile(extractedTextPath, 'utf-8');

      // Get document from database to get filename
      const document = DocumentRepository.findById(documentId);
      if (!document) {
        throw new Error(`Document not found: ${documentId}`);
      }

      // Update status to analyzing
      DocumentRepository.updateStatus(documentId, 'analyzing');

      // Generate summary using Gemini CLI
      const metadata = await this.generateMetadata(documentId, document.filename, document.file_type, extractedText, extractedTextPath);

      // Get case file to get workspace path
      const caseFile = CaseFileRepository.findById(caseFileId);
      if (!caseFile) {
        throw new Error(`Case file not found: ${caseFileId}`);
      }

      // Write metadata to document folder
      const workspacePath = caseFile.workspace_path;
      const docFolderPath = join(workspacePath, 'documents', document.folder_name);
      const metadataPath = join(docFolderPath, 'metadata.json');
      await writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');

      console.log('[DocumentIntake] Metadata saved:', metadataPath);

      // Update database record
      DocumentRepository.updateProcessingFlags(documentId, {
        has_metadata: 1,
        document_type: metadata.document_type,
        page_count: metadata.extraction.page_count,
        word_count: metadata.extraction.word_count,
        processing_status: 'indexing', // Move to next phase
      });

      console.log('[DocumentIntake] Document analysis complete:', documentId);

      // Chain to FileSearchIndexer - pass document folder path so it can select best file to upload
      const indexer = new FileSearchIndexer(this.geminiApiKey);
      await indexer.indexDocument(documentId, caseFileId, docFolderPath, metadata);

      return metadata;
    } catch (error) {
      console.error('[DocumentIntake] Document analysis failed:', error);

      // Mark document as failed
      DocumentRepository.updateStatus(documentId, 'failed');

      throw error;
    }
  }

  /**
   * Generate structured metadata using Gemini CLI
   *
   * @param documentId - Document ID
   * @param filename - Original filename
   * @param fileType - File type
   * @param extractedText - Extracted document text
   * @param extractedTextPath - Path to extracted text file
   * @returns Structured metadata
   */
  private async generateMetadata(documentId: string, filename: string, fileType: string, extractedText: string, extractedTextPath: string): Promise<IDocumentMetadata> {
    const prompt = this.buildSummarizationPrompt(extractedText);

    console.log('[DocumentIntake] Calling Gemini CLI for document summary...');

    // Call Gemini CLI with retry logic
    const response = await this.callGeminiWithRetry(prompt, extractedTextPath);

    // Parse JSON response
    const aiSummary = this.parseGeminiResponse(response);

    // Count words in extracted text
    const wordCount = extractedText.split(/\s+/).filter((w) => w.length > 0).length;

    // Count pages (look for page break markers)
    const pageMatches = extractedText.match(/--- Page \d+ ---/g);
    const pageCount = pageMatches ? pageMatches.length : 1;

    // Build metadata object
    const metadata: IDocumentMetadata = {
      schema_version: '1.0',
      document_id: documentId,
      original_filename: filename,
      file_type: fileType,
      document_type: aiSummary.document_type || 'Unknown',
      classification_confidence: aiSummary.classification_confidence || 0.8,
      extraction: {
        method: this.inferExtractionMethod(fileType),
        page_count: pageCount,
        word_count: wordCount,
        extracted_at: new Date().toISOString(),
      },
      summary: {
        executive_summary: aiSummary.executive_summary || '',
        main_arguments: aiSummary.main_arguments || [],
        requested_relief: aiSummary.requested_relief,
      },
      entities: {
        parties:
          aiSummary.key_parties?.map((name: string) => ({
            name,
            role: 'Unknown',
            mentions: 1,
          })) || [],
        dates:
          aiSummary.important_dates?.map((date: string) => ({
            date,
            context: 'Document date',
          })) || [],
        authorities:
          aiSummary.authorities?.map((citation: string) => ({
            citation,
            context: 'Cited authority',
          })) || [],
      },
      relevance_scores: {},
      relationships: {
        references: [],
        contradicts: [],
        supports: [],
      },
    };

    return metadata;
  }

  /**
   * Build structured summarization prompt for Gemini
   *
   * @param extractedText - Document text to analyze
   * @returns Prompt string
   */
  private buildSummarizationPrompt(extractedText: string): string {
    return `Analyze this legal document text and create a JSON summary.

Document Text:
${extractedText.substring(0, 50000)} ${extractedText.length > 50000 ? '...[truncated]' : ''}

Output JSON with this EXACT structure:
{
  "document_type": "Motion|Response|Complaint|Order|Notice|Evidence|Research|Unknown",
  "classification_confidence": 0.95,
  "executive_summary": "detailed summary of the document",
  "key_parties": ["list of parties involved - plaintiff, defendant, counsel, etc."],
  "main_arguments": ["list of primary legal arguments, claims, or requests"],
  "important_dates": ["list of critical dates, deadlines, or filing dates in YYYY-MM-DD format"],
  "jurisdiction": "where this case is being heard (if applicable)",
  "authorities": ["list of laws, statutes, or precedents cited"],
  "critical_facts": ["list of key factual allegations or findings"],
  "requested_relief": "what outcome or relief is being sought"
}

IMPORTANT: 
- Return ONLY valid JSON, no markdown formatting
- Ensure all strings are properly escaped
- Use null for missing fields
- Be thorough in the executive summary`;
  }

  /**
   * Call Gemini CLI with retry logic
   *
   * @param prompt - Prompt to send
   * @param extractedTextPath - Path to extracted text file
   * @param maxRetries - Maximum retry attempts
   * @returns Parsed JSON response
   */
  private async callGeminiWithRetry(prompt: string, extractedTextPath: string, maxRetries = 3): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[DocumentIntake] Calling Gemini CLI (attempt ${attempt}/${maxRetries})...`);

        // Use Gemini CLI with --include-directories flag
        const result = execSync(`gemini -m gemini-2.5-flash -p "${prompt.replace(/"/g, '\\"')} @${extractedTextPath}" --include-directories ${dirname(extractedTextPath)}`, {
          encoding: 'utf-8',
          timeout: 120000, // 2 minute timeout
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        });

        return result.trim();
      } catch (error: any) {
        lastError = error;
        console.warn(`[DocumentIntake] Gemini CLI attempt ${attempt} failed:`, error.message);

        if (attempt < maxRetries) {
          // Exponential backoff: 2^attempt seconds
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`[DocumentIntake] Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`Gemini CLI failed after ${maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Parse Gemini JSON response
   *
   * @param responseText - Raw response from Gemini
   * @returns Parsed JSON object
   */
  private parseGeminiResponse(responseText: string): any {
    try {
      // Remove markdown code blocks if present
      let cleaned = responseText.trim();

      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\s*/, '').replace(/```\s*$/, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\s*/, '').replace(/```\s*$/, '');
      }

      return JSON.parse(cleaned);
    } catch (error) {
      console.error('[DocumentIntake] Failed to parse Gemini response:', error);
      console.error('[DocumentIntake] Response text:', responseText.substring(0, 500));

      // Return minimal valid structure if parsing fails
      return {
        document_type: 'Unknown',
        classification_confidence: 0.0,
        executive_summary: 'Failed to parse AI response',
        key_parties: [],
        main_arguments: [],
        important_dates: [],
        authorities: [],
        critical_facts: [],
      };
    }
  }

  /**
   * Infer extraction method from file type
   *
   * @param fileType - File type string
   * @returns Extraction method name
   */
  private inferExtractionMethod(fileType: string): 'pdf-parse' | 'mistral-ocr' | 'plaintext' | 'docx' {
    switch (fileType) {
      case 'pdf':
        return 'pdf-parse';
      case 'docx':
        return 'docx';
      case 'txt':
      case 'md':
        return 'plaintext';
      default:
        return 'pdf-parse';
    }
  }

  /**
   * Get workspace path for a case file from database
   *
   * @param caseFileId - Case file ID
   * @returns Workspace path
   * @throws Error if case file not found or missing workspace_path
   */
  private getWorkspacePath(caseFileId: string): string {
    // Import CaseFileRepository to avoid circular dependency at module load time
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { CaseFileRepository } = require('../../../webserver/auth/repository/CaseFileRepository');

    const caseFile = CaseFileRepository.findById(caseFileId);
    if (!caseFile) {
      throw new Error(`Case file not found: ${caseFileId}`);
    }

    if (!caseFile.workspace_path) {
      throw new Error(`Case file missing workspace_path: ${caseFileId}`);
    }

    return caseFile.workspace_path;
  }
}
