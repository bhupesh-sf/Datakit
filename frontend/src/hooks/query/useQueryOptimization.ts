import { useState, useCallback } from 'react';

export interface QueryOptimizationSuggestion {
  id: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  fix?: () => string;  // Returns the modified query when applied
}

export interface QueryOptimization {
  // State
  suggestions: QueryOptimizationSuggestion[];
  hasWarnings: boolean;
  hasCriticalIssues: boolean;
  
  // Actions
  analyzeQuery: (query: string) => void;
  applySuggestion: (id: string, currentQuery: string) => string;
  clearSuggestions: () => void;
  optimizeQuery: (query: string) => string;
}

/**
 * Custom hook for analyzing SQL queries and providing optimization suggestions
 */
export const useQueryOptimization = (): QueryOptimization => {
  const [suggestions, setSuggestions] = useState<QueryOptimizationSuggestion[]>([]);
  const [hasWarnings, setHasWarnings] = useState<boolean>(false);
  const [hasCriticalIssues, setHasCriticalIssues] = useState<boolean>(false);
  
  /**
   * Check for missing LIMIT clause
   */
  const checkMissingLimit = useCallback((query: string): QueryOptimizationSuggestion | null => {
    const normalizedQuery = query.trim().toLowerCase();
    
    // If it's a SELECT query without LIMIT
    if (normalizedQuery.startsWith('select') && !normalizedQuery.includes('limit')) {
      return {
        id: 'missing-limit',
        message: 'This query has no LIMIT clause, which could return a large result set',
        severity: 'warning',
        fix: () => `${query.trim()} LIMIT 1000`
      };
    }
    
    return null;
  }, []);
  
  /**
   * Check for SELECT * usage
   */
  const checkSelectStar = useCallback((query: string): QueryOptimizationSuggestion | null => {
    const normalizedQuery = query.trim().toLowerCase();
    
    // If it's using SELECT *
    if (normalizedQuery.includes('select *')) {
      return {
        id: 'select-star',
        message: 'Using SELECT * can be inefficient. Consider selecting only needed columns',
        severity: 'info',
        // No automatic fix for this one, requires manual column selection
      };
    }
    
    return null;
  }, []);
  
  /**
   * Check for WHERE clause in large tables
   */
  const checkMissingWhere = useCallback((query: string): QueryOptimizationSuggestion | null => {
    const normalizedQuery = query.trim().toLowerCase();
    
    // If it's a SELECT without WHERE but has ORDER BY or GROUP BY (suggesting a larger operation)
    if (normalizedQuery.startsWith('select') && 
        !normalizedQuery.includes('where') && 
        (normalizedQuery.includes('order by') || normalizedQuery.includes('group by'))) {
      return {
        id: 'missing-where',
        message: 'This query lacks a WHERE clause but has sorting/grouping which could be inefficient',
        severity: 'warning',
      };
    }
    
    return null;
  }, []);
  
  /**
   * Analyze a query for optimization opportunities
   */
  const analyzeQuery = useCallback((query: string) => {
    if (!query.trim()) {
      setSuggestions([]);
      setHasWarnings(false);
      setHasCriticalIssues(false);
      return;
    }
    
    const newSuggestions: QueryOptimizationSuggestion[] = [];
    
    // Run all checks
    const limitCheck = checkMissingLimit(query);
    if (limitCheck) newSuggestions.push(limitCheck);
    
    const starCheck = checkSelectStar(query);
    if (starCheck) newSuggestions.push(starCheck);
    
    const whereCheck = checkMissingWhere(query);
    if (whereCheck) newSuggestions.push(whereCheck);
    
    // Update state
    setSuggestions(newSuggestions);
    
    // Check for warnings or critical issues
    const warnings = newSuggestions.some(s => s.severity === 'warning');
    const critical = newSuggestions.some(s => s.severity === 'critical');
    
    setHasWarnings(warnings);
    setHasCriticalIssues(critical);
    
  }, [checkMissingLimit, checkSelectStar, checkMissingWhere]);
  
  /**
   * Apply a specific suggestion to modify the query
   */
  const applySuggestion = useCallback((id: string, currentQuery: string): string => {
    const suggestion = suggestions.find(s => s.id === id);
    
    if (suggestion?.fix) {
      return suggestion.fix();
    }
    
    return currentQuery;
  }, [suggestions]);
  
  /**
   * Clear all suggestions
   */
  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
    setHasWarnings(false);
    setHasCriticalIssues(false);
  }, []);
  
  /**
   * Apply automatic optimizations to a query
   */
  const optimizeQuery = useCallback((query: string): string => {
    let optimizedQuery = query;
    
    // Apply the most important fix first - add LIMIT if missing
    const limitSuggestion = checkMissingLimit(query);
    if (limitSuggestion && limitSuggestion.fix) {
      optimizedQuery = limitSuggestion.fix();
    }
    
    return optimizedQuery;
  }, [checkMissingLimit]);
  
  return {
    suggestions,
    hasWarnings,
    hasCriticalIssues,
    analyzeQuery,
    applySuggestion,
    clearSuggestions,
    optimizeQuery
  };
};