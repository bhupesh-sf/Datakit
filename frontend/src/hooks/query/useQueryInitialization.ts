import { useState, useEffect, useRef, useCallback } from "react";

import { useDuckDBStore } from "@/store/duckDBStore";
import {
  selectDefaultQuery,
  selectCanExecuteQueries,
  selectHasUserTables,
  selectIsInitializing,
  selectIsInitialized,
  selectError,
} from "@/store/selectors/duckdbSelectors";

/**
 * Custom hook that provides stable query state management
 */
export const useInitialQuery = () => {
  const [query, setQuery] = useState<string>("");
  const [hasInitialized, setHasInitialized] = useState<boolean>(false);

  // Get reactive state
  const defaultQuery = useDuckDBStore(selectDefaultQuery);
  const canExecuteQueries = useDuckDBStore(selectCanExecuteQueries);
  const hasUserTables = useDuckDBStore(selectHasUserTables);

  // Track previous values to detect meaningful changes
  const prevDefaultQuery = useRef<string>("");
  const prevHasUserTables = useRef<boolean>(false);

  // Stable setter that doesn't cause re-renders
  const stableSetQuery = useCallback((newQuery: string) => {
    setQuery(newQuery);
  }, []);

  // Update query only when significant changes occur
  useEffect(() => {
    const defaultQueryChanged = defaultQuery !== prevDefaultQuery.current;
    const userTablesChanged = hasUserTables !== prevHasUserTables.current;

    // Only update if:
    // 1. We haven't initialized yet, OR
    // 2. Default query changed meaningfully, OR
    // 3. User tables status changed (uploaded/removed files)
    if (!hasInitialized || defaultQueryChanged || userTablesChanged) {
      setQuery(defaultQuery);
      setHasInitialized(true);

      // Update refs
      prevDefaultQuery.current = defaultQuery;
      prevHasUserTables.current = hasUserTables;
    }
  }, [defaultQuery, hasUserTables, hasInitialized]);

  return {
    query,
    setQuery: stableSetQuery,
    canExecuteQueries,
    hasUserTables,
  };
};

/**
 * Hook for DuckDB initialization with error handling
 */
export const useDuckDBInitialization = () => {
  const [initializationAttempted, setInitializationAttempted] =
    useState<boolean>(false);

  const isInitialized = useDuckDBStore(selectIsInitialized);
  const isInitializing = useDuckDBStore(selectIsInitializing);
  const error = useDuckDBStore(selectError);
  const { initialize, resetError } = useDuckDBStore();

  // Initialize DuckDB on mount
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
