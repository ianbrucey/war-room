/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { TChatConversation } from '@/common/storage';
import { uuid } from '@/common/utils';
import FilePreviewPanel, { PreviewTab } from '@/renderer/components/FilePreviewPanel';
import { iconColors } from '@/renderer/theme/colors';
import { Dropdown, Menu, Tooltip, Typography } from '@arco-design/web-react';
import { History, Plus } from '@icon-park/react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { emitter } from '../../utils/emitter';
import AcpChat from './acp/AcpChat';
import ChatLayout from './ChatLayout';
import ChatSider from './ChatSider';
import CodexChat from './codex/CodexChat';
import GeminiChat from './gemini/GeminiChat';

const AssociatedConversation: React.FC<{ conversation_id: string }> = ({ conversation_id }) => {
  const { data } = useSWR(['getAssociateConversation', conversation_id], () => ipcBridge.conversation.getAssociateConversation.invoke({ conversation_id }));
  const navigate = useNavigate();
  const list = useMemo(() => {
    if (!data?.length) return [];
    return data.filter((conversation) => conversation.id !== conversation_id);
  }, [data]);
  if (!list.length) return null;
  return (
    <Dropdown
      droplist={
        <Menu
          onClickMenuItem={(key) => {
            Promise.resolve(navigate(`/conversation/${key}`)).catch((error) => {
              console.error('Navigation failed:', error);
            });
          }}
        >
          {list.map((conversation) => {
            return (
              <Menu.Item key={conversation.id}>
                <Typography.Ellipsis className={'max-w-300px'}>{conversation.name}</Typography.Ellipsis>
              </Menu.Item>
            );
          })}
        </Menu>
      }
      trigger={['click']}
    >
      <span>
        <History theme='filled' size='17' fill={iconColors.primary} strokeWidth={2} strokeLinejoin='miter' strokeLinecap='square' />
      </span>
    </Dropdown>
  );
};

const AddNewConversation: React.FC<{ conversation: TChatConversation }> = ({ conversation }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  if (!conversation.extra?.workspace) return null;
  return (
    <Tooltip content={t('conversation.workspace.createNewConversation')}>
      <span
        onClick={() => {
          const id = uuid();
          ipcBridge.conversation.createWithConversation
            .invoke({ conversation: { ...conversation, id, createTime: Date.now(), modifyTime: Date.now() } })
            .then(() => {
              Promise.resolve(navigate(`/conversation/${id}`)).catch((error) => {
                console.error('Navigation failed:', error);
              });
              emitter.emit('chat.history.refresh');
            })
            .catch((error) => {
              console.error('Failed to create conversation:', error);
            });
        }}
      >
        <Plus theme='filled' size='17' fill={iconColors.primary} strokeWidth={2} strokeLinejoin='miter' strokeLinecap='square' />
      </span>
    </Tooltip>
  );
};

const ChatConversation: React.FC<{
  conversation?: TChatConversation;
}> = ({ conversation }) => {
  const { t } = useTranslation();

  // Tabbed file preview state
  const [previewTabs, setPreviewTabs] = useState<PreviewTab[]>([]);
  const [activeTabIndex, setActiveTabIndex] = useState(0);

  const handleFilePreview = useCallback((filePath: string, filename: string) => {
    setPreviewTabs((prev) => {
      // Check if file is already open
      const existingIndex = prev.findIndex((tab) => tab.filePath === filePath);
      if (existingIndex >= 0) {
        // File already open, just switch to it
        setActiveTabIndex(existingIndex);
        return prev;
      }
      // Add new tab and switch to it
      const newTabs = [...prev, { filePath, filename }];
      setActiveTabIndex(newTabs.length - 1);
      return newTabs;
    });
  }, []);

  const handleTabSelect = useCallback((index: number) => {
    setActiveTabIndex(index);
  }, []);

  const handleTabClose = useCallback((index: number) => {
    setPreviewTabs((prev) => {
      const newTabs = prev.filter((_, i) => i !== index);
      // Adjust active tab if needed
      if (newTabs.length === 0) {
        setActiveTabIndex(0);
      } else if (index <= activeTabIndex) {
        setActiveTabIndex(Math.max(0, activeTabIndex - 1));
      }
      return newTabs;
    });
  }, [activeTabIndex]);

  const conversationNode = useMemo(() => {
    if (!conversation) return null;
    switch (conversation.type) {
      case 'gemini':
        return <GeminiChat key={conversation.id} conversation_id={conversation.id} workspace={conversation.extra.workspace} model={conversation.model}></GeminiChat>;
      case 'acp':
        return <AcpChat key={conversation.id} conversation_id={conversation.id} workspace={conversation.extra?.workspace} backend={conversation.extra?.backend || 'claude'}></AcpChat>;
      case 'codex':
        return <CodexChat key={conversation.id} conversation_id={conversation.id} workspace={conversation.extra?.workspace} />;
      default:
        return null;
    }
  }, [conversation]);

	  const sliderTitle = useMemo(() => {
    return (
      <div className='flex items-center justify-between'>
        <span className='text-16px font-bold text-t-primary'>{t('conversation.workspace.title')}</span>
        {conversation && (
          <div className='flex items-center gap-4px'>
            <AddNewConversation conversation={conversation}></AddNewConversation>
            <AssociatedConversation conversation_id={conversation.id}></AssociatedConversation>
          </div>
        )}
      </div>
    );
	  }, [conversation, t]);

  useEffect(() => {
    // Reset preview tabs when switching conversations
    setPreviewTabs([]);
    setActiveTabIndex(0);
  }, [conversation?.id]);

  return (
    <ChatLayout
      title={conversation?.name}
      backend={conversation?.type === 'acp' ? conversation?.extra?.backend : conversation?.type === 'codex' ? 'codex' : undefined}
      siderTitle={sliderTitle}
      sider={<ChatSider conversation={conversation} onFilePreview={handleFilePreview} />}
      preview={
        <FilePreviewPanel
          tabs={previewTabs}
          activeTab={activeTabIndex}
          onTabSelect={handleTabSelect}
          onTabClose={handleTabClose}
        />
      }
      onFilePreview={handleFilePreview}
    >
      {conversationNode}
    </ChatLayout>
  );
};

export default ChatConversation;
