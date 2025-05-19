
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

import { ensureSafeJSON } from '@/lib/duckdb/utils';

import TableHeader from './TableHeader';
import TableRow from './TableRow';

interface QueryResultsTableProps {
  results: any[];
  columns: string[];
}

const QueryResultsTable: React.FC<QueryResultsTableProps> = ({ 
  results, 
  columns 
}) => {
  const [columnWidths, setColumnWidths] = useState<number[]>([]);
  const [totalTableWidth, setTotalTableWidth] = useState<number>(0);
  const tableRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Calculate column widths based on content
  useEffect(() => {
    if (!columns || !results || results.length === 0) {
      setColumnWidths([]);
      return;
    }
    
    // Initial default widths
    const minWidth = 100;
    const maxWidth = 300;
    
    // Sample a subset of rows for performance
    const sampleSize = Math.min(results.length, 100);
    const sampled = results.slice(0, sampleSize);
    
    // Calculate widths based on content length
    const widths = columns.map((column, colIndex) => {
      // Start with column header length
      let maxLength = column.length;
      
      // Check sample data
      for (const row of sampled) {
        const value = row[column];
        const valueStr = formatValueAsString(value);
        maxLength = Math.max(maxLength, valueStr.length);
      }
      
      // Estimate width (characters × 8px per character)
      // with some padding and boundaries
      return Math.max(minWidth, Math.min(maxWidth, maxLength * 8 + 24));
    });
    
    setColumnWidths(widths);
    
    // Calculate total table width
    const totalWidth = widths.reduce((sum, width) => sum + width, 0);
    setTotalTableWidth(totalWidth);
  }, [columns, results]);
  
  // Handle horizontal scroll sync between header and body
  useEffect(() => {
    if (!scrollContainerRef.current || !tableRef.current) return;
    
    const handleTableScroll = (e: Event) => {
      const target = e.target as HTMLDivElement;
      if (tableRef.current) {
        tableRef.current.scrollLeft = target.scrollLeft;
      }
    };
    
    const scrollContainer = scrollContainerRef.current;
    scrollContainer.addEventListener('scroll', handleTableScroll);
    
    return () => {
      scrollContainer.removeEventListener('scroll', handleTableScroll);
    };
  }, []);

  // Format a value as string for width calculation
  const formatValueAsString = (value: any): string => {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch (e) {
        return 'Error formatting value';
      }
    }
    return String(value);
  };

  // Memoize the row renderer for better performance
  const rowRenderer = useMemo(() => {
    return ({ index, style }: { index: number; style: React.CSSProperties }) => (
      <TableRow
        index={index}
        style={style}
        row={results[index]}
        columns={columns}
        columnWidths={columnWidths}
        totalWidth={Math.max(totalTableWidth, 500)}
      />
    );
  }, [results, columns, columnWidths, totalTableWidth]);

  return (
    <div className="h-full flex flex-col">
      {/* Table Header - Fixed */}
      <TableHeader 
        columns={columns} 
        columnWidths={columnWidths} 
        totalWidth={Math.max(totalTableWidth, 500)}
        tableRef={tableRef}
      />
      
      {/* Table Body - Virtualized */}
      <div 
        className="flex-1 overflow-auto"
        ref={scrollContainerRef}
      >
        <AutoSizer>
          {({ height, width }) => (
            <List
              height={height}
              width={width}
              itemCount={results.length}
              itemSize={28} // Row height
              overscanCount={10}
              className="scrollbar"
            >
              {rowRenderer}
            </List>
          )}
        </AutoSizer>
      </div>
    </div>
  );
};

export default QueryResultsTable;