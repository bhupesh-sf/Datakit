import { useState, useCallback, useEffect } from 'react';
import { useDuckDBStore } from '@/store/duckDBStore';
import { useAppStore } from '@/store/appStore';
import { useDataPreviewStore } from '@/store/dataPreviewStore';
import { selectActiveFile } from '@/store/selectors/appSelectors';

interface DataPreviewResult {
  // Data state
  results: string[][] | null;
  columns: string[] | null;
  error: string | null;
  
  // Pagination state
  totalRows: number;
  currentPage: number;
  totalPages: number;
  rowsPerPage: number;
  
  // Loading states
  isLoading: boolean;
  isChangingPage: boolean;
  isCountLoading: boolean;
  
  // Functions
  loadInitialData: () => Promise<void>;
  changePage: (newPage: number) => Promise<void>;
  changeRowsPerPage: (newRowsPerPage: number) => Promise<void>;
  refreshData: () => Promise<void>;
}

/**
 * Custom hook for data preview with pagination
 * Follows the same pattern as useQueryExecution for consistency
 */
export const useDataPreview = (): DataPreviewResult => {
  const activeFile = useAppStore(selectActiveFile);
  const { executePaginatedQuery } = useDuckDBStore();
  
  const { 
    getFileState, 
    updateFileState, 
    initializeFileState 
  } = useDataPreviewStore();
  
  // Local loading state for page changes
  const [isChangingPage, setIsChangingPage] = useState(false);
  
  // Get or initialize file state
  const fileId = activeFile?.id || '';
  const fileState = getFileState(fileId) || {
    currentPage: 1,
    rowsPerPage: 1000,
    totalRows: 0,
    totalPages: 0,
    data: null,
    columns: null,
    isLoading: false,
    isCountLoading: false,
    error: null,
    lastFetchTime: 0,
  };
  
  // Initialize file state when active file changes
  useEffect(() => {
    if (activeFile?.id) {
      initializeFileState(activeFile.id);
    }
  }, [activeFile?.id, initializeFileState]);
  
  /**
   * Load initial data for the active file
   */
  const loadInitialData = useCallback(async () => {
    if (!activeFile?.tableName || !activeFile?.id) return;
    
    const existingState = getFileState(activeFile.id);
    
    // If we already have data cached and it's recent (< 5 minutes), use it
    if (existingState?.data && existingState.lastFetchTime > Date.now() - 5 * 60 * 1000) {
      console.log('[useDataPreview] Using cached data for file:', activeFile.fileName);
      return;
    }
    
    try {
      updateFileState(activeFile.id, { 
        isLoading: true, 
        error: null 
      });
      
      const tableName = activeFile.tableName;
      const query = `SELECT * FROM "${tableName}"`;
      
      console.log(`[useDataPreview] Loading initial data for ${tableName}`);
      
      // First, get the initial page of data quickly (NO COUNT for speed)
      const result = await executePaginatedQuery(
        query, 
        1, 
        fileState.rowsPerPage || 1000,
        true,  // applyPagination
        false  // countTotalRows - SKIP COUNT for instant loading!
      );
      
      if (result) {
        // Extract headers and data
        const headers = result.columns;
        const dataWithoutHeaders = result.data;
        
        // Convert objects to string arrays (DuckDB returns objects, Grid expects string[][])
        const dataWithRowNumbers = dataWithoutHeaders.map((rowObj, index) => {
          // Convert object to array of strings in the same order as headers
          const rowArray = headers.map(header => String(rowObj[header] || ''));
          return [(index + 1).toString(), ...rowArray];
        });
        
        // Add header row with row number column
        const fullData = [
          [' ', ...headers],
          ...dataWithRowNumbers
        ];
        
        updateFileState(activeFile.id, {
          data: fullData,
          columns: headers,
          totalRows: 0, // We'll get this from background count
          totalPages: 0, // We'll calculate this when count completes
          currentPage: 1,
          isLoading: false,
          lastFetchTime: Date.now(),
        });
        
        // Start background count for exact totals (progressive loading)
        loadExactCount(activeFile.id, tableName);
      }
    } catch (err) {
      console.error('[useDataPreview] Error loading initial data:', err);
      updateFileState(activeFile.id, {
        error: err instanceof Error ? err.message : 'Failed to load data',
        isLoading: false,
      });
    }
  }, [activeFile, executePaginatedQuery, fileState.rowsPerPage, getFileState, updateFileState]);
  
  /**
   * Load exact row count in background (progressive loading)
   */
  const loadExactCount = useCallback(async (fileId: string, tableName: string) => {
    try {
      updateFileState(fileId, { isCountLoading: true });
      
      const countQuery = `SELECT COUNT(*) as total_rows FROM "${tableName}"`;
      console.log(`[useDataPreview] Getting exact count for ${tableName}`);
      
      const result = await executePaginatedQuery(
        countQuery, 
        1, 
        1,
        false, // no pagination for count query
        false  // no need to count the count query
      );
      
      if (result && result.data.length > 0) {
        const totalRows = Number(result.data[0].total_rows) || 0;
        const currentState = getFileState(fileId);
        const rowsPerPage = currentState?.rowsPerPage || 1000;
        
        updateFileState(fileId, {
          totalRows,
          totalPages: Math.ceil(totalRows / rowsPerPage),
          isCountLoading: false,
        });
      }
    } catch (err) {
      console.error('[useDataPreview] Error getting exact count:', err);
      updateFileState(fileId, { isCountLoading: false });
    }
  }, [executePaginatedQuery, getFileState, updateFileState]);
  
  /**
   * Change to a different page of results
   */
  const changePage = useCallback(async (newPage: number) => {
    if (!activeFile?.tableName || !activeFile?.id) return;
    
    const currentState = getFileState(activeFile.id);
    if (!currentState) return;
    
    if (newPage < 1 || newPage > currentState.totalPages || newPage === currentState.currentPage) {
      return;
    }
    
    try {
      setIsChangingPage(true);
      updateFileState(activeFile.id, { error: null });
      
      const tableName = activeFile.tableName;
      const query = `SELECT * FROM "${tableName}"`;
      
      console.log(`[useDataPreview] Changing to page ${newPage}`);
      
      const result = await executePaginatedQuery(
        query,
        newPage,
        currentState.rowsPerPage,
        true,  // applyPagination
        false  // don't count again, we already have it
      );
      
      if (result) {
        // Process data with row numbers - convert objects to string arrays
        const offset = (newPage - 1) * currentState.rowsPerPage;
        const dataWithRowNumbers = result.data.map((rowObj, index) => {
          const rowArray = result.columns.map(header => String(rowObj[header] || ''));
          return [(offset + index + 1).toString(), ...rowArray];
        });
        
        const fullData = [
          [' ', ...result.columns],
          ...dataWithRowNumbers
        ];
        
        updateFileState(activeFile.id, {
          data: fullData,
          currentPage: newPage,
          lastFetchTime: Date.now(),
        });
      }
    } catch (err) {
      console.error('[useDataPreview] Page change error:', err);
      updateFileState(activeFile.id, {
        error: err instanceof Error ? err.message : 'Error fetching page data',
      });
    } finally {
      setIsChangingPage(false);
    }
  }, [activeFile, executePaginatedQuery, getFileState, updateFileState]);
  
  /**
   * Change the number of rows per page
   */
  const changeRowsPerPage = useCallback(async (newRowsPerPage: number) => {
    if (!activeFile?.tableName || !activeFile?.id) return;
    
    try {
      setIsChangingPage(true);
      updateFileState(activeFile.id, { 
        error: null,
        rowsPerPage: newRowsPerPage 
      });
      
      const tableName = activeFile.tableName;
      const query = `SELECT * FROM "${tableName}"`;
      
      console.log(`[useDataPreview] Changing rows per page to ${newRowsPerPage}`);
      
      const result = await executePaginatedQuery(
        query, 
        1, 
        newRowsPerPage,
        true,  // applyPagination
        false  // don't recount, use existing count
      );
      
      if (result) {
        // Process data with row numbers - convert objects to string arrays
        const dataWithRowNumbers = result.data.map((rowObj, index) => {
          const rowArray = result.columns.map(header => String(rowObj[header] || ''));
          return [(index + 1).toString(), ...rowArray];
        });
        
        const fullData = [
          [' ', ...result.columns],
          ...dataWithRowNumbers
        ];
        
        const currentState = getFileState(activeFile.id);
        const existingTotalRows = currentState?.totalRows || 0;
        
        updateFileState(activeFile.id, {
          data: fullData,
          columns: result.columns,
          totalPages: existingTotalRows > 0 ? Math.ceil(existingTotalRows / newRowsPerPage) : 0,
          currentPage: 1,
          lastFetchTime: Date.now(),
        });
      }
    } catch (err) {
      console.error('[useDataPreview] Rows per page change error:', err);
      updateFileState(activeFile.id, {
        error: err instanceof Error ? err.message : 'Error changing results per page',
      });
    } finally {
      setIsChangingPage(false);
    }
  }, [activeFile, executePaginatedQuery, updateFileState]);
  
  /**
   * Refresh current page data
   */
  const refreshData = useCallback(async () => {
    if (!activeFile?.id) return;
    
    const currentState = getFileState(activeFile.id);
    if (!currentState) return;
    
    // Clear cache timestamp to force reload
    updateFileState(activeFile.id, { lastFetchTime: 0 });
    
    // Reload current page
    if (currentState.currentPage === 1) {
      await loadInitialData();
    } else {
      await changePage(currentState.currentPage);
    }
  }, [activeFile, getFileState, updateFileState, loadInitialData, changePage]);
  
  return {
    // Data
    results: fileState.data,
    columns: fileState.columns,
    error: fileState.error,
    
    // Pagination
    totalRows: fileState.totalRows || 0,
    currentPage: fileState.currentPage,
    totalPages: fileState.totalPages,
    rowsPerPage: fileState.rowsPerPage,
    
    // Loading states
    isLoading: fileState.isLoading,
    isChangingPage,
    isCountLoading: fileState.isCountLoading,
    
    // Functions
    loadInitialData,
    changePage,
    changeRowsPerPage,
    refreshData,
  };
};