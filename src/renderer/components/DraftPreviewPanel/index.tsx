/**
 * DraftPreviewPanel - Renders JSON legal drafts as court-formatted documents
 *
 * Phase 1: Read-only rendering
 * Phase 2 (future): Click-to-edit inline editing
 */

import { ipcBridge } from '@/common';
import { Empty, Spin } from '@arco-design/web-react';
import { Close } from '@icon-park/react';
import classNames from 'classnames';
import React, { useEffect, useState, useMemo } from 'react';
import { generateDraftHtml } from './generateHtml';
import type { DraftDocument } from './types';

export interface DraftPreviewTab {
  filePath: string;
  filename: string;
}

interface DraftPreviewPanelProps {
  tabs: DraftPreviewTab[];
  activeTab: number;
  onTabSelect: (index: number) => void;
  onTabClose: (index: number) => void;
}

/** Check if a file is a draft JSON file */
export function isDraftFile(filePath: string): boolean {
  return filePath.endsWith('DRAFT.json');
}

/**
 * DraftPreviewPanel - Main component for rendering legal drafts
 */
const DraftPreviewPanel: React.FC<DraftPreviewPanelProps> = ({ tabs, activeTab, onTabSelect, onTabClose }) => {
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<DraftDocument | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentTab = tabs[activeTab];
  const filePath = currentTab?.filePath;

  // Load and parse draft JSON
  useEffect(() => {
    if (!filePath) {
      setLoading(false);
      setDraft(null);
      setError(null);
      return;
    }

    const loadDraft = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await ipcBridge.fs.readFileContent.invoke({ filePath });

        if (result.error) {
          setError(result.error);
          return;
        }

        const parsed = JSON.parse(result.content) as DraftDocument;

        // Validate basic structure
        if (!parsed.document_type || !parsed.body || !Array.isArray(parsed.body)) {
          setError('Invalid draft format: missing required fields');
          return;
        }

        setDraft(parsed);
      } catch (err) {
        console.error('[DraftPreviewPanel] Failed to load draft:', err);
        setError(err instanceof Error ? err.message : 'Failed to load draft');
      } finally {
        setLoading(false);
      }
    };

    void loadDraft();
  }, [filePath]);

  // Generate HTML from draft
  const renderedHtml = useMemo(() => {
    if (!draft) return '';
    return generateDraftHtml(draft);
  }, [draft]);

  if (tabs.length === 0) {
    return (
      <div className='size-full flex items-center justify-center px-16px text-13px text-t-secondary'>
        <Empty description='Select a draft file to preview it here.' />
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
              📄 {tab.filename.replace('DRAFT.json', 'Draft')}
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
      <div className='flex-1 overflow-auto min-h-0 bg-[#f5f5f5]'>
        {loading && (
          <div className='flex flex-col items-center justify-center h-full gap-8px'>
            <Spin size={24} />
            <span className='text-12px text-t-secondary'>Loading draft...</span>
          </div>
        )}
        {error && !loading && (
          <div className='flex flex-col items-center justify-center h-full text-center px-16px'>
            <span className='text-13px font-semibold text-red-6'>Failed to load draft</span>
            <span className='mt-4px text-12px text-t-secondary break-all'>{error}</span>
          </div>
        )}
        {!loading && !error && draft && (
          <iframe srcDoc={renderedHtml} className='w-full h-full border-none' title={currentTab?.filename || 'Draft Preview'} sandbox='allow-same-origin' />
        )}
      </div>
    </div>
  );
};

export default DraftPreviewPanel;
export type { DraftDocument } from './types';
