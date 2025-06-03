import { useState, useCallback } from "react";

import { useDuckDBStore } from "@/store/duckDBStore";
import useFileAccess from "@/hooks/useFileAccess";

import { ColumnType } from "@/types/csv";
import { DataSourceType } from "@/types/json";

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

  const processFileStreaming = useCallback(
    async (
      fileHandle: FileSystemFileHandle,
      file: File,
      onDataLoad?: (result: DataLoadWithDuckDBResult) => void
    ) => {
      try {
        setIsProcessing(true);
        setProcessingError(null);
        setLoadingStatus(`Starting streaming import for: ${file.name}`);

        // Get file info
        const fileExt = file.name.split(".").pop()?.toLowerCase();
        const fileSize = file.size / (1024 * 1024); // Size in MB
        console.log(
          `[DirectImport] Streaming processing: ${
            file.name
          } (${fileSize.toFixed(2)} MB)`
        );

        // Determine if we should use streaming based on file size
        const STREAMING_THRESHOLD = 10; // 10MB threshold
        const shouldUseStreaming = fileSize > STREAMING_THRESHOLD;

        addRecentFile(file);

        if (shouldUseStreaming) {
          console.log(
            `[DirectImport] Using streaming import for large file (${fileSize.toFixed(
              2
            )}MB)`
          );
        }

        // Start progress monitoring
        const progressWatcher = setInterval(() => {
          setLoadingProgress(processingProgress * 100);
        }, 100);

        try {
          let importResult;
          let isExcelConversion = false;

          if (fileExt === "xlsx" || fileExt === "xls") {
            setLoadingStatus(
              `Converting Excel file to CSV for reliable processing...`
            );
            isExcelConversion = true;
          } else if (fileExt === "parquet") {
            setLoadingStatus(`Streaming Parquet file import...`);
          } else if (shouldUseStreaming) {
            setLoadingStatus(
              `Streaming ${fileExt?.toUpperCase()} file import (large file detected)...`
            );
          } else {
            setLoadingStatus(`Importing ${fileExt?.toUpperCase()} file...`);
          }

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

          // Success message
          if (isExcelConversion && importResult.convertedToCsv) {
            setLoadingStatus(
              `Successfully imported Excel data via CSV conversion (${importResult.rowCount.toLocaleString()} rows)`
            );
          } else if (shouldUseStreaming) {
            setLoadingStatus(`Successfully streamed rows from ${file.name}`);
          } else {
            setLoadingStatus(`Successfully imported rows from ${file.name}`);
          }

          // Now fetch schema and sample data for UI display
          const schemaResult = await executeQuery(
            `PRAGMA table_info("${importResult.tableName}")`
          );
          if (!schemaResult) {
            throw new Error("Failed to get table schema");
          }

          // Get data sample for display
          const sampleResult = await executeQuery(
            `SELECT * FROM "${importResult.tableName}" LIMIT 1000`
          );
          if (!sampleResult) {
            throw new Error("Failed to get data sample");
          }

          // Convert to expected format for UI
          const headers = schemaResult.toArray().map((col) => col.name);
          const sampleData = [
            headers,
            ...sampleResult.toArray().map((row) =>
              headers.map((col) => {
                if (row[col] === null || row[col] === undefined) return "";
                return String(row[col]);
              })
            ),
          ];

          // Detect column types from schema
          const columnTypes = schemaResult.toArray().map((col) => {
            const type = col.type.toLowerCase();

            if (
              type.includes("int") ||
              type.includes("float") ||
              type.includes("double") ||
              type.includes("decimal") ||
              type.includes("number")
            ) {
              return ColumnType.Number;
            } else if (type.includes("bool")) {
              return ColumnType.Boolean;
            } else if (
              type.includes("date") ||
              type.includes("time") ||
              type.includes("timestamp")
            ) {
              return ColumnType.Date;
            } else if (
              type.includes("json") ||
              type.includes("object") ||
              type.includes("map")
            ) {
              return ColumnType.Object;
            } else if (type.includes("array") || type.includes("list")) {
              return ColumnType.Array;
            } else {
              return ColumnType.Text;
            }
          });

          // Determine source type based on file extension
          let sourceType = DataSourceType.CSV;
          if (fileExt === "json") {
            sourceType = DataSourceType.JSON;
          } else if (fileExt === "xlsx" || fileExt === "xls") {
            sourceType = DataSourceType.XLSX;
          } else if (fileExt === "parquet") {
            sourceType = DataSourceType.PARQUET;
          } else if (fileExt === "txt") {
            sourceType = DataSourceType.TXT;
          }

          // Create result object for the UI
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

          // Call the callback with the result
          if (onDataLoad) {
            console.log(
              `[DirectImport] Calling onDataLoad callback with streaming result`
            );
            onDataLoad(result);
          }

          return result;
        } finally {
          clearInterval(progressWatcher);
        }
      } catch (err) {
        console.error(`[DirectImport] Error in streaming import:`, err);

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
    ]
  );

  const processFile = useCallback(
    async (
      file: File,
      onDataLoad?: (result: DataLoadWithDuckDBResult) => void
    ) => {
      // For legacy File object support, we'll create a mock handle approach
      // This is mainly for backward compatibility
      const fileSize = file.size / (1024 * 1024);
      const STREAMING_THRESHOLD = 800;

      if (fileSize > STREAMING_THRESHOLD) {
        alert(
          "Please use a modern browser (Chrome/Edge) with streaming support for large files."
        );
        throw new Error(
          `File too large (${fileSize.toFixed(2)}MB) for legacy import. ` +
            `Please use the file picker to enable streaming import for files over ${STREAMING_THRESHOLD}MB.`
        );
      }

      // For smaller files, use the original method
      try {
        setIsProcessing(true);
        setProcessingError(null);
        setLoadingStatus(`Starting import process for: ${file.name}`);

        // Add to recent files (without handle for legacy support)
        addRecentFile(file);

        const progressWatcher = setInterval(() => {
          setLoadingProgress(processingProgress * 100);
        }, 100);

        try {
          const importResult = await importFileDirectly(file);

          // Continue with existing schema and sample logic...
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

          const headers = schemaResult.toArray().map((col) => col.name);
          const sampleData = [
            headers,
            ...sampleResult.toArray().map((row) =>
              headers.map((col) => {
                if (row[col] === null || row[col] === undefined) return "";
                return String(row[col]);
              })
            ),
          ];

          const fileExt = file.name.split(".").pop()?.toLowerCase();
          let sourceType = DataSourceType.CSV;
          if (fileExt === "json") sourceType = DataSourceType.JSON;
          else if (fileExt === "xlsx" || fileExt === "xls")
            sourceType = DataSourceType.XLSX;
          else if (fileExt === "parquet") sourceType = DataSourceType.PARQUET;
          else if (fileExt === "txt") sourceType = DataSourceType.TXT;

          const columnTypes = schemaResult.toArray().map((col) => {
            const type = col.type.toLowerCase();
            if (
              type.includes("int") ||
              type.includes("float") ||
              type.includes("double")
            ) {
              return ColumnType.Number;
            } else if (type.includes("bool")) {
              return ColumnType.Boolean;
            } else if (type.includes("date") || type.includes("time")) {
              return ColumnType.Date;
            } else if (type.includes("json") || type.includes("object")) {
              return ColumnType.Object;
            } else if (type.includes("array") || type.includes("list")) {
              return ColumnType.Array;
            } else {
              return ColumnType.Text;
            }
          });

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
        setProcessingError(`Error: ${errorMessage}`);
        setLoadingStatus("Import failed");
        throw err;
      } finally {
        setIsProcessing(false);
      }
    },
    [addRecentFile, importFileDirectly, executeQuery, processingProgress]
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
