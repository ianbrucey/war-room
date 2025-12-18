/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AcpBackend } from '@/types/acpTypes';
import { Tag } from '@arco-design/web-react';
import { Edit } from '@icon-park/react';
import FlexFullContainer from '@renderer/components/FlexFullContainer';
import MessageList from '@renderer/messages/MessageList';
import { MessageListProvider, useMessageLstCache } from '@renderer/messages/hooks';
import HOC from '@renderer/utils/HOC';
import React from 'react';
import AcpSendBox from './AcpSendBox';

const AcpChat: React.FC<{
  conversation_id: string;
  workspace?: string;
  backend: AcpBackend;
  isNarrativeMode?: boolean;
  onNarrativeComplete?: (narrative: string) => void;
}> = ({ conversation_id, backend, isNarrativeMode = false, onNarrativeComplete }) => {
  useMessageLstCache(conversation_id);

  return (
    <div className='flex-1 flex flex-col min-h-0 overflow-hidden'>
      {/* Narrative mode indicator */}
      {isNarrativeMode && (
        <div className='px-16px py-8px bg-[var(--color-primary-light-1)] border-b border-[var(--color-border-2)]'>
          <Tag color='orangered' icon={<Edit />}>
            📝 Recording your story... Type "done" when finished
          </Tag>
        </div>
      )}

      <FlexFullContainer className='flex-1 min-h-0'>
        <MessageList className='flex-1 px-12px'></MessageList>
      </FlexFullContainer>
      <div className='px-12px'>
        <AcpSendBox conversation_id={conversation_id} backend={backend} isNarrativeMode={isNarrativeMode} onNarrativeComplete={onNarrativeComplete} />
      </div>
    </div>
  );
};

export default HOC(MessageListProvider)(AcpChat);
