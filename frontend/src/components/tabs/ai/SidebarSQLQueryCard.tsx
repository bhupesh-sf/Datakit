import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Copy, Check, Code, PenSquare, ChevronDown, ChevronRight, Table2, AlertCircle, Maximize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Prism from 'prismjs';
import 'prismjs/components/prism-sql';

import { useAppStore } from '@/store/appStore';

import { Button } from '@/components/ui/Button';
import { Tooltip } from '@/components/ui/Tooltip';
import QueryResultsModal from '@/components/tabs/ai/QueryResultsModal';

interface QueryResult {
  data: any[];
  columns: Array<{ name: string; type: string }> | string[];
  totalRows: number;
  error?: string;
  isLoading?: boolean;
}

interface SidebarSQLQueryCardProps {
  query: string;
  index: number;
  responseId: string;
  isPrimary?: boolean;
  queryRunning?: boolean;
  activeFile?: {
    id: string;
    fileName?: string;
    tableName?: string;
  } | null;
}

const SidebarSQLQueryCard: React.FC<SidebarSQLQueryCardProps> = ({
  query,
  index,
  responseId,
  isPrimary = false,
  queryRunning,
  activeFile,
}) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [queryId, setQueryId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const { setPendingQuery, changeViewMode } = useAppStore();

  // Generate unique responseId if not provided
  const uniqueResponseId = responseId || `sidebar-response-${Date.now()}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(query);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleEdit = () => {
    // Set the pending query first
    setPendingQuery(query);
    
    // Small delay to ensure pending query is set before view change
    setTimeout(() => {
      console.log('[SidebarSQLQueryCard] Switching to query mode using store function');
      changeViewMode('query');
    }, 50);
  };

  const handleRun = async () => {
    try {
      // Generate unique ID for this query execution
      const currentQueryId = `${uniqueResponseId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      setQueryId(currentQueryId);
      setIsRunning(true);
      setShowResults(true);
      
      // Set initial loading state
      setQueryResult({
        data: [],
        columns: [],
        totalRows: 0,
        isLoading: true
      });

      console.log(`[SidebarSQLQueryCard] Running query with ID: ${currentQueryId}`);

      // Execute the query - we'll manually handle the results instead of relying on global state
      // Import the duckdb store directly to avoid the shared state issue
      const { useDuckDBStore } = await import('@/store/duckDBStore');
      const { executeQuery } = useDuckDBStore.getState();
      
      const result = await executeQuery(query);
      
      // Process results directly
      if (result) {
        const data = result.toArray?.() || [];
        
        // Handle schema safely
        let columns: Array<{ name: string; type: string }> = [];
        if (result.schema && Array.isArray(result.schema)) {
          columns = result.schema.map((col: any) => ({
            name: col.name || col.column_name || `column_${columns.length}`,
            type: col.type?.toString() || col.column_type?.toString() || 'unknown'
          }));
        } else if (data.length > 0) {
          // Fallback: infer columns from first row
          const firstRow = data[0];
          if (firstRow && typeof firstRow === 'object') {
            columns = Object.keys(firstRow).map(key => ({
              name: key,
              type: 'unknown'
            }));
          }
        }

        setQueryResult({
          data,
          columns,
          totalRows: data.length,
          isLoading: false,
          error: undefined
        });
      } else {
        // No result
        setQueryResult({
          data: [],
          columns: [],
          totalRows: 0,
          isLoading: false,
          error: undefined
        });
      }
      
    } catch (error) {
      console.error('Query execution failed:', error);
      setQueryResult({
        data: [],
        columns: [],
        totalRows: 0,
        error: error instanceof Error ? error.message : 'Query execution failed',
        isLoading: false
      });
    } finally {
      setIsRunning(false);
      setQueryId(null);
    }
  };

  // Each query card now manages its own results independently
  // No shared state listening needed

  const toggleResults = () => {
    if (!queryResult && !isRunning) {
      // If no results yet, run the query
      handleRun();
    } else if (queryResult && !isRunning) {
      // If we have results and not running, toggle visibility
      setShowResults(!showResults);
    }
    // If running, do nothing (button will be disabled)
  };

  const handleOpenModal = () => {
    setShowModal(true);
  };

  // Get syntax highlighted HTML
  const getHighlightedSQL = () => {
    try {
      return Prism.highlight(query, Prism.languages.sql, 'sql');
    } catch {
      return query;
    }
  };

  // Compact results display for sidebar
  const renderCompactResults = () => {
    if (!queryResult) return null;

    if (queryResult.isLoading) {
      return (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="border-t border-white/10 p-3 bg-black/20"
        >
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 bg-primary rounded-full animate-pulse" />
            <span className="text-xs text-white/60">
              {t('ai.queryCard.queryRunning', { defaultValue: 'Running query...' })}
            </span>
          </div>
        </motion.div>
      );
    }

    if (queryResult.error) {
      return (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="border-t border-white/10 p-3 bg-red-500/10"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-medium text-red-400 mb-1">
                {t('ai.results.error.title', { defaultValue: 'Query Error' })}
              </div>
              <div className="text-xs text-white/70 break-words">
                {queryResult.error}
              </div>
            </div>
          </div>
        </motion.div>
      );
    }

    if (queryResult.data.length === 0) {
      return (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="border-t border-white/10 p-3 bg-white/5"
        >
          <div className="flex items-center gap-2">
            <Table2 className="h-4 w-4 text-white/40" />
            <span className="text-xs text-white/60">
              {t('ai.results.noData', { defaultValue: 'No results returned' })}
            </span>
          </div>
        </motion.div>
      );
    }

    // Show compact table view
    const maxRows = 5; // Limit rows in sidebar
    const maxCols = 3; // Limit columns in sidebar
    const displayData = queryResult.data.slice(0, maxRows);
    
    // Handle both string[] and object[] column formats
    const normalizedColumns = queryResult.columns.map(col => 
      typeof col === 'string' ? { name: col, type: 'unknown' } : col
    );
    const displayColumns = normalizedColumns.slice(0, maxCols);

    return (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        className="border-t border-white/10 bg-white/5"
      >
        {/* Results summary */}
        <div className="px-3 py-2 border-b border-white/10 bg-black/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Table2 className="h-3 w-3 text-white/60" />
              <span className="text-xs text-white/70">
                {queryResult.totalRows.toLocaleString()} {t('ai.results.rows', { defaultValue: 'rows' })}
                {normalizedColumns.length > maxCols && (
                  <span className="text-white/50">
                    , {normalizedColumns.length} {t('ai.results.columns', { defaultValue: 'columns' })}
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {(queryResult.totalRows > maxRows || normalizedColumns.length > maxCols) && (
                <Tooltip content={t('ai.results.viewFull', { defaultValue: 'View full results' })} placement="bottom">
                  <button
                    onClick={handleOpenModal}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-primary/20 hover:bg-primary/30 border border-primary/30 rounded text-primary transition-colors"
                  >
                    <Maximize2 className="h-3 w-3" />
                    <span>{t('ai.results.viewFull', { defaultValue: 'View Full' })}</span>
                  </button>
                </Tooltip>
              )}
              {queryResult.totalRows > maxRows && (
                <span className="text-xs text-white/50">
                  +{queryResult.totalRows - maxRows} {t('ai.results.more', { defaultValue: 'more' })}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Compact table */}
        <div className="p-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/10">
                {displayColumns.map((col, idx) => (
                  <th key={idx} className="text-left py-1 pr-3 text-white/70 font-medium truncate">
                    {col.name}
                    {idx === maxCols - 1 && normalizedColumns.length > maxCols && (
                      <span className="text-white/40 ml-1">...</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayData.map((row, rowIdx) => (
                <tr key={rowIdx} className="border-b border-white/5 last:border-b-0">
                  {displayColumns.map((col, colIdx) => (
                    <td key={colIdx} className="py-1 pr-3 text-white/80 truncate max-w-[100px]">
                      {row[col.name] !== null && row[col.name] !== undefined
                        ? String(row[col.name])
                        : '-'
                      }
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={`group relative bg-white/5 border rounded-lg transition-all hover:bg-white/[0.07] w-full ${
        isPrimary ? 'border-primary/30' : 'border-white/10'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Code className="h-3.5 w-3.5 text-white/50 flex-shrink-0" />
          <span className="text-xs font-medium text-white/70 truncate">
            {t('ai.queryCard.query', { defaultValue: 'Query {index}', index: index + 1 })}
            {isPrimary && (
              <span className="ml-2 text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                {t('ai.queryCard.primary', { defaultValue: 'Primary' })}
              </span>
            )}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-100 transition-opacity flex-shrink-0">
          {/* Results toggle button */}
          <Tooltip
            content={
              queryResult
                ? (showResults ? t('ai.queryCard.hideResults', { defaultValue: 'Hide Results' }) : t('ai.queryCard.showResults', { defaultValue: 'Show Results' }))
                : t('ai.queryCard.runAndShowResults', { defaultValue: 'Run & Show Results' })
            }
            placement="bottom"
          >
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-primary hover:text-primary/80"
              onClick={toggleResults}
              disabled={isRunning || queryRunning}
            >
              {queryResult ? (
                showResults ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
              ) : (
                <Play className="h-3 w-3" />
              )}
            </Button>
          </Tooltip>

          <Tooltip
            content={copied ? t('ai.queryCard.copied', { defaultValue: 'Copied!' }) : t('ai.queryCard.copySQL', { defaultValue: 'Copy SQL' })}
            placement="bottom"
          >
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="h-3 w-3 text-green-400" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </Tooltip>

          <Tooltip content={t('ai.queryCard.editInQueryTab', { defaultValue: 'Edit in Query Tab' })} placement="bottom">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleEdit}
            >
              <PenSquare className="h-3 w-3" />
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* SQL Content */}
      <div className="p-3 overflow-hidden">
        <pre className="text-xs overflow-x-auto whitespace-pre">
          <code
            className="language-sql text-white/80"
            dangerouslySetInnerHTML={{ __html: getHighlightedSQL() }}
          />
        </pre>
      </div>

      {/* Inline Results */}
      <AnimatePresence>
        {showResults && renderCompactResults()}
      </AnimatePresence>

      {/* Running indicator */}
      {(isRunning || queryRunning) && (
        <motion.div
          initial={{ opacity: 0, scaleY: 0 }}
          animate={{ opacity: 1, scaleY: 1 }}
          exit={{ opacity: 0, scaleY: 0 }}
          transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
          style={{ transformOrigin: 'top' }}
          className="px-3 py-2 border-t border-white/10 bg-primary/10"
        >
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 bg-primary rounded-full animate-pulse" />
            <span className="text-xs text-primary/80">
              {t('ai.queryCard.queryRunning', { defaultValue: 'Query is running...' })}
            </span>
          </div>
        </motion.div>
      )}

      {/* Full Results Modal */}
      {queryResult && (
        <QueryResultsModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          queryResult={queryResult}
          query={query}
          activeFile={activeFile}
        />
      )}
    </motion.div>
  );
};

export default SidebarSQLQueryCard;