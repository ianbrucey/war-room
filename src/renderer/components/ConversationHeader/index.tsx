/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { Input } from '@arco-design/web-react';
import { Search } from '@icon-park/react';
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import useSWR from 'swr';

interface ConversationHeaderProps {
  /** Optional case file ID - if provided, will fetch and display case name */
  caseFileId?: string;
  /** Optional search callback */
  onSearch?: (query: string) => void;
}

const ConversationHeader: React.FC<ConversationHeaderProps> = ({ caseFileId, onSearch }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const routeCaseFileId = useParams<{ caseFileId?: string }>().caseFileId;
  const finalCaseFileId = caseFileId || routeCaseFileId;

  // Fetch case file data if caseFileId is available
  const { data: caseFile } = useSWR(
    finalCaseFileId ? ['getCaseFile', finalCaseFileId] : null,
    () => finalCaseFileId ? ipcBridge.cases.get.invoke({ caseId: finalCaseFileId }) : null
  );

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    onSearch?.(value);
  };

  const caseName = (caseFile as any)?.data?.title || (caseFile as any)?.title || 'Case';

  return (
    <div
      className='flex items-center justify-between px-16px py-12px border-b gap-16px flex-shrink-0'
      style={{
        backgroundColor: 'var(--color-bg-1)',
        borderBottom: '1px solid var(--color-border-2)',
      }}
    >
      {/* Left: Case Name */}
      <div className='flex items-center gap-8px min-w-0'>
        <span className='text-14px font-semibold text-t-primary truncate'>
          {caseName}
        </span>
      </div>

      {/* Right: Search Bar */}
      <div className='flex-1 max-w-400px'>
        <Input
          placeholder='Search files, conversations...'
          prefix={<Search size='14' />}
          value={searchQuery}
          onChange={handleSearchChange}
          className='!h-32px'
          style={{
            backgroundColor: 'var(--color-bg-2)',
          }}
        />
      </div>
    </div>
  );
};

export default ConversationHeader;

