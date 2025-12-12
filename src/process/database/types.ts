/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

// 复用现有的业务类型定义
import type { TMessage } from '@/common/chatLib';
import type { ICaseFile, IConfigStorageRefer, TChatConversation } from '@/common/storage';
export type { ICaseFile };

/**
 * ======================
 * 数据库专属类型 (新增功能)
 * ======================
 */

/**
 * User role types for role-based access control
 */
export type UserRole = 'super_admin' | 'admin' | 'user';

/**
 * User account (新增的账户系统)
 */
export interface IUser {
  id: string;
  username: string;
  email?: string;
  password_hash: string;
  role: UserRole;
  is_active: number; // 0 = inactive, 1 = active
  created_by?: string | null;
  updated_by?: string | null;
  avatar_path?: string;
  jwt_secret?: string | null;
  created_at: number;
  updated_at: number;
  last_login?: number | null;
}

// Image metadata removed - images are stored in filesystem and referenced via message.resultDisplay

/**
 * ======================
 * 数据库查询辅助类型
 * ======================
 */

/**
 * Database query result wrapper
 */
export interface IQueryResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Paginated query result
 */
export interface IPaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * ======================
 * 数据库存储格式 (序列化后的格式)
 * ======================
 */

/**
 * Case File stored in database (序列化后的格式)
 */
export interface ICaseFileRow {
  id: string;
  title: string;
  case_number?: string | null;
  workspace_path: string;
  user_id: string;
  created_at: number;
  updated_at: number;
}

/**
 * Conversation stored in database (序列化后的格式)
 */
export interface IConversationRow {
  id: string;
  user_id: string;
  case_file_id: string;
  name: string;
  type: 'gemini' | 'acp' | 'codex';
  extra: string; // JSON string of extra data
  model?: string; // JSON string of TProviderWithModel (gemini type has this)
  status?: 'pending' | 'running' | 'finished';
  created_at: number;
  updated_at: number;
}

/**
 * Message stored in database (序列化后的格式)
 */
export interface IMessageRow {
  id: string;
  conversation_id: string;
  msg_id?: string; // 消息来源ID
  type: string; // TMessage['type']
  content: string; // JSON string of message content
  position?: 'left' | 'right' | 'center' | 'pop';
  status?: 'finish' | 'pending' | 'error' | 'work';
  created_at: number;
}

/**
 * Config stored in database (key-value, 用于数据库版本跟踪)
 */
export interface IConfigRow {
  key: string;
  value: string; // JSON string
  updated_at: number;
}

/**
 * ======================
 * 类型转换函数
 * ======================
 */

/**
 * Convert ICaseFile to database row
 */
export function caseFileToRow(caseFile: ICaseFile): ICaseFileRow {
  return {
    id: caseFile.id,
    title: caseFile.title,
    case_number: caseFile.case_number,
    workspace_path: caseFile.workspace_path,
    user_id: caseFile.user_id,
    created_at: caseFile.created_at,
    updated_at: caseFile.updated_at,
  };
}

/**
 * Convert database row to ICaseFile
 */
export function rowToCaseFile(row: ICaseFileRow): ICaseFile {
  return {
    id: row.id,
    title: row.title,
    case_number: row.case_number,
    workspace_path: row.workspace_path,
    user_id: row.user_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Convert TChatConversation to database row
 */
export function conversationToRow(conversation: TChatConversation, userId: string, caseFileId: string): IConversationRow {
  return {
    id: conversation.id,
    user_id: userId,
    case_file_id: caseFileId,
    name: conversation.name,
    type: conversation.type,
    extra: JSON.stringify(conversation.extra),
    model: 'model' in conversation ? JSON.stringify(conversation.model) : undefined,
    status: conversation.status,
    created_at: conversation.createTime,
    updated_at: conversation.modifyTime,
  };
}

/**
 * Convert database row to TChatConversation
 */
export function rowToConversation(row: IConversationRow): TChatConversation {
  const base = {
    id: row.id,
    name: row.name,
    desc: undefined as string | undefined,
    createTime: row.created_at,
    modifyTime: row.updated_at,
    status: row.status,
  };

  // Gemini type has model field
  if (row.type === 'gemini' && row.model) {
    return {
      ...base,
      type: 'gemini' as const,
      extra: JSON.parse(row.extra),
      model: JSON.parse(row.model),
    } as TChatConversation;
  }

  // ACP type
  if (row.type === 'acp') {
    return {
      ...base,
      type: 'acp' as const,
      extra: JSON.parse(row.extra),
    } as TChatConversation;
  }

  // Codex type
  return {
    ...base,
    type: 'codex' as const,
    extra: JSON.parse(row.extra),
  } as TChatConversation;
}

/**
 * Convert TMessage to database row
 */
export function messageToRow(message: TMessage): IMessageRow {
  return {
    id: message.id,
    conversation_id: message.conversation_id,
    msg_id: message.msg_id,
    type: message.type,
    content: JSON.stringify(message.content),
    position: message.position,
    status: message.status,
    created_at: message.createdAt || Date.now(),
  };
}

/**
 * Convert database row to TMessage
 */
export function rowToMessage(row: IMessageRow): TMessage {
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    msg_id: row.msg_id,
    type: row.type as TMessage['type'],
    content: JSON.parse(row.content),
    position: row.position,
    status: row.status,
    createdAt: row.created_at,
  } as TMessage;
}

/**
 * ======================
 * 导出类型别名，方便使用
 * ======================
 */

export type {
  IConfigStorageRefer,
  // 复用的业务类型
  TChatConversation,
  TMessage,
};
