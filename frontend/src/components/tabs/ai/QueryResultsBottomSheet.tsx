import React, { useCallback, useRef } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { X, Table2 } from "lucide-react";
import { useTranslation } from 'react-i18next';

import { useQueryResultsImport } from "@/hooks/query/useQueryResultsImport";
import QueryResults from "@/components/tabs/query/query-results/QueryResults";
import SaveAsTableModal from "@/components/tabs/query/query-results/SaveAsTableModal";

interface QueryResult {
  data: any[];
  columns: Array<{ name: string; type: string }> | string[];
  totalRows: number;
  error?: string;
  isLoading?: boolean;
}

interface QueryResultsBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  queryResult: QueryResult;
  query: string;
  activeFile?: {
    id: string;
    fileName?: string;
    tableName?: string;
  } | null;
}

const QueryResultsBottomSheet: React.FC<QueryResultsBottomSheetProps> = ({
  isOpen,
  onClose,
  queryResult,
  query,
  activeFile,
}) => {
  const { t } = useTranslation();
  const { isImporting, importQueryResultsAsTable } = useQueryResultsImport();

  const [showSaveAsTableModal, setShowSaveAsTableModal] = React.useState(false);
  
  const constraintsRef = useRef(null);

  // Handle drag end - close if dragged down enough
  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 150; // pixels to drag down before closing
    if (info.offset.y > threshold) {
      onClose();
    }
  };

  // Handle opening the save as table modal
  const handleImportAsTable = useCallback(() => {
    setShowSaveAsTableModal(true);
  }, []);

  // Handle confirming table import with custom name
  const handleConfirmImportAsTable = useCallback(async (tableName: string) => {
    if (!queryResult?.data || !queryResult?.columns) return;

    // Use dynamic source file name based on active file or fallback to ai_query_results
    const sourceFileName = activeFile?.fileName || activeFile?.tableName || 'ai_query_results';
    
    // Convert columns to string array if needed for the import function
    const columnsArray = queryResult.columns.map(col => 
      typeof col === 'string' ? col : col.name
    );
    
    // Pass the executed SQL for VIEW creation of large datasets and the custom table name
    const success = await importQueryResultsAsTable(
      queryResult.data, 
      columnsArray, 
      sourceFileName,
      query, // Use the query as executedSQL
      tableName
    );
    if (success) {
      setShowSaveAsTableModal(false);
    }
  }, [queryResult, importQueryResultsAsTable, activeFile, query]);

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40"
              onClick={onClose}
            />

            {/* Bottom Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ 
                type: "spring", 
                damping: 30, 
                stiffness: 300,
                duration: 0.3 
              }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 200 }}
              dragElastic={0.2}
              onDragEnd={handleDragEnd}
              className="fixed bottom-0 left-0 right-0 bg-black border-t border-white/20 rounded-t-xl shadow-xl z-50"
              style={{ height: "80vh", maxHeight: "600px" }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag Handle */}
              <div className="absolute top-2 left-1/2 transform -translate-x-1/2">
                <div className="w-12 h-1 bg-white/30 rounded-full hover:bg-white/50 transition-colors" />
              </div>

              {/* Header - Draggable Area */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 cursor-grab active:cursor-grabbing">
                <div className="flex items-center gap-3 pointer-events-none">
                  <Table2 className="h-5 w-5 text-primary" />
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      {t('ai.results.fullResults', { defaultValue: 'Query Results' })}
                    </h2>
                    <p className="text-sm text-white/60">
                      {queryResult.totalRows.toLocaleString()} {t('ai.results.rows', { defaultValue: 'rows' })} • {queryResult.columns.length} {t('ai.results.columns', { defaultValue: 'columns' })}
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/70 hover:text-white pointer-events-auto"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Results Content */}
              <div className="flex-1 overflow-hidden">
                <QueryResults
                  results={queryResult.data}
                  columns={queryResult.columns.map(col => typeof col === 'string' ? col : col.name)}
                  isLoading={queryResult.isLoading}
                  error={queryResult.error}
                  totalRows={queryResult.totalRows}
                  currentPage={1}
                  totalPages={Math.ceil(queryResult.totalRows / 100)}
                  rowsPerPage={100}
                  onPageChange={(page) => {
                    console.log("Page change:", page);
                  }}
                  onRowsPerPageChange={(rowsPerPage) => {
                    console.log("Rows per page:", rowsPerPage);
                  }}
                  onImportAsTable={handleImportAsTable}
                  isImporting={isImporting}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Save As Table Modal */}
      <SaveAsTableModal
        isOpen={showSaveAsTableModal}
        onClose={() => setShowSaveAsTableModal(false)}
        onConfirm={handleConfirmImportAsTable}
        isImporting={isImporting}
        rowCount={queryResult?.totalRows || 0}
        columnCount={queryResult?.columns?.length || 0}
        sourceFileName={activeFile?.fileName || activeFile?.tableName || 'ai_query_results'}
      />
    </>
  );
};

export default QueryResultsBottomSheet;