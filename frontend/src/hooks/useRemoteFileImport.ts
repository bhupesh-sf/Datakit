import { useState, useCallback } from 'react';
import Papa from 'papaparse';
import { useDuckDBStore } from '@/store/duckDBStore';
import { StreamReader } from '@/lib/streamReader';
import useStreamingCSVParser from '@/hooks/stream/useStreamingCSVParser';
import { ColumnType } from '@/types/csv';
import { DataSourceType } from '@/types/json';

// Remote file source types
export type RemoteSourceProvider = 'web' | 's3' | 'gcs';

// Result type from remote file import
export interface RemoteFileImportResult {
  data: string[][];
  columnTypes: ColumnType[];
  fileName: string;
  rowCount: number;
  columnCount: number;
  sourceType: DataSourceType;
  loadedToDuckDB: boolean;
  tableName: string;
  provider: RemoteSourceProvider;
  url: string;
}

/**
 * Custom hook for importing files from remote URLs
 */
export default function useRemoteFileImport() {
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

  // DuckDB store access
  const duckDB = useDuckDBStore();
  
  // CSV parser
  const csvParser = useStreamingCSVParser();

  /**
   * Fetch a remote file with progress tracking
   */
  const fetchWithProgress = useCallback(async (
    url: string,
    options: {
      onProgress?: (bytesReceived: number, totalBytes?: number) => void;
      headers?: HeadersInit;
      timeout?: number;
    } = {}
  ): Promise<{ 
    stream: ReadableStream<Uint8Array>; 
    fileName: string;
    fileSize?: number;
    fileType?: string;
  }> => {
    const { onProgress, headers = {}, timeout = 30000 } = options;
    
    // Set up a timeout controller
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      // Make initial HEAD request to get metadata
      const headResponse = await fetch(url, {
        method: 'HEAD',
        headers,
        signal: AbortSignal.timeout(5000) // Shorter timeout for HEAD
      }).catch(() => null); // Ignore HEAD failures, some servers don't support it
      
      // Get content length and filename from headers if available
      const contentLength = headResponse?.headers.get('content-length');
      const contentDisposition = headResponse?.headers.get('content-disposition');
      const contentType = headResponse?.headers.get('content-type');
      
      let fileName = '';
      
      // Try to get filename from content-disposition header
      if (contentDisposition) {
        const filenameMatch = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
        if (filenameMatch && filenameMatch[1]) {
          fileName = filenameMatch[1].replace(/['"]/g, '').trim();
        }
      }
      
      // If no filename from header, extract from URL
      if (!fileName) {
        const urlObj = new URL(url);
        fileName = urlObj.pathname.split('/').pop() || 'remote_file';
      }
      
      // Make the actual fetch request
      const response = await fetch(url, {
        headers,
        signal: controller.signal
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
      }
      
      // Get file size and type from actual response if not from HEAD
      const fileSize = contentLength ? parseInt(contentLength, 10) : 
                      response.headers.get('content-length') ? 
                      parseInt(response.headers.get('content-length')!, 10) : 
                      undefined;
                      
      const fileType = contentType || response.headers.get('content-type') || undefined;
      
      // Get response body as a stream
      const bodyStream = response.body;
      
      if (!bodyStream) {
        throw new Error('Response body is null');
      }
      
      // If no progress tracking needed, return the stream directly
      if (!onProgress || !fileSize) {
        return { 
          stream: bodyStream,
          fileName,
          fileSize,
          fileType
        };
      }
      
      // Create a TransformStream to track download progress
      const progressTracker = new TransformStream<Uint8Array, Uint8Array>({
        start() {},
        transform(chunk, controller) {
          // Forward the chunk
          controller.enqueue(chunk);
          
          // Track progress via callback
          if (onProgress) {
            // The TransformStream maintains an internal counter
            // @ts-ignore: Property bytesReceived doesn't exist on type TransformStream
            this.bytesReceived = (this.bytesReceived || 0) + chunk.byteLength;
            // @ts-ignore
            onProgress(this.bytesReceived, fileSize);
          }
        }
      });
      
      // Pipe through progress tracker
      const trackedStream = bodyStream.pipeThrough(progressTracker);
      
      // Clean up timeout
      clearTimeout(timeoutId);
      
      return {
        stream: trackedStream,
        fileName,
        fileSize,
        fileType
      };
    } catch (err) {
      // Clean up timeout
      clearTimeout(timeoutId);
      
      // Handle aborted requests specially
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new Error(`Request timed out after ${timeout / 1000} seconds`);
      }
      
      // Rethrow other errors
      throw err;
    }
  }, []);

  /**
   * Import a CSV file from a remote URL
   */
  const importCSVFromURL = useCallback(async (
    url: string,
    provider: RemoteSourceProvider
  ): Promise<RemoteFileImportResult> => {
    try {
      setImportStatus('Connecting...');
      
      // Fetch the file as a stream with progress tracking
      let lastProgress = 0;
      
      const { stream, fileName, fileSize } = await fetchWithProgress(url, {
        onProgress: (bytesReceived, totalBytes) => {
          if (!totalBytes) return;
          
          const downloadProgress = bytesReceived / totalBytes;
          
          // Only report substantial changes to avoid too many updates
          if (downloadProgress - lastProgress >= 0.01) {
            lastProgress = downloadProgress;
            setImportProgress(downloadProgress * 0.5); // Download is first half of progress
            setImportStatus(`Downloading ${fileName}: ${Math.round(downloadProgress * 100)}%`);
          }
        }
      });
      
      // Update status
      setImportStatus(`Processing ${fileName}...`);
      setImportProgress(0.5);
      
      // Create a raw table name
      const rawTableName = fileName
        .replace(/\.[^/.]+$/, "")
        .replace(/[^a-zA-Z0-9_]/g, "_");
      
      // Use the streaming CSV parser to process the data
      const streamReader = new StreamReader(stream);
      
      setImportStatus('Parsing CSV data...');
      
      // Sample the CSV to get headers and column types
      const sampleLines: string[] = [];
      const sampleLimit = 1000; // Number of lines to sample for structure detection
      
      await streamReader.readLines(
        (line) => {
          sampleLines.push(line);
        },
        { maxLines: sampleLimit }
      );
      
      // Parse the sample with PapaParse
      const parseResult = Papa.parse(sampleLines.join('\n'), {
        header: false,
        skipEmptyLines: true
      });
      
      // Extract headers and data from parse result
      const headers = parseResult.data[0] as string[];
      const sampleData = parseResult.data.slice(1) as string[][];
      
      // Detect column types
      const columnTypes = csvParser.detectColumnTypes(sampleData, headers);
      
      setImportStatus('Creating table structure...');
      setImportProgress(0.6);
      
      // Create table in DuckDB
      await duckDB.createTable(rawTableName, headers, columnTypes);
      
      // Create a new stream for the full file
      const { stream: fullStream } = await fetchWithProgress(url);
      const fullStreamReader = new StreamReader(fullStream);
      
      setImportStatus('Importing data to DuckDB...');
      
      // Process in batches
      const batchSize = 5000;
      let batch: string[][] = [];
      let headerSkipped = false;
      let totalRows = 0;
      
      await fullStreamReader.readLines(async (line, lineNumber) => {
        // Skip header row
        if (!headerSkipped) {
          headerSkipped = true;
          return;
        }
        
        // Parse the current line
        const parsedRow = Papa.parse(line, { delimiter: ',' }).data[0] as string[];
        
        // Add to current batch
        batch.push(parsedRow);
        totalRows++;
        
        // Process batch when it reaches batch size
        if (batch.length >= batchSize) {
          await duckDB.insertData(rawTableName, batch);
          
          // Update progress (map 60% to 95%)
          const progressVal = 0.6 + (0.35 * (totalRows / (fileSize ? fileSize / 100 : 10000)));
          setImportProgress(Math.min(0.95, progressVal));
          setImportStatus(`Imported ${totalRows.toLocaleString()} rows...`);
          
          // Clear batch
          batch = [];
          
          // Yield to browser
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      });
      
      // Insert any remaining rows
      if (batch.length > 0) {
        await duckDB.insertData(rawTableName, batch);
      }
      
      // Get final row count
      const countQuery = `SELECT COUNT(*) as count FROM "${rawTableName}"`;
      const countResult = await duckDB.executeQuery(countQuery);
      const rowCount = countResult ? Number(countResult.toArray()[0].count) : totalRows;
      
      setImportProgress(1.0);
      setImportStatus(`Successfully imported ${rowCount.toLocaleString()} rows from ${fileName}`);
      
      // Return result
      return {
        data: [headers, ...sampleData.slice(0, 100)], // First 100 rows for preview
        columnTypes,
        fileName,
        rowCount,
        columnCount: headers.length,
        sourceType: DataSourceType.CSV,
        loadedToDuckDB: true,
        tableName: rawTableName,
        provider,
        url
      };
      
    } catch (err) {
      console.error('CSV import failed:', err);
      throw err;
    }
  }, [fetchWithProgress, csvParser, duckDB]);

  /**
   * Import a JSON file from a remote URL
   */
  const importJSONFromURL = useCallback(async (
    url: string,
    provider: RemoteSourceProvider
  ): Promise<RemoteFileImportResult> => {
    try {
      setImportStatus('Connecting to remote server...');
      
      // Fetch the file with progress tracking
      let lastProgress = 0;
      
      const { stream, fileName, fileSize } = await fetchWithProgress(url, {
        onProgress: (bytesReceived, totalBytes) => {
          if (!totalBytes) return;
          
          const downloadProgress = bytesReceived / totalBytes;
          
          if (downloadProgress - lastProgress >= 0.01) {
            lastProgress = downloadProgress;
            setImportProgress(downloadProgress * 0.6); // Download is 60% of progress for JSON
            setImportStatus(`Downloading ${fileName}: ${Math.round(downloadProgress * 100)}%`);
          }
        }
      });
      
      setImportStatus(`Processing ${fileName}...`);
      setImportProgress(0.6);
      
      // For JSON, we'll convert the stream to a Blob and use DuckDB's direct import
      const reader = new StreamReader(stream);
      const { data } = await reader.readAll();
      
      // Create a File object
      const fileBlob = new Blob([data], { type: 'application/json' });
      const file = new File([fileBlob], fileName, { type: 'application/json' });
      
      setImportStatus(`Importing ${fileName} to DuckDB...`);
      setImportProgress(0.8);
      
      // Use DuckDB's direct import for JSON
      const importResult = await duckDB.importFileDirectly(file);
      
      setImportStatus(`Successfully imported ${importResult.rowCount.toLocaleString()} rows from ${fileName}`);
      setImportProgress(1.0);
      
      // Get schema information
      const schema = await duckDB.getTableSchema(importResult.tableName);
      
      // Determine column types from schema
      const columnTypes = schema?.map(col => {
        // Map DuckDB types to our column types
        if (['DOUBLE', 'INTEGER', 'BIGINT'].includes(col.type)) {
          return ColumnType.Number;
        } else if (['BOOLEAN'].includes(col.type)) {
          return ColumnType.Boolean;
        } else if (['DATE', 'TIMESTAMP'].includes(col.type)) {
          return ColumnType.Date;
        } else if (['STRUCT', 'LIST'].includes(col.type)) {
          return ColumnType.Object;
        } else {
          return ColumnType.Text;
        }
      }) || [];
      
      // Get first 100 rows for preview
      const previewQuery = `SELECT * FROM "${importResult.tableName}" LIMIT 100`;
      const previewResult = await duckDB.executeQuery(previewQuery);
      
      if (!previewResult) {
        throw new Error('Failed to retrieve preview data');
      }
      
      // Convert to string[][] format
      const headers = schema?.map(col => col.name) || [];
      const rows = previewResult.toArray().map(row => {
        return headers.map(header => {
          const value = row[header];
          return value !== null && value !== undefined ? String(value) : '';
        });
      });
      
      return {
        data: [headers, ...rows],
        columnTypes,
        fileName,
        rowCount: importResult.rowCount,
        columnCount: headers.length,
        sourceType: DataSourceType.JSON,
        loadedToDuckDB: true,
        tableName: importResult.tableName,
        provider,
        url
      };
      
    } catch (err) {
      console.error('JSON import failed:', err);
      throw err;
    }
  }, [fetchWithProgress, duckDB]);

  /**
   * Determine file type from URL and import accordingly
   */
  const importFromURL = useCallback(async (
    url: string,
    provider: RemoteSourceProvider = 'web'
  ): Promise<RemoteFileImportResult> => {
    try {
      setIsImporting(true);
      setImportProgress(0);
      setImportStatus('Initializing import...');
      setError(null);
      
      // Extract file extension from URL
      const urlObj = new URL(url);
      const path = urlObj.pathname;
      const fileExt = path.split('.').pop()?.toLowerCase();
      
      // Handle specific providers
      let modifiedUrl = url;
      
      if (provider === 's3') {
        // Handle S3 URLs - for public files, we can use their HTTPS URL
        if (url.startsWith('s3://')) {
          // Convert s3:// URL to https URL if possible
          // This is simplified - a real implementation might use AWS SDK
          const bucket = url.replace('s3://', '').split('/')[0];
          const key = url.replace(`s3://${bucket}/`, '');
          modifiedUrl = `https://${bucket}.s3.amazonaws.com/${key}`;
        }
      } else if (provider === 'gcs') {
        // Handle GCS URLs - for public files, we can use their HTTPS URL
        if (url.startsWith('gs://')) {
          // Convert gs:// URL to https URL
          const bucket = url.replace('gs://', '').split('/')[0];
          const path = url.replace(`gs://${bucket}/`, '');
          modifiedUrl = `https://storage.googleapis.com/${bucket}/${path}`;
        }
      }
      
      // Dispatch based on file type
      if (fileExt === 'csv') {
        return await importCSVFromURL(modifiedUrl, provider);
      } else if (fileExt === 'json') {
        return await importJSONFromURL(modifiedUrl, provider);
      } else {
        throw new Error(`Unsupported file type: ${fileExt || 'unknown'}`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error importing file';
      console.error('Import failed:', errorMessage);
      setError(errorMessage);
      throw err;
    } finally {
      setIsImporting(false);
    }
  }, [importCSVFromURL, importJSONFromURL]);

  /**
   * Check if a URL is accessible (CORS check)
   */
  const checkCORSAccess = useCallback(async (url: string): Promise<boolean> => {
    try {
      // Try a HEAD request to check CORS
      const response = await fetch(url, {
        method: 'HEAD',
        mode: 'cors',
        signal: AbortSignal.timeout(5000) // 5s timeout
      });
      
      return response.ok;
    } catch (err) {
      return false;
    }
  }, []);

  return {
    importFromURL,
    checkCORSAccess,
    isImporting,
    importProgress,
    importStatus,
    error,
    resetError: () => setError(null)
  };
}