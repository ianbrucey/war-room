/**
 * UploadTemplateSamplesModal - Upload sample documents to generate custom templates
 * 
 * User uploads sample PDFs/Word docs → Agent analyzes → Generates HTML templates
 */

import ModalWrapper from '@/renderer/components/base/ModalWrapper';
import { iconColors } from '@/renderer/theme/colors';
import { Message } from '@arco-design/web-react';
import { FileAddition } from '@icon-park/react';
import React, { useCallback, useRef, useState } from 'react';
import './styles.css';

interface UploadTemplateSamplesModalProps {
  visible: boolean;
  caseFileId: string;
  workspace: string;
  onClose: () => void;
}

interface UploadedSample {
  filename: string;
  path: string;
  status: 'uploading' | 'success' | 'error';
}

const UploadTemplateSamplesModal: React.FC<UploadTemplateSamplesModalProps> = ({
  visible,
  caseFileId,
  workspace,
  onClose,
}) => {
  const [message, messageContextHolder] = Message.useMessage();
  const [samples, setSamples] = useState<UploadedSample[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        await uploadFiles(Array.from(files));
        e.target.value = ''; // Reset input
      }
    },
    [workspace]
  );

  const uploadFiles = async (files: File[]) => {
    for (const file of files) {
      // Add to list with uploading status
      const sample: UploadedSample = {
        filename: file.name,
        path: `templates/_samples/${file.name}`,
        status: 'uploading',
      };
      setSamples((prev) => [...prev, sample]);

      try {
        // Create FormData
        const formData = new FormData();
        formData.append('file', file);
        formData.append('destination', 'templates/_samples');

        console.log('[UploadTemplateSamples] Uploading to:', `/api/cases/${caseFileId}/templates/upload-sample`);

        // Upload via API
        const response = await fetch(`/api/cases/${caseFileId}/templates/upload-sample`, {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });

        const result = await response.json();
        console.log('[UploadTemplateSamples] Upload response:', result);

        if (!response.ok) {
          throw new Error(result.error || 'Upload failed');
        }

        // Update status to success
        setSamples((prev) =>
          prev.map((s) => (s.filename === file.name ? { ...s, status: 'success' } : s))
        );
        message.success(`Uploaded ${file.name} to ${result.path}`);
      } catch (error) {
        console.error('[UploadTemplateSamples] Upload failed:', error);
        setSamples((prev) =>
          prev.map((s) => (s.filename === file.name ? { ...s, status: 'error' } : s))
        );
        message.error(`Failed to upload ${file.name}`);
      }
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files).filter(
        (f) => f.name.endsWith('.pdf') || f.name.endsWith('.docx') || f.name.endsWith('.doc')
      );

      if (files.length > 0) {
        await uploadFiles(files);
      } else {
        message.warning('Only PDF and Word documents are supported');
      }
    },
    [workspace]
  );

  return (
    <>
      {messageContextHolder}
      <ModalWrapper
        visible={visible}
        title="Upload Template Samples"
        onCancel={onClose}
        footer={null}
        style={{ width: '600px' }}
      >
        <div className="upload-template-samples-modal">
          <p className="modal-description">
            Upload sample documents (PDF or Word) that represent your firm's formatting standards.
            The agent will analyze them and generate matching HTML templates.
          </p>

          <div
            className={`dropzone ${isDragging ? 'dragging' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleBrowseClick}
          >
            <FileAddition size={48} fill={iconColors.secondary} />
            <h3>Drag and drop sample documents here</h3>
            <p>or click to browse</p>
            <p className="supported-formats">Supported: PDF, DOCX</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.doc"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </div>

          {samples.length > 0 && (
            <div className="samples-list">
              <h4>Uploaded Samples:</h4>
              {samples.map((sample, idx) => (
                <div key={idx} className={`sample-item ${sample.status}`}>
                  <span>{sample.filename}</span>
                  <span className="status">{sample.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </ModalWrapper>
    </>
  );
};

export default UploadTemplateSamplesModal;

