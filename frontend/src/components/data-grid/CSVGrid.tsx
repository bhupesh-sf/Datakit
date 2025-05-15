import { useState, useEffect, useCallback, useRef } from "react";

import { useAppStore } from "@/store/appStore";

import {
  useEmptyGrid,
  useGridEditing,
  useWelcomeAnimation,
  GridData,
} from "./hooks";

import { ColumnType } from "@/types/csv";

/**
 * CSVGrid component displays tabular data in an editable grid format
 * with cell editing, formatting, and animations.
 */
const CSVGrid: React.FC = () => {
  const { 
    data: storeData, 
    columnTypes, 
    setActiveTab 
  } = useAppStore();
  
  // Track if this component has been mounted
  const isMounted = useRef(false);
  
  // Get empty grid
  const emptyGrid = useEmptyGrid();

  // Setup local state - initialize with data from store if available
  const [gridData, setGridData] = useState<GridData>(() => {
    if (storeData && storeData.length > 0) {
      return storeData.map((row, index) => {
        if (index === 0) return [" ", ...row];
        return [index.toString(), ...row];
      });
    }
    return emptyGrid;
  });
  
  const [isDataMode, setIsDataMode] = useState<boolean>(!!storeData && storeData.length > 0);
  const [totalRows, setTotalRows] = useState<number>(storeData ? Math.max(0, storeData.length - 1) : 0);
  const [displayedRows, setDisplayedRows] = useState<number>(storeData ? Math.max(0, storeData.length - 1) : 0);

  // Cell editing functionality
  const {
    editCell,
    editValue,
    handleCellClick,
    handleCellEdit,
    handleCellBlur,
    handleKeyDown,
  } = useGridEditing(gridData, setGridData);

  // Determine if we should show animation - only when no data is present
  const hasDataToDisplay = !!storeData && storeData.length > 0;
  
  // Animation functionality - pass hasDataToDisplay as third parameter
  // This tells the hook to never show animation when we have data
  const { activeWordIndex, animationMessage, animationActive } =
    useWelcomeAnimation(emptyGrid, setGridData, hasDataToDisplay);

  /**
   * Handle data import from global store
   * This effect processes data from the global store and updates local grid state
   */
  useEffect(() => {
    // Set mounted flag
    isMounted.current = true;
    
    if (storeData && storeData.length > 0) {
      // Format data with row numbers
      const withRowNumbers: GridData = storeData.map((row, index) => {
        if (index === 0) {
          return [" ", ...row]; // Header row
        }
        return [index.toString(), ...row]; // Data rows
      });

      // Update state
      setGridData(withRowNumbers);
      setIsDataMode(true);
      setTotalRows(storeData.length - 1); // Subtract header row
      setDisplayedRows(storeData.length - 1);
    } else {
      // Only reset to empty if we're mounted (not initial render)
      // and only if animation is not active
      if (isMounted.current && !animationActive) {
        setIsDataMode(false);
        setGridData(emptyGrid);
        setTotalRows(0);
        setDisplayedRows(0);
      }
    }
    
    // Cleanup function to run on unmount
    return () => {
      isMounted.current = false;
    };
  }, [storeData, emptyGrid, animationActive]);

  /**
   * Determine cell class based on state and content
   * 
   * @param rowIndex - Row index in the grid
   * @param colIndex - Column index in the grid
   * @returns CSS class string for the cell
   */
  const getCellClass = useCallback(
    (rowIndex: number, colIndex: number): string => {
      let baseClass = "";

      if (rowIndex === 0) {
        baseClass = "csv-grid-header";
      } else if (colIndex === 0) {
        baseClass = "csv-grid-row-number";
      } else {
        baseClass = "csv-grid-cell";

        // Add column type styling for data mode
        if (
          isDataMode &&
          columnTypes.length > 0 &&
          colIndex - 1 < columnTypes.length
        ) {
          const type = columnTypes[colIndex - 1];

          switch (type) {
            case ColumnType.Number:
              baseClass += " csv-grid-cell-number";
              break;
            case ColumnType.Date:
              baseClass += " csv-grid-cell-date";
              break;
            case ColumnType.Boolean:
              baseClass += " csv-grid-cell-boolean";
              break;
          }
        }

        // Add animation styling for welcome message
        if (!isDataMode && animationActive) {
          const cellContent = gridData[rowIndex][colIndex];
          if (cellContent) {
            const wordIndex = animationMessage.indexOf(cellContent);

            if (wordIndex !== -1) {
              if (wordIndex === activeWordIndex) {
                // Current word gets smooth animation
                baseClass += " animate-word-entry text-primary font-medium";
              } else {
                // Previous words just have styling
                baseClass += " text-primary font-medium";
              }
            }
          }
        }
      }

      return baseClass;
    },
    [
      isDataMode,
      columnTypes,
      animationActive,
      gridData,
      animationMessage,
      activeWordIndex,
    ]
  );

  /**
   * Format cell value based on type
   * 
   * @param value - Original cell value
   * @param rowIndex - Row index in the grid
   * @param colIndex - Column index in the grid
   * @returns Formatted value string
   */
  const formatCellValue = useCallback(
    (value: string, rowIndex: number, colIndex: number): string => {
      if (rowIndex === 0 || colIndex === 0 || !value) return value;

      // Only apply type formatting in data mode
      if (
        !isDataMode ||
        !columnTypes ||
        columnTypes.length === 0 ||
        colIndex - 1 >= columnTypes.length
      ) {
        return value;
      }

      const type = columnTypes[colIndex - 1];
      switch (type) {
        case ColumnType.Number:
          const num = parseFloat(value);
          if (!isNaN(num)) {
            return num.toLocaleString();
          }
          break;
        case ColumnType.Boolean:
          if (value.toLowerCase() === "true" || value.toLowerCase() === "yes") {
            return "✓";
          } else if (
            value.toLowerCase() === "false" ||
            value.toLowerCase() === "no"
          ) {
            return "✗";
          }
          break;
        case ColumnType.Date:
          try {
            if (/\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/.test(value)) {
              const date = new Date(value);
              if (!isNaN(date.getTime())) {
                return date.toLocaleDateString();
              }
            }
          } catch (e) {
            // If date parsing fails, return original value
          }
          break;
      }

      return value;
    },
    [isDataMode, columnTypes]
  );

  /**
   * Handle context menu for DuckDB operations
   * @param e - Right-click event
   */
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (isDataMode) {
      // Switch to query tab when right-clicking with data
      setActiveTab("query");
    }
  }, [isDataMode, setActiveTab]);

  /**
   * Render row count indicator
   */
  const renderRowCountIndicator = () => {
    if (!isDataMode || totalRows === 0) return null;
    
    const showingAll = displayedRows === totalRows;
    
    return (
      <div className="flex justify-between items-center p-2 bg-darkNav border-b border-white border-opacity-10">
        <div className="text-sm text-white text-opacity-70">
          {showingAll ? (
            `Displaying ${totalRows.toLocaleString()} rows`
          ) : (
            `Displaying ${displayedRows.toLocaleString()} of ${totalRows.toLocaleString()} rows`
          )}
        </div>
        {!showingAll && (
          <button
            onClick={() => setActiveTab('query')}
            className="text-xs text-primary hover:text-primary-hover"
          >
            Query full dataset in DuckDB →
          </button>
        )}
      </div>
    );
  };

  // Force re-render with store data when component becomes visible again
  useEffect(() => {
    if (storeData && storeData.length > 0) {
      const withRowNumbers: GridData = storeData.map((row, index) => {
        if (index === 0) {
          return [" ", ...row]; // Header row
        }
        return [index.toString(), ...row]; // Data rows
      });
      setGridData(withRowNumbers);
      setIsDataMode(true);
    }
  }, []);

  return (
    <div 
      className="csv-grid-container relative h-full"
      onContextMenu={handleContextMenu}
    >
      {/* Add smooth animation styling */}
      <style jsx global>{`
        @keyframes wordEntry {
          0% {
            opacity: 0;
            transform: translateY(8px) scale(0.95);
          }
          30% {
            opacity: 1;
            transform: translateY(0) scale(1.05);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .animate-word-entry {
          animation: wordEntry 0.6s ease-out forwards;
        }
      `}</style>
      
      {/* Row count indicator */}
      {renderRowCountIndicator()}

      <table className="csv-grid-table">
        <thead>
          <tr>
            {gridData[0].map((cell, colIndex) => (
              <th key={colIndex} className="csv-grid-header">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {gridData.slice(1).map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, colIndex) => (
                <td
                  key={colIndex}
                  className={getCellClass(rowIndex + 1, colIndex)}
                  onClick={() => handleCellClick(rowIndex + 1, colIndex)}
                >
                  {editCell?.row === rowIndex + 1 &&
                  editCell.col === colIndex ? (
                    <input
                      type="text"
                      value={editValue}
                      onChange={handleCellEdit}
                      onBlur={handleCellBlur}
                      onKeyDown={handleKeyDown}
                      autoFocus
                      className="csv-grid-cell-input"
                    />
                  ) : (
                    formatCellValue(cell, rowIndex + 1, colIndex)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CSVGrid;