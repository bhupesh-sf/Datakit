import { useCallback } from 'react';

interface PanelToggleFunctions {
  [key: string]: () => void;
}

interface PanelStateValues {
  [key: string]: boolean;
}

interface UsePanelNavigationOptions {
  panelStates: PanelStateValues;
  panelToggles: PanelToggleFunctions;
}

/**
 * Hook for managing exclusive panel navigation
 * Ensures only one panel is open at a time in a group
 */
export const usePanelNavigation = ({ panelStates, panelToggles }: UsePanelNavigationOptions) => {
  
  /**
   * Handle panel toggle with exclusive behavior
   * If the clicked panel is already open, close it
   * Otherwise, close all other panels and open the clicked one
   */
  const handlePanelToggle = useCallback((targetPanelKey: string) => {
    const isTargetOpen = panelStates[targetPanelKey];
    
    if (isTargetOpen) {
      // Target panel is already open, just close it
      panelToggles[targetPanelKey]?.();
    } else {
      // Close all currently open panels
      Object.keys(panelStates).forEach(panelKey => {
        if (panelStates[panelKey] && panelKey !== targetPanelKey) {
          panelToggles[panelKey]?.();
        }
      });
      
      // Open the target panel
      panelToggles[targetPanelKey]?.();
    }
  }, [panelStates, panelToggles]);

  /**
   * Close all panels in the group
   */
  const closeAllPanels = useCallback(() => {
    Object.keys(panelStates).forEach(panelKey => {
      if (panelStates[panelKey]) {
        panelToggles[panelKey]?.();
      }
    });
  }, [panelStates, panelToggles]);

  /**
   * Check if any panel in the group is open
   */
  const hasOpenPanel = Object.values(panelStates).some(state => state);

  /**
   * Get the currently active panel key (first one that's open)
   */
  const activePanelKey = Object.keys(panelStates).find(key => panelStates[key]) || null;

  return {
    handlePanelToggle,
    closeAllPanels,
    hasOpenPanel,
    activePanelKey,
  };
};