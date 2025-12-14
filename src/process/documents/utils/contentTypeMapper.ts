/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Content Type Mapper Utility
 *
 * Maps file extensions to MIME types and provides helper functions
 * for determining preview capabilities.
 */

/**
 * Map of file extensions to MIME types
 * Covers common document, image, audio, and video formats
 */
export const CONTENT_TYPE_MAP: Record<string, string> = {
  // Documents
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.rtf': 'application/rtf',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.html': 'text/html',
  '.htm': 'text/html',

  // Images
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.heic': 'image/heic',
  '.heif': 'image/heif',

  // Audio
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.flac': 'audio/flac',
  '.aac': 'audio/aac',
  '.wma': 'audio/x-ms-wma',
  '.aiff': 'audio/aiff',

  // Video
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska',
  '.wmv': 'video/x-ms-wmv',
  '.flv': 'video/x-flv',
  '.m4v': 'video/x-m4v',
  '.3gp': 'video/3gpp',

  // Archives (for reference, won't preview inline)
  '.zip': 'application/zip',
  '.rar': 'application/x-rar-compressed',
  '.7z': 'application/x-7z-compressed',
  '.tar': 'application/x-tar',
  '.gz': 'application/gzip',
};

/**
 * Preview types for different content categories
 */
export type PreviewType = 'pdf' | 'image' | 'video' | 'audio' | 'text' | 'office' | 'none';

/**
 * Get the MIME content type for a filename
 *
 * @param filename - Filename with extension
 * @returns MIME type string
 */
export function getContentType(filename: string): string {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return CONTENT_TYPE_MAP[ext] || 'application/octet-stream';
}

/**
 * Check if a content type can be previewed in the browser
 *
 * @param contentType - MIME type
 * @returns True if the content can be previewed inline
 */
export function isPreviewable(contentType: string): boolean {
  return (
    contentType.startsWith('image/') ||
    contentType.startsWith('video/') ||
    contentType.startsWith('audio/') ||
    contentType === 'application/pdf' ||
    contentType.startsWith('text/')
  );
}

/**
 * Get the preview type category for a content type
 *
 * @param contentType - MIME type
 * @returns Preview type category
 */
export function getPreviewType(contentType: string): PreviewType {
  if (contentType === 'application/pdf') return 'pdf';
  if (contentType.startsWith('image/')) return 'image';
  if (contentType.startsWith('video/')) return 'video';
  if (contentType.startsWith('audio/')) return 'audio';
  if (contentType.startsWith('text/')) return 'text';
  if (contentType.includes('word') || contentType.includes('document')) return 'office';
  if (contentType.includes('excel') || contentType.includes('spreadsheet')) return 'office';
  if (contentType.includes('powerpoint') || contentType.includes('presentation')) return 'office';
  return 'none';
}

/**
 * Get the file extension from a filename
 *
 * @param filename - Filename
 * @returns Extension with dot (e.g., '.pdf')
 */
export function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return '';
  return filename.substring(lastDot).toLowerCase();
}

/**
 * Check if a file extension is supported for upload
 *
 * @param filename - Filename with extension
 * @returns True if extension is in our content type map
 */
export function isSupportedExtension(filename: string): boolean {
  const ext = getExtension(filename);
  return ext in CONTENT_TYPE_MAP;
}

/**
 * Get a human-readable file type label
 *
 * @param contentType - MIME type
 * @returns Human-readable label
 */
export function getFileTypeLabel(contentType: string): string {
  const previewType = getPreviewType(contentType);

  switch (previewType) {
    case 'pdf':
      return 'PDF Document';
    case 'image':
      return 'Image';
    case 'video':
      return 'Video';
    case 'audio':
      return 'Audio';
    case 'text':
      return 'Text Document';
    case 'office':
      if (contentType.includes('word') || contentType.includes('document')) return 'Word Document';
      if (contentType.includes('excel') || contentType.includes('spreadsheet')) return 'Spreadsheet';
      if (contentType.includes('powerpoint') || contentType.includes('presentation')) return 'Presentation';
      return 'Office Document';
    default:
      return 'File';
  }
}
