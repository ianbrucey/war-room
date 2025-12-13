/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { existsSync, readFileSync } from 'fs';
import { basename, extname, join } from 'path';
import type { DocumentType, FilterQuery, ICaseDocument, IDocumentMetadata } from '../types';

/**
 * Load metadata for a document from its metadata JSON file
 *
 * @param doc - Case document
 * @param workspacePath - Workspace path for the case
 * @returns Document metadata or null if not found
 */
function loadDocumentMetadata(doc: ICaseDocument, workspacePath: string): IDocumentMetadata | null {
  if (!doc.has_metadata) {
    return null;
  }

  const baseName = basename(doc.filename, extname(doc.filename));
  const metadataPath = join(workspacePath, 'documents', 'metadata', `${baseName}.json`);

  if (!existsSync(metadataPath)) {
    return null;
  }

  try {
    const content = readFileSync(metadataPath, 'utf-8');
    return JSON.parse(content) as IDocumentMetadata;
  } catch {
    return null;
  }
}

/**
 * Filter documents by document type
 */
export function filterByDocumentType(
  documents: ICaseDocument[],
  types: DocumentType[]
): ICaseDocument[] {
  const typeSet = new Set(types);
  return documents.filter(doc => doc.document_type && typeSet.has(doc.document_type as DocumentType));
}

/**
 * Filter documents by date range (using metadata entities.dates)
 *
 * @param documents - Documents to filter
 * @param startDate - Start date
 * @param endDate - End date
 * @param workspacePath - Workspace path for loading metadata
 */
export function filterByDateRange(
  documents: ICaseDocument[],
  startDate: Date,
  endDate: Date,
  workspacePath: string
): ICaseDocument[] {
  return documents.filter(doc => {
    const metadata = loadDocumentMetadata(doc, workspacePath);
    if (!metadata || !metadata.entities?.dates || metadata.entities.dates.length === 0) {
      return false;
    }
    return metadata.entities.dates.some(dateEntry => {
      const date = new Date(dateEntry.date);
      return date >= startDate && date <= endDate;
    });
  });
}

/**
 * Filter documents by party name (using metadata entities.parties)
 *
 * @param documents - Documents to filter
 * @param partyName - Party name to search for
 * @param workspacePath - Workspace path for loading metadata
 */
export function filterByParty(
  documents: ICaseDocument[],
  partyName: string,
  workspacePath: string
): ICaseDocument[] {
  const lowerCasePartyName = partyName.toLowerCase();
  return documents.filter(doc => {
    const metadata = loadDocumentMetadata(doc, workspacePath);
    if (!metadata || !metadata.entities?.parties || metadata.entities.parties.length === 0) {
      return false;
    }
    return metadata.entities.parties.some(party =>
      party.name.toLowerCase().includes(lowerCasePartyName)
    );
  });
}

/**
 * Apply complex filter query to documents
 *
 * @param documents - Documents to filter
 * @param query - Filter query
 * @param workspacePath - Workspace path for loading metadata
 */
export function complexFilter(
  documents: ICaseDocument[],
  query: FilterQuery,
  workspacePath: string
): ICaseDocument[] {
  let results = [...documents];

  if (query.document_types && query.document_types.length > 0) {
    results = filterByDocumentType(results, query.document_types);
  }

  if (query.date_range) {
    results = filterByDateRange(results, query.date_range.start, query.date_range.end, workspacePath);
  }

  if (query.parties && query.parties.length > 0) {
    // Filter by any of the specified parties
    results = results.filter(doc =>
      query.parties!.some(partyName =>
        filterByParty([doc], partyName, workspacePath).length > 0
      )
    );
  }

  if (query.processing_status && query.processing_status.length > 0) {
    const statusSet = new Set(query.processing_status);
    results = results.filter(doc => statusSet.has(doc.processing_status));
  }

  if (typeof query.has_text_extraction === 'boolean') {
    results = results.filter(doc => Boolean(doc.has_text_extraction) === query.has_text_extraction);
  }

  if (typeof query.has_metadata === 'boolean') {
    results = results.filter(doc => Boolean(doc.has_metadata) === query.has_metadata);
  }

  // Sort by upload date (newest first)
  return results.sort((a, b) => b.uploaded_at - a.uploaded_at);
}
