import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Table2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { Button } from '@/components/ui/Button';
import QueryResults from '@/components/tabs/query/query-results/QueryResults';
import SaveAsTableModal from '@/components/tabs/query/query-results/SaveAsTableModal';
import { useQueryResultsImport } from '@/hooks/query/useQueryResultsImport';

interface QueryResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  queryResult: {
    data: any[];
    columns: Array<{ name: string; type: string }> | string[];
    totalRows: number;
    error?: string;
    isLoading?: boolean;
  };
  query: string;
  activeFile?: {
    id: string;
    fileName?: string;
    tableName?: string;
  } | null;
}

const QueryResultsModal: React.FC<QueryResultsModalProps> = ({
  isOpen,
  onClose,
  queryResult,
  query,
  activeFile
}) => {
  const { t } = useTranslation();
  const [showSaveAsTableModal, setShowSaveAsTableModal] = useState(false);
  const { isImporting, importQueryResultsAsTable } = useQueryResultsImport();

  // Normalize columns for QueryResults component (expects string[])
  const normalizedColumns = queryResult.columns.map(col => 
    typeof col === 'string' ? { name: col, type: 'unknown' } : col
  );
  
  // Convert to string array for QueryResults component
  const columnNames = normalizedColumns.map(col => col.name);

  // Handle save as table
  const handleImportAsTable = useCallback(() => {
    setShowSaveAsTableModal(true);
  }, []);

  const handleConfirmImportAsTable = useCallback(async (tableName: string) => {
    if (!queryResult?.data || !queryResult?.columns) return;
    
    const sourceFileName = activeFile?.fileName || activeFile?.tableName || 'ai_query_results';
    const success = await importQueryResultsAsTable(
      queryResult.data, 
      columnNames, 
      sourceFileName,
      query, // Use the actual SQL query
      tableName
    );
    if (success) {
      setShowSaveAsTableModal(false);
    }
  }, [queryResult, importQueryResultsAsTable, activeFile, query, columnNames]);

  if (!isOpen) return null;

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="bg-background border border-white/10 rounded-xl shadow-2xl w-full max-w-7xl max-h-[95vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header - Following QueryResults styling */}
              <div className="flex items-center justify-between p-3 border-b border-white/10 bg-darkNav">
                <div className="flex items-center gap-3">
                  <Table2 className="h-5 w-5 text-primary" />
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      {t('ai.results.modal.title', { defaultValue: 'Query Results' })}
                    </h2>
                    <div className="text-xs text-white/70 mt-0.5">
                      <span className="font-medium">{queryResult.totalRows.toLocaleString()}</span> rows returned
                      <span className="ml-3">{columnNames.length} columns</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
         
                 
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="h-7 w-7 text-white/70 hover:text-white hover:bg-white/10"
                  >
                    <X size={14} />
                  </Button>
                </div>
              </div>

              {/* SQL Query Display - Compact */}
              <div className="px-3 py-2 border-b border-white/10 bg-black/20">
                <div className="relative">
                  <pre className="text-xs text-white/80 font-mono bg-black/40 border border-white/10 rounded p-2 overflow-x-auto max-h-20 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20">
                    {query}
                  </pre>
                </div>
              </div>

              {/* Results Content */}
              <div className="flex-1 overflow-hidden">
                {queryResult.error ? (
                  <div className="h-full flex items-center justify-center p-6">
                    <div className="text-center max-w-md">
                      <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-white mb-3">
                        {t('ai.results.error.title', { defaultValue: 'Query Error' })}
                      </h3>
                      <div className="text-sm text-white/70 bg-red-500/5 border border-red-500/10 rounded p-3 mb-4 text-left font-mono">
                        {queryResult.error}
                      </div>
                      <Button
                        variant="outline"
                        onClick={onClose}
                        className="h-7 px-3 text-xs border-white/20 text-white/80 hover:bg-white/10"
                      >
                        Close
                      </Button>
                    </div>
                  </div>
                ) : queryResult.isLoading ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 mb-3">
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                      </div>
                      <p className="text-white/70 text-sm font-medium">
                        {t('ai.results.loading', { defaultValue: 'Loading results...' })}
                      </p>
                    </div>
                  </div>
                ) : queryResult.data.length === 0 ? (
                  <div className="h-full flex items-center justify-center p-6">
                    <div className="text-center">
                      <Table2 className="h-12 w-12 text-white/30 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-white mb-2">
                        No Results Found
                      </h3>
                      <p className="text-white/60 text-sm mb-4 max-w-sm">
                        {t('ai.results.noData', { defaultValue: 'Your query executed successfully but returned no data.' })}
                      </p>
                      <Button
                        variant="outline"
                        onClick={onClose}
                        className="h-7 px-3 text-xs border-white/20 text-white/80 hover:bg-white/10"
                      >
                        Close
                      </Button>
                    </div>
                  </div>
                ) : (
                  <QueryResults
                    results={queryResult.data}
                    columns={columnNames}
                    isLoading={queryResult.isLoading || false}
                    error={queryResult.error}
                    totalRows={queryResult.totalRows}
                    currentPage={1}
                    totalPages={Math.ceil(queryResult.totalRows / 50)}
                    rowsPerPage={50}
                    onPageChange={(page) => {
                      console.log("Modal page change:", page);
                    }}
                    onRowsPerPageChange={(rowsPerPage) => {
                      console.log("Modal rows per page:", rowsPerPage);
                    }}
                    onImportAsTable={handleImportAsTable}
                    isImporting={isImporting}
                  />
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Save As Table Modal */}
      <SaveAsTableModal
        isOpen={showSaveAsTableModal}
        onClose={() => setShowSaveAsTableModal(false)}
        onConfirm={handleConfirmImportAsTable}
        isImporting={isImporting}
        rowCount={queryResult.totalRows}
        columnCount={columnNames.length}
        sourceFileName={activeFile?.fileName || activeFile?.tableName || 'ai_query_results'}
      />
    </>
  );
};

export default QueryResultsModal;