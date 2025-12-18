/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { extname } from 'path';
import type { DocumentType, FileType } from '../types';

/**
 * Supported file extensions mapped to file types
 */
const FILE_TYPE_EXTENSIONS: Record<string, FileType> = {
  '.pdf': 'pdf',
  '.docx': 'docx',
  '.doc': 'docx', // Treat older .doc as docx
  '.txt': 'txt',
  '.md': 'md',
  '.markdown': 'md',
  '.jpg': 'jpg',
  '.jpeg': 'jpg',
  '.png': 'png',
  '.mp3': 'mp3',
  '.wav': 'wav',
  '.m4a': 'm4a',
};

/**
 * Document type patterns for filename-based classification
 * Based on reference implementation
 */
const DOCUMENT_TYPE_PATTERNS: Record<string, string[]> = {
  Motion: ['motion', 'mtd', 'mtc', 'mts', 'mtv'],
  Response: ['response', 'opposition', 'reply', 'answer'],
  Complaint: ['complaint', 'petition', 'amended complaint'],
  Order: ['order', 'ruling', 'judgment', 'decree'],
  Notice: ['notice', 'notification', 'noa'],
  Evidence: ['exhibit', 'evidence', 'attachment', 'affidavit'],
  Research: ['memo', 'research', 'analysis', 'brief'],
};

/**
 * Detect file type from file path extension
 *
 * @param filePath - Path to file (can be relative or absolute)
 * @returns File type category or 'unknown'
 */
export function detectFileType(filePath: string): Promise<string> {
  return Promise.resolve(getFileTypeSync(filePath));
}

/**
 * Synchronous file type detection from extension
 *
 * @param filePath - Path to file
 * @returns File type category or 'unknown'
 */
function getFileTypeSync(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  return FILE_TYPE_EXTENSIONS[ext] || 'unknown';
}

/**
 * Get DocumentType enum from file type string
 *
 * @param fileType - File type string (from detectFileType)
 * @returns DocumentType for classification
 */
export function getDocumentType(fileType: string): DocumentType {
  // File type doesn't directly map to document type
  // Document type is determined by filename patterns or AI classification
  // This function is for future use when we need to infer from MIME types
  return 'Unknown';
}

/**
 * Classify document type from filename using pattern matching
 *
 * @param filename - Original filename
 * @returns DocumentType classification
 */
export function classifyDocumentType(filename: string): DocumentType {
  const lowerFilename = filename.toLowerCase();

  // Check each document type's patterns
  for (const [docType, patterns] of Object.entries(DOCUMENT_TYPE_PATTERNS)) {
    if (patterns.some((pattern) => lowerFilename.includes(pattern))) {
      return docType as DocumentType;
    }
  }

  return 'Unknown';
}

/**
 * Check if file type is supported for document intake
 *
 * @param fileType - File type string (from detectFileType)
 * @returns True if supported, false otherwise
 */
export function isSupportedFileType(fileType: string): boolean {
  const supportedTypes: string[] = ['pdf', 'docx', 'txt', 'md', 'jpg', 'png', 'mp3', 'wav', 'm4a'];

  return supportedTypes.includes(fileType);
}

/**
 * Get all supported file extensions
 *
 * @returns Array of supported extensions (with leading dot)
 */
export function getSupportedExtensions(): string[] {
  return Object.keys(FILE_TYPE_EXTENSIONS);
}

/**
 * Get human-readable description of supported file types
 *
 * @returns Description string for user display
 */
export function getSupportedFileTypesDescription(): string {
  return 'PDF, DOCX, TXT, MD, JPG, PNG, MP3, WAV, M4A';
}

/**
 * Validate file extension
 *
 * @param filePath - Path to file
 * @returns True if extension is supported
 * @throws Error with descriptive message if not supported
 */
export function validateFileExtension(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase();

  if (!FILE_TYPE_EXTENSIONS[ext]) {
    const supported = getSupportedFileTypesDescription();
    throw new Error(`Unsupported file type: ${ext}. Supported types: ${supported}`);
  }

  return true;
}

/**
 * Sanitize filename for folder name creation
 * Removes special characters and normalizes spacing
 *
 * @param filename - Original filename
 * @returns Sanitized folder name
 */
export function sanitizeFolderName(filename: string): string {
  // Remove extension
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');

  // Convert to lowercase
  let sanitized = nameWithoutExt.toLowerCase();

  // Replace spaces and special characters with hyphens
  sanitized = sanitized.replace(/[^a-z0-9]+/g, '-');

  // Remove leading/trailing hyphens
  sanitized = sanitized.replace(/^-+|-+$/g, '');

  // Limit length to 100 characters
  sanitized = sanitized.substring(0, 100);

  // Ensure not empty
  if (!sanitized) {
    sanitized = 'document';
  }

  return sanitized;
}
