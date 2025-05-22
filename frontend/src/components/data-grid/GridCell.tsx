import { memo } from 'react';
import { CellProps } from '@/types/grid';

const GridCell = memo<CellProps>(({ rowIndex, columnIndex, style, data }) => {
  const {
    items,
    editingCell,
    editValue,
    onCellClick,
    onCellEdit,
    onCellBlur,
    onKeyDown,
    formatCellValue,
    getCellClass,
  } = data;

  // Safety check for data bounds
  if (!items || rowIndex >= items.length || !items[rowIndex] || columnIndex >= items[rowIndex].length) {
    return <div style={style} className="grid-cell" />;
  }

  const cellValue = items[rowIndex][columnIndex] || '';
  const isEditing = editingCell?.row === rowIndex && editingCell?.col === columnIndex;
  
  // Get cell styling
  const cellClass = getCellClass(rowIndex, columnIndex);
  const formattedValue = formatCellValue(cellValue, rowIndex, columnIndex);

  return (
    <div
      style={style}
      className={`grid-cell ${cellClass}`}
      onClick={() => onCellClick(rowIndex, columnIndex)}
    >
      {isEditing ? (
        <input
          type="text"
          value={editValue}
          onChange={onCellEdit}
          onBlur={onCellBlur}
          onKeyDown={onKeyDown}
          autoFocus
          className="csv-grid-cell-input"
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            outline: 'none',
            padding: '4px 8px',
            background: 'transparent',
          }}
        />
      ) : (
        <span className="cell-content">{formattedValue}</span>
      )}
    </div>
  );
});

GridCell.displayName = 'GridCell';

export default GridCell;