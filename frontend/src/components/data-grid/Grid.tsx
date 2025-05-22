import React, { useMemo, useCallback } from "react";
import { VariableSizeGrid } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";

import GridCell from "./GridCell";

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
}) => {
  // Calculate dimensions
  const rowCount = data.length;
  const columnCount = data[0]?.length || 0;

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
    ]
  );

  // Memoized cell renderer
  const CellRenderer = useCallback(
    (props: any) => {
      return <GridCell {...props} data={gridData} />;
    },
    [gridData]
  );

  // Calculate column width based on content - NOW RETURNS NUMBER
  const getColumnWidth = useCallback(
    (index: number): number => {
      if (index === 0) return 60; // Row number column
      return estimatedColumnWidth;
    },
    [estimatedColumnWidth]
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
            <VariableSizeGrid
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
          );
        }}
      </AutoSizer>
    </div>
  );
};

export default Grid;
