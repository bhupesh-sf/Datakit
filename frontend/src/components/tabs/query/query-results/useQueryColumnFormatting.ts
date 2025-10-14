import { useMemo } from 'react';
import { ColumnType } from '@/types/csv';
import { useCellFormatting } from '@/components/data-grid/hooks/useCellFormatting';

interface UseQueryColumnFormattingProps {
  results: any[];
  columns: string[];
}

interface UseQueryColumnFormattingReturn {
  columnTypes: ColumnType[];
  formatCellValue: (value: string, rowIndex: number, colIndex: number) => string;
}

/**
 * Hook for detecting column types and formatting cells in query results
 * Uses the same logic as the data preview grid for consistency
 */
export const useQueryColumnFormatting = ({
  results,
  columns,
}: UseQueryColumnFormattingProps): UseQueryColumnFormattingReturn => {
  // Detect column types from the data
  const columnTypes = useMemo(() => {
    if (!columns?.length || !results?.length) return [];
    
    return columns.map((column) => {
      // Sample some values to determine type
      const sampleValues = results
        .slice(0, 100)
        .map(row => row[column])
        .filter(val => val !== null && val !== undefined);
      
      if (sampleValues.length === 0) return ColumnType.Text;
      
      // Check for dates first (timestamps or date strings)
      // Exclude columns that look like IDs from date detection
      const isLikelyIdColumn = column.toLowerCase().includes('id') || 
                              column.toLowerCase().includes('_id') ||
                              column.toLowerCase().endsWith('id');
      
      const dateValues = sampleValues.filter(val => {
        // Skip timestamp detection for ID-like columns
        if (isLikelyIdColumn && typeof val === 'number') {
          return false;
        }
        
        if (typeof val === 'number' && val > 946684800000 && val < 4102444800000) {
          return true; // Timestamp
        }
        if (typeof val === 'string' && /\d{4}-\d{2}-\d{2}/.test(val)) {
          return true; // Date string
        }
        return false;
      });
      if (dateValues.length / sampleValues.length > 0.5) {
        return ColumnType.Date;
      }
      
      // Check for numbers
      const numericValues = sampleValues.filter(val => 
        typeof val === 'number' || 
        (!isNaN(Number(val)) && !isNaN(parseFloat(val)) && val.toString().trim() !== '')
      );
      if (numericValues.length / sampleValues.length > 0.8) {
        return ColumnType.Number;
      }
      
      // Check for booleans
      const booleanValues = sampleValues.filter(val => 
        typeof val === 'boolean' || 
        (typeof val === 'string' && ['true', 'false', 'yes', 'no'].includes(val.toLowerCase()))
      );
      if (booleanValues.length / sampleValues.length > 0.8) {
        return ColumnType.Boolean;
      }
      
      return ColumnType.Text;
    });
  }, [columns, results]);

  // Use the same cell formatting hook as the data grid
  const { formatCellValue } = useCellFormatting(columnTypes, true);

  return {
    columnTypes,
    formatCellValue,
  };
};