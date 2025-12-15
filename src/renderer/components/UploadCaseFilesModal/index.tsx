/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import ModalWrapper from '@/renderer/components/base/ModalWrapper';
import DocumentPreview from '@/renderer/components/DocumentPreview';
import type { FileMetadata } from '@/renderer/services/FileService';
import { Message, Modal, Spin } from '@arco-design/web-react';
import type { ICaseDocument } from '@process/documents/types';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CaseSummaryControls } from './CaseSummaryControls';
import { DocumentListSection } from './DocumentListSection';
import { DropzoneSection } from './DropzoneSection';
import './styles.css';

interface UploadCaseFilesModalProps {
  visible: boolean;
  caseFileId: string;
  onClose: () => void;
}

// Extended FileMetadata to include the actual File object for WebUI
interface FileWithObject extends FileMetadata {
  file?: File;
}

export const UploadCaseFilesModal: React.FC<UploadCaseFilesModalProps> = ({
  visible,
  caseFileId,
  onClose
}) => {
  const { t } = useTranslation();
  const [message, contextHolder] = Message.useMessage();
  const [documents, setDocuments] = useState<ICaseDocument[]>([]);
  const [uploading, setUploading] = useState<Map<string, number>>(new Map());
  const [activeTab, setActiveTab] = useState<'documents' | 'failed'>('documents');
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [previewDocumentId, setPreviewDocumentId] = useState<string | null>(null);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(true);
  const pageSize = 10;

  // Case summary state
  const [summaryStatus, setSummaryStatus] = useState<'generating' | 'generated' | 'stale' | 'failed' | null>(null);
  const [summaryGeneratedAt, setSummaryGeneratedAt] = useState<number | null>(null);
  const [summaryVersion, setSummaryVersion] = useState(0);
  const [summaryDocumentCount, setSummaryDocumentCount] = useState(0);
  const [generationProgress, setGenerationProgress] = useState<{
    percent: number;
    currentBatch: number;
    totalBatches: number;
  } | undefined>(undefined);

  /**
   * Initial fetch when modal opens
   */
  useEffect(() => {
    if (!visible) {
      // Reset loading state when modal closes
      setLoading(true);
      return;
    }

    // Fetch documents immediately when modal opens
    const fetchDocuments = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/cases/${caseFileId}/documents`, {
          credentials: 'include'
        });

        if (response.ok) {
          const docs = await response.json();
          setDocuments(docs);
        }
      } catch (error) {
        console.error('[UploadModal] Failed to fetch documents:', error);
      } finally {
        setLoading(false);
      }
    };

    // Fetch summary status
    const fetchSummaryStatus = async () => {
      try {
        const response = await fetch(`/api/cases/${caseFileId}/summary/status`, {
          credentials: 'include'
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.status) {
            setSummaryStatus(data.status.status);
            setSummaryGeneratedAt(data.status.generatedAt);
            setSummaryVersion(data.status.version);
            setSummaryDocumentCount(data.status.documentCount);
          }
        }
      } catch (error) {
        console.error('[UploadModal] Failed to fetch summary status:', error);
      }
    };

    fetchDocuments();
    fetchSummaryStatus();
  }, [visible, caseFileId]);

  /**
   * Poll for document status updates
   */
  useEffect(() => {
    if (!visible) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/cases/${caseFileId}/documents`, {
          credentials: 'include' // Use cookie authentication
        });

        if (response.ok) {
          const docs = await response.json();
          setDocuments(docs);
        }
      } catch (error) {
        console.error('[UploadModal] Failed to poll documents:', error);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [visible, caseFileId]);

  /**
   * Upload a single file to the backend API
   */
  const uploadFile = async (fileMetadata: FileMetadata): Promise<string | null> => {
    try {
      const fileWithObject = fileMetadata as FileWithObject;

      // For WebUI, we need the actual File object
      if (!fileWithObject.file) {
        throw new Error('File object not available');
      }

      // Create FormData with the actual File object
      const formData = new FormData();
      formData.append('file', fileWithObject.file, fileMetadata.name);

      // Upload to backend (uses cookie authentication automatically)
      const uploadResponse = await fetch(
        `/api/cases/${caseFileId}/documents/upload`,
        {
          method: 'POST',
          credentials: 'include', // Include cookies for authentication
          body: formData
        }
      );

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json().catch(() => ({ error: uploadResponse.statusText }));
        throw new Error(errorData.error || `Upload failed: ${uploadResponse.statusText}`);
      }

      const result = await uploadResponse.json();
      return result.documentId;
    } catch (error) {
      console.error('[UploadModal] Upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      message.error(`Failed to upload ${fileMetadata.name}: ${errorMessage}`);
      return null;
    }
  };

  /**
   * Handle files added via drag-and-drop or browse
   */
  const handleFilesAdded = useCallback(async (files: FileMetadata[]) => {
    for (const file of files) {
      const documentId = await uploadFile(file);
      if (documentId) {
        // Add to documents list with pending status
        setDocuments(prev => [...prev, {
          id: documentId,
          case_file_id: caseFileId,
          filename: file.name,
          folder_name: file.name.replace(/[^a-zA-Z0-9.-]/g, '_'),
          file_type: file.name.split('.').pop() || 'unknown',
          processing_status: 'pending',
          has_text_extraction: 0,
          has_metadata: 0,
          rag_indexed: 0,
          uploaded_at: Date.now()
        }]);

        message.success(`Uploaded ${file.name}`);
      }
    }
  }, [caseFileId, message]);

  /**
   * Handle preview action - Open document preview modal with S3 pre-signed URL
   */
  const handlePreview = useCallback(
    (documentId: string) => {
      setPreviewDocumentId(documentId);
    },
    []
  );

  /**
   * Close preview modal
   */
  const handleClosePreview = useCallback(() => {
    setPreviewDocumentId(null);
  }, []);

  /**
   * Handle download action - Get pre-signed URL from S3 and trigger download
   */
  const handleDownload = useCallback(
    async (documentId: string) => {
      try {
        // First try to get S3 pre-signed URL
        const response = await fetch(`/api/documents/${documentId}/download-url`, {
          credentials: 'include' // Use cookie authentication
        });

        if (!response.ok) {
          throw new Error('Failed to get download URL');
        }

        const data = await response.json();

        if (data.isLocal) {
          // Fallback to direct download for local-only files
          const downloadResponse = await fetch(`/api/documents/${documentId}/download`, {
            credentials: 'include'
          });

          if (!downloadResponse.ok) {
            throw new Error('Failed to download document');
          }

          const blob = await downloadResponse.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = data.filename || 'document';
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        } else {
          // Use S3 pre-signed URL for download
          // Create a hidden link and trigger download
          const a = document.createElement('a');
          a.href = data.url;
          a.download = data.filename || 'document';
          a.target = '_blank';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }

        message.success(t('uploadModal.success.downloaded'));
      } catch (error) {
        console.error('[UploadModal] Download error:', error);
        message.error(t('uploadModal.errors.downloadFailed'));
      }
    },
    [t, message]
  );

  /**
   * Handle delete action - Show confirmation modal
   */
  const handleDelete = useCallback(
    (documentId: string) => {
      setDocumentToDelete(documentId);
      setDeleteConfirmVisible(true);
    },
    []
  );

  /**
   * Confirm delete - Actually delete the document
   */
  const confirmDelete = useCallback(
    async () => {
      if (!documentToDelete) return;

      try {
        setDeleting(true);
        const response = await fetch(`/api/documents/${documentToDelete}`, {
          method: 'DELETE',
          credentials: 'include' // Use cookie authentication
        });

        if (!response.ok) {
          throw new Error('Failed to delete document');
        }

        message.success(t('uploadModal.success.deleted'));

        // Refresh document list by fetching updated documents
        try {
          const response = await fetch(`/api/cases/${caseFileId}/documents`, {
            credentials: 'include'
          });
          if (response.ok) {
            const docs = await response.json();
            setDocuments(docs);
          }
        } catch (error) {
          console.error('[UploadModal] Failed to refresh documents:', error);
        }

        // Close confirmation modal
        setDeleteConfirmVisible(false);
        setDocumentToDelete(null);
      } catch (error) {
        console.error('[UploadModal] Delete error:', error);
        message.error(t('uploadModal.errors.deleteFailed'));
      } finally {
        setDeleting(false);
      }
    },
    [documentToDelete, t, message, caseFileId]
  );

  /**
   * Cancel delete - Close confirmation modal
   */
  const cancelDelete = useCallback(() => {
    setDeleteConfirmVisible(false);
    setDocumentToDelete(null);
  }, []);

  /**
   * Handle tab change
   */
  const handleTabChange = useCallback((tab: 'documents' | 'failed') => {
    setActiveTab(tab);
    setPage(1); // Reset to first page when changing tabs
  }, []);

  /**
   * Handle page change
   */
  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  /**
   * Handle search query change
   */
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    setPage(1); // Reset to first page when searching
  }, []);

  /**
   * Handle generate summary
   */
  const handleGenerateSummary = useCallback(async () => {
    try {
      const response = await fetch(`/api/cases/${caseFileId}/summary/generate`, {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        message.success('Summary generation started');
        setSummaryStatus('generating');
        setGenerationProgress({ percent: 0, currentBatch: 0, totalBatches: 1 });
      } else {
        const error = await response.json();
        message.error(error.error || 'Failed to start summary generation');
      }
    } catch (error) {
      console.error('[UploadModal] Failed to generate summary:', error);
      message.error('Failed to start summary generation');
    }
  }, [caseFileId, message]);

  /**
   * Handle update summary
   */
  const handleUpdateSummary = useCallback(async () => {
    try {
      const response = await fetch(`/api/cases/${caseFileId}/summary/update`, {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        message.success('Summary update started');
        setSummaryStatus('generating');
        setGenerationProgress({ percent: 0, currentBatch: 0, totalBatches: 1 });
      } else {
        const error = await response.json();
        message.error(error.error || 'Failed to start summary update');
      }
    } catch (error) {
      console.error('[UploadModal] Failed to update summary:', error);
      message.error('Failed to start summary update');
    }
  }, [caseFileId, message]);

  /**
   * Handle regenerate summary
   */
  const handleRegenerateSummary = useCallback(async () => {
    Modal.confirm({
      title: 'Regenerate Summary',
      content: 'This will rebuild the entire summary from scratch. Continue?',
      onOk: async () => {
        try {
          const response = await fetch(`/api/cases/${caseFileId}/summary/regenerate`, {
            method: 'POST',
            credentials: 'include',
          });

          if (response.ok) {
            message.success('Summary regeneration started');
            setSummaryStatus('generating');
            setGenerationProgress({ percent: 0, currentBatch: 0, totalBatches: 1 });
          } else {
            const error = await response.json();
            message.error(error.error || 'Failed to start summary regeneration');
          }
        } catch (error) {
          console.error('[UploadModal] Failed to regenerate summary:', error);
          message.error('Failed to start summary regeneration');
        }
      },
    });
  }, [caseFileId, message]);

  /**
   * Handle view summary
   */
  const handleViewSummary = useCallback(() => {
    // TODO: Implement summary viewer
    message.info('Summary viewer coming soon');
  }, [message]);

  return (
    <>
      {contextHolder}
      <ModalWrapper
        visible={visible}
        onCancel={onClose}
        title={t('conversation.workspace.uploadCaseFiles', 'Upload Case Files')}
        style={{ width: '90vw', height: '90vh' }}
        showCustomClose={true}
      >
        <div className="upload-modal-body">
          <DropzoneSection onFilesAdded={handleFilesAdded} />

          {loading ? (
            <div className="document-list-loading">
              <Spin size={32} />
              <p>{t('uploadModal.loading', 'Loading documents...')}</p>
            </div>
          ) : (
            <>
              <DocumentListSection
                documents={documents}
                activeTab={activeTab}
                onTabChange={handleTabChange}
                page={page}
                pageSize={pageSize}
                onPageChange={handlePageChange}
                searchQuery={searchQuery}
                onSearchChange={handleSearchChange}
                onPreview={handlePreview}
                onDownload={handleDownload}
                onDelete={handleDelete}
              />

              <CaseSummaryControls
                caseId={caseFileId}
                summaryStatus={summaryStatus}
                summaryGeneratedAt={summaryGeneratedAt}
                summaryVersion={summaryVersion}
                summaryDocumentCount={summaryDocumentCount}
                currentDocumentCount={documents.filter(d => d.processing_status === 'complete').length}
                onGenerate={handleGenerateSummary}
                onUpdate={handleUpdateSummary}
                onRegenerate={handleRegenerateSummary}
                onViewSummary={handleViewSummary}
                generationProgress={generationProgress}
              />
            </>
          )}
        </div>
      </ModalWrapper>

      {/* Document Preview Modal */}
      {previewDocumentId && (
        <DocumentPreview
          documentId={previewDocumentId}
          visible={!!previewDocumentId}
          onClose={handleClosePreview}
        />
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        visible={deleteConfirmVisible}
        title={t('uploadModal.delete.confirmTitle')}
        onOk={confirmDelete}
        onCancel={cancelDelete}
        okText={t('uploadModal.delete.confirmOk')}
        cancelText={t('uploadModal.delete.confirmCancel')}
        okButtonProps={{ status: 'danger', loading: deleting }}
        cancelButtonProps={{ disabled: deleting }}
      >
        <p>{t('uploadModal.delete.confirmMessage')}</p>
      </Modal>
    </>
  );
};

export default UploadCaseFilesModal;

