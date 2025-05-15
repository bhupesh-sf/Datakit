import React, { useState, useRef, useEffect } from "react";
import { useAppStore } from "@/store/appStore";

import SchemaBrowser from "./SchemaBrowser";
import MonacoEditor from "./MonacoEditor";
import QueryHistory from "./QueryHistory";
import QueryResults from "./QueryResults";

import { useResizable } from "@/hooks/useResizable";

import { useQueryExecution } from "@/hooks/query/useQueryExecution";
import { useQueryHistory } from "@/hooks/query/useQueryHistory";
import { useQueryOptimization } from "@/hooks/query/useQueryOptimization";

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
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/Button";

import QueryTemplates from "./QueryTemplates";

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
    dismissWarning
  } = useQueryExecution(query, setQuery);
  
  const {
    selectQuery,
    saveQuery,
    isLoadingQueries
  } = useQueryHistory((selectedQuery) => setQuery(selectedQuery));
  
  const {
    suggestions,
    hasWarnings,
    analyzeQuery,
    optimizeQuery
  } = useQueryOptimization();

  // UI state
  const [showTemplates, setShowTemplates] = useState<boolean>(false);
  const [showOptimizationTips, setShowOptimizationTips] = useState<boolean>(false);
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

  // Run query analysis whenever the query changes
  useEffect(() => {
    analyzeQuery(query);
  }, [query, analyzeQuery]);

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
      saveQuery(query, queryName);
      setSaveDialogOpen(false);
      setQueryName("");
    }
  };

  // Toggle UI panels
  const toggleTemplates = () => setShowTemplates(!showTemplates);
  const toggleOptimizationTips = () => setShowOptimizationTips(!showOptimizationTips);

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
                    className="flex items-center text-xs px-2 py-0.5 bg-warning/20 text-warning rounded"
                    onClick={toggleOptimizationTips}
                    title="Query optimization suggestions available"
                  >
                    <Zap size={12} className="mr-1" />
                    <span>Optimize</span>
                  </button>
                )}
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
                onExecute={executeQuery}
              />
            </div>

            {/* Query Templates Panel */}
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
                  {suggestions.map(suggestion => (
                    <div 
                      key={suggestion.id}
                      className={`p-2 text-xs rounded ${
                        suggestion.severity === 'warning' ? 'bg-warning/10 border border-warning/30' :
                        suggestion.severity === 'critical' ? 'bg-destructive/10 border border-destructive/30' :
                        'bg-white/5 border border-white/10'
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
            <div className="flex-1 overflow-auto">
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
        )}
      </div>

      {/* Query History */}
      {showQueryHistory && fullScreenMode === "none" && (
        <div className="h-full border-l border-white/10 bg-darkNav overflow-hidden">
          <QueryHistory onSelectQuery={selectQuery} />
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