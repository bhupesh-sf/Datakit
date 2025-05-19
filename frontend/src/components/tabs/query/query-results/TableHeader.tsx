import React, { RefObject } from 'react';

interface TableHeaderProps {
  columns: string[];
  columnWidths: number[];
  totalWidth: number;
  tableRef: RefObject<HTMLDivElement>;
}

const TableHeader: React.FC<TableHeaderProps> = ({ 
  columns, 
  columnWidths, 
  totalWidth,
  tableRef 
}) => {
  return (
    <div 
      className="z-10 sticky top-0 bg-darkNav shadow-md" 
      ref={tableRef} 
      style={{ overflow: 'hidden' }}
    >
      <div 
        className="flex" 
        style={{ 
          width: totalWidth,
          minWidth: '100%'
        }}
      >
        {columns.map((column, index) => (
          <div
            key={index}
            className="text-left p-2 text-xs font-medium text-white text-opacity-80 border-b border-r border-white/10 whitespace-nowrap"
            style={{ 
              width: columnWidths[index] || 120, 
              minWidth: columnWidths[index] || 120
            }}
            title={column}
          >
            {column}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TableHeader;