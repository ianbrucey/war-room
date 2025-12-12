/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Button, Input, Message } from '@arco-design/web-react';
import { ArrowUp } from '@icon-park/react';
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCompositionInput } from '../hooks/useCompositionInput';
import { useDragUpload } from '../hooks/useDragUpload';
import { usePasteService } from '../hooks/usePasteService';
import type { FileMetadata } from '../services/FileService';
import { allSupportedExts } from '../services/FileService';

const constVoid = (): void => undefined;

const SendBox: React.FC<{
  value?: string;
  onChange?: (value: string) => void;
  onSend: (message: string) => Promise<void>;
  onStop?: () => Promise<void>;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  tools?: React.ReactNode;
  prefix?: React.ReactNode;
  placeholder?: string;
  onFilesAdded?: (files: FileMetadata[]) => void;
  supportedExts?: string[];
  defaultMultiLine?: boolean;
  lockMultiLine?: boolean;
  actionsRight?: React.ReactNode;
}> = ({ onSend, onStop, prefix, className, loading, tools, actionsRight, disabled, placeholder, value: input = '', onChange: setInput = constVoid, onFilesAdded, supportedExts = allSupportedExts }) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 使用拖拽 hook
  const { isFileDragging, dragHandlers } = useDragUpload({
    supportedExts,
    onFilesAdded,
  });

  const [message, context] = Message.useMessage();

  // 使用共享的输入法合成处理
  const { compositionHandlers, createKeyDownHandler } = useCompositionInput();

  // 使用共享的PasteService集成
  const { onPaste, onFocus } = usePasteService({
    supportedExts,
    onFilesAdded,
    onTextPaste: (text: string) => {
      // 处理清理后的文本粘贴，在当前光标位置插入文本而不是替换整个内容
      const textarea = document.activeElement as HTMLTextAreaElement;
      if (textarea && textarea.tagName === 'TEXTAREA') {
        const cursorPosition = textarea.selectionStart;
        const currentValue = textarea.value;
        const newValue = currentValue.slice(0, cursorPosition) + text + currentValue.slice(cursorPosition);
        setInput(newValue);
        // 设置光标到插入文本后的位置
        setTimeout(() => {
          textarea.setSelectionRange(cursorPosition + text.length, cursorPosition + text.length);
        }, 0);
      } else {
        // 如果无法获取光标位置，回退到追加到末尾的行为
        setInput(text);
      }
    },
  });

  const sendMessageHandler = () => {
    if (loading || isLoading) {
      message.warning(t('messages.conversationInProgress'));
      return;
    }
    if (!input.trim()) {
      return;
    }
    setIsLoading(true);
    onSend(input)
      .then(() => {
        setInput('');
      })
      .catch(() => {})
      .finally(() => {
        setIsLoading(false);
      });
  };

  const stopHandler = async () => {
    if (!onStop) return;
    try {
      await onStop();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={className}>
      <div
        ref={containerRef}
        className={`relative flex flex-col overflow-hidden transition-all duration-200 ${isFileDragging ? 'b-dashed' : 'border-solid'}`}
        style={{
          backgroundColor: 'var(--color-bg-2)',
          borderRadius: '8px',
          border: '1px solid var(--color-border-2)',
          ...(isFileDragging
            ? {
                backgroundColor: 'var(--color-primary-light-1)',
                borderColor: 'rgb(var(--primary-3))',
              }
            : {
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              }),
        }}
        {...dragHandlers}
      >
        {context}

        {/* Top Toolbar */}
        <div
          className='flex items-center justify-between px-3 py-2 border-b border-border'
          style={{
            backgroundColor: 'var(--color-fill-2)',
            borderBottom: '1px solid var(--color-border-2)',
          }}
        >
          <div className='flex items-center gap-2 sendbox-tools'>{tools}</div>
        </div>

        {/* Input Area */}
        <div className='relative w-full'>
          <Input.TextArea
            autoFocus
            disabled={disabled}
            value={input}
            placeholder={placeholder}
            className='!bg-transparent !border-none !shadow-none !active:shadow-none !focus:shadow-none text-14px px-3 py-3 !resize-none'
            style={{
              width: '100%',
              minHeight: '100px',
              maxHeight: '400px',
              paddingBottom: '40px', // Space for the send button
            }}
            onChange={(v) => {
              setInput(v);
            }}
            onPaste={onPaste}
            onFocus={onFocus}
            {...compositionHandlers}
            autoSize={{ minRows: 4, maxRows: 15 }}
            onKeyDown={createKeyDownHandler(sendMessageHandler)}
          />

          {/* Floating Send Button */}
          <div className='absolute bottom-3 right-3 z-10 flex items-center gap-2'>
            {actionsRight}
            {isLoading || loading ? (
              <Button shape='circle' type='secondary' className='bg-animate' icon={<div className='mx-auto size-12px bg-6' onClick={stopHandler}></div>}></Button>
            ) : (
              <Button
                shape='circle'
                type='primary'
                className='shadow-lg'
                icon={<ArrowUp theme='outline' size='16' fill='white' strokeWidth={3} />}
                onClick={() => {
                  sendMessageHandler();
                }}
              />
            )}
          </div>
        </div>

        {/* Bottom Context/Files Bar */}
        {(prefix && (
          <div
            className='px-3 py-2 border-t border-border bg-fill-1'
            style={{
              borderTop: '1px solid var(--color-border-1)',
            }}
          >
            {prefix}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SendBox;
