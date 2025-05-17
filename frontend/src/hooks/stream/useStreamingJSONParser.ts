import { useState } from 'react';
import { StreamReader } from '@/lib/streamReader';
import { ColumnType } from '@/types/csv';
import { DataSourceType, DataParseResult, JsonSchema } from '@/types/json';

export interface StreamingJSONParseStats {
  bytesProcessed: number;
  itemsProcessed: number;
  chunksProcessed: number;
  totalBytes?: number;
  isNested: boolean;
}

export function useStreamingJSONParser() {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [parseStats, setParseStats] = useState<StreamingJSONParseStats>({
    bytesProcessed: 0,
    itemsProcessed: 0,
    chunksProcessed: 0,
    isNested: false
  });

  /**
   * Determine if a JSON structure has nested objects/arrays
   */
  const isNestedJSON = (json: any): boolean => {
    if (Array.isArray(json)) {
      if (json.length === 0) return false;
      const firstItem = json[0];
      return typeof firstItem === 'object' && firstItem !== null && (
        Object.values(firstItem).some(val => 
          typeof val === 'object' && val !== null && 
          (Array.isArray(val) || Object.keys(val).length > 0)
        )
      );
    } else if (json && typeof json === 'object') {
      return Object.values(json).some(val => 
        typeof val === 'object' && val !== null &&
        (Array.isArray(val) || Object.keys(val).length > 0)
      );
    }
    return false;
  };

  /**
   * Detect property types from JSON data
   */
  const detectPropertyTypes = (json: any[]): Record<string, ColumnType> => {
    if (!json || json.length === 0) return {};
    
    const types: Record<string, ColumnType> = {};
    const properties = new Set<string>();
    
    // Collect all property names across all items
    for (const item of json.slice(0, 100)) {
      if (item && typeof item === 'object') {
        Object.keys(item).forEach(key => properties.add(key));
      }
    }
    
    // Detect types for each property
    for (const prop of properties) {
      let type = ColumnType.Unknown;
      
      for (const item of json.slice(0, 100)) {
        if (!item || typeof item !== 'object' || !(prop in item)) continue;
        
        const value = item[prop];
        
        if (value === null || value === undefined) continue;
        
        if (typeof value === 'object') {
          if (Array.isArray(value)) {
            type = ColumnType.Array;
            break;
          } else {
            type = ColumnType.Object;
            break;
          }
        } else if (typeof value === 'number') {
          if (type === ColumnType.Unknown) {
            type = ColumnType.Number;
          }
        } else if (typeof value === 'boolean') {
          if (type === ColumnType.Unknown) {
            type = ColumnType.Boolean;
          }
        } else if (typeof value === 'string') {
          const strVal = value.trim();
          
          // Try to parse as date
          if (/^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/.test(strVal)) {
            if (type === ColumnType.Unknown || type === ColumnType.Number) {
              type = ColumnType.Date;
              continue;
            }
          }
          
          type = ColumnType.Text;
          break;
        }
      }
      
      types[prop] = type;
    }
    
    return types;
  };

  /**
   * Flatten JSON for tabular display
   */
  const flattenJSON = (json: any[]): [string[][], JsonSchema] => {
    if (!json || json.length === 0) return [[], { properties: {}, isNested: false }];
    
    // Collect all property names
    const properties = new Set<string>();
    for (const item of json) {
      if (item && typeof item === 'object') {
        Object.keys(item).forEach(key => properties.add(key));
      }
    }
    
    // Create header row
    const headers = Array.from(properties);
    const rows: string[][] = [headers];
    
    // Detect property types
    const propertyTypes = detectPropertyTypes(json);
    
    // Check if JSON is nested
    const isNested = isNestedJSON(json);
    
    // Build schema information
    const schema: JsonSchema = {
      properties: propertyTypes,
      isNested
    };
    
    // Flatten each item into a row
    for (const item of json) {
      const row: string[] = [];
      
      for (const prop of headers) {
        if (item && typeof item === 'object' && prop in item) {
          const value = item[prop];
          
          if (value === null || value === undefined) {
            row.push('');
          } else if (typeof value === 'object') {
            // For objects and arrays, convert to string representation
            row.push(JSON.stringify(value));
          } else {
            row.push(String(value));
          }
        } else {
          row.push('');
        }
      }
      
      rows.push(row);
    }
    
    return [rows, schema];
  };

  /**
   * Stream and parse a JSON file
   * This is more challenging than CSV because JSON structure requires the entire file
   * to be parsed in most cases. For very large files, we'll implement progressive loading.
   */
  const parseJSONStream = async (
    stream: ReadableStream<Uint8Array>,
    options: {
      onChunkParsed?: (chunk: any[], isFirstChunk: boolean) => void;
      onProgress?: (progress: number, stats: StreamingJSONParseStats) => void;
      onComplete?: (result: DataParseResult) => void;
      estimatedTotalBytes?: number;
      sampleLimit?: number;
    } = {}
  ): Promise<DataParseResult> => {
    const { 
      onChunkParsed, 
      onProgress, 
      onComplete,
      estimatedTotalBytes,
      sampleLimit = 1000
    } = options;
    
    try {
      setIsLoading(true);
      setError(null);
      setProgress(0);
      
      // Create StreamReader for efficient processing
      const streamReader = new StreamReader(stream);
      
      // Initialize statistics
      const stats: StreamingJSONParseStats = {
        bytesProcessed: 0,
        itemsProcessed: 0,
        chunksProcessed: 0,
        totalBytes: estimatedTotalBytes,
        isNested: false
      };
      
      // JSON parsing requires the entire content in most cases
      // For very large files, we'll implement a streaming JSON parser in future versions
      // For now, we'll read the entire file but in chunks for progress reporting
      
      let jsonText = '';
      
      // Read file in chunks for progress tracking
      await streamReader.readByChunks(chunk => {
        const text = new TextDecoder().decode(chunk, { stream: true });
        jsonText += text;
        
        // Update progress
        stats.bytesProcessed = streamReader.getBytesProcessed();
        stats.chunksProcessed++;
        
        setParseStats({ ...stats });
        
        // Calculate progress percentage
        const progressValue = estimatedTotalBytes 
          ? stats.bytesProcessed / estimatedTotalBytes
          : 0;
        
        setProgress(progressValue);
        
        if (onProgress) {
          onProgress(progressValue, stats);
        }
      });
      
      // Now parse the complete JSON text
      let parsedJSON: any;
      
      try {
        parsedJSON = JSON.parse(jsonText);
      } catch (err) {
        throw new Error(`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`);
      }
      
      // Ensure we have an array to work with
      const jsonArray = Array.isArray(parsedJSON) 
        ? parsedJSON 
        : [parsedJSON];
      
      // Update stats
      stats.itemsProcessed = jsonArray.length;
      stats.isNested = isNestedJSON(jsonArray);
      
      setParseStats(stats);
      
      // If callback is provided, send the array
      if (onChunkParsed) {
        onChunkParsed(jsonArray, true);
      }
      
      // Take a sample for display if the array is large
      const sampleArray = jsonArray.length > sampleLimit
        ? jsonArray.slice(0, sampleLimit)
        : jsonArray;
      
      // Flatten JSON for tabular display
      const [flattenedData, schema] = flattenJSON(sampleArray);
      
      // Convert array of column types to the format expected by consumers
      const columnTypes = flattenedData[0].map(header => 
        schema.properties[header] || ColumnType.Text
      );
      
      // Prepare result
      const result: DataParseResult = {
        data: flattenedData,
        columnTypes,
        fileName: 'streamed-json',
        rowCount: jsonArray.length,
        columnCount: flattenedData[0].length,
        sourceType: DataSourceType.JSON,
        rawData: parsedJSON,
        schema
      };
      
      // Call completion handler if provided
      if (onComplete) {
        onComplete(result);
      }
      
      setIsLoading(false);
      setProgress(1);
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error parsing JSON';
      setError(errorMessage);
      setIsLoading(false);
      throw err;
    }
  };
  
  /**
   * Parse a JSON file with progress tracking
   */
  const parseJson = async (
    file: File,
    options: {
      onChunkParsed?: (chunk: any[], isFirstChunk: boolean) => void;
      onProgress?: (progress: number, stats: StreamingJSONParseStats) => void;
      sampleLimit?: number;
    } = {}
  ): Promise<DataParseResult> => {
    try {
      setIsLoading(true);
      setError(null);
      setProgress(0);
      
      // Stream the file
      const fileStream = file.stream();
      
      // Parse the stream
      const result = await parseJSONStream(fileStream, {
        ...options,
        estimatedTotalBytes: file.size,
        onComplete: (result) => {
          result.fileName = file.name;
        }
      });
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error parsing JSON';
      setError(errorMessage);
      setIsLoading(false);
      throw err;
    }
  };
  
  /**
   * Parse a JSON text string directly (for small data)
   */
  const parseJsonText = (text: string): DataParseResult => {
    try {
      // Parse JSON text
      let parsedJSON: any;
      
      try {
        parsedJSON = JSON.parse(text);
      } catch (err) {
        throw new Error(`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`);
      }
      
      // Ensure we have an array to work with
      const jsonArray = Array.isArray(parsedJSON) 
        ? parsedJSON 
        : [parsedJSON];
      
      // Flatten JSON for tabular display
      const [flattenedData, schema] = flattenJSON(jsonArray);
      
      // Convert array of column types to the format expected by consumers
      const columnTypes = flattenedData[0].map(header => 
        schema.properties[header] || ColumnType.Text
      );
      
      // Prepare result
      const result: DataParseResult = {
        data: flattenedData,
        columnTypes,
        fileName: 'json-text',
        rowCount: jsonArray.length,
        columnCount: flattenedData[0].length,
        sourceType: DataSourceType.JSON,
        rawData: parsedJSON,
        schema
      };
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error parsing JSON text';
      setError(errorMessage);
      throw err;
    }
  };
  
  return {
    parseJson,
    parseJSONStream,
    parseJsonText,
    isLoading,
    progress,
    error,
    stats: parseStats
  };
}

export default useStreamingJSONParser;