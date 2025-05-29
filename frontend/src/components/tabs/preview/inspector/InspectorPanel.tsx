import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Download,
  Hash,
  Type,
  Calendar,
  FileText,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Store imports
import { useInspectorStore, InspectorMetrics } from "@/store/inspectorStore";
import { useAppStore } from "@/store/appStore";
import {
  selectFileTabs,
  selectActiveFile,
} from "@/store/selectors/appSelectors";

import { useAutoAnalysis, QuickPreviewCard } from "./hooks/useAutoAnalysis";
import { LoadingState } from "./components/LoadingStates";
import {
  NoColumnsEmptyState,
  ErrorEmptyState,
} from "./components/EmptyStates";

import { MiniChart } from "./components/charts";
import { ColumnSearch, FilterType } from "./components/ColumnSearch";
import { useColumnFilter } from "./hooks/useColumnFilter";
import { useInitialQuery } from "@/hooks/query/useQueryInitialization";

interface InspectorPanelProps {
  className?: string;
}

const QuickOverview: React.FC<{ metrics: InspectorMetrics }> = ({
  metrics,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 border-b border-white/10"
    >
      <div className="grid grid-cols-3 gap-4 mb-4">
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="text-center p-3 bg-card/20 rounded-lg"
        >
          <div className="text-2xl font-bold text-white mb-1">
            {metrics.totalRows.toLocaleString()}
          </div>
          <div className="text-xs text-white/60">Rows</div>
        </motion.div>
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="text-center p-3 bg-card/20 rounded-lg"
        >
          <div className="text-2xl font-bold text-white mb-1">
            {metrics.totalColumns}
          </div>
          <div className="text-xs text-white/60">Columns</div>
        </motion.div>
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="text-center p-3 bg-card/20 rounded-lg"
        >
          <div className="text-2xl font-bold text-red-400 mb-1">
            {metrics.duplicateRows}
          </div>
          <div className="text-xs text-white/60">Duplicates</div>
        </motion.div>
      </div>

      {/* Top recommendations */}
      {/* {metrics.recommendations && metrics.recommendations.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-primary/5 border border-primary/20 rounded-lg p-3"
        >
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">Key Insights</span>
          </div>
          <div className="text-xs text-white/80">
            {metrics.recommendations[0]}
          </div>
          {metrics.recommendations.length > 1 && (
            <div className="text-xs text-white/60 mt-1">
              +{metrics.recommendations.length - 1} more recommendations
            </div>
          )}
        </motion.div>
      )} */}
    </motion.div>
  );
};

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
    const tableName = "table_name"; // You might want to get this from metrics
    const queries = [];

    // Smart query suggestions based on column characteristics
    if (column.uniqueCount <= 10 && column.uniqueCount > 1) {
      queries.push({
        query: `SELECT DISTINCT "${column.name}" FROM ${tableName} ORDER BY "${column.name}"`,
        description: `Show all ${column.uniqueCount} distinct values`,
      });
    }

    if (column.nullCount > 0) {
      queries.push({
        query: `SELECT * FROM ${tableName} WHERE "${column.name}" IS NOT NULL`,
        description: `Filter out ${column.nullCount} null values`,
      });
    }

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
    }

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
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className="border-b border-white/5"
    >
      <motion.button
        whileHover={{ backgroundColor: "rgba(255, 255, 255, 0.02)" }}
        onClick={onToggle}
        className="w-full p-3 transition-colors flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
          {getColumnIcon(column.type)}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-white truncate flex items-center gap-2">
              {column.name}
            </div>
            <div className="text-xs text-white/60">{column.type}</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-white font-mono">{getQuickStat()}</div>
            <div className="text-xs text-white/50">
              {column.uniqueCount} distinct
            </div>
          </div>
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 90 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronRight className="h-4 w-4 text-white/50 ml-2" />
        </motion.div>
      </motion.button>

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

              {/* TODO: Next phase */}
              {/* Suggested Queries */}
              {/*   <div className="mt-3">
                <div className="text-xs text-white/60 mb-2">
                  Suggested Queries
                </div>
                
              <div className="space-y-1 max-h-32 overflow-y-auto">
                  {generateSuggestedQueries().map((item, i) => (
                    <motion.button
                      key={i}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() =>
                        onGenerateQuery(item.query, item.description)
                      }
                      className="flex items-center gap-2 w-full p-2 bg-primary/5 hover:bg-primary/10 rounded text-xs text-left transition-colors"
                    >
                      <Play className="h-3 w-3 text-primary flex-shrink-0" />
                      <span className="text-white/80">{item.description}</span>
                    </motion.button>
                  ))}
                </div> 
              </div>
              */}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

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
      <motion.button
        whileHover={{ scale: 1.01 }}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 bg-card/30 hover:bg-card/50 rounded-lg border border-white/10 transition-colors"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <FileText className="h-4 w-4 text-white/60" />
          <span className="text-sm text-white truncate">
            {currentFile?.fileName || "Select file..."}
          </span>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-4 w-4 text-white/60" />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-4 right-4 mt-1 bg-card backdrop-blur-sm border border-white/20 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto"
          >
            {fileTabs.map((tab) => (
              <motion.button
                key={tab.id}
                whileHover={{ backgroundColor: "rgba(255, 255, 255, 0.1)" }}
                onClick={() => {
                  onFileChange(tab.id);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-2 p-3 text-left transition-colors cursor-pointer",
                  tab.id === currentFileId && "bg-primary/20 text-primary"
                )}
              >
                <FileText className="h-3 w-3 flex-shrink-0" />
                <span className="text-sm truncate">{tab.fileName}</span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const InspectorPanel: React.FC<InspectorPanelProps> = ({ className }) => {
  // Store states
  const {
    isOpen,
    width,
    setWidth,
    closePanel,
    activeFileId,
    results,
    error,
    switchAnalysisTarget,
    exportResults,
    resetError,
  } = useInspectorStore();

  const activeFile = useAppStore(selectActiveFile);
  const fileTabs = useAppStore(selectFileTabs);
  const { setActiveTab } = useAppStore();

  const { setQuery } = useInitialQuery();

  const {
    quickPreview,
    isGettingPreview,
    shouldShowPreview,
    isAnalyzing,
    analysisProgress,
    analysisStatus,
    manualTrigger,
  } = useAutoAnalysis({
    autoAnalysisDelay: 1000,
    autoOpenPanel: false,
    showQuickPreview: true,
  });

  // UI state
  const panelRef = useRef<HTMLDivElement>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [expandedColumns, setExpandedColumns] = useState<Set<string>>(
    new Set()
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [analysisStartTime] = useState(Date.now());

  // Get current analysis results
  const currentResults = activeFileId ? results.get(activeFileId) : null;

  // Filter columns
  const filteredColumns = useColumnFilter(
    currentResults?.columnMetrics || [],
    searchTerm,
    filterType
  );

  // Handlers
  const toggleColumn = (columnName: string) => {
    const newExpanded = new Set(expandedColumns);
    if (newExpanded.has(columnName)) {
      newExpanded.delete(columnName);
    } else {
      newExpanded.add(columnName);
    }
    setExpandedColumns(newExpanded);
  };

  const handleGenerateQuery = (query: string, description: string) => {
    navigator.clipboard.writeText(query);
    setActiveTab("query");
    setQuery(query);
    closePanel();
  };

  const handleFileChange = (fileId: string) => {
    const file = fileTabs.find((tab) => tab.id === fileId);
    if (file && file.fileName) {
      const appFile = useAppStore.getState().files.find((f) => f.id === fileId);
      const tableName = appFile?.tableName;

      if (tableName) {
        switchAnalysisTarget(fileId, tableName);
      }
    }
  };

  const handleExport = async () => {
    if (!activeFileId) return;
    try {
      await exportResults(activeFileId);
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  const handleRetry = () => {
    if (!activeFile || !activeFileId) return;
    resetError();
    manualTrigger();
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setFilterType("all");
  };

  // Reset search when results change
  useEffect(() => {
    setSearchTerm("");
    setFilterType("all");
    setExpandedColumns(new Set());
  }, [activeFileId]);

  // Resize handling (same as before)
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

  if (!isOpen) return null;

  return (
    <div className={cn("fixed inset-y-0 right-0 z-50", className)}>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/20 backdrop-blur-sm"
        onClick={closePanel}
      />

      {/* Panel */}
      <motion.div
        ref={panelRef}
        className="relative h-full bg-background/95 backdrop-blur-md border-l border-white/10 shadow-2xl flex"
        style={{ width: `${Math.max(500, width)}px` }}
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
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between p-4 border-b border-white/10"
          >
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-white">
                Data Inspector
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {/* TODO: To be revisited if this is needed? */}
              {/* {currentResults && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleExport}
                  className="p-2 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition-colors"
                  title="Export results to CSV"
                >
                  <Download className="h-4 w-4" />
                </motion.button>
              )} */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={closePanel}
                className="p-2 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </motion.button>
            </div>
          </motion.div>

          {/* File Selector */}
          {fileTabs.length > 1 && (
            <FileSelector
              currentFileId={activeFileId}
              onFileChange={handleFileChange}
            />
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Error State */}
            {error && !isAnalyzing && (
              <ErrorEmptyState
                error={error}
                onRetry={handleRetry}
                onReset={resetError}
              />
            )}

            {/* Loading State */}
            {isAnalyzing && (
              <LoadingState
                progress={analysisProgress}
                status={analysisStatus}
                startTime={analysisStartTime}
                preview={quickPreview}
                estimatedTimeLeft={0} // Could calculate this based on progress
              />
            )}

            {/* Quick Preview (while getting preview or analyzing) */}
            {shouldShowPreview && quickPreview && !currentResults && !error && (
              <div className="p-4">
                <QuickPreviewCard
                  preview={quickPreview}
                  isAnalyzing={isAnalyzing || isGettingPreview}
                />
              </div>
            )}

            {/* Analysis Results */}
            {currentResults && !isAnalyzing && !error && (
              <>
                <QuickOverview metrics={currentResults} />
                <ColumnSearch
                  searchTerm={searchTerm}
                  onSearchChange={setSearchTerm}
                  filterType={filterType}
                  onFilterChange={setFilterType}
                  totalColumns={currentResults.columnMetrics.length}
                  filteredCount={filteredColumns.length}
                />

                <div className="flex-1">
                  {filteredColumns.length > 0 ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      {filteredColumns.map((column, index) => (
                        <motion.div
                          key={column.name}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                        >
                          <ColumnRow
                            column={column}
                            metrics={currentResults}
                            isExpanded={expandedColumns.has(column.name)}
                            onToggle={() => toggleColumn(column.name)}
                            onGenerateQuery={handleGenerateQuery}
                          />
                        </motion.div>
                      ))}
                    </motion.div>
                  ) : (
                    <NoColumnsEmptyState
                      searchTerm={searchTerm}
                      filterType={filterType}
                      onClearFilters={handleClearFilters}
                      totalColumns={currentResults.columnMetrics.length}
                    />
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default InspectorPanel;
