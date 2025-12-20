/**
 * EvidenceBundlePanel - Display and manage evidence bundles for legal filings
 * Phase 2: Read-only view | Phase 3: Interactive editing | Phase 4: PDF export
 */

import { ipcBridge } from '@/common';
import type { EvidenceBundle, Exhibit } from '@/renderer/types/evidenceBundle';
import { EMPTY_EVIDENCE_BUNDLE } from '@/renderer/types/evidenceBundle';
import { Empty, Message, Modal, Spin, Tag, Tooltip } from '@arco-design/web-react';
import { Down, FileText, Right } from '@icon-park/react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import './styles.css';

// Use Message and Modal hooks for React 18 compatibility
const useMessageInstance = () => {
  const [message, messageContextHolder] = Message.useMessage();
  const [modal, modalContextHolder] = Modal.useModal();
  return { message, modal, contextHolder: <>{messageContextHolder}{modalContextHolder}</> };
};

interface EvidenceBundlePanelProps {
  workspace?: string;
}

interface DocumentFolder {
  name: string;
  path: string;
}

const EvidenceBundlePanel: React.FC<EvidenceBundlePanelProps> = ({ workspace }) => {
  const { message, modal, contextHolder } = useMessageInstance();
  const [bundle, setBundle] = useState<EvidenceBundle>(EMPTY_EVIDENCE_BUNDLE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedExhibits, setExpandedExhibits] = useState<Set<string>>(new Set());
  const [editingExhibit, setEditingExhibit] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [documentFolders, setDocumentFolders] = useState<DocumentFolder[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newExhibit, setNewExhibit] = useState<Partial<Exhibit>>({});
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const getBundlePath = useCallback(() => {
    if (!workspace) return null;
    return `${workspace}/evidence/evidence-bundle.json`;
  }, [workspace]);

  // Load evidence bundle from file
  const loadBundle = useCallback(async () => {
    const bundlePath = getBundlePath();
    console.log('[EvidenceBundlePanel] loadBundle called, bundlePath:', bundlePath);
    if (!bundlePath) {
      console.log('[EvidenceBundlePanel] No bundle path, setting loading to false');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      console.log('[EvidenceBundlePanel] Reading file:', bundlePath);
      const result = await ipcBridge.fs.readFileContent.invoke({ filePath: bundlePath });

      // Check if the backend returned an error
      if (result.error) {
        console.log('[EvidenceBundlePanel] Backend returned error:', result.error);
        if (result.error.includes('ENOENT') || result.error.includes('no such file')) {
          console.log('[EvidenceBundlePanel] File not found, using empty bundle');
          setBundle(EMPTY_EVIDENCE_BUNDLE);
        } else {
          setError('Failed to load evidence bundle');
        }
      } else {
        console.log('[EvidenceBundlePanel] File read success, parsing JSON');
        setBundle(JSON.parse(result.content) as EvidenceBundle);
      }
    } catch (err: any) {
      console.log('[EvidenceBundlePanel] Error loading bundle:', err?.message || err);
      if (err?.message?.includes('ENOENT') || err?.message?.includes('no such file')) {
        console.log('[EvidenceBundlePanel] File not found, using empty bundle');
        setBundle(EMPTY_EVIDENCE_BUNDLE);
      } else {
        setError('Failed to load evidence bundle');
      }
    } finally {
      console.log('[EvidenceBundlePanel] Setting loading to false');
      setLoading(false);
    }
  }, [getBundlePath]);

  // Load available document folders
  const loadDocumentFolders = useCallback(async () => {
    if (!workspace) return;
    try {
      const docsPath = `${workspace}/documents`;
      const result = await ipcBridge.fs.getFilesByDir.invoke({ dir: docsPath, root: workspace });
      // Result is an array with [0] being the root node with children
      const rootNode = result[0];
      if (rootNode?.children) {
        const folders = rootNode.children
          .filter((f) => f.isDir)
          .map((f) => ({ name: f.name, path: `documents/${f.name}` }));
        setDocumentFolders(folders);
      }
    } catch (err) {
      console.error('[EvidenceBundlePanel] Failed to load document folders:', err);
    }
  }, [workspace]);

  useEffect(() => { void loadBundle(); void loadDocumentFolders(); }, [loadBundle, loadDocumentFolders]);

  // Auto-save bundle to file (debounced)
  const saveBundle = useCallback(async (updatedBundle: EvidenceBundle) => {
    const bundlePath = getBundlePath();
    if (!bundlePath) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        setSaving(true);
        const updated = { ...updatedBundle, updated_at: new Date().toISOString() };
        const jsonString = JSON.stringify(updated, null, 2);
        const encoder = new TextEncoder();
        const uint8Array = encoder.encode(jsonString);
        await ipcBridge.fs.writeFile.invoke({ path: bundlePath, data: uint8Array });
        message.success('Evidence bundle saved');
      } catch (err) {
        message.error('Failed to save evidence bundle');
      } finally {
        setSaving(false);
      }
    }, 500);
  }, [getBundlePath]);

  // Generate exhibit label (A, B, C... or AA, AB after Z)
  const generateExhibitLabel = (index: number): string => {
    if (index < 26) return String.fromCharCode(65 + index);
    return String.fromCharCode(65 + Math.floor(index / 26) - 1) + String.fromCharCode(65 + (index % 26));
  };

  // Update exhibit IDs and labels after reordering
  const reindexExhibits = (exhibits: Exhibit[]): Exhibit[] => {
    return exhibits.map((ex, i) => ({
      ...ex,
      exhibit_id: `exhibit-${i + 1}`,
      label: `Exhibit ${generateExhibitLabel(i)}`,
    }));
  };

  const toggleExhibit = (id: string) => {
    setExpandedExhibits((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleViewDocument = async (ref: string) => {
    if (!workspace) return;
    try { await ipcBridge.shell.showItemInFolder.invoke(`${workspace}/${ref}`); }
    catch { message.error('Could not open document'); }
  };

  // Move exhibit up/down
  const moveExhibit = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= bundle.exhibits.length) return;
    const newExhibits = [...bundle.exhibits];
    [newExhibits[index], newExhibits[newIndex]] = [newExhibits[newIndex], newExhibits[index]];
    const reindexed = reindexExhibits(newExhibits);
    const updated = { ...bundle, exhibits: reindexed, metadata: { ...bundle.metadata, total_exhibits: reindexed.length } };
    setBundle(updated);
    void saveBundle(updated);
  };

  // Remove exhibit
  const removeExhibit = (index: number) => {
    modal.confirm({
      title: 'Remove Exhibit',
      content: `Are you sure you want to remove "${bundle.exhibits[index].title}"?`,
      onOk: () => {
        const newExhibits = bundle.exhibits.filter((_, i) => i !== index);
        const reindexed = reindexExhibits(newExhibits);
        const updated = { ...bundle, exhibits: reindexed, metadata: { ...bundle.metadata, total_exhibits: reindexed.length } };
        setBundle(updated);
        void saveBundle(updated);
      },
    });
  };

  // Update exhibit field
  const updateExhibitField = (index: number, field: keyof Exhibit, value: any) => {
    const newExhibits = [...bundle.exhibits];
    newExhibits[index] = { ...newExhibits[index], [field]: value };
    const updated = { ...bundle, exhibits: newExhibits };
    setBundle(updated);
    void saveBundle(updated);
  };

  // Add new exhibit
  const handleAddExhibit = () => {
    if (!newExhibit.document_ref || !newExhibit.title) {
      message.warning('Please select a document and enter a title');
      return;
    }
    const index = bundle.exhibits.length;
    const exhibit: Exhibit = {
      exhibit_id: `exhibit-${index + 1}`,
      label: `Exhibit ${generateExhibitLabel(index)}`,
      title: newExhibit.title,
      document_ref: newExhibit.document_ref,
      description: newExhibit.description || null,
      status: 'draft',
      supports_claims: [],
      key_excerpts: [],
    };
    const newExhibits = [...bundle.exhibits, exhibit];
    const updated = {
      ...bundle,
      bundle_id: bundle.bundle_id || `bundle-${Date.now()}`,
      exhibits: newExhibits,
      metadata: { ...bundle.metadata, total_exhibits: newExhibits.length },
      created_at: bundle.created_at || new Date().toISOString(),
    };
    setBundle(updated);
    void saveBundle(updated);
    setShowAddModal(false);
    setNewExhibit({});
    message.success('Exhibit added');
  };

  const renderExhibit = (exhibit: Exhibit, index: number) => {
    const isExpanded = expandedExhibits.has(exhibit.exhibit_id);
    const isEditing = editingExhibit === exhibit.exhibit_id;
    const statusColors: Record<string, string> = { included: 'green', draft: 'orange', excluded: 'red', pending_review: 'blue' };

    return (
      <div key={exhibit.exhibit_id} className="evidence-exhibit">
        <div className="evidence-exhibit-header">
          {/* Reorder controls */}
          <div className="evidence-reorder-controls" onClick={(e) => e.stopPropagation()}>
            <Tooltip content="Move up"><button className="evidence-reorder-btn" disabled={index === 0} onClick={() => moveExhibit(index, 'up')}>↑</button></Tooltip>
            <Tooltip content="Move down"><button className="evidence-reorder-btn" disabled={index === bundle.exhibits.length - 1} onClick={() => moveExhibit(index, 'down')}>↓</button></Tooltip>
          </div>
          <span className="evidence-exhibit-chevron" onClick={() => toggleExhibit(exhibit.exhibit_id)}>{isExpanded ? <Down size={14} /> : <Right size={14} />}</span>
          <span className="evidence-exhibit-label">{exhibit.label}</span>
          <span className="evidence-exhibit-title" onClick={() => toggleExhibit(exhibit.exhibit_id)}>{exhibit.title}</span>
          {exhibit.status && <Tag color={statusColors[exhibit.status] || 'gray'}>{exhibit.status}</Tag>}
          {/* Edit/Delete controls */}
          <div className="evidence-item-controls" onClick={(e) => e.stopPropagation()}>
            <Tooltip content={isEditing ? 'Done editing' : 'Edit'}><button className="evidence-edit-btn" onClick={() => setEditingExhibit(isEditing ? null : exhibit.exhibit_id)}>{isEditing ? '✓' : '✎'}</button></Tooltip>
            <Tooltip content="Remove"><button className="evidence-delete-btn" onClick={() => removeExhibit(index)}>×</button></Tooltip>
          </div>
        </div>
        {isExpanded && (
          <div className="evidence-exhibit-details">
            {/* Editable title */}
            {isEditing ? (
              <div className="evidence-edit-row">
                <label>Title:</label>
                <input type="text" value={exhibit.title} onChange={(e) => updateExhibitField(index, 'title', e.target.value)} className="evidence-edit-input" />
              </div>
            ) : null}
            {/* Description */}
            {isEditing ? (
              <div className="evidence-edit-row">
                <label>Description:</label>
                <textarea value={exhibit.description || ''} onChange={(e) => updateExhibitField(index, 'description', e.target.value || null)} className="evidence-edit-textarea" rows={2} />
              </div>
            ) : exhibit.description ? (
              <div className="evidence-detail-row"><span className="evidence-detail-label">Description:</span><span>{exhibit.description}</span></div>
            ) : null}
            {/* Page range */}
            {isEditing ? (
              <div className="evidence-edit-row">
                <label>Pages:</label>
                <input type="text" value={exhibit.page_range || ''} onChange={(e) => updateExhibitField(index, 'page_range', e.target.value || null)} className="evidence-edit-input" placeholder="e.g., 1-5" />
              </div>
            ) : exhibit.page_range ? (
              <div className="evidence-detail-row"><span className="evidence-detail-label">Pages:</span><span>{exhibit.page_range}</span></div>
            ) : null}
            {/* Claims */}
            {exhibit.supports_claims && exhibit.supports_claims.length > 0 && (
              <div className="evidence-detail-row">
                <span className="evidence-detail-label">Supports:</span>
                <div className="evidence-claims-list">{exhibit.supports_claims.map((c, i) => <Tag key={i} size="small" color="arcoblue">{c}</Tag>)}</div>
              </div>
            )}
            {/* Key excerpts */}
            {exhibit.key_excerpts && exhibit.key_excerpts.length > 0 && (
              <div className="evidence-excerpts">
                <span className="evidence-detail-label">Key Excerpts:</span>
                {exhibit.key_excerpts.map((e, i) => (
                  <div key={i} className="evidence-excerpt">
                    <blockquote>"{e.quote}"</blockquote>
                    <div className="evidence-excerpt-meta"><span>Page {e.page}</span>{e.relevance && <span> — {e.relevance}</span>}</div>
                  </div>
                ))}
              </div>
            )}
            {/* Document path */}
            <div className="evidence-detail-row"><span className="evidence-detail-label">Document:</span><span className="evidence-doc-path">{exhibit.document_ref}</span></div>
            <div className="evidence-exhibit-actions">
              <Tooltip content="View source document">
                <button className="evidence-action-btn" onClick={(ev) => { ev.stopPropagation(); handleViewDocument(exhibit.document_ref); }}>
                  <FileText size={14} /> View Document
                </button>
              </Tooltip>
            </div>
          </div>
        )}
      </div>
    );
  };

  const hasContent = bundle.bundle_id || bundle.exhibits.length > 0;

  // Export evidence bundle as HTML with cover pages (print-ready)
  const handleExport = async () => {
    if (bundle.exhibits.length === 0) {
      message.warning('No exhibits to export');
      return;
    }

    try {
      // Generate HTML with cover pages for each exhibit
      const html = generateExportHtml(bundle);

      // Show save dialog (use openDirectory to select folder, then append filename)
      const result = await ipcBridge.dialog.showOpen.invoke({
        properties: ['openDirectory', 'createDirectory'],
      });

      if (result && result.length > 0) {
        const selectedDir = result[0];
        const filename = `evidence-bundle-${bundle.bundle_id || 'export'}.html`;
        const savePath = `${selectedDir}/${filename}`;
        const encoder = new TextEncoder();
        await ipcBridge.fs.writeFile.invoke({ path: savePath, data: encoder.encode(html) });
        message.success(`Exported to ${filename}. Open in browser and print to PDF.`);
      }
    } catch (err) {
      console.error('[EvidenceBundlePanel] Export failed:', err);
      message.error('Failed to export evidence bundle');
    }
  };

  // Generate print-ready HTML with cover pages
  const generateExportHtml = (b: EvidenceBundle): string => {
    const coverPages = b.exhibits.map((ex, i) => `
      <div class="cover-page">
        <div class="cover-header">
          <div class="cover-label">${ex.label}</div>
        </div>
        <div class="cover-content">
          <h1 class="cover-title">${ex.title}</h1>
          ${ex.description ? `<p class="cover-description">${ex.description}</p>` : ''}
          <div class="cover-meta">
            ${ex.page_range ? `<div><strong>Pages:</strong> ${ex.page_range}</div>` : ''}
            ${ex.bates_range ? `<div><strong>Bates Range:</strong> ${ex.bates_range.start} - ${ex.bates_range.end}</div>` : ''}
            ${ex.supports_claims?.length ? `<div><strong>Supports:</strong> ${ex.supports_claims.join(', ')}</div>` : ''}
          </div>
          ${ex.key_excerpts?.length ? `
            <div class="cover-excerpts">
              <h3>Key Excerpts</h3>
              ${ex.key_excerpts.map(e => `
                <blockquote>"${e.quote}"<br><small>— Page ${e.page}${e.relevance ? ` (${e.relevance})` : ''}</small></blockquote>
              `).join('')}
            </div>
          ` : ''}
        </div>
        <div class="cover-footer">
          <div>Document: ${ex.document_ref}</div>
          <div>Exhibit ${i + 1} of ${b.exhibits.length}</div>
        </div>
      </div>
    `).join('\n');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Evidence Bundle - ${b.purpose || 'Export'}</title>
  <style>
    @page { size: letter; margin: 0.75in; }
    @media print { .cover-page { page-break-after: always; } }
    body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; margin: 0; padding: 20px; }
    .cover-page { min-height: 9in; display: flex; flex-direction: column; border: 2px solid #333; padding: 40px; margin-bottom: 20px; box-sizing: border-box; }
    .cover-header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
    .cover-label { font-size: 48pt; font-weight: bold; color: #333; }
    .cover-content { flex: 1; }
    .cover-title { font-size: 18pt; font-weight: bold; margin: 0 0 20px 0; text-align: center; }
    .cover-description { font-style: italic; color: #555; margin-bottom: 20px; text-align: center; }
    .cover-meta { margin: 30px 0; padding: 15px; background: #f5f5f5; border-radius: 4px; }
    .cover-meta div { margin: 8px 0; }
    .cover-excerpts { margin-top: 30px; }
    .cover-excerpts h3 { font-size: 14pt; margin-bottom: 15px; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
    .cover-excerpts blockquote { margin: 15px 0; padding: 10px 20px; border-left: 3px solid #666; font-style: italic; background: #fafafa; }
    .cover-excerpts small { color: #666; }
    .cover-footer { border-top: 1px solid #ccc; padding-top: 15px; display: flex; justify-content: space-between; font-size: 10pt; color: #666; }
    .bundle-header { text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #333; }
    .bundle-header h1 { margin: 0 0 10px 0; }
    .bundle-header p { margin: 5px 0; color: #555; }
  </style>
</head>
<body>
  <div class="bundle-header">
    <h1>EVIDENCE BUNDLE</h1>
    ${b.purpose ? `<p><strong>${b.purpose}</strong></p>` : ''}
    <p>${b.exhibits.length} Exhibit${b.exhibits.length !== 1 ? 's' : ''}</p>
    ${b.metadata?.filing_deadline ? `<p>Filing Deadline: ${b.metadata.filing_deadline}</p>` : ''}
  </div>
  ${coverPages}
  <div style="text-align: center; font-size: 10pt; color: #999; margin-top: 40px;">
    <p>Generated: ${new Date().toLocaleDateString()}</p>
    <p><em>Note: Attach actual documents after each cover page when assembling final bundle.</em></p>
  </div>
</body>
</html>`;
  };

  // Add Exhibit Modal
  const renderAddModal = () => (
    <Modal
      title="Add Exhibit"
      visible={showAddModal}
      onOk={handleAddExhibit}
      onCancel={() => { setShowAddModal(false); setNewExhibit({}); }}
      okText="Add"
      style={{ maxWidth: 500 }}
    >
      <div className="evidence-add-form">
        <div className="evidence-form-row">
          <label>
            Document:
            <span style={{ fontSize: '11px', color: 'var(--color-text-3)', marginLeft: '8px' }}>
              (folders from documents/)
            </span>
          </label>
          <select
            value={newExhibit.document_ref || ''}
            onChange={(e) => setNewExhibit({ ...newExhibit, document_ref: e.target.value })}
            className="evidence-form-select"
          >
            <option value="">Select a document folder...</option>
            {documentFolders.map((f) => (
              <option key={f.path} value={f.path}>{f.name}</option>
            ))}
          </select>
        </div>
        <div className="evidence-form-row">
          <label>Title:</label>
          <input
            type="text"
            value={newExhibit.title || ''}
            onChange={(e) => setNewExhibit({ ...newExhibit, title: e.target.value })}
            className="evidence-form-input"
            placeholder="e.g., Original Service Agreement"
          />
        </div>
        <div className="evidence-form-row">
          <label>Description:</label>
          <textarea
            value={newExhibit.description || ''}
            onChange={(e) => setNewExhibit({ ...newExhibit, description: e.target.value })}
            className="evidence-form-textarea"
            rows={2}
            placeholder="Brief description of the document..."
          />
        </div>
      </div>
    </Modal>
  );

  return (
    <>
      {contextHolder}
      <div className="evidence-bundle-panel">
        <div className="evidence-panel-header">
          <span className="evidence-panel-title">Evidence Bundle {saving && <span className="evidence-saving">Saving...</span>}</span>
          <div className="evidence-header-actions">
            {bundle.exhibits.length > 0 && (
              <Tooltip content="Export bundle">
                <button className="evidence-export-btn" onClick={handleExport}>📤</button>
              </Tooltip>
            )}
            <Tooltip content="Add exhibit">
              <button className="evidence-add-btn" onClick={() => setShowAddModal(true)}>+</button>
            </Tooltip>
          </div>
        </div>
      <div className="evidence-panel-content">
        {loading ? (
          <div className="evidence-loading"><Spin /></div>
        ) : error ? (
          <div className="evidence-error"><p>{error}</p><button onClick={loadBundle}>Retry</button></div>
        ) : (
          <>
            {bundle.purpose && (
              <div className="evidence-bundle-info">
                <div className="evidence-bundle-purpose">{bundle.purpose}</div>
                <div className="evidence-bundle-meta">
                  <span>{bundle.exhibits.length} exhibit{bundle.exhibits.length !== 1 ? 's' : ''}</span>
                  {bundle.metadata?.total_pages && bundle.metadata.total_pages > 0 && <span> • {bundle.metadata.total_pages} pages</span>}
                  {bundle.metadata?.filing_deadline && <span> • Deadline: {bundle.metadata.filing_deadline}</span>}
                </div>
              </div>
            )}
            <div className="evidence-exhibit-list">
              {bundle.exhibits.length === 0 ? (
                <Empty
                  description={
                    <div className="evidence-empty-state">
                      <p>No exhibits yet</p>
                      <p className="evidence-empty-hint">
                        Click <strong>+</strong> to add exhibits from your case documents.
                      </p>
                      <p className="evidence-empty-hint" style={{ fontSize: '12px', marginTop: '8px', color: 'var(--color-text-3)' }}>
                        💡 Tip: Upload documents first, then organize them as exhibits here.
                        Each folder in <code>documents/</code> can become an exhibit (e.g., Exhibit A, B, C...).
                      </p>
                    </div>
                  }
                />
              ) : (
                bundle.exhibits.map((ex, i) => renderExhibit(ex, i))
              )}
            </div>
          </>
        )}
      </div>
      {renderAddModal()}
      </div>
    </>
  );
};

export default EvidenceBundlePanel;
