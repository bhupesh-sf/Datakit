import { useState, useCallback } from 'react';
import { 
  parseGoogleSheetsUrl, 
  fetchGoogleSheet, 
  checkGoogleSheetAccessibility, 
  getDisplaySheetName
} from '@/lib/google/sheetsUtils';

import { useDuckDBStore } from '@/store/duckDBStore';
import { DataSourceType } from '@/types/json';
import { ColumnType } from '@/types/csv';

/**
 * Result of a Google Sheets import operation
 */
export interface GoogleSheetsImportResult {
  // Base data
  data: string[][];
  columnTypes: ColumnType[];
  fileName: string;
  rowCount: number;
  columnCount: number;
  sourceType: DataSourceType;
  loadedToDuckDB: boolean;
  tableName: string;
  
  // Remote source info
  isRemote: boolean;
  remoteURL: string;
  remoteProvider: 'google_sheets';
  
  // Google Sheets specific metadata
  googleSheets: {
    sheetName: string;
    docId: string | null;
    sheetId: string | null;
    format: 'csv' | 'xlsx' | 'html' | null;
    importedAt: number;
  };
}

/**
 * Hook for importing Google Sheets data
 */
export function useGoogleSheetsImport() {
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string>('');
  const [importProgress, setImportProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const { 
    importFileDirectly, 
    executeQuery,
    processingProgress 
  } = useDuckDBStore();
  
  /**
   * Import data from a Google Sheets URL
   */
  const importFromGoogleSheets = useCallback(async (url: string): Promise<GoogleSheetsImportResult> => {
    try {
      setIsImporting(true);
      setError(null);
      setImportStatus('Analyzing Google Sheets URL...');
      setImportProgress(0.05);
      
      // Parse the URL to extract sheet information
      const sheetInfo = parseGoogleSheetsUrl(url);
      
      if (!sheetInfo.isGoogleSheet) {
        throw new Error('The URL provided is not a valid Google Sheets URL');
      }
      
      if (!sheetInfo.exportUrl) {
        throw new Error('Could not generate a valid export URL for this Google Sheet');
      }
      
      // Check if the sheet is accessible
      setImportStatus('Checking Google Sheet accessibility...');
      setImportProgress(0.1);
      
      const accessCheck = await checkGoogleSheetAccessibility(url);
      
      if (!accessCheck.accessible) {
        throw new Error(`Google Sheet is not accessible: ${accessCheck.error || 'Unknown error'}`);
      }
      
      // Add sheet size warning if available
      if (accessCheck.contentLength && accessCheck.contentLength > 5 * 1024 * 1024) {
        setImportStatus('⚠️ This is a large Google Sheet and may take longer to import...');
        // Continue anyway
      }
      
      // Fetch the sheet data
      setImportStatus(`Fetching Google Sheet data (${sheetInfo.format || 'csv'} format)...`);
      setImportProgress(0.2);
      
      const { 
        file, 
        sheetName, 
        size,
        rows,
        dataSourceType 
      } = await fetchGoogleSheet(sheetInfo);
      
      // Add row count information if available
      if (rows > 0) {
        setImportStatus(`Processing Google Sheet with approximately ${rows.toLocaleString()} rows...`);
      } else {
        setImportStatus('Processing Google Sheet data...');
      }
      setImportProgress(0.3);
      
      // Monitor DuckDB progress
      const progressWatcher = setInterval(() => {
        // Scale DuckDB's progress to our range (30%-90%)
        const scaledProgress = 0.3 + (processingProgress * 0.6);
        setImportProgress(scaledProgress);
      }, 100);
      
      try {
        // Import the file using DuckDB's direct import
        setImportStatus('Importing data to DuckDB...');
        const importResult = await importFileDirectly(file);
        
        // Get schema information
        setImportStatus('Getting table schema...');
        setImportProgress(0.92);
        
        const schemaResult = await executeQuery(
          `PRAGMA table_info("${importResult.tableName}")`
        );
        
        if (!schemaResult) {
          throw new Error('Failed to get table schema');
        }
        
        // Get data sample for UI display
        setImportStatus('Loading data preview...');
        setImportProgress(0.95);
        
        const sampleResult = await executeQuery(
          `SELECT * FROM "${importResult.tableName}" LIMIT 1000`
        );
        
        if (!sampleResult) {
          throw new Error('Failed to get data sample');
        }
        
        // Convert to expected format for UI
        const headers = schemaResult.toArray().map((col) => col.name);
        const sampleData = [
          headers,
          ...sampleResult.toArray().map((row) =>
            headers.map((col) => {
              // Handle null values and convert all values to strings for display
              if (row[col] === null || row[col] === undefined) return "";
              return String(row[col]);
            })
          ),
        ];
        
        // Detect column types from schema
        const columnTypes = schemaResult.toArray().map((col) => {
          const type = col.type.toLowerCase();
          
          // Numeric types
          if (
            type.includes("int") ||
            type.includes("float") ||
            type.includes("double") ||
            type.includes("decimal") ||
            type.includes("number")
          ) {
            return ColumnType.Number;
          }
          // Boolean types
          else if (type.includes("bool")) {
            return ColumnType.Boolean;
          }
          // Date types
          else if (
            type.includes("date") ||
            type.includes("time") ||
            type.includes("timestamp")
          ) {
            return ColumnType.Date;
          }
          // Object/JSON types
          else if (
            type.includes("json") ||
            type.includes("object") ||
            type.includes("map")
          ) {
            return ColumnType.Object;
          }
          // Array types
          else if (type.includes("array") || type.includes("list")) {
            return ColumnType.Array;
          }
          // Default to text
          else {
            return ColumnType.Text;
          }
        });
        
        // Get a display name for the sheet
        const displayName = getDisplaySheetName(sheetInfo);
        
        // Create the final result object
        const result: GoogleSheetsImportResult = {
          data: sampleData,
          columnTypes,
          fileName: `Google Sheet: ${displayName}`,
          rowCount: importResult.rowCount,
          columnCount: headers.length,
          sourceType: dataSourceType,
          loadedToDuckDB: true,
          tableName: importResult.tableName,
          
          // Remote source info
          isRemote: true,
          remoteURL: url,
          remoteProvider: 'google_sheets',
          
          // Google Sheets specific metadata
          googleSheets: {
            sheetName: sheetInfo.sheetName || 'Sheet1',
            docId: sheetInfo.docId,
            sheetId: sheetInfo.sheetId,
            format: sheetInfo.format,
            importedAt: Date.now(),
          }
        };
        
        setImportStatus('Import complete!');
        setImportProgress(1);
        return result;
      } finally {
        clearInterval(progressWatcher);
      }
    } catch (err) {
      console.error(`[GoogleSheetsImport] Error importing from Google Sheets:`, err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      setImportStatus('Import failed');
      throw err;
    } finally {
      setIsImporting(false);
    }
  }, [importFileDirectly, executeQuery, processingProgress]);
  
  return {
    importFromGoogleSheets,
    isImporting,
    importStatus,
    importProgress,
    error,
    setError
  };
}

export default useGoogleSheetsImport;