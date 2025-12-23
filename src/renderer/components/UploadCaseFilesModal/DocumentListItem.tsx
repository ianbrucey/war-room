/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Badge, Button, Input, Message, Modal, Spin } from '@arco-design/web-react';
import { DeleteOne, Download, EditTwo, Eyes } from '@icon-park/react';
import type { ICaseDocument, ProcessingStatus } from '@process/documents/types';
import React, { useCallback, useEffect, useState } from 'react';
import { ProgressIndicator } from './ProgressIndicator';

const { TextArea } = Input;

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

  // User notes modal state
  const [notesModalVisible, setNotesModalVisible] = useState(false);
  const [userNotes, setUserNotes] = useState('');
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [hasNotes, setHasNotes] = useState(false);

  // React 18 compatible message hook
  const [message, messageContextHolder] = Message.useMessage();

  // Check if notes exist on mount (for completed documents)
  useEffect(() => {
    if (isComplete) {
      // Quick check to see if notes exist (without loading full notes)
      fetch(`/api/documents/${document.id}/user-notes`, { credentials: 'include' })
        .then((res) => res.ok ? res.json() : null)
        .then((data) => {
          if (data) {
            setHasNotes(Boolean(data.user_notes));
          }
        })
        .catch(() => { /* ignore errors */ });
    }
  }, [document.id, isComplete]);

  // Load user notes from server
  const loadUserNotes = useCallback(async () => {
    setLoadingNotes(true);
    try {
      const response = await fetch(`/api/documents/${document.id}/user-notes`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setUserNotes(data.user_notes || '');
        setHasNotes(Boolean(data.user_notes));
      }
    } catch (error) {
      console.error('[DocumentListItem] Failed to load user notes:', error);
    } finally {
      setLoadingNotes(false);
    }
  }, [document.id]);

  // Save user notes to server
  const saveUserNotes = useCallback(async () => {
    setSavingNotes(true);
    try {
      const response = await fetch(`/api/documents/${document.id}/user-notes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ user_notes: userNotes }),
      });
      if (response.ok) {
        setHasNotes(Boolean(userNotes));
        message.success('Notes saved successfully');
        setNotesModalVisible(false);
      } else {
        message.error('Failed to save notes');
      }
    } catch (error) {
      console.error('[DocumentListItem] Failed to save user notes:', error);
      message.error('Failed to save notes');
    } finally {
      setSavingNotes(false);
    }
  }, [document.id, userNotes, message]);

  // Open notes modal and load existing notes
  const handleOpenNotesModal = useCallback(() => {
    setNotesModalVisible(true);
    loadUserNotes();
  }, [loadUserNotes]);

  return (
    <div className='document-list-item'>
      {messageContextHolder}
      <div className='file-icon'>📄</div>

      <div className='file-info'>
        <div className='file-name'>
          {document.filename}
          {hasNotes && <span className='has-notes-indicator' title='Has user notes'>📝</span>}
        </div>
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
          <Button type='text' icon={<EditTwo />} onClick={handleOpenNotesModal}>
            Notes
          </Button>
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

      {/* User Notes Modal */}
      <Modal
        title={`Notes: ${document.filename}`}
        visible={notesModalVisible}
        onCancel={() => setNotesModalVisible(false)}
        onOk={saveUserNotes}
        okText='Save'
        confirmLoading={savingNotes}
        style={{ maxWidth: 600 }}
      >
        {loadingNotes ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <Spin />
          </div>
        ) : (
          <>
            <p style={{ marginBottom: 12, color: 'var(--color-text-3)' }}>
              Add context or notes about this document. These notes will be available to the AI during case summary generation.
            </p>
            <TextArea
              value={userNotes}
              onChange={setUserNotes}
              placeholder='e.g., "This is a handwritten note from the plaintiff describing the incident. The date on the document is incorrect - the actual incident occurred on March 15, not March 5."'
              autoSize={{ minRows: 4, maxRows: 10 }}
              style={{ width: '100%' }}
            />
          </>
        )}
      </Modal>
    </div>
  );
};
