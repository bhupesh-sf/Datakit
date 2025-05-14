import React, { useState } from 'react';
import { Download, AlertCircle, Database, Check } from 'lucide-react';

import { Button } from '@/components/ui/Button';

interface QueryResultsProps {
  results: any[] | null;
  columns: string[] | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Enhanced component for displaying query execution results
 */
const QueryResults: React.FC<QueryResultsProps> = ({ 
  results, 
  columns, 
  isLoading, 
  error 
}) => {
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(100);
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);
  
  // Calculate pagination
  const totalPages = results ? Math.ceil(results.length / rowsPerPage) : 0;
  const startIndex = (page - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, results?.length || 0);
  const displayedResults = results?.slice(startIndex, endIndex) || [];
  
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
  
  // Copy results to clipboard
  const copyToClipboard = () => {
    if (!results || !columns) return;
    
    const table = [
      columns.join('\t'),
      ...results.map(row => 
        columns.map(col => String(row[col] ?? '')).join('\t')
      )
    ].join('\n');
    
    navigator.clipboard.writeText(table);
    setCopiedToClipboard(true);
    setTimeout(() => setCopiedToClipboard(false), 2000);
  };
  
  // Format value for display
  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };
  
  // Determine display style based on value type
  const getValueStyle = (value: any): string => {
    if (value === null || value === undefined) {
      return 'text-white/30 italic';
    }
    if (typeof value === 'number') {
      return 'text-tertiary font-mono text-right';
    }
    if (typeof value === 'boolean') {
      return 'text-primary text-center';
    }
    if (typeof value === 'string' && (
      /^\d{4}-\d{2}-\d{2}/.test(value) || // ISO date
      /^\d{2}\/\d{2}\/\d{4}/.test(value)  // US date
    )) {
      return 'text-secondary';
    }
    return '';
  };
  
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-10 text-white text-opacity-70">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mb-4"></div>
        <p className="text-sm">Executing query...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-destructive/10 border border-destructive/30 rounded p-4 text-white">
        <h4 className="font-medium text-destructive mb-2 flex items-center">
          <AlertCircle size={16} className="mr-2" />
          Error
        </h4>
        <pre className="text-xs bg-background p-3 rounded overflow-auto max-h-60 whitespace-pre-wrap">
          {error}
        </pre>
      </div>
    );
  }

  if (!results || !columns) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-10 text-white text-opacity-70">
        <Database size={24} className="text-white opacity-30 mb-4" />
        <p className="text-sm">Execute a query to see results.</p>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-10 text-white text-opacity-70">
        <Check size={24} className="text-primary mb-4" />
        <p className="text-sm">Query executed successfully. No results returned.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-3">
        <div className="text-xs text-white text-opacity-70">
          <span className="font-medium">{results.length.toLocaleString()}</span> rows returned
          {results.length > rowsPerPage && (
            <span className="ml-2">
              (showing {startIndex + 1}-{endIndex})
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={copyToClipboard}
          >
            {copiedToClipboard ? (
              <>
                <Check size={12} className="mr-1 text-primary" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <span>Copy</span>
              </>
            )}
          </Button>
          
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
      
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-darkNav">
              {columns.map((column, index) => (
                <th 
                  key={index} 
                  className="text-left p-2 text-xs font-medium text-white text-opacity-80 border-b border-r border-white/10 whitespace-nowrap"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayedResults.map((row, rowIndex) => (
              <tr 
                key={rowIndex}
                className={`hover:bg-white/5 ${rowIndex % 2 === 0 ? 'bg-black/20' : ''}`}
              >
                {columns.map((column, colIndex) => {
                  const value = row[column];
                  const valueStyle = getValueStyle(value);
                  
                  return (
                    <td 
                      key={colIndex} 
                      className={`p-2 text-xs border-b border-white/10 ${valueStyle}`}
                      title={formatValue(value)}
                    >
                      {formatValue(value)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 p-2 bg-darkNav rounded">
          <div className="flex items-center space-x-2">
            <span className="text-xs text-white/70">Rows per page:</span>
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setPage(1);
              }}
              className="bg-background text-white text-xs p-1 rounded border border-white/10"
            >
              <option value={100}>100</option>
              <option value={500}>500</option>
              <option value={1000}>1000</option>
              <option value={5000}>5000</option>
            </select>
          </div>
          
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={page === 1}
              onClick={() => setPage(1)}
            >
              First
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={page === 1}
              onClick={() => setPage(prev => Math.max(1, prev - 1))}
            >
              Prev
            </Button>
            
            <span className="text-xs text-white/70 px-2">
              Page {page} of {totalPages}
            </span>
            
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={page === totalPages}
              onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
            >
              Next
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={page === totalPages}
              onClick={() => setPage(totalPages)}
            >
              Last
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default QueryResults;