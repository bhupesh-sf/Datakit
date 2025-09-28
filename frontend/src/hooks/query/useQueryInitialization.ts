import { useState, useEffect, useCallback } from "react";

import { useDuckDBStore } from "@/store/duckDBStore";
import { useAppStore } from "@/store/appStore";
import {
  selectCanExecuteQueries,
  selectHasUserTables,
  selectIsInitializing,
  selectIsInitialized,
  selectError,
  selectHasSampleTable,
  selectSampleTableName,
} from "@/store/selectors/duckdbSelectors";
import { selectTableName, selectActiveFile } from "@/store/selectors/appSelectors";
import { DataFile } from "@/types/multiFile";

/**
 * Interface for SQL state stored in file
 */
interface FileSqlState {
  query: string;
  lastExecutedQuery?: string;
  history: Array<{
    id: string;
    query: string;
    timestamp: number;
    executionTime?: number;
  }>;
  lastExecutedAt?: number;
}

/**
 * Return type for useFileAwareQuery hook
 */
interface UseFileAwareQueryReturn {
  /** Current SQL query text */
  query: string;
  /** Function to update the query */
  setQuery: (query: string) => void;
  /** Whether current query differs from saved state */
  hasUnsavedChanges: boolean;
  /** Simple dirty flag - true if user has typed since last clean state */
  isDirty: boolean;
  /** Save current query to file state */
  saveCurrentQuery: () => void;
  /** Load query from specific file */
  loadQueryFromFile: (file: DataFile) => void;
  /** Initialize file if it doesn't have SQL state */
  initializeFileIfNeeded: (file: DataFile) => void;
  /** Whether queries can be executed (DuckDB ready) */
  canExecuteQueries: boolean;
  /** Whether user has uploaded tables */
  hasUserTables: boolean;
  /** Function to add query to file's history */
  addToHistory: (queryText: string, executionTime?: number) => void;
  /** Mark query as clean (not dirty) */
  markAsClean: () => void;
  /** Set query and mark as dirty */
  setQueryAndMarkDirty: (query: string) => void;
  /** Get default sample table query when no files are active */
  getDefaultQuery: () => string;
  /** Currently active file */
  activeFile: DataFile | null;
}

export const useFileAwareQuery = (): UseFileAwareQueryReturn => {
  // === STATE ===
  const [query, setQuery] = useState<string>("");
  const [savedQuery, setSavedQuery] = useState<string>(""); // Track what's saved
  const [isDirty, setIsDirty] = useState<boolean>(false); // Simple dirty tracking

  // === EXTERNAL STATE ===
  const canExecuteQueries = useDuckDBStore(selectCanExecuteQueries);
  const hasUserTables = useDuckDBStore(selectHasUserTables);
  const hasSampleTable = useDuckDBStore(selectHasSampleTable);
  const sampleTableName = useDuckDBStore(selectSampleTableName);
  const activeFile = useAppStore(selectActiveFile);
  const updateFile = useAppStore((state) => state.updateFile);
  const tableName = useAppStore(selectTableName);

  // === UTILITY FUNCTIONS ===
  
  /**
   * Creates default SQL state for a new file
   */
  const createDefaultSqlState = useCallback((fileName: string, tableName: string): FileSqlState => {
    const defaultQuery = `-- Query data from ${fileName || 'your file'}
-- Modify this query to explore your data
SELECT * FROM "${tableName}" LIMIT 100;`;

    return {
      query: defaultQuery,
      history: [],
      lastExecutedAt: undefined,
    };
  }, []);

  /**
   * Creates default sample table query when no files are loaded
   */
  const createSampleTableQuery = useCallback((): string => {
    if (hasSampleTable) {
      return `-- Sample employee data is available for testing
-- Import your own files to query your data
SELECT *
FROM "${sampleTableName}"
LIMIT 10;`;
    }
    return `-- Import your own CSV, JSON, or Parquet files to get started
-- Your data will appear here once loaded`;
  }, [hasSampleTable, sampleTableName]);

  // === IMPERATIVE API ===

  /**
   * Save current query to the active file's state
   */
  const saveCurrentQuery = useCallback((): void => {
    if (!activeFile || !query.trim()) return;
    
    const currentSqlState = activeFile.sqlState || createDefaultSqlState(activeFile.fileName, tableName || 'unknown');
    
    // Only save if different
    if (query !== currentSqlState.query) {
      console.log(`[FileAwareQuery] Saving query to file: ${activeFile.fileName}`);
      updateFile(activeFile.id, {
        sqlState: {
          ...currentSqlState,
          query: query,
        },
      });
      setSavedQuery(query); // Track what we saved
    }
  }, [activeFile, query, createDefaultSqlState, updateFile, tableName]);

  /**
   * Initialize file SQL state if it doesn't exist
   */
  const initializeFileIfNeeded = useCallback((file: DataFile): void => {
    if (file.sqlState || !tableName) return;
    
    const defaultState = createDefaultSqlState(file.fileName, tableName);
    console.log(`[FileAwareQuery] Initializing SQL state for: ${file.fileName}`);
    updateFile(file.id, { sqlState: defaultState });
  }, [createDefaultSqlState, updateFile, tableName]);

  /**
   * Load query from a specific file's state
   */
  const loadQueryFromFile = useCallback((file: DataFile): void => {
    // Initialize if needed
    initializeFileIfNeeded(file);
    
    // Get fresh file state after potential initialization
    const freshFile = useAppStore.getState().files.find(f => f.id === file.id);
    const savedQuery = freshFile?.sqlState?.query;
    
    if (savedQuery && savedQuery.trim()) {
      console.log(`[FileAwareQuery] Loading query for: ${file.fileName}`);
      setQuery(savedQuery);
      setSavedQuery(savedQuery); // Track what's saved
      markAsClean(); // Mark as clean after loading
    }
  }, [initializeFileIfNeeded]);

  /**
   * Add a query to the file's execution history
   */
  const addToHistory = useCallback((queryText: string, executionTime?: number) => {
    if (!activeFile || !queryText.trim()) return;
    
    const currentSqlState = activeFile.sqlState || createDefaultSqlState(activeFile.fileName, tableName || 'unknown');
    
    const historyEntry = {
      id: `query-${Date.now()}`,
      query: queryText.trim(),
      timestamp: Date.now(),
      executionTime,
    };
    
    const updatedHistory = [historyEntry, ...currentSqlState.history].slice(0, 50);
    
    updateFile(activeFile.id, {
      sqlState: {
        ...currentSqlState,
        history: updatedHistory,
        lastExecutedAt: Date.now(),
      },
    });
  }, [activeFile, createDefaultSqlState, updateFile, tableName]);

  // === COMPUTED VALUES ===

  /**
   * Mark query as clean (not dirty) - used after execution, save, or load
   */
  const markAsClean = useCallback((): void => {
    setIsDirty(false);
  }, []);

  /**
   * Custom setQuery that marks as dirty when user types
   */
  const setQueryAndMarkDirty = useCallback((newQuery: string): void => {
    setQuery(newQuery);
    setIsDirty(true); // Mark as dirty whenever user changes the query
  }, []);

  /**
   * Whether current query differs from what's saved
   */
  const hasUnsavedChanges = query.trim() !== savedQuery.trim();


  return {
    query,
    setQuery,
    hasUnsavedChanges,
    isDirty,
    saveCurrentQuery,
    loadQueryFromFile,
    initializeFileIfNeeded,
    canExecuteQueries,
    hasUserTables,
    addToHistory,
    markAsClean,
    setQueryAndMarkDirty,
    getDefaultQuery: createSampleTableQuery,
    activeFile,
  };
};

