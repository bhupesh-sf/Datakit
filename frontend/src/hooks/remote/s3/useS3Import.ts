import { useState, useCallback } from "react";
import { useDuckDBStore } from "@/store/duckDBStore";
import { ColumnType } from "@/types/csv";
import { DataSourceType } from "@/types/json";

/**
 * Result type from S3 file import
 */
export interface S3ImportResult {
  data: string[][];
  columnTypes: ColumnType[];
  fileName: string;
  rowCount: number;
  columnCount: number;
  sourceType: DataSourceType;
  loadedToDuckDB: boolean;
  tableName: string;
  s3: {
    bucket: string;
    key: string;
    region?: string;
    url: string;
    fileSize?: number;
    method: 'direct' | 'proxy' | 'failed';
  };
}

/**
 * S3 URL validation result
 */
export interface S3UrlValidation {
  isValid: boolean;
  bucket?: string;
  key?: string;
  region?: string;
  httpsUrl?: string;
  extension?: string;
  error?: string;
}

/**
 * Utility function to get data source type from extension
 */
const getDataSourceTypeFromExtension = (extension: string): DataSourceType => {
  const ext = extension.toLowerCase();
  
  if (ext === 'csv' || ext === 'tsv') return DataSourceType.CSV;
  if (ext === 'json' || ext === 'jsonl') return DataSourceType.JSON;
  if (ext === 'xlsx' || ext === 'xls') return DataSourceType.XLSX;
  if (ext === 'parquet') return DataSourceType.PARQUET;
  if (ext === 'txt') return DataSourceType.TXT;
  
  return DataSourceType.CSV; // Default fallback
};

/**
 * Extract file extension from S3 URL path
 */
const extractFileExtensionFromUrl = (url: string): string => {
  try {
    const urlParts = url.split('/');
    const fullFileName = urlParts[urlParts.length - 1];
    const cleanFileName = fullFileName.split('?')[0];
    
    // Handle .gz files specially
    if (cleanFileName.endsWith('.gz')) {
      const withoutGz = cleanFileName.slice(0, -3);
      const parts = withoutGz.split('.');
      if (parts.length > 1) {
        const innerExt = parts.pop()!;
        return innerExt; // Return the inner extension without .gz
      }
      return 'txt';
    }
    
    const parts = cleanFileName.split('.');
    if (parts.length > 1) {
      return parts.pop()!;
    }
    
    return 'txt';
  } catch (err) {
    console.warn('[S3Import] Failed to extract extension from URL:', url, err);
    return 'txt';
  }
};

/**
 * CORS proxy options for S3 datasets that don't support direct browser access
 */
const CORS_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?',
  'https://cors-anywhere.herokuapp.com/',
];

/**
 * Hook for importing files from S3 buckets with smart CORS handling
 */
export default function useS3Import() {
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  const duckDB = useDuckDBStore();

  /**
   * Parse S3 URL and extract components
   */
  const parseS3Url = useCallback((s3Url: string): S3UrlValidation => {
    try {
      let bucket: string;
      let key: string;
      let region: string | undefined;
      let httpsUrl: string;

      if (s3Url.startsWith("s3://")) {
        // s3://bucket/key format
        const parts = s3Url.replace("s3://", "").split("/");
        bucket = parts[0];
        key = parts.slice(1).join("/");
        
        if (!bucket || !key) {
          return {
            isValid: false,
            error: "S3 URL must include both bucket and key (s3://bucket/path/file.ext)"
          };
        }
        
        // Generate HTTPS URL (assume us-east-1 if no region specified)
        httpsUrl = `https://${bucket}.s3.amazonaws.com/${key}`;
        
      } else if (s3Url.includes(".s3.") || s3Url.includes("s3.amazonaws.com")) {
        // https://bucket.s3.amazonaws.com/key format
        httpsUrl = s3Url;
        const urlObj = new URL(s3Url);
        
        if (urlObj.hostname.startsWith("s3.")) {
          // https://s3.region.amazonaws.com/bucket/key
          const pathParts = urlObj.pathname.substring(1).split("/");
          bucket = pathParts[0];
          key = pathParts.slice(1).join("/");
          region = urlObj.hostname.split(".")[1];
        } else {
          // https://bucket.s3.region.amazonaws.com/key
          bucket = urlObj.hostname.split(".")[0];
          key = urlObj.pathname.substring(1);
          const hostParts = urlObj.hostname.split(".");
          region = hostParts.length > 3 ? hostParts[2] : "us-east-1";
        }
        
      } else {
        return {
          isValid: false,
          error: "Must be a valid S3 URL (s3://bucket/key or https://bucket.s3.amazonaws.com/key)"
        };
      }

      // Validate file extension
      const extension = extractFileExtensionFromUrl(key);
      const supportedExtensions = ['csv', 'tsv', 'json', 'jsonl', 'xlsx', 'xls', 'parquet', 'txt'];
      
      if (!supportedExtensions.includes(extension)) {
        return {
          isValid: false,
          error: `Unsupported file format: .${extension}. Supported: ${supportedExtensions.join(', ')}`
        };
      }

      return {
        isValid: true,
        bucket,
        key,
        region,
        httpsUrl,
        extension
      };

    } catch (err) {
      return {
        isValid: false,
        error: `Invalid S3 URL format: ${err instanceof Error ? err.message : 'Unknown error'}`
      };
    }
  }, []);

  /**
   * Test CORS access to a URL
   */
  const testCORSAccess = useCallback(async (url: string): Promise<boolean> => {
    try {
      const response = await fetch(url, {
        method: "HEAD",
        mode: "cors",
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch (err) {
      return false;
    }
  }, []);

  /**
   * Try to fetch file with CORS proxy fallbacks
   */
  const fetchWithCORSFallback = useCallback(
    async (
      originalUrl: string,
      onProgress?: (loaded: number, total?: number) => void
    ): Promise<{ blob: Blob; method: 'direct' | 'proxy'; fileName: string; fileSize: number }> => {
      const fileName = originalUrl.split("/").pop()?.split("?")[0] || "s3_file";

      // First, try direct access
      setImportStatus(`Testing direct access to ${fileName}...`);
      const hasDirectCORS = await testCORSAccess(originalUrl);

      if (hasDirectCORS) {
        setImportStatus(`Direct access available for ${fileName}`);
        const result = await fetchDirectly(originalUrl, onProgress);
        return { ...result, method: 'direct' };
      }

      // Try CORS proxies
      setImportStatus(`Direct access blocked, trying CORS proxies for ${fileName}...`);

      for (let i = 0; i < CORS_PROXIES.length; i++) {
        const proxyUrl = CORS_PROXIES[i] + encodeURIComponent(originalUrl);

        try {
          setImportStatus(`Trying CORS proxy ${i + 1}/${CORS_PROXIES.length} for ${fileName}...`);

          const response = await fetch(proxyUrl, { mode: 'cors' });
          if (response.ok) {
            const blob = await response.blob();
            const fileSize = blob.size;
            
            setImportStatus(`Successfully downloaded ${fileName} via proxy`);
            return { blob, method: 'proxy', fileName, fileSize };
          }
        } catch (err) {
          console.warn(`CORS proxy ${i + 1} failed:`, err);
        }
      }

      throw new Error(
        `Cannot access S3 file due to CORS restrictions. Try:\n` +
        `• AWS CLI: aws s3 cp ${originalUrl} ./data.ext --no-sign-request\n` +
        `• Download manually and use local file import`
      );
    },
    [testCORSAccess]
  );

  /**
   * Direct fetch implementation
   */
  const fetchDirectly = useCallback(
    async (
      url: string,
      onProgress?: (loaded: number, total?: number) => void
    ): Promise<{ blob: Blob; fileName: string; fileSize: number }> => {
      
      const fileName = url.split("/").pop()?.split("?")[0] || "s3_file";

      // Get file size if possible
      const headResponse = await fetch(url, {
        method: "HEAD",
        mode: "cors",
      }).catch(() => null);

      const contentLength = headResponse?.headers.get("content-length");
      const fileSize = contentLength ? parseInt(contentLength, 10) : 0;

      setImportStatus(`Downloading ${fileName}${fileSize ? ` (${(fileSize / 1024 / 1024).toFixed(1)}MB)` : ''}...`);

      // Fetch the actual file
      const response = await fetch(url, { mode: "cors" });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("Access denied. This S3 object may not be publicly accessible.");
        } else if (response.status === 404) {
          throw new Error("File not found in S3 bucket.");
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      }

      // Process response with progress tracking
      const reader = response.body?.getReader();
      if (!reader) {
        const blob = await response.blob();
        return { blob, fileName, fileSize: blob.size };
      }

      const chunks: Uint8Array[] = [];
      let receivedLength = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        receivedLength += value.length;

        if (onProgress) {
          onProgress(receivedLength, fileSize || undefined);
        }

        if (fileSize > 0) {
          const progress = receivedLength / fileSize;
          setImportProgress(progress * 0.5);
        }
      }

      const allChunks = new Uint8Array(receivedLength);
      let position = 0;
      for (const chunk of chunks) {
        allChunks.set(chunk, position);
        position += chunk.length;
      }

      const blob = new Blob([allChunks]);
      return { blob, fileName, fileSize: receivedLength };
    },
    []
  );

  /**
   * Handle .gz file decompression
   */
  const decompressGzFile = useCallback(async (blob: Blob): Promise<Blob> => {
    try {
      const stream = new Response(blob).body?.pipeThrough(new DecompressionStream('gzip'));
      if (stream) {
        const response = new Response(stream);
        return await response.blob();
      }
      throw new Error('DecompressionStream not available');
    } catch (error) {
      console.warn('Decompression failed:', error);
      throw new Error('Failed to decompress .gz file. Your browser may not support this feature.');
    }
  }, []);

  /**
   * Import a file from S3
   */
  const importFromS3 = useCallback(
    async (s3Url: string, customFileName?: string): Promise<S3ImportResult> => {
      try {
        setIsImporting(true);
        setImportProgress(0);
        setError(null);
        setImportStatus("Validating S3 URL...");

        // Parse and validate S3 URL
        const urlValidation = parseS3Url(s3Url);
        if (!urlValidation.isValid) {
          throw new Error(urlValidation.error || 'Invalid S3 URL');
        }

        const { bucket, key, region, httpsUrl, extension } = urlValidation;
        console.log(`[S3Import] Importing from s3://${bucket}/${key}`);

        setImportProgress(0.1);

        // Download file with CORS fallback
        const { blob, method, fileName, fileSize } = await fetchWithCORSFallback(httpsUrl!);

        setImportProgress(0.5);
        setImportStatus("Processing file with DuckDB...");

        // Handle .gz decompression if needed
        let finalBlob = blob;
        let finalExtension = extension!;
        
        if (key!.endsWith('.gz')) {
          setImportStatus("Decompressing .gz file...");
          setImportProgress(0.55);
          
          try {
            finalBlob = await decompressGzFile(blob);
            // Remove .gz from extension for processing
            finalExtension = extractFileExtensionFromUrl(key!.replace('.gz', ''));
            console.log('🔧 Decompressed .gz file successfully');
          } catch (decompressError) {
            console.warn('Failed to decompress .gz file, using original:', decompressError);
            // Continue with original blob if decompression fails
          }
          
          setImportProgress(0.6);
        }
        
        // Create a proper filename
        const displayName = customFileName || fileName.replace(/\.(gz)$/, '') || 'imported_s3_file';
        const cleanDisplayName = displayName.replace(/[^a-zA-Z0-9_-]/g, '_');
        const finalFileName = `${cleanDisplayName}.${finalExtension}`;
        
        // Get MIME type
        const mimeTypes: Record<string, string> = {
          csv: 'text/csv',
          tsv: 'text/tab-separated-values',
          json: 'application/json',
          parquet: 'application/octet-stream',
          xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          xls: 'application/vnd.ms-excel',
          txt: 'text/plain',
        };
        const mimeType = mimeTypes[finalExtension] || 'application/octet-stream';

        const file = new File([finalBlob], finalFileName, { type: mimeType });

        console.log('🔧 S3 file import details:');
        console.log('  S3 URL:', s3Url);
        console.log('  Bucket:', bucket);
        console.log('  Key:', key);
        console.log('  Final filename:', finalFileName);
        console.log('  MIME type:', mimeType);
        console.log('  Access method:', method);

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
          if (type.includes("int") || type.includes("float") || type.includes("double")) {
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

        // Determine source type from file extension
        const sourceType = getDataSourceTypeFromExtension(finalExtension);

        setImportProgress(1.0);
        setImportStatus(`Successfully imported ${importResult.rowCount.toLocaleString()} rows from S3`);

        const result: S3ImportResult = {
          data: sampleData,
          columnTypes,
          fileName: finalFileName,
          rowCount: importResult.rowCount,
          columnCount: headers.length,
          sourceType,
          loadedToDuckDB: true,
          tableName: importResult.tableName,
          s3: {
            bucket: bucket!,
            key: key!,
            region,
            url: s3Url,
            fileSize,
            method,
          },
        };

        console.log(`[S3Import] Successfully imported S3 file: ${finalFileName}`);
        return result;

      } catch (err) {
        console.error("[S3Import] Import failed:", err);
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);
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
    [duckDB, parseS3Url, fetchWithCORSFallback, decompressGzFile]
  );

  /**
   * Test if an S3 URL is accessible (CORS check)
   */
  const testS3Access = useCallback(
    async (s3Url: string): Promise<boolean> => {
      try {
        const urlValidation = parseS3Url(s3Url);
        if (!urlValidation.isValid || !urlValidation.httpsUrl) {
          return false;
        }
        return await testCORSAccess(urlValidation.httpsUrl);
      } catch (err) {
        console.warn("[S3Import] Access test failed:", err);
        return false;
      }
    },
    [parseS3Url, testCORSAccess]
  );

  /**
   * Validate S3 URL format
   */
  const validateS3Url = useCallback(
    (url: string): S3UrlValidation => {
      return parseS3Url(url);
    },
    [parseS3Url]
  );

  return {
    // State
    isImporting,
    importProgress,
    importStatus,
    error,

    // Actions
    importFromS3,
    testS3Access,
    validateS3Url,
    parseS3Url,

    // Utilities
    resetError: () => setError(null),
  };
}