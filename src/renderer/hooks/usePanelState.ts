/**
 * usePanelState - Manages left panel state (which panel is open, width)
 *
 * Features:
 * - Tracks active panel ID ('conversations', 'explorer', 'preview', null)
 * - Persists state to localStorage
 * - Manages panel width (200-600px)
 * - Ensures only one panel open at a time
 */

import { useCallback, useEffect, useState } from 'react';

export type PanelId = 'conversations' | 'explorer' | 'preview' | 'evidence' | null;

interface PanelState {
  activePanel: PanelId;
  panelWidth: number;
}

const STORAGE_KEY = 'vscode-layout-panel-state';
const DEFAULT_WIDTH = 300;
const MIN_WIDTH = 200;
const MAX_WIDTH = 600;

export const usePanelState = () => {
  // Load initial state from localStorage
  const loadInitialState = (): PanelState => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          activePanel: parsed.activePanel || null,
          panelWidth: Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, parsed.panelWidth || DEFAULT_WIDTH)),
        };
      }
    } catch (error) {
      console.error('[usePanelState] Failed to load state from localStorage:', error);
    }
    return {
      activePanel: null, // Start with no panel open
      panelWidth: DEFAULT_WIDTH,
    };
  };

  const [state, setState] = useState<PanelState>(loadInitialState);

  // Persist state to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('[usePanelState] Failed to save state to localStorage:', error);
    }
  }, [state]);

  // Toggle panel (open if closed, close if open)
  const togglePanel = useCallback((panelId: PanelId) => {
    setState((prev) => ({
      ...prev,
      activePanel: prev.activePanel === panelId ? null : panelId,
    }));
  }, []);

  // Set panel width (with constraints)
  const setPanelWidth = useCallback((width: number) => {
    const constrainedWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, width));
    setState((prev) => ({
      ...prev,
      panelWidth: constrainedWidth,
    }));
  }, []);

  // Reset panel width to default
  const resetPanelWidth = useCallback(() => {
    setState((prev) => ({
      ...prev,
      panelWidth: DEFAULT_WIDTH,
    }));
  }, []);

  // Close panel
  const closePanel = useCallback(() => {
    setState((prev) => ({
      ...prev,
      activePanel: null,
    }));
  }, []);

  // Open specific panel
  const openPanel = useCallback((panelId: PanelId) => {
    setState((prev) => ({
      ...prev,
      activePanel: panelId,
    }));
  }, []);

  return {
    activePanel: state.activePanel,
    panelWidth: state.panelWidth,
    isPanelOpen: state.activePanel !== null,
    togglePanel,
    setPanelWidth,
    resetPanelWidth,
    closePanel,
    openPanel,
    MIN_WIDTH,
    MAX_WIDTH,
    DEFAULT_WIDTH,
  };
};