/**
 * Simple hook that orchestrates file switching for the query workspace.
 * 
 * This separates the file switching logic from the query management,
 * making it easier to reason about and debug.
 */
export const useFileAwareQueryOrchestrator = () => {
  const {
    query,
    setQuery,
    hasUnsavedChanges,
    isDirty,
    saveCurrentQuery,
    loadQueryFromFile,
    canExecuteQueries,
    hasUserTables,
    addToHistory,
    markAsClean,
    setQueryAndMarkDirty,
    getDefaultQuery,
    activeFile
  } = useFileAwareQuery();
  
  const [lastFileId, setLastFileId] = useState<string | null>(null);
  const tableName = useAppStore(selectTableName);

  /**
   * Handle file switching and default query loading
   */
  useEffect(() => {
    // If no active file, load default sample table query only once
    if (!activeFile) {
      if (lastFileId !== null) {
        // Only set default query when transitioning from having a file to no file
        const defaultQuery = getDefaultQuery();
        if (defaultQuery) {
          console.log('[FileOrchestrator] Loading default sample table query');
          setQuery(defaultQuery);
          markAsClean();
        }
      }
      setLastFileId(null);
      return;
    }

    // If we don't have a table name yet, don't proceed
    if (!tableName) return;
    
    const currentFileId = activeFile.id;
    
    // If switching to a different file
    if (lastFileId && lastFileId !== currentFileId) {
      console.log(`[FileOrchestrator] Switching from ${lastFileId} to ${currentFileId}`);
      // We don't auto-save here - let the component decide when to save
    }
    
    // If this is a new file (first load or different file)
    if (lastFileId !== currentFileId) {
      console.log(`[FileOrchestrator] Loading file: ${activeFile.fileName}`);
      loadQueryFromFile(activeFile);
    }
    
    setLastFileId(currentFileId);
  }, [activeFile?.id, tableName, loadQueryFromFile, lastFileId, getDefaultQuery, query, setQuery, markAsClean]);


  return {
    query,
    setQuery,
    hasUnsavedChanges,
    isDirty,
    saveCurrentQuery,
    canExecuteQueries,
    hasUserTables,
    addToHistory,
    markAsClean,
    setQueryAndMarkDirty,
    getDefaultQuery,
    activeFile,
  };
};

/**
 * Hook for DuckDB initialization with error handling and retry functionality.
 */
export const useDuckDBInitialization = () => {
  const [initializationAttempted, setInitializationAttempted] = useState<boolean>(false);

  const isInitialized = useDuckDBStore(selectIsInitialized);
  const isInitializing = useDuckDBStore(selectIsInitializing);
  const error = useDuckDBStore(selectError);
  const { initialize, resetError } = useDuckDBStore();

  useEffect(() => {
    if (!isInitialized && !isInitializing && !initializationAttempted) {
      setInitializationAttempted(true);
      initialize().catch((err) => {
        console.error("DuckDB initialization failed:", err);
      });
    }
  }, [isInitialized, isInitializing, initializationAttempted, initialize]);

  const retry = useCallback(() => {
    resetError();
    setInitializationAttempted(false);
  }, [resetError]);

  return {
    isInitialized,
    isInitializing,
    error,
    retry,
  };
};

/**
 * Custom hook to handle pending queries from AI tab
 * This runs with high priority to ensure pending queries aren't overridden
 */
export const usePendingQuery = (setQuery: (query: string) => void) => {
  const { pendingQuery, setPendingQuery } = useAppStore();

  useEffect(() => {
    if (pendingQuery) {
      console.log('[PendingQuery] Setting pending query from AI tab:', pendingQuery.substring(0, 100) + '...');
      setQuery(pendingQuery);
      setPendingQuery(null);
      console.log('[PendingQuery] Pending query processed and cleared');
    }
  }, [pendingQuery, setPendingQuery, setQuery]);
};