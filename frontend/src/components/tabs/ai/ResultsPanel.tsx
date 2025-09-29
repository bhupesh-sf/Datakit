import React, { useCallback, useState } from "react";
import { Table, AlertCircle } from "lucide-react";
import { useTranslation } from 'react-i18next';

import { useAIStore } from "@/store/aiStore";
import { useQueryResultsImport } from "@/hooks/query/useQueryResultsImport";
import QueryResults from "@/components/tabs/query/query-results/QueryResults";
import SaveAsTableModal from "@/components/tabs/query/query-results/SaveAsTableModal";

interface ResultsPanelProps {
  height: number;
  activeFile?: {
    id: string;
    fileName?: string;
    tableName?: string;
  } | null;
}

const ResultsPanel: React.FC<ResultsPanelProps> = ({ height, activeFile }) => {
  const { t } = useTranslation();
  const { queryResults } = useAIStore();
  const { isImporting, importQueryResultsAsTable } = useQueryResultsImport();
  const [showSaveAsTableModal, setShowSaveAsTableModal] = useState(false);
  
  // Handle opening the save as table modal
  const handleImportAsTable = useCallback(() => {
    setShowSaveAsTableModal(true);
  }, []);
  
  // Handle confirming table import with custom name
  const handleConfirmImportAsTable = useCallback(async (tableName: string) => {
    if (!queryResults?.data || !queryResults?.columns) return;
    

    // Use dynamic source file name based on active file or fallback to ai_query_results
    const sourceFileName = activeFile?.fileName || activeFile?.tableName || 'ai_query_results';
    // Pass the executed SQL for VIEW creation of large datasets and the custom table name
    const success = await importQueryResultsAsTable(
      queryResults.data, 
      queryResults.columns, 
      sourceFileName,
      queryResults.executedSQL,
      tableName
    );
    if (success) {
      setShowSaveAsTableModal(false);
    }
  }, [queryResults, importQueryResultsAsTable, activeFile]);
  
  if (!queryResults) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-white/50">
          <Table className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm">{t('ai.results.placeholder', { defaultValue: 'Query results will appear here' })}</p>
        </div>
      </div>
    );
  }
  
  if (queryResults.error) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <AlertCircle className="h-12 w-12 mx-auto mb-3 text-red-400" />
          <h3 className="text-sm font-medium text-white mb-2">{t('ai.results.error.title', { defaultValue: 'Query Error' })}</h3>
          <p className="text-xs text-white/60">{queryResults.error}</p>
        </div>
      </div>
    );
  }
  
  return (
    <>
      <div className="h-full" style={{ height: `${height}px` }}>
        <QueryResults
          results={queryResults.data}
          columns={queryResults.columns}
          isLoading={queryResults.isLoading}
          error={queryResults.error}
          totalRows={queryResults.totalRows}
          currentPage={queryResults.currentPage}
          totalPages={queryResults.totalPages}
          rowsPerPage={queryResults.rowsPerPage}
          onPageChange={(page) => {
            // Handle pagination - this should be implemented in the store
            console.log("Page change:", page);
          }}
          onRowsPerPageChange={(rowsPerPage) => {
            // Handle rows per page change
            console.log("Rows per page:", rowsPerPage);
          }}
          onImportAsTable={handleImportAsTable}
          isImporting={isImporting}
        />
      </div>
      
      {/* Save As Table Modal */}
      <SaveAsTableModal
        isOpen={showSaveAsTableModal}
        onClose={() => setShowSaveAsTableModal(false)}
        onConfirm={handleConfirmImportAsTable}
        isImporting={isImporting}
        rowCount={queryResults.totalRows}
        columnCount={queryResults.columns?.length || 0}
        sourceFileName={activeFile?.fileName || activeFile?.tableName || 'ai_query_results'}
      />
    </>
  );
};

export default ResultsPanel;