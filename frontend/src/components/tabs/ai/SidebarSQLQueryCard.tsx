import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Copy, Check, Code, PenSquare, ChevronDown, MessageSquare, Eye, EyeOff, RefreshCw} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Editor from '@monaco-editor/react';

import { useAppStore } from '@/store/appStore';
import { useDuckDBStore } from '@/store/duckDBStore';
import { useAIStore } from '@/store/aiStore';
import { Tooltip } from '@/components/ui/Tooltip';
import ErrorDisplay from '@/components/tabs/ai/ErrorDisplay';
import { parseAIResponse } from '@/components/tabs/ai/utils/smartParsing';

interface SidebarSQLQueryCardProps {
  query: string;
  index: number;
  responseId: string;
  isPrimary?: boolean;
  queryRunning?: boolean;
  responseText?: string; // AI response text for this analysis
  activeFile?: {
    id: string;
    fileName?: string;
    tableName?: string;
  } | null;
}

const SidebarSQLQueryCard: React.FC<SidebarSQLQueryCardProps> = ({
  query,
  responseText
}) => {
  const [copied, setCopied] = useState(false);
  const [isSQLExpanded, setIsSQLExpanded] = useState(false);
  const [isThisCardActive, setIsThisCardActive] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  
  const { setPendingQuery, changeViewMode } = useAppStore();
  const { executePaginatedQuery, isLoading } = useDuckDBStore();
  const { setCurrentPrompt } = useAIStore();

  // Parse AI response for structured data (memoized to prevent re-parsing on every render)
  const parsedResponse = useMemo(() => parseAIResponse(responseText || ''), [responseText]);
  const insightTitle = parsedResponse.insight;
  const expectedResults = parsedResponse.expectedResults;

  // Use a ref to create a stable unique ID for this card
  const cardRef = useRef(`card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  const cardId = cardRef.current;

  // Listen for global active card changes via window events
  useEffect(() => {
    const handleActiveCardChange = () => {
      const activeCardId = (window as any).__activeQueryCardId;
      const shouldBeActive = activeCardId === cardId;
      
      if (isThisCardActive !== shouldBeActive) {
        setIsThisCardActive(shouldBeActive);
      }
    };

    // Check immediately
    handleActiveCardChange();

    // Listen for custom events when active card changes
    window.addEventListener('queryCardActiveChange', handleActiveCardChange);
    
    return () => {
      window.removeEventListener('queryCardActiveChange', handleActiveCardChange);
    };
  }, [cardId, isThisCardActive]);

  // Cleanup: if this card was active when unmounting, clear the global state
  useEffect(() => {
    return () => {
      if ((window as any).__activeQueryCardId === cardId) {
        delete (window as any).__activeQueryCardId;
        window.dispatchEvent(new CustomEvent('queryCardActiveChange'));
      }
    };
  }, [cardId]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(query);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [query]);

  const handleEdit = useCallback(() => {
    // Hide results if any are currently shown (not just this card)
    const closeOverlay = (window as any).__closeOverlay;
    if (closeOverlay && typeof closeOverlay === 'function') {
      closeOverlay();
    }
    
    setPendingQuery(query);
    setTimeout(() => {
      changeViewMode('query');
    }, 50);
  }, [query, setPendingQuery, changeViewMode]);

  const getErrorSuggestion = useCallback((errorMessage: string): string => {
    if (errorMessage.includes('COUNT(DISTINCT') && errorMessage.includes('argument types')) {
      return 'DuckDB only supports COUNT(DISTINCT single_column). For multiple columns, try: COUNT(*) FROM (SELECT DISTINCT col1, col2 FROM table)';
    }
    if (errorMessage.includes('Binder Error')) {
      return 'This appears to be a SQL syntax error. Please check your column names and table structure.';
    }
    if (errorMessage.includes('No function matches')) {
      return 'The function you\'re trying to use may not be supported in DuckDB or has incorrect parameters.';
    }
    if (errorMessage.includes('does not exist')) {
      return 'The table or column referenced in your query doesn\'t exist. Please check the table structure.';
    }
    return 'There was an error executing this SQL query. You can ask the AI to fix it or try modifying the query manually.';
  }, []);

  const handleViewResults = useCallback(async () => {
    if (isThisCardActive) {
      // Close the results
      const closeDraggableResults = (window as any).__closeDraggableResults;
      if (closeDraggableResults && typeof closeDraggableResults === 'function') {
        closeDraggableResults();
      }
      setIsThisCardActive(false);
    } else {
      // Execute query and show results
      try {
        setQueryError(null);
        const paginatedResult = await executePaginatedQuery(query, 1, 1000);
        
        if (paginatedResult) {
          // Set this card as active before showing results
          (window as any).__activeQueryCardId = cardId;
          window.dispatchEvent(new CustomEvent('queryCardActiveChange'));
          
          // Convert to format expected by DraggableQueryResults
          const headers = [' ', ...paginatedResult.columns]; // Add row number column
          const dataRows = paginatedResult.data.map((row: any, index: number) => [
            index + 1, // Row number
            ...paginatedResult.columns.map(col => row[col] || '')
          ]);
          
          const formattedResults = {
            data: [headers, ...dataRows],
            columnTypes: paginatedResult.columns.map(col => ({
              name: col,
              type: 'VARCHAR'
            })),
            metadata: {
              rowCount: paginatedResult.totalRows || paginatedResult.data.length,
              columnCount: paginatedResult.columns.length,
              executionTime: paginatedResult.queryTime || 0,
              query: query.substring(0, 200) + (query.length > 200 ? '...' : '')
            }
          };
          
          // Use the draggable results system
          const showDraggableResults = (window as any).__showDraggableResults;
          if (showDraggableResults && typeof showDraggableResults === 'function') {
            showDraggableResults(formattedResults);
            setIsThisCardActive(true);
          } else {
            setQueryError('Query results display not available');
          }
        }
      } catch (error) {
        console.error('Query execution failed:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to execute query';
        setQueryError(errorMessage);
      }
    }
  }, [isThisCardActive, query, cardId, executePaginatedQuery]);

  const handleAskAIToFix = useCallback(() => {
    if (!queryError) return;
    
    const suggestion = getErrorSuggestion(queryError);
    
    // Create a descriptive prompt for the AI to fix the SQL query
    const fixPrompt = `I have a SQL query that's producing an error. Can you help me fix it?

**Query:**
\`\`\`sql
${query}
\`\`\`

**Error:**
${queryError}

**Suggested Fix:**
${suggestion}

Please provide a corrected version of this SQL query that follows proper DuckDB syntax. Make sure to:
1. Fix the specific error mentioned above
2. Use proper DuckDB function syntax
3. Ensure all column names and table references are correct
4. Include a brief explanation of what was wrong and how you fixed it`;

    // Set the prompt in the AI store, which will be picked up by the AI assistant
    setCurrentPrompt(fixPrompt);
    
    // Clear the error since we're asking AI to fix it
    setQueryError(null);
  }, [queryError, query, getErrorSuggestion, setCurrentPrompt]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="space-y-3"
    >
      {/* Insight Title and Description */}
      {insightTitle && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="space-y-2"
        >
          <div 
            className="text-sm font-semibold bg-gradient-to-r from-white/90 via-blue-300 via-blue-400 via-blue-300 to-white/90 bg-clip-text text-transparent"
            style={{
              backgroundSize: '200% 200%',
              animation: 'gradientFlow 4s ease-in-out infinite'
            }}
          >
            {insightTitle}
          </div>
          {expectedResults && (
            <> 
              {/* Expected Results Content - No Container */}
              <p className="text-xs text-white/50 leading-relaxed">
                {expectedResults}
              </p>
            </>
          )}
        </motion.div>
      )}

      {/* Clean Action Buttons */}
      <div className="border-t border-white/10 pt-3">
        <div className="flex items-center gap-2">
          <button
            onClick={handleViewResults}
            disabled={isLoading}
            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold transition-all duration-200 flex-1 group ${
              isLoading
                ? 'bg-gradient-to-r from-gray-600/8 via-gray-500/12 to-gray-600/8 border border-gray-500/20 opacity-50 cursor-not-allowed'
                : isThisCardActive
                ? 'bg-gradient-to-r from-red-600/8 via-red-500/12 to-red-600/8 hover:from-red-600/15 hover:via-red-500/18 hover:to-red-600/15 border border-red-500/20 hover:border-red-500/30'
                : 'bg-gradient-to-r from-blue-600/8 via-blue-500/12 to-blue-600/8 hover:from-blue-600/15 hover:via-blue-500/18 hover:to-blue-600/15 border border-blue-500/20 hover:border-blue-500/30'
            }`}
          >
            {isLoading ? (
              <RefreshCw className="h-4 w-4 text-gray-400 animate-spin" />
            ) : isThisCardActive ? (
              <EyeOff className="h-4 w-4 text-red-300" />
            ) : (
              <Eye className="h-4 w-4 text-blue-300" />
            )}
            <span className={`bg-gradient-to-r bg-clip-text text-transparent transition-all duration-200 ${
              isLoading
                ? 'from-gray-300 via-gray-200 to-gray-300'
                : isThisCardActive
                ? 'from-red-100 via-white to-red-100 group-hover:from-white group-hover:via-red-50 group-hover:to-white'
                : 'from-blue-200 via-blue-100 to-blue-200 group-hover:from-blue-100 group-hover:via-white group-hover:to-blue-100'
            }`}>
              {isLoading ? 'Loading...' : isThisCardActive ? 'Hide Results' : 'View Results'}
            </span>
          </button>
          
          <button
            onClick={handleEdit}
            className="flex items-center gap-1.5 px-2.5 py-2 rounded-md transition-colors bg-white/5 text-white/60 border border-white/20 hover:bg-white/10 hover:text-white/80 hover:border-white/30"
          >
            <PenSquare className="h-3 w-3" />
            <span className="text-xs font-medium">Edit Query</span>
          </button>
        </div>
      </div>

      {/* Query Error Display */}
      {queryError && (
        <div className="space-y-2">
          <ErrorDisplay
            error={queryError}
            onDismiss={() => setQueryError(null)}
            onRetry={handleViewResults}
            suggestion={queryError ? getErrorSuggestion(queryError) : undefined}
          />
          
          {/* Ask AI to Fix Button */}
          <motion.button
            onClick={handleAskAIToFix}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-primary/20 to-primary/10 hover:from-primary/30 hover:to-primary/20 border border-primary/30 rounded-lg text-white text-sm font-medium transition-all duration-200 hover:scale-[1.02]"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <MessageSquare className="h-4 w-4" />
            <span>Ask AI to Fix This</span>
          </motion.button>
        </div>
      )}

      {/* SQL Query - Collapsible */}
      <div className="border-t border-white/10 pt-3">
        <button
          onClick={() => setIsSQLExpanded(!isSQLExpanded)}
          className="w-full flex items-center justify-between p-2 hover:bg-white/5 rounded transition-colors"
        >
          <div className="flex items-center gap-2">
            <Code className="h-3 w-3 text-white/60" />
            <span className="text-xs font-medium text-white/70">
              View SQL Query
            </span>
          </div>
          
          <div className="flex items-center gap-1">
            {/* Copy button - only show when expanded */}
            <AnimatePresence>
              {isSQLExpanded && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-1 mr-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Tooltip content={copied ? 'Copied!' : 'Copy SQL'} placement="bottom">
                    <button
                      onClick={handleCopy}
                      className="p-1 hover:bg-white/10 rounded transition-colors cursor-pointer"
                    >
                      <AnimatePresence mode="wait">
                        {copied ? (
                          <Check className="h-3 w-3 text-green-400" />
                        ) : (
                          <Copy className="h-3 w-3 text-white/60 hover:text-white/80" />
                        )}
                      </AnimatePresence>
                    </button>
                  </Tooltip>
                </motion.div>
              )}
            </AnimatePresence>
            
            <motion.div
              animate={{ rotate: isSQLExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="h-3 w-3 text-white/60" />
            </motion.div>
          </div>
        </button>
        
        <AnimatePresence>
          {isSQLExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="mt-2"
            >
              <div className="rounded overflow-hidden border border-white/10">
                <Editor
                  height="auto"
                  defaultLanguage="sql"
                  value={query}
                  theme="vs-dark"
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    wordWrap: "on",
                    automaticLayout: true,
                    tabSize: 2,
                    fontSize: 12,
                    fontFamily: "JetBrains Mono, monospace",
                    lineNumbers: "off",
                    glyphMargin: false,
                    folding: false,
                    contextmenu: false,
                    quickSuggestions: false,
                    suggest: { preview: false },
                    parameterHints: { enabled: false },
                    scrollbar: {
                      vertical: "hidden",
                      horizontal: "auto",
                    },
                    overviewRulerLanes: 0,
                    hideCursorInOverviewRuler: true,
                    renderLineHighlight: "none",
                    selectionHighlight: false,
                    occurrencesHighlight: false,
                    fixedOverflowWidgets: true,
                  }}
                  onMount={(editor) => {
                    const model = editor.getModel();
                    if (model) {
                      const lineCount = model.getLineCount();
                      const lineHeight = 14;
                      const padding = 12;
                      const contentHeight = Math.max(lineCount * lineHeight + padding, 50);
                      
                      const container = editor.getContainerDomNode();
                      if (container) {
                        container.style.height = `${contentHeight}px`;
                        editor.layout();
                      }
                    }
                  }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>


    </motion.div>
  );
};

export default React.memo(SidebarSQLQueryCard);