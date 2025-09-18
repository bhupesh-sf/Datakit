import React, { useEffect, useCallback, useRef, useState } from 'react';
import { Search, BarChart3 } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useInspectorStore } from '@/store/inspectorStore';
import { useDuckDBStore } from '@/store/duckDBStore';
import { selectActiveFile } from '@/store/selectors/appSelectors';
import { useDataPreview } from '@/hooks/useDataPreview';

import UnifiedGrid, { UnifiedGridRef } from './UnifiedGrid';
import InspectorPanel from '@/components/tabs/preview/inspector/InspectorPanel';
import DataPreviewPagination from './DataPreviewPagination';
import { Button } from '../ui/Button';

import { useCellFormatting } from './hooks/useCellFormatting';
import { useColumnSorting } from './hooks/useColumnSorting';
import { useCellInteraction } from './hooks/useCellInteraction';
import CellContextMenu from './CellContextMenu';

interface DataPreviewGridProps {
  fileId?: string;
  hideHeader?: boolean;
}

const DataPreviewGrid: React.FC<DataPreviewGridProps> = ({ fileId, hideHeader = false }) => {
  const activeFile = useAppStore(selectActiveFile);
  const { setActiveTab } = useAppStore();
  const { openPanel, analyzeFile } = useInspectorStore();
  const { getObjectType } = useDuckDBStore();
  
  // Ref to UnifiedGrid for accessing stats functionality
  const gridRef = useRef<UnifiedGridRef>(null);
  const [showStats, setShowStats] = useState(false);
  const [isView, setIsView] = useState(false);

  // Use provided fileId or fall back to active file
  const targetFileId = fileId || activeFile?.id;
  
  // Get target file for proper column types and other checks
  const targetFile = targetFileId 
    ? useAppStore.getState().files.find(f => f.id === targetFileId)
    : activeFile;

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
  } = useDataPreview(targetFileId);

  // Load initial data when component mounts or target file changes
  useEffect(() => {
    if (targetFileId) {
      loadInitialData();
    }
  }, [targetFileId, loadInitialData]);

  // Check if the table is a view when file changes
  useEffect(() => {
    const checkIfView = async () => {
      if (targetFile?.tableName) {
        try {
          const objectType = await getObjectType(targetFile.tableName);
          setIsView(objectType === 'view');
        } catch (error) {
          console.error('Error checking object type:', error);
          setIsView(false);
        }
      } else {
        // Reset to false if no table name (e.g., remote files)
        setIsView(false);
      }
    };
    
    checkIfView();
  }, [targetFile?.tableName, getObjectType]);

  // Column sorting functionality
  const { sortedData, sortState, sortData, clearSort } = useColumnSorting(
    gridData || []
  );

  // Clear sort state when switching between files to prevent column highlighting issues
  useEffect(() => {
    clearSort();
  }, [targetFileId, clearSort]);

  // Cell interaction functionality
  const {
    contextMenu,
    handleCellClick: handleCellContextMenu,
    handleCopyCell,
    closeContextMenu,
  } = useCellInteraction();


  // Cell formatting with skeleton support
  const { formatCellValue: originalFormatCellValue, getCellClass } =
    useCellFormatting(targetFile?.columnTypes || [], true, {
      animationActive: false,
      gridData: sortedData,
      animationMessage: [],
      activeWordIndex: -1,
    });

  // Enhanced format cell value with skeleton loading
  const formatCellValue = (value: string, rowIndex: number, colIndex: number): React.ReactNode => {
    const originalValue = originalFormatCellValue(value, rowIndex, colIndex);

    // Show skeleton during any loading state (initial load or page changes)
    if ((isLoading || isChangingPage) && rowIndex > 0 && colIndex > 0) {
      // Create consistent but varied skeleton widths based on row/col position
      const seedValue = (rowIndex * 31 + colIndex * 17) % 100;
      let widthClass = 'w-3/4';

      if (seedValue < 25) widthClass = 'w-1/2';
      else if (seedValue < 50) widthClass = 'w-2/3';
      else if (seedValue < 75) widthClass = 'w-3/4';
      else widthClass = 'w-5/6';

      return (
        <div
          className={`h-3 bg-white/10 rounded animate-pulse ${widthClass}`}
        />
      );
    }

    return originalValue;
  };

  // Handle context menu
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setActiveTab('query');
    },
    [setActiveTab]
  );

  const handleInspectorClick = useCallback(() => {
    if (!activeFile) return;

    const tableName = activeFile.tableName;
    openPanel();
    analyzeFile(activeFile.id, tableName);
  }, [activeFile, openPanel, analyzeFile]);
  
  const handleColumnAnalysisToggle = useCallback(() => {
    if (!gridRef.current) return;
    
    const { columnStats, triggerAnalysis } = gridRef.current;
    
    if (columnStats.length > 0) {
      // Toggle visibility if we already have data
      setShowStats(!showStats);
    } else {
      // Load stats for first time
      setShowStats(true);
      triggerAnalysis();
    }
  }, [showStats]);

  const renderHeader = () => {
    if (!activeFile && !isLoading) return null;

    const columnCount = columns?.length || 0;
    const displayRows = isCountLoading ? (
      <div className="flex items-center gap-1">
        <svg
          className="w-3 h-3 text-primary animate-spin"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        <span className="animate-pulse">Counting...</span>
      </div>
    ) : (
      totalRows.toLocaleString()
    );

    return (
      <div className="flex justify-between items-center px-4 py-2.5 bg-dark-nav">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            {totalRows !== -1 && (
              <>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium text-white">
                    {displayRows}
                  </span>
                  <span className="text-xs text-white/60">
                    {isCountLoading ? 'rows' : 'total rows'}
                  </span>
                </div>
                <div className="w-px h-3 bg-white/20" />
              </>
            )}

            {columnCount > 0 && (
              <>
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
          {/* Column Analysis Button - only show for local files that are not views */}
          {targetFile && !targetFile.isRemote && !isView && (
            <>
              <Button
                variant="outline"
                onClick={handleColumnAnalysisToggle}
                className="group relative flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border border-white/20 hover:border-primary/40 bg-black/20 hover:bg-primary/10 transition-all duration-200"
              >
                {gridRef.current?.isLoadingStats ? (
                  <svg 
                    className="w-4 h-4 text-primary animate-spin" 
                    fill="none" 
                    viewBox="0 0 24 24"
                  >
                    <circle 
                      className="opacity-25" 
                      cx="12" 
                      cy="12" 
                      r="10" 
                      stroke="currentColor" 
                      strokeWidth="4"
                    />
                    <path 
                      className="opacity-75" 
                      fill="currentColor" 
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                ) : (
                  <BarChart3 className={`h-4 w-4 transition-colors ${
                    showStats && gridRef.current?.columnStats?.length > 0
                      ? 'text-green-400'
                      : 'text-white/60'
                  }`} />
                )}
                <span className="text-white/90 group-hover:text-white font-medium">
                  {gridRef.current?.columnStats?.length > 0 
                    ? (showStats ? 'Hide Stats' : 'Show Stats')
                    : 'Column Stats'
                  }
                </span>
              </Button>
              <div className="w-px h-3 bg-white/20" />
            </>
          )}
          
          <Button
            variant="outline"
            onClick={handleInspectorClick}
            data-inspector-trigger
            className="group relative flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border border-primary/30 bg-gradient-to-r from-primary/10 to-secondary/10 hover:from-primary/20 hover:to-secondary/20 transition-all duration-300 hover:scale-105"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-sm group-hover:blur-md transition-all duration-300" />
              <Search className="h-4 w-4 text-primary relative z-10 group-hover:text-primary-foreground transition-colors" />
            </div>
            <span className="text-white/90 group-hover:text-white font-medium">Inspector</span>
            <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/5 to-secondary/0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </Button>

          <div className="w-px h-3 bg-white/20" />

          <Button
            variant="outline"
            onClick={() => setActiveTab('query')}
            className="flex items-center gap-1 px-2 py-1 text-xs hover:bg-white/5 rounded transition-all duration-150"
          >
            <span>Query</span>
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
    const headers = [
      ' ',
      ...Array.from({ length: columnCount }, (_, i) =>
        String.fromCharCode(65 + i)
      ),
    ];
    const rows = [headers];

    for (let i = 1; i <= 25; i++) {
      const row = [i.toString()];
      for (let j = 1; j < headers.length; j++) {
        row.push(''); // Empty cells will show skeleton
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

  // Show skeleton data during page changes, otherwise show real data
  const displayData =
    isChangingPage || isLoading
      ? getLoadingData()
      : sortedData.length > 0
      ? sortedData
      : getLoadingData();

  return (
    <>
      <div className="csv-grid-container relative h-full flex flex-col">
        {!hideHeader && renderHeader()}

        <div className="flex-1 overflow-hidden">
          <div
            className={`h-full transition-opacity duration-300 ${
              isLoading || isChangingPage ? 'opacity-90' : 'opacity-100'
            }`}
          >
            <UnifiedGrid
              ref={gridRef}
              data={displayData}
              fileId={targetFileId}
              isRemoteSource={targetFile?.isRemote || false}
              showStats={showStats}
              onStatsToggle={() => setShowStats(!showStats)}
              columnTypes={targetFile?.columnTypes || []}
              isDataMode={
                !isLoading && !isChangingPage && displayData.length > 0
              }
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
            compact={hideHeader}
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
