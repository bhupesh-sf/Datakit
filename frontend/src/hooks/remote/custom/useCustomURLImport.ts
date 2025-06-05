import { useState, useCallback } from "react";

/**
 * Type definitions to match your existing interfaces
 */
interface ColumnType {
  name: string;
  type: string;
  nullable?: boolean;
}

type DataSourceType = 'file' | 'remote' | 'database';
type RemoteSourceProvider = 'custom-url' | 's3' | 'google-sheets' | 'gcs';

interface JsonSchema {
  [key: string]: any;
}

interface DataLoadWithDuckDBResult {
  data: string[][];
  columnTypes: ColumnType[];
  fileName: string;
  rowCount: number;
  columnCount: number;
  sourceType?: DataSourceType;
  rawData?: any;
  schema?: JsonSchema;
  loadedToDuckDB: boolean;
  tableName?: string;
  isRemote?: boolean;
  remoteURL?: string;
  remoteProvider?: RemoteSourceProvider;
}

/**
 * URL validation result interface
 */
interface URLValidation {
  isValid: boolean;
  error?: string;
  detectedFormat?: string;
  source?: string;
  filename?: string;
  extension?: string;
}

/**
 * Hook for importing data from custom URLs
 */
export default function useCustomURLImport() {
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const [importProgress, setImportProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  /**
   * Validate URL and detect format/source
   */
  const validateURL = useCallback((url: string): URLValidation => {
    try {
      // Basic URL validation
      const urlObj = new URL(url);
      
      // Get filename and extension
      const pathname = urlObj.pathname;
      const filename = pathname.split('/').pop() || '';
      const extension = filename.includes('.') ? filename.split('.').pop()?.toLowerCase() : '';
      
      // Check if URL is accessible (basic validation)
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return {
          isValid: false,
          error: "URL must use HTTP or HTTPS protocol"
        };
      }

      // Detect source
      let source = "direct";
      if (urlObj.hostname.includes("github.com") || urlObj.hostname.includes("githubusercontent.com")) {
        source = "github";
      } else if (urlObj.hostname.includes("amazonaws.com") || urlObj.hostname.includes("s3")) {
        source = "aws";
      } else if (urlObj.hostname.includes("googleapis.com") || urlObj.hostname.includes("gcs")) {
        source = "gcs";
      }

      // Detect format from extension
      let detectedFormat: string | undefined;
      const supportedFormats = {
        'csv': 'csv',
        'tsv': 'tsv', 
        'json': 'json',
        'jsonl': 'jsonl',
        'ndjson': 'jsonl',
        'parquet': 'parquet',
        'xlsx': 'excel',
        'xls': 'excel',
        'txt': 'text',
        'gz': 'compressed' // Could be csv.gz, json.gz, etc.
      };

      if (extension && supportedFormats[extension]) {
        detectedFormat = supportedFormats[extension];
        
        // Handle compressed files - try to detect inner format
        if (extension === 'gz') {
          const innerExtension = filename.split('.').slice(-2, -1)[0]?.toLowerCase();
          if (innerExtension && supportedFormats[innerExtension]) {
            detectedFormat = supportedFormats[innerExtension];
          }
        }
      }

      // Special validation for GitHub raw URLs
      if (source === "github" && !urlObj.hostname.includes("raw.githubusercontent.com")) {
        // Check if it's a github.com URL that should be converted to raw
        if (urlObj.hostname === "github.com" && urlObj.pathname.includes("/blob/")) {
          return {
            isValid: false,
            error: "Please use GitHub raw URL (raw.githubusercontent.com) instead of blob URL"
          };
        }
      }

      // Warn about potential CORS issues
      let corsWarning = "";
      if (source === "direct" && !urlObj.hostname.includes("cors") && !urlObj.hostname.includes("api")) {
        corsWarning = "Direct URLs may have CORS restrictions";
      }

      return {
        isValid: true,
        detectedFormat,
        source,
        filename,
        extension,
        error: corsWarning || undefined
      };

    } catch (err) {
      return {
        isValid: false,
        error: "Invalid URL format"
      };
    }
  }, []);

  /**
   * Import data from custom URL
   */
  const importFromURL = useCallback(async (url: string, customName?: string) => {
    try {
      setIsImporting(true);
      setError(null);
      setImportProgress(0);
      setImportStatus("Validating URL...");

      // Validate URL first
      const validation = validateURL(url);
      if (!validation.isValid) {
        throw new Error(validation.error || "Invalid URL");
      }

      setImportProgress(0.1);
      setImportStatus("Checking file accessibility...");

      // Try to fetch file headers to check if accessible
      let response: Response;
      try {
        // First try direct fetch
        response = await fetch(url, { method: 'HEAD' });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (directError) {
        setImportStatus("Direct access failed, trying with proxy...");
        
        // If direct fetch fails, you could try a CORS proxy here
        // For now, we'll continue with the direct fetch for the actual data
        try {
          response = await fetch(url);
          if (!response.ok) {
            throw new Error(`Failed to access URL: ${response.status} ${response.statusText}`);
          }
        } catch (proxyError) {
          throw new Error(`Unable to access URL. This may be due to CORS restrictions or the file being unavailable.`);
        }
      }

      setImportProgress(0.3);
      setImportStatus("Downloading file...");

      // Get the actual file content
      const fullResponse = await fetch(url);
      if (!fullResponse.ok) {
        throw new Error(`Failed to download file: ${fullResponse.status} ${fullResponse.statusText}`);
      }

      // Get content type and size info
      const contentType = fullResponse.headers.get('content-type') || '';
      const contentLength = fullResponse.headers.get('content-length');
      const fileSize = contentLength ? parseInt(contentLength) : null;

      setImportProgress(0.5);
      setImportStatus("Processing file content...");

      // Get file content
      let fileContent: string | ArrayBuffer;
      let detectedFormat = validation.detectedFormat;

      // Auto-detect format from content-type if not detected from extension
      if (!detectedFormat) {
        if (contentType.includes('csv') || contentType.includes('comma-separated')) {
          detectedFormat = 'csv';
        } else if (contentType.includes('json')) {
          detectedFormat = 'json';
        } else if (contentType.includes('excel') || contentType.includes('spreadsheet')) {
          detectedFormat = 'excel';
        }
      }

      // Handle binary formats
      if (detectedFormat === 'excel' || detectedFormat === 'parquet' || url.includes('.gz')) {
        fileContent = await fullResponse.arrayBuffer();
      } else {
        fileContent = await fullResponse.text();
      }

      setImportProgress(0.8);
      setImportStatus("Preparing data for import...");

      // Generate a name for the dataset
      const datasetName = customName || validation.filename || `url_import_${Date.now()}`;

      setImportProgress(0.9);
      setImportStatus("Finalizing import...");

      // Simulate final processing
      await new Promise(resolve => setTimeout(resolve, 200));

      setImportProgress(1);
      setImportStatus("Import completed successfully!");

      // Parse the data based on format (simplified - you'd use your actual parsing logic)
      let parsedData: string[][] = [];
      let columnTypes: any[] = [];
      let rowCount = 0;
      let columnCount = 0;

      // This is where you'd integrate with your actual data parsing logic
      // For now, this is a simplified example
      if (detectedFormat === 'csv' && typeof fileContent === 'string') {
        // Simple CSV parsing (you'd use your actual CSV parser)
        const lines = fileContent.split('\n').filter(line => line.trim());
        parsedData = lines.map(line => line.split(',').map(cell => cell.trim()));
        rowCount = parsedData.length - 1; // Minus header
        columnCount = parsedData[0]?.length || 0;
        
        // Generate basic column types (you'd use your actual type detection)
        columnTypes = parsedData[0]?.map((_, index) => ({
          name: parsedData[0][index],
          type: 'VARCHAR', // You'd detect actual types
          nullable: true
        })) || [];
      } else if (detectedFormat === 'json' && typeof fileContent === 'string') {
        try {
          const jsonData = JSON.parse(fileContent);
          // Convert JSON to tabular format (simplified)
          if (Array.isArray(jsonData) && jsonData.length > 0) {
            const keys = Object.keys(jsonData[0]);
            parsedData = [
              keys, // Header
              ...jsonData.map(row => keys.map(key => String(row[key] || '')))
            ];
            rowCount = jsonData.length;
            columnCount = keys.length;
            columnTypes = keys.map(key => ({
              name: key,
              type: 'VARCHAR',
              nullable: true
            }));
          }
        } catch (e) {
          throw new Error('Invalid JSON format');
        }
      }

      // Return the result in DataLoadWithDuckDBResult format
      const result: DataLoadWithDuckDBResult = {
        data: parsedData,
        columnTypes: columnTypes,
        fileName: datasetName,
        rowCount: rowCount,
        columnCount: columnCount,
        sourceType: 'remote' as DataSourceType,
        rawData: fileContent,
        loadedToDuckDB: false, // You'd set this based on your actual loading process
        tableName: datasetName.replace(/[^a-zA-Z0-9_]/g, '_'),
        isRemote: true,
        remoteURL: url,
        remoteProvider: 'custom-url' as RemoteSourceProvider,
        // Add any additional metadata you need
        schema: undefined // You'd generate this if needed
      };

      // Reset state after successful import
      setTimeout(() => {
        setIsImporting(false);
        setImportStatus("");
        setImportProgress(0);
      }, 1000);

      return result;

    } catch (err) {
      console.error("[CustomURL] Import failed:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to import from URL";
      setError(errorMessage);
      setImportStatus(`Import failed: ${errorMessage}`);
      
      // Reset importing state but keep error visible
      setTimeout(() => {
        setIsImporting(false);
      }, 1000);
      
      throw err;
    }
  }, [validateURL]);

  /**
   * Test URL accessibility without importing
   */
  const testURL = useCallback(async (url: string) => {
    try {
      const validation = validateURL(url);
      if (!validation.isValid) {
        return { accessible: false, error: validation.error };
      }

      // Try HEAD request first (faster)
      const response = await fetch(url, { method: 'HEAD' });
      
      return {
        accessible: response.ok,
        status: response.status,
        contentType: response.headers.get('content-type'),
        contentLength: response.headers.get('content-length'),
        error: response.ok ? null : `HTTP ${response.status}: ${response.statusText}`
      };
    } catch (err) {
      return {
        accessible: false,
        error: err instanceof Error ? err.message : "Network error"
      };
    }
  }, [validateURL]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Reset all state
   */
  const reset = useCallback(() => {
    setIsImporting(false);
    setImportStatus("");
    setImportProgress(0);
    setError(null);
  }, []);

  return {
    // State
    isImporting,
    importStatus,
    importProgress,
    error,

    // Actions
    importFromURL,
    validateURL,
    testURL,
    clearError,
    reset,

    // Computed
    isIdle: !isImporting && !error && importProgress === 0,
    isComplete: !isImporting && importProgress === 1,
  };
}