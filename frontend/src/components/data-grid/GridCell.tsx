import { memo, useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { CellProps } from '@/types/grid';

const GridCell = memo<CellProps>(({ rowIndex, columnIndex, style, data }) => {
  const {
    items,
    editingCell,
    formatCellValue,
    getCellClass,
    onCellContextMenu,
    sortState,
  } = data;

  const [isHovered, setIsHovered] = useState(false);

  // Safety check for data bounds
  if (!items || rowIndex >= items.length || !items[rowIndex] || columnIndex >= items[rowIndex].length) {
    return <div style={style} className="grid-cell" />;
  }

  const cellValue = items[rowIndex][columnIndex] || '';
  const isEditing = editingCell?.row === rowIndex && editingCell?.col === columnIndex;
  const isHeader = rowIndex === 0;
  const isRowNumberColumn = columnIndex === 0;
  
  // Get cell styling
  const cellClass = getCellClass(rowIndex, columnIndex);
  const formattedValue = formatCellValue(cellValue, rowIndex, columnIndex);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onCellContextMenu) {
      onCellContextMenu(e, rowIndex, columnIndex, cellValue);
    }
  };

  return (
    <div
      style={style}
      className={`grid-cell ${cellClass} cursor-pointer hover:bg-white/5 transition-colors relative`}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span className="cell-content">{formattedValue}</span>
      
      {/* Sort indicator for header cells (except row number column) */}
      {isHeader && !isRowNumberColumn && (
        <div className={`absolute right-2 top-1/2 -translate-y-1/2 transition-opacity ${
          isHovered || (sortState?.columnIndex === columnIndex) ? 'opacity-60' : 'opacity-20'
        }`}>
          {sortState?.columnIndex === columnIndex ? (
            sortState.direction === 'asc' ? (
              <ArrowUp size={14} className="text-primary" />
            ) : (
              <ArrowDown size={14} className="text-primary" />
            )
          ) : (
            <ArrowUpDown size={14} className="text-white/60" />
          )}
        </div>
      )}
    </div>
  );
});

GridCell.displayName = 'GridCell';

export default GridCell;