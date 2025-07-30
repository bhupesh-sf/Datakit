import { useState } from 'react';
import { usePythonStore } from '@/store/pythonStore';
import type { PythonScript } from '@/lib/python/types';

export const useNotebookManagement = () => {
  const {
    savedScripts,
    currentScript,
    loadScript,
    deleteScript,
    duplicateScript,
    importScript,
    exportScript,
    saveScript,
  } = usePythonStore();

  const [editingName, setEditingName] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [showMenu, setShowMenu] = useState<string | null>(null);

  // Handle script loading
  const handleLoadScript = (script: PythonScript) => {
    loadScript(script.id);
    setShowMenu(null);
  };

  // Handle script deletion
  const handleDeleteScript = (scriptId: string) => {
    if (confirm('Are you sure you want to delete this script?')) {
      deleteScript(scriptId);
    }
    setShowMenu(null);
  };

  // Handle script duplication
  const handleDuplicateScript = (scriptId: string) => {
    duplicateScript(scriptId);
    setShowMenu(null);
  };

  // Handle script export
  const handleExportScript = (script: PythonScript) => {
    try {
      const exportData = exportScript(script.id);
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${script.name.replace(/[^a-z0-9]/gi, '_')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
    setShowMenu(null);
  };

  // Handle script import
  const handleImportScript = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    importScript(file).catch((error) => {
      console.error('Import failed:', error);
      alert('Failed to import script: ' + error.message);
    });

    // Reset file input
    event.target.value = '';
  };

  // Handle renaming
  const startRenaming = (script: PythonScript) => {
    setEditingName(script.id);
    setNewName(script.name);
    setShowMenu(null);
  };

  const saveRename = (scriptId: string) => {
    const script = savedScripts.find(s => s.id === scriptId);
    if (script && newName.trim()) {
      // Create updated script with new name
      const updatedScript: PythonScript = {
        ...script,
        name: newName.trim(),
        updatedAt: new Date(),
      };
      
      // Update the savedScripts directly in the store
      const updatedSavedScripts = savedScripts.map(s => 
        s.id === scriptId ? updatedScript : s
      );
      
      // Update store state
      usePythonStore.setState({ 
        savedScripts: updatedSavedScripts,
        // Also update currentScript if this is the current one
        currentScript: currentScript?.id === scriptId ? updatedScript : currentScript
      });
    }
    setEditingName(null);
    setNewName('');
  };

  const cancelRename = () => {
    setEditingName(null);
    setNewName('');
  };

  return {
    // State
    editingName,
    newName,
    showMenu,
    
    // Setters
    setNewName,
    setShowMenu,
    
    // Handlers
    handleLoadScript,
    handleDeleteScript,
    handleDuplicateScript,
    handleExportScript,
    handleImportScript,
    startRenaming,
    saveRename,
    cancelRename,
    
    // Data
    savedScripts,
    currentScript,
  };
};