import { Tooltip } from '@arco-design/web-react';
import { ArrowCircleLeft, Logout, Plus, SettingTwo } from '@icon-park/react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ChatHistory from './pages/conversation/ChatHistory';
import SettingsSider from './pages/settings/SettingsSider';
import { iconColors } from './theme/colors';

const Sider: React.FC<{ onSessionClick?: () => void; collapsed?: boolean }> = ({ onSessionClick, collapsed = false }) => {
  const { pathname } = useLocation();

  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const isSettings = pathname.startsWith('/settings');

  const handleLogout = async () => {
    try {
      await logout();
      // Wait a bit to ensure logout request completes
      // 等待一下以确保登出请求完成
      await new Promise(resolve => setTimeout(resolve, 100));
      // Force a full page reload to clear all state
      // 强制完全重新加载页面以清除所有状态
      window.location.href = '/';
    } catch (error) {
      console.error('[Sider] Logout failed:', error);
      // Still try to reload even if logout fails
      window.location.href = '/';
    }
  };
  return (
    <div className='size-full flex flex-col'>
      {isSettings ? (
        <SettingsSider collapsed={collapsed}></SettingsSider>
      ) : (
        <>
          <Tooltip disabled={!collapsed} content={t('conversation.welcome.newConversation')} position='right'>
            <div
              className='flex items-center justify-start gap-10px px-12px py-8px hover:bg-hover rd-0.5rem mb-8px cursor-pointer group'
              onClick={() => {
                Promise.resolve(navigate('/guid')).catch((error) => {
                  console.error('Navigation failed:', error);
                });
                // 点击new chat后自动隐藏sidebar / Hide sidebar after starting new chat on mobile
                if (onSessionClick) {
                  onSessionClick();
                }
              }}
            >
              <Plus theme='outline' size='24' fill={iconColors.primary} className='flex' />
              <span className='collapsed-hidden font-bold text-t-primary'>{t('conversation.welcome.newConversation')}</span>
            </div>
          </Tooltip>
          <ChatHistory collapsed={collapsed} onSessionClick={onSessionClick}></ChatHistory>
        </>
      )}
      <Tooltip disabled={!collapsed} content={isSettings ? t('common.back') : t('common.settings')} position='right'>
        <div
          onClick={() => {
            if (isSettings) {
              Promise.resolve(navigate('/guid')).catch((error) => {
                console.error('Navigation failed:', error);
              });
              return;
            }
            Promise.resolve(navigate('/settings')).catch((error) => {
              console.error('Navigation failed:', error);
            });
          }}
          className='flex items-center justify-start gap-10px px-12px py-8px hover:bg-hover rd-0.5rem mb-8px cursor-pointer'
        >
          {isSettings ? <ArrowCircleLeft className='flex' theme='outline' size='24' fill={iconColors.primary} /> : <SettingTwo className='flex' theme='outline' size='24' fill={iconColors.primary} />}
          <span className='collapsed-hidden text-t-primary'>{isSettings ? t('common.back') : t('common.settings')}</span>
        </div>
      </Tooltip>
      {user && (user.role === 'admin' || user.role === 'super_admin') && (
        <Tooltip disabled={!collapsed} content="User Management" position='right'>
          <div
            onClick={() => {
              Promise.resolve(navigate('/admin/users')).catch((error) => {
                console.error('Navigation failed:', error);
              });
            }}
            className='flex items-center justify-start gap-10px px-12px py-8px hover:bg-hover rd-0.5rem mb-8px cursor-pointer'
          >
            <svg className='flex' width='24' height='24' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'>
              <path d='M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12Z' stroke={iconColors.primary} strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'/>
              <path d='M3 20C3 16.13 7.03 13 12 13C16.97 13 21 16.13 21 20' stroke={iconColors.primary} strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'/>
            </svg>
            <span className='collapsed-hidden text-t-primary'>User Management</span>
          </div>
        </Tooltip>
      )}
      {user && (
        <Tooltip disabled={!collapsed} content={t('common.logout')} position='right'>
          <div
            onClick={handleLogout}
            className='flex items-center justify-start gap-10px px-12px py-8px hover:bg-hover rd-0.5rem mb-8px cursor-pointer'
          >
            <Logout className='flex' theme='outline' size='24' fill={iconColors.primary} />
            <span className='collapsed-hidden text-t-primary'>{t('common.logout')}</span>
          </div>
        </Tooltip>
      )}
    </div>
  );
};

export default Sider;
