/**
 * LeftPanel - Container for dynamic panel content (conversations, workspace, file preview)
 *
 * Features:
 * - Slides in/out with smooth animation
 * - Draggable right edge to resize
 * - Renders different content based on active panel
 * - Collapses to 0px when no panel is active
 */

import type { PanelId } from '@/renderer/hooks/usePanelState';
import classNames from 'classnames';
import React from 'react';
import './LeftPanel.css';

interface LeftPanelProps {
  activePanel: PanelId;
  width: number;
  onWidthChange: (width: number) => void;
  onResetWidth: () => void;
  children: React.ReactNode;
  minWidth: number;
  maxWidth: number;
}

const LeftPanel: React.FC<LeftPanelProps> = ({ activePanel, width, onWidthChange, onResetWidth, children, minWidth, maxWidth }) => {
  const isOpen = activePanel !== null;

  const handleDragStart = (e: React.MouseEvent) => {
    const startX = e.clientX;
    const startWidth = width;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + deltaX));
      onWidthChange(newWidth);
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

  return (
    <div
      className={classNames('left-panel', {
        'left-panel--open': isOpen,
        'left-panel--closed': !isOpen,
      })}
      style={{
        width: isOpen ? `${width}px` : '0px',
      }}
    >
      {/* Panel Content */}
      <div className='left-panel__content'>{children}</div>

      {/* Drag Handle (only visible when panel is open) */}
      {isOpen && <div className='left-panel__drag-handle' onMouseDown={handleDragStart} onDoubleClick={onResetWidth} />}
    </div>
  );
};

export default LeftPanel;
