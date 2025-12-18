/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useDragUpload } from '@/renderer/hooks/useDragUpload';
import { FileService, type FileMetadata } from '@/renderer/services/FileService';
import { iconColors } from '@/renderer/theme/colors';
import { Button } from '@arco-design/web-react';
import { FileAddition } from '@icon-park/react';
import React, { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';

interface DropzoneSectionProps {
  onFilesAdded: (files: FileMetadata[]) => void;
}

export const DropzoneSection: React.FC<DropzoneSectionProps> = ({ onFilesAdded }) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { isFileDragging, dragHandlers } = useDragUpload({
    supportedExts: ['pdf', 'docx', 'txt', 'md', 'jpg', 'png', 'mp3', 'wav', 'm4a'],
    onFilesAdded,
  });

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        // Check if we're in Electron or WebUI
        const isElectron = typeof window !== 'undefined' && Boolean((window as any).electronAPI);

        if (isElectron) {
          // Electron: Use FileService to process files
          const processedFiles = await FileService.processDroppedFiles(files);
          onFilesAdded(processedFiles);
        } else {
          // WebUI: Create FileMetadata with the actual File object
          const processedFiles: (FileMetadata & { file?: File })[] = [];
          for (let i = 0; i < files.length; i++) {
            const file = files[i];
            processedFiles.push({
              name: file.name,
              path: '', // Not used in WebUI
              size: file.size,
              type: file.type,
              lastModified: file.lastModified,
              file: file, // Keep the actual File object for upload
            });
          }
          onFilesAdded(processedFiles);
        }
        // Reset input so same file can be selected again
        e.target.value = '';
      }
    },
    [onFilesAdded]
  );

  return (
    <div className='dropzone-section'>
      <div {...dragHandlers} className={`dropzone ${isFileDragging ? 'dragging' : ''}`} onClick={handleBrowseClick}>
        <FileAddition size={48} fill={iconColors.secondary} />
        <h3 className='dropzone-title'>{t('conversation.explorer.dragDropFiles', 'Drag and drop files here')}</h3>
        <p className='dropzone-subtitle'>{t('common.or', 'or')}</p>
        <Button type='primary' size='large'>
          {t('conversation.explorer.browseFiles', 'Browse Files')}
        </Button>
        <input ref={fileInputRef} type='file' multiple accept='.pdf,.docx,.txt,.md,.jpg,.png,.mp3,.wav,.m4a' onChange={handleFileChange} style={{ display: 'none' }} />
      </div>
      <div className='supported-formats'>{t('conversation.explorer.supportedFormats', 'Supported formats: PDF, DOCX, TXT, MD, JPG, PNG, MP3, WAV, M4A')}</div>
    </div>
  );
};
