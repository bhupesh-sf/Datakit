import React, { useState, useEffect, useRef } from 'react';
import { Download, AlertCircle, Database, Check, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

import { Button } from '@/components/ui/Button';

interface QueryResultsProps {
  results: any[] | null;
  columns: string[] | null;
  isLoading: boolean;
  error: string | null;
  // Pagination props
  totalRows?: number;
  currentPage?: number;
  totalPages?: number;
  rowsPerPage?: number;
  onPageChange?: (page: number) => void;
  onRowsPerPageChange?: (rowsPerPage: number) => void;
}

/**
 * Enhanced component for displaying query execution results
 * with virtualization and pagination
 */
const QueryResults: React.FC<QueryResultsProps> = ({ 
  results, 
  columns, 
  isLoading, 
  error,
  totalRows = 0,
  currentPage = 1,
  totalPages = 0,
  rowsPerPage = 100,
  onPageChange,
  onRowsPerPageChange
}) => {
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);
  const [columnWidths, setColumnWidths] = useState<number[]>([]);
  const [totalTableWidth, setTotalTableWidth] = useState<number>(0);
  const tableRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
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
        const valueStr = formatValue(value);
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
    
    console.log(`[QueryResults] Calculated column widths, total width: ${totalWidth}px`);
  }, [columns, results]);
  
  // Handle horizontal scroll sync
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

  // Download results as CSV
  const downloadCSV = () => {
    if (!results || !columns) return;
    
    const csvContent = [
      columns.join(','),
      ...results.map(row => 
        columns.map(col => {
          const value = row[col];
          if (value === null || value === undefined) return '';
          if (typeof value === 'string' && value.includes(',')) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `query_results_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Format value for display
  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };
  
  // Determine display style based on value type
  const getValueStyle = (value: any): string => {
    if (value === null || value === undefined) {
      return 'text-white/30 italic';
    }
    if (typeof value === 'number') {
      return 'text-tertiary font-mono text-right';
    }
    if (typeof value === 'boolean') {
      return 'text-primary text-center';
    }
    if (typeof value === 'string' && (
      /^\d{4}-\d{2}-\d{2}/.test(value) || // ISO date
      /^\d{2}\/\d{2}\/\d{4}/.test(value)  // US date
    )) {
      return 'text-secondary';
    }
    return '';
  };

  const handleRowsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRowsPerPage = Number(e.target.value);
    if (onRowsPerPageChange) {
      onRowsPerPageChange(newRowsPerPage);
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-10 text-white text-opacity-70">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mb-4"></div>
        <p className="text-sm">Executing query...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-destructive/10 border border-destructive/30 rounded p-4 text-white m-3">
        <h4 className="font-medium text-destructive mb-2 flex items-center">
          <AlertCircle size={16} className="mr-2" />
          Error
        </h4>
        <pre className="text-xs bg-background p-3 rounded overflow-auto max-h-60 whitespace-pre-wrap">
          {error}
        </pre>
      </div>
    );
  }

  if (!results || !columns) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-10 text-white text-opacity-70">
        <Database size={24} className="text-white opacity-30 mb-4" />
        <p className="text-sm">Execute a query to see results.</p>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-10 text-white text-opacity-70">
        <Check size={24} className="text-primary mb-4" />
        <p className="text-sm">Query executed successfully. No results returned.</p>
      </div>
    );
  }

  // Row renderer for virtualized list
  const RowRenderer = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    if (!columns || !results) return null;
    
    const row = results[index];
    
    return (
      <div 
        style={{
          ...style,
          display: 'flex',
          width: Math.max(totalTableWidth, 500),
          minWidth: '100%'
        }}
        className={`${index % 2 === 0 ? 'bg-black/20' : ''} hover:bg-white/5`}
      >
        {columns.map((column, colIndex) => {
          const value = row[column];
          const valueStyle = getValueStyle(value);
          
          return (
            <div
              key={colIndex}
              style={{
                width: columnWidths[colIndex] || 120,
                minWidth: columnWidths[colIndex] || 120
              }}
              className={`p-2 text-xs border-b border-r border-white/10 ${valueStyle}`}
              title={formatValue(value)}
            >
              {formatValue(value)}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full" ref={tableContainerRef}>
      <div className="flex justify-between items-center p-3">
        <div className="text-xs text-white text-opacity-70">
          <span className="font-medium">{totalRows.toLocaleString()}</span> rows returned
          {totalRows > rowsPerPage && (
            <span className="ml-2">
              (showing page {currentPage} of {totalPages})
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
         
          
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={downloadCSV}
          >
            <Download size={12} className="mr-1" />
            <span>Download CSV</span>
          </Button>
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden">
        <div className="h-full flex flex-col">
          {/* Table Header - Fixed */}
          <div className="z-10 sticky top-0 bg-darkNav" ref={tableRef} style={{ overflow: 'hidden' }}>
            <div 
              className="flex" 
              style={{ 
                width: Math.max(totalTableWidth, 500),
                minWidth: '100%'
              }}
            >
              {columns.map((column, index) => (
                <div
                  key={index}
                  className="text-left p-2 text-xs font-medium text-white text-opacity-80 border-b border-r border-white/10 whitespace-nowrap"
                  style={{ 
                    width: columnWidths[index] || 120, 
                    minWidth: columnWidths[index] || 120
                  }}
                >
                  {column}
                </div>
              ))}
            </div>
          </div>
          
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
                  {RowRenderer}
                </List>
              )}
            </AutoSizer>
          </div>
        </div>
      </div>
      
      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between p-3 bg-darkNav mt-1 rounded-b">
          <div className="flex items-center space-x-2">
            <span className="text-xs text-white/70">Rows per page:</span>
            <select
              value={rowsPerPage}
              onChange={handleRowsPerPageChange}
              className="bg-background text-white text-xs p-1 rounded border border-white/10"
            >
              <option value={100}>100</option>
              <option value={500}>500</option>
              <option value={1000}>1000</option>
              <option value={5000}>5000</option>
            </select>
          </div>
          
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 flex items-center justify-center"
              disabled={currentPage === 1}
              onClick={() => onPageChange && onPageChange(1)}
              title="First Page"
            >
              <ChevronsLeft size={14} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 flex items-center justify-center"
              disabled={currentPage === 1}
              onClick={() => onPageChange && onPageChange(currentPage - 1)}
              title="Previous Page"
            >
              <ChevronLeft size={14} />
            </Button>
            
            <span className="text-xs text-white/70 px-2">
              Page {currentPage.toLocaleString()} of {totalPages.toLocaleString()}
            </span>
            
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 flex items-center justify-center"
              disabled={currentPage === totalPages}
              onClick={() => onPageChange && onPageChange(currentPage + 1)}
              title="Next Page"
            >
              <ChevronRight size={14} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 flex items-center justify-center"
              disabled={currentPage === totalPages}
              onClick={() => onPageChange && onPageChange(totalPages)}
              title="Last Page"
            >
              <ChevronsRight size={14} />
            </Button>
          </div>
          
          {/* Jump to page input for large result sets */}
          {totalPages > 10 && (
            <div className="flex items-center space-x-2">
              <span className="text-xs text-white/70">Go to:</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={currentPage}
                onChange={(e) => {
                  const page = parseInt(e.target.value);
                  if (!isNaN(page) && page >= 1 && page <= totalPages) {
                    onPageChange && onPageChange(page);
                  }
                }}
                className="bg-background text-white text-xs p-1 rounded border border-white/10 w-16 text-center"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default QueryResults;