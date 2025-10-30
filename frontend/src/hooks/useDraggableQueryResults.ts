import { useState, useCallback } from 'react';
import { useDuckDBStore } from '@/store/duckDBStore';
import { useFolderStore } from '@/store/folderStore';

export interface DraggableQueryResult {
  data: any[][];
  columnTypes?: Array<{ name: string; type: string }>;
  metadata?: {
    rowCount: number;
    columnCount: number;
    executionTime: number;
    query: string;
  };
  aiChartSuggestion?: string;
}

/**
 * Custom hook for managing draggable query results overlay
 * Provides state management and handlers for the draggable results component
 */
export const useDraggableQueryResults = () => {
  const [isDraggableOpen, setIsDraggableOpen] = useState(false);
  const [draggableResults, setDraggableResults] = useState<DraggableQueryResult | null>(null);
  const { addFile: addFileToFolder, ensureTempFolder } = useFolderStore();

  // Show draggable results
  const showDraggableResults = useCallback((results: DraggableQueryResult) => {
    setDraggableResults(results);
    setIsDraggableOpen(true);
  }, []);

  // Close draggable results
  const closeDraggableResults = useCallback(() => {
    setIsDraggableOpen(false);
    // Clear the global active card and notify all cards
    delete (window as any).__activeQueryCardId;
    window.dispatchEvent(new CustomEvent('queryCardActiveChange'));
    // Clear results after animation
    setTimeout(() => setDraggableResults(null), 250);
  }, []);

  // Handle keeping draggable results as a new table
  const handleKeepDraggableResults = useCallback(async (tableName: string) => {
    if (!draggableResults?.data || draggableResults.data.length < 2) {
      throw new Error('No valid results to save');
    }

    const { data } = draggableResults;
    const headers = data[0].slice(1); // Skip row number column
    const rows = data.slice(1);

    // Build CREATE TABLE statement
    const columnDefs = headers.map((header: string) => `"${header}" VARCHAR`).join(', ');
    const createTableSQL = `CREATE TABLE "${tableName}" (${columnDefs})`;
    
    try {
      const { executeQuery } = useDuckDBStore.getState();
      
      // Create the table
      await executeQuery(createTableSQL);

      // Insert data in batches for better performance
      const batchSize = 1000;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const values = batch.map(row => 
          `(${row.slice(1).map((value: any) => { // Skip row number column
            if (value === null || value === undefined) return 'NULL';
            if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
            return value;
          }).join(', ')})`
        ).join(', ');

        const insertSQL = `INSERT INTO "${tableName}" VALUES ${values}`;
        await executeQuery(insertSQL);
      }

      // Register the new table in stores
      const duckDBState = useDuckDBStore.getState();
      const newTables = new Map(duckDBState.registeredTables);
      newTables.set(tableName, `"${tableName}"`);
      
      useDuckDBStore.setState({ 
        registeredTables: newTables,
        lastTableRefresh: Date.now()
      });

      // Ensure Temporary Tables folder exists
      const tempFolderId = ensureTempFolder();

      // Create a file object for the table
      const tableFile = new File([''], `${tableName}.sql`, { type: 'text/sql' });

      // Add to folder tree in Temporary Tables folder
      addFileToFolder(tableFile, {
        fileType: 'query',
        isLoaded: true,
        tableName,
        size: 0,
        lastModified: Date.now(),
      }, tempFolderId);

      console.log(`Successfully created table ${tableName} with ${rows.length} rows`);
      closeDraggableResults();
    } catch (error) {
      console.error('Error creating table from results:', error);
      throw error;
    }
  }, [draggableResults, closeDraggableResults, addFileToFolder, ensureTempFolder]);

  // Handle export draggable results
  const handleExportDraggableResults = useCallback((format: 'csv' | 'json' = 'csv') => {
    if (!draggableResults?.data) return;

    const { data } = draggableResults;
    let content: string;
    let filename: string;
    let mimeType: string;

    if (format === 'csv') {
      content = data.map((row: any[]) => 
        row.map(cell => {
          const value = String(cell || '');
          if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      ).join('\n');
      filename = `query_results_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
      mimeType = 'text/csv';
    } else {
      const headers = data[0];
      const rows = data.slice(1);
      const jsonData = rows.map((row: any[]) => {
        const obj: any = {};
        headers.forEach((header: string, index: number) => {
          obj[header] = row[index];
        });
        return obj;
      });
      content = JSON.stringify(jsonData, null, 2);
      filename = `query_results_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
      mimeType = 'application/json';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [draggableResults]);

  // Handle copy draggable results
  const handleCopyDraggableResults = useCallback(() => {
    if (!draggableResults?.data) return;

    const content = draggableResults.data
      .map((row: any[]) => row.join('\t'))
      .join('\n');
    
    navigator.clipboard.writeText(content);
  }, [draggableResults]);

  return {
    // State
    isDraggableOpen,
    draggableResults,
    
    // Actions
    showDraggableResults,
    closeDraggableResults,
    handleKeepDraggableResults,
    handleExportDraggableResults,
    handleCopyDraggableResults,
  };
};