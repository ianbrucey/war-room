/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { TChatConversation } from '@/common/storage';
import { uuid } from '@/common/utils';
import type { PreviewTab } from '@/renderer/components/FilePreviewPanel';
import FilePreviewPanel from '@/renderer/components/FilePreviewPanel';
import { iconColors } from '@/renderer/theme/colors';
import { Dropdown, Menu, Message, Tooltip, Typography } from '@arco-design/web-react';
import { History, Plus } from '@icon-park/react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
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
    <Tooltip content={t('conversation.explorer.createNewConversation')}>
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
  const { caseFileId } = useParams<{ caseFileId?: string }>();
  const [message, messageContextHolder] = Message.useMessage();

  // Tabbed file preview state
  const [previewTabs, setPreviewTabs] = useState<PreviewTab[]>([]);
  const [activeTabIndex, setActiveTabIndex] = useState(0);

  // Narrative mode state
  const [isNarrativeMode, setIsNarrativeMode] = useState(false);

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

  const handleTabClose = useCallback(
    (index: number) => {
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
    },
    [activeTabIndex]
  );

  // Case grounding callbacks
  const handleStartNarrative = useCallback(() => {
    setIsNarrativeMode(true);
  }, []);

  const handleUploadDocuments = useCallback(() => {
    // Trigger workspace file upload based on conversation type
    const eventPrefix = conversation?.type === 'acp' ? 'acp' : conversation?.type === 'codex' ? 'codex' : 'gemini';
    console.log('[ChatConversation] Emitting upload trigger event:', `${eventPrefix}.workspace.upload.trigger`);
    emitter.emit(`${eventPrefix}.workspace.upload.trigger` as any);
  }, [conversation?.type]);

  const handleGenerateSummary = useCallback(async () => {
    if (!caseFileId) return;
    try {
      message.info('Generating case summary...');
      const response = await fetch(`/api/cases/${caseFileId}/summary/generate`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success) {
        message.success('Case summary generation started');
        // Refresh status after a delay to reflect the generating state
        setTimeout(() => emitter.emit('case.grounding.status.refresh'), 1000);
      } else {
        message.error(data.error || 'Failed to generate case summary');
      }
    } catch (error) {
      console.error('[ChatConversation] Error generating summary:', error);
      message.error('Failed to generate case summary');
    }
  }, [caseFileId, message]);

  const conversationNode = useMemo(() => {
    if (!conversation) return null;
    switch (conversation.type) {
      case 'gemini':
        return (
          <GeminiChat
            key={conversation.id}
            conversation_id={conversation.id}
            workspace={conversation.extra.workspace}
            model={conversation.model}
            isNarrativeMode={isNarrativeMode}
            onNarrativeComplete={(narrative) => {
              setIsNarrativeMode(false);
              // Save narrative via IPC
              if (caseFileId) {
                ipcBridge.caseGrounding.saveNarrative
                  .invoke({
                    caseFileId,
                    content: narrative,
                    captureMethod: 'text', // Chat-based narrative capture is text-based
                  })
                  .then(() => {
                    console.log('[ChatConversation] Narrative saved successfully');
                    emitter.emit('case.grounding.status.refresh');
                    // Extract parties
                    return ipcBridge.caseGrounding.extractParties.invoke({ caseFileId, narrativeContent: narrative });
                  })
                  .then(() => {
                    console.log('[ChatConversation] Parties extracted from narrative');
                    emitter.emit('case.grounding.status.refresh');
                  })
                  .catch((error) => {
                    console.error('[ChatConversation] Error saving narrative:', error);
                  });
              }
            }}
          />
        );
      case 'acp':
        return (
          <AcpChat
            key={conversation.id}
            conversation_id={conversation.id}
            workspace={conversation.extra?.workspace}
            backend={conversation.extra?.backend || 'auggie'}
            isNarrativeMode={isNarrativeMode}
            onNarrativeComplete={(narrative) => {
              setIsNarrativeMode(false);
              // Save narrative via IPC
              if (caseFileId) {
                ipcBridge.caseGrounding.saveNarrative
                  .invoke({
                    caseFileId,
                    content: narrative,
                    captureMethod: 'text',
                  })
                  .then(() => {
                    console.log('[ChatConversation] Narrative saved successfully');
                    emitter.emit('case.grounding.status.refresh');
                    // Extract parties
                    return ipcBridge.caseGrounding.extractParties.invoke({ caseFileId, narrativeContent: narrative });
                  })
                  .then(() => {
                    console.log('[ChatConversation] Parties extracted from narrative');
                    emitter.emit('case.grounding.status.refresh');
                  })
                  .catch((error) => {
                    console.error('[ChatConversation] Error saving narrative:', error);
                  });
              }
            }}
          />
        );
      case 'codex':
        return <CodexChat key={conversation.id} conversation_id={conversation.id} workspace={conversation.extra?.workspace} />;
      default:
        return null;
    }
  }, [conversation, isNarrativeMode, caseFileId]);

  const sliderTitle = useMemo(() => {
    return (
      <div className='flex items-center justify-between'>
        <span className='text-16px font-bold text-t-primary'>{t('conversation.explorer.title')}</span>
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

  // Only show file preview panel when there are tabs - otherwise show grounding card
  const previewContent = previewTabs.length > 0 ? <FilePreviewPanel tabs={previewTabs} activeTab={activeTabIndex} onTabSelect={handleTabSelect} onTabClose={handleTabClose} /> : undefined;

  // Determine event prefix based on conversation type
  const eventPrefix = conversation?.type === 'acp' ? 'acp' : conversation?.type === 'codex' ? 'codex' : 'gemini';

  return (
    <>
      {messageContextHolder}
      <ChatLayout
        title={conversation?.name}
        backend={conversation?.type === 'acp' ? conversation?.extra?.backend : conversation?.type === 'codex' ? 'codex' : undefined}
        eventPrefix={eventPrefix}
        siderTitle={sliderTitle}
        sider={<ChatSider conversation={conversation} onFilePreview={handleFilePreview} />}
        preview={previewContent}
        onFilePreview={handleFilePreview}
        onStartNarrative={handleStartNarrative}
        onUploadDocuments={handleUploadDocuments}
        onGenerateSummary={handleGenerateSummary}
        workspace={conversation?.extra?.workspace || ''}
        conversation_id={conversation?.id || ''}
      >
        {conversationNode}
      </ChatLayout>
    </>
  );
};

export default ChatConversation;
