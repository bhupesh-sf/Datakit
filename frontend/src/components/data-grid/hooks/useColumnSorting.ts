import { useState, useCallback, useMemo } from 'react';

export interface SortState {
  columnIndex: number | null;
  direction: 'asc' | 'desc' | null;
}

export const useColumnSorting = (originalData: string[][]) => {
  const [sortState, setSortState] = useState<SortState>({
    columnIndex: null,
    direction: null,
  });

  const sortData = useCallback((columnIndex: number, direction: 'asc' | 'desc') => {
    setSortState({ columnIndex, direction });
  }, []);

  const clearSort = useCallback(() => {
    setSortState({ columnIndex: null, direction: null });
  }, []);

  const sortedData = useMemo(() => {
    if (!sortState.columnIndex || !sortState.direction || !originalData.length) {
      return originalData;
    }

    const { columnIndex, direction } = sortState;
    
    // Don't sort if column index is out of bounds
    if (columnIndex >= originalData[0]?.length) {
      return originalData;
    }

    // Extract header and data rows
    const header = originalData[0];
    const dataRows = originalData.slice(1);
    
    // Sort the data rows
    const sortedRows = [...dataRows].sort((a, b) => {
      const aValue = a[columnIndex] || '';
      const bValue = b[columnIndex] || '';
      
      // Try to parse as numbers first
      const aNum = parseFloat(aValue);
      const bNum = parseFloat(bValue);
      
      let comparison = 0;
      
      if (!isNaN(aNum) && !isNaN(bNum)) {
        // Both are numbers
        comparison = aNum - bNum;
      } else {
        // String comparison (case insensitive)
        comparison = aValue.toLowerCase().localeCompare(bValue.toLowerCase());
      }
      
      return direction === 'asc' ? comparison : -comparison;
    });
    
    // Return header + sorted data
    return [header, ...sortedRows];
  }, [originalData, sortState]);

  return {
    sortedData,
    sortState,
    sortData,
    clearSort,
  };
};