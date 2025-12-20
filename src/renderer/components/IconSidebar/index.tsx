/**
 * IconSidebar - VS Code-style icon bar for toggling panels
 *
 * Features:
 * - 48px wide icon-only sidebar
 * - 5 icons: Conversations, Workspace, Preview, Settings, User
 * - Active state highlighting
 * - Tooltip on hover
 * - Click to toggle associated panel
 */

import { useAuth } from '@/renderer/context/AuthContext';
import { emitter } from '@/renderer/utils/emitter';
import { Tooltip } from '@arco-design/web-react';
import classNames from 'classnames';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import JQLogo from '../../../../public/en/JQ.png';

export type PanelId = 'conversations' | 'explorer' | 'preview' | 'evidence' | null;

interface IconSidebarProps {
  activePanel: PanelId;
  onPanelToggle: (panelId: PanelId) => void;
  collapsed?: boolean;
}

const IconSidebar: React.FC<IconSidebarProps> = ({ activePanel, onPanelToggle }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { caseFileId } = useParams<{ caseFileId?: string }>();
  const { user, logout } = useAuth();
  const isSettings = pathname.startsWith('/settings');

  const handleLogout = async () => {
    try {
      await logout();
      await new Promise((resolve) => setTimeout(resolve, 100));
      window.location.href = '/';
    } catch (error) {
      console.error('[IconSidebar] Logout failed:', error);
      window.location.href = '/';
    }
  };

  const handleSettingsClick = () => {
    if (isSettings) {
      const targetPath = caseFileId ? `/${caseFileId}/guid` : '/cases';
      Promise.resolve(navigate(targetPath)).catch((error) => {
        console.error('Navigation failed:', error);
      });
      return;
    }
    Promise.resolve(navigate('/settings')).catch((error) => {
      console.error('Navigation failed:', error);
    });
  };

  const handleUploadClick = () => {
    // Emit upload trigger event - ChatWorkspace listens for this on all event prefixes
    // Try all possible prefixes to ensure it reaches the active conversation
    emitter.emit('gemini.workspace.upload.trigger' as any);
    emitter.emit('acp.workspace.upload.trigger' as any);
    emitter.emit('codex.workspace.upload.trigger' as any);
  };

  const handleUploadTemplatesClick = () => {
    // Emit template upload trigger event
    emitter.emit('gemini.workspace.upload-templates.trigger' as any);
    emitter.emit('acp.workspace.upload-templates.trigger' as any);
    emitter.emit('codex.workspace.upload-templates.trigger' as any);
  };

  return (
    <div className='size-full flex flex-col items-center py-12px gap-8px bg-2'>
      {/* Logo */}
      <Tooltip content='Back to Cases' position='right'>
        <div
          className='w-48px h-48px flex items-center justify-center cursor-pointer transition-all hover:opacity-80 mb-8px'
          onClick={() => {
            Promise.resolve(navigate('/cases')).catch((error) => {
              console.error('Navigation failed:', error);
            });
          }}
        >
          <img src={JQLogo} alt='JusticeQuest' className='w-64px h-48px object-contain' />
        </div>
      </Tooltip>

      {/* Conversations Icon */}
      <Tooltip content={t('conversation.history.title') || 'Conversations'} position='right'>
        <div
          className={classNames('w-48px h-48px flex items-center justify-center rd-8px cursor-pointer transition-all', 'hover:bg-hover', {
            'bg-active': activePanel === 'conversations',
          })}
          onClick={() => onPanelToggle(activePanel === 'conversations' ? null : 'conversations')}
        >
          <span style={{ fontSize: '26px' }}>💬</span>
        </div>
      </Tooltip>

      {/* explorer Icon */}
      <Tooltip content={t('conversation.explorer.title') || 'Explorer'} position='right'>
        <div
          className={classNames('w-48px h-48px flex items-center justify-center rd-8px cursor-pointer transition-all', 'hover:bg-hover', {
            'bg-active': activePanel === 'explorer',
          })}
          onClick={() => onPanelToggle(activePanel === 'explorer' ? null : 'explorer')}
        >
          <span style={{ fontSize: '26px' }}>📁</span>
        </div>
      </Tooltip>

      {/* Upload Icon - only show if caseFileId exists */}
      {caseFileId && (
        <Tooltip content={t('conversation.explorer.uploadCaseFiles') || 'Upload Case Files'} position='right'>
          <div
            className={classNames('w-48px h-48px flex items-center justify-center rd-8px cursor-pointer transition-all', 'hover:bg-hover')}
            onClick={handleUploadClick}
          >
            <span style={{ fontSize: '26px' }}>📤</span>
          </div>
        </Tooltip>
      )}

      {/* Upload Templates Icon - only show if caseFileId exists */}
      {caseFileId && (
        <Tooltip content='Upload Template Samples' position='right'>
          <div
            className={classNames('w-48px h-48px flex items-center justify-center rd-8px cursor-pointer transition-all', 'hover:bg-hover')}
            onClick={handleUploadTemplatesClick}
          >
            <span style={{ fontSize: '26px' }}>📋</span>
          </div>
        </Tooltip>
      )}

      {/* Research Icon - only show if caseFileId exists */}
      {caseFileId && (
        <Tooltip content='Research' position='right'>
          <div
            className={classNames('w-48px h-48px flex items-center justify-center rd-8px cursor-pointer transition-all', 'hover:bg-hover')}
          >
            <span style={{ fontSize: '26px' }}>📚</span>
          </div>
        </Tooltip>
      )}

      {/* Evidence Bundles Icon - only show if caseFileId exists */}
      {caseFileId && (
        <Tooltip content='Evidence Bundles' position='right'>
          <div
            className={classNames('w-48px h-48px flex items-center justify-center rd-8px cursor-pointer transition-all', {
              'bg-active': activePanel === 'evidence',
              'hover:bg-hover': activePanel !== 'evidence',
            })}
            onClick={() => onPanelToggle('evidence')}
          >
            <span style={{ fontSize: '26px' }}>🗂️</span>
          </div>
        </Tooltip>
      )}

      {/* Spacer to push bottom items down */}
      <div className='flex-1' />

      {/* Settings Icon */}
      <Tooltip content={isSettings ? t('common.back') : t('common.settings')} position='right'>
        <div className={classNames('w-48px h-48px flex items-center justify-center rd-8px cursor-pointer transition-all', 'hover:bg-hover')} onClick={handleSettingsClick}>
          <span style={{ fontSize: '26px' }}>⚙️</span>
        </div>
      </Tooltip>

      {/* User Management (Admin only) */}
      {user && (user.role === 'admin' || user.role === 'super_admin') && (
        <Tooltip content='User Management' position='right'>
          <div
            className={classNames('w-48px h-48px flex items-center justify-center rd-8px cursor-pointer transition-all', 'hover:bg-hover')}
            onClick={() => {
              Promise.resolve(navigate('/admin/users')).catch((error) => {
                console.error('Navigation failed:', error);
              });
            }}
          >
            <span style={{ fontSize: '26px' }}>👥</span>
          </div>
        </Tooltip>
      )}

      {/* Logout Icon */}
      {user && (
        <Tooltip content={t('common.logout')} position='right'>
          <div className={classNames('w-48px h-48px flex items-center justify-center rd-8px cursor-pointer transition-all', 'hover:bg-hover')} onClick={handleLogout}>
            <span style={{ fontSize: '26px' }}>🚪</span>
          </div>
        </Tooltip>
      )}
    </div>
  );
};

export default IconSidebar;
