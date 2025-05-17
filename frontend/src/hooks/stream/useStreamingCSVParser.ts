import { useState } from 'react';
import Papa from 'papaparse';
import { StreamReader } from '@/lib/streamReader';

import { ColumnType, CSVParseResult, CSVParseOptions } from '@/types/csv';

export interface StreamingCSVParseStats {
  bytesProcessed: number;
  rowsProcessed: number;
  chunksProcessed: number;
  totalBytes?: number;
  estimatedTotalRows?: number;
  processingSpeed?: number; // rows per second
  estimatedTimeRemaining?: number; // seconds
  startTime?: number;
}

export function useStreamingCSVParser() {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [parseStats, setParseStats] = useState<StreamingCSVParseStats>({
    bytesProcessed: 0,
    rowsProcessed: 0,
    chunksProcessed: 0
  });

  /**
   * Detect column types from a sample of data rows
   */
  const detectColumnTypes = (data: string[][], headers: string[]): ColumnType[] => {
    if (!data || data.length === 0 || !headers) return [];
    
    const types = Array(headers.length).fill(ColumnType.Unknown);
    
    // Process rows to detect types
    for (const row of data) {
      for (let j = 0; j < Math.min(row.length, headers.length); j++) {
        const value = row[j]?.trim();
        if (!value) continue;
        
        // If already detected as text, no need to check further
        if (types[j] === ColumnType.Text) continue;
        
        // Try to parse as number
        if (!isNaN(Number(value)) && value !== '') {
          if (types[j] === ColumnType.Unknown) {
            types[j] = ColumnType.Number;
          }
          continue;
        }
        
        // Try to parse as boolean
        if (/^(true|false|yes|no)$/i.test(value)) {
          if (types[j] === ColumnType.Unknown) {
            types[j] = ColumnType.Boolean;
          }
          continue;
        }
        
        // Try to parse as date
        if (/^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/.test(value)) {
          if (types[j] === ColumnType.Unknown || types[j] === ColumnType.Number) {
            types[j] = ColumnType.Date;
          }
          continue;
        }
        
        // Default to text
        types[j] = ColumnType.Text;
      }
    }
    
    return types;
  };

  /**
   * Parse large CSV files in chunks with progress tracking and browser yielding
   */
  const parseCSVStream = async (
    fileStream: ReadableStream<Uint8Array>,
    options: {
      chunkSize?: number;
      batchSize?: number; // Number of rows to process before yielding
      delimiter?: string;
      onChunkParsed?: (chunk: string[][], headers: string[], isFirstChunk: boolean) => Promise<void>;
      onProgress?: (progress: number, stats: StreamingCSVParseStats) => void;
      onComplete?: (result: CSVParseResult) => void;
      estimatedTotalBytes?: number;
      sampleRowsLimit?: number;
    } = {}
  ): Promise<CSVParseResult> => {
    const {
      chunkSize = 50000,
      batchSize = 50000, // Process 5000 rows at a time
      delimiter = ',',
      onChunkParsed,
      onProgress,
      onComplete,
      estimatedTotalBytes,
      sampleRowsLimit = 1000000
    } = options;
    
    try {
      setIsLoading(true);
      setError(null);
      setProgress(0);
      
      // Initialize parser stats
      const stats: StreamingCSVParseStats = {
        bytesProcessed: 0,
        rowsProcessed: 0,
        chunksProcessed: 0,
        totalBytes: estimatedTotalBytes,
        startTime: Date.now()
      };
      
      // Use StreamReader to efficiently process the file in chunks
      const streamReader = new StreamReader(fileStream);
      
      // Variables to accumulate data
      let headers: string[] = [];
      let headersParsed = false;
      let sampleData: string[][] = [];
      let buffer = '';
      let lineCount = 0;
      const textDecoder = new TextDecoder();
      
      // Batch processing variables
      let currentBatch: string[][] = [];
      let lastYieldTime = Date.now();
      
      // Process the stream in chunks
      await streamReader.readByChunks(async (chunk) => {
        // Decode the chunk and add to buffer
        const text = textDecoder.decode(chunk, { stream: true });
        buffer += text;
        
        // Process complete lines
        let lines: string[] = [];
        let lastNewlineIndex = buffer.lastIndexOf('\n');
        
        if (lastNewlineIndex !== -1) {
          // Extract complete lines
          lines = buffer.substring(0, lastNewlineIndex).split('\n');
          buffer = buffer.substring(lastNewlineIndex + 1);
          
          // Parse lines
          for (const line of lines) {
            if (!line.trim()) continue;
            
            let parsedRow: string[];
            
            if (!headersParsed) {
              // Parse headers from first line
              headers = Papa.parse(line, { delimiter }).data[0] as string[];
              headersParsed = true;
              continue;
            } else {
              // Parse data row
              parsedRow = Papa.parse(line, { delimiter }).data[0] as string[];
            }
            
            currentBatch.push(parsedRow);
            lineCount++;
            
            // Update sample data for column type detection
            if (sampleData.length < sampleRowsLimit) {
              sampleData.push(parsedRow);
            }
            
            // Process batch when it reaches batch size
            if (currentBatch.length >= batchSize) {
              await processBatch();
            }
          }
        }
        
        // Update stats
        stats.bytesProcessed = streamReader.getBytesProcessed();
        stats.chunksProcessed++;
        
        // Calculate processing speed and estimated time
        updateProcessingStats(stats);
        
        setParseStats(stats);
        
        // Update progress
        const progressValue = estimatedTotalBytes 
          ? stats.bytesProcessed / estimatedTotalBytes 
          : 0;
        setProgress(progressValue);
        
        if (onProgress) {
          onProgress(progressValue, stats);
        }
      });
      
      // Process any remaining data in buffer
      if (buffer.trim().length > 0) {
        const parsedRow = Papa.parse(buffer, { delimiter }).data[0] as string[];
        if (parsedRow.length > 0) {
          currentBatch.push(parsedRow);
        }
      }
      
      // Process remaining batch
      if (currentBatch.length > 0) {
        await processBatch();
      }
      
      // Detect column types from sample
      const columnTypes = detectColumnTypes(sampleData, headers);
      
      // Prepare complete result
      const result: CSVParseResult = {
        // Include headers as first row for consistency with existing code
        data: [headers, ...sampleData],
        columnTypes,
        fileName: 'streamed-csv',
        rowCount: stats.rowsProcessed,
        columnCount: headers.length,
        stats: {
          ...stats,
          rowsProcessed: stats.rowsProcessed
        }
      };
      
      // Call completion handler
      if (onComplete) {
        onComplete(result);
      }
      
      setIsLoading(false);
      setProgress(1);
      
      return result;
      
      // Helper function to process a batch
      async function processBatch() {
        // Update stats
        stats.rowsProcessed += currentBatch.length;
        
        // Calculate processing speed and estimated time
        updateProcessingStats(stats);
        
        // Call custom chunk handler if provided
        if (onChunkParsed) {
          await onChunkParsed(currentBatch, headers, stats.chunksProcessed === 1);
        }
        
        // Clear the batch
        const processedBatch = currentBatch;
        currentBatch = [];
        
        // Yield control to browser if enough time has passed
        const currentTime = Date.now();
        if (currentTime - lastYieldTime > 16) { // ~60fps
          await new Promise(resolve => {
            if (typeof requestAnimationFrame !== 'undefined') {
              requestAnimationFrame(resolve);
            } else {
              setTimeout(resolve, 0);
            }
          });
          lastYieldTime = currentTime;
        }
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error parsing CSV';
      setError(errorMessage);
      setIsLoading(false);
      throw err;
    }
  };
  
  /**
   * Calculate processing speed and estimated time remaining
   */
  function updateProcessingStats(stats: StreamingCSVParseStats) {
    if (!stats.startTime) return;
    
    const currentTime = Date.now();
    const elapsedTime = currentTime - stats.startTime;
    
    if (elapsedTime > 0) {
      // Calculate processing speed (rows per second)
      stats.processingSpeed = (stats.rowsProcessed / elapsedTime) * 1000;
      
      // Estimate total rows if we have file size
      if (stats.totalBytes && stats.bytesProcessed > 0) {
        stats.estimatedTotalRows = Math.round(
          stats.rowsProcessed * (stats.totalBytes / stats.bytesProcessed)
        );
        
        // Estimate time remaining
        if (stats.processingSpeed > 0) {
          const remainingRows = stats.estimatedTotalRows - stats.rowsProcessed;
          stats.estimatedTimeRemaining = remainingRows / stats.processingSpeed;
        }
      }
    }
  }
  
  /**
   * Main function to parse a CSV file
   */
  const parseCSV = async (
    file: File,
    options: {
      batchSize?: number;
      delimiter?: string;
      onChunkParsed?: (chunk: string[][], headers: string[], isFirstChunk: boolean) => Promise<void>;
      onProgress?: (progress: number, stats: StreamingCSVParseStats) => void;
      sampleRowsLimit?: number;
    } = {}
  ): Promise<CSVParseResult> => {
    try {
      setIsLoading(true);
      setError(null);
      setProgress(0);
      
      // Stream the file
      const fileStream = file.stream();
      
      // Parse the stream
      const result = await parseCSVStream(fileStream, {
        ...options,
        estimatedTotalBytes: file.size,
        onComplete: (result) => {
          result.fileName = file.name;
        }
      });
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error parsing CSV';
      setError(errorMessage);
      setIsLoading(false);
      throw err;
    }
  };
  
  /**
   * Parse a small fragment of CSV text directly
   * Useful for testing or small data snippets
   */
  const parseCSVText = (
    text: string,
    options: {
      delimiter?: string;
      header?: boolean;
    } = {}
  ): CSVParseResult => {
    try {
      const { delimiter = ',', header = true } = options;
      
      // Use PapaParse directly for small text fragments
      const parseResult = Papa.parse(text, {
        delimiter,
        header: false, // We'll handle headers ourselves for consistency
        skipEmptyLines: true
      });
      
      // Extract data
      const rawData = parseResult.data as string[][];
      
      if (rawData.length === 0) {
        throw new Error('No data found in CSV text');
      }
      
      // Extract headers and data
      const headers = header ? rawData[0] : rawData[0].map((_, i) => `Column ${i + 1}`);
      const data = header ? rawData : [headers, ...rawData];
      
      // Detect column types
      const columnTypes = detectColumnTypes(
        header ? rawData.slice(1) : rawData,
        headers
      );
      
      // Prepare result
      const result: CSVParseResult = {
        data,
        columnTypes,
        fileName: 'csv-text',
        rowCount: data.length - 1, // Exclude header row
        columnCount: headers.length,
        stats: {
          bytesProcessed: text.length,
          rowsProcessed: data.length - 1,
          chunksProcessed: 1
        }
      };
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error parsing CSV text';
      setError(errorMessage);
      throw err;
    }
  };
  
  // Helper function to format time
  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${Math.round(seconds)} seconds`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.round(seconds % 60);
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  };
  
  // Helper function to format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };
  
  return {
    parseCSV,
    parseCSVStream,
    parseCSVText,
    isLoading,
    progress,
    error,
    stats: parseStats,
    formatTime,
    formatFileSize
  };
}

export default useStreamingCSVParser;