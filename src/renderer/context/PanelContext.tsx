/**
 * PanelContext - Global state management for VS Code-style panels
 *
 * Provides shared panel state across the entire application
 */

import type { ReactNode } from 'react';
import React, { createContext, useContext } from 'react';
import type { PanelId } from '@/renderer/hooks/usePanelState';
import { usePanelState } from '@/renderer/hooks/usePanelState';

interface PanelContextType {
  activePanel: PanelId;
  panelWidth: number;
  isPanelOpen: boolean;
  togglePanel: (panelId: PanelId) => void;
  setPanelWidth: (width: number) => void;
  resetPanelWidth: () => void;
  closePanel: () => void;
  openPanel: (panelId: PanelId) => void;
  MIN_WIDTH: number;
  MAX_WIDTH: number;
  DEFAULT_WIDTH: number;
}

const PanelContext = createContext<PanelContextType | undefined>(undefined);

export const PanelProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const panelState = usePanelState();

  return <PanelContext.Provider value={panelState}>{children}</PanelContext.Provider>;
};

export const usePanelContext = () => {
  const context = useContext(PanelContext);
  if (!context) {
    throw new Error('usePanelContext must be used within a PanelProvider');
  }
  return context;
};
