import React, { useState, useEffect, useCallback } from "react";
import { CheckCircle } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { useInspectorStore } from "@/store/inspectorStore";
import {
  selectData,
  selectColumnTypes,
  selectActiveFile,
} from "@/store/selectors/appSelectors";

import Grid from "./Grid";
import InspectorPanel from "@/components/tabs/preview/inspector/InspectorPanel";

import { useGridEditing } from "./hooks/useGridEditing";
import { useCellFormatting } from "./hooks/useCellFormatting";
import { useEmptyGrid, useWelcomeAnimation } from "./hooks";
import { Button } from "../ui/Button";

const CSVGrid: React.FC = () => {
  const storeData = useAppStore(selectData);
  const columnTypes = useAppStore(selectColumnTypes);
  const activeFile = useAppStore(selectActiveFile);
  const { setActiveTab } = useAppStore();

  const { openPanel, analyzeFile } = useInspectorStore();

  // Get empty grid for animation
  const emptyGrid = useEmptyGrid();

  // Setup local state
  const [gridData, setGridData] = useState(() => {
    if (storeData && storeData.length > 0) {
      return storeData.map((row, index) => {
        if (index === 0) return [" ", ...row];
        return [index.toString(), ...row];
      });
    }

    return emptyGrid;
  });

  const [isDataMode, setIsDataMode] = useState(
    !!storeData && storeData.length > 0
  );
  const [totalRows, setTotalRows] = useState(
    storeData ? Math.max(0, storeData.length - 1) : 0
  );

  // Animation functionality
  const hasDataToDisplay = !!storeData && storeData.length > 0;
  const { activeWordIndex, animationMessage, animationActive } =
    useWelcomeAnimation(emptyGrid, setGridData, hasDataToDisplay);

  // Editing functionality
  const {
    editingCell,
    editValue,
    handleCellClick,
    handleCellEdit,
    handleCellBlur,
    handleKeyDown,
  } = useGridEditing(gridData, setGridData);

  // Cell formatting
  const { formatCellValue, getCellClass } = useCellFormatting(
    columnTypes,
    isDataMode,
    {
      animationActive,
      gridData,
      animationMessage,
      activeWordIndex,
    }
  );

  // Handle data import from global store
  useEffect(() => {
    if (storeData && storeData.length > 0) {
      const withRowNumbers = storeData.map((row, index) => {
        if (index === 0) {
          return [" ", ...row];
        }
        return [index.toString(), ...row];
      });

      setGridData(withRowNumbers);
      setIsDataMode(true);
      setTotalRows(storeData.length - 1);
    } else if (!animationActive) {
      setIsDataMode(false);
      setGridData(emptyGrid);
      setTotalRows(0);
    }
  }, [storeData, emptyGrid, animationActive]);

  // Handle context menu
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (isDataMode) {
        setActiveTab("query");
      }
    },
    [isDataMode, setActiveTab]
  );

  const handleInspectorClick = useCallback(() => {
    if (!activeFile) return;

    const tableName = activeFile.tableName;

    // Open panel and start analysis
    openPanel();
    analyzeFile(activeFile.id, tableName);
  }, [activeFile, openPanel, analyzeFile]);

  const renderRowCountIndicator = () => {
    if (!isDataMode || totalRows === 0) return null;

    const columnCount = storeData?.[0]?.length || 0;

    return (
      <div className="flex justify-between items-center px-4 py-2.5 bg-dark-nav">
        {/* Left side - Clean data summary */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium text-white">
                {totalRows.toLocaleString()}
              </span>
              <span className="text-xs text-white/60">preview rows</span>
            </div>

            <div className="w-px h-3 bg-white/20" />

            <div className="flex items-center gap-1">
              <span className="text-sm font-medium text-white/90">
                {columnCount}
              </span>
              <span className="text-xs text-white/60">columns</span>
            </div>
          </div>
        </div>

        {/* Right side - Minimal action buttons */}
        <div className="flex items-center gap-2">
          {/* Inspector button - minimal with just hover effect */}
          <Button
            variant="outline"
            onClick={handleInspectorClick}
            data-inspector-trigger
            className="flex items-center gap-1.5 px-2 py-1 text-xs hover:text-white hover:bg-white/5 rounded transition-all duration-150"
          >
            <CheckCircle className="h-3 w-3" />
            <span>Inspect data quality</span>
          </Button>

          <div className="w-px h-3 bg-white/20" />

          {/* Query button - minimal */}
          <Button
            variant="outline"
            onClick={() => setActiveTab("query")}
            className="flex items-center gap-1 px-2 py-1 text-xs hover:bg-white/5 rounded transition-all duration-150"
          >
            <span>Query full dataset</span>
            <svg
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </Button>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="csv-grid-container relative h-full">
        {/* Row count indicator */}
        {renderRowCountIndicator()}

        {/* Performance Grid */}
        <div className="flex-1 h-full">
          <Grid
            data={gridData}
            columnTypes={columnTypes}
            isDataMode={isDataMode}
            onContextMenu={handleContextMenu}
            rowHeight={32}
            estimatedColumnWidth={120}
            editingCell={editingCell}
            editValue={editValue}
            onCellClick={handleCellClick}
            onCellEditChange={handleCellEdit}
            onCellBlur={handleCellBlur}
            onKeyDown={handleKeyDown}
            formatCellValue={formatCellValue}
            getCellClass={getCellClass}
          />
        </div>
      </div>

      {/* Inspector Panel */}
      <InspectorPanel />
    </>
  );
};

export default CSVGrid;
