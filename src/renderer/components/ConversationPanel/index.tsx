/**
 * ConversationPanel - Wraps ChatHistory component for left panel
 *
 * Features:
 * - Header with title and "New Chat" button
 * - Wraps existing ChatHistory component
 * - No internal changes to ChatHistory needed
 */

import ChatHistory from '@/renderer/pages/conversation/ChatHistory';
import { Tooltip } from '@arco-design/web-react';
import { Plus } from '@icon-park/react';
import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';

interface ConversationPanelProps {
  onSessionClick?: () => void;
}

const ConversationPanel: React.FC<ConversationPanelProps> = ({ onSessionClick }) => {
  const { caseFileId } = useParams<{ caseFileId?: string }>();
  const navigate = useNavigate();

  const handleNewChat = () => {
    // Navigate to the guid page (new conversation wizard)
    if (caseFileId) {
      void navigate(`/${caseFileId}/guid`);
    } else {
      void navigate('/guid');
    }
  };

  return (
    <div className='size-full flex flex-col bg-1'>
      {/* Header */}
      <div className='flex items-center justify-between p-16px border-b border-b-solid border-b-[var(--bg-3)]'>
        <span className='text-16px font-bold text-t-primary'>Conversations</span>
        <Tooltip content='New Chat'>
          <button
            onClick={handleNewChat}
            className='flex items-center justify-center w-28px h-28px rounded-6px hover:bg-hover transition-colors cursor-pointer border-none bg-transparent'
          >
            <Plus theme='outline' size='18' className='text-t-primary' />
          </button>
        </Tooltip>
      </div>

      {/* Content */}
      <div className='flex-1 overflow-hidden p-8px min-h-0'>
        <ChatHistory collapsed={false} onSessionClick={onSessionClick} caseFileId={caseFileId} />
      </div>
    </div>
  );
};

export default ConversationPanel;

