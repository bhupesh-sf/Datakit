import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAppStore } from '@/store/appStore';
import { useDuckDBStore } from '@/store/duckDBStore';

export interface TableColumn {
  name: string;
  type: string;
}

export interface TableSchema {
  name: string;
  columns: TableColumn[];
}

export function useSchemaInfo() {
  const { tableName, inDuckDB } = useAppStore();
  const { getTableSchema, getAvailableTables } = useDuckDBStore();
  const [schemaData, setSchemaData] = useState<{
    schema: TableSchema[],
    isLoading: boolean,
    error: string | null
  }>({
    schema: [],
    isLoading: false,
    error: null
  });

  // Memoize the functions to ensure they don't change on every render
  const fetchSchema = useCallback(async () => {
    if (!inDuckDB) {
      setSchemaData({
        schema: [],
        isLoading: false,
        error: null
      });
      return;
    }

    setSchemaData(prev => ({
      ...prev,
      isLoading: true,
      error: null
    }));

    try {
      // Get available tables
      const availableTables = getAvailableTables();
      
      if (availableTables.length === 0) {
        setSchemaData({
          schema: [],
          isLoading: false,
          error: null
        });
        return;
      }

      // Use the current table if available, otherwise use the first table
      const targetTable = tableName && availableTables.includes(tableName) 
        ? tableName 
        : availableTables[0];
      
      // Get schema for the current table
      const schema = await getTableSchema(targetTable);
      
      if (schema) {
        setSchemaData({
          schema: [{
            name: targetTable,
            columns: schema.map(col => ({
              name: col.name,
              type: col.type
            }))
          }],
          isLoading: false,
          error: null
        });
      } else {
        setSchemaData({
          schema: [],
          isLoading: false,
          error: null
        });
      }
    } catch (err) {
      console.error('Error fetching schema info:', err);
      setSchemaData({
        schema: [],
        isLoading: false,
        error: `Failed to load schema: ${err instanceof Error ? err.message : String(err)}`
      });
    }
  }, [tableName, inDuckDB, getTableSchema, getAvailableTables]);

  // Fetch schema data when dependencies change
  useEffect(() => {
    fetchSchema();
  }, [fetchSchema]);

  // Return memoized values
  return useMemo(() => ({
    tableSchema: schemaData.schema,
    isLoading: schemaData.isLoading,
    error: schemaData.error
  }), [schemaData]);
}