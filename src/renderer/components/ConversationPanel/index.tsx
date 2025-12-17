/**
 * ConversationPanel - Wraps ChatHistory component for left panel
 *
 * Features:
 * - Header with title
 * - Wraps existing ChatHistory component
 * - No internal changes to ChatHistory needed
 */

import ChatHistory from '@/renderer/pages/conversation/ChatHistory';
import React from 'react';
import { useParams } from 'react-router-dom';

interface ConversationPanelProps {
  onSessionClick?: () => void;
}

const ConversationPanel: React.FC<ConversationPanelProps> = ({ onSessionClick }) => {
  const { caseFileId } = useParams<{ caseFileId?: string }>();

  return (
    <div className='size-full flex flex-col bg-1'>
      {/* Header */}
      <div className='flex items-center justify-between p-16px border-b border-b-solid border-b-[var(--bg-3)]'>
        <span className='text-16px font-bold text-t-primary'>Conversations</span>
      </div>

      {/* Content */}
      <div className='flex-1 overflow-hidden p-8px min-h-0'>
        <ChatHistory collapsed={false} onSessionClick={onSessionClick} caseFileId={caseFileId} />
      </div>
    </div>
  );
};

export default ConversationPanel;

