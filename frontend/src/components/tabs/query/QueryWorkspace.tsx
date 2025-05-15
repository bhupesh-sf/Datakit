import React, { useState, useRef, useEffect } from "react";
import { useAppStore } from "@/store/appStore";
import { useDuckDBStore } from "@/store/duckDBStore";
import SchemaBrowser from "./SchemaBrowser";
import MonacoEditor from "./MonacoEditor";
import QueryHistory from "./QueryHistory";
import QueryResults from "./QueryResults";
import { useResizable } from "@/hooks/useResizable";
import {
  Play,
  ChevronLeft,
  ChevronRight,
  Maximize,
  Minimize,
  Save,
  Book,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";

import QueryTemplates from "./QueryTemplates";

/**
 * Main container for the enhanced query tab with resizable panels
 */
const QueryWorkspace: React.FC = () => {
  const {
    tableName,
    addRecentQuery,
    saveQuery: saveQueryToStore,
  } = useAppStore();

  const { executePaginatedQuery, isLoading } = useDuckDBStore();

  // State for query editor
  const [query, setQuery] = useState<string>(`-- Write your SQL query here
SELECT *
FROM "${tableName || "table"}"
LIMIT 10;`);

  const [showTemplates, setShowTemplates] = useState<boolean>(false);

  // Query results state
  const [results, setResults] = useState<any[] | null>(null);
  const [columns, setColumns] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [affectedRows, setAffectedRows] = useState<number | null>(null);
  
  // Pagination state
  const [rowsPerPage, setRowsPerPage] = useState<number>(100);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalRows, setTotalRows] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [isChangingPage, setIsChangingPage] = useState<boolean>(false);
  const [showLargeDataWarning, setShowLargeDataWarning] = useState<boolean>(false);

  // UI state
  const [showSchemaBrowser, setShowSchemaBrowser] = useState<boolean>(
    localStorage.getItem("datakit-show-schema-browser") !== "false"
  );
  const [showQueryHistory, setShowQueryHistory] = useState<boolean>(
    localStorage.getItem("datakit-show-query-history") !== "false"
  );

  const [fullScreenMode, setFullScreenMode] = useState<
    "none" | "editor" | "results"
  >("none");
  const [queryInputHeight, setQueryInputHeight] = useState<number>(
    parseInt(localStorage.getItem("datakit-query-editor-height") || "300", 10)
  );
  const [saveDialogOpen, setSaveDialogOpen] = useState<boolean>(false);
  const [queryName, setQueryName] = useState<string>("");

  useEffect(() => {
    // Set default values if not set
    if (!localStorage.getItem("datakit-show-schema-browser")) {
      localStorage.setItem("datakit-show-schema-browser", "true");
    }

    if (!localStorage.getItem("datakit-show-query-history")) {
      localStorage.setItem("datakit-show-query-history", "true");
    }

    // Update state from localStorage
    setShowSchemaBrowser(
      localStorage.getItem("datakit-show-schema-browser") !== "false"
    );
    setShowQueryHistory(
      localStorage.getItem("datakit-show-query-history") !== "false"
    );
  }, []);

  // Element refs for resizing
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const dividerRef = useRef<HTMLDivElement>(null);

  // Setup resizable editor
  const { startResize: startEditorResize } = useResizable(editorRef, {
    direction: "vertical",
    initialSize: queryInputHeight,
    minSize: 100,
    maxSize: 800,
    storageKey: "datakit-query-editor-height",
  });

  // Check if query will return a large dataset 
  const isLargeDataQuery = (sql: string): boolean => {
    const normalizedSql = sql.trim().toLowerCase();
    const hasNoLimit = !normalizedSql.includes('limit');
    const hasSelectAll = normalizedSql.includes('select *');
    
    return hasSelectAll && hasNoLimit;
  };

  // Add a limit clause to query if missing
  const addLimitToQuery = (sql: string, limit: number = 1000): string => {
    const normalizedSql = sql.trim();
    if (!normalizedSql.toLowerCase().includes('limit')) {
      return `${normalizedSql} LIMIT ${limit}`;
    }
    return sql;
  };

  // Execute the current query
  const handleExecuteQuery = async () => {
    if (!query.trim()) return;

    try {
      // Reset state
      setError(null);
      setResults(null);
      setColumns(null);
      setExecutionTime(null);
      setAffectedRows(null);
      setCurrentPage(1);
      setIsChangingPage(false);
      
      // Show warning for potentially large result set queries
      setShowLargeDataWarning(isLargeDataQuery(query));

      // Execute query with pagination
      console.log(`[QueryWorkspace] Executing paginated query (page: 1, size: ${rowsPerPage})`);
      const paginatedResult = await executePaginatedQuery(query, 1, rowsPerPage);

      if (paginatedResult) {
        console.log(`[QueryWorkspace] Query returned ${paginatedResult.totalRows} total rows`);
        console.log(`[QueryWorkspace] Current page has ${paginatedResult.data.length} rows`);
        
        // Set pagination metadata first
        setTotalRows(paginatedResult.totalRows);
        setTotalPages(paginatedResult.totalPages);
        
        // Set the page data
        setResults(paginatedResult.data);
        setColumns(paginatedResult.columns);
        setExecutionTime(paginatedResult.queryTime);
        setAffectedRows(paginatedResult.totalRows);

        // Add to recent queries
        addRecentQuery(query);
      } else {
        // Reset all state on error or empty result
        setResults([]);
        setColumns([]);
        setAffectedRows(0);
        setTotalRows(0);
        setTotalPages(0);
      }
    } catch (err) {
      console.error("[QueryWorkspace] Query execution error:", err);
      setError(
        err instanceof Error ? err.message : "Unknown error executing query"
      );
      setResults(null);
      setColumns(null);
      setAffectedRows(null);
      setTotalRows(0);
      setTotalPages(0);
    }
  };

  // Handle page change - fetch new page of data
  const handlePageChange = async (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage) return;

    try {
      setError(null);
      setIsChangingPage(true);

      console.log(`[QueryWorkspace] Changing to page ${newPage}`);
      const paginatedResult = await executePaginatedQuery(query, newPage, rowsPerPage);

      if (paginatedResult) {
        console.log(`[QueryWorkspace] Page ${newPage} has ${paginatedResult.data.length} rows`);
        
        // Update just the current page data
        setResults(paginatedResult.data);
        setCurrentPage(newPage);
      }
    } catch (err) {
      console.error("[QueryWorkspace] Page change error:", err);
      setError(err instanceof Error ? err.message : "Error fetching page data");
    } finally {
      setIsChangingPage(false);
    }
  };

  // Handle rows per page change
  const handleRowsPerPageChange = async (newRowsPerPage: number) => {
    try {
      setError(null);
      setIsChangingPage(true);

      console.log(`[QueryWorkspace] Changing rows per page to ${newRowsPerPage}`);
      const paginatedResult = await executePaginatedQuery(query, 1, newRowsPerPage);

      if (paginatedResult) {
        console.log(`[QueryWorkspace] First page now has ${paginatedResult.data.length} rows`);
        
        // Update data and pagination state
        setResults(paginatedResult.data);
        setColumns(paginatedResult.columns);
        setRowsPerPage(newRowsPerPage);
        setTotalPages(paginatedResult.totalPages);
        setCurrentPage(1);
      }
    } catch (err) {
      console.error("[QueryWorkspace] Rows per page change error:", err);
      setError(
        err instanceof Error ? err.message : "Error changing results per page"
      );
    } finally {
      setIsChangingPage(false);
    }
  };

  // Toggle side panels
  const toggleSchemaBrowser = () => {
    const newValue = !showSchemaBrowser;
    setShowSchemaBrowser(newValue);
    localStorage.setItem("datakit-show-schema-browser", String(newValue));
  };

  const toggleQueryHistory = () => {
    const newValue = !showQueryHistory;
    setShowQueryHistory(newValue);
    localStorage.setItem("datakit-show-query-history", String(newValue));

    // Force a re-render by updating a state value
    setTimeout(() => {
      // This forces React to recalculate the layout
      window.dispatchEvent(new Event("resize"));
    }, 10);
  };

  // Toggle full screen mode
  const toggleFullScreenMode = (mode: "editor" | "results") => {
    if (fullScreenMode === mode) {
      setFullScreenMode("none");
    } else {
      setFullScreenMode(mode);
    }
  };

  // Handle saving query
  const handleSaveQuery = () => {
    if (!query.trim()) return;

    if (!queryName.trim()) {
      setSaveDialogOpen(true);
    } else {
      saveQueryToStore(query, queryName);
      setSaveDialogOpen(false);
      setQueryName("");
    }
  };

  const toggleTemplates = () => setShowTemplates(!showTemplates);

  // Add a limit to query to optimize it
  const handleOptimizeQuery = () => {
    setQuery(addLimitToQuery(query));
    setShowLargeDataWarning(false);
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Enter to execute query
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleExecuteQuery();
      }

      // Ctrl/Cmd + S to save query
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSaveQuery();
      }

      // Escape to exit full screen
      if (e.key === "Escape" && fullScreenMode !== "none") {
        e.preventDefault();
        setFullScreenMode("none");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [query, fullScreenMode, queryName]);

  // Calculate dynamic classes based on UI state
  const getContainerClasses = () => {
    if (fullScreenMode === "editor") {
      return "grid grid-cols-1 grid-rows-1";
    }
    if (fullScreenMode === "results") {
      return "grid grid-cols-1 grid-rows-1";
    }

    let baseClasses = "grid h-full gap-1";

    // Determine column layout based on side panels
    if (!showSchemaBrowser && !showQueryHistory) {
      baseClasses += " grid-cols-1";
    } else if (showSchemaBrowser && !showQueryHistory) {
      baseClasses += " grid-cols-[260px_1fr]";
    } else if (!showSchemaBrowser && showQueryHistory) {
      baseClasses += " grid-cols-[1fr_260px]";
    } else {
      baseClasses += " grid-cols-[260px_1fr_260px]";
    }

    return baseClasses;
  };

  return (
    <div ref={containerRef} className={getContainerClasses()}>
      {/* Schema Browser */}
      {showSchemaBrowser && fullScreenMode === "none" && (
        <div className="h-full border-r border-white/10 bg-darkNav overflow-hidden">
          <SchemaBrowser onInsertQuery={(text) => setQuery(query + text)} />
        </div>
      )}

      {/* Main content area */}
      <div
        className={`flex flex-col ${
          fullScreenMode !== "none" ? "col-span-full row-span-full" : ""
        }`}
      >
        {/* Editor area */}
        {fullScreenMode !== "results" && (
          <div
            ref={editorRef}
            className="flex flex-col"
            style={{ height: `${queryInputHeight}px` }}
          >
            {/* Editor toolbar */}
            <div className="flex items-center justify-between p-2 bg-darkNav border-b border-white/10">
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={toggleSchemaBrowser}
                  title={
                    showSchemaBrowser
                      ? "Hide Schema Browser"
                      : "Show Schema Browser"
                  }
                >
                  <ChevronLeft
                    size={16}
                    className={`transition-transform ${
                      showSchemaBrowser ? "" : "rotate-180"
                    }`}
                  />
                </Button>

                <h3 className="text-sm font-medium">SQL Editor</h3>

                <div className="text-xs text-white/50">
                  Press Ctrl+Enter to execute
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleTemplates}
                  className="h-8"
                >
                  <Book size={14} className="mr-1" />
                  <span>Templates</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSaveQuery}
                  className="h-8"
                >
                  <Save size={14} className="mr-1" />
                  <span>Save</span>
                </Button>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleExecuteQuery}
                  disabled={isLoading || isChangingPage}
                  className="h-8"
                >
                  <Play size={14} className="mr-1" />
                  <span>Execute</span>
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => toggleFullScreenMode("editor")}
                  title={
                    fullScreenMode === "editor"
                      ? "Exit Full Screen"
                      : "Full Screen Editor"
                  }
                >
                  {fullScreenMode === "editor" ? (
                    <Minimize size={16} />
                  ) : (
                    <Maximize size={16} />
                  )}
                </Button>
              </div>
            </div>

            {/* Monaco Editor */}
            <div className="flex-1 overflow-hidden">
              <MonacoEditor
                value={query}
                onChange={setQuery}
                onExecute={handleExecuteQuery}
              />
            </div>

            {showTemplates && (
              <div className="absolute top-12 right-0 w-80 bg-background border border-white/10 rounded-md shadow-lg z-10">
                <QueryTemplates
                  onSelectTemplate={(templateQuery) => {
                    setQuery(templateQuery);
                    setShowTemplates(false);
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Resizer handle (only show when not in full screen) */}
        {fullScreenMode === "none" && (
          <div
            ref={dividerRef}
            className="h-2 bg-darkNav/50 cursor-row-resize hover:bg-primary/30 transition-colors flex items-center justify-center"
            onMouseDown={startEditorResize}
          >
            <div className="w-8 h-1 bg-white/20 rounded-full" />
          </div>
        )}

        {/* Results area */}
        {fullScreenMode !== "editor" && (
          <div
            ref={resultsRef}
            className="flex-1 flex flex-col overflow-hidden"
          >
            {/* Results toolbar */}
            <div className="flex items-center justify-between p-2 bg-darkNav border-b border-white/10">
              <div className="flex items-center space-x-3">
                <h3 className="text-sm font-medium">Query Results</h3>

                {executionTime !== null && (
                  <div className="flex items-center text-xs text-white/60">
                    <Clock size={12} className="mr-1" />
                    <span>{executionTime.toFixed(0)}ms</span>
                  </div>
                )}

                {affectedRows !== null && (
                  <div className="text-xs text-white/60">
                    {affectedRows.toLocaleString()} rows
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => toggleFullScreenMode("results")}
                  title={
                    fullScreenMode === "results"
                      ? "Exit Full Screen"
                      : "Full Screen Results"
                  }
                >
                  {fullScreenMode === "results" ? (
                    <Minimize size={16} />
                  ) : (
                    <Maximize size={16} />
                  )}
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={toggleQueryHistory}
                  title={
                    showQueryHistory
                      ? "Hide Query History"
                      : "Show Query History"
                  }
                >
                  <ChevronRight
                    size={16}
                    className={`transition-transform ${
                      showQueryHistory ? "" : "rotate-180"
                    }`}
                  />
                </Button>
              </div>
            </div>

            {/* Large dataset warning */}
            {showLargeDataWarning && totalRows > 10000 && (
              <div className="bg-primary/10 border border-primary/30 rounded p-3 m-3 text-white text-sm">
                <div className="flex items-start">
                  <AlertTriangle size={18} className="text-primary mt-0.5 mr-2 flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="text-sm font-medium mb-1">Large Result Set ({totalRows.toLocaleString()} rows)</h4>
                    <p className="text-xs text-white/80 mb-2">
                      This query is returning a large dataset which may affect performance.
                      Consider adding filters or LIMIT clause to reduce the result size.
                    </p>
                    
                    <div className="flex justify-end space-x-2 mt-2">
                      <button 
                        className="text-xs px-3 py-1 rounded bg-primary text-white"
                        onClick={handleOptimizeQuery}
                      >
                        Add LIMIT Clause
                      </button>
                      <button 
                        className="text-xs px-3 py-1 rounded bg-white/10 hover:bg-white/20"
                        onClick={() => setShowLargeDataWarning(false)}
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Query results component */}
            <div className="flex-1 overflow-auto">
              <QueryResults
                results={results}
                columns={columns}
                isLoading={isLoading || isChangingPage}
                error={error}
                totalRows={totalRows}
                currentPage={currentPage}
                totalPages={totalPages}
                rowsPerPage={rowsPerPage}
                onPageChange={handlePageChange}
                onRowsPerPageChange={handleRowsPerPageChange}
              />
            </div>
          </div>
        )}
      </div>

      {/* Query History */}
      {showQueryHistory && fullScreenMode === "none" && (
        <div className="h-full border-l border-white/10 bg-darkNav overflow-hidden">
          <QueryHistory
            onSelectQuery={(selectedQuery) => setQuery(selectedQuery)}
          />
        </div>
      )}

      {/* Save Query Dialog */}
      {saveDialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-darkNav p-4 rounded-lg shadow-lg w-96">
            <h3 className="text-lg font-medium mb-4">Save Query</h3>
            <input
              type="text"
              className="w-full p-2 bg-background border border-white/10 rounded mb-4"
              placeholder="Enter query name"
              value={queryName}
              onChange={(e) => setQueryName(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end space-x-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setSaveDialogOpen(false);
                  setQueryName("");
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  if (queryName.trim()) {
                    saveQueryToStore(query, queryName);
                    setSaveDialogOpen(false);
                    setQueryName("");
                  }
                }}
                disabled={!queryName.trim()}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QueryWorkspace;