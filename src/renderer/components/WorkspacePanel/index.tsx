/**
 * WorkspacePanel - Wraps ChatWorkspace component for left panel
 * 
 * Features:
 * - Header with title and actions
 * - Wraps existing ChatWorkspace component
 * - Passes through conversation_id and workspace props
 */

import ChatWorkspace from '@/renderer/pages/conversation/ChatWorkspace';
import React from 'react';

interface WorkspacePanelProps {
  conversation_id: string;
  workspace: string;
  /** Callback used to surface previewable files in the middle preview area */
  onFilePreview?: (filePath: string, filename: string) => void;
}

const WorkspacePanel: React.FC<WorkspacePanelProps> = ({ conversation_id, workspace, onFilePreview }) => {
  return (
    <div className='size-full flex flex-col bg-1'>
      {/* Content - ChatWorkspace already has its own header */}
      <div className='flex-1 overflow-hidden'>
	        <ChatWorkspace
	          conversation_id={conversation_id}
	          workspace={workspace}
	          eventPrefix='gemini'
	          onFilePreview={onFilePreview}
	        />
      </div>
    </div>
  );
};

export default WorkspacePanel;

