import { useState, useEffect } from 'react';

const QUERY_INPUT_DEFAULT_HEIGHT = 300;

/**
 * Custom hook for managing workspace UI state with localStorage persistence
 */
const useWorkspaceUIState = () => {
  const [showSchemaBrowser, setShowSchemaBrowser] = useState(() => {
    return localStorage.getItem('datakit-show-schema-browser') !== 'false';
  });

  const [showQueryHistory, setShowQueryHistory] = useState(() => {
    return localStorage.getItem('datakit-show-query-history') === 'true';
  });

  const [showOptimizationTips, setShowOptimizationTips] =
    useState<boolean>(false);

  const [fullScreenMode, setFullScreenMode] = useState<
    'none' | 'editor' | 'results'
  >('none');

  const [queryInputHeight, setQueryInputHeight] = useState<number>(() => {
    return parseInt(
      localStorage.getItem('datakit-query-editor-height') ||
        String(QUERY_INPUT_DEFAULT_HEIGHT),
      10
    );
  });

  const [saveDialogOpen, setSaveDialogOpen] = useState<boolean>(false);
  const [queryName, setQueryName] = useState<string>('');

  // Initialize localStorage values if not set
  useEffect(() => {
    if (localStorage.getItem('datakit-show-schema-browser') === null) {
      localStorage.setItem('datakit-show-schema-browser', 'true');
    }
    if (localStorage.getItem('datakit-show-query-history') === null) {
      localStorage.setItem('datakit-show-query-history', 'false');
    }
    if (localStorage.getItem('datakit-query-editor-height') === null) {
      localStorage.setItem(
        'datakit-query-editor-height',
        String(QUERY_INPUT_DEFAULT_HEIGHT)
      );
    }
  }, []);

  const toggleSchemaBrowser = () => {
    const newValue = !showSchemaBrowser;
    setShowSchemaBrowser(newValue);
    localStorage.setItem('datakit-show-schema-browser', String(newValue));
  };

  const toggleQueryHistory = () => {
    const newValue = !showQueryHistory;
    setShowQueryHistory(newValue);
    localStorage.setItem('datakit-show-query-history', String(newValue));
  };

  const toggleFullScreenMode = (mode: 'editor' | 'results') => {
    setFullScreenMode((prevMode) => (prevMode === mode ? 'none' : mode));
  };

  return {
    showSchemaBrowser,
    showQueryHistory,
    showOptimizationTips,
    fullScreenMode,
    queryInputHeight,
    saveDialogOpen,
    queryName,
    setShowOptimizationTips,
    setQueryInputHeight,
    setSaveDialogOpen,
    setQueryName,
    toggleSchemaBrowser,
    toggleQueryHistory,
    toggleFullScreenMode,
  };
};

export { useWorkspaceUIState };
