/**
 * DraftPreviewPanel - Renders JSON legal drafts as court-formatted documents
 * with inline click-to-edit functionality
 */

import { ipcBridge } from '@/common';
import { Empty, Message, Spin } from '@arco-design/web-react';
import { Close } from '@icon-park/react';
import classNames from 'classnames';
import React, { useEffect, useRef, useState } from 'react';
import type { DraftBlock, DraftDocument } from './types';

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
  const [message, messageContextHolder] = Message.useMessage();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<DraftDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [insertMenuIndex, setInsertMenuIndex] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  // Reset editing state when switching tabs
  useEffect(() => {
    setEditingBlockId(null);
    setEditText('');
  }, [filePath]);

  // Focus textarea when editing starts
  useEffect(() => {
    if (editingBlockId && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [editingBlockId]);

  // Start editing a block
  const handleBlockClick = (block: DraftBlock) => {
    setEditingBlockId(block.id);
    setEditText(block.content);
  };

  // Cancel editing
  const handleCancel = () => {
    setEditingBlockId(null);
    setEditText('');
  };

  // Save edited block
  const handleSave = async () => {
    if (!draft || !filePath || !editingBlockId) return;

    const updatedBody = draft.body.map((block) => (block.id === editingBlockId ? { ...block, content: editText } : block));

    const updatedDraft: DraftDocument = {
      ...draft,
      body: updatedBody,
      metadata: { ...draft.metadata, last_modified: new Date().toISOString() },
    };

    try {
      setSaving(true);
      const jsonString = JSON.stringify(updatedDraft, null, 2);
      const encoder = new TextEncoder();
      const uint8Array = encoder.encode(jsonString);
      await ipcBridge.fs.writeFile.invoke({
        path: filePath,
        data: uint8Array,
      });
      setDraft(updatedDraft);
      setEditingBlockId(null);
      setEditText('');
      message.success('Saved');
    } catch (err) {
      console.error('[DraftPreviewPanel] Failed to save:', err);
      message.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  // Delete a block
  const handleDelete = async () => {
    if (!draft || !filePath || !editingBlockId) return;

    const updatedBody = draft.body.filter((block) => block.id !== editingBlockId);

    // Don't allow deleting the last block
    if (updatedBody.length === 0) {
      message.warning('Cannot delete the last block');
      return;
    }

    const updatedDraft: DraftDocument = {
      ...draft,
      body: updatedBody,
      metadata: { ...draft.metadata, last_modified: new Date().toISOString() },
    };

    try {
      setSaving(true);
      const jsonString = JSON.stringify(updatedDraft, null, 2);
      const encoder = new TextEncoder();
      const uint8Array = encoder.encode(jsonString);
      await ipcBridge.fs.writeFile.invoke({
        path: filePath,
        data: uint8Array,
      });
      setDraft(updatedDraft);
      setEditingBlockId(null);
      setEditText('');
      message.success('Block deleted');
    } catch (err) {
      console.error('[DraftPreviewPanel] Failed to delete block:', err);
      message.error('Failed to delete block');
    } finally {
      setSaving(false);
    }
  };

  // Handle keyboard shortcuts in textarea
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      void handleSave();
    }
  };

  // Generate unique ID for new blocks
  const generateBlockId = () => {
    return `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  // Insert a new block at the specified index
  const handleInsertBlock = async (insertAfterIndex: number, blockType: DraftBlock['type'], listStyle?: DraftBlock['list_style']) => {
    if (!draft || !filePath) return;

    const placeholders: Record<DraftBlock['type'], string> = {
      section_heading: '[NEW SECTION HEADING]',
      numbered_paragraph: '[New paragraph - click to edit]',
      unnumbered_paragraph: '[New unnumbered paragraph - click to edit]',
      block_quote: '[New quote - click to edit]',
      list_item: '[New list item - click to edit]',
    };

    const newBlock: DraftBlock = {
      id: generateBlockId(),
      type: blockType,
      content: placeholders[blockType],
      ...(blockType === 'list_item' && { list_style: listStyle || 'letter' }),
    };

    const newBody = [...draft.body];
    newBody.splice(insertAfterIndex + 1, 0, newBlock);

    const updatedDraft: DraftDocument = {
      ...draft,
      body: newBody,
      metadata: { ...draft.metadata, last_modified: new Date().toISOString() },
    };

    try {
      setSaving(true);
      const jsonString = JSON.stringify(updatedDraft, null, 2);
      const encoder = new TextEncoder();
      const uint8Array = encoder.encode(jsonString);
      await ipcBridge.fs.writeFile.invoke({
        path: filePath,
        data: uint8Array,
      });
      setDraft(updatedDraft);
      // Start editing the new block immediately
      setEditingBlockId(newBlock.id);
      setEditText(newBlock.content);
      message.success('Block added');
    } catch (err) {
      console.error('[DraftPreviewPanel] Failed to insert block:', err);
      message.error('Failed to add block');
    } finally {
      setSaving(false);
    }
  };

  // Compute paragraph number for a block
  const getParagraphNumber = (blockId: string): number => {
    if (!draft) return 0;
    let num = 0;
    for (const block of draft.body) {
      if (block.type === 'numbered_paragraph') num++;
      if (block.id === blockId) return num;
    }
    return 0;
  };

  // Compute list item label (a, b, c or i, ii, iii)
  const getListItemLabel = (blockId: string, style: DraftBlock['list_style']): string => {
    if (!draft) return '';
    // Count consecutive list items of the same style before this one
    let count = 0;
    for (const block of draft.body) {
      if (block.type === 'list_item' && block.list_style === style) {
        count++;
        if (block.id === blockId) break;
      } else if (block.type !== 'list_item') {
        // Reset counter when we hit a non-list-item (new list starts)
        count = 0;
      }
    }

    if (style === 'roman') {
      const romanNumerals = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii'];
      return `(${romanNumerals[count - 1] || count})`;
    } else if (style === 'bullet') {
      return '•';
    } else {
      // letter style (default)
      return `(${String.fromCharCode(96 + count)})`;  // 97 = 'a'
    }
  };

  if (tabs.length === 0) {
    return (
      <div className='size-full flex items-center justify-center px-16px text-13px text-t-secondary'>
        <Empty description='Select a draft file to preview it here.' />
      </div>
    );
  }

  const c = draft?.caption;

  return (
    <div className='size-full flex flex-col'>
      {messageContextHolder}
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
        {!loading && !error && draft && c && (
          <div className='draft-document'>
            {/* Court Caption */}
            <div className='court-caption'>
              {c.court_name}
              {c.court_division && <br />}
              {c.court_division}
            </div>

            {/* Case Caption Table */}
            <table className='case-caption'>
              <tbody>
                <tr>
                  <td className='case-left'>
                    {c.plaintiff || '[PLAINTIFF]'},<br />
                    <br />
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Plaintiff,
                    <br />
                    <br />
                    v.
                    <br />
                    <br />
                    {c.defendant || '[DEFENDANT]'},<br />
                    <br />
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Defendant.
                  </td>
                  <td className='case-right'>
                    <br />
                    <br />
                    <br />
                    <br />
                    Civil Action File No.
                    <br />
                    {c.case_number || '[CASE NUMBER]'}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Document Title */}
            <div className='motion-title'>{c.document_title || 'LEGAL DOCUMENT'}</div>

            {/* Body Blocks with Insert Buttons */}
            {draft.body.map((block, index) => {
              const isEditing = editingBlockId === block.id;
              const paraNum = block.type === 'numbered_paragraph' ? getParagraphNumber(block.id) : 0;
              const showInsertMenu = insertMenuIndex === index;

              // Render insert row with menu
              const renderInsertRow = (idx: number) => (
                <div key={`insert-${idx}`} className='insert-row'>
                  {showInsertMenu ? (
                    <div className='insert-menu'>
                      <button
                        className='insert-menu-btn'
                        onClick={() => { void handleInsertBlock(idx, 'numbered_paragraph'); setInsertMenuIndex(null); }}
                        disabled={saving}
                      >
                        ¶ Paragraph
                      </button>
                      <button
                        className='insert-menu-btn'
                        onClick={() => { void handleInsertBlock(idx, 'list_item', 'letter'); setInsertMenuIndex(null); }}
                        disabled={saving}
                      >
                        ⒜ List Item
                      </button>
                      <button
                        className='insert-menu-btn'
                        onClick={() => { void handleInsertBlock(idx, 'section_heading'); setInsertMenuIndex(null); }}
                        disabled={saving}
                      >
                        § Section
                      </button>
                      <button
                        className='insert-menu-btn'
                        onClick={() => { void handleInsertBlock(idx, 'block_quote'); setInsertMenuIndex(null); }}
                        disabled={saving}
                      >
                        ❝ Quote
                      </button>
                      <button
                        className='insert-menu-btn insert-menu-cancel'
                        onClick={() => setInsertMenuIndex(null)}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      className='insert-btn'
                      onClick={() => setInsertMenuIndex(idx)}
                      title='Add block here'
                      disabled={saving}
                    >
                      +
                    </button>
                  )}
                </div>
              );

              // Get list item label if applicable
              const listLabel = block.type === 'list_item' ? getListItemLabel(block.id, block.list_style || 'letter') : '';

              // Editing mode - same for all block types
              if (isEditing) {
                return (
                  <React.Fragment key={block.id}>
                    <div className={`edit-block ${block.type === 'section_heading' ? 'edit-block-heading' : ''} ${block.type === 'list_item' ? 'edit-block-list' : ''}`}>
                      {block.type === 'section_heading' && <span className='edit-label'>Section Heading</span>}
                      {block.type === 'numbered_paragraph' && <span className='para-num'>{paraNum}.</span>}
                      {block.type === 'list_item' && <span className='list-label'>{listLabel}</span>}
                      {block.type === 'block_quote' && <span className='edit-label'>Block Quote</span>}
                      <textarea
                        ref={textareaRef}
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className={`edit-textarea ${block.type === 'section_heading' ? 'edit-textarea-heading' : ''}`}
                        rows={block.type === 'section_heading' ? 1 : 4}
                      />
                      <div className='edit-actions'>
                        <button onClick={handleCancel} className='btn-cancel'>
                          Cancel
                        </button>
                        <button onClick={() => void handleSave()} disabled={saving} className='btn-save'>
                          {saving ? 'Saving...' : 'Save'}
                        </button>
                        <button onClick={() => void handleDelete()} disabled={saving} className='btn-delete'>
                          Delete
                        </button>
                        <span className='edit-hint'>⌘+Enter to save, Esc to cancel</span>
                      </div>
                    </div>
                    {renderInsertRow(index)}
                  </React.Fragment>
                );
              }

              // Section heading (now clickable)
              if (block.type === 'section_heading') {
                return (
                  <React.Fragment key={block.id}>
                    <div className='section-header' onClick={() => handleBlockClick(block)} title='Click to edit'>
                      {block.content}
                    </div>
                    {renderInsertRow(index)}
                  </React.Fragment>
                );
              }

              // Numbered paragraph
              if (block.type === 'numbered_paragraph') {
                return (
                  <React.Fragment key={block.id}>
                    <p className='numbered' onClick={() => handleBlockClick(block)} title='Click to edit'>
                      <span className='para-num'>{paraNum}.</span> {block.content}
                    </p>
                    {renderInsertRow(index)}
                  </React.Fragment>
                );
              }

              // List item
              if (block.type === 'list_item') {
                return (
                  <React.Fragment key={block.id}>
                    <p className='list-item' onClick={() => handleBlockClick(block)} title='Click to edit'>
                      <span className='list-label'>{listLabel}</span> {block.content}
                    </p>
                    {renderInsertRow(index)}
                  </React.Fragment>
                );
              }

              // Block quote
              if (block.type === 'block_quote') {
                return (
                  <React.Fragment key={block.id}>
                    <blockquote onClick={() => handleBlockClick(block)} title='Click to edit'>
                      {block.content}
                    </blockquote>
                    {renderInsertRow(index)}
                  </React.Fragment>
                );
              }

              // Unnumbered paragraph (default)
              return (
                <React.Fragment key={block.id}>
                  <p onClick={() => handleBlockClick(block)} title='Click to edit'>
                    {block.content}
                  </p>
                  {renderInsertRow(index)}
                </React.Fragment>
              );
            })}

            {/* Signature Block */}
            {draft.signature_block && (
              <div className='signature-block'>
                <p>Respectfully submitted this {draft.signature_block.respectfully_submitted_date || '[DATE]'}.</p>
                <p style={{ marginTop: '2em' }}>/s/ {draft.signature_block.attorney_name || '[ATTORNEY NAME]'}</p>
                <p>
                  <strong>{draft.signature_block.attorney_name}</strong>
                  {draft.signature_block.bar_number && (
                    <>
                      <br />
                      {draft.signature_block.bar_number}
                    </>
                  )}
                  {draft.signature_block.firm_name && (
                    <>
                      <br />
                      {draft.signature_block.firm_name}
                    </>
                  )}
                  <br />
                  {draft.signature_block.address}
                  <br />
                  {draft.signature_block.phone && (
                    <>
                      Tel: {draft.signature_block.phone}
                      <br />
                    </>
                  )}
                  {draft.signature_block.email && (
                    <>
                      Email: {draft.signature_block.email}
                      <br />
                    </>
                  )}
                  {draft.signature_block.representing && <em>Attorney for {draft.signature_block.representing}</em>}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Scoped Styles */}
      <style>{`
        .draft-document {
          font-family: "Times New Roman", serif;
          font-size: 14pt;
          line-height: 2.0;
          max-width: 8.5in;
          margin: 20px auto;
          padding: 1in;
          background: white;
          border: 1px solid #d3d3d3;
          box-shadow: 3px 3px 20px rgba(0,0,0,0.1);
          color: black;
        }
        .court-caption {
          text-align: center;
          font-weight: bold;
          margin-bottom: 2em;
        }
        .case-caption {
          width: 100%;
          margin-bottom: 2em;
          border-collapse: collapse;
        }
        .case-caption td {
          vertical-align: top;
          padding: 0.5em;
        }
        .case-left { width: 50%; }
        .case-right {
          width: 50%;
          text-align: center;
          border-left: 1px solid black;
          padding-left: 1em;
        }
        .motion-title {
          text-align: center;
          font-weight: bold;
          margin: 2em 0;
          text-decoration: underline;
        }
        .section-header {
          font-weight: bold;
          margin: 1.5em 0 1em 0;
          text-align: center;
          text-decoration: underline;
          cursor: pointer;
          transition: background-color 0.15s;
          padding: 4px;
          border-radius: 4px;
        }
        .section-header:hover {
          background-color: #e6f7ff;
        }
        .draft-document p {
          margin: 1em 0;
          text-align: justify;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          transition: background-color 0.15s;
        }
        .draft-document p:hover {
          background-color: #fffacd;
        }
        .draft-document p.numbered .para-num {
          font-weight: bold;
        }
        .draft-document p.list-item {
          margin-left: 2em;
          text-indent: -1.5em;
          padding-left: 1.5em;
        }
        .draft-document p.list-item .list-label {
          font-weight: normal;
          margin-right: 0.5em;
        }
        .list-label {
          font-weight: normal;
          margin-right: 0.5em;
          min-width: 2em;
          display: inline-block;
        }
        .edit-block-list {
          margin-left: 2em;
        }
        .draft-document blockquote {
          margin: 1em 2em;
          padding: 0.5em 1em;
          border-left: 3px solid #ccc;
          font-style: italic;
          cursor: pointer;
        }
        .draft-document blockquote:hover {
          background-color: #fffacd;
        }
        .signature-block {
          margin-top: 3em;
          text-align: left;
        }
        .edit-block {
          margin: 1em 0;
          padding: 8px;
          background: #fffacd;
          border-radius: 4px;
          border: 2px solid #e6c200;
        }
        .edit-block .para-num {
          font-weight: bold;
          margin-right: 4px;
        }
        .edit-textarea {
          width: 100%;
          font-family: "Times New Roman", serif;
          font-size: 14pt;
          line-height: 1.6;
          padding: 8px;
          border: 1px solid #ccc;
          border-radius: 4px;
          resize: vertical;
          min-height: 80px;
        }
        .edit-actions {
          margin-top: 8px;
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .btn-cancel, .btn-save {
          padding: 6px 12px;
          border-radius: 4px;
          border: none;
          cursor: pointer;
          font-size: 13px;
        }
        .btn-cancel {
          background: #e0e0e0;
          color: #333;
        }
        .btn-cancel:hover {
          background: #d0d0d0;
        }
        .btn-save {
          background: #1890ff;
          color: white;
        }
        .btn-save:hover {
          background: #0070e0;
        }
        .btn-save:disabled {
          background: #a0c4e8;
          cursor: not-allowed;
        }
        .edit-hint {
          font-size: 11px;
          color: #888;
          margin-left: auto;
        }
        .insert-row {
          height: 16px;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.15s;
        }
        .insert-row:hover {
          opacity: 1;
        }
        .insert-row::before {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          top: 50%;
          height: 1px;
          background: #ccc;
        }
        .insert-btn {
          position: relative;
          z-index: 1;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 1px solid #ccc;
          background: white;
          color: #666;
          font-size: 18px;
          font-weight: bold;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
        }
        .insert-btn:hover {
          background: #1890ff;
          border-color: #1890ff;
          color: white;
        }
        .insert-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .insert-menu {
          position: relative;
          z-index: 1;
          display: flex;
          gap: 4px;
          background: white;
          padding: 4px 8px;
          border-radius: 4px;
          border: 1px solid #ccc;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .insert-menu-btn {
          padding: 4px 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          background: white;
          cursor: pointer;
          font-size: 12px;
          white-space: nowrap;
          transition: all 0.15s;
        }
        .insert-menu-btn:hover {
          background: #1890ff;
          border-color: #1890ff;
          color: white;
        }
        .insert-menu-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .insert-menu-cancel {
          color: #999;
        }
        .insert-menu-cancel:hover {
          background: #ff4d4f;
          border-color: #ff4d4f;
          color: white;
        }
        .btn-delete {
          padding: 6px 12px;
          border-radius: 4px;
          border: none;
          cursor: pointer;
          font-size: 13px;
          background: #ff4d4f;
          color: white;
        }
        .btn-delete:hover {
          background: #ff1f1f;
        }
        .btn-delete:disabled {
          background: #ffb3b3;
          cursor: not-allowed;
        }
        .edit-block-heading {
          text-align: center;
        }
        .edit-textarea-heading {
          text-align: center;
          font-weight: bold;
        }
        .edit-label {
          display: block;
          font-size: 11px;
          color: #888;
          margin-bottom: 4px;
          font-family: sans-serif;
        }
      `}</style>
    </div>
  );
};

export default DraftPreviewPanel;
export type { DraftDocument } from './types';
