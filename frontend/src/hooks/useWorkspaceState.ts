import { useState } from 'react';

interface UseWorkspaceStateOptions {
  defaultPanelWidth?: number;
  storagePrefix?: string;
}

export const useWorkspaceState = (options: UseWorkspaceStateOptions = {}) => {
  const { defaultPanelWidth = 260, storagePrefix = 'datakit-workspace' } = options;

  // Panel visibility states
  const [showLeftPanel, setShowLeftPanel] = useState(false);
  const [showRightPanel, setShowRightPanel] = useState(false);
  
  // Dialog states
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveItemName, setSaveItemName] = useState('');
  
  // Full screen mode
  const [fullScreenMode, setFullScreenMode] = useState<'none' | 'editor' | 'results'>('none');
  
  // Panel width states with localStorage persistence
  const [leftPanelWidth, setLeftPanelWidth] = useState(() => {
    const saved = localStorage.getItem(`${storagePrefix}-left-panel-width`);
    return saved ? parseInt(saved, 10) : defaultPanelWidth;
  });
  
  const [rightPanelWidth, setRightPanelWidth] = useState(() => {
    const saved = localStorage.getItem(`${storagePrefix}-right-panel-width`);
    return saved ? parseInt(saved, 10) : defaultPanelWidth;
  });

  // Panel toggles
  const toggleLeftPanel = () => setShowLeftPanel(!showLeftPanel);
  const toggleRightPanel = () => setShowRightPanel(!showRightPanel);
  
  // Full screen toggles
  const toggleFullScreenMode = (mode: 'editor' | 'results') => {
    setFullScreenMode(fullScreenMode === mode ? 'none' : mode);
  };
  
  const exitFullScreen = () => setFullScreenMode('none');
  
  // Save dialog helpers
  const openSaveDialog = (initialName = '') => {
    setSaveItemName(initialName);
    setSaveDialogOpen(true);
  };
  
  const closeSaveDialog = () => {
    setSaveDialogOpen(false);
    setSaveItemName('');
  };
  
  // Persist panel widths
  const updateLeftPanelWidth = (width: number) => {
    setLeftPanelWidth(width);
    localStorage.setItem(`${storagePrefix}-left-panel-width`, width.toString());
  };
  
  const updateRightPanelWidth = (width: number) => {
    setRightPanelWidth(width);
    localStorage.setItem(`${storagePrefix}-right-panel-width`, width.toString());
  };

  return {
    // Panel visibility
    showLeftPanel,
    showRightPanel,
    toggleLeftPanel,
    toggleRightPanel,
    
    // Panel dimensions
    leftPanelWidth,
    rightPanelWidth,
    updateLeftPanelWidth,
    updateRightPanelWidth,
    
    // Full screen
    fullScreenMode,
    toggleFullScreenMode,
    exitFullScreen,
    
    // Save dialog
    saveDialogOpen,
    saveItemName,
    setSaveItemName,
    openSaveDialog,
    closeSaveDialog,
  };
};