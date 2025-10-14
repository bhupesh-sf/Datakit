import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Copy, Check, Code, PenSquare, ChevronDown, ChevronRight, Table2, AlertCircle, Maximize2, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Prism from 'prismjs';
import 'prismjs/components/prism-sql';
import 'prismjs/themes/prism-tomorrow.css';

import { useAppStore } from '@/store/appStore';
import { useAIStore } from '@/store/aiStore';
import { Button } from '@/components/ui/Button';
import { Tooltip } from '@/components/ui/Tooltip';
import QueryResultsBottomSheet from '@/components/tabs/ai/QueryResultsBottomSheet';

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
  const [showBottomSheet, setShowBottomSheet] = useState(false);

  const { setPendingQuery, changeViewMode, showAIAssistant, setShowAIAssistant } = useAppStore();
  const { setCurrentPrompt, isProcessing: aiIsProcessing, streamingResponse } = useAIStore();

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

  const handleAskAIToFix = () => {
    // Create a well-formatted message for the AI to help fix the query
    const errorMessage = queryResult?.error || 'Query execution failed';
    
    // Create contextual message based on error type
    let promptMessage = `I'm getting an error when running this SQL query. Can you help me fix it?\n\n`;
    
    // Add the query
    promptMessage += `**Query:**\n\`\`\`sql\n${query}\n\`\`\`\n\n`;
    
    // Add the error
    promptMessage += `**Error:**\n${errorMessage}\n\n`;
    
    // Add helpful context
    if (activeFile?.fileName) {
      promptMessage += `**Context:** I'm working with the file "${activeFile.fileName}".`;
    }
    
    promptMessage += `\n\nPlease analyze the error and provide a corrected version of the query with an explanation of what was wrong.`;
    
    // Set the prompt in the AI assistant input field
    setCurrentPrompt(promptMessage);
    
    // Open AI assistant if it's not already open
    if (!showAIAssistant) {
      setShowAIAssistant(true);
    }
    
    console.log('[SidebarSQLQueryCard] Filled AI assistant with error context - ready for user to send');
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

      // Use the same query execution method as QueryWorkspace
      // Import the duckdb store directly 
      const { useDuckDBStore } = await import('@/store/duckDBStore');
      const { executePaginatedQuery } = useDuckDBStore.getState();
      
      // Execute query with pagination (limit to 100 rows for sidebar)
      const paginatedResult = await executePaginatedQuery(query, 1, 100);
      
      if (paginatedResult) {
        console.log(`[SidebarSQLQueryCard] Query returned ${paginatedResult.totalRows} total rows`);
        console.log(`[SidebarSQLQueryCard] Current page has ${paginatedResult.data.length} rows`);
        
        // Convert columns to the format expected by the component
        let formattedColumns: Array<{ name: string; type: string }> = [];
        if (paginatedResult.columns && Array.isArray(paginatedResult.columns)) {
          formattedColumns = paginatedResult.columns.map((col: any) => {
            if (typeof col === 'string') {
              return { name: col, type: 'unknown' };
            } else if (col && typeof col === 'object') {
              return {
                name: col.name || col.column_name || 'unknown',
                type: col.type?.toString() || col.column_type?.toString() || 'unknown'
              };
            }
            return { name: 'unknown', type: 'unknown' };
          });
        } else if (paginatedResult.data && paginatedResult.data.length > 0) {
          // Fallback: infer columns from first row
          const firstRow = paginatedResult.data[0];
          if (firstRow && typeof firstRow === 'object') {
            formattedColumns = Object.keys(firstRow).map(key => ({
              name: key,
              type: 'unknown'
            }));
          }
        }

        setQueryResult({
          data: paginatedResult.data || [],
          columns: formattedColumns,
          totalRows: paginatedResult.totalRows || paginatedResult.data?.length || 0,
          isLoading: false,
          error: undefined
        });
      } else {
        // No result - this might be a DDL statement or empty result
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
      
      // Extract detailed error information
      let errorMessage = 'Query execution failed';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String(error.message);
      }
      
      setQueryResult({
        data: [],
        columns: [],
        totalRows: 0,
        error: errorMessage,
        isLoading: false
      });
    } finally {
      setIsRunning(false);
      setQueryId(null);
    }
  };

  // Auto-execute primary queries when AI generation is complete
  useEffect(() => {
    if (isPrimary && !queryResult && !isRunning && !aiIsProcessing && !streamingResponse) {
      console.log('[SidebarSQLQueryCard] AI generation complete, auto-executing primary query');
      // Add a small delay to ensure the UI is ready
      const timer = setTimeout(() => {
        handleRun();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isPrimary, queryResult, isRunning, aiIsProcessing, streamingResponse]);

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

  const handleOpenBottomSheet = () => {
    setShowBottomSheet(true);
  };

  const handleCloseBottomSheet = () => {
    setShowBottomSheet(false);
  };

  // Get syntax highlighted HTML with enhanced formatting
  const getHighlightedSQL = () => {
    try {
      // Ensure SQL language is loaded
      if (!Prism.languages.sql) {
        return query;
      }
      return Prism.highlight(query, Prism.languages.sql, 'sql');
    } catch (error) {
      console.warn('Failed to highlight SQL:', error);
      return query;
    }
  };

  // Highlight on mount and query change
  useEffect(() => {
    // Force re-highlight when query changes
    Prism.highlightAll();
  }, [query]);

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
      // Parse error message for better formatting
      const errorMessage = queryResult.error;
      let errorType = 'Query Error';
      let errorDetails = errorMessage;
      
      // Try to identify error type from the message
      if (errorMessage.toLowerCase().includes('syntax')) {
        errorType = 'Syntax Error';
      } else if (errorMessage.toLowerCase().includes('not found') || errorMessage.toLowerCase().includes('does not exist')) {
        errorType = 'Reference Error';
      } else if (errorMessage.toLowerCase().includes('permission') || errorMessage.toLowerCase().includes('denied')) {
        errorType = 'Permission Error';
      } else if (errorMessage.toLowerCase().includes('type') || errorMessage.toLowerCase().includes('cast')) {
        errorType = 'Type Error';
      } else if (errorMessage.toLowerCase().includes('constraint') || errorMessage.toLowerCase().includes('violation')) {
        errorType = 'Constraint Violation';
      }
      
      // Check if error has line/column information
      const lineMatch = errorMessage.match(/line (\d+)/i);
      const columnMatch = errorMessage.match(/column (\d+)/i);
      const nearMatch = errorMessage.match(/near "([^"]+)"/i);
      
      return (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="border-t border-red-500/20 bg-gradient-to-br from-red-500/10 to-red-600/5"
        >
          <div className="px-3 py-2 border-b border-red-500/20">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
              <div className="text-xs font-medium text-red-400">
                {t('ai.results.error.title', { defaultValue: errorType })}
              </div>
              {(lineMatch || columnMatch) && (
                <div className="text-xs text-red-400/70 ml-auto">
                  {lineMatch && `Line ${lineMatch[1]}`}
                  {lineMatch && columnMatch && ', '}
                  {columnMatch && `Col ${columnMatch[1]}`}
                </div>
              )}
            </div>
          </div>
          
          <div className="p-3 space-y-2">
            {/* Main error message */}
            <div className="text-xs text-white/80 font-mono break-words">
              {errorDetails}
            </div>
            
            {/* Show problematic part if found */}
            {nearMatch && (
              <div className="mt-2 p-2 bg-black/30 rounded border border-red-500/20">
                <div className="text-xs text-red-400/70 mb-1">Near:</div>
                <code className="text-xs text-red-400 font-mono">{nearMatch[1]}</code>
              </div>
            )}
            
            {/* Action buttons */}
            <div className="flex items-center gap-2 mt-3 pt-2 border-t border-white/10">
              <Tooltip content={t('ai.queryCard.editToFix', { defaultValue: 'Edit in Query Tab to fix' })} placement="bottom">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs px-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  onClick={handleEdit}
                >
                  <PenSquare className="h-3 w-3 mr-1" />
                  Edit Query
                </Button>
              </Tooltip>
              
              <Tooltip content={t('ai.queryCard.askAIToFix', { defaultValue: 'Ask AI to help fix this error' })} placement="bottom">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs px-2 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                  onClick={handleAskAIToFix}
                >
                  <MessageSquare className="h-3 w-3 mr-1" />
                  Ask AI to solve it
                </Button>
              </Tooltip>
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
                    onClick={handleOpenBottomSheet}
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
      <div className="relative overflow-hidden">
          <pre className="p-3 text-xs overflow-x-auto font-mono leading-relaxed scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
            <code
              className="language-sql"
              style={{
                fontFamily: 'JetBrains Mono, Consolas, Monaco, "Courier New", monospace',
                fontSize: '11px',
                lineHeight: '1.5',
              }}
              dangerouslySetInnerHTML={{ __html: getHighlightedSQL() }}
            />
          </pre>
 
        {/* Custom styles for Monaco-like syntax highlighting - scoped to this component */}
        <style jsx>{`
          :global(.language-sql) {
            background: transparent !important;
            color: #d4d4d4 !important;
          }
          
          /* Keywords - Blue like Monaco */
          :global(.language-sql .token.keyword) {
            color: #569cd6 !important;
            font-weight: 600 !important;
          }
          
          /* Strings - Orange */
          :global(.language-sql .token.string) {
            color: #ce9178 !important;
          }
          
          /* Numbers - Light green */  
          :global(.language-sql .token.number) {
            color: #b5cea8 !important;
          }
          
          /* Comments - Green */
          :global(.language-sql .token.comment) {
            color: #6a9955 !important;
            font-style: italic !important;
          }
          
          /* Functions - Yellow */
          :global(.language-sql .token.function) {
            color: #dcdcaa !important;
            font-weight: 500 !important;
          }
          
          /* Operators and punctuation */
          :global(.language-sql .token.operator),
          :global(.language-sql .token.punctuation) {
            color: #d4d4d4 !important;
          }
          
          /* Boolean and NULL - Blue like keywords */
          :global(.language-sql .token.boolean),
          :global(.language-sql .token.null) {
            color: #569cd6 !important;
            font-weight: 600 !important;
          }
          
          /* Table/column identifiers - Light blue */
          :global(.language-sql .token.variable),
          :global(.language-sql .token.property) {
            color: #9cdcfe !important;
          }
        `}</style>
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

      {/* Bottom Sheet for Full Results */}
      {queryResult && (
        <QueryResultsBottomSheet
          isOpen={showBottomSheet}
          onClose={handleCloseBottomSheet}
          queryResult={queryResult}
          query={query}
          activeFile={activeFile}
        />
      )}
    </motion.div>
  );
};

export default SidebarSQLQueryCard;