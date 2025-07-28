import React, {
  useRef,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import {
  Play,
  ChevronLeft,
  ChevronRight,
  Maximize,
  Minimize,
  Save,
  Database,
  FileText,
  AlertTriangle,
  Package,
  History,
  Code2,
  Plus,
  Command,
} from "lucide-react";

import { usePythonStore } from "@/store/pythonStore";
import { useDuckDBStore } from "@/store/duckDBStore";
import { useResizable } from "@/hooks/useResizable";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";

import PythonCell from "./PythonCell";
import ScriptHistory from "./ScriptHistory";
import PackageManager from "./PackageManager";
import ScriptTemplates from "./ScriptTemplates";
import VariableInspector from "./VariableInspector";
import SchemaBrowser from "../query/SchemaBrowser";

// Constants for panel dimensions
const DEFAULT_PANEL_WIDTH = 260;
const MIN_PANEL_WIDTH = 50;
const MAX_PANEL_WIDTH = 400;
const DEFAULT_EDITOR_HEIGHT = 300;

/**
 * Main container for the Python scripts workspace with resizable panels
 */
const ScriptsWorkspace: React.FC = () => {
  const {
    pyodide,
    cells,
    activeCellId,
    isExecuting,
    currentScript,
    showScriptHistory,
    showPackageManager,
    showVariableInspector,
    showTemplates,
    initializePython,
    createCell,
    executeCell,
    executeAllCells,
    setActiveCellId,
    toggleScriptHistory,
    togglePackageManager,
    toggleVariableInspector,
    toggleTemplates,
    saveScript,
  } = usePythonStore();

  const { isInitialized: isDuckDBInitialized } = useDuckDBStore();

  // UI State
  const [showSchemaBrowser, setShowSchemaBrowser] = useState(false);
  const [fullScreenMode, setFullScreenMode] = useState<"none" | "editor" | "results">("none");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [scriptName, setScriptName] = useState("");
  const [editorHeight, setEditorHeight] = useState(DEFAULT_EDITOR_HEIGHT);

  // Panel width states
  const [leftPanelWidth, setLeftPanelWidth] = useState(() => {
    const saved = localStorage.getItem("datakit-scripts-left-panel-width");
    return saved ? parseInt(saved, 10) : DEFAULT_PANEL_WIDTH;
  });

  const [rightPanelWidth, setRightPanelWidth] = useState(() => {
    const saved = localStorage.getItem("datakit-scripts-right-panel-width");
    return saved ? parseInt(saved, 10) : DEFAULT_PANEL_WIDTH;
  });

  // Resizing states
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);

  // Element refs
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);

  // Initialize Python on mount (only once)
  useEffect(() => {
    if (!pyodide.isInitialized && !pyodide.isInitializing && !pyodide.error) {
      initializePython();
    }
    // Only run on mount, not on state changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Setup resizable editor
  const { startResize: startEditorResize } = useResizable(editorRef, {
    direction: "vertical",
    initialSize: editorHeight,
    minSize: 200,
    maxSize: 600,
    storageKey: "datakit-scripts-editor-height",
    onResize: setEditorHeight,
  });

  // Handle left panel resize
  const handleLeftPanelResize = useCallback((e: MouseEvent) => {
    requestAnimationFrame(() => {
      if (!containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = Math.min(
        Math.max(e.clientX - containerRect.left, MIN_PANEL_WIDTH),
        MAX_PANEL_WIDTH
      );

      setLeftPanelWidth(newWidth);
    });
  }, []);

  const startLeftPanelResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingLeft(true);
  }, []);

  const stopLeftPanelResize = useCallback(() => {
    if (isResizingLeft) {
      setIsResizingLeft(false);
      localStorage.setItem("datakit-scripts-left-panel-width", leftPanelWidth.toString());
    }
  }, [isResizingLeft, leftPanelWidth]);

  // Handle right panel resize
  const handleRightPanelResize = useCallback((e: MouseEvent) => {
    requestAnimationFrame(() => {
      if (!containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = Math.min(
        Math.max(containerRect.right - e.clientX, MIN_PANEL_WIDTH),
        MAX_PANEL_WIDTH
      );

      setRightPanelWidth(newWidth);
    });
  }, []);

  const startRightPanelResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingRight(true);
  }, []);

  const stopRightPanelResize = useCallback(() => {
    if (isResizingRight) {
      setIsResizingRight(false);
      localStorage.setItem("datakit-scripts-right-panel-width", rightPanelWidth.toString());
    }
  }, [isResizingRight, rightPanelWidth]);

  // Mouse event handlers for resizing
  useEffect(() => {
    if (isResizingLeft) {
      document.addEventListener("mousemove", handleLeftPanelResize);
      document.addEventListener("mouseup", stopLeftPanelResize);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      return () => {
        document.removeEventListener("mousemove", handleLeftPanelResize);
        document.removeEventListener("mouseup", stopLeftPanelResize);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
    }
  }, [isResizingLeft, handleLeftPanelResize, stopLeftPanelResize]);

  useEffect(() => {
    if (isResizingRight) {
      document.addEventListener("mousemove", handleRightPanelResize);
      document.addEventListener("mouseup", stopRightPanelResize);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      return () => {
        document.removeEventListener("mousemove", handleRightPanelResize);
        document.removeEventListener("mouseup", stopRightPanelResize);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
    }
  }, [isResizingRight, handleRightPanelResize, stopRightPanelResize]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Enter to execute current cell
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && activeCellId) {
        e.preventDefault();
        executeCell(activeCellId);
      }

      // Ctrl/Cmd + Shift + Enter to execute all cells
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "Enter") {
        e.preventDefault();
        executeAllCells();
      }

      // Ctrl/Cmd + S to save script
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSaveScript();
      }

      // Escape to exit full screen
      if (e.key === "Escape" && fullScreenMode !== "none") {
        e.preventDefault();
        setFullScreenMode("none");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeCellId, executeCell, executeAllCells, fullScreenMode]);

  // Handle save script
  const handleSaveScript = () => {
    if (!currentScript && !scriptName.trim()) {
      setSaveDialogOpen(true);
    } else {
      const name = scriptName.trim() || currentScript?.name || `Script ${Date.now()}`;
      saveScript(name);
      setSaveDialogOpen(false);
      setScriptName("");
    }
  };

  // Show initialization state
  if (!pyodide.isInitialized) {
    if (pyodide.error) {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="text-center p-8 max-w-md">
            <div className="mb-6 flex justify-center">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
            </div>
            <h3 className="text-lg font-heading font-medium text-white mb-2">
              Python Initialization Failed
            </h3>
            <p className="text-white/70 mb-4">{pyodide.error}</p>
            <Button onClick={initializePython} variant="primary">
              Retry Initialization
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center p-8 max-w-md">
          <h3 className="text-lg font-heading font-medium text-white mb-2">
            {pyodide.isInitializing ? "Initializing Python" : "Python Not Ready"}
          </h3>
          <p className="text-white/70 mb-4">
            {pyodide.isInitializing
              ? ""
              : "Preparing your Python data analysis environment..."}
          </p>
          <div className="text-sm text-white/60">
            <div className="flex items-center justify-center gap-2">
              <Package className="w-4 h-4 text-secondary" />
              <span>Loading numpy, pandas, matplotlib...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show left panel content based on active view
  const renderLeftPanel = () => {
    if (showTemplates) {
      return <ScriptTemplates />;
    }
    if (showPackageManager) {
      return <PackageManager />;
    }
    if (showScriptHistory) {
      return <ScriptHistory />;
    }
    if (showSchemaBrowser && isDuckDBInitialized) {
      return <SchemaBrowser onInsertQuery={() => {}} />;
    }
    return <VariableInspector />;
  };

  // Show right panel
  const renderRightPanel = () => {
    return <VariableInspector />;
  };

  const showLeftPanel = showTemplates || showPackageManager || showScriptHistory || showSchemaBrowser || showVariableInspector;
  const showRightPanel = showVariableInspector;

  // Full screen mode
  if (fullScreenMode !== "none") {
    return (
      <div className="w-full h-full flex flex-col">
        <div className="flex items-center justify-between p-2 bg-darkNav border-b border-white/10">
          <h3 className="text-sm font-medium">
            {fullScreenMode === "editor" ? "Python Editor (Fullscreen)" : "Results (Fullscreen)"}
          </h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setFullScreenMode("none")}
            title="Exit Full Screen"
          >
            <Minimize size={16} />
          </Button>
        </div>
        <div className="flex-1 overflow-hidden">
          {/* Full screen content would go here */}
        </div>
      </div>
    );
  }

  // Regular layout with panels
  return (
    <div
      ref={containerRef}
      className="h-full w-full flex overflow-hidden relative"
    >
      {/* Resize Overlays */}
      {(isResizingLeft || isResizingRight) && (
        <div
          className="absolute inset-0 z-50"
          style={{ cursor: "col-resize" }}
        />
      )}

      {/* Left Panel */}
      <div
        ref={leftPanelRef}
        className={`flex-shrink-0 overflow-hidden bg-darkNav border-r border-white/10 relative ${
          isResizingLeft ? "" : "transition-all duration-200"
        }`}
        style={{
          width: showLeftPanel ? `${leftPanelWidth}px` : "0px",
        }}
      >
        <div className="h-full w-full">
          {renderLeftPanel()}
        </div>

        {/* Left Resize Handle */}
        {showLeftPanel && (
          <div
            className={`absolute top-0 right-0 w-1 h-full cursor-col-resize bg-transparent ${
              isResizingLeft
                ? "bg-primary/50"
                : "hover:bg-primary/30 transition-colors"
            }`}
            onMouseDown={startLeftPanelResize}
            style={{
              width: "5px",
              right: "-2px",
            }}
          >
            {isResizingLeft && (
              <div className="absolute inset-0 bg-primary/50" />
            )}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-grow flex flex-col min-w-0 overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between p-2 bg-darkNav border-b border-white/10">
          <div className="flex items-center space-x-2">
            {/* Left panel toggles */}
            <Tooltip content="Toggle Schema Browser" placement="right">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowSchemaBrowser(!showSchemaBrowser)}
              >
                <Database size={16} />
              </Button>
            </Tooltip>

            <Tooltip content="Script Templates" placement="bottom">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={toggleTemplates}
              >
                <FileText size={16} />
              </Button>
            </Tooltip>

            <Tooltip content="Script History" placement="bottom">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={toggleScriptHistory}
              >
                <History size={16} />
              </Button>
            </Tooltip>

            <Tooltip content="Package Manager" placement="bottom">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={togglePackageManager}
              >
                <Package size={16} />
              </Button>
            </Tooltip>

            <div className="w-px h-6 bg-white/10" />

            <h3 className="text-sm font-medium">Python Notebook</h3>
          </div>

          <div className="flex items-center space-x-2">
            <Tooltip content="Add New Cell" placement="bottom">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => createCell()}
                className="h-8"
              >
                <Plus size={14} className="mr-1" />
                <span>Cell</span>
              </Button>
            </Tooltip>

            <Tooltip content="Save Script" placement="bottom">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSaveScript}
                className="h-8"
                disabled={cells.length === 0}
              >
                <Save size={14} className="mr-1" />
                <span>Save</span>
              </Button>
            </Tooltip>

            <Tooltip content="Execute All Cells (⌘+Shift+Enter)" placement="bottom">
              <Button
                variant="primary"
                size="sm"
                onClick={executeAllCells}
                disabled={isExecuting || cells.length === 0}
                className="h-8 gap-2"
              >
                <div className="flex items-center">
                  <Play size={14} className="mr-1" />
                  <span>Run All</span>
                </div>
                <div className="flex items-center text-[11px] opacity-60 bg-white/10 px-1.5 py-0.5 rounded">
                  <Command size={11} className="mr-0.5" />
                  <span className="leading-none">⇧↵</span>
                </div>
              </Button>
            </Tooltip>

            <Tooltip content="Full Screen Editor" placement="left">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setFullScreenMode("editor")}
              >
                <Maximize size={16} />
              </Button>
            </Tooltip>
          </div>
        </div>

        {/* Cells Area */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto overflow-x-visible p-4 space-y-4">
            {cells.map((cell, index) => (
              <PythonCell
                key={cell.id}
                cell={cell}
                isActive={cell.id === activeCellId}
                onActivate={() => setActiveCellId(cell.id)}
                cellNumber={index + 1}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div
        ref={rightPanelRef}
        className={`flex-shrink-0 overflow-hidden bg-darkNav border-l border-white/10 relative ${
          isResizingRight ? "" : "transition-all duration-200"
        }`}
        style={{
          width: showRightPanel ? `${rightPanelWidth}px` : "0px",
        }}
      >
        <div className="h-full w-full">
          {renderRightPanel()}
        </div>

        {/* Right Resize Handle */}
        {showRightPanel && (
          <div
            className={`absolute top-0 left-0 w-1 h-full cursor-col-resize bg-transparent ${
              isResizingRight
                ? "bg-primary/50"
                : "hover:bg-primary/30 transition-colors"
            }`}
            onMouseDown={startRightPanelResize}
            style={{
              width: "5px",
              left: "-2px",
            }}
          >
            {isResizingRight && (
              <div className="absolute inset-0 bg-primary/50" />
            )}
          </div>
        )}
      </div>

      {/* Save Script Dialog */}
      {saveDialogOpen && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/60 flex items-center justify-center z-50">
          <div className="bg-darkNav p-4 rounded-lg shadow-lg w-96">
            <h3 className="text-lg font-medium mb-4">Save Script</h3>
            <input
              type="text"
              className="w-full p-2 bg-background border border-white/10 rounded mb-4"
              placeholder="Enter script name"
              value={scriptName}
              onChange={(e) => setScriptName(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end space-x-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setSaveDialogOpen(false);
                  setScriptName("");
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  if (scriptName.trim()) {
                    saveScript(scriptName);
                    setSaveDialogOpen(false);
                    setScriptName("");
                  }
                }}
                disabled={!scriptName.trim()}
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

export default ScriptsWorkspace;