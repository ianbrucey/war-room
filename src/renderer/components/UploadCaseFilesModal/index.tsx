/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import ModalWrapper from '@/renderer/components/base/ModalWrapper';
import type { FileMetadata } from '@/renderer/services/FileService';
import { Message, Modal } from '@arco-design/web-react';
import type { ICaseDocument } from '@process/documents/types';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const pageSize = 10;

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
   * Handle preview action - Show document details in a modal
   */
  const handlePreview = useCallback(
    async (documentId: string) => {
      try {
        const token = localStorage.getItem('auth_token');
        if (!token) {
          message.error(t('uploadModal.errors.authRequired'));
          return;
        }

        const response = await fetch(`/api/documents/${documentId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch document details');
        }

        const document = await response.json();

        // Show preview modal with document details
        Modal.info({
          title: document.filename,
          style: { width: '80vw', maxWidth: '900px' },
          content: (
            <div className='space-y-4'>
              <div>
                <div className='font-bold text-14px mb-2'>{t('uploadModal.preview.extractedText')}</div>
                <div className='max-h-300px overflow-y-auto bg-fill-2 p-12px rd-8px text-12px whitespace-pre-wrap'>{document.extracted_text || t('uploadModal.preview.noText')}</div>
              </div>
              {document.analysis && (
                <div>
                  <div className='font-bold text-14px mb-2'>{t('uploadModal.preview.analysis')}</div>
                  <div className='max-h-200px overflow-y-auto bg-fill-2 p-12px rd-8px text-12px whitespace-pre-wrap'>{document.analysis}</div>
                </div>
              )}
              <div className='text-12px text-t-secondary'>
                <div>
                  {t('uploadModal.preview.uploadedAt')}: {new Date(document.created_at).toLocaleString()}
                </div>
                <div>
                  {t('uploadModal.preview.status')}: {document.processing_status}
                </div>
              </div>
            </div>
          ),
        });
      } catch (error) {
        console.error('[UploadModal] Preview error:', error);
        message.error(t('uploadModal.errors.previewFailed'));
      }
    },
    [t, message]
  );

  /**
   * Handle download action - Download the original file
   */
  const handleDownload = useCallback(
    async (documentId: string) => {
      try {
        const response = await fetch(`/api/documents/${documentId}/download`, {
          credentials: 'include' // Use cookie authentication
        });

        if (!response.ok) {
          throw new Error('Failed to download document');
        }

        // Get filename from Content-Disposition header or use default
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = 'document';
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
          if (filenameMatch) {
            filename = filenameMatch[1];
          }
        }

        // Create blob and download
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        message.success(t('uploadModal.success.downloaded'));
      } catch (error) {
        console.error('[UploadModal] Download error:', error);
        message.error(t('uploadModal.errors.downloadFailed'));
      }
    },
    [t, message]
  );

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

          <DocumentListSection
            documents={documents}
            activeTab={activeTab}
            onTabChange={handleTabChange}
            page={page}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            onPreview={handlePreview}
            onDownload={handleDownload}
          />
        </div>
      </ModalWrapper>
    </>
  );
};

export default UploadCaseFilesModal;

