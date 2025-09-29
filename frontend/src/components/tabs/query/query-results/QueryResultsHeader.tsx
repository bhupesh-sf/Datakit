import React from 'react';
import { Download, TableIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Tooltip } from '@/components/ui/Tooltip';
import { useQueryColumnFormatting } from './useQueryColumnFormatting';

interface QueryResultsHeaderProps {
  totalRows: number;
  currentPage: number;
  totalPages: number;
  rowsPerPage: number;
  results: any[];
  columns: string[];
  onImportAsTable?: () => void;
  isImporting?: boolean;
}

const QueryResultsHeader: React.FC<QueryResultsHeaderProps> = ({ 
  totalRows, 
  currentPage, 
  totalPages, 
  rowsPerPage,
  results,
  columns,
  onImportAsTable,
  isImporting = false
}) => {
  const { t } = useTranslation();
  const { formatCellValue } = useQueryColumnFormatting({
    results,
    columns,
  });


  const downloadCSV = () => {
    if (!results || !columns) return;
    
    const csvContent = [
      columns.join(','),
      ...results.map((row, rowIndex) => 
        columns.map((col, colIndex) => {
          const rawValue = row[col];
          const formattedValue = formatCellValue(String(rawValue || ''), rowIndex + 1, colIndex + 1);
          
          if (formattedValue === null || formattedValue === undefined || formattedValue === '') {
            return '';
          }
          
          // Handle CSV escaping for formatted values
          const valueStr = String(formattedValue);
          if (valueStr.includes(',') || valueStr.includes('"') || valueStr.includes('\n')) {
            return `"${valueStr.replace(/"/g, '""')}"`;
          }
          return valueStr;
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
        <span className="font-medium">{totalRows.toLocaleString()}</span> {t('queryResults.header.rowsReturned', { defaultValue: 'rows returned' })}
        {totalRows > rowsPerPage && (
          <span className="ml-2">
            ({t('queryResults.header.showingPage', { defaultValue: 'showing page {{current}} of {{total}}', current: currentPage, total: totalPages })})
          </span>
        )}
      </div>
      
      <div className="flex items-center space-x-2">
        {onImportAsTable && (
          <Tooltip 
            content="Save these results as a new table in your database"
            placement="bottom"
          >
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs border-primary"
              onClick={onImportAsTable}
              disabled={isImporting || !results || results.length === 0}
            >
              <TableIcon size={12} className="mr-1" />
              <span>{isImporting ? 'Importing...' : 'Save as Table'}</span>
            </Button>
          </Tooltip>
        )}
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs border-primary"
          onClick={downloadCSV}
        >
          <Download size={12} className="mr-1" />
          <span>{t('queryResults.header.downloadCSV', { defaultValue: 'Download CSV' })}</span>
        </Button>
      </div>
    </div>
  );
};

export default QueryResultsHeader;