/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TChatConversation } from '@/common/storage';
import React from 'react';
import ChatWorkspace from './ChatWorkspace';

const ChatSider: React.FC<{
  conversation?: TChatConversation;
  /** Optional callback used to surface previewable files in the middle preview area */
  onFilePreview?: (filePath: string, filename: string) => void;
}> = ({ conversation, onFilePreview }) => {
  if (conversation?.type === 'gemini') {
    return <ChatWorkspace conversation_id={conversation.id} workspace={conversation.extra.workspace} onFilePreview={onFilePreview} />;
  }

  if (conversation?.type === 'acp' && conversation.extra?.workspace) {
    return <ChatWorkspace conversation_id={conversation.id} workspace={conversation.extra.workspace} eventPrefix='acp' onFilePreview={onFilePreview} />;
  }

  if (conversation?.type === 'codex' && conversation.extra?.workspace) {
    return <ChatWorkspace conversation_id={conversation.id} workspace={conversation.extra.workspace} eventPrefix='codex' onFilePreview={onFilePreview} />;
  }

  return <div></div>;
};

export default ChatSider;
