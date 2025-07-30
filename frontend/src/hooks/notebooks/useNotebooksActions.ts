import { useState, useRef, useEffect } from 'react';
import { usePythonStore } from '@/store/pythonStore';
import type { PythonScript } from '@/lib/python/types';

export interface NotebookActionsConfig {
  onAfterAction?: () => void;
  closeMenus?: () => void;
}

export const useNotebooksActions = (config: NotebookActionsConfig = {}) => {
  const {
    cells,
    currentScript,
    saveScript,
    loadScript,
    createNewScript,
    saveStatus,
    hasUnsavedChanges,
    markAsSaving,
    markAsSaved,
    markAsUnsaved,
  } = usePythonStore();

  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    type: 'new' | 'switch';
    notebookId?: string;
  } | null>(null);

  // Debounce timer for auto-save
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Notebook editing handlers
  const handleUpdateNotebook = (updates: Partial<PythonScript>) => {
    if (currentScript) {
      const updatedScript = { ...currentScript, ...updates };
      // Update the current script in the store
      usePythonStore.setState({ currentScript: updatedScript });
      
      // Mark as unsaved since metadata changed
      markAsUnsaved();
      
      const name = updatedScript.name?.trim() || '';
      const hasValidName = name !== '';
      const hasContent = cells.length > 0;
      
      // Auto-save metadata changes for existing scripts or new scripts with any name and content
      const shouldAutoSave = (currentScript.id && name) || (!currentScript.id && hasValidName && hasContent);
      
      if (shouldAutoSave) {
        // Clear existing timeout
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        
        // Set new timeout for debounced save
        saveTimeoutRef.current = setTimeout(() => {
          markAsSaving();
          saveScript(updatedScript.name, updatedScript.description);
          // markAsSaved is called by saveScript in the store
        }, 500); // 500ms debounce
      }
    }
  };

  // Handle save script (for existing or new notebooks)
  const handleSaveScript = () => {
    if (!currentScript) {
      // No existing script, show dialog to get name
      setShowSaveDialog(true);
    } else {
      // Existing script, save directly (store handles save status)
      saveScript(currentScript.name, currentScript.description);
      config.onAfterAction?.();
    }
  };

  // Handle creating new notebook with save confirmation if needed
  const handleCreateNewNotebook = () => {
    if (hasUnsavedChanges()) {
      setPendingAction({ type: 'new' });
      setShowSaveConfirm(true);
      config.closeMenus?.();
    } else {
      createNewScript();
      config.closeMenus?.();
      config.onAfterAction?.();
    }
  };

  // Handle notebook switching with save confirmation if needed
  const handleNotebookSwitch = (notebookId: string) => {
    if (hasUnsavedChanges()) {
      setPendingAction({ type: 'switch', notebookId });
      setShowSaveConfirm(true);
      config.closeMenus?.();
    } else {
      loadScript(notebookId);
      config.closeMenus?.();
      config.onAfterAction?.();
    }
  };

  // Handle saving and continuing with pending action
  const handleSaveAndContinue = () => {
    if (currentScript?.name && currentScript.name.trim()) {
      // Has any name (including 'Untitled Notebook'), save directly
      saveScript(currentScript.name, currentScript.description);
      setTimeout(() => {
        executePendingAction();
      }, 100);
    } else {
      // Needs a name, show dialog (pendingAction will be executed after save)
      setShowSaveDialog(true);
    }
  };

  // Handle discarding changes and continuing with pending action
  const handleDiscardAndContinue = () => {
    executePendingAction();
  };

  // Execute the pending action
  const executePendingAction = () => {
    if (pendingAction?.type === 'new') {
      createNewScript();
    } else if (pendingAction?.type === 'switch' && pendingAction.notebookId) {
      loadScript(pendingAction.notebookId);
    }
    
    setShowSaveConfirm(false);
    setPendingAction(null);
    config.onAfterAction?.();
  };

  // Handle save dialog completion
  const handleSaveDialogComplete = (name: string) => {
    saveScript(name);
    setShowSaveDialog(false);
    
    // Continue with pending action if any
    if (pendingAction) {
      setTimeout(() => {
        executePendingAction();
      }, 100);
    } else {
      config.onAfterAction?.();
    }
  };

  // Handle closing dialogs
  const handleCloseSaveDialog = () => {
    setShowSaveDialog(false);
    setPendingAction(null);
  };

  const handleCloseSaveConfirm = () => {
    setShowSaveConfirm(false);
    setPendingAction(null);
  };

  return {
    // State
    showSaveDialog,
    showSaveConfirm,
    hasUnsavedChanges: hasUnsavedChanges(),
    saveStatus,
    
    // Handlers
    handleSaveScript,
    handleCreateNewNotebook,
    handleNotebookSwitch,
    handleSaveAndContinue,
    handleDiscardAndContinue,
    handleSaveDialogComplete,
    handleCloseSaveDialog,
    handleCloseSaveConfirm,
    handleUpdateNotebook,
    
    // Current state
    currentScript,
  };
};