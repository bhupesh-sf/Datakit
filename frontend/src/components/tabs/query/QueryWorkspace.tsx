import React, { useRef, useEffect, useMemo } from "react";
import {
  Play,
  ChevronLeft,
  ChevronRight,
  Maximize,
  Minimize,
  Save,
  Database,
  Clock,
  AlertTriangle,
  Zap,
} from "lucide-react";

import {
  useInitialQuery,
  useDuckDBInitialization,
} from "@/hooks/query/useQueryInitialization";

import SchemaBrowser from "./SchemaBrowser";
import MonacoEditor from "./MonacoEditor";
import QueryHistory from "./QueryHistory";
import QueryResults from "./query-results/QueryResults";
import QueryAssistant from "./assistant/QueryAssistant";
import { Button } from "@/components/ui/Button";

import { useSchemaInfo } from "@/hooks/query/useSchemaInfo";
import { useResizable } from "@/hooks/useResizable";
import { useQueryExecution } from "@/hooks/query/useQueryExecution";
import { useQueryHistory } from "@/hooks/query/useQueryHistory";
import { useQueryOptimization } from "@/hooks/query/useQueryOptimization";
import { useWorkspaceUIState } from "./useWorkspaceUIState";

// Constants for panel dimensions
const PANEL_WIDTH = 260;

/**
 * Main container for the enhanced query tab with resizable panels
 */
const QueryWorkspace: React.FC = () => {
  const {
    isInitialized,
    isInitializing,
    error: initError,
    retry,
  } = useDuckDBInitialization();

  const { query, setQuery, canExecuteQueries, hasUserTables } =
    useInitialQuery();

  const { tableSchema } = useSchemaInfo();

  const {
    showSchemaBrowser,
    showQueryHistory,
    showOptimizationTips,
    fullScreenMode,
    queryInputHeight,
    saveDialogOpen,
    queryName,
    setShowOptimizationTips,
    setSaveDialogOpen,
    setQueryName,
    toggleSchemaBrowser,
    toggleQueryHistory,
    toggleFullScreenMode,
  } = useWorkspaceUIState();

  const {
    results,
    columns,
    error,
    executionTime,
    totalRows,
    currentPage,
    totalPages,
    rowsPerPage,
    isLoading,
    isChangingPage,
    showLargeDataWarning,
    executeQuery,
    changePage,
    changeRowsPerPage,
    optimizeQuery: applyLimitOptimization,
    dismissWarning,
  } = useQueryExecution(query, setQuery);

  const { selectQuery, saveQuery, isLoadingQueries } = useQueryHistory(
    (selectedQuery) => setQuery(selectedQuery)
  );

  const { suggestions, hasWarnings, analyzeQuery, optimizeQuery } =
    useQueryOptimization();

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

  // Run query analysis whenever the query changes
  useEffect(() => {
    if (canExecuteQueries && query.trim()) {
      analyzeQuery(query);
    }
  }, [query, analyzeQuery, canExecuteQueries]);

  // Handle saving query
  const handleSaveQuery = () => {
    if (!query.trim()) return;

    if (!queryName.trim()) {
      setSaveDialogOpen(true);
    } else {
      saveQuery(query, queryName);
      setSaveDialogOpen(false);
      setQueryName("");
    }
  };

  // Apply query optimizations
  const handleOptimizeQuery = () => {
    const optimizedQuery = optimizeQuery(query);
    setQuery(optimizedQuery);
    setShowOptimizationTips(false);
  };

  // Memoized event handlers to prevent unnecessary re-renders
  const keyboardHandlers = useMemo(
    () => ({
      executeQuery: () => {
        if (canExecuteQueries && query.trim()) {
          executeQuery();
        }
      },
      saveQuery: handleSaveQuery,
      exitFullScreen: () => setFullScreenMode("none"),
    }),
    [canExecuteQueries, query, executeQuery, handleSaveQuery]
  );

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Enter to execute query
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        keyboardHandlers.executeQuery();
      }

      // Ctrl/Cmd + S to save query
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        keyboardHandlers.saveQuery();
      }

      // Escape to exit full screen
      if (e.key === "Escape" && fullScreenMode !== "none") {
        e.preventDefault();
        keyboardHandlers.exitFullScreen();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [keyboardHandlers, fullScreenMode]);

  // Show getting started state
  if (!isInitialized) {
    if (initError) {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="text-center p-8 max-w-md">
            <div className="mb-6 flex justify-center">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
            </div>
            <h3 className="text-lg font-heading font-medium text-white mb-2">
              DuckDB Initialization Failed
            </h3>
            <p className="text-white/70 mb-4">{initError}</p>
            <Button onClick={retry} variant="primary">
              Retry Initialization
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center p-8 max-w-md">
          <div className="mb-6 flex justify-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Database className="w-8 h-8 text-primary animate-pulse" />
            </div>
          </div>
          <h3 className="text-lg font-heading font-medium text-white mb-2">
            {isInitializing ? "Initializing DuckDB" : "DuckDB Not Ready"}
          </h3>
          <p className="text-white/70 mb-4">
            {isInitializing
              ? "Setting up your in-browser SQL database..."
              : "Preparing your data analysis environment..."}
          </p>
          <div className="text-sm text-white/60">
            <div className="flex items-center justify-center gap-2">
              <Zap className="w-4 h-4 text-secondary" />
              <span>Powered by WebAssembly</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const ResultsToolbar = () => (
    <div className="flex items-center justify-between p-2 bg-darkNav border-b border-white/10">
      <div className="flex items-center space-x-3">
        <h3 className="text-sm font-medium">Query Results</h3>

        {executionTime !== null && (
          <div className="flex items-center text-xs text-white/60">
            <Clock size={12} className="mr-1" />
            <span>{executionTime.toFixed(0)}ms</span>
          </div>
        )}

        {totalRows > 0 && (
          <div className="text-xs text-white/60">
            {totalRows.toLocaleString()} rows
          </div>
        )}

        {/* <div className="text-xs text-white/50">{duckDBStatus}</div> */}
      </div>

      <div className="flex items-center space-x-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => toggleFullScreenMode("results")}
          title="Full Screen Results"
        >
          <Maximize size={16} />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={toggleQueryHistory}
          title={showQueryHistory ? "Hide Query History" : "Show Query History"}
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
    // ),
    // [
    //   executionTime,
    //   totalRows,
    //   showQueryHistory,
    //   toggleFullScreenMode,
    //   toggleQueryHistory,
    // ]
  );

  // Return the appropriate layout based on fullscreen mode
  if (fullScreenMode !== "none") {
    return (
      <div className="w-full h-full flex flex-col">
        {fullScreenMode === "editor" ? (
          <>
            <div className="flex items-center justify-between p-2 bg-darkNav border-b border-white/10">
              <h3 className="text-sm font-medium">SQL Editor (Fullscreen)</h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => toggleFullScreenMode("editor")}
                title="Exit Full Screen"
              >
                <Minimize size={16} />
              </Button>
            </div>
            <div className="flex-1 overflow-hidden">
              <MonacoEditor
                value={query}
                onChange={setQuery}
                onExecute={keyboardHandlers.executeQuery}
              />
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between p-2 bg-darkNav border-b border-white/10">
              <div className="flex items-center space-x-3">
                <h3 className="text-sm font-medium">
                  Query Results (Fullscreen)
                </h3>
                {executionTime !== null && (
                  <div className="flex items-center text-xs text-white/60">
                    <Clock size={12} className="mr-1" />
                    <span>{executionTime.toFixed(0)}ms</span>
                  </div>
                )}
                {totalRows > 0 && (
                  <div className="text-xs text-white/60">
                    {totalRows.toLocaleString()} rows
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => toggleFullScreenMode("results")}
                title="Exit Full Screen"
              >
                <Minimize size={16} />
              </Button>
            </div>
            <div className="flex-1 overflow-hidden">
              <QueryResults
                results={results}
                columns={columns}
                isLoading={isLoading || isChangingPage || isLoadingQueries}
                error={error}
                totalRows={totalRows}
                currentPage={currentPage}
                totalPages={totalPages}
                rowsPerPage={rowsPerPage}
                onPageChange={changePage}
                onRowsPerPageChange={changeRowsPerPage}
              />
            </div>
          </>
        )}
      </div>
    );
  }

  // Regular layout with panels
  return (
    <div ref={containerRef} className="h-full w-full flex overflow-hidden">
      {/* Schema Browser Panel */}
      <div
        className="flex-shrink-0 transition-all duration-200 overflow-hidden"
        style={{
          width: showSchemaBrowser ? `${PANEL_WIDTH}px` : "0px",
          opacity: showSchemaBrowser ? 1 : 0,
        }}
      >
        {showSchemaBrowser && (
          <div className="h-full border-r border-white/10 bg-darkNav overflow-hidden">
            <SchemaBrowser onInsertQuery={(text) => setQuery(query + text)} />
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-grow flex flex-col min-w-0 overflow-hidden">
        {/* Editor Area */}
        <div
          ref={editorRef}
          className="flex flex-col relative"
          style={{ height: `${queryInputHeight}px` }}
        >
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

              {hasWarnings && (
                <button
                  className="flex items-center text-xs px-2 py-0.5 bg-warning/20 text-warning rounded cursor-pointer"
                  onClick={() => setShowOptimizationTips(!showOptimizationTips)}
                  title="Query optimization suggestions available"
                >
                  <Zap size={12} className="mr-1" />
                  <span>Optimize</span>
                </button>
              )}
            </div>

            <div className="flex items-center space-x-2">
              {/* TODO */}
              {/* <QueryAssistant
            onQueryGenerated={(sql) => setQuery(sql)}
            tableSchema={tableSchema}
          /> */}

              <Button
                variant="ghost"
                size="sm"
                onClick={handleSaveQuery}
                className="h-8"
                disabled={!query.trim()}
              >
                <Save size={14} className="mr-1" />
                <span>Save</span>
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={keyboardHandlers.executeQuery}
                disabled={
                  isLoading ||
                  isChangingPage ||
                  !query.trim() ||
                  !canExecuteQueries
                }
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
                title="Full Screen Editor"
              >
                <Maximize size={16} />
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            <MonacoEditor
              value={query}
              onChange={setQuery}
              onExecute={keyboardHandlers.executeQuery}
            />
          </div>

          {/* Optimization Tips Panel */}
          {showOptimizationTips && suggestions.length > 0 && (
            <div className="absolute top-12 right-0 w-80 bg-background border border-white/10 rounded-md shadow-lg z-10 p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium flex items-center">
                  <Zap size={14} className="mr-1 text-warning" />
                  Query Optimization Tips
                </h3>
                <button
                  className="text-white/50 hover:text-white"
                  onClick={() => setShowOptimizationTips(false)}
                >
                  ×
                </button>
              </div>

              <div className="space-y-2 mb-2">
                {suggestions.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className={`p-2 text-xs rounded ${
                      suggestion.severity === "warning"
                        ? "bg-warning/10 border border-warning/30"
                        : suggestion.severity === "critical"
                        ? "bg-destructive/10 border border-destructive/30"
                        : "bg-white/5 border border-white/10"
                    }`}
                  >
                    <div className="mb-1">{suggestion.message}</div>
                    {suggestion.fix && (
                      <button
                        className="text-xs px-2 py-0.5 bg-primary/20 text-primary rounded"
                        onClick={() => {
                          setQuery(suggestion.fix!());
                          setShowOptimizationTips(false);
                        }}
                      >
                        Apply Fix
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <button
                  className="text-xs px-3 py-1 rounded bg-primary text-white"
                  onClick={handleOptimizeQuery}
                >
                  Optimize Query
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Resizer Handle */}
        <div
          ref={dividerRef}
          className="h-2 bg-darkNav/50 cursor-row-resize hover:bg-primary/30 transition-colors flex items-center justify-center"
          onMouseDown={startEditorResize}
        >
          <div className="w-8 h-1 bg-white/20 rounded-full" />
        </div>

        {/* Results Area */}
        <div
          ref={resultsRef}
          className="flex-1 flex flex-col min-h-0 overflow-hidden"
        >
          {ResultsToolbar}

          {/* Large Dataset Warning */}
          {showLargeDataWarning && totalRows > 10000 && (
            <div className="bg-primary/10 border border-primary/30 rounded p-3 m-3 text-white text-sm">
              <div className="flex items-start">
                <AlertTriangle
                  size={18}
                  className="text-primary mt-0.5 mr-2 flex-shrink-0"
                />
                <div className="flex-1">
                  <h4 className="text-sm font-medium mb-1">
                    Large Result Set ({totalRows.toLocaleString()} rows)
                  </h4>
                  <p className="text-xs text-white/80 mb-2">
                    This query is returning a large dataset which may affect
                    performance. Consider adding filters or LIMIT clause to
                    reduce the result size.
                  </p>
                  <div className="flex justify-end space-x-2 mt-2">
                    <button
                      className="text-xs px-3 py-1 rounded bg-primary text-white"
                      onClick={applyLimitOptimization}
                    >
                      Add LIMIT Clause
                    </button>
                    <button
                      className="text-xs px-3 py-1 rounded bg-white/10 hover:bg-white/20"
                      onClick={dismissWarning}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Getting Started Help Panel */}
          {!canExecuteQueries && (
            <div className="bg-secondary/10 border border-secondary/30 rounded p-3 m-3 text-white text-sm">
              <div className="flex items-start">
                <Database
                  size={18}
                  className="text-secondary mt-0.5 mr-2 flex-shrink-0"
                />
                <div className="flex-1">
                  <h4 className="text-sm font-medium mb-1">
                    Ready to Query Sample Data!
                  </h4>
                  <p className="text-xs text-white/80 mb-2">
                    {hasUserTables
                      ? "You have uploaded data ready to query. Try the sample query above or write your own SQL."
                      : "A sample employees table is available for testing. Import your own CSV, JSON, or Parquet files to query your data."}
                  </p>
                  {/* <div className="text-xs text-white/60">
                    Available tables:{" "}
                    {tablesWithMetadata.map((t) => t.name).join(", ")}
                  </div> */}
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-hidden">
            <QueryResults
              results={results}
              columns={columns}
              isLoading={isLoading || isChangingPage || isLoadingQueries}
              error={error}
              totalRows={totalRows}
              currentPage={currentPage}
              totalPages={totalPages}
              rowsPerPage={rowsPerPage}
              onPageChange={changePage}
              onRowsPerPageChange={changeRowsPerPage}
            />
          </div>
        </div>
      </div>

      {/* Query History Panel */}
      <div
        className="flex-shrink-0 transition-all duration-200 overflow-hidden"
        style={{
          width: showQueryHistory ? `${PANEL_WIDTH}px` : "0px",
          opacity: showQueryHistory ? 1 : 0,
        }}
      >
        {showQueryHistory && (
          <div className="h-full border-l border-white/10 bg-darkNav overflow-hidden">
            <QueryHistory onSelectQuery={selectQuery} />
          </div>
        )}
      </div>

      {/* Save Query Dialog */}
      {saveDialogOpen && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/60 flex items-center justify-center z-50">
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
                    saveQuery(query, queryName);
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
