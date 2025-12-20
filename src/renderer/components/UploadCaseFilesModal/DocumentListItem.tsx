/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Badge, Button } from '@arco-design/web-react';
import { DeleteOne, Download, Eyes } from '@icon-park/react';
import type { ICaseDocument, ProcessingStatus } from '@process/documents/types';
import React from 'react';
import { ProgressIndicator } from './ProgressIndicator';

interface DocumentListItemProps {
  document: ICaseDocument;
  onPreview: (documentId: string) => void;
  onDownload: (documentId: string) => void;
  onDelete: (documentId: string) => void;
}

/**
 * Get badge color for processing status
 */
const getStatusColor = (status: ProcessingStatus): 'default' | 'processing' | 'success' | 'error' => {
  switch (status) {
    case 'pending':
      return 'default';
    case 'extracting':
      return 'processing';
    case 'analyzing':
      return 'processing';
    case 'indexing':
      return 'processing';
    case 'complete':
      return 'success';
    case 'failed':
      return 'error';
    default:
      return 'default';
  }
};

/**
 * Get badge label for processing status
 */
const getStatusLabel = (status: ProcessingStatus): string => {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'extracting':
      return 'Extracting';
    case 'analyzing':
      return 'Analyzing';
    case 'indexing':
      return 'Indexing';
    case 'complete':
      return 'Complete';
    case 'failed':
      return 'Failed';
    default:
      return 'Unknown';
  }
};

/**
 * Format timestamp to relative time
 */
const formatTimestamp = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return 'Just now';
  if (minutes === 1) return '1 minute ago';
  if (minutes < 60) return `${minutes} minutes ago`;

  const hours = Math.floor(minutes / 60);
  if (hours === 1) return '1 hour ago';
  if (hours < 24) return `${hours} hours ago`;

  return new Date(timestamp).toLocaleDateString();
};

/**
 * Individual document list item component
 * Displays document info, progress, status, and action buttons
 */
export const DocumentListItem: React.FC<DocumentListItemProps> = ({ document, onPreview, onDownload, onDelete }) => {
  const isComplete = document.processing_status === 'complete';
  const isFailed = document.processing_status === 'failed';
  const hasFileSearch = document.rag_indexed === 1 && document.gemini_file_uri;

  return (
    <div className='document-list-item'>
      <div className='file-icon'>📄</div>

      <div className='file-info'>
        <div className='file-name'>{document.filename}</div>
        <div className='file-meta'>
          {formatTimestamp(document.uploaded_at)}
          {hasFileSearch && (
            <span className='file-search-indicator' title={`File Search: ${document.gemini_file_uri}`}>
              {' • '}
              <span className='file-search-icon'>🔍</span> Indexed
            </span>
          )}
        </div>
        {hasFileSearch && document.gemini_file_uri && (
          <div className='file-search-path' title={document.gemini_file_uri}>
            {document.gemini_file_uri}
          </div>
        )}
      </div>

      <div className='progress-section'>
        <ProgressIndicator status={document.processing_status} />
      </div>

      <div className='status-badge'>
        <Badge status={getStatusColor(document.processing_status)} text={getStatusLabel(document.processing_status)} />
      </div>

      {isComplete && (
        <div className='action-buttons'>
          <Button type='text' icon={<Eyes />} onClick={() => onPreview(document.id)}>
            Preview
          </Button>
          <Button type='text' icon={<Download />} onClick={() => onDownload(document.id)}>
            Download
          </Button>
          <Button type='text' status='danger' icon={<DeleteOne />} onClick={() => onDelete(document.id)}>
            Delete
          </Button>
        </div>
      )}

      {isFailed && (
        <div className='action-buttons'>
          <Button type='text' status='danger' icon={<DeleteOne />} onClick={() => onDelete(document.id)}>
            Delete
          </Button>
        </div>
      )}
    </div>
  );
};
