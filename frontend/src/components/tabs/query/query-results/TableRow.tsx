import React from 'react';
import TableCell from './TableCell';

interface TableRowProps {
  index: number;
  style: React.CSSProperties;
  row: any;
  columns: string[];
  columnWidths: number[];
  totalWidth: number;
}

const TableRow: React.FC<TableRowProps> = ({ 
  index, 
  style, 
  row, 
  columns, 
  columnWidths,
  totalWidth
}) => {
  if (!columns || !row) return null;
  
  return (
    <div 
      style={{
        ...style,
        display: 'flex',
        width: totalWidth,
        minWidth: '100%'
      }}
      className={`${index % 2 === 0 ? 'bg-black/20' : ''} hover:bg-white/5`}
    >
      {columns.map((column, colIndex) => (
        <TableCell 
          key={colIndex}
          value={row[column]}
          width={columnWidths[colIndex] || 120}
        />
      ))}
    </div>
  );
};

export default TableRow;