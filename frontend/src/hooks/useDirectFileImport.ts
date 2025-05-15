import { useState, useCallback } from "react";

import { useDuckDBStore } from "@/store/duckDBStore";
import useFileAccess, { FileAccessEntry } from "@/hooks/useFileAccess";

import { ColumnType } from "@/types/csv";
import { DataSourceType } from "@/types/json";

import { DataLoadWithDuckDBResult } from "@/components/layout/Sidebar";

export function useDirectFileImport() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string>("");
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [processingError, setProcessingError] = useState<string | null>(null);

  const { importFileDirectly, executeQuery, processingProgress } =
    useDuckDBStore();

  const { requestFile, openRecentFile, addRecentFile } = useFileAccess();

  const processFile = useCallback(
    async (
      file: File,
      onDataLoad?: (result: DataLoadWithDuckDBResult) => void
    ) => {
      try {
        setIsProcessing(true);
        setProcessingError(null);
        setLoadingStatus(`Starting import process for: ${file.name}`);

        // Get file info
        const fileExt = file.name.split(".").pop()?.toLowerCase();
        const fileSize = file.size / (1024 * 1024); // Size in MB
        console.log(
          `[DirectImport] Processing file: ${file.name} (${fileSize.toFixed(
            2
          )} MB)`
        );

        // Add to recent files
        addRecentFile(file);

        // Start progress monitoring
        const progressWatcher = setInterval(() => {
          setLoadingProgress(processingProgress * 100);
        }, 100);

        try {
          let importResult;
          let isExcelConversion = false;

          if ((fileExt === "xlsx" || fileExt === "xls")) {
            // For larger Excel files, inform the user about conversion
            setLoadingStatus(
              `Converting Excel file to CSV for more reliable processing...`
            );
            isExcelConversion = true;
          } else {
            // Regular file processing
            setLoadingStatus(
              `Importing ${fileExt?.toUpperCase()} file to DuckDB...`
            );
          }

          // Import file directly to DuckDB
          importResult = await importFileDirectly(file);

          // Check if we need to add Excel-specific messaging
          if (isExcelConversion && importResult.convertedToCsv) {
            setLoadingStatus(
              `Successfully imported Excel data via CSV conversion (${importResult.rowCount.toLocaleString()} rows)`
            );
          } else {
            setLoadingStatus(
              `Successfully imported ${importResult.rowCount.toLocaleString()} rows from ${
                file.name
              }`
            );
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

          // Determine source type based on file extension
          let sourceType = DataSourceType.CSV; // Default

          if (fileExt === "json") {
            sourceType = DataSourceType.JSON;
          } else if (fileExt === "xlsx" || fileExt === "xls") {
            sourceType = DataSourceType.XLSX; // Make sure this is defined in your enum
          }

          // Create a result object for the UI
          const result: DataLoadWithDuckDBResult = {
            data: sampleData,
            columnTypes,
            fileName: file.name,
            rowCount: importResult.rowCount,
            columnCount: headers.length,
            sourceType,
            loadedToDuckDB: true,
            tableName: importResult.tableName,
            // Add extra info for Excel files that were converted
            convertedFromExcel:
              isExcelConversion && importResult.convertedToCsv,
          };

          // Call the callback with the result
          if (onDataLoad) {
            console.log(
              `[DirectImport] Calling onDataLoad callback with import result`
            );
            onDataLoad(result);
          }

          return result;
        } finally {
          clearInterval(progressWatcher);
        }
      } catch (err) {
        console.error(`[DirectImport] Error importing file:`, err);

        const errorMessage = err instanceof Error ? err.message : String(err);

        // Check for Excel-specific errors
        if (errorMessage.toLowerCase().includes("excel")) {
          setProcessingError(
            `Excel import error: ${errorMessage}. Consider converting to CSV format first.`
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
    [addRecentFile, importFileDirectly, executeQuery, processingProgress]
  );

  // Handle upload button click
  const handleUploadClick = useCallback(
    async (onDataLoad?: (result: DataLoadWithDuckDBResult) => void) => {
      try {
        setLoadingStatus("Selecting file...");

        const file = await requestFile();
        if (file) {
          return await processFile(file, onDataLoad);
        } else {
          // User cancelled
          setLoadingStatus("");
          return null;
        }
      } catch (err) {
        console.error(`[DirectImport] Error requesting file:`, err);
        setProcessingError(
          `Error: ${err instanceof Error ? err.message : String(err)}`
        );
        setLoadingStatus("Error");
        return null;
      }
    },
    [requestFile, processFile]
  );

  // Handle recent file selection
  const handleRecentFileSelect = useCallback(
    async (
      fileEntry: FileAccessEntry,
      onDataLoad?: (result: DataLoadWithDuckDBResult) => void
    ) => {
      try {
        setIsProcessing(true);
        setProcessingError(null);
        setLoadingStatus(`Opening recent file: ${fileEntry.name}`);

        const file = await openRecentFile(fileEntry);
        if (file) {
          return await processFile(file, onDataLoad);
        } else {
          throw new Error("Failed to open recent file");
        }
      } catch (err) {
        console.error(`[DirectImport] Error opening recent file:`, err);
        setProcessingError(
          `Error: ${err instanceof Error ? err.message : String(err)}`
        );
        setLoadingStatus("Error");
        setIsProcessing(false);
        return null;
      }
    },
    [openRecentFile, processFile]
  );

  return {
    handleUploadClick,
    handleRecentFileSelect,
    processFile,
    isProcessing,
    loadingStatus,
    loadingProgress,
    processingError,
    setLoadingStatus,
    setProcessingError,
  };
}

export default useDirectFileImport;
