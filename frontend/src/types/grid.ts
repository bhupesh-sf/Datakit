export interface GridProps {
  data: string[][];
  columnTypes?: string[];
  isDataMode?: boolean;
  onCellEdit?: (rowIndex: number, colIndex: number, value: string) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  className?: string;
  rowHeight?: number;
  headerHeight?: number;
  estimatedColumnWidth?: number;
}

export interface CellProps {
  rowIndex: number;
  columnIndex: number;
  style: React.CSSProperties;
  data: GridData;
}

export interface GridData {
  items: string[][];
  columnTypes: string[];
  isDataMode: boolean;
  editingCell: { row: number; col: number } | null;
  editValue: string;
  onCellClick: (row: number, col: number) => void;
  onCellEdit: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCellBlur: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  formatCellValue: (value: string, rowIndex: number, colIndex: number) => string;
  getCellClass: (rowIndex: number, colIndex: number) => string;
  onCellContextMenu?: (
    e: React.MouseEvent,
    rowIndex: number,
    columnIndex: number,
    cellValue: string
  ) => void;
  sortState?: {
    columnIndex: number | null;
    direction: 'asc' | 'desc' | null;
  };
}

export interface EditingState {
  cell: { row: number; col: number } | null;
  value: string;
}