import ConversationPanel from '@/renderer/components/ConversationPanel';
import LeftPanel from '@/renderer/components/LeftPanel';
import WorkspacePanel from '@/renderer/components/WorkspacePanel';
import { usePanelContext } from '@/renderer/context/PanelContext';
import React from 'react';

import ClaudeLogo from '@/renderer/assets/logos/claude.svg';
import CodexLogo from '@/renderer/assets/logos/codex.svg';
import GeminiLogo from '@/renderer/assets/logos/gemini.svg';
import IflowLogo from '@/renderer/assets/logos/iflow.svg';
import QwenLogo from '@/renderer/assets/logos/qwen.svg';
import { ACP_BACKENDS_ALL } from '@/types/acpTypes';

const ChatLayout: React.FC<{
  children: React.ReactNode;
  title?: React.ReactNode;
  sider: React.ReactNode;
  siderTitle?: React.ReactNode;
  backend?: string;
  /** Optional middle-pane preview content (e.g. workspace file preview) */
  preview?: React.ReactNode;
  /** Callback used by workspace panel to trigger preview updates */
  onFilePreview?: (filePath: string, filename: string) => void;
}> = (props) => {
  const { backend } = props;

  // Panel state from context
  const {
    activePanel,
    panelWidth,
    setPanelWidth,
    resetPanelWidth,
    MIN_WIDTH,
    MAX_WIDTH
  } = usePanelContext();

  // Get conversation_id and workspace from props.sider (ChatSider component)
  // This is a temporary solution - ideally we'd pass these as props
  const conversation_id = (props.sider as any)?.props?.conversation?.id || '';
  const workspace = (props.sider as any)?.props?.conversation?.extra?.workspace || '';

  // Backend logo helper
  const getBackendLogo = () => {
    switch (backend) {
      case 'claude': return ClaudeLogo;
      case 'gemini': return GeminiLogo;
      case 'qwen': return QwenLogo;
      case 'iflow': return IflowLogo;
      case 'codex': return CodexLogo;
      default: return '';
    }
  };

  // Render panel content based on active panel
  const renderPanelContent = () => {
    switch (activePanel) {
      case 'conversations':
        return <ConversationPanel />;
      case 'workspace':
        return <WorkspacePanel conversation_id={conversation_id} workspace={workspace} onFilePreview={props.onFilePreview} />;
      case 'preview':
        return <div className='p-16px'>File Preview (Coming Soon)</div>;
      default:
        return null;
    }
  };

  return (
    <div className='size-full flex flex-row'>
      {/* LEFT: Dynamic Panel */}
      <LeftPanel
        activePanel={activePanel}
        width={panelWidth}
        onWidthChange={setPanelWidth}
        onResetWidth={resetPanelWidth}
        minWidth={MIN_WIDTH}
        maxWidth={MAX_WIDTH}
      >
        {renderPanelContent()}
      </LeftPanel>

      {/* RIGHT: Main content area with preview + chat panel */}
      <div className='flex flex-row flex-1 min-w-0 bg-2 p-12px gap-12px overflow-hidden'>
        {/* Middle: file preview area */}
        <div className='flex-1 min-w-0 bg-1 rounded-12px overflow-hidden'>
          {props.preview || (
            <div className='size-full flex items-center justify-center text-13px text-t-secondary px-16px'>
              <span>Select a file in the workspace to preview it here.</span>
            </div>
          )}
        </div>

        {/* Right: Chat Panel - card-like container */}
        <div
          className='flex flex-col bg-1 rounded-12px overflow-hidden'
          style={{
            width: '380px',
            maxWidth: '420px',
            minWidth: '340px',
            flexShrink: 0,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
          }}
        >
          {/* Chat Panel Header */}
          <div className='flex items-center justify-between px-16px py-12px border-b border-[var(--bg-3)] flex-shrink-0'>
            <div className='flex items-center gap-8px'>
              <span className='font-semibold text-14px text-t-primary'>{props.title || 'Chat'}</span>
            </div>
            {backend && (
              <div className='flex items-center gap-6px bg-2 rounded-full px-8px py-2px'>
                <img
                  src={getBackendLogo()}
                  alt={`${backend} logo`}
                  width={14}
                  height={14}
                  style={{ objectFit: 'contain' }}
                />
                <span className='text-12px text-t-secondary'>
                  {ACP_BACKENDS_ALL[backend as keyof typeof ACP_BACKENDS_ALL]?.name || backend}
                </span>
              </div>
            )}
          </div>

          {/* Chat Content */}
          <div className='flex-1 flex flex-col min-h-0 overflow-hidden'>
            {props.children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatLayout;
