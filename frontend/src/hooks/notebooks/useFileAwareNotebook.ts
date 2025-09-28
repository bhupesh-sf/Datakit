import { useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '@/store/appStore';
import { usePythonStore } from '@/store/pythonStore';
import { PythonCell } from '@/lib/python/types';
import { selectActiveFile } from '@/store/selectors/appSelectors';
import {
  generateFileSpecificTemplate,
  generateEmptyTemplate,
} from '@/lib/python/fileTemplates';

/**
 * Hook for managing file-aware notebook state
 * Handles saving cells, loading file-specific notebooks, and managing notebook history
 */
export const useFileAwareNotebook = () => {
  const activeFile = useAppStore(selectActiveFile);
  const updateFile = useAppStore((state) => state.updateFile);

  // Python store state
  const { cells } = usePythonStore();

  // Get the store's set function to update cells
  const setCells = useCallback((newCells: PythonCell[]) => {
    usePythonStore.setState({ cells: newCells });
  }, []);

  // Track the previous file ID to detect actual file changes
  const prevFileIdRef = useRef<string | null>(null);
  const isInitializedRef = useRef(false);

  // Initialize prevFileId on mount
  useEffect(() => {
    prevFileIdRef.current = activeFile?.id || null;
  }, []); // Only run once on mount

  // Get the current file's notebook cells
  const getFileNotebook = useCallback(() => {
    return activeFile?.notebookState?.cells || [];
  }, [activeFile?.notebookState?.cells]);

  // Save cells to file state
  const saveNotebookToFile = useCallback(
    (newCells: PythonCell[]) => {
      if (!activeFile) return;

      const currentNotebookState = activeFile.notebookState || {
        cells: [],
        lastExecutedAt: undefined,
      };

      updateFile(activeFile.id, {
        notebookState: {
          ...currentNotebookState,
          cells: newCells,
        },
      });
    },
    [activeFile, updateFile]
  );

  // Check if we've actually switched files
  const hasFileSwitched = useCallback(() => {
    const currentFileId = activeFile?.id || null;
    const switched = prevFileIdRef.current !== currentFileId;

    if (switched) {
      prevFileIdRef.current = currentFileId;
    }

    return switched;
  }, [activeFile?.id]);

  // Initialize notebook state for a file if it doesn't exist
  const initializeFileNotebook = useCallback(() => {
    if (
      !activeFile ||
      (activeFile.notebookState?.cells &&
        activeFile.notebookState.cells.length > 0)
    ) {
      console.log(
        '[useFileAwareNotebook] Skipping initialization - file exists with cells:',
        activeFile?.notebookState?.cells?.length || 0
      );
      return;
    }

    console.log(
      '[useFileAwareNotebook] Initializing notebook for file:',
      activeFile.fileName,
      'with table:',
      activeFile.tableName
    );

    // Generate a template based on the file
    const template = activeFile.tableName
      ? generateFileSpecificTemplate(activeFile.tableName, activeFile.fileName)
      : generateEmptyTemplate();

    console.log(
      '[useFileAwareNotebook] Generated template with',
      template.length,
      'cells'
    );

    updateFile(activeFile.id, {
      notebookState: {
        cells: template,
        lastExecutedAt: undefined,
      },
    });

    // Update the current cells in Python store and ref
    setCells(template);
    cellsRef.current = template;
  }, [activeFile, updateFile, setCells]);

  // Handle file switching - load file-specific notebook
  useEffect(() => {
    if (hasFileSwitched()) {
      // Prevent auto-save during file switching
      isInitializedRef.current = false;

      if (
        activeFile?.notebookState?.cells &&
        activeFile.notebookState.cells.length > 0
      ) {
        // Load the file's saved notebook
        setCells(activeFile.notebookState.cells);
        cellsRef.current = activeFile.notebookState.cells;
      } else if (activeFile) {
        // Initialize new notebook for this file
        initializeFileNotebook();
      } else {
        // No active file - use empty template
        const emptyTemplate = generateEmptyTemplate();
        setCells(emptyTemplate);
        cellsRef.current = emptyTemplate;
      }

      // Re-enable auto-save after a brief delay
      setTimeout(() => {
        isInitializedRef.current = true;
      }, 100);
    }
  }, [activeFile?.id, hasFileSwitched, setCells, initializeFileNotebook]);

  // Auto-save cells to file state when they change (with debounce and comparison)
  const cellsRef = useRef<PythonCell[]>([]);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSaveRef = useRef<number>(0);

  useEffect(() => {
    // Skip initial mount, when no file is active, or during initialization
    if (!isInitializedRef.current || !activeFile) {
      // Update ref without saving to prevent loops
      cellsRef.current = cells;
      return;
    }

    // Skip if cells are empty (likely during loading)
    if (cells.length === 0) {
      return;
    }

    // Check if cells actually changed (compare essential properties only)
    const currentCellsData = cells.map((c) => ({
      id: c.id,
      code: c.code?.trim() || '',
      type: c.type,
    }));

    const previousCellsData = cellsRef.current.map((c) => ({
      id: c.id,
      code: c.code?.trim() || '',
      type: c.type,
    }));

    const cellsChanged =
      JSON.stringify(currentCellsData) !== JSON.stringify(previousCellsData);

    if (cellsChanged) {
      cellsRef.current = [...cells]; // Create a copy to avoid reference issues

      // Debounce the save to avoid too many updates
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Prevent rapid consecutive saves
      const now = Date.now();
      const timeSinceLastSave = now - lastSaveRef.current;
      const delay = timeSinceLastSave < 1000 ? 1000 : 500; // Longer delay if recent save

      saveTimeoutRef.current = setTimeout(() => {
        lastSaveRef.current = Date.now();
        saveNotebookToFile(cells);
      }, delay);
    }
  }, [cells, activeFile?.id, saveNotebookToFile]); // Only depend on file ID, not the whole file object

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Update execution timestamp
  const updateLastExecutedAt = useCallback(() => {
    if (!activeFile) return;

    const currentNotebookState = activeFile.notebookState || {
      cells: [],
      lastExecutedAt: undefined,
    };

    updateFile(activeFile.id, {
      notebookState: {
        ...currentNotebookState,
        lastExecutedAt: Date.now(),
      },
    });
  }, [activeFile, updateFile]);

  return {
    fileNotebook: getFileNotebook(),
    saveNotebookToFile,
    hasFileSwitched,
    initializeFileNotebook,
    updateLastExecutedAt,
    activeFile,
  };
};
