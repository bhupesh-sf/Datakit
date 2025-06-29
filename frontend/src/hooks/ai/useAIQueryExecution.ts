import { useCallback } from "react";
import { useAppStore } from "@/store/appStore";
import { useDuckDBStore } from "@/store/duckDBStore";

export const useAIQueryExecution = () => {
  const { setActiveTab } = useAppStore();
  const { executeQuery } = useDuckDBStore();

  const executeAIGeneratedSQL = useCallback(async (sql: string, switchToQueryTab = true) => {
    try {
      // Switch to query tab to show results
      if (switchToQueryTab) {
        setActiveTab('query');
      }

      // Execute the SQL query
      const result = await executeQuery(sql);
      
      return {
        success: true,
        result,
        message: 'Query executed successfully',
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      return {
        success: false,
        error: errorMessage,
        message: `Failed to execute query: ${errorMessage}`,
      };
    }
  }, [executeQuery, setActiveTab]);

  const previewSQL = useCallback(async (sql: string) => {
    try {
      // Add LIMIT 10 to preview the query safely
      const previewSQL = sql.trim().endsWith(';') 
        ? sql.slice(0, -1) + ' LIMIT 10;'
        : sql + ' LIMIT 10';

      const result = await executeQuery(previewSQL);
      
      return {
        success: true,
        result,
        previewSQL,
        message: 'Preview generated successfully (limited to 10 rows)',
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      return {
        success: false,
        error: errorMessage,
        message: `Failed to preview query: ${errorMessage}`,
      };
    }
  }, [executeQuery]);

  const validateSQL = useCallback(async (sql: string) => {
    try {
      // Try to execute with LIMIT 0 to validate syntax without returning data
      const validationSQL = sql.trim().endsWith(';') 
        ? sql.slice(0, -1) + ' LIMIT 0;'
        : sql + ' LIMIT 0';

      await executeQuery(validationSQL);
      
      return {
        isValid: true,
        message: 'SQL syntax is valid',
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      return {
        isValid: false,
        error: errorMessage,
        message: `SQL syntax error: ${errorMessage}`,
      };
    }
  }, [executeQuery]);

  return {
    executeAIGeneratedSQL,
    previewSQL,
    validateSQL,
  };
};