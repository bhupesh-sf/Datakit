import React, { useState, useRef } from "react";
import {
  Play,
  ChevronLeft,
  ChevronRight,
  Maximize,
  Minimize,
} from "lucide-react";

import { useAppStore } from "@/store/appStore";

import { useDuckDBStore } from "@/store/duckDBStore";

import { useResizable } from "@/hooks/useResizable";

import SchemaBrowser from "./schemaBrowser";
import MonacoEditor from "./MonacoEditor";
import QueryHistory from "./QueryHistory";
import QueryResults from "./QueryResults";

import { Button } from "@/components/ui/Button";

/**
 * Main container for the enhanced query tab with resizable panels
 */
const QueryWorkspace: React.FC = () => {
  const { tableName } = useAppStore();
  const { executeQuery, isLoading } = useDuckDBStore();

  // State for query editor
  const [query, setQuery] = useState<string>(`-- Write your SQL query here
SELECT *
FROM "${tableName || "table"}"
LIMIT 10;`);

  const editorRef = useRef<HTMLDivElement>(null);
  const { startResize: startEditorResize } = useResizable(editorRef, {
    direction: "vertical",
    initialSize: 300,
    minSize: 150,
    maxSize: 800,
    storageKey: "datakit-query-editor-height",
  });

  // Query results state
  const [results, setResults] = useState<any[] | null>(null);
  const [columns, setColumns] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [showSchemaBrowser, setShowSchemaBrowser] = useState<boolean>(true);
  const [showQueryHistory, setShowQueryHistory] = useState<boolean>(true);
  const [fullScreenMode, setFullScreenMode] = useState<
    "none" | "editor" | "results"
  >("none");

  // Element refs for resizing
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  // Execute the current query
  const handleExecuteQuery = async () => {
    if (!query.trim()) return;

    try {
      setError(null);
      const result = await executeQuery(query);

      if (result) {
        setResults(result.toArray());
        setColumns(result.schema.fields.map((f) => f.name));
      } else {
        setResults([]);
        setColumns([]);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unknown error executing query"
      );
      setResults(null);
      setColumns(null);
    }
  };

  // Toggle side panels
  const toggleSchemaBrowser = () => setShowSchemaBrowser(!showSchemaBrowser);
  const toggleQueryHistory = () => setShowQueryHistory(!showQueryHistory);

  // Toggle full screen mode
  const toggleFullScreenMode = (mode: "editor" | "results") => {
    if (fullScreenMode === mode) {
      setFullScreenMode("none");
    } else {
      setFullScreenMode(mode);
    }
  };

  // Calculate dynamic classes based on UI state
  const getContainerClasses = () => {
    if (fullScreenMode === "editor") {
      return "grid grid-cols-1 grid-rows-1";
    }
    if (fullScreenMode === "results") {
      return "grid grid-cols-1 grid-rows-1";
    }

    let baseClasses = "grid grid-rows-[1fr_auto_1fr] h-full gap-2";

    if (!showSchemaBrowser && !showQueryHistory) {
      return `${baseClasses} grid-cols-1`;
    }

    if (showSchemaBrowser && !showQueryHistory) {
      return `${baseClasses} grid-cols-[260px_1fr]`;
    }

    if (!showSchemaBrowser && showQueryHistory) {
      return `${baseClasses} grid-cols-[1fr_260px]`;
    }

    return `${baseClasses} grid-cols-[260px_1fr_260px]`;
  };

  return (
    <div className={getContainerClasses()}>
      {/* Schema Browser */}
      {showSchemaBrowser && fullScreenMode === "none" && (
        <div className="row-span-3 border-r border-white/10 bg-darkNav">
          <SchemaBrowser onInsertQuery={(text) => setQuery(query + text)} />
        </div>
      )}

      {/* Main content area */}
      <div
        className={`flex flex-col ${
          fullScreenMode !== "none"
            ? "col-span-full row-span-full"
            : "col-span-1 row-span-3"
        }`}
      >
        {/* Editor area */}
        {fullScreenMode !== "results" && (
          <div className="flex-1 flex flex-col" ref={editorContainerRef}>
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
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleExecuteQuery}
                  disabled={isLoading}
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
            <div className="flex-1 flex flex-col" ref={editorRef}>
              <MonacoEditor
                value={query}
                onChange={setQuery}
                onExecute={handleExecuteQuery}
              />
            </div>
          </div>
        )}

        {/* Resizer handle (only show when not in full screen) */}
        {fullScreenMode === "none" && (
          <div
            className="h-2 bg-darkNav/50 cursor-row-resize hover:bg-primary/30 transition-colors flex items-center justify-center"
            onMouseDown={startEditorResize}
          >
            <div className="w-8 h-1 bg-white/20 rounded-full" />
          </div>
        )}

        {/* Results area */}
        {fullScreenMode !== "editor" && (
          <div className="flex-1 flex flex-col" ref={resultsContainerRef}>
            {/* Results toolbar */}
            <div className="flex items-center justify-between p-2 bg-darkNav border-b border-white/10">
              <h3 className="text-sm font-medium">Query Results</h3>

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

            {/* Query results component */}
            <div className="flex-1 overflow-auto p-3">
              <QueryResults
                results={results}
                columns={columns}
                isLoading={isLoading}
                error={error}
              />
            </div>
          </div>
        )}
      </div>

      {/* Query History */}
      {showQueryHistory && fullScreenMode === "none" && (
        <div className="row-span-3 border-l border-white/10 bg-darkNav">
          <QueryHistory
            onSelectQuery={(selectedQuery) => setQuery(selectedQuery)}
          />
        </div>
      )}
    </div>
  );
};

export default QueryWorkspace;
