import { useState, useCallback } from 'react';
import { useAppStore } from '@/store/appStore';
import { useDuckDBStore } from '@/store/duckDBStore';
import { useFolderStore } from '@/store/folderStore';
import { ColumnType } from '@/types/csv';
import { DataSourceType } from '@/types/json';
import { convertDuckDBColumnTypes } from '@/lib/duckdb/ingestion/convertDuckDBColumnTypes';

/**
 * Detect column type from sample values
 */
const detectColumnType = (values: any[]): ColumnType => {
  // Sample up to 100 non-null values for type detection
  const sampleSize = Math.min(100, values.length);
  const sample = values.slice(0, sampleSize).filter(v => v !== null && v !== undefined && v !== '');
  
  if (sample.length === 0) {
    return ColumnType.Text;
  }
  
  // Check for boolean
  const isBool = sample.every(v => 
    typeof v === 'boolean' || 
    (typeof v === 'string' && (v.toLowerCase() === 'true' || v.toLowerCase() === 'false')) ||
    v === 0 || v === 1
  );
  if (isBool) {
    return ColumnType.Boolean;
  }
  
  // Check for number
  const isNum = sample.every(v => {
    if (typeof v === 'number') return true;
    if (typeof v === 'string') {
      const parsed = parseFloat(v);
      return !isNaN(parsed) && v.trim() === parsed.toString();
    }
    return false;
  });
  if (isNum) {
    return ColumnType.Number;
  }
  
  // Check for date
  const isDate = sample.every(v => {
    if (v instanceof Date) return true;
    if (typeof v === 'string') {
      // Check common date formats
      const datePatterns = [
        /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, // ISO format
        /^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY
        /^\d{2}-\d{2}-\d{4}$/, // DD-MM-YYYY
      ];
      if (datePatterns.some(pattern => pattern.test(v))) {
        const date = new Date(v);
        return !isNaN(date.getTime());
      }
    }
    return false;
  });
  if (isDate) {
    return ColumnType.Date;
  }
  
  // Check for array or object (JSON)
  const isJson = sample.some(v => {
    if (Array.isArray(v) || (typeof v === 'object' && v !== null)) return true;
    if (typeof v === 'string' && (v.startsWith('[') || v.startsWith('{'))) {
      try {
        JSON.parse(v);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  });
  if (isJson) {
    const isArray = sample.every(v => Array.isArray(v) || (typeof v === 'string' && v.startsWith('[')));
    return isArray ? ColumnType.Array : ColumnType.Object;
  }
  
  // Default to string
  return ColumnType.String;
};

/**
 * Hook for importing query results as a new table
 */
export const useQueryResultsImport = () => {
  const [isImporting, setIsImporting] = useState(false);
  const { addFile } = useAppStore();
  const { loadData, getTableSchema, executeQuery, db, registeredTables } = useDuckDBStore();
  const { addNode, draftFolderId, initializeStore } = useFolderStore();
  
  /**
   * Import query results as a new table or view in DuckDB and add to file tabs
   * Uses hybrid approach: TABLE for small datasets, VIEW for large datasets
   * @param results - Query results to import
   * @param columns - Column names
   * @param sourceFileName - Optional source file name for better naming
   * @param originalQuery - Optional original query to create view from (for large datasets)
   * @param customTableName - Optional custom table name provided by the user
   */
  const importQueryResultsAsTable = useCallback(async (
    results: any[] | null,
    columns: string[] | null,
    sourceFileName?: string,
    originalQuery?: string,
    customTableName?: string
  ): Promise<boolean> => {
    if (!results || !columns || results.length === 0) {
      console.error('[useQueryResultsImport] No results to import');
      return false;
    }

    setIsImporting(true);
    
    try {
      let tableName: string;
      
      // Use custom table name if provided, otherwise generate one
      if (customTableName) {
        tableName = customTableName;
      } else {
        // Generate a more readable timestamp (YYYYMMDD_HHMMSS format)
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
        const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '');
        const timestamp = `${dateStr}_${timeStr}`;
        
        if (sourceFileName) {
          // Remove file extension and special characters from source name
          const baseName = sourceFileName
            .replace(/\.[^/.]+$/, '') // Remove extension
            .replace(/[^a-zA-Z0-9_]/g, '_'); // Replace special chars with underscore
          
          // Format: originalname_modified_YYYYMMDD_HHMMSS
          tableName = `${baseName}_modified_${timestamp}`;
        } else {
          // Fallback to generic name
          tableName = `query_results_${timestamp}`;
        }
        
        // Ensure table name doesn't get too long (DuckDB has limits)
        if (tableName.length > 63) { // PostgreSQL/DuckDB typically have 63 char limit
          const baseNameLength = 25; // Leave room for _modified_YYYYMMDD_HHMMSS
          const baseName = sourceFileName 
            ? sourceFileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_').slice(0, baseNameLength)
            : 'query_results';
          tableName = `${baseName}_mod_${timestamp}`;
        }
      }

      // HYBRID APPROACH: Follow the pattern from importFileDirectlyStreaming
      // TABLE for ≤100,000 rows, VIEW for >100,000 rows
      const rowThreshold = 100000;
      const useTableApproach = results.length <= rowThreshold;
      const objectType = useTableApproach ? "TABLE" : "VIEW";
      
      console.log(`[useQueryResultsImport] Creating ${objectType} for ${results.length} rows (threshold: ${rowThreshold})`);

      let loadedTableName: string;
      let detectedColumnTypes: ColumnType[];
      const escapedTableName = `"${tableName}"`;

      if (useTableApproach) {
        // TABLE approach for smaller datasets - create table directly from the original query
        // This preserves the original data types from DuckDB without conversion
        if (!originalQuery) {
          throw new Error('Original query is required to preserve data types when creating tables');
        }

        // Remove trailing semicolon if present to avoid syntax errors in CREATE TABLE AS
        const cleanedQuery = originalQuery.trim().replace(/;+$/, '');
        const createTableQuery = `CREATE TABLE ${escapedTableName} AS (${cleanedQuery})`;
        
        console.log(`[useQueryResultsImport] Creating TABLE with query:`, createTableQuery);
        await executeQuery(createTableQuery);
        
        loadedTableName = tableName;
        
        // Register the new table in DuckDB store
        const newTables = new Map(registeredTables);
        newTables.set(tableName, escapedTableName);
        useDuckDBStore.setState({ registeredTables: newTables });
        
        // Get the schema from the newly created table
        try {
          const schema = await getTableSchema(loadedTableName);
          if (schema) {
            // Use DuckDB's native type detection
            detectedColumnTypes = convertDuckDBColumnTypes({ toArray: () => schema });
            console.log('[useQueryResultsImport] TABLE column types from DuckDB schema:', columns.map((col, i) => ({
              column: col,
              type: ColumnType[detectedColumnTypes[i]],
              duckdbType: schema[i]?.type
            })));
          } else {
            // Fallback to JavaScript-based detection if schema query fails
            console.log('[useQueryResultsImport] Failed to get schema, using fallback type detection');
            detectedColumnTypes = columns.map(col => {
              const columnValues = results.map(row => row[col]);
              return detectColumnType(columnValues);
            });
          }
        } catch (error) {
          console.warn('[useQueryResultsImport] Failed to get TABLE schema, using fallback detection:', error);
          // Fallback to JavaScript-based detection
          detectedColumnTypes = columns.map(col => {
            const columnValues = results.map(row => row[col]);
            return detectColumnType(columnValues);
          });
        }
      } else {
        // VIEW approach for larger datasets - create a view from the original query
        if (!originalQuery) {
          throw new Error('Original query is required for creating views of large result sets');
        }

        // Remove trailing semicolon if present to avoid syntax errors in CREATE VIEW AS
        const cleanedQuery = originalQuery.trim().replace(/;+$/, '');
        const createViewQuery = `CREATE VIEW ${escapedTableName} AS (${cleanedQuery})`;
        
        console.log(`[useQueryResultsImport] Creating VIEW with query:`, createViewQuery);
        await executeQuery(createViewQuery);
        
        loadedTableName = tableName;
        
        // Register the new view in DuckDB store
        const newTables = new Map(registeredTables);
        newTables.set(tableName, escapedTableName);
        useDuckDBStore.setState({ registeredTables: newTables });
        
        // For views, we still need to detect column types from the sample data
        try {
          const schema = await getTableSchema(loadedTableName);
          if (schema) {
            detectedColumnTypes = convertDuckDBColumnTypes({ toArray: () => schema });
            console.log('[useQueryResultsImport] VIEW column types from schema:', columns.map((col, i) => ({
              column: col,
              type: ColumnType[detectedColumnTypes[i]],
              duckdbType: schema[i]?.type
            })));
          } else {
            // Fallback to JavaScript-based detection using the result sample
            detectedColumnTypes = columns.map(col => {
              const columnValues = results.map(row => row[col]);
              return detectColumnType(columnValues);
            });
          }
        } catch (error) {
          console.warn('[useQueryResultsImport] Failed to get VIEW schema, using fallback detection:', error);
          detectedColumnTypes = columns.map(col => {
            const columnValues = results.map(row => row[col]);
            return detectColumnType(columnValues);
          });
        }
      }
      
      const columnTypes = detectedColumnTypes;
      
      // Create file entry for the app
      // For both TABLE and VIEW approaches, we don't store the raw data in app state
      // since it's now materialized in DuckDB with proper types
      const fileData = {
        data: [], // Data is stored in DuckDB, not in app state
        columnTypes,
        fileName: tableName, // No extension - it's a table/view, not a file
        rowCount: results.length,
        columnCount: columns.length,
        sourceType: DataSourceType.TABLE, // Mark as TABLE type for proper icon
        loadedToDuckDB: true,
        tableName: loadedTableName,
        isView: !useTableApproach, // Mark as view for large datasets
        isQueryResult: true, // Flag to identify this as saved query results
        // Add metadata about the source
        metadata: {
          importedFrom: sourceFileName || 'query_results',
          importedAt: new Date().toISOString(),
          isModified: true,
          objectType: objectType,
          rowThreshold: rowThreshold,
          originalQuery: originalQuery, // Store for both TABLE and VIEW
          preservedDataTypes: true, // Flag indicating types were preserved
          isQueryResult: true // Also in metadata for consistency
        }
      };
      
      // Add to file tabs
      addFile(fileData);
      
      // Add to folder tree as well
      try {
        // Ensure draft folder exists
        if (!draftFolderId) {
          initializeStore();
        }
        
        const currentDraftFolderId = useFolderStore.getState().draftFolderId;
        if (currentDraftFolderId) {
          // Create a virtual file object for the folder store
          const virtualFile = {
            name: `${tableName}.sql`,
            size: 0,
          } as File;
          
          addNode({
            name: `${tableName}.sql`,
            type: 'file' as const,
            fileData: {
              size: 0,
              lastModified: Date.now(),
              fileType: 'query' as const,
              isLoaded: true,
              tableName: loadedTableName,
              isRemote: false,
            },
          }, currentDraftFolderId);
          
          console.log(`[useQueryResultsImport] Added table to folder tree: ${tableName}`);
        }
      } catch (folderError) {
        console.warn('[useQueryResultsImport] Failed to add to folder tree, but table creation succeeded:', folderError);
        // Don't fail the whole operation if folder tree update fails
      }
      
      console.log(`[useQueryResultsImport] Successfully imported ${results.length} rows as ${objectType}: ${loadedTableName}${sourceFileName ? ` (modified from ${sourceFileName})` : ''}`);
      return true;
    } catch (error) {
      console.error('[useQueryResultsImport] Failed to import results as table/view:', error);
      alert('Failed to import results. Please try again.');
      return false;
    } finally {
      setIsImporting(false);
    }
  }, [loadData, addFile, getTableSchema, executeQuery]);
  
  return {
    isImporting,
    importQueryResultsAsTable,
    detectColumnType
  };
};