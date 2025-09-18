import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { VariableSizeGrid as Grid } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { GridProps } from '@/types/grid';
import { useColumnStats } from '@/hooks/useColumnStats';
import ColumnHeaderCell from './table-header/ColumnHeaderCell';

interface UnifiedGridProps extends GridProps {
  fileId?: string;
  isRemoteSource?: boolean;
  showStats?: boolean;
  onStatsToggle?: () => void;
  editingCell?: { row: number; col: number } | null;
  editValue?: string;
  onCellClick?: (row: number, col: number) => void;
  onCellEditChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCellBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  formatCellValue?: (value: string, rowIndex: number, colIndex: number) => React.ReactNode;
  getCellClass?: (rowIndex: number, colIndex: number) => string;
  onCellContextMenu?: (
    e: React.MouseEvent,
    rowIndex: number,
    columnIndex: number,
    cellValue: string
  ) => void;
  onSort?: (columnIndex: number, direction: 'asc' | 'desc') => void;
  sortState?: {
    columnIndex: number | null;
    direction: 'asc' | 'desc' | null;
  };
}

export interface UnifiedGridRef {
  columnStats: any[];
  isLoadingStats: boolean;
  triggerAnalysis: () => void;
}

const UnifiedGrid = React.forwardRef<UnifiedGridRef, UnifiedGridProps>(({
  data,
  fileId,
  isRemoteSource = false,
  showStats: propShowStats,
  onStatsToggle,
  columnTypes = [],
  isDataMode = false,
  onCellEdit,
  onContextMenu,
  className = '',
  rowHeight = 32,
  estimatedColumnWidth = 120,
  editingCell = null,
  editValue = '',
  onCellClick = () => {},
  onCellEditChange = () => {},
  onCellBlur = () => {},
  onKeyDown = () => {},
  formatCellValue = (value) => value,
  getCellClass = () => '',
  onCellContextMenu,
  onSort,
  sortState,
}, ref) => {
  // Get column stats with manual trigger
  const { columnStats, isLoading: isLoadingStats, shouldLoadStats, triggerAnalysis } = useColumnStats({
    fileId,
    enabled: true,
    fileSizeThresholdMB: 300,
    manualTrigger: true, // Enable manual trigger mode
  });

  // Parse data structure
  const hasHeaders = data.length > 0 && data[0]?.length > 0;
  const headers = hasHeaders ? data[0] : [];
  const columnCount = headers.length || 0;

  // Use prop-based control if provided, otherwise use local state
  const [localShowStats, setLocalShowStats] = useState(false);
  const showStats = propShowStats !== undefined ? propShowStats : localShowStats;
  
  // Auto-show stats when they are first loaded (only for local state mode)
  useEffect(() => {
    if (propShowStats === undefined && columnStats.length > 0 && !localShowStats) {
      // Only auto-show if user hasn't manually hidden them
      const hasManuallyHidden = sessionStorage.getItem(`grid-stats-hidden-${fileId}`);
      if (!hasManuallyHidden) {
        setLocalShowStats(true);
      }
    }
  }, [columnStats.length, localShowStats, fileId, propShowStats]);

  // Initialize CSS custom properties for column widths
  useEffect(() => {
    if (columnCount > 0) {
      const root = document.documentElement;
      
      // Check if we already have widths set, if not initialize them
      const existingWidth = getComputedStyle(root).getPropertyValue('--grid-col-0').trim();
      
      if (!existingWidth) {
        // Set default widths
        for (let i = 0; i < columnCount; i++) {
          const defaultWidth = i === 0 ? '60px' : `${estimatedColumnWidth}px`;
          root.style.setProperty(`--grid-col-${i}`, defaultWidth);
        }
      }
    }
  }, [columnCount, estimatedColumnWidth]);

  // Get column width from CSS custom property
  const getColumnWidth = useCallback((index: number) => {
    const root = document.documentElement;
    const cssWidth = getComputedStyle(root).getPropertyValue(`--grid-col-${index}`).trim();
    return cssWidth ? parseInt(cssWidth.replace('px', '')) : (index === 0 ? 60 : estimatedColumnWidth);
  }, [estimatedColumnWidth]);

  // Set column width in CSS custom property
  const setColumnWidth = useCallback((index: number, width: number) => {
    const root = document.documentElement;
    root.style.setProperty(`--grid-col-${index}`, `${width}px`);
  }, []);
  
  const [scrollLeft, setScrollLeft] = useState(0);
  
  // Calculate total width for consistency
  const totalWidth = useMemo(() => {
    let total = 0;
    for (let i = 0; i < columnCount; i++) {
      total += getColumnWidth(i);
    }
    return total;
  }, [columnCount, getColumnWidth]);

  // Refs
  const gridRef = useRef<Grid>(null);
  const resizeStateRef = useRef({
    isResizing: false,
    columnIndex: -1,
    startX: 0,
    startWidth: 0,
  });

  // Calculate header height based on showing stats (not just having them)
  const hasActualStats = showStats && columnStats.some(stat => 
    stat.histogramData?.length > 0 || 
    stat.nullPercentage > 0 || 
    stat.uniqueCount > 0 ||
    stat.numericStats
  );
  const headerHeight = hasActualStats ? 80 : 40;
  
  // Total rows including header
  const totalRowCount = data.length;

  // Column resize handlers
  const handleResizeStart = useCallback((columnIndex: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    resizeStateRef.current = {
      isResizing: true,
      columnIndex,
      startX: e.clientX,
      startWidth: getColumnWidth(columnIndex),
    };
    
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [getColumnWidth]);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!resizeStateRef.current.isResizing) return;
    
    const { columnIndex, startX, startWidth } = resizeStateRef.current;
    const deltaX = e.clientX - startX;
    const newWidth = Math.max(50, Math.min(startWidth + deltaX, 800));
    
    // Update CSS custom property
    setColumnWidth(columnIndex, newWidth);
    
    // Reset column cache
    if (gridRef.current) {
      gridRef.current.resetAfterColumnIndex(columnIndex);
    }
  }, [setColumnWidth]);

  const handleResizeEnd = useCallback(() => {
    resizeStateRef.current.isResizing = false;
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, [handleResizeMove]);

  // Cleanup listeners
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };
  }, [handleResizeMove, handleResizeEnd]);

  // Expose ref methods
  React.useImperativeHandle(ref, () => ({
    columnStats,
    isLoadingStats,
    triggerAnalysis,
  }), [columnStats, isLoadingStats, triggerAnalysis]);

  // Get row height (only for data rows now)
  const getRowHeight = useCallback(() => {
    return rowHeight;
  }, [rowHeight]);

  // Get column stats
  const getColumnStats = useCallback((columnName: string) => {
    return columnStats.find(stat => stat.name === columnName);
  }, [columnStats]);

  // Cell renderer for data cells only (no header)
  const Cell = useCallback(({ columnIndex, rowIndex, style }: any) => {
    const isRowNumberColumn = columnIndex === 0;
    
    // Adjust style to ensure proper alignment
    const adjustedStyle = {
      ...style,
      display: 'flex',
      alignItems: 'center',
    };

    // Row number cells
    if (isRowNumberColumn) {
      return (
        <div 
          style={adjustedStyle}
          className="grid-cell csv-grid-row-number"
        >
          {rowIndex + 1}
        </div>
      );
    }

    // Data cells
    const cellValue = data[rowIndex + 1]?.[columnIndex] || ''; // +1 to skip header row
    
    const formattedValue = formatCellValue(cellValue, rowIndex + 1, columnIndex);
    const cellClass = getCellClass(rowIndex + 1, columnIndex);
    const isEditing = editingCell?.row === rowIndex + 1 && editingCell?.col === columnIndex;

    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      onCellClick(rowIndex + 1, columnIndex);
      if (onCellContextMenu) {
        onCellContextMenu(e, rowIndex + 1, columnIndex, cellValue);
      }
    };

    return (
      <div
        style={adjustedStyle}
        className={`grid-cell csv-grid-cell ${cellClass}`}
        onClick={handleClick}
      >
        {isEditing ? (
          <input
            className="csv-grid-cell-input"
            value={editValue}
            onChange={onCellEditChange}
            onBlur={onCellBlur}
            onKeyDown={onKeyDown}
            autoFocus
          />
        ) : (
          <span className="cell-content">{formattedValue}</span>
        )}
      </div>
    );
  }, [
    headers,
    columnTypes,
    columnStats,
    isLoadingStats,
    data,
    formatCellValue,
    getCellClass,
    editingCell,
    editValue,
    onCellClick,
    onCellEditChange,
    onCellBlur,
    onKeyDown,
    onCellContextMenu,
    sortState,
    onSort,
    handleResizeStart,
    getColumnStats,
    columnCount,
  ]);


  if (!hasHeaders || !columnCount || totalRowCount === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-white/70">
          <p>No data to display</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`h-full flex flex-col ${className}`}
      onContextMenu={onContextMenu}
      tabIndex={0}
    >
      {/* Header */}
      <div 
        className="flex-shrink-0 z-30 table-header-stats overflow-hidden transition-all duration-300 ease-in-out"
        style={{ height: headerHeight }}
      >
        <div 
          className="flex transition-all duration-300 ease-in-out"
          style={{ 
            minWidth: '100%',
            height: '100%',
            width: Math.max(totalWidth, 800), // Ensure header is always wide enough
            transform: `translateX(-${scrollLeft}px)`
          }}
        >
          {/* Row number header */}
          <div 
            style={{ 
              width: `var(--grid-col-0, 60px)`, 
              flexShrink: 0,
              background: 'var(--dark-nav)'
            }}
            className="grid-cell csv-grid-header csv-grid-row-number border-r border-white/15 relative"
          />
          
          {/* Column headers */}
          {headers.map((header, columnIndex) => {
            if (columnIndex === 0) return null; // Skip row number column (handled above)
            const columnType = columnTypes[columnIndex - 1] || 'VARCHAR';
            
            return (
              <div 
                key={columnIndex}
                style={{ width: `var(--grid-col-${columnIndex}, ${estimatedColumnWidth}px)`, flexShrink: 0 }}
                className="relative"
              >
                <ColumnHeaderCell
                  columnName={header}
                  columnType={columnType}
                  columnIndex={columnIndex}
                  stats={getColumnStats(header)}
                  isLoading={isLoadingStats}
                  width={getColumnWidth(columnIndex)}
                  shouldLoadStats={showStats}
                  sortState={sortState}
                  onSort={onSort}
                />
                {/* Resize handle */}
                {columnIndex < columnCount - 1 && (
                  <div
                    className="absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-primary/50 transition-colors"
                    style={{ zIndex: 40 }}
                    onMouseDown={(e) => handleResizeStart(columnIndex, e)}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Data Grid */}
      <div className="flex-1 overflow-hidden">
        <AutoSizer>
          {({ height, width }) => (
            <Grid
              ref={gridRef}
              height={height}
              width={width}
              rowCount={data.length - 1} // Exclude header row
              columnCount={columnCount}
              rowHeight={getRowHeight}
              columnWidth={getColumnWidth}
              overscanRowCount={5}
              overscanColumnCount={10} // Very high overscan to keep row numbers visible
              onScroll={({ scrollLeft }) => {
                setScrollLeft(scrollLeft);
              }}
              style={{ overflowX: 'auto', overflowY: 'auto' }}
              className="virtual-grid-scroll"
              itemKey={({ columnIndex, rowIndex }) => {
                // Force row number column to always have same key to prevent re-render
                if (columnIndex === 0) {
                  return `row-${rowIndex}`;
                }
                return `${rowIndex}-${columnIndex}`;
              }}
            >
              {Cell}
            </Grid>
          )}
        </AutoSizer>
      </div>
    </div>
  );
});

UnifiedGrid.displayName = 'UnifiedGrid';

export default UnifiedGrid;