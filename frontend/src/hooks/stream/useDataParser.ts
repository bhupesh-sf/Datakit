import { useState } from 'react';
import { ColumnType } from '@/types/csv';
import { DataSourceType, DataParseResult } from '@/types/json';
import useStreamingCSVParser, { StreamingCSVParseStats } from './useStreamingCSVParser';
import useStreamingJSONParser, { StreamingJSONParseStats } from './useStreamingJSONParser';

export type ParseStats = StreamingCSVParseStats | StreamingJSONParseStats;

/**
 * Unified data parser that supports both CSV and JSON data
 */
export function useDataParser() {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ParseStats | null>(null);
  
  // Import individual parsers
  const csvParser = useStreamingCSVParser();
  const jsonParser = useStreamingJSONParser();
  
  /**
   * Parse a file based on its type
   */
  const parseFile = async (
    file: File, 
    options: {
      onProgress?: (progress: number, stats: ParseStats) => void;
      onChunkParsed?: (chunk: any, isFirstChunk: boolean) => void;
    } = {}
  ): Promise<DataParseResult | null> => {
    setIsLoading(true);
    setError(null);
    setProgress(0);
    
    try {
      // Determine file type by extension
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      
      if (fileExtension === 'csv') {
        // Use CSV parser
        const result = await csvParser.parseCSV(file, {
          onProgress: (progress, stats) => {
            setProgress(progress);
            setStats(stats);
            if (options.onProgress) {
              options.onProgress(progress, stats);
            }
          },
          onChunkParsed: options.onChunkParsed 
            ? (chunk, headers, isFirstChunk) => options.onChunkParsed!(chunk, isFirstChunk)
            : undefined
        });
        
        // Convert to unified format
        const unifiedResult: DataParseResult = {
          ...result,
          sourceType: DataSourceType.CSV
        };
        
        setIsLoading(false);
        return unifiedResult;
      } 
      else if (fileExtension === 'json') {
        // Use JSON parser
        const result = await jsonParser.parseJson(file, {
          onProgress: (progress, stats) => {
            setProgress(progress);
            setStats(stats);
            if (options.onProgress) {
              options.onProgress(progress, stats);
            }
          },
          onChunkParsed: options.onChunkParsed
        });
        
        setIsLoading(false);
        return result;
      } 
      else {
        throw new Error(`Unsupported file format: ${fileExtension}`);
      }
    } catch (err) {
      setError(`Error parsing file: ${err instanceof Error ? err.message : String(err)}`);
      setIsLoading(false);
      throw err;
    }
  };
  
  /**
   * Stream parse a file from a ReadableStream
   */
  const parseStream = async (
    stream: ReadableStream<Uint8Array>,
    fileType: 'csv' | 'json',
    options: {
      onProgress?: (progress: number, stats: ParseStats) => void;
      onChunkParsed?: (chunk: any, isFirstChunk: boolean) => void;
      fileName?: string;
      estimatedTotalBytes?: number;
    } = {}
  ): Promise<DataParseResult | null> => {
    setIsLoading(true);
    setError(null);
    setProgress(0);
    
    try {
      if (fileType === 'csv') {
        // Use CSV parser
        const result = await csvParser.parseCSVStream(stream, {
          onProgress: (progress, stats) => {
            setProgress(progress);
            setStats(stats);
            if (options.onProgress) {
              options.onProgress(progress, stats);
            }
          },
          onChunkParsed: options.onChunkParsed 
            ? (chunk, headers, isFirstChunk) => options.onChunkParsed!(chunk, isFirstChunk)
            : undefined,
          estimatedTotalBytes: options.estimatedTotalBytes,
          onComplete: (result) => {
            if (options.fileName) {
              result.fileName = options.fileName;
            }
          }
        });
        
        // Convert to unified format
        const unifiedResult: DataParseResult = {
          ...result,
          sourceType: DataSourceType.CSV
        };
        
        setIsLoading(false);
        return unifiedResult;
      } 
      else if (fileType === 'json') {
        // Use JSON parser
        const result = await jsonParser.parseJSONStream(stream, {
          onProgress: (progress, stats) => {
            setProgress(progress);
            setStats(stats);
            if (options.onProgress) {
              options.onProgress(progress, stats);
            }
          },
          onChunkParsed: options.onChunkParsed,
          estimatedTotalBytes: options.estimatedTotalBytes,
          onComplete: (result) => {
            if (options.fileName) {
              result.fileName = options.fileName;
            }
          }
        });
        
        setIsLoading(false);
        return result;
      } 
      else {
        throw new Error(`Unsupported file type: ${fileType}`);
      }
    } catch (err) {
      setError(`Error parsing stream: ${err instanceof Error ? err.message : String(err)}`);
      setIsLoading(false);
      throw err;
    }
  };
  
  /**
   * Parse text directly (for testing or small data snippets)
   */
  const parseText = (
    text: string,
    textType: 'csv' | 'json',
    options: {
      delimiter?: string; // For CSV
      header?: boolean;   // For CSV
    } = {}
  ): DataParseResult => {
    try {
      if (textType === 'csv') {
        // Use CSV parser
        const result = csvParser.parseCSVText(text, options);
        
        // Convert to unified format
        return {
          ...result,
          sourceType: DataSourceType.CSV
        };
      } 
      else if (textType === 'json') {
        // Use JSON parser
        return jsonParser.parseJsonText(text);
      } 
      else {
        throw new Error(`Unsupported text type: ${textType}`);
      }
    } catch (err) {
      setError(`Error parsing text: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  };
  
  /**
   * Detect column types from a data sample
   */
  const detectColumnTypes = (
    data: string[][], 
    sourceType: DataSourceType = DataSourceType.CSV
  ): ColumnType[] => {
    try {
      if (sourceType === DataSourceType.CSV) {
        // Use CSV parser's type detection
        if (data.length < 2) return [];
        
        return csvParser.parseCSVText(
          data.map(row => row.join(',')).join('\n'), 
          { header: true }
        ).columnTypes;
      } 
      else if (sourceType === DataSourceType.JSON) {
        // Use JSON parser's type detection
        if (data.length < 2) return [];
        
        const headers = data[0];
        const jsonData = data.slice(1).map(row => {
          const obj: Record<string, string> = {};
          headers.forEach((header, index) => {
            obj[header] = row[index] || '';
          });
          return obj;
        });
        
        // Extract column types from jsonParser's result
        const jsonResult = jsonParser.parseJsonText(JSON.stringify(jsonData));
        return jsonResult.columnTypes;
      } 
      else {
        return [];
      }
    } catch (err) {
      console.error('Error detecting column types:', err);
      return [];
    }
  };
  
  return {
    parseFile,
    parseStream,
    parseText,
    detectColumnTypes,
    isLoading,
    progress,
    error,
    stats
  };
}

export default useDataParser;