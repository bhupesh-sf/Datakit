import { useState, useEffect, useMemo } from 'react';
import { ColumnType } from '../../types/csv';

const generateEmptyGrid = (): string[][] => {
  const keywords = [
    'data', 'analytics', 'chart', 'ML', 'insights', 
    'metrics', 'KPI', 'forecast', 'trend', 'segment',
    'query', 'filter', 'sales', 'values', 'benchmark',
    'DuckDB', 'WASM', 'OLAP', 'SQL', 'visualization'
  ];
  
  // Generate headers (columns A through K)
  const headers = [' ', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];
  
  // Generate rows with random keywords
  const rows: string[][] = [headers];
  
  for (let i = 1; i <= 25; i++) {
    const row: string[] = [i.toString()]; // First column is row number
    for (let j = 1; j < headers.length; j++) {
      // 20% chance of keyword, 80% empty
      const hasKeyword = Math.random() < 0.2;
      row.push(hasKeyword ? keywords[Math.floor(Math.random() * keywords.length)] : '');
    }
    rows.push(row);
  }
  
  return rows;
};

type CSVGridProps = {
  data?: string[][];
  columnTypes?: ColumnType[];
};

const CSVGrid = ({ data, columnTypes = [] }: CSVGridProps) => {
  const emptyGrid = useMemo(() => generateEmptyGrid(), []);
  const [gridData, setGridData] = useState<string[][]>(emptyGrid);
  const [editCell, setEditCell] = useState<{ row: number; col: number } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  
  // Update grid when data prop changes
  useEffect(() => {
    if (data && data.length > 0) {
      // Add row numbers to imported data
      const withRowNumbers = data.map((row, index) => {
        if (index === 0) {
          return [' ', ...row]; // Header row
        }
        return [index.toString(), ...row]; // Data rows
      });
      setGridData(withRowNumbers);
    }
  }, [data]);
  
  // Handle cell click for editing
  const handleCellClick = (row: number, col: number) => {
    // Don't allow editing header row or row number column
    if (row === 0 || col === 0) return;
    
    setEditCell({ row, col });
    setEditValue(gridData[row][col]);
  };
  
  // Handle cell edit
  const handleCellEdit = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditValue(e.target.value);
  };
  
  // Handle cell edit save
  const handleCellBlur = () => {
    if (editCell) {
      const newData = [...gridData];
      newData[editCell.row][editCell.col] = editValue;
      setGridData(newData);
      setEditCell(null);
    }
  };
  
  // Handle key press in editable cell
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCellBlur();
    } else if (e.key === 'Escape') {
      setEditCell(null);
    }
  };
  
  // Determine cell class based on position and column type
  const getCellClass = (rowIndex: number, colIndex: number) => {
    let baseClass = '';
    
    if (rowIndex === 0) {
      baseClass = 'csv-grid-header';
    } else if (colIndex === 0) {
      baseClass = 'csv-grid-row-number';
    } else {
      baseClass = 'csv-grid-cell';
      
      // Add styling based on column type
      if (columnTypes && columnTypes.length > 0 && colIndex - 1 < columnTypes.length) {
        const type = columnTypes[colIndex - 1];
        
        switch (type) {
          case ColumnType.Number:
            baseClass += ' text-teal-400 text-right font-mono';
            break;
          case ColumnType.Date:
            baseClass += ' text-amber-300';
            break;
          case ColumnType.Boolean:
            baseClass += ' text-purple-400 text-center';
            break;
        }
      }
    }
    
    return baseClass;
  };
  
  // Format cell value based on type
  const formatCellValue = (value: string, rowIndex: number, colIndex: number) => {
    if (rowIndex === 0 || colIndex === 0 || !value) return value;
    
    // Skip if no column types available
    if (!columnTypes || columnTypes.length === 0 || colIndex - 1 >= columnTypes.length) {
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
        if (value.toLowerCase() === 'true' || value.toLowerCase() === 'yes') {
          return '✓';
        } else if (value.toLowerCase() === 'false' || value.toLowerCase() === 'no') {
          return '✗';
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
  };
  
  return (
    <div className="csv-grid-container">
      <table className="csv-grid-table">
        <thead>
          <tr>
            {gridData[0].map((cell, colIndex) => (
              <th key={colIndex}>
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
                  {editCell?.row === rowIndex + 1 && editCell.col === colIndex ? (
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