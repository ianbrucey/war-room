/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Input, Pagination, Tabs } from '@arco-design/web-react';
import { IconSearch } from '@arco-design/web-react/icon';
import type { ICaseDocument } from '@process/documents/types';
import React, { useMemo } from 'react';
import { DocumentListItem } from './DocumentListItem';

const { TabPane } = Tabs;

interface DocumentListSectionProps {
  documents: ICaseDocument[];
  activeTab: 'documents' | 'failed';
  onTabChange: (tab: 'documents' | 'failed') => void;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPreview: (documentId: string) => void;
  onDownload: (documentId: string) => void;
  onDelete: (documentId: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

/**
 * Document list section with tabs and pagination
 * Displays all documents or only failed documents based on active tab
 */
export const DocumentListSection: React.FC<DocumentListSectionProps> = ({ documents, activeTab, onTabChange, page, pageSize, onPageChange, onPreview, onDownload, onDelete, searchQuery, onSearchChange }) => {
  // Filter documents based on active tab and search query
  const filteredDocuments = useMemo(() => {
    let filtered = documents;

    // Filter by tab
    if (activeTab === 'failed') {
      filtered = filtered.filter((doc) => doc.processing_status === 'failed');
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((doc) => doc.filename.toLowerCase().includes(query) || doc.document_type?.toLowerCase().includes(query));
    }

    return filtered;
  }, [documents, activeTab, searchQuery]);

  // Paginate documents
  const paginatedDocuments = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filteredDocuments.slice(start, end);
  }, [filteredDocuments, page, pageSize]);

  const allDocsCount = documents.length;
  const failedDocsCount = documents.filter((doc) => doc.processing_status === 'failed').length;

  return (
    <div className='document-list-section'>
      {/* Search Input */}
      <Input prefix={<IconSearch />} placeholder='Search documents by filename or type...' value={searchQuery} onChange={onSearchChange} allowClear style={{ marginBottom: '16px' }} />

      <Tabs activeTab={activeTab} onChange={onTabChange}>
        <TabPane key='documents' title={`Documents (${allDocsCount})`}>
          <div className='document-list'>
            {paginatedDocuments.length === 0 ? (
              <div className='loading-state'>
                <p>{searchQuery ? 'No documents match your search' : 'No documents uploaded yet'}</p>
              </div>
            ) : (
              paginatedDocuments.map((doc) => <DocumentListItem key={doc.id} document={doc} onPreview={onPreview} onDownload={onDownload} onDelete={onDelete} />)
            )}
          </div>
        </TabPane>
        <TabPane key='failed' title={`Failed (${failedDocsCount})`}>
          <div className='document-list'>
            {paginatedDocuments.length === 0 ? (
              <div className='loading-state'>
                <p>No failed documents</p>
              </div>
            ) : (
              paginatedDocuments.map((doc) => <DocumentListItem key={doc.id} document={doc} onPreview={onPreview} onDownload={onDownload} onDelete={onDelete} />)
            )}
          </div>
        </TabPane>
      </Tabs>

      {filteredDocuments.length > 0 && (
        <div className='pagination-wrapper'>
          <Pagination current={page} pageSize={pageSize} total={filteredDocuments.length} onChange={onPageChange} showTotal sizeCanChange={false} simple={filteredDocuments.length <= pageSize} />
        </div>
      )}
    </div>
  );
};
