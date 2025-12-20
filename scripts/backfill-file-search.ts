/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Backfill Script: Upload Existing Documents to Google File Search
 * 
 * This script scans all existing case documents that have extracted text
 * but are not yet indexed in Google File Search, and uploads them.
 * 
 * Usage:
 *   npm run backfill-file-search
 *   npm run backfill-file-search -- --case-id <case-file-id>
 *   npm run backfill-file-search -- --dry-run
 */

import { CaseFileRepository } from '@/webserver/auth/repository/CaseFileRepository';
import { DocumentRepository } from '@/webserver/auth/repository/DocumentRepository';
import { getDatabase } from '@process/database/connection';
import { FileSearchIndexer } from '@process/documents/services/FileSearchIndexer';
import type { ICaseDocument, IDocumentMetadata } from '@process/documents/types';
import * as fs from 'fs/promises';
import * as path from 'path';

interface BackfillStats {
  total: number;
  alreadyIndexed: number;
  noExtractedText: number;
  processed: number;
  failed: number;
  skipped: number;
}

async function loadMetadata(metadataPath: string): Promise<IDocumentMetadata | null> {
  try {
    const content = await fs.readFile(metadataPath, 'utf-8');
    return JSON.parse(content) as IDocumentMetadata;
  } catch (error) {
    console.warn(`[Backfill] Could not load metadata from ${metadataPath}:`, error);
    return null;
  }
}

async function backfillDocument(
  doc: ICaseDocument,
  indexer: FileSearchIndexer,
  dryRun: boolean
): Promise<boolean> {
  const caseFile = CaseFileRepository.findById(doc.case_file_id);
  if (!caseFile) {
    console.error(`[Backfill] Case file not found: ${doc.case_file_id}`);
    return false;
  }

  const workspacePath = caseFile.workspace_path;
  const docFolderPath = path.join(workspacePath, 'documents', doc.folder_name);
  const metadataPath = path.join(docFolderPath, 'metadata.json');

  // Check if document folder exists and has uploadable content
  try {
    await fs.access(docFolderPath);
    // Check for either original file or extracted text
    const files = await fs.readdir(docFolderPath);
    const hasOriginal = files.some((f) => f.startsWith('original.'));
    const hasExtracted = files.includes('extracted-text.txt');
    if (!hasOriginal && !hasExtracted) {
      console.warn(`[Backfill] No uploadable files found for document: ${doc.id} (${doc.filename})`);
      return false;
    }
  } catch {
    console.warn(`[Backfill] Document folder not found: ${docFolderPath}`);
    return false;
  }

  // Load metadata (optional, will use defaults if not found)
  const metadata = await loadMetadata(metadataPath);
  const metadataToUse: IDocumentMetadata = metadata || {
    schema_version: '1.0',
    document_id: doc.id,
    original_filename: doc.filename,
    file_type: doc.file_type,
    document_type: 'Unknown',
    classification_confidence: 0,
    extraction: {
      method: 'pdf-parse',
      page_count: doc.page_count || undefined,
      word_count: doc.word_count || undefined,
      extracted_at: new Date().toISOString(),
    },
    summary: {
      executive_summary: '',
      main_arguments: [],
    },
    entities: {
      parties: [],
      dates: [],
    },
  };

  if (dryRun) {
    console.log(`[Backfill] [DRY RUN] Would index: ${doc.filename} (${doc.id})`);
    return true;
  }

  try {
    console.log(`[Backfill] Indexing document: ${doc.filename} (${doc.id})`);
    // Pass document folder path - FileSearchIndexer will select best file to upload
    await indexer.indexDocument(doc.id, doc.case_file_id, docFolderPath, metadataToUse);
    console.log(`[Backfill] ✅ Successfully indexed: ${doc.filename}`);
    return true;
  } catch (error) {
    console.error(`[Backfill] ❌ Failed to index ${doc.filename}:`, error);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const caseIdIndex = args.indexOf('--case-id');
  const specificCaseId = caseIdIndex >= 0 ? args[caseIdIndex + 1] : null;

  console.log('[Backfill] Starting File Search backfill...');
  if (dryRun) {
    console.log('[Backfill] DRY RUN MODE - No changes will be made');
  }
  if (specificCaseId) {
    console.log(`[Backfill] Filtering to case: ${specificCaseId}`);
  }

  // Initialize database
  const db = getDatabase();
  console.log('[Backfill] Database connected');

  // Get Gemini API key
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    console.error('[Backfill] ERROR: GEMINI_API_KEY environment variable not set');
    process.exit(1);
  }

  const indexer = new FileSearchIndexer(geminiApiKey);

  // Get all documents
  let documents: ICaseDocument[];
  if (specificCaseId) {
    documents = DocumentRepository.findByCaseFileId(specificCaseId);
  } else {
    // Get all documents by querying the database directly
    const allDocuments = db.query('SELECT * FROM case_documents ORDER BY uploaded_at DESC') as ICaseDocument[];
    documents = allDocuments;
  }

  console.log(`[Backfill] Found ${documents.length} total documents`);

  // Filter to documents that need indexing
  const needsIndexing = documents.filter((doc) => {
    // Must have text extraction completed
    if (doc.has_text_extraction !== 1) return false;
    // Must not already be indexed
    if (doc.rag_indexed === 1) return false;
    // Must be in complete status (or analyzing/indexing if it failed)
    if (!['complete', 'analyzing', 'indexing'].includes(doc.processing_status)) return false;
    return true;
  });

  console.log(`[Backfill] ${needsIndexing.length} documents need indexing`);

  const stats: BackfillStats = {
    total: documents.length,
    alreadyIndexed: documents.filter((d) => d.rag_indexed === 1).length,
    noExtractedText: documents.filter((d) => d.has_text_extraction !== 1).length,
    processed: 0,
    failed: 0,
    skipped: 0,
  };

  // Process each document
  for (const doc of needsIndexing) {
    const success = await backfillDocument(doc, indexer, dryRun);
    if (success) {
      stats.processed++;
    } else {
      stats.failed++;
    }
  }

  // Print summary
  console.log('\n[Backfill] ========== SUMMARY ==========');
  console.log(`Total documents: ${stats.total}`);
  console.log(`Already indexed: ${stats.alreadyIndexed}`);
  console.log(`No extracted text: ${stats.noExtractedText}`);
  console.log(`Processed: ${stats.processed}`);
  console.log(`Failed: ${stats.failed}`);
  console.log('=====================================\n');

  if (dryRun) {
    console.log('[Backfill] DRY RUN complete. Run without --dry-run to perform actual indexing.');
  } else {
    console.log('[Backfill] Backfill complete!');
  }
}

main().catch((error) => {
  console.error('[Backfill] Fatal error:', error);
  process.exit(1);
});

