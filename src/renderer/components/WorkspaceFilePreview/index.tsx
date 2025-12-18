/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import MarkdownView from '@/renderer/components/Markdown';
import { Modal, Spin } from '@arco-design/web-react';
import { Close, Copy } from '@icon-park/react';
import React, { useEffect, useState } from 'react';
import './WorkspaceFilePreview.css';

interface WorkspaceFilePreviewProps {
  /** Full path to the file on disk */
  filePath: string;
  /** Display filename */
  filename: string;
  /** Whether the modal is visible */
  visible: boolean;
  /** Close handler */
  onClose: () => void;
  /** Optional: Open file externally */
  onOpenExternal?: () => void;
}

/**
 * Workspace File Preview Modal
 *
 * Renders markdown and HTML files directly in-app without triggering browser downloads.
 * - Markdown: Uses react-markdown for native rendering
 * - HTML: Uses srcdoc iframe (inline content, no URL)
 * - Other text: Displays as plain text
 */
export const WorkspaceFilePreview: React.FC<WorkspaceFilePreviewProps> = ({ filePath, filename, visible, onClose, onOpenExternal }) => {
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState<string>('');
  const [mimeType, setMimeType] = useState<string>('text/plain');
  const [error, setError] = useState<string | null>(null);

  // Load file content when modal opens
  useEffect(() => {
    if (!visible || !filePath) {
      setLoading(true);
      setContent('');
      setError(null);
      return;
    }

    const loadFile = async () => {
      try {
        setLoading(true);
        setError(null);

        const result = await ipcBridge.fs.readFileContent.invoke({ filePath });
        setContent(result.content);
        setMimeType(result.mimeType);
      } catch (err) {
        console.error('[WorkspaceFilePreview] Failed to load file:', err);
        setError(err instanceof Error ? err.message : 'Failed to load file');
      } finally {
        setLoading(false);
      }
    };

    loadFile();
  }, [filePath, visible]);

  /**
   * Render content based on MIME type
   */
  const renderContent = () => {
    if (mimeType === 'text/markdown') {
      return (
        <div className='preview-markdown-container'>
          <MarkdownView>{content}</MarkdownView>
        </div>
      );
    }

    if (mimeType === 'text/html') {
      // Use srcdoc to render HTML inline - no URL, no download prompt
      return <iframe srcDoc={content} className='preview-html-iframe' title={filename} sandbox='allow-same-origin' />;
    }

    // Plain text / code
    return (
      <div className='preview-text-container'>
        <pre className='preview-text-content'>{content}</pre>
      </div>
    );
  };

  const handleOpenExternal = () => {
    if (onOpenExternal) {
      onOpenExternal();
    } else {
      ipcBridge.shell.openFile.invoke(filePath).catch((err) => {
        console.error('[WorkspaceFilePreview] Failed to open externally:', err);
      });
    }
  };

  return (
    <Modal visible={visible} onCancel={onClose} footer={null} closable={false} maskClosable={true} style={{ width: '90vw', maxWidth: '1200px', height: '90vh', maxHeight: '900px' }} wrapClassName='workspace-file-preview-modal-wrap'>
      <div className='workspace-file-preview-modal'>
        <div className='preview-header'>
          <span className='preview-filename' title={filePath}>
            {filename}
          </span>
          <div className='preview-header-actions'>
            <button onClick={handleOpenExternal} className='header-action-btn' title='Open in external editor'>
              <Copy size={18} />
            </button>
            <button onClick={onClose} className='preview-close' title='Close'>
              <Close size={20} />
            </button>
          </div>
        </div>
        <div className='preview-content'>
          {loading && (
            <div className='preview-loading'>
              <Spin size={40} />
              <p>Loading file...</p>
            </div>
          )}
          {error && (
            <div className='preview-error'>
              <div className='error-icon'>⚠️</div>
              <p>{error}</p>
            </div>
          )}
          {!loading && !error && renderContent()}
        </div>
      </div>
    </Modal>
  );
};

export default WorkspaceFilePreview;
