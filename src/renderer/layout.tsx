/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import IconSidebar from '@/renderer/components/IconSidebar';
import PwaPullToRefresh from '@/renderer/components/PwaPullToRefresh';
import { Layout as ArcoLayout } from '@arco-design/web-react';
import React, { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { LayoutContext } from './context/LayoutContext';
import { PanelProvider, usePanelContext } from './context/PanelContext';
import { useDirectorySelection } from './hooks/useDirectorySelection';
import { useMultiAgentDetection } from './hooks/useMultiAgentDetection';

const useDebug = () => {
  const [count, setCount] = useState(0);
  const timer = useRef<any>(null);
  const onClick = () => {
    const open = () => {
      ipcBridge.application.openDevTools.invoke().catch((error) => {
        console.error('Failed to open dev tools:', error);
      });
      setCount(0);
    };
    if (count >= 3) {
      return open();
    }
    setCount((prev) => {
      if (prev >= 2) {
        open();
        return 0;
      }
      return prev + 1;
    });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      clearTimeout(timer.current);
      setCount(0);
    }, 1000);
  };

  return { onClick };
};

const LayoutInner: React.FC<{
  sider: React.ReactNode;
  onSessionClick?: () => void;
}> = ({ sider, onSessionClick }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { onClick } = useDebug();
  const { contextHolder: multiAgentContextHolder } = useMultiAgentDetection();
  const { contextHolder: directorySelectionContextHolder } = useDirectorySelection();
  const location = useLocation();
  const isCasesPage = location.pathname === '/cases';

  // Panel state from context
  const { activePanel, togglePanel } = usePanelContext();

  // 检测移动端并响应窗口大小变化
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setCollapsed(true);
      }
    };

    // 初始检测
    checkMobile();

    // 监听窗口大小变化
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  return (
    <LayoutContext.Provider value={{ isMobile, siderCollapsed: collapsed, setSiderCollapsed: setCollapsed }}>
      <ArcoLayout className={'size-full layout'}>
        {/* Icon Sidebar (60px) - Hide on cases page */}
        {!isCasesPage && (
          <ArcoLayout.Sider
            collapsedWidth={0}
            collapsed={false}
            width={60}
            className='!bg-2 layout-icon-sidebar'
          >
            <IconSidebar
              activePanel={activePanel}
              onPanelToggle={togglePanel}
            />
          </ArcoLayout.Sider>
        )}

        <ArcoLayout.Content
          className={'bg-1 layout-content'}
          onClick={() => {
            if (isMobile && !collapsed) setCollapsed(true);
          }}
        >
          <Outlet></Outlet>
          {multiAgentContextHolder}
          {directorySelectionContextHolder}
          <PwaPullToRefresh />
        </ArcoLayout.Content>
      </ArcoLayout>
    </LayoutContext.Provider>
  );
};

// Wrap Layout with PanelProvider
const Layout: React.FC<{
  sider: React.ReactNode;
  onSessionClick?: () => void;
}> = (props) => {
  return (
    <PanelProvider>
      <LayoutInner {...props} />
    </PanelProvider>
  );
};

export default Layout;
