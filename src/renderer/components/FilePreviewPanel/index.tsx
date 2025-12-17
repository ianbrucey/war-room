/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import MarkdownView from '@/renderer/components/Markdown';
import { Empty, Spin } from '@arco-design/web-react';
import React, { useEffect, useState } from 'react';

interface FilePreviewPanelProps {
  /** Full path to the file on disk */
  filePath?: string;
  /** Display filename */
  filename?: string;
}

/**
 * Inline File Preview Panel
 *
 * Renders markdown and HTML files directly in the middle pane of the
 * conversation layout. This mirrors the behaviour of WorkspaceFilePreview
 * but without using a modal.
 */
const FilePreviewPanel: React.FC<FilePreviewPanelProps> = ({ filePath, filename }) => {
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<string>('');
  const [mimeType, setMimeType] = useState<string>('text/plain');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!filePath) {
      setLoading(false);
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
        console.error('[FilePreviewPanel] Failed to load file:', err);
        setError(err instanceof Error ? err.message : 'Failed to load file');
      } finally {
        setLoading(false);
      }
    };

    void loadFile();
  }, [filePath]);

  const renderContent = () => {
    if (mimeType === 'text/markdown') {
      return (
        <div className='preview-markdown-container'>
          <MarkdownView>{content}</MarkdownView>
        </div>
      );
    }

    if (mimeType === 'text/html') {
      return (
        <iframe
          srcDoc={content}
          className='preview-html-iframe'
          title={filename}
          sandbox='allow-same-origin'
        />
      );
    }

    return (
      <div className='preview-text-container'>
        <pre className='preview-text-content'>{content}</pre>
      </div>
    );
  };

  if (!filePath) {
    return (
      <div className='size-full flex items-center justify-center px-16px text-13px text-t-secondary'>
        <Empty description='Select a file in the workspace to preview it here.' />
      </div>
    );
  }

  return (
    <div className='size-full flex flex-col bg-1 border-l border-[var(--bg-3)]'>
      <div className='flex items-center justify-between px-12px py-8px border-b border-[var(--bg-3)]'>
        <span className='text-13px font-medium text-t-primary truncate' title={filePath}>
          {filename || filePath}
        </span>
      </div>
      <div className='flex-1 overflow-auto px-12px py-8px'>
        {loading && (
          <div className='flex flex-col items-center justify-center h-full gap-8px'>
            <Spin size={24} />
            <span className='text-12px text-t-secondary'>Loading file...</span>
          </div>
        )}
        {error && !loading && (
          <div className='flex flex-col items-center justify-center h-full text-center px-16px'>
            <span className='text-13px font-semibold text-red-6'>Failed to load file</span>
            <span className='mt-4px text-12px text-t-secondary break-all'>{error}</span>
          </div>
        )}
        {!loading && !error && renderContent()}
      </div>
    </div>
  );
};

export default FilePreviewPanel;

