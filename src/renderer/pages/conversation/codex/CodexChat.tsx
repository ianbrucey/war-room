/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import FlexFullContainer from '@renderer/components/FlexFullContainer';
import MessageList from '@renderer/messages/MessageList';
import { MessageListProvider, useMessageLstCache } from '@renderer/messages/hooks';
import HOC from '@renderer/utils/HOC';
import React, { useEffect } from 'react';
import LocalImageView from '../../../components/LocalImageView';
import CodexSendBox from './CodexSendBox';

const CodexChat: React.FC<{
  conversation_id: string;
  workspace: string;
}> = ({ conversation_id, workspace }) => {
  useMessageLstCache(conversation_id);
  const updateLocalImage = LocalImageView.useUpdateLocalImage();
  useEffect(() => {
    updateLocalImage({ root: workspace });
  }, [workspace]);
  return (
    <div className='flex-1 flex flex-col min-h-0 overflow-hidden'>
      <FlexFullContainer className='flex-1 min-h-0'>
        <MessageList className='flex-1 px-12px'></MessageList>
      </FlexFullContainer>
      <div className='px-12px pb-12px'>
        <CodexSendBox conversation_id={conversation_id} />
      </div>
    </div>
  );
};

export default HOC(MessageListProvider)(CodexChat);
