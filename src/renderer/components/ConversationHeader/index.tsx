/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { useAddEventListener } from '@/renderer/utils/emitter';
import { Input, Tooltip } from '@arco-design/web-react';
import { CheckOne, DocDetail, Search } from '@icon-park/react';
import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import useSWR from 'swr';

interface GroundingStatus {
  narrativeExists: boolean;
  documentCount: number;
  summaryStatus: string | null;
  isStale: boolean;
}

interface ConversationHeaderProps {
  /** Optional case file ID - if provided, will fetch and display case name */
  caseFileId?: string;
  /** Optional search callback */
  onSearch?: (query: string) => void;
  /** Whether the grounding card is currently dismissed */
  groundingCardDismissed?: boolean;
  /** Callback to show the grounding card */
  onShowGroundingCard?: () => void;
}

const ConversationHeader: React.FC<ConversationHeaderProps> = ({ caseFileId, onSearch, groundingCardDismissed, onShowGroundingCard }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [groundingStatus, setGroundingStatus] = useState<GroundingStatus | null>(null);
  const routeCaseFileId = useParams<{ caseFileId?: string }>().caseFileId;
  const finalCaseFileId = caseFileId || routeCaseFileId;

  // Fetch case file data if caseFileId is available
  const { data: caseFile } = useSWR(finalCaseFileId ? ['getCaseFile', finalCaseFileId] : null, () => (finalCaseFileId ? ipcBridge.cases.get.invoke({ caseId: finalCaseFileId }) : null));

  // Fetch grounding status
  const loadGroundingStatus = useCallback(async () => {
    if (!finalCaseFileId) return;
    try {
      const response = await ipcBridge.caseGrounding.getGroundingStatus.invoke({ caseFileId: finalCaseFileId });
      if (response.success && response.data) {
        setGroundingStatus(response.data);
      }
    } catch (error) {
      console.error('[ConversationHeader] Error loading grounding status:', error);
    }
  }, [finalCaseFileId]);

  useEffect(() => {
    void loadGroundingStatus();
    // Refresh every 30 seconds
    const interval = setInterval(() => void loadGroundingStatus(), 30000);
    return () => clearInterval(interval);
  }, [loadGroundingStatus]);

  // Listen for grounding status refresh events
  useAddEventListener('case.grounding.status.refresh', () => void loadGroundingStatus(), [loadGroundingStatus]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    onSearch?.(value);
  };

  const caseName = (caseFile as any)?.data?.title || (caseFile as any)?.title || 'Case';

  // Calculate grounding progress
  const getGroundingProgress = () => {
    if (!groundingStatus) return { complete: 0, total: 3, label: 'Not started' };
    let complete = 0;
    if (groundingStatus.narrativeExists) complete++;
    if (groundingStatus.documentCount > 0) complete++;
    if (groundingStatus.summaryStatus === 'generated' && !groundingStatus.isStale) complete++;

    if (complete === 3) return { complete, total: 3, label: 'Complete' };
    if (complete === 0) return { complete, total: 3, label: 'Not started' };
    return { complete, total: 3, label: `${complete}/3 steps` };
  };

  const progress = getGroundingProgress();
  const isComplete = progress.complete === 3;
  const hasProgress = progress.complete > 0;

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
        <span className='text-14px font-semibold text-t-primary truncate'>{caseName}</span>
      </div>

      {/* Center: Search Bar */}
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

      {/* Right: Grounding Status Badge */}
      {finalCaseFileId && groundingCardDismissed && (
        <Tooltip content={isComplete ? 'Case grounding complete' : `Case grounding: ${progress.label}. Click to open.`}>
          <button
            onClick={onShowGroundingCard}
            className={`flex items-center gap-6px px-10px py-6px rounded-6px border-none cursor-pointer transition-all ${
              isComplete ? 'bg-green-1 text-green-6 hover:bg-green-2' : hasProgress ? 'bg-orange-1 text-orange-6 hover:bg-orange-2' : 'bg-[var(--color-bg-3)] text-t-secondary hover:bg-[var(--color-bg-4)]'
            }`}
          >
            {isComplete ? <CheckOne theme='filled' size='14' /> : <DocDetail theme='outline' size='14' />}
            <span className='text-12px font-medium'>{progress.label}</span>
          </button>
        </Tooltip>
      )}
    </div>
  );
};

export default ConversationHeader;
