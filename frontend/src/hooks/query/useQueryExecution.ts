import { useState, useCallback, useEffect } from 'react';
import { useDuckDBStore } from '@/store/duckDBStore';
import { useAppStore } from '@/store/appStore';

interface QueryExecutionResult {
  // Data state
  results: unknown[] | null;
  columns: string[] | null;
  error: string | null;
  executionTime: number | null;
  
  // Pagination state
  totalRows: number;
  currentPage: number;
  totalPages: number;
  rowsPerPage: number;
  
  // Loading states
  isLoading: boolean;
  isChangingPage: boolean;
  
  // Large dataset warning
  showLargeDataWarning: boolean;
  
  // Functions
  executeQuery: () => Promise<void>;
  changePage: (newPage: number) => Promise<void>;
  changeRowsPerPage: (newRowsPerPage: number) => Promise<void>;
  optimizeQuery: () => void;
  dismissWarning: () => void;
  clearResults: () => void;
}

interface UseQueryExecutionOptions {
  initialRowsPerPage?: number;
  largeDatasetThreshold?: number;
}

/**
 * Custom hook for executing SQL queries with pagination and error handling
 * 
 * @param query - The SQL query to execute
 * @param setQuery - Function to update the query
 * @param activeFile - The currently active file for updating lastExecutedQuery
 * @param options - Configuration options
 * @returns State and functions for query execution and navigation
 */
