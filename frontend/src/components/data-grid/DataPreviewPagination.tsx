import React from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Button } from "@/components/ui/Button";

interface DataPreviewPaginationProps {
  currentPage: number;
  totalPages: number;
  totalRows: number;
  rowsPerPage: number;
  isCountLoading: boolean;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rowsPerPage: number) => void;
  disabled?: boolean;
}

const DataPreviewPagination: React.FC<DataPreviewPaginationProps> = ({
  currentPage,
  totalPages,
  totalRows,
  rowsPerPage,
  isCountLoading,
  onPageChange,
  onRowsPerPageChange,
  disabled = false,
}) => {
  const handleRowsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRowsPerPage = Number(e.target.value);
    if (onRowsPerPageChange) {
      onRowsPerPageChange(newRowsPerPage);
    }
  };

  // Calculate current range
  const startRow = (currentPage - 1) * rowsPerPage + 1;
  const endRow = isCountLoading 
    ? Math.min(currentPage * rowsPerPage, startRow + rowsPerPage - 1)
    : Math.min(currentPage * rowsPerPage, totalRows);

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-darkNav border-t border-white/10">
      {/* Left: Rows per page selector */}
      <div className="flex items-center space-x-3">
        <span className="text-sm font-medium text-white/80">Show:</span>
        <select
          value={rowsPerPage}
          onChange={handleRowsPerPageChange}
          disabled={disabled}
          className="bg-background text-white text-sm font-medium px-3 py-1.5 rounded-md border border-white/20 hover:border-white/30 focus:border-primary focus:ring-1 focus:ring-primary/20 disabled:opacity-50 transition-all duration-200"
        >
          <option value={100}>100</option>
          <option value={500}>500</option>
          <option value={1000}>1,000</option>
          <option value={5000}>5,000</option>
          <option value={10000}>10,000</option>
        </select>
        <span className="text-sm text-white/60">rows</span>
      </div>

      {/* Center: Range display with improved counting state */}
      <div className="flex items-center space-x-2">
        {isCountLoading ? (
          <div className="flex items-center space-x-2">
            <div className="flex items-center">
              <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse mr-2"></div>
              <span className="text-sm font-medium text-white/90">
                Showing {startRow.toLocaleString()} - {endRow.toLocaleString()}
              </span>
            </div>
            <div className="text-white/40">•</div>
            <div className="flex items-center space-x-1">
              <svg className="w-3 h-3 text-primary animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-sm font-medium text-primary animate-pulse">
                Counting total rows...
              </span>
            </div>
          </div>
        ) : (
          <span className="text-sm font-medium text-white/90">
            {startRow.toLocaleString()} - {endRow.toLocaleString()} of{" "}
            <span className="text-white font-semibold">{totalRows.toLocaleString()}</span> rows
          </span>
        )}
      </div>

      {/* Right: Navigation controls */}
      <div className="flex items-center space-x-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 flex items-center justify-center rounded-md hover:bg-white/10 disabled:opacity-40 transition-all duration-200"
          disabled={disabled || currentPage === 1}
          onClick={() => onPageChange(1)}
          title="First Page"
        >
          <ChevronsLeft size={16} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 flex items-center justify-center rounded-md hover:bg-white/10 disabled:opacity-40 transition-all duration-200"
          disabled={disabled || currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          title="Previous Page"
        >
          <ChevronLeft size={16} />
        </Button>

        <div className="px-3 min-w-[140px] text-center">
          {isCountLoading && totalPages === 0 ? (
            <span className="text-sm font-medium text-white/90">
              Page <span className="font-semibold">{currentPage}</span>
              <span className="text-white/60"> of ?</span>
            </span>
          ) : totalPages === 0 ? (
            <span className="text-sm font-medium text-white/90">
              Page <span className="font-semibold">{currentPage}</span>
            </span>
          ) : (
            <span className="text-sm font-medium text-white/90">
              Page <span className="font-semibold">{currentPage.toLocaleString()}</span> of{" "}
              <span className="font-semibold">{totalPages.toLocaleString()}</span>
            </span>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 flex items-center justify-center rounded-md hover:bg-white/10 disabled:opacity-40 transition-all duration-200"
          disabled={
            disabled || currentPage === totalPages || totalPages === 0
          }
          onClick={() => onPageChange(currentPage + 1)}
          title="Next Page"
        >
          <ChevronRight size={16} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 flex items-center justify-center rounded-md hover:bg-white/10 disabled:opacity-40 transition-all duration-200"
          disabled={
            disabled || currentPage === totalPages || totalPages === 0
          }
          onClick={() => onPageChange(totalPages)}
          title="Last Page"
        >
          <ChevronsRight size={16} />
        </Button>
      </div>
    </div>
  );
};

export default DataPreviewPagination;