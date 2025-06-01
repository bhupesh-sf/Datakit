import { useState, useEffect, useCallback } from "react";

import { useDuckDBStore } from "@/store/duckDBStore";

export interface TableColumn {
  name: string;
  type: string;
}

export interface TableSchema {
  name?: string;
  columns: TableColumn[] | null;
}

/**
 * Hook for managing DuckDB table schemas with caching
 */
export const useSchemaInfo = (tableName?: string) => {
  const [schema, setSchema] = useState<{ name: string; type: string }[] | null>(
    null
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const { getTableSchema } = useDuckDBStore();

  const fetchSchema = useCallback(
    async (table: string) => {
      if (!table) return;

      setIsLoading(true);
      try {
        const result = await getTableSchema(table);
        setSchema(result);
      } catch (error) {
        console.error("Failed to fetch table schema:", error);
        setSchema(null);
      } finally {
        setIsLoading(false);
      }
    },
    [getTableSchema]
  );

  useEffect(() => {
    if (tableName) {
      fetchSchema(tableName);
    } else {
      setSchema(null);
    }
  }, [tableName, fetchSchema]);

  return {
    name: tableName,
    tableSchema: schema,
    isLoading,
    refetch: () => tableName && fetchSchema(tableName),
  };
};
