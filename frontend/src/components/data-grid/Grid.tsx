import React, { useMemo, useCallback, useState, useRef } from "react";
import { VariableSizeGrid } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";

import GridCell from "./GridCell";
import ResizeHandle from "./ResizeHandle";

import { GridProps, GridData } from "@/types/grid";

interface IGrid extends GridProps {
  editingCell?: { row: number; col: number } | null;
  editValue?: string;
  onCellClick?: (row: number, col: number) => void;
  onCellEditChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCellBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  formatCellValue?: (
    value: string,
    rowIndex: number,
    colIndex: number
  ) => string;
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

const Grid: React.FC<IGrid> = ({
  data,
  columnTypes = [],
  isDataMode = false,
  onCellEdit,
  onContextMenu,
  className = "",
  rowHeight = 32,
  estimatedColumnWidth = 120,
  editingCell = null,
  editValue = "",
  onCellClick = () => {},
  onCellEditChange = () => {},
  onCellBlur = () => {},
  onKeyDown = () => {},
  formatCellValue = (value) => value,
  getCellClass = () => "",
  onCellContextMenu,
  onSort,
  sortState,
}) => {
  // Calculate dimensions
  const rowCount = data.length;
  const columnCount = data[0]?.length || 0;
  
  // Column width state
  const [columnWidths, setColumnWidths] = useState<number[]>(() => {
    const widths = new Array(columnCount).fill(estimatedColumnWidth);
    if (widths.length > 0) widths[0] = 60; // Row number column
    return widths;
  });
  
  // Refs for resize handling
  const gridRef = useRef<VariableSizeGrid>(null);
  const resizeStateRef = useRef<{
    isResizing: boolean;
    columnIndex: number;
    startX: number;
    startWidth: number;
  }>({
    isResizing: false,
    columnIndex: -1,
    startX: 0,
    startWidth: 0,
  });

  console.log("PerformanceGrid render:", {
    rowCount,
    columnCount,
    dataLength: data.length,
    firstRow: data[0]?.slice(0, 3),
    isDataMode,
  });

  // Prepare data for cells
  const gridData: GridData = useMemo(
    () => ({
      items: data,
      columnTypes,
      isDataMode,
      editingCell,
      editValue,
      onCellClick,
      onCellEdit: onCellEditChange,
      onCellBlur,
      onKeyDown,
      formatCellValue,
      getCellClass,
      onCellContextMenu,
      sortState,
    }),
    [
      data,
      columnTypes,
      isDataMode,
      editingCell,
      editValue,
      onCellClick,
      onCellEditChange,
      onCellBlur,
      onKeyDown,
      formatCellValue,
      getCellClass,
      onCellContextMenu,
      sortState,
    ]
  );

  // Memoized cell renderer
  const CellRenderer = useCallback(
    (props: any) => {
      return <GridCell {...props} data={gridData} />;
    },
    [gridData]
  );

  // Resize handlers
  const handleResizeStart = useCallback((columnIndex: number, startX: number) => {
    resizeStateRef.current = {
      isResizing: true,
      columnIndex,
      startX,
      startWidth: columnWidths[columnIndex] || estimatedColumnWidth,
    };
    
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [columnWidths, estimatedColumnWidth]);
  
  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!resizeStateRef.current.isResizing) return;
    
    const { columnIndex, startX, startWidth } = resizeStateRef.current;
    const deltaX = e.clientX - startX;
    const newWidth = Math.max(50, startWidth + deltaX); // Minimum width of 50px
    
    setColumnWidths(prev => {
      const newWidths = [...prev];
      newWidths[columnIndex] = newWidth;
      return newWidths;
    });
    
    // Reset column cache to trigger re-render
    if (gridRef.current) {
      gridRef.current.resetAfterColumnIndex(columnIndex);
    }
  }, []);
  
  const handleResizeEnd = useCallback(() => {
    resizeStateRef.current.isResizing = false;
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, [handleResizeMove]);

  // Calculate column width based on stored widths
  const getColumnWidth = useCallback(
    (index: number): number => {
      return columnWidths[index] || estimatedColumnWidth;
    },
    [columnWidths, estimatedColumnWidth]
  );

  // Row height function (all rows same height for now)
  const getRowHeight = useCallback((): number => {
    return rowHeight;
  }, [rowHeight]);

  if (!data.length || !columnCount) {
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
      className={`performance-grid-container ${className}`}
      onContextMenu={onContextMenu}
      tabIndex={0}
    >
      <AutoSizer>
        {({ height, width }) => {
          console.log("AutoSizer dimensions:", { height, width });
          return (
            <div className="relative">
              <VariableSizeGrid
                ref={gridRef}
                height={height}
                width={width}
                rowCount={rowCount}
                columnCount={columnCount}
                rowHeight={getRowHeight}
                columnWidth={getColumnWidth}
                itemData={gridData}
                overscanRowCount={5}
                overscanColumnCount={2}
              >
                {CellRenderer}
              </VariableSizeGrid>
              
              {/* Resize handles */}
              <div className="absolute top-0 left-0 pointer-events-none">
                {Array.from({ length: columnCount - 1 }, (_, i) => {
                  const columnIndex = i;
                  const leftOffset = columnWidths.slice(0, columnIndex + 1).reduce((sum, width) => sum + width, 0);
                  
                  return (
                    <ResizeHandle
                      key={columnIndex}
                      columnIndex={columnIndex}
                      left={leftOffset}
                      height={height}
                      onResizeStart={handleResizeStart}
                    />
                  );
                })}
              </div>
            </div>
          );
        }}
      </AutoSizer>
    </div>
  );
};

export default Grid;
