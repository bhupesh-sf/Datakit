import React from 'react';
import { useTranslation } from 'react-i18next';

import QueryResultsHeader from './QueryResultsHeader';
import QueryResultsTable from './QueryResultsTable';
import QueryResultsPagination from './QueryResultsPagination';
import QueryResultsEmptyState from './QueryResultsEmptyState';

interface QueryResultsProps {
  results: any[] | null;
  columns: string[] | null;
  isLoading: boolean;
  error: string | null;
  // Pagination props
  totalRows?: number;
  currentPage?: number;
  totalPages?: number;
  rowsPerPage?: number;
  onPageChange?: (page: number) => void;
  onRowsPerPageChange?: (rowsPerPage: number) => void;
  // Import as table props
  onImportAsTable?: () => void;
  isImporting?: boolean;
}

/**
 * Enhanced component for displaying query execution results
 * with virtualization and pagination
 */
const QueryResults: React.FC<QueryResultsProps> = ({ 
  results, 
  columns, 
  isLoading, 
  error,
  totalRows = 0,
  currentPage = 1,
  totalPages = 0,
  rowsPerPage = 100,
  onPageChange,
  onRowsPerPageChange,
  onImportAsTable,
  isImporting = false
}) => {
  const { t } = useTranslation();
  // Show loading state
  if (isLoading) {
    return <QueryResultsEmptyState type="loading" />;
  }

  // Show error state
  if (error) {
    return <QueryResultsEmptyState type="error" message={error} />;
  }

  // Show empty state
  if (!results || !columns) {
    return <QueryResultsEmptyState type="empty" />;
  }

  // Show no results state
  if (results.length === 0) {
    return <QueryResultsEmptyState type="no-results" />;
  }

  return (
    <div 
      className="flex flex-col h-full border border-white/10 rounded-md overflow-hidden"
      aria-busy={isLoading}
      aria-live="polite"
    >
      {/* Header with row count and download options */}
      <QueryResultsHeader 
        totalRows={totalRows} 
        currentPage={currentPage} 
        totalPages={totalPages} 
        rowsPerPage={rowsPerPage} 
        results={results} 
        columns={columns} 
        onImportAsTable={onImportAsTable}
        isImporting={isImporting}
      />
      
      {/* Main table component with virtualization */}
      <div className="flex-1 overflow-hidden">
        <QueryResultsTable 
          results={results} 
          columns={columns} 
        />
      </div>
      
      {/* Pagination controls, if needed */}
      {totalPages > 1 && (
        <QueryResultsPagination
          currentPage={currentPage}
          totalPages={totalPages}
          rowsPerPage={rowsPerPage}
          onPageChange={onPageChange}
          onRowsPerPageChange={onRowsPerPageChange}
        />
      )}
    </div>
  );
};

export default React.memo(QueryResults);