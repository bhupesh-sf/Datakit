import { DatabaseIcon, DownloadIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface QueryResultsProps {
  results: any[] | null;
  columns: string[] | null;
  isLoading: boolean;
  error: string | null;
}

export function QueryResults({ results, columns, isLoading, error }: QueryResultsProps) {
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
        <h4 className="font-medium text-destructive mb-2">Error:</h4>
        <pre className="text-xs bg-background p-3 rounded overflow-auto max-h-60 whitespace-pre-wrap">
          {error}
        </pre>
      </div>
    );
  }

  if (!results || !columns) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-10 text-white text-opacity-70">
        <DatabaseIcon size={24} className="text-white opacity-30 mb-4" />
        <p className="text-sm">Execute a query to see results.</p>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-10 text-white text-opacity-70">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="mb-4 text-white opacity-30">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor" />
        </svg>
        <p className="text-sm">Query executed successfully. No results returned.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-3">
        <div className="text-xs text-white text-opacity-70">
          <span className="font-medium">{results.length.toLocaleString()}</span> rows returned
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={downloadCSV}
        >
          <DownloadIcon size={12} className="mr-1" />
          <span>Download CSV</span>
        </Button>
      </div>
      
      <div className="bg-background border border-white/10 rounded overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
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
            {results.map((row, rowIndex) => (
              <tr 
                key={rowIndex}
                className={`hover:bg-white/5 ${rowIndex % 2 === 0 ? 'bg-black/20' : ''}`}
              >
                {columns.map((column, colIndex) => {
                  // Determine cell style based on value type
                  let cellClass = "p-2 text-xs border-b border-white/10";
                  
                  const value = row[column];
                  if (value === null || value === undefined) {
                    cellClass += " text-white/30 italic";
                  } else if (typeof value === 'number') {
                    cellClass += " font-mono text-tertiary text-right";
                  } else if (typeof value === 'boolean') {
                    cellClass += " text-primary text-center";
                  }
                  
                  return (
                    <td key={colIndex} className={cellClass}>
                      {value !== null && value !== undefined
                        ? String(value)
                        : "NULL"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}