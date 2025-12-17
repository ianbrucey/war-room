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
import { iconColors } from '@/renderer/theme/colors';
import { Tooltip } from '@arco-design/web-react';
import { FileAddition, Logout, Message, SettingTwo } from '@icon-park/react';
import classNames from 'classnames';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

export type PanelId = 'conversations' | 'workspace' | 'preview' | null;

interface IconSidebarProps {
  activePanel: PanelId;
  onPanelToggle: (panelId: PanelId) => void;
  collapsed?: boolean;
}

const IconSidebar: React.FC<IconSidebarProps> = ({ activePanel, onPanelToggle, collapsed = false }) => {
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

  // Darker color for inactive icons - use a visible gray
  const inactiveIconColor = '#666666';

  return (
    <div className='size-full flex flex-col items-center py-12px gap-8px bg-2'>
      {/* Conversations Icon */}
      <Tooltip content={t('conversation.history.title') || 'Conversations'} position='right'>
        <div
          className={classNames(
            'w-48px h-48px flex items-center justify-center rd-8px cursor-pointer transition-all',
            'hover:bg-hover',
            {
              'bg-active': activePanel === 'conversations',
            }
          )}
          onClick={() => onPanelToggle(activePanel === 'conversations' ? null : 'conversations')}
        >
          <Message theme='outline' size='26' fill={activePanel === 'conversations' ? iconColors.primary : inactiveIconColor} strokeWidth={3} />
        </div>
      </Tooltip>

      {/* Workspace Icon */}
      <Tooltip content={t('conversation.workspace.title') || 'Workspace'} position='right'>
        <div
          className={classNames(
            'w-48px h-48px flex items-center justify-center rd-8px cursor-pointer transition-all',
            'hover:bg-hover',
            {
              'bg-active': activePanel === 'workspace',
            }
          )}
          onClick={() => onPanelToggle(activePanel === 'workspace' ? null : 'workspace')}
        >
          <FileAddition theme='outline' size='26' fill={activePanel === 'workspace' ? iconColors.primary : inactiveIconColor} strokeWidth={3} />
        </div>
      </Tooltip>

      {/* Spacer to push bottom items down */}
      <div className='flex-1' />

      {/* Settings Icon */}
      <Tooltip content={isSettings ? t('common.back') : t('common.settings')} position='right'>
        <div
          className={classNames(
            'w-48px h-48px flex items-center justify-center rd-8px cursor-pointer transition-all',
            'hover:bg-hover'
          )}
          onClick={handleSettingsClick}
        >
          <SettingTwo theme='outline' size='26' fill={inactiveIconColor} strokeWidth={3} />
        </div>
      </Tooltip>

      {/* User Management (Admin only) */}
      {user && (user.role === 'admin' || user.role === 'super_admin') && (
        <Tooltip content='User Management' position='right'>
          <div
            className={classNames(
              'w-48px h-48px flex items-center justify-center rd-8px cursor-pointer transition-all',
              'hover:bg-hover'
            )}
            onClick={() => {
              Promise.resolve(navigate('/admin/users')).catch((error) => {
                console.error('Navigation failed:', error);
              });
            }}
          >
            <svg width='26' height='26' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'>
              <path d='M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12Z' stroke={inactiveIconColor} strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' />
              <path d='M3 20C3 16.13 7.03 13 12 13C16.97 13 21 16.13 21 20' stroke={inactiveIconColor} strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' />
            </svg>
          </div>
        </Tooltip>
      )}

      {/* Logout Icon */}
      {user && (
        <Tooltip content={t('common.logout')} position='right'>
          <div
            className={classNames(
              'w-48px h-48px flex items-center justify-center rd-8px cursor-pointer transition-all',
              'hover:bg-hover'
            )}
            onClick={handleLogout}
          >
            <Logout theme='outline' size='26' fill={inactiveIconColor} strokeWidth={3} />
          </div>
        </Tooltip>
      )}
    </div>
  );
};

export default IconSidebar;

