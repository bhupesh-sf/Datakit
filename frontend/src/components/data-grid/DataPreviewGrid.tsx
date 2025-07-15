import React, { useEffect, useCallback } from "react";
import { CheckCircle } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { useInspectorStore } from "@/store/inspectorStore";
import { selectActiveFile } from "@/store/selectors/appSelectors";
import { useDataPreview } from "@/hooks/useDataPreview";

import Grid from "./Grid";
import InspectorPanel from "@/components/tabs/preview/inspector/InspectorPanel";
import DataPreviewPagination from "./DataPreviewPagination";
import { Button } from "../ui/Button";

import { useCellFormatting } from "./hooks/useCellFormatting";
import { useColumnSorting } from "./hooks/useColumnSorting";
import { useCellInteraction } from "./hooks/useCellInteraction";
import CellContextMenu from "./CellContextMenu";

const DataPreviewGrid: React.FC = () => {
  const activeFile = useAppStore(selectActiveFile);
  const { setActiveTab } = useAppStore();
  const { openPanel, analyzeFile } = useInspectorStore();

  const {
    results: gridData,
    columns,
    error,
    totalRows,
    currentPage,
    totalPages,
    rowsPerPage,
    isLoading,
    isChangingPage,
    isCountLoading,
    loadInitialData,
    changePage,
    changeRowsPerPage,
  } = useDataPreview();

  // Load initial data when component mounts or active file changes
  useEffect(() => {
    if (activeFile?.id) {
      loadInitialData();
    }
  }, [activeFile?.id, loadInitialData]);

  // Column sorting functionality
  const { sortedData, sortState, sortData, clearSort } = useColumnSorting(
    gridData || []
  );

  // Cell interaction functionality
  const {
    contextMenu,
    handleCellClick: handleCellContextMenu,
    handleCopyCell,
    closeContextMenu,
  } = useCellInteraction();

  // Cell formatting with skeleton support
  const { formatCellValue: originalFormatCellValue, getCellClass } = useCellFormatting(
    activeFile?.columnTypes || [],
    true,
    {
      animationActive: false,
      gridData: sortedData,
      animationMessage: [],
      activeWordIndex: -1,
    }
  );

  // Enhanced format cell value with skeleton loading
  const formatCellValue = (row: number, col: number): React.ReactNode => {
    const originalValue = originalFormatCellValue(row, col);
    
    // Show skeleton for empty cells during loading/changing pages
    if ((isLoading || isChangingPage) && row > 0 && col > 0 && (!originalValue || originalValue === "")) {
      // Create consistent but varied skeleton widths based on row/col position
      const seedValue = (row * 31 + col * 17) % 100;
      let widthClass = 'w-3/4';
      
      if (seedValue < 25) widthClass = 'w-1/2';
      else if (seedValue < 50) widthClass = 'w-2/3';
      else if (seedValue < 75) widthClass = 'w-3/4';
      else widthClass = 'w-5/6';
      
      // Add staggered animation delay for wave effect
      const delay = `${(row + col) * 25}ms`;
      
      return (
        <div 
          className={`h-3.5 skeleton-base rounded relative overflow-hidden ${widthClass}`}
          style={{ animationDelay: delay }}
        >
          <div 
            className="absolute inset-0 skeleton-shimmer"
            style={{ animationDelay: delay }}
          />
        </div>
      );
    }
    
    return originalValue;
  };

  // Handle context menu
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setActiveTab("query");
    },
    [setActiveTab]
  );

  const handleInspectorClick = useCallback(() => {
    if (!activeFile) return;

    const tableName = activeFile.tableName;
    openPanel();
    analyzeFile(activeFile.id, tableName);
  }, [activeFile, openPanel, analyzeFile]);

  const renderHeader = () => {
    if (!activeFile && !isLoading) return null;

    const columnCount = columns?.length || 0;
    const displayRows = isCountLoading ? (
      <div className="flex items-center gap-1">
        <svg className="w-3 h-3 text-primary animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="animate-pulse">Counting...</span>
      </div>
    ) : totalRows.toLocaleString();

    return (
      <div className="flex justify-between items-center px-4 py-2.5 bg-dark-nav">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium text-white">
                {displayRows}
              </span>
              <span className="text-xs text-white/60">
                {isCountLoading ? "rows" : "total rows"}
              </span>
            </div>

            {columnCount > 0 && (
              <>
                <div className="w-px h-3 bg-white/20" />
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium text-white/90">
                    {columnCount}
                  </span>
                  <span className="text-xs text-white/60">columns</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
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

  // Generate loading skeleton data
  const getLoadingData = () => {
    const columnCount = columns?.length || 10;
    const headers = [" ", ...Array.from({ length: columnCount }, (_, i) => String.fromCharCode(65 + i))];
    const rows = [headers];
    
    for (let i = 1; i <= 25; i++) {
      const row = [i.toString()];
      for (let j = 1; j < headers.length; j++) {
        row.push(""); // Empty cells will show skeleton
      }
      rows.push(row);
    }
    
    return rows;
  };

  // Show error state
  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-white/70">
          <p className="text-lg mb-2 text-red-400">Error loading data</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const displayData = sortedData.length > 0 ? sortedData : (isLoading ? getLoadingData() : []);

  return (
    <>
      <style>{`
        @keyframes skeleton-shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }
        
        .skeleton-shimmer {
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%);
          background-size: 200% 100%;
          animation: skeleton-shimmer 1.5s ease-in-out infinite;
        }
        
        .skeleton-base {
          animation: skeleton-pulse 2s ease-in-out infinite;
        }
        
        @keyframes skeleton-pulse {
          0%, 100% {
            background-color: rgba(255,255,255,0.08);
          }
          50% {
            background-color: rgba(255,255,255,0.12);
          }
        }
      `}</style>
      <div className="csv-grid-container relative h-full flex flex-col">
        {renderHeader()}

        <div className="flex-1 overflow-hidden">
          <div className={`h-full transition-opacity duration-300 ${isLoading || isChangingPage ? 'opacity-90' : 'opacity-100'}`}>
            <Grid
              data={displayData}
              columnTypes={activeFile?.columnTypes || []}
              isDataMode={!isLoading && displayData.length > 0}
              onContextMenu={handleContextMenu}
              rowHeight={32}
              estimatedColumnWidth={120}
              editingCell={null}
              editValue=""
              onCellClick={() => {}}
              onCellEditChange={() => {}}
              onCellBlur={() => {}}
              onKeyDown={() => {}}
              formatCellValue={formatCellValue}
              getCellClass={(row, col) => {
                const baseClass = getCellClass(row, col);
                if ((isLoading || isChangingPage) && row > 0 && col > 0) {
                  return `${baseClass} bg-white/5`;
                }
                return baseClass;
              }}
              onCellContextMenu={handleCellContextMenu}
              onSort={sortData}
              sortState={sortState}
            />
          </div>
        </div>

        {/* Pagination footer - show when we have an active file */}
        {activeFile && (
          <DataPreviewPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalRows={totalRows}
            rowsPerPage={rowsPerPage}
            isCountLoading={isCountLoading}
            onPageChange={changePage}
            onRowsPerPageChange={changeRowsPerPage}
            disabled={isLoading || isChangingPage}
          />
        )}
      </div>

      {/* Cell Context Menu */}
      <CellContextMenu
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        onClose={closeContextMenu}
        onCopy={handleCopyCell}
        isHeader={contextMenu.isHeader}
        onSort={(direction) => {
          if (contextMenu.columnIndex > 0) {
            sortData(contextMenu.columnIndex, direction);
          }
        }}
        cellValue={contextMenu.cellValue}
      />

      {/* Inspector Panel */}
      <InspectorPanel />
    </>
  );
};

export default DataPreviewGrid;