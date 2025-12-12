/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { AIONUI_TIMESTAMP_REGEX } from '@/common/constants';
import type { ICreateConversationParams } from '@/common/ipcBridge';
import type { TChatConversation, TProviderWithModel } from '@/common/storage';
import { uuid } from '@/common/utils';
import fs from 'fs/promises';
import path from 'path';
import { getSystemDir } from './initStorage';

const buildWorkspaceWidthFiles = async (caseWorkspace: string, defaultFiles?: string[]) => {
  // Workspace is provided by the case - no temp folder creation
  const workspace = caseWorkspace;

  // Copy default files if provided
  if (defaultFiles) {
    for (const file of defaultFiles) {
      // 确保文件路径是绝对路径
      const absoluteFilePath = path.isAbsolute(file) ? file : path.resolve(file);

      // 检查源文件是否存在
      try {
        await fs.access(absoluteFilePath);
      } catch (error) {
        console.warn(`[AionUi] Source file does not exist, skipping: ${absoluteFilePath}`);
        console.warn(`[AionUi] Original path: ${file}`);
        // 跳过不存在的文件，而不是抛出错误
        continue;
      }

      let fileName = path.basename(absoluteFilePath);

      // 如果是临时文件，去掉 AionUI 时间戳后缀
      const { cacheDir } = getSystemDir();
      const tempDir = path.join(cacheDir, 'temp');
      if (absoluteFilePath.startsWith(tempDir)) {
        fileName = fileName.replace(AIONUI_TIMESTAMP_REGEX, '$1');
      }

      const destPath = path.join(workspace, fileName);

      try {
        await fs.copyFile(absoluteFilePath, destPath);
      } catch (error) {
        console.error(`[AionUi] Failed to copy file from ${absoluteFilePath} to ${destPath}:`, error);
        // 继续处理其他文件，而不是完全失败
      }
    }
  }
  return { workspace, customWorkspace: true };
};

export const createGeminiAgent = async (model: TProviderWithModel, caseWorkspace: string, defaultFiles?: string[], webSearchEngine?: 'google' | 'default'): Promise<TChatConversation> => {
  const { workspace } = await buildWorkspaceWidthFiles(caseWorkspace, defaultFiles);
  return {
    type: 'gemini',
    model,
    extra: { workspace, customWorkspace: true, webSearchEngine },
    desc: workspace,
    createTime: Date.now(),
    modifyTime: Date.now(),
    name: workspace,
    id: uuid(),
  };
};

export const createAcpAgent = async (options: ICreateConversationParams): Promise<TChatConversation> => {
  const { extra } = options;
  const { workspace } = await buildWorkspaceWidthFiles(extra.workspace, extra.defaultFiles);
  return {
    type: 'acp',
    extra: { workspace, customWorkspace: true, backend: extra.backend, cliPath: extra.cliPath },
    createTime: Date.now(),
    modifyTime: Date.now(),
    name: workspace,
    id: uuid(),
  };
};

export const createCodexAgent = async (options: ICreateConversationParams): Promise<TChatConversation> => {
  const { extra } = options;
  const { workspace } = await buildWorkspaceWidthFiles(extra.workspace, extra.defaultFiles);
  return {
    type: 'codex',
    extra: {
      workspace,
      customWorkspace: true,
      cliPath: extra.cliPath,
      sandboxMode: 'workspace-write', // 默认为读写权限
    },
    createTime: Date.now(),
    modifyTime: Date.now(),
    name: workspace,
    id: uuid(),
  } as any;
};
