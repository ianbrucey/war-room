/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TProviderWithModel } from '@/common/storage';
import { emitter } from '@/renderer/utils/emitter';
import { Button, Tag } from '@arco-design/web-react';
import { CheckOne, Edit } from '@icon-park/react';
import FlexFullContainer from '@renderer/components/FlexFullContainer';
import MessageList from '@renderer/messages/MessageList';
import { MessageListProvider, useMessageLstCache } from '@renderer/messages/hooks';
import HOC from '@renderer/utils/HOC';
import React, { useEffect } from 'react';
import LocalImageView from '../../../components/LocalImageView';
import GeminiSendBox from './GeminiSendBox';

const GeminiChat: React.FC<{
  conversation_id: string;
  model: TProviderWithModel;
  workspace: string;
  isNarrativeMode?: boolean;
  onNarrativeComplete?: (narrative: string) => void;
}> = ({ conversation_id, model, workspace, isNarrativeMode = false, onNarrativeComplete }) => {
  useMessageLstCache(conversation_id);
  const updateLocalImage = LocalImageView.useUpdateLocalImage();
  useEffect(() => {
    updateLocalImage({ root: workspace });
  }, [workspace]);

  return (
    <div className='flex-1 flex flex-col min-h-0 overflow-hidden'>
      {/* Narrative mode indicator */}
      {isNarrativeMode && (
        <div className='px-16px py-8px bg-[var(--color-primary-light-1)] border-b border-[var(--color-border-2)] flex items-center justify-between'>
          <Tag color='orangered' icon={<Edit />}>
            📝 Recording your story...
          </Tag>
          <Button type='primary' size='small' icon={<CheckOne theme='outline' size='14' fill='white' />} onClick={() => emitter.emit('narrative.finish' as any)}>
            Finish Story
          </Button>
        </div>
      )}

      <FlexFullContainer className='flex-1 min-h-0'>
        <MessageList className='flex-1 px-12px'></MessageList>
      </FlexFullContainer>
      <div className='px-12px pb-12px'>
        <GeminiSendBox conversation_id={conversation_id} model={model} isNarrativeMode={isNarrativeMode} onNarrativeComplete={onNarrativeComplete} />
      </div>
    </div>
  );
};

export default HOC.Wrapper(MessageListProvider, LocalImageView.Provider)(GeminiChat);
