/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { FileOrFolderItem } from '@/renderer/types/files';
import EventEmitter from 'eventemitter3';
import type { DependencyList } from 'react';
import { useEffect } from 'react';

interface EventTypes {
  'gemini.selected.file': [Array<string | FileOrFolderItem>];
  'gemini.selected.file.clear': void;
  'gemini.workspace.refresh': void;
  'gemini.workspace.upload.trigger': void;
  'acp.selected.file': [Array<string | FileOrFolderItem>];
  'acp.selected.file.clear': void;
  'acp.workspace.refresh': void;
  'acp.workspace.upload.trigger': void;
  'codex.selected.file': [Array<string | FileOrFolderItem>];
  'codex.selected.file.clear': void;
  'codex.workspace.refresh': void;
  'codex.workspace.upload.trigger': void;
  'chat.history.refresh': void;
  'case.grounding.status.refresh': void;
}

export const emitter = new EventEmitter<EventTypes>();

export const addEventListener = <T extends EventEmitter.EventNames<EventTypes>>(event: T, fn: EventEmitter.EventListener<EventTypes, T>) => {
  emitter.on(event, fn);
  return () => {
    emitter.off(event, fn);
  };
};

export const useAddEventListener = <T extends EventEmitter.EventNames<EventTypes>>(event: T, fn: EventEmitter.EventListener<EventTypes, T>, deps?: DependencyList) => {
  useEffect(() => {
    return addEventListener(event, fn);
  }, deps || []);
};
