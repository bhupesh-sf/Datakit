import { useState, useCallback } from "react";

import { useDuckDBStore } from "@/store/duckDBStore";
import useFileAccess from "@/hooks/useFileAccess";
import DataProcessingUtil from "@/lib/data/dataProcessingUtil";
import { convertDuckDBColumnTypes } from "@/lib/duckdb/ingestion/convertDuckDBColumnTypes";

import { DataLoadWithDuckDBResult } from "@/components/layout/Sidebar";

export function useDirectFileImport() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string>("");
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [processingError, setProcessingError] = useState<string | null>(null);

  const {
    importFileDirectly,
    importFileDirectlyStreaming,
    executeQuery,
    processingProgress,
  } = useDuckDBStore();

  const { addRecentFile } = useFileAccess();

  /**
   * Create UI-ready sample data from DuckDB query results
   */
  const createSampleData = useCallback(
    (schemaResult: any, sampleResult: any): string[][] => {
      const headers = schemaResult.toArray().map((col: any) => col.name);
      const sampleData = [
        headers,
        ...sampleResult.toArray().map((row: any) =>
          headers.map((col: string) => {
            if (row[col] === null || row[col] === undefined) return "";
            return String(row[col]);
          })
        ),
      ];
      return sampleData;
    },
    []
  );

  const processFileStreaming = useCallback(
    async (
      fileHandle: FileSystemFileHandle,
      file: File,
      onDataLoad?: (result: DataLoadWithDuckDBResult) => void
    ) => {
      try {
        setIsProcessing(true);
        setProcessingError(null);

        const sizeCategory = DataProcessingUtil.getFileSizeCategory(file.size);
        const formattedSize = DataProcessingUtil.formatFileSize(file.size);
        const shouldUseStreaming = DataProcessingUtil.shouldUseStreaming(
          file.size
        );

        setLoadingStatus(
          `Starting ${shouldUseStreaming ? "streaming " : ""}import for: ${
            file.name
          } (${formattedSize})`
        );

        console.log(
          `[DirectImport] Processing: ${file.name} (${formattedSize}, ${sizeCategory})`
        );

        addRecentFile(file);

        // Get file extension and detect source type
        const fileExt = file.name.split(".").pop()?.toLowerCase();
        const sourceType = DataProcessingUtil.detectSourceType(file.name);
        let isExcelConversion = false;

        // Show appropriate status based on file type and size
        if (fileExt === "xlsx" || fileExt === "xls") {
          setLoadingStatus(
            `Converting Excel file to CSV for reliable processing...`
          );
          isExcelConversion = true;
        } else if (fileExt === "parquet") {
          setLoadingStatus(
            `${shouldUseStreaming ? "Streaming " : ""}Parquet file import...`
          );
        } else if (shouldUseStreaming) {
          setLoadingStatus(
            `Streaming ${fileExt?.toUpperCase()} file import (large file detected)...`
          );
        } else {
          setLoadingStatus(`Importing ${fileExt?.toUpperCase()} file...`);
        }

        // Start progress monitoring
        const progressWatcher = setInterval(() => {
          setLoadingProgress(processingProgress * 100);
        }, 100);

        try {
          let importResult;

          // Use streaming import for large files or regular import for smaller ones
          if (shouldUseStreaming || fileExt === "parquet") {
            importResult = await importFileDirectlyStreaming(
              fileHandle,
              file.name,
              file.size
            );
          } else {
            // Fallback to regular import for smaller files
            importResult = await importFileDirectly(file);
          }

          // Check if this is a DuckDB database attachment
          if (importResult?.isDatabaseFile) {
            // Handle attached database differently
            setLoadingStatus(
              `Successfully attached database '${importResult.tableName}' with ${importResult.rowCount} table(s)`
            );
            
            // For attached databases, we don't load a specific table
            // Instead, we just notify that tables are available
            const result: DataLoadWithDuckDBResult = {
              data: [],
              columnTypes: [],
              fileName: file.name,
              rowCount: importResult.rowCount, // This is actually the number of tables
              columnCount: 0,
              sourceType,
              loadedToDuckDB: true,
              tableName: importResult.tableName,
              isDatabaseAttachment: true,
              attachedTables: importResult.attachedTables,
              isStreamingImport: shouldUseStreaming,
            };
            
            if (onDataLoad) {
              onDataLoad(result);
            }
            
            console.log("[DirectImport] Database attached successfully:", importResult);
            return result;
          }
          
          // Success message with proper formatting
          if (isExcelConversion && importResult.convertedToCsv) {
            setLoadingStatus(
              `Successfully imported Excel data via CSV conversion (${importResult.rowCount.toLocaleString()} rows)`
            );
          } else if (shouldUseStreaming) {
            setLoadingStatus(`Successfully streamed rows from ${file.name}`);
          } else {
            setLoadingStatus(`Successfully imported rows from ${file.name}`);
          }
          // Fetch schema and sample data for UI display
          const schemaResult = await executeQuery(
            `PRAGMA table_info("${importResult.tableName}")`
          );
          if (!schemaResult) {
            throw new Error("Failed to get table schema");
          }

          const sampleResult = await executeQuery(
            `SELECT * FROM "${importResult.tableName}" LIMIT 1000`
          );
          if (!sampleResult) {
            throw new Error("Failed to get data sample");
          }

          // Convert to expected format for UI using utility methods
          const sampleData = createSampleData(schemaResult, sampleResult);
          const columnTypes = convertDuckDBColumnTypes(schemaResult);
          const headers = schemaResult.toArray().map((col: any) => col.name);

          // Create result object using DataProcessingUtil
          const result: DataLoadWithDuckDBResult = {
            data: sampleData,
            columnTypes,
            fileName: file.name,
            rowCount: importResult.rowCount,
            columnCount: headers.length,
            sourceType,
            loadedToDuckDB: true,
            tableName: importResult.tableName,
            convertedFromExcel:
              isExcelConversion && importResult.convertedToCsv,
            isStreamingImport: shouldUseStreaming,
          };

          console.log(
            `[DirectImport] Format: ${result.sourceType}, Streaming: ${shouldUseStreaming}`
          );

          // Call the callback with the result
          if (onDataLoad) {
            onDataLoad(result);
          }

          return result;
        } finally {
          clearInterval(progressWatcher);
        }
      } catch (err) {
        console.error(`[DirectImport] Error in import:`, err);

        const errorMessage = err instanceof Error ? err.message : String(err);

        if (errorMessage.toLowerCase().includes("excel")) {
          setProcessingError(
            `Excel import error: ${errorMessage}. Consider converting to CSV format first.`
          );
        } else if (errorMessage.toLowerCase().includes("memory")) {
          setProcessingError(
            `Memory error: ${errorMessage}. File may be too large for browser processing.`
          );
        } else {
          setProcessingError(`Error: ${errorMessage}`);
        }

        setLoadingStatus("Import failed");
        throw err;
      } finally {
        setIsProcessing(false);
      }
    },
    [
      importFileDirectly,
      importFileDirectlyStreaming,
      executeQuery,
      processingProgress,
      addRecentFile,
      convertDuckDBColumnTypes,
      createSampleData,
    ]
  );

  const processFile = useCallback(
    async (
      file: File,
      onDataLoad?: (result: DataLoadWithDuckDBResult) => void
    ) => {
      try {
        setIsProcessing(true);
        setProcessingError(null);

        // Use DataProcessingUtil for validation and size checks
        const fileValidation = DataProcessingUtil.validateFile(
          file.name,
          file.size
        );
        const formattedSize = DataProcessingUtil.formatFileSize(file.size);
        const sizeCategory = DataProcessingUtil.getFileSizeCategory(file.size);

        // threshold checking
        const LEGACY_STREAMING_THRESHOLD = 800 * 1024 * 1024; // 800MB in bytes

        if (file.size > LEGACY_STREAMING_THRESHOLD) {
          const errorMsg = `File too large (${formattedSize}) for legacy import. Please use a modern browser (Chrome/Edge) with streaming support for files over 800MB.`;
          alert(errorMsg);
          throw new Error(errorMsg);
        }

        // Show validation warnings
        if (fileValidation.warnings.length > 0) {
          console.warn(
            `[DirectImport] File warnings:`,
            fileValidation.warnings
          );
        }

        setLoadingStatus(
          `Starting import process for: ${file.name} (${formattedSize})`
        );
        console.log(
          `[DirectImport] Legacy processing: ${file.name} (${formattedSize}, ${sizeCategory})`
        );

        // Add to recent files
        addRecentFile(file);

        // Get source type using utility
        const sourceType = DataProcessingUtil.detectSourceType(file.name);

        const progressWatcher = setInterval(() => {
          setLoadingProgress(processingProgress * 100);
        }, 100);

        try {
          const importResult = await importFileDirectly(file);

          // Continue with existing schema and sample logic using utility methods
          const schemaResult = await executeQuery(
            `PRAGMA table_info("${importResult.tableName}")`
          );
          if (!schemaResult) {
            throw new Error("Failed to get table schema");
          }

          const sampleResult = await executeQuery(
            `SELECT * FROM "${importResult.tableName}" LIMIT 1000`
          );
          if (!sampleResult) {
            throw new Error("Failed to get data sample");
          }

          // Use utility methods for consistent data processing
          const sampleData = createSampleData(schemaResult, sampleResult);
          const columnTypes = convertDuckDBColumnTypes(schemaResult);
          const headers = schemaResult.toArray().map((col: any) => col.name);

          const result: DataLoadWithDuckDBResult = {
            data: sampleData,
            columnTypes,
            fileName: file.name,
            rowCount: importResult.rowCount,
            columnCount: headers.length,
            sourceType,
            loadedToDuckDB: true,
            tableName: importResult.tableName,
          };

          // Log import statistics
          console.log(
            `[DirectImport] Successfully processed (legacy): ${file.name}`
          );
          console.log(
            `[DirectImport] Rows: ${result.rowCount.toLocaleString()}, Columns: ${
              result.columnCount
            }`
          );
          console.log(`[DirectImport] Format: ${result.sourceType}`);

          if (onDataLoad) {
            onDataLoad(result);
          }

          return result;
        } finally {
          clearInterval(progressWatcher);
        }
      } catch (err) {
        console.error(`[DirectImport] Error importing file:`, err);
        const errorMessage = err instanceof Error ? err.message : String(err);

        if (DataProcessingUtil.isFileTooLarge(file.size)) {
          setProcessingError(
            `File too large (${DataProcessingUtil.formatFileSize(
              file.size
            )}). Maximum supported size is 2GB.`
          );
        } else {
          setProcessingError(`Error: ${errorMessage}`);
        }

        setLoadingStatus("Import failed");
        throw err;
      } finally {
        setIsProcessing(false);
      }
    },
    [
      addRecentFile,
      importFileDirectly,
      executeQuery,
      processingProgress,
      convertDuckDBColumnTypes,
      createSampleData,
    ]
  );

  return {
    processFile,
    processFileStreaming,

    isProcessing,
    loadingStatus,
    loadingProgress,
    processingError,
    setLoadingStatus,
    setProcessingError,
  };
}

export default useDirectFileImport;
