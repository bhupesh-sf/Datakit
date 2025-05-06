import { useState } from 'react';
import Papa from 'papaparse';

import { CSVData, ColumnType, CSVParseResult, CSVParseOptions } from '../types/csv';

export const useCSVParser = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detectColumnTypes = (data: CSVData): ColumnType[] => {
    if (!data || data.length < 2) return [];
    
    const headerRow = data[0];
    const types = Array(headerRow.length).fill(ColumnType.Unknown);
    
    // Skip header row, check up to 100 rows for type detection
    const rowsToSample = Math.min(data.length, 100);
    
    for (let i = 1; i < rowsToSample; i++) {
      const row = data[i];
      for (let j = 0; j < row.length; j++) {
        if (j >= types.length) break;
        
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

  const parseCSV = async (
    file: File, 
    options: CSVParseOptions = {
      delimiter: ',',
      header: false,
      skipEmptyLines: true
    }
  ): Promise<CSVParseResult | null> => {
    try {
      setIsLoading(true);
      setError(null);
      
      return new Promise((resolve, reject) => {
        Papa.parse(file, {
          ...options,
          complete: (results) => {
            const data = results.data as CSVData;
            const columnTypes = detectColumnTypes(data);
            
            resolve({
              data,
              columnTypes,
              fileName: file.name,
              rowCount: data.length,
              columnCount: data[0]?.length || 0
            });
            
            setIsLoading(false);
          },
          error: (error) => {
            setError(error.message);
            reject(error);
            setIsLoading(false);
          }
        });
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error parsing CSV';
      setError(errorMessage);
      setIsLoading(false);
      return null;
    }
  };

  return {
    parseCSV,
    isLoading,
    error
  };
};

export default useCSVParser;