import { CaseGroundingCard } from '@/renderer/components/CaseGroundingCard';
import ConversationHeader from '@/renderer/components/ConversationHeader';
import ConversationPanel from '@/renderer/components/ConversationPanel';
import LeftPanel from '@/renderer/components/LeftPanel';
import WorkspacePanel from '@/renderer/components/WorkspacePanel';
import { usePanelContext } from '@/renderer/context/PanelContext';
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import ClaudeLogo from '@/renderer/assets/logos/claude.svg';
import CodexLogo from '@/renderer/assets/logos/codex.svg';
import GeminiLogo from '@/renderer/assets/logos/gemini.svg';
import IflowLogo from '@/renderer/assets/logos/iflow.svg';
import QwenLogo from '@/renderer/assets/logos/qwen.svg';

const CHAT_PANEL_WIDTH_KEY = 'chatPanelWidth';
const DEFAULT_CHAT_WIDTH = 380;
const MIN_CHAT_WIDTH = 320;
const MAX_CHAT_WIDTH = 600;

const ChatLayout: React.FC<{
  children: React.ReactNode;
  title?: React.ReactNode;
  sider: React.ReactNode;
  siderTitle?: React.ReactNode;
  backend?: string;
  /** Event prefix for workspace events (gemini/acp/codex) */
  eventPrefix?: 'gemini' | 'acp' | 'codex';
  /** Optional middle-pane preview content (e.g. workspace file preview) */
  preview?: React.ReactNode;
  /** Callback used by workspace panel to trigger preview updates */
  onFilePreview?: (filePath: string, filename: string) => void;
  /** Callbacks for case grounding actions */
  onStartNarrative?: () => void;
  onUploadDocuments?: () => void;
  onGenerateSummary?: () => void;
}> = (props) => {
  const { backend } = props;
  const { caseFileId } = useParams<{ caseFileId?: string }>();

  // Panel state from context (for left panel)
  const { activePanel, panelWidth, setPanelWidth, resetPanelWidth, MIN_WIDTH, MAX_WIDTH } = usePanelContext();

  // Chat panel width state (persisted to localStorage)
  const [chatWidth, setChatWidth] = useState(() => {
    const saved = localStorage.getItem(CHAT_PANEL_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_CHAT_WIDTH;
  });

  // Grounding card dismiss state (session-based)
  const [groundingCardDismissed, setGroundingCardDismissed] = useState(() => {
    if (!caseFileId) return false;
    return sessionStorage.getItem(`grounding-dismissed-${caseFileId}`) === 'true';
  });

  useEffect(() => {
    localStorage.setItem(CHAT_PANEL_WIDTH_KEY, chatWidth.toString());
  }, [chatWidth]);

  // Drag handler for chat panel resize
  const handleChatDragStart = (e: React.MouseEvent) => {
    const startX = e.clientX;
    const startWidth = chatWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      // Drag LEFT to increase width (since panel is on the right)
      const deltaX = startX - moveEvent.clientX;
      const newWidth = Math.max(MIN_CHAT_WIDTH, Math.min(MAX_CHAT_WIDTH, startWidth + deltaX));
      setChatWidth(newWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handleChatResetWidth = () => {
    setChatWidth(DEFAULT_CHAT_WIDTH);
  };

  // Handle grounding card dismiss
  const handleGroundingDismiss = () => {
    if (caseFileId) {
      sessionStorage.setItem(`grounding-dismissed-${caseFileId}`, 'true');
      setGroundingCardDismissed(true);
    }
  };

  // Handle showing the grounding card (after dismissal)
  const handleShowGroundingCard = () => {
    if (caseFileId) {
      sessionStorage.removeItem(`grounding-dismissed-${caseFileId}`);
      setGroundingCardDismissed(false);
    }
  };

  // Get conversation_id and workspace from props.sider (ChatSider component)
  // This is a temporary solution - ideally we'd pass these as props
  const conversation_id = (props.sider as any)?.props?.conversation?.id || '';
  const workspace = (props.sider as any)?.props?.conversation?.extra?.workspace || '';

  // Backend logo helper
  const getBackendLogo = () => {
    switch (backend) {
      case 'claude':
        return ClaudeLogo;
      case 'gemini':
        return GeminiLogo;
      case 'qwen':
        return QwenLogo;
      case 'iflow':
        return IflowLogo;
      case 'codex':
        return CodexLogo;
      default:
        return '';
    }
  };

  // Render panel content based on active panel
  const renderPanelContent = () => {
    switch (activePanel) {
      case 'conversations':
        return <ConversationPanel />;
      case 'explorer':
        return <WorkspacePanel conversation_id={conversation_id} workspace={workspace} eventPrefix={props.eventPrefix} onFilePreview={props.onFilePreview} />;
      case 'preview':
        return <div className='p-16px'>File Preview (Coming Soon)</div>;
      default:
        return null;
    }
  };

  // Render middle panel content (grounding card or preview or empty state)
  const renderMiddlePanel = () => {
    // Priority 1: Show grounding card if case exists, not dismissed, and no preview
    if (caseFileId && !groundingCardDismissed && !props.preview) {
      return <CaseGroundingCard caseFileId={caseFileId} onStartNarrative={props.onStartNarrative || (() => {})} onUploadDocuments={props.onUploadDocuments || (() => {})} onGenerateSummary={props.onGenerateSummary || (() => {})} onDismiss={handleGroundingDismiss} />;
    }

    // Priority 2: Show file preview if provided
    if (props.preview) {
      return props.preview;
    }

    // Priority 3: Empty state
    return (
      <div className='size-full flex items-center justify-center text-13px text-t-secondary px-16px'>
        <span>Select a file in the workspace to preview it here.</span>
      </div>
    );
  };

  return (
    <div className='size-full flex flex-col'>
      {/* TOP: Conversation Header */}
      {caseFileId && <ConversationHeader caseFileId={caseFileId} groundingCardDismissed={groundingCardDismissed} onShowGroundingCard={handleShowGroundingCard} />}

      {/* MAIN: Layout with left panel and content */}
      <div className='flex flex-row flex-1 min-w-0 overflow-hidden'>
        {/* LEFT: Dynamic Panel */}
        <LeftPanel activePanel={activePanel} width={panelWidth} onWidthChange={setPanelWidth} onResetWidth={resetPanelWidth} minWidth={MIN_WIDTH} maxWidth={MAX_WIDTH}>
          {renderPanelContent()}
        </LeftPanel>

        {/* RIGHT: Main content area with preview + chat panel */}
        <div className='flex flex-row flex-1 min-w-0 bg-2 p-12px gap-12px overflow-hidden'>
          {/* Middle: file preview area or grounding card */}
          <div className='flex-1 min-w-0 bg-1 rounded-12px overflow-hidden'>{renderMiddlePanel()}</div>

          {/* Right: Chat Panel - card-like container with drag handle */}
          <div
            className='flex flex-col bg-1 rounded-12px overflow-hidden relative'
            style={{
              width: `${chatWidth}px`,
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
            }}
          >
            {/* Drag Handle - left edge of chat panel */}
            <div
              className='absolute left-0 top-0 bottom-0 w-6px cursor-col-resize z-10 hover:bg-[var(--color-border-2)] transition-colors'
              onMouseDown={handleChatDragStart}
              onDoubleClick={handleChatResetWidth}
              style={{
                borderLeft: '1px solid var(--bg-3)',
              }}
            />

            {/* Chat Panel Header */}
            <div className='flex items-center justify-between px-16px py-12px border-b border-[var(--bg-3)] flex-shrink-0'>
              <div className='flex items-center gap-8px'>
                <span className='font-semibold text-14px text-t-primary'>{props.title || 'Chat'}</span>
              </div>
            </div>

            {/* Chat Content */}
            <div className='flex-1 flex flex-col min-h-0 overflow-hidden'>{props.children}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatLayout;
