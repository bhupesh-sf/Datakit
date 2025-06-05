import { useState, useCallback } from "react";

import { useDuckDBStore } from "@/store/duckDBStore";

import { ColumnType } from "@/types/csv";
import { DataSourceType } from "@/types/json";

const getDataSourceTypeFromMime = (
  mimeType: string,
  fileName?: string
): DataSourceType => {
  if (mimeType.includes("csv") || fileName?.endsWith(".csv")) {
    return DataSourceType.CSV;
  }
  if (mimeType.includes("json") || fileName?.endsWith(".json")) {
    return DataSourceType.JSON;
  }
  if (
    mimeType.includes("excel") ||
    mimeType.includes("spreadsheet") ||
    fileName?.endsWith(".xlsx") ||
    fileName?.endsWith(".xls")
  ) {
    return DataSourceType.XLSX;
  }
  if (mimeType.includes("text") || fileName?.endsWith(".txt")) {
    return DataSourceType.TXT;
  }
  if (fileName?.endsWith(".parquet")) {
    return DataSourceType.PARQUET;
  }

  return DataSourceType.CSV; // Default fallback
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

/**
 * Result type from GCS file import
 */
export interface GCSImportResult {
  data: string[][];
  columnTypes: ColumnType[];
  fileName: string;
  rowCount: number;
  columnCount: number;
  sourceType: DataSourceType;
  loadedToDuckDB: boolean;
  tableName: string;
  gcs: {
    bucket: string;
    object: string;
    url: string;
    fileSize?: number;
  };
}

/**
 * Hook for importing files from Google Cloud Storage (public access)
 */
export default function useGCSImport() {
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  // DuckDB store for data processing
  const duckDB = useDuckDBStore();

  /**
   * Parse GCS URL to extract bucket and object
   */
  const parseGCSUrl = useCallback((url: string) => {
    try {
      if (url.startsWith("gs://")) {
        // gs://bucket/object/path
        const parts = url.replace("gs://", "").split("/");
        const bucket = parts[0];
        const object = parts.slice(1).join("/");
        return { bucket, object };
      } else if (
        url.includes("storage.googleapis.com") ||
        url.includes("storage.cloud.google.com")
      ) {
        // https://storage.googleapis.com/bucket/object or https://storage.cloud.google.com/bucket/object
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.substring(1).split("/");
        const bucket = pathParts[0];
        const object = pathParts.slice(1).join("/");
        return { bucket, object };
      }

      throw new Error("Invalid GCS URL format");
    } catch (err) {
      throw new Error(
        `Invalid GCS URL: ${
          err instanceof Error ? err.message : "Unknown error"
        }`
      );
    }
  }, []);

  /**
   * Convert GCS URL to HTTPS URL for anonymous access
   */
  const getHttpsUrl = useCallback(
    (gcsUrl: string) => {
      const { bucket, object } = parseGCSUrl(gcsUrl);

      // Use the standard GCS HTTPS URL format for anonymous access
      return `https://storage.googleapis.com/${bucket}/${object}`;
    },
    [parseGCSUrl]
  );

  /**
   * Fetch file from GCS with progress tracking
   */
  const fetchGCSFile = useCallback(
    async (
      httpsUrl: string,
      onProgress?: (loaded: number, total?: number) => void
    ): Promise<{ blob: Blob; fileName: string; fileSize: number }> => {
      try {
        // Make a HEAD request first to get file info
        const headResponse = await fetch(httpsUrl, {
          method: "HEAD",
          mode: "cors",
        }).catch(() => null);

        const contentLength = headResponse?.headers.get("content-length");
        const fileSize = contentLength ? parseInt(contentLength, 10) : 0;

        // Extract filename from URL
        const fileName = httpsUrl.split("/").pop() || "gcs_file";

        setImportStatus(
          `Downloading ${fileName}${
            fileSize ? ` (${formatFileSize(fileSize)})` : ""
          }...`
        );

        // Fetch the actual file
        const response = await fetch(httpsUrl, { mode: "cors" });

        if (!response.ok) {
          if (response.status === 403) {
            throw new Error(
              "Access denied. This GCS object may not be publicly accessible."
            );
          } else if (response.status === 404) {
            throw new Error("File not found in GCS bucket.");
          } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
        }

        // Get response body as a stream and track progress
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("Unable to read response stream");
        }

        const chunks: Uint8Array[] = [];
        let receivedLength = 0;

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          chunks.push(value);
          receivedLength += value.length;

          // Report progress
          if (onProgress) {
            onProgress(receivedLength, fileSize || undefined);
          }

          // Update progress in state
          if (fileSize > 0) {
            const progress = receivedLength / fileSize;
            setImportProgress(progress * 0.5); // Download is first half of progress
          }
        }

        // Combine chunks into single Uint8Array
        const allChunks = new Uint8Array(receivedLength);
        let position = 0;
        for (const chunk of chunks) {
          allChunks.set(chunk, position);
          position += chunk.length;
        }

        const blob = new Blob([allChunks]);

        return { blob, fileName, fileSize: receivedLength };
      } catch (err) {
        if (err instanceof TypeError && err.message.includes("CORS")) {
          throw new Error(
            "CORS error: This GCS bucket may not allow cross-origin requests from your browser."
          );
        }
        throw err;
      }
    },
    []
  );

  /**
   * Import a file from GCS
   */
  const importFromGCS = useCallback(
    async (
      gcsUrl: string,
      customFileName?: string
    ): Promise<GCSImportResult> => {
      try {
        setIsImporting(true);
        setImportProgress(0);
        setError(null);
        setImportStatus("Preparing GCS import...");

        // Parse GCS URL
        const { bucket, object } = parseGCSUrl(gcsUrl);
        console.log(`[GCSImport] Importing from gs://${bucket}/${object}`);

        // Convert to HTTPS URL for anonymous access
        const httpsUrl = getHttpsUrl(gcsUrl);
        console.log(`[GCSImport] Using HTTPS URL: ${httpsUrl}`);

        setImportProgress(0.1);

        // Download file with progress tracking
        const { blob, fileName, fileSize } = await fetchGCSFile(
          httpsUrl,
          (loaded, total) => {
            if (total) {
              const progress = 0.1 + (loaded / total) * 0.4; // 10% to 50%
              setImportProgress(progress);
            }
          }
        );

        setImportProgress(0.5);
        setImportStatus("Processing file with DuckDB...");

        // Create File object for DuckDB processing
        const actualFileName = customFileName || fileName;
        const file = new File([blob], actualFileName, { type: blob.type });

        // Import using DuckDB
        const importResult = await duckDB.importFileDirectly(file);

        setImportProgress(0.8);
        setImportStatus("Getting data preview...");

        // Get schema and sample data
        const schemaResult = await duckDB.executeQuery(
          `PRAGMA table_info("${importResult.tableName}")`
        );

        if (!schemaResult) {
          throw new Error("Failed to get table schema");
        }

        const sampleResult = await duckDB.executeQuery(
          `SELECT * FROM "${importResult.tableName}" LIMIT 1000`
        );

        if (!sampleResult) {
          throw new Error("Failed to get data sample");
        }

        // Convert to expected format
        const headers = schemaResult.toArray().map((col: any) => col.name);
        const sampleData = [
          headers,
          ...sampleResult.toArray().map((row: any) =>
            headers.map((col: string) => {
              const value = row[col];
              return value !== null && value !== undefined ? String(value) : "";
            })
          ),
        ];

        // Detect column types from schema
        const columnTypes = schemaResult.toArray().map((col: any) => {
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

        // Determine source type from file extension or MIME type
        const sourceType = getDataSourceTypeFromMime(blob.type, actualFileName);

        setImportProgress(1.0);
        setImportStatus(
          `Successfully imported ${importResult.rowCount.toLocaleString()} rows from GCS`
        );

        const result: GCSImportResult = {
          data: sampleData,
          columnTypes,
          fileName: actualFileName,
          rowCount: importResult.rowCount,
          columnCount: headers.length,
          sourceType,
          loadedToDuckDB: true,
          tableName: importResult.tableName,
          gcs: {
            bucket,
            object,
            url: gcsUrl,
            fileSize,
          },
        };

        console.log(
          `[GCSImport] Successfully imported file: ${actualFileName}`
        );
        return result;
      } catch (err) {
        console.error("[GCSImport] Import failed:", err);
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";

        // Provide helpful error messages
        let userFriendlyMessage = errorMessage;
        if (errorMessage.includes("CORS")) {
          userFriendlyMessage =
            "This GCS bucket is not configured for browser access. Please use a bucket with CORS enabled.";
        } else if (
          errorMessage.includes("Access denied") ||
          errorMessage.includes("403")
        ) {
          userFriendlyMessage =
            "Access denied. This GCS object may be private or require authentication.";
        } else if (
          errorMessage.includes("Not found") ||
          errorMessage.includes("404")
        ) {
          userFriendlyMessage =
            "File not found. Please check the GCS URL and try again.";
        } else if (errorMessage.includes("Invalid GCS URL")) {
          userFriendlyMessage =
            "Invalid GCS URL format. Please provide a valid gs:// or https:// GCS URL.";
        }

        setError(userFriendlyMessage);
        throw err;
      } finally {
        setIsImporting(false);
        // Reset progress after a delay
        setTimeout(() => {
          setImportProgress(0);
          setImportStatus("");
        }, 2000);
      }
    },
    [duckDB, parseGCSUrl, getHttpsUrl, fetchGCSFile]
  );

  /**
   * Test if a GCS URL is accessible (CORS check)
   */
  const testGCSAccess = useCallback(
    async (gcsUrl: string): Promise<boolean> => {
      try {
        const httpsUrl = getHttpsUrl(gcsUrl);

        // Try a HEAD request to check accessibility
        const response = await fetch(httpsUrl, {
          method: "HEAD",
          mode: "cors",
          signal: AbortSignal.timeout(5000), // 5s timeout
        });

        return response.ok;
      } catch (err) {
        console.warn("[GCSImport] Access test failed:", err);
        return false;
      }
    },
    [getHttpsUrl]
  );

  /**
   * Validate GCS URL format
   */
  const validateGCSUrl = useCallback(
    (url: string): { isValid: boolean; error?: string } => {
      try {
        parseGCSUrl(url);
        return { isValid: true };
      } catch (err) {
        return {
          isValid: false,
          error: err instanceof Error ? err.message : "Invalid GCS URL",
        };
      }
    },
    [parseGCSUrl]
  );

  return {
    // State
    isImporting,
    importProgress,
    importStatus,
    error,

    // Actions
    importFromGCS,
    testGCSAccess,
    validateGCSUrl,

    // Utilities
    parseGCSUrl,
    getHttpsUrl,
    resetError: () => setError(null),
  };
}
