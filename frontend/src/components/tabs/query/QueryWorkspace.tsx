import React, { useState, useRef, useEffect } from "react";
import {
  Play,
  ChevronLeft,
  ChevronRight,
  Maximize,
  Minimize,
  Save,
  Clock,
  AlertTriangle,
  Zap,
} from "lucide-react";

import { useAppStore } from "@/store/appStore";

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


// Constants for panel dimensions
const PANEL_WIDTH = 260;
const QUERY_INPUT_DEFAULT_HEIGHT = 300;

/**
 * Main container for the enhanced query tab with resizable panels
 */
const QueryWorkspace: React.FC = () => {
  const { tableName } = useAppStore();

  // State for query editor
  const [query, setQuery] = useState<string>(`-- Write your SQL query here
SELECT *
FROM "${tableName || "table"}"
LIMIT 10;`);

  // Custom hooks for query functionality
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

  const { tableSchema } = useSchemaInfo();

  // UI state
  const [showSchemaBrowser, setShowSchemaBrowser] = useState(() => {
    return localStorage.getItem("datakit-show-schema-browser") !== "false";
  });

  const [showQueryHistory, setShowQueryHistory] = useState(() => {
    return localStorage.getItem("datakit-show-query-history") !== "false";
  });

  const [showOptimizationTips, setShowOptimizationTips] =
    useState<boolean>(false);
  const [fullScreenMode, setFullScreenMode] = useState<
    "none" | "editor" | "results"
  >("none");
  const [queryInputHeight, setQueryInputHeight] = useState<number>(() => {
    return parseInt(
      localStorage.getItem("datakit-query-editor-height") ||
        String(QUERY_INPUT_DEFAULT_HEIGHT),
      10
    );
  });
  const [saveDialogOpen, setSaveDialogOpen] = useState<boolean>(false);
  const [queryName, setQueryName] = useState<string>("");

  // Run query analysis whenever the query changes
  useEffect(() => {
    analyzeQuery(query);
  }, [query, analyzeQuery]);

  // Initialize localStorage values if not set
  useEffect(() => {
    if (localStorage.getItem("datakit-show-schema-browser") === null) {
      localStorage.setItem("datakit-show-schema-browser", "true");
    }

    if (localStorage.getItem("datakit-show-query-history") === null) {
      localStorage.setItem("datakit-show-query-history", "true");
    }

    if (localStorage.getItem("datakit-query-editor-height") === null) {
      localStorage.setItem(
        "datakit-query-editor-height",
        String(QUERY_INPUT_DEFAULT_HEIGHT)
      );
    }
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

  // Toggle sidebar panels
  const toggleSchemaBrowser = () => {
    const newValue = !showSchemaBrowser;
    console.log(`[Panel] Toggling schema browser: ${newValue}`);
    setShowSchemaBrowser(newValue);
    localStorage.setItem("datakit-show-schema-browser", String(newValue));

    // Force layout recalculation after state update
    requestAnimationFrame(() => {
      if (containerRef.current) {
        const event = new Event("resize");
        window.dispatchEvent(event);
      }
    });
  };

  const toggleQueryHistory = () => {
    const newValue = !showQueryHistory;
    console.log(`[Panel] Toggling query history: ${newValue}`);
    setShowQueryHistory(newValue);
    localStorage.setItem("datakit-show-query-history", String(newValue));

    // Force layout recalculation after state update
    requestAnimationFrame(() => {
      if (containerRef.current) {
        const event = new Event("resize");
        window.dispatchEvent(event);
      }
    });
  };

  // Toggle full screen mode
  const toggleFullScreenMode = (mode: "editor" | "results") => {
    setFullScreenMode((prevMode) => (prevMode === mode ? "none" : mode));
  };

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

  // Toggle UI panels
  const toggleOptimizationTips = () =>
    setShowOptimizationTips(!showOptimizationTips);

  // Apply query optimizations
  const handleOptimizeQuery = () => {
    const optimizedQuery = optimizeQuery(query);
    setQuery(optimizedQuery);
    setShowOptimizationTips(false);
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Enter to execute query
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        executeQuery();
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
  }, [query, fullScreenMode, queryName, executeQuery]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      // Force re-render on window resize
      if (containerRef.current) {
        // This is just to trigger a re-render
        setQueryInputHeight((prev) => prev);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Return the appropriate layout based on fullscreen mode
  if (fullScreenMode !== "none") {
    return (
      <div className="w-full h-full flex flex-col">
        {fullScreenMode === "editor" ? (
          <>
            {/* Editor Toolbar */}
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

            {/* Fullscreen Editor */}
            <div className="flex-1 overflow-hidden">
              <MonacoEditor
                value={query}
                onChange={setQuery}
                onExecute={executeQuery}
              />
            </div>
          </>
        ) : (
          <>
            {/* Results Toolbar */}
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

            {/* Fullscreen Results */}
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
      {/* Fixed-width left panel (Schema Browser) */}
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

      {/* Main content area (always flexible) */}
      <div className="flex-grow flex flex-col min-w-0 overflow-hidden">
        {/* Editor area */}
        <div
          ref={editorRef}
          className="flex flex-col relative"
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

              {hasWarnings && (
                <button
                  className="flex items-center text-xs px-2 py-0.5 bg-warning/20 text-warning rounded cursor-pointer"
                  onClick={toggleOptimizationTips}
                  title="Query optimization suggestions available"
                >
                  <Zap size={12} className="mr-1" />
                  <span>Optimize</span>
                </button>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <QueryAssistant
                onQueryGenerated={(sql) => setQuery(sql)}
                tableSchema={tableSchema}
              />

            
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
                onClick={executeQuery}
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
                title="Full Screen Editor"
              >
                <Maximize size={16} />
              </Button>
            </div>
          </div>

          {/* Monaco Editor */}
          <div className="flex-1 overflow-hidden">
            <MonacoEditor
              value={query}
              onChange={setQuery}
              onExecute={executeQuery}
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

        {/* Resizer handle */}
        <div
          ref={dividerRef}
          className="h-2 bg-darkNav/50 cursor-row-resize hover:bg-primary/30 transition-colors flex items-center justify-center"
          onMouseDown={startEditorResize}
        >
          <div className="w-8 h-1 bg-white/20 rounded-full" />
        </div>

        {/* Results area */}
        <div
          ref={resultsRef}
          className="flex-1 flex flex-col min-h-0 overflow-hidden"
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

              {totalRows > 0 && (
                <div className="text-xs text-white/60">
                  {totalRows.toLocaleString()} rows
                </div>
              )}
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
                title={
                  showQueryHistory ? "Hide Query History" : "Show Query History"
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

          {/* Query results component */}
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

      {/* Fixed-width right panel (Query History) */}
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
