import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Download,
  AlertCircle,
  TrendingUp,
  Hash,
  Type,
  Calendar,
  FileText,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Info,
  Play,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { useInspectorStore, InspectorMetrics } from "@/store/inspectorStore";
import { useAppStore } from "@/store/appStore";
import {
  selectFileTabs,
  selectActiveFile,
} from "@/store/selectors/appSelectors";

import {
  ChartContainer,
  NumericHistogram,
  CategoricalBarChart,
} from "./charts";
import { ColumnSearch, FilterType } from "./ColumnSearch";
import { useColumnFilter } from "./useColumnFilter";
import { QuickOverview } from "./QuickOverview";

interface InspectorPanelProps {
  className?: string;
}

/**
 * Enhanced Mini Chart Component using Recharts
 */
const MiniChart: React.FC<{
  column: InspectorMetrics["columnMetrics"][0];
  metrics: InspectorMetrics;
}> = ({ column, metrics }) => {
  const isNumeric = column.numericStats;
  const frequentValues = metrics.frequentValues.find(
    (fv) => fv.column === column.name
  );

  // Render histogram for numeric columns
  if (isNumeric && column.histogramData && column.histogramData.length > 0) {
    return (
      <ChartContainer title="Distribution" height={140}>
        <NumericHistogram
          data={column.histogramData}
          color="hsl(175, 100%, 36%)" // primary color
        />
      </ChartContainer>
    );
  }

  // Render bar chart for categorical columns
  if (frequentValues && frequentValues.values.length > 0) {
    return (
      <ChartContainer title="Top Values" height={140}>
        <CategoricalBarChart
          data={frequentValues.values.slice(0, 7)} // Top 7 values
          colors={[
            "red", // secondary
            "hsl(175, 100%, 36%)", // primary
            "hsl(167, 53%, 49%)", // tertiary
            "hsl(271, 75%, 63%)", // secondary lighter
            "hsl(175, 100%, 46%)", // primary lighter
            "hsl(167, 53%, 59%)", // tertiary lighter
            "hsl(271, 75%, 73%)", // secondary even lighter
          ]}
        />
      </ChartContainer>
    );
  }

  // Fallback stats display
  if (isNumeric && column.numericStats) {
    return (
      <div className="mt-3 p-3 bg-card/20 rounded-lg">
        <div className="text-xs text-white/60 mb-2">Statistics</div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex justify-between">
            <span className="text-white/60">Min:</span>
            <span className="text-white font-mono">
              {column.numericStats.min.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/60">Max:</span>
            <span className="text-white font-mono">
              {column.numericStats.max.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/60">Mean:</span>
            <span className="text-white font-mono">
              {column.numericStats.mean.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/60">Median:</span>
            <span className="text-white font-mono">
              {column.numericStats.median.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

/**
 * Column Row Component (MotherDuck-inspired)
 */
const ColumnRow: React.FC<{
  column: InspectorMetrics["columnMetrics"][0];
  metrics: InspectorMetrics;
  isExpanded: boolean;
  onToggle: () => void;
  onGenerateQuery: (query: string, description: string) => void;
}> = ({ column, metrics, isExpanded, onToggle, onGenerateQuery }) => {
  const getColumnIcon = (type: string) => {
    const lowerType = type.toLowerCase();
    if (
      lowerType.includes("int") ||
      lowerType.includes("double") ||
      lowerType.includes("numeric")
    ) {
      return <Hash className="h-4 w-4 text-tertiary" />;
    }
    if (lowerType.includes("varchar") || lowerType.includes("text")) {
      return <Type className="h-4 w-4 text-blue-400" />;
    }
    if (lowerType.includes("date") || lowerType.includes("time")) {
      return <Calendar className="h-4 w-4 text-purple-400" />;
    }
    return <FileText className="h-4 w-4 text-white/50" />;
  };

  const getQuickStat = () => {
    if (column.numericStats) {
      return `${column.numericStats.min} - ${column.numericStats.max}`;
    }
    if (column.nullCount > 0) {
      return `${column.nullCount} nulls`;
    }
    return `${column.uniqueCount} distinct`;
  };

  const generateSuggestedQueries = () => {
    const tableName = metrics.activeTableName
      ? `"${metrics.activeTableName}"`
      : "table";
    const queries = [];

    // For columns with low cardinality
    if (column.uniqueCount <= 10 && column.uniqueCount > 1) {
      queries.push({
        query: `SELECT DISTINCT "${column.name}" FROM ${tableName} ORDER BY "${column.name}"`,
        description: `Show all ${column.uniqueCount} distinct values`,
      });
    }

    // For columns with nulls
    if (column.nullCount > 0) {
      queries.push({
        query: `SELECT * FROM ${tableName} WHERE "${column.name}" IS NOT NULL`,
        description: `Filter out ${column.nullCount} null values`,
      });

      // Also add query to see null rows
      queries.push({
        query: `SELECT * FROM ${tableName} WHERE "${column.name}" IS NULL`,
        description: `Show ${column.nullCount} rows with null values`,
      });
    }

    // For numeric columns
    if (column.numericStats) {
      const { mean, std } = column.numericStats;
      if (std > 0) {
        const threshold = mean + 2 * std;
        queries.push({
          query: `SELECT * FROM ${tableName} WHERE "${
            column.name
          }" > ${threshold.toFixed(2)}`,
          description: `Find outliers (>${threshold.toFixed(2)})`,
        });
      }

      // Add range query
      queries.push({
        query: `SELECT MIN("${column.name}") as min_val, MAX("${column.name}") as max_val, AVG("${column.name}") as avg_val FROM ${tableName}`,
        description: `Get min/max/average statistics`,
      });
    }

    // For text columns
    if (column.textStats) {
      queries.push({
        query: `SELECT "${column.name}", LENGTH("${column.name}") as text_length FROM ${tableName} ORDER BY text_length DESC LIMIT 10`,
        description: `Find longest text values`,
      });
    }

    // General exploration query
    queries.push({
      query: `SELECT "${column.name}", COUNT(*) as frequency FROM ${tableName} GROUP BY "${column.name}" ORDER BY frequency DESC LIMIT 20`,
      description: `Explore value frequencies`,
    });

    return queries;
  };

  return (
    <div className="border-b border-white/5">
      <button
        onClick={onToggle}
        className="w-full p-3 hover:bg-white/2 transition-colors flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {getColumnIcon(column.type)}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-white truncate">{column.name}</div>
            <div className="text-xs text-white/60">{column.type}</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-white font-mono">{getQuickStat()}</div>
            <div className="text-xs text-white/50">
              {column.uniqueCount} distinct
            </div>
          </div>
        </div>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-white/50 ml-2" />
        ) : (
          <ChevronRight className="h-4 w-4 text-white/50 ml-2" />
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3">
              {/* Chart */}
              <MiniChart column={column} metrics={metrics} />

              {/* Suggested Queries */}
              <div className="mt-3">
                <div className="text-xs text-white/60 mb-2">
                  Suggested Queries
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {generateSuggestedQueries().map((item, i) => (
                    <button
                      key={i}
                      onClick={() =>
                        onGenerateQuery(item.query, item.description)
                      }
                      className="flex items-center gap-2 w-full p-2 bg-primary/5 hover:bg-primary/10 rounded text-xs text-left transition-colors"
                    >
                      <Play className="h-3 w-3 text-primary flex-shrink-0" />
                      <span className="text-white/80">{item.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * File Selector Component
 */
const FileSelector: React.FC<{
  currentFileId: string | null;
  onFileChange: (fileId: string) => void;
}> = ({ currentFileId, onFileChange }) => {
  const fileTabs = useAppStore(selectFileTabs);
  const [isOpen, setIsOpen] = useState(false);

  const currentFile = fileTabs.find((tab) => tab.id === currentFileId);

  if (fileTabs.length <= 1) return null;

  return (
    <div className="relative p-4 border-b border-white/10">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-2 bg-card/30 hover:bg-card/50 rounded-lg border border-white/10 transition-colors"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <FileText className="h-4 w-4 text-white/60" />
          <span className="text-sm text-white truncate">
            {currentFile?.fileName || "Select file..."}
          </span>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-white/60 transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-4 right-4 mt-1 bg-card/95 backdrop-blur-sm border border-white/20 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto"
          >
            {fileTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  onFileChange(tab.id);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-2 p-2 text-left hover:bg-white/10 transition-colors",
                  tab.id === currentFileId && "bg-primary/20 text-primary"
                )}
              >
                <FileText className="h-3 w-3" />
                <span className="text-sm truncate">{tab.fileName}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * Loading State Component
 */
const LoadingState: React.FC<{ progress: number; status: string }> = ({
  progress,
  status,
}) => (
  <div className="flex flex-col items-center justify-center py-12 space-y-4">
    <div className="relative">
      <RefreshCw className="h-8 w-8 text-primary animate-spin" />
    </div>
    <div className="text-center space-y-2">
      <div className="text-sm font-medium text-white">{status}</div>
      <div className="w-64 bg-white/10 rounded-full h-2">
        <div
          className="bg-primary h-2 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="text-xs text-white/60">
        {progress.toFixed(0)}% complete
      </div>
    </div>
  </div>
);

/**
 * Error State Component
 */
const ErrorState: React.FC<{ error: string; onRetry: () => void }> = ({
  error,
  onRetry,
}) => (
  <div className="flex flex-col items-center justify-center py-12 space-y-4">
    <AlertCircle className="h-8 w-8 text-red-400" />
    <div className="text-center space-y-2">
      <div className="text-sm font-medium text-white">Analysis Failed</div>
      <div className="text-xs text-white/60 max-w-80 px-4">{error}</div>
    </div>
    <button
      onClick={onRetry}
      className="px-4 py-2 bg-primary/20 hover:bg-primary/30 text-primary rounded-lg text-sm font-medium transition-colors"
    >
      Retry Analysis
    </button>
  </div>
);

/**
 * Main Inspector Panel Component
 */
const InspectorPanel: React.FC<InspectorPanelProps> = ({ className }) => {
  // All state comes from inspector store
  const {
    isOpen,
    width,
    setWidth,
    closePanel,
    isAnalyzing,
    analysisProgress,
    analysisStatus,
    activeFileId,
    results,
    error,
    analyzeFile,
    switchAnalysisTarget,
    exportResults,
    resetError,
  } = useInspectorStore();

  const activeFile = useAppStore(selectActiveFile);
  const fileTabs = useAppStore(selectFileTabs);
  const { setActiveTab } = useAppStore();

  // Refs for panel management
  const panelRef = useRef<HTMLDivElement>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [expandedColumns, setExpandedColumns] = useState<Set<string>>(
    new Set()
  );

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("all");

  // Get current analysis results
  const currentResults = activeFileId ? results.get(activeFileId) : null;

  // Filter columns based on search and filter type
  const filteredColumns = useColumnFilter(
    currentResults?.columnMetrics || [],
    searchTerm,
    filterType
  );

  // Toggle column expansion
  const toggleColumn = (columnName: string) => {
    const newExpanded = new Set(expandedColumns);
    if (newExpanded.has(columnName)) {
      newExpanded.delete(columnName);
    } else {
      newExpanded.add(columnName);
    }
    setExpandedColumns(newExpanded);
  };

  // Handle query generation and navigation
  const handleGenerateQuery = (query: string, description: string) => {
    // Copy to clipboard
    navigator.clipboard.writeText(query);

    // Switch to query tab
    setActiveTab("query");

    // Close inspector after generating query
    closePanel();

    // TODO:
    // You might want to also set the query in your Monaco editor
    // This would depend on your query tab implementation
  };

  // Reset search when results change
  useEffect(() => {
    setSearchTerm("");
    setFilterType("all");
    setExpandedColumns(new Set());
  }, [activeFileId]);

  // Resize handling
  useEffect(() => {
    let startX = 0;
    let startWidth = 0;

    const handleMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);

      startX = e.clientX;
      startWidth = width;

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    };

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = startX - e.clientX;
      const newWidth = startWidth + deltaX;
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    const resizeHandle = resizeHandleRef.current;
    if (resizeHandle) {
      resizeHandle.addEventListener("mousedown", handleMouseDown);

      return () => {
        resizeHandle.removeEventListener("mousedown", handleMouseDown);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [width, setWidth]);

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isOpen &&
        panelRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        !resizeHandleRef.current?.contains(event.target as Node)
      ) {
        const target = event.target as HTMLElement;
        if (target.closest("[data-inspector-trigger]")) {
          return;
        }
        closePanel();
      }
    };

    if (isOpen) {
      const timer = setTimeout(() => {
        document.addEventListener("mousedown", handleClickOutside);
      }, 100);

      return () => {
        clearTimeout(timer);
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isOpen, closePanel]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        closePanel();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closePanel]);

  // Handle file switching in inspector
  const handleFileChange = (fileId: string) => {
    const file = fileTabs.find((tab) => tab.id === fileId);
    if (file && file.fileName) {
      const appFile = useAppStore.getState().files.find((f) => f.id === fileId);
      const tableName = appFile?.tableName;

      if (tableName) {
        switchAnalysisTarget(fileId, tableName);
      } else {
        console.error("No table name found for file:", fileId);
      }
    }
  };

  // Handle export
  const handleExport = async () => {
    if (!activeFileId) return;

    try {
      await exportResults(activeFileId);
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  // Handle retry
  const handleRetry = () => {
    if (!activeFile || !activeFileId) return;

    resetError();
    const tableName = activeFile.tableName;

    if (tableName) {
      analyzeFile(activeFileId, tableName);
    } else {
      console.error("No table name found for retry");
    }
  };

  if (!isOpen) return null;

  return (
    <div className={cn("fixed inset-y-0 right-0 z-50", className)}>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm"
        onClick={closePanel}
      />

      {/* Panel - Now wider for charts */}
      <motion.div
        ref={panelRef}
        className="relative h-full bg-background/95 backdrop-blur-md border-l border-white/10 shadow-2xl flex"
        style={{
          width: `${Math.max(500, width)}px`, // Minimum 500px for charts
        }}
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
      >
        {/* Resize Handle */}
        <div
          ref={resizeHandleRef}
          className="absolute left-0 top-0 bottom-0 w-1 hover:bg-primary/50 cursor-col-resize transition-colors"
          style={{
            opacity: isResizing ? 1 : 0,
            transition: isResizing ? "none" : "opacity 0.2s ease",
          }}
        />

        {/* Panel Content */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-white">Date Inspector</h2>
            </div>
            <div className="flex items-center gap-2">
              {currentResults && (
                <button
                  onClick={handleExport}
                  className="p-2 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition-colors"
                  title="Export results to CSV"
                >
                  <Download className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={closePanel}
                className="p-2 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* File Selector */}
          {fileTabs.length > 1 && (
            <FileSelector
              currentFileId={activeFileId}
              onFileChange={handleFileChange}
            />
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {error ? (
              <ErrorState error={error} onRetry={handleRetry} />
            ) : isAnalyzing ? (
              <LoadingState
                progress={analysisProgress}
                status={analysisStatus}
              />
            ) : currentResults ? (
              <>
                {/* Quick Overview */}
                <QuickOverview metrics={currentResults} />

                {/* Column Search and Filter */}
                <ColumnSearch
                  searchTerm={searchTerm}
                  onSearchChange={setSearchTerm}
                  filterType={filterType}
                  onFilterChange={setFilterType}
                  totalColumns={currentResults.columnMetrics.length}
                  filteredCount={filteredColumns.length}
                />

                {/* Column List */}
                <div className="flex-1">
                  {filteredColumns.length > 0 ? (
                    filteredColumns.map((column) => (
                      <ColumnRow
                        key={column.name}
                        column={column}
                        metrics={currentResults}
                        isExpanded={expandedColumns.has(column.name)}
                        onToggle={() => toggleColumn(column.name)}
                        onGenerateQuery={handleGenerateQuery}
                      />
                    ))
                  ) : (
                    <div className="p-8 text-center">
                      <div className="text-sm text-white/70">
                        No columns match your filter
                      </div>
                      <div className="text-xs text-white/50 mt-1">
                        Try adjusting your search or filter
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <Info className="h-8 w-8 text-white/40" />
                <div className="text-center space-y-2">
                  <div className="text-sm font-medium text-white/70">
                    No Analysis Available
                  </div>
                  <div className="text-xs text-white/50">
                    Select a file to start data quality analysis
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default InspectorPanel;
