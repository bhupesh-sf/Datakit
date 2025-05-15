import { useState, useCallback, useEffect } from 'react';
import { useAppStore } from '@/store/appStore';
import { SavedQuery } from '@/store/appStore';

interface QueryHistoryResult {
  // State
  recentQueries: SavedQuery[];
  savedQueries: SavedQuery[];
  isLoadingQueries: boolean;
  
  // Actions
  selectQuery: (query: string) => void;
  saveQuery: (query: string, name: string) => void;
  deleteQuery: (id: string) => void;
  addToRecentQueries: (query: string) => void;
}

/**
 * Custom hook for managing query history
 */
export const useQueryHistory = (
  onQuerySelect?: (query: string) => void
): QueryHistoryResult => {
  const { 
    recentQueries, 
    savedQueries,
    addRecentQuery,
    saveQuery: saveQueryToStore,
    deleteQuery: deleteQueryFromStore,
    loadQueriesFromStorage
  } = useAppStore();
  
  const [isLoadingQueries, setIsLoadingQueries] = useState<boolean>(false);
  
  // Load queries from storage on mount
  useEffect(() => {
    const loadQueries = async () => {
      setIsLoadingQueries(true);
      try {
        await loadQueriesFromStorage();
      } catch (error) {
        console.error('Error loading queries:', error);
      } finally {
        setIsLoadingQueries(false);
      }
    };
    
    loadQueries();
  }, [loadQueriesFromStorage]);
  
  /**
   * Handle query selection
   */
  const selectQuery = useCallback((query: string) => {
    if (onQuerySelect) {
      onQuerySelect(query);
    }
  }, [onQuerySelect]);
  
  /**
   * Save a query with a name
   */
  const saveQuery = useCallback((query: string, name: string) => {
    saveQueryToStore(query, name);
  }, [saveQueryToStore]);
  
  /**
   * Delete a query by ID
   */
  const deleteQuery = useCallback((id: string) => {
    deleteQueryFromStore(id);
  }, [deleteQueryFromStore]);
  
  /**
   * Add a query to recent history
   */
  const addToRecentQueries = useCallback((query: string) => {
    addRecentQuery(query);
  }, [addRecentQuery]);
  
  return {
    recentQueries,
    savedQueries,
    isLoadingQueries,
    selectQuery,
    saveQuery,
    deleteQuery,
    addToRecentQueries
  };
};