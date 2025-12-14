/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Modal, Spin } from '@arco-design/web-react';
import { Close, Download } from '@icon-park/react';
import React, { useEffect, useState } from 'react';
import './DocumentPreview.css';

/**
 * Preview data returned from the API
 */
interface PreviewData {
  url: string;
  contentType: string;
  previewType: 'pdf' | 'image' | 'video' | 'audio' | 'text' | 'office' | 'none';
  filename: string;
  isPreviewable?: boolean;
  isLocal?: boolean;
  expiresIn: number | null;
}

interface DocumentPreviewProps {
  documentId: string;
  visible: boolean;
  onClose: () => void;
}

/**
 * Document Preview Modal Component
 *
 * Fetches a pre-signed URL from the backend and renders the appropriate preview
 * based on the content type (PDF, image, video, audio, etc.)
 */
export const DocumentPreview: React.FC<DocumentPreviewProps> = ({ documentId, visible, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !documentId) {
      setLoading(true);
      setPreviewData(null);
      setError(null);
      return;
    }

    const fetchPreviewUrl = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/documents/${documentId}/preview-url`, {
          credentials: 'include',
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to get preview URL');
        }

        const data = await response.json();
        setPreviewData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Preview failed');
      } finally {
        setLoading(false);
      }
    };

    fetchPreviewUrl();
  }, [documentId, visible]);

  /**
   * Handle download button click
   */
  const handleDownload = async () => {
    try {
      const response = await fetch(`/api/documents/${documentId}/download-url`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to get download URL');
      }

      const data = await response.json();

      // Open the signed URL in a new tab/window to trigger download
      window.open(data.url, '_blank');
    } catch (err) {
      console.error('[DocumentPreview] Download error:', err);
    }
  };

  /**
   * Render the appropriate preview based on content type
   */
  const renderPreview = () => {
    if (!previewData) return null;

    switch (previewData.previewType) {
      case 'pdf':
        return (
          <iframe
            src={previewData.url}
            className="preview-iframe"
            title={previewData.filename}
          />
        );

      case 'image':
        return (
          <div className="preview-image-container">
            <img
              src={previewData.url}
              alt={previewData.filename}
              className="preview-image"
            />
          </div>
        );

      case 'video':
        return (
          <video
            src={previewData.url}
            controls
            autoPlay={false}
            className="preview-video"
          >
            Your browser does not support video playback.
          </video>
        );

      case 'audio':
        return (
          <div className="preview-audio-container">
            <div className="audio-icon">🔊</div>
            <div className="audio-filename">{previewData.filename}</div>
            <audio
              src={previewData.url}
              controls
              className="preview-audio"
            >
              Your browser does not support audio playback.
            </audio>
          </div>
        );

      case 'text':
        return (
          <iframe
            src={previewData.url}
            className="preview-iframe preview-text"
            title={previewData.filename}
          />
        );

      case 'office':
        // For Word documents, suggest download or external viewer
        return (
          <div className="preview-unavailable">
            <div className="preview-icon">📄</div>
            <p className="preview-message">
              Word documents cannot be previewed directly.
            </p>
            <p className="preview-submessage">
              Click the download button to view the file.
            </p>
            <button onClick={handleDownload} className="download-button">
              <Download /> Download File
            </button>
          </div>
        );

      default:
        return (
          <div className="preview-unavailable">
            <div className="preview-icon">📁</div>
            <p className="preview-message">
              Preview not available for this file type.
            </p>
            <p className="preview-submessage">
              Click the download button to view the file.
            </p>
            <button onClick={handleDownload} className="download-button">
              <Download /> Download File
            </button>
          </div>
        );
    }
  };

  return (
    <Modal
      visible={visible}
      onCancel={onClose}
      footer={null}
      closable={false}
      maskClosable={true}
      style={{ width: '90vw', maxWidth: '1200px', height: '90vh', maxHeight: '900px' }}
      wrapClassName="document-preview-modal-wrap"
    >
      <div className="document-preview-modal">
        <div className="preview-header">
          <span className="preview-filename">
            {previewData?.filename || 'Loading...'}
          </span>
          <div className="preview-header-actions">
            {previewData && (
              <button onClick={handleDownload} className="header-download-btn" title="Download">
                <Download size={18} />
              </button>
            )}
            <button onClick={onClose} className="preview-close" title="Close">
              <Close size={20} />
            </button>
          </div>
        </div>
        <div className="preview-content">
          {loading && (
            <div className="preview-loading">
              <Spin size={40} />
              <p>Loading preview...</p>
            </div>
          )}
          {error && (
            <div className="preview-error">
              <div className="error-icon">⚠️</div>
              <p>{error}</p>
            </div>
          )}
          {!loading && !error && renderPreview()}
        </div>
      </div>
    </Modal>
  );
};

export default DocumentPreview;
