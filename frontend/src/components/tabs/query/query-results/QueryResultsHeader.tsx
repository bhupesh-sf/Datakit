import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface QueryResultsHeaderProps {
  totalRows: number;
  currentPage: number;
  totalPages: number;
  rowsPerPage: number;
  results: any[];
  columns: string[];
}

const QueryResultsHeader: React.FC<QueryResultsHeaderProps> = ({ 
  totalRows, 
  currentPage, 
  totalPages, 
  rowsPerPage,
  results,
  columns
}) => {
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);

  // Download results as CSV
  const downloadCSV = () => {
    if (!results || !columns) return;
    
    const csvContent = [
      columns.join(','),
      ...results.map(row => 
        columns.map(col => {
          const value = row[col];
          if (value === null || value === undefined) return '';
          if (typeof value === 'string' && value.includes(',')) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `query_results_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex justify-between items-center p-3 border-b border-white/10">
      <div className="text-xs text-white text-opacity-70">
        <span className="font-medium">{totalRows.toLocaleString()}</span> rows returned
        {totalRows > rowsPerPage && (
          <span className="ml-2">
            (showing page {currentPage} of {totalPages})
          </span>
        )}
      </div>
      
      <div className="flex items-center space-x-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={downloadCSV}
        >
          <Download size={12} className="mr-1" />
          <span>Download CSV</span>
        </Button>
      </div>
    </div>
  );
};

export default QueryResultsHeader;