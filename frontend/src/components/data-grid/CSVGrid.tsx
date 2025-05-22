import React, { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/store/appStore';
import { selectData, selectColumnTypes } from '@/store/selectors/appSelectors';

import Grid from './Grid';

import { useGridEditing } from './hooks/useGridEditing';
import { useCellFormatting } from './hooks/useCellFormatting';

import { useEmptyGrid, useWelcomeAnimation } from './hooks'; 

const CSVGrid: React.FC = () => {
  const storeData = useAppStore(selectData);
  const columnTypes = useAppStore(selectColumnTypes);
  const { setActiveTab } = useAppStore();

  console.log('EnhancedCSVGrid render:', { 
    storeData: storeData?.length || 0, 
    columnTypes: columnTypes?.length || 0 
  });

  // Get empty grid for animation
  const emptyGrid = useEmptyGrid();

  // Setup local state
  const [gridData, setGridData] = useState(() => {
    if (storeData && storeData.length > 0) {
      console.log('Initializing with store data:', storeData.length, 'rows');
      return storeData.map((row, index) => {
        if (index === 0) return [" ", ...row];
        return [index.toString(), ...row];
      });
    }
    console.log('Initializing with empty grid');
    return emptyGrid;
  });

  const [isDataMode, setIsDataMode] = useState(!!storeData && storeData.length > 0);
  const [totalRows, setTotalRows] = useState(storeData ? Math.max(0, storeData.length - 1) : 0);

  // Animation functionality
  const hasDataToDisplay = !!storeData && storeData.length > 0;
  const { activeWordIndex, animationMessage, animationActive } = useWelcomeAnimation(
    emptyGrid, 
    setGridData, 
    hasDataToDisplay
  );

  // Editing functionality
  const {
    editingCell,
    editValue,
    handleCellClick,
    handleCellEdit,
    handleCellBlur,
    handleKeyDown
  } = useGridEditing(gridData, setGridData);

  // Cell formatting
  const { formatCellValue, getCellClass } = useCellFormatting(
    columnTypes,
    isDataMode,
    {
      animationActive,
      gridData,
      animationMessage,
      activeWordIndex
    }
  );

  // Handle data import from global store
  useEffect(() => {
    console.log('Effect triggered:', { 
      storeDataLength: storeData?.length || 0, 
      animationActive 
    });

    if (storeData && storeData.length > 0) {
      const withRowNumbers = storeData.map((row, index) => {
        if (index === 0) {
          return [" ", ...row];
        }
        return [index.toString(), ...row];
      });

      console.log('Setting grid data with row numbers:', withRowNumbers.length, 'rows');
      setGridData(withRowNumbers);
      setIsDataMode(true);
      setTotalRows(storeData.length - 1);
    } else if (!animationActive) {
      console.log('Resetting to empty grid');
      setIsDataMode(false);
      setGridData(emptyGrid);
      setTotalRows(0);
    }
  }, [storeData, emptyGrid, animationActive]);

  // Handle context menu
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (isDataMode) {
      setActiveTab("query");
    }
  }, [isDataMode, setActiveTab]);

  // Render row count indicator
  const renderRowCountIndicator = () => {
    if (!isDataMode || totalRows === 0) return null;
    
    return (
      <div className="flex justify-between items-center p-2 bg-darkNav">
        <div className="text-sm text-white text-opacity-70">
          Displaying {totalRows.toLocaleString()} rows
        </div>
        <button
          onClick={() => setActiveTab('query')}
          className="text-xs text-primary hover:text-primary-hover cursor-pointer"
        >
          Query full dataset →
        </button>
      </div>
    );
  };

  console.log('About to render grid with data:', { 
    gridDataLength: gridData.length, 
    firstRowLength: gridData[0]?.length || 0,
    isDataMode,
    totalRows 
  });

  return (
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
  );
};

export default CSVGrid;