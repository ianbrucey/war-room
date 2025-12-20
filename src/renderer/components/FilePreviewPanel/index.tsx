/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import MarkdownView from '@/renderer/components/Markdown';
import { Empty, Spin } from '@arco-design/web-react';
import { Close } from '@icon-park/react';
import classNames from 'classnames';
import React, { useEffect, useState } from 'react';

export interface PreviewTab {
  filePath: string;
  filename: string;
}

interface FilePreviewPanelProps {
  /** Array of open tabs */
  tabs: PreviewTab[];
  /** Currently active tab index */
  activeTab: number;
  /** Callback when tab is selected */
  onTabSelect: (index: number) => void;
  /** Callback when tab is closed */
  onTabClose: (index: number) => void;
}

/**
 * Inline File Preview Panel with Tabs
 *
 * Renders markdown and HTML files directly in the middle pane of the
 * conversation layout. Supports multiple tabs for switching between files.
 */
const FilePreviewPanel: React.FC<FilePreviewPanelProps> = ({ tabs, activeTab, onTabSelect, onTabClose }) => {
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<string>('');
  const [mimeType, setMimeType] = useState<string>('text/plain');
  const [error, setError] = useState<string | null>(null);

  const currentTab = tabs[activeTab];
  const filePath = currentTab?.filePath;
  const filename = currentTab?.filename;

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

        // Check if the backend returned an error
        if (result.error) {
          console.error('[FilePreviewPanel] Backend returned error:', result.error);
          setError(result.error);
        } else {
          setContent(result.content);
          setMimeType(result.mimeType);
        }
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
      return <iframe srcDoc={content} className='preview-html-iframe' title={filename} sandbox='allow-same-origin' />;
    }

    return (
      <div className='preview-text-container'>
        <pre className='preview-text-content'>{content}</pre>
      </div>
    );
  };

  if (tabs.length === 0) {
    return (
      <div className='size-full flex items-center justify-center px-16px text-13px text-t-secondary'>
        <Empty description='Select a file in the workspace to preview it here.' />
      </div>
    );
  }

  return (
    <div className='size-full flex flex-col'>
      {/* Tab Bar */}
      <div className='flex items-center border-b border-[var(--bg-3)] bg-2 overflow-x-auto flex-shrink-0'>
        {tabs.map((tab, index) => (
          <div
            key={tab.filePath}
            className={classNames('flex items-center gap-6px px-12px py-8px cursor-pointer border-r border-[var(--bg-3)] min-w-0 max-w-180px group', {
              'bg-1': index === activeTab,
              'hover:bg-hover': index !== activeTab,
            })}
            onClick={() => onTabSelect(index)}
          >
            <span className='text-13px truncate flex-1 text-t-primary' title={tab.filePath}>
              {tab.filename}
            </span>
            <button
              className='flex items-center justify-center w-16px h-16px rounded-4px hover:bg-[var(--bg-4)] opacity-0 group-hover:opacity-100 transition-opacity border-none bg-transparent cursor-pointer flex-shrink-0'
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(index);
              }}
            >
              <Close theme='outline' size='12' className='text-t-secondary' />
            </button>
          </div>
        ))}
      </div>

      {/* Content Area */}
      <div className='flex-1 overflow-auto px-12px py-8px min-h-0'>
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