export const useQueryExecution = (
  query: string,
  setQuery: (query: string) => void,
  activeFile: any = null,
  options: UseQueryExecutionOptions = {}
): QueryExecutionResult => {
  const { 
    initialRowsPerPage = 100,
    largeDatasetThreshold = 10000 
  } = options;
  
  // External store access
  const { 
    executePaginatedQuery, 
    isLoading: duckDBLoading,
    motherDuckConnected,
    isMotherDuckQuery 
  } = useDuckDBStore();
  
  const { addRecentQuery } = useAppStore();
  
  // Query result state
  const [results, setResults] = useState<any[] | null>(null);
  const [columns, setColumns] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  
  // Pagination state
  const [totalRows, setTotalRows] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(initialRowsPerPage);
  
  // UI state
  const [isChangingPage, setIsChangingPage] = useState<boolean>(false);
  const [showLargeDataWarning, setShowLargeDataWarning] = useState<boolean>(false);
  
  /**
   * Check if a query will potentially return a large dataset
   */
  const isLargeDataQuery = useCallback((sql: string): boolean => {
    const normalizedSql = sql.trim().toLowerCase();
    const hasNoLimit = !normalizedSql.includes('limit');
    const hasSelectAll = normalizedSql.includes('select *');
    
    return hasSelectAll && hasNoLimit;
  }, []);
  
  /**
   * Add a LIMIT clause to a query if it doesn't already have one
   */
  const addLimitToQuery = useCallback((sql: string, limit: number = 1000): string => {
    const normalizedSql = sql.trim();
    if (!normalizedSql.toLowerCase().includes('limit')) {
      return `${normalizedSql} LIMIT ${limit}`;
    }
    return sql;
  }, []);
  
  // Remove local isMotherDuckQuery function - now using the one from duckDBStore
  
  /**
   * Execute the current query
   */
  const executeQuery = useCallback(async () => {
    if (!query.trim()) {
      setError('Please enter a query');
      return;
    }
    
    // Check if it's a MotherDuck query but not connected
    const queryAnalysis = isMotherDuckQuery(query);
    if (queryAnalysis.isMotherDuck && !motherDuckConnected) {
      setError('This query targets MotherDuck tables, but MotherDuck is not connected. Please connect first.');
      return;
    }
    
    try {
      // Reset state
      setError(null);
      setResults(null);
      setColumns(null);
      setExecutionTime(null);
      setCurrentPage(1);
      setIsChangingPage(false);
      
      
      console.log(`[useQueryExecution] Executing query (page: 1, size: ${rowsPerPage})`);
      const paginatedResult = await executePaginatedQuery(query, 1, rowsPerPage);
    
      if (paginatedResult) {
        try {
          console.log(`[useQueryExecution] Query returned ${paginatedResult.totalRows} total rows`);
          console.log(`[useQueryExecution] Current page has ${paginatedResult.data.length} rows`);
          
          // Set pagination metadata
          setTotalRows(paginatedResult.totalRows);
          setTotalPages(paginatedResult.totalPages);
          
          // Set data
          setResults(paginatedResult.data);
          setColumns(paginatedResult.columns);
          setExecutionTime(paginatedResult.queryTime);
          
          // Add to recent queries
          addRecentQuery(query);
          
          console.log('[useQueryExecution] About to update lastExecutedQuery for draft tracking');
          console.log('[useQueryExecution] Received activeFile:', !!activeFile, activeFile?.id, activeFile?.fileName);
          
          // Update the file's lastExecutedQuery for draft tracking
          const { updateFile } = useAppStore.getState();
          if (activeFile) {
            const currentSqlState = activeFile.sqlState || {
              query: '',
              history: [],
              lastExecutedAt: undefined,
            };
            
            console.log('[useQueryExecution] About to update lastExecutedQuery:', {
              query: query,
              queryLength: query.length,
              queryPreview: query.substring(0, 100),
              fileId: activeFile.id
            });
            
            updateFile(activeFile.id, {
              sqlState: {
                ...currentSqlState,
                query: query,  // Update the main query field to match what was executed
                lastExecutedQuery: query,
                lastExecutedAt: Date.now(),
              },
            });
            
            // Sync the current query state with what was executed
            // This ensures the "current" query IS the executed query
            setQuery(query);
            
            console.log('[useQueryExecution] Successfully updated lastExecutedQuery and synced current query');
          } else {
            console.log('[useQueryExecution] No activeFile found for updating lastExecutedQuery');
          }
        } catch (error) {
          console.error('[useQueryExecution] Error in success block:', error);
        }
      } else {
        // Reset state on empty result
        setResults([]);
        setColumns([]);
        setTotalRows(0);
        setTotalPages(0);
      }
    } catch (err) {
      console.error("[useQueryExecution] Query execution error:", err);
      
      let errorMessage = err instanceof Error ? err.message : "Unknown error executing query";
      
      // Enhanced error messages for common issues
      if (errorMessage.includes('syntax error at or near "LIMIT"')) {
        errorMessage = 'SQL syntax error: Invalid LIMIT clause. Please check your query syntax.';
      } else if (errorMessage.includes('not connected')) {
        errorMessage = 'Database connection lost. Please refresh and try again.';
      }
      
      setError(errorMessage);
      setResults(null);
      setColumns(null);
      setTotalRows(0);
      setTotalPages(0);
    }
  }, [query, rowsPerPage, executePaginatedQuery, addRecentQuery, isLargeDataQuery, isMotherDuckQuery, motherDuckConnected]);
  
  /**
   * Change to a different page of results
   */
  const changePage = useCallback(async (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage) return;
    
    try {
      setError(null);
      setIsChangingPage(true);
      
      console.log(`[useQueryExecution] Changing to page ${newPage}`);
      const paginatedResult = await executePaginatedQuery(query, newPage, rowsPerPage);
      
      if (paginatedResult) {
        console.log(`[useQueryExecution] Page ${newPage} has ${paginatedResult.data.length} rows`);
        
        // Update just the current page data
        setResults(paginatedResult.data);
        setCurrentPage(newPage);
      }
    } catch (err) {
      console.error("[useQueryExecution] Page change error:", err);
      setError(err instanceof Error ? err.message : "Error fetching page data");
    } finally {
      setIsChangingPage(false);
    }
  }, [query, rowsPerPage, currentPage, totalPages, executePaginatedQuery]);
  
  /**
   * Change the number of rows per page
   */
  const changeRowsPerPage = useCallback(async (newRowsPerPage: number) => {
    try {
      setError(null);
      setIsChangingPage(true);
      
      console.log(`[useQueryExecution] Changing rows per page to ${newRowsPerPage}`);
      const paginatedResult = await executePaginatedQuery(query, 1, newRowsPerPage);
      
      if (paginatedResult) {
        console.log(`[useQueryExecution] First page now has ${paginatedResult.data.length} rows`);
        
        // Update data and pagination state
        setResults(paginatedResult.data);
        setColumns(paginatedResult.columns);
        setRowsPerPage(newRowsPerPage);
        setTotalPages(paginatedResult.totalPages);
        setCurrentPage(1);
      }
    } catch (err) {
      console.error("[useQueryExecution] Rows per page change error:", err);
      setError(err instanceof Error ? err.message : "Error changing results per page");
    } finally {
      setIsChangingPage(false);
    }
  }, [query, executePaginatedQuery]);
  
  /**
   * Add a LIMIT clause to optimize the query
   */
  const optimizeQuery = useCallback(() => {
    const optimizedQuery = addLimitToQuery(query);
    setQuery(optimizedQuery);
    setShowLargeDataWarning(false);
  }, [query, setQuery, addLimitToQuery]);
  
  /**
   * Dismiss the large dataset warning
   */
  const dismissWarning = useCallback(() => {
    setShowLargeDataWarning(false);
  }, []);

  /**
   * Clear all query results (useful when switching files)
   */
  const clearResults = useCallback(() => {
    setResults(null);
    setColumns(null);
    setError(null);
    setExecutionTime(null);
    setTotalRows(0);
    setCurrentPage(1);
    setTotalPages(0);
    setShowLargeDataWarning(false);
  }, []);
  
  // Update warning if result set is particularly large
  useEffect(() => {
    if (totalRows > largeDatasetThreshold) {
      setShowLargeDataWarning(true);
    }
  }, [totalRows, largeDatasetThreshold]);
  
  return {
    // Data
    results,
    columns,
    error,
    executionTime,
    
    // Pagination
    totalRows,
    currentPage, 
    totalPages,
    rowsPerPage,
    
    // Loading states
    isLoading: duckDBLoading,
    isChangingPage,
    
    // Warnings
    showLargeDataWarning,
    
    // Functions
    executeQuery,
    changePage,
    changeRowsPerPage,
    optimizeQuery,
    dismissWarning,
    clearResults
  };
};