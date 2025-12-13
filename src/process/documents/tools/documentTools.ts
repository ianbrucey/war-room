/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFile } from 'fs/promises';
import { basename, extname, join } from 'path';
import { CaseFileRepository } from '../../../webserver/auth/repository/CaseFileRepository';
import { DocumentRepository } from '../../../webserver/auth/repository/DocumentRepository';
import type { DocumentType, FilterQuery, ProcessingStatus } from '../types';
import { complexFilter } from '../utils/metadataFilter';

/**
 * Tool for searching documents in a case file using semantic search
 */
export const searchDocumentsTool = {
  name: 'search_case_documents',
  description: 'Search documents in a case file using semantic search',
  inputSchema: {
    type: 'object',
    properties: {
      caseFileId: { type: 'string', description: 'The ID of the case file to search within.' },
      query: { type: 'string', description: 'The semantic search query.' },
    },
    required: ['caseFileId', 'query'],
  },
  handler: async (args: { caseFileId: string; query: string }) => {
    console.log(`[DocumentIntake] Searching documents in case ${args.caseFileId} for: "${args.query}"`);

    const caseFile = CaseFileRepository.findById(args.caseFileId);
    if (!caseFile) {
      return { error: 'Case file not found.' };
    }

    // Check if any documents are indexed for this case
    const documents = DocumentRepository.findByCaseFileId(args.caseFileId);
    const indexedDocs = documents.filter(d => d.rag_indexed);

    if (indexedDocs.length === 0) {
      return { results: 'No documents are indexed for search in this case file.' };
    }

    // TODO: Implement actual Gemini File Search query
    // This would involve calling the Gemini API with the store ID and query
    return {
      results: `Placeholder: Searched for "${args.query}" in ${indexedDocs.length} indexed documents.`,
      indexed_count: indexedDocs.length,
    };
  },
};

/**
 * Tool for retrieving full text of a specific document
 */
export const getDocumentTool = {
  name: 'get_document_content',
  description: 'Retrieve full text of a specific document',
  inputSchema: {
    type: 'object',
    properties: {
      documentId: { type: 'string', description: 'The ID of the document to retrieve.' },
    },
    required: ['documentId'],
  },
  handler: async (args: { documentId: string }) => {
    const doc = DocumentRepository.findById(args.documentId);
    if (!doc) {
      return { error: 'Document not found.' };
    }

    const caseFile = CaseFileRepository.findById(doc.case_file_id);
    if (!caseFile) {
      return { error: 'Case file not found for this document.' };
    }

    if (!doc.has_text_extraction) {
      return { error: 'Document text has not been extracted yet.' };
    }

    // Construct path to the extracted text file
    const baseName = basename(doc.filename, extname(doc.filename));
    const extractedTextPath = join(caseFile.workspace_path, 'documents', 'extractions', `${baseName}.txt`);

    try {
      const content = await readFile(extractedTextPath, 'utf-8');
      return {
        content,
        document_type: doc.document_type,
        page_count: doc.page_count,
        word_count: doc.word_count,
      };
    } catch (error) {
      console.error(`[DocumentIntake] Error reading document content for ${args.documentId}:`, error);
      return { error: 'Could not retrieve document content.' };
    }
  },
};

/**
 * Tool input for filter documents
 */
interface FilterDocumentsInput {
  caseFileId: string;
  filter: {
    document_types?: string[];
    date_from?: string;
    date_to?: string;
    parties?: string[];
    processing_status?: string[];
    has_text_extraction?: boolean;
    has_metadata?: boolean;
  };
}

/**
 * Tool for filtering documents by metadata
 */
export const filterDocumentsTool = {
  name: 'filter_documents_by_metadata',
  description: 'Filter documents by type, date, party, etc.',
  inputSchema: {
    type: 'object',
    properties: {
      caseFileId: { type: 'string', description: 'The ID of the case file to filter documents in.' },
      filter: {
        type: 'object',
        properties: {
          document_types: { type: 'array', items: { type: 'string' }, description: 'Document types to filter by' },
          date_from: { type: 'string', format: 'date', description: 'Start date for date range filter' },
          date_to: { type: 'string', format: 'date', description: 'End date for date range filter' },
          parties: { type: 'array', items: { type: 'string' }, description: 'Party names to search for' },
          processing_status: { type: 'array', items: { type: 'string' }, description: 'Processing statuses to filter by' },
          has_text_extraction: { type: 'boolean', description: 'Filter by text extraction status' },
          has_metadata: { type: 'boolean', description: 'Filter by metadata status' },
        }
      },
    },
    required: ['caseFileId', 'filter'],
  },
  handler: async (args: FilterDocumentsInput) => {
    const caseFile = CaseFileRepository.findById(args.caseFileId);
    if (!caseFile) {
      return { error: 'Case file not found.' };
    }

    // Convert input to FilterQuery format
    const filterQuery: FilterQuery = {
      document_types: args.filter.document_types as DocumentType[] | undefined,
      parties: args.filter.parties,
      processing_status: args.filter.processing_status as ProcessingStatus[] | undefined,
      has_text_extraction: args.filter.has_text_extraction,
      has_metadata: args.filter.has_metadata,
    };

    // Add date range if both dates provided
    if (args.filter.date_from && args.filter.date_to) {
      filterQuery.date_range = {
        start: new Date(args.filter.date_from),
        end: new Date(args.filter.date_to),
      };
    }

    const documents = DocumentRepository.findByCaseFileId(args.caseFileId);
    const filteredDocs = complexFilter(documents, filterQuery, caseFile.workspace_path);

    return {
      results: filteredDocs.map(d => ({
        id: d.id,
        filename: d.filename,
        document_type: d.document_type,
        processing_status: d.processing_status,
      })),
      total: filteredDocs.length,
    };
  },
};
