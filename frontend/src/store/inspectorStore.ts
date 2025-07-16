import { create } from "zustand";
import { useDuckDBStore } from "./duckDBStore";

import {
  getBasicColumnStats,
  getDuplicateRowInfo,
  validateTable,
  analyzeColumn,
  performQualityAssessment,
  debugHistogramGeneration,
  type CompleteColumnAnalysis,
  type HistogramBin,
  type NumericStats,
  type TextStats,
  type FrequentValue,
  type TypeIssue,
  type HealthScore
} from "@/lib/duckdb/inspector/inspector";

/**
 * Column-level analysis metrics (updated to use new structure)
 */
export interface ColumnMetrics {
  /** Column name */
  name: string;
  /** Data type from schema */
  type: string;
  /** Number of null values */
  nullCount: number;
  /** Percentage of null values */
  nullPercentage: number;
  /** Number of unique values */
  uniqueCount: number;
  /** Cardinality ratio (unique/total) */
  cardinality: number;
  /** Numeric statistics (if applicable) */
  numericStats?: NumericStats;
  /** Text statistics (if applicable) */
  textStats?: TextStats;
  /** Histogram data for visualization */
  histogramData?: HistogramBin[];
}

/**
 * Complete data quality analysis results
 */
export interface InspectorMetrics {
  /** Overall health score (0-100) */
  healthScore: number;
  /** Breakdown of health components */
  healthBreakdown: {
    completeness: number;
    uniqueness: number;
    consistency: number;
  };
  /** Total number of rows */
  totalRows: number;
  /** Total number of columns */
  totalColumns: number;
  /** Number of duplicate rows */
  duplicateRows: number;
  /** Percentage of duplicate rows */
  duplicatePercentage: number;
  /** Column-level analysis results */
  columnMetrics: ColumnMetrics[];
  /** Detected data type issues */
  typeIssues: TypeIssue[];
  /** Frequent values per column for categorical analysis */
  frequentValues: {
    column: string;
    values: FrequentValue[];
  }[];
  /** Quality recommendations */
  recommendations: string[];
  /** Analysis timestamp */
  analysisTimestamp: number;
  /** Analysis execution time in milliseconds */
  analysisTimeMs: number;
}

/**
 * Inspector store state interface
 */
interface InspectorState {
  // Panel UI state
  isOpen: boolean;
  width: number;

  // Analysis state
  isAnalyzing: boolean;
  analysisProgress: number;
  analysisStatus: string;

  // Current analysis target
  activeFileId: string | null;
  activeTableName: string | null;

  // Results cache
  results: Map<string, InspectorMetrics>;

  // Error handling
  error: string | null;

  // Panel actions
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  setWidth: (width: number) => void;

  // Analysis actions
  analyzeFile: (fileId: string, tableName: string) => Promise<void>;
  switchAnalysisTarget: (fileId: string, tableName: string) => void;
  clearResults: (fileId?: string) => void;
  cancelAnalysis: () => void;

  // Export actions
  exportResults: (fileId: string) => Promise<void>;

  // Utility actions
  resetError: () => void;
  getResultsForFile: (fileId: string) => InspectorMetrics | null;
  
  // Data retrieval actions
  fetchDuplicateRows: (fileId: string, limit?: number) => Promise<any[]>;
  fetchNullRows: (fileId: string, columnName: string, limit?: number) => Promise<any[]>;
  fetchOutlierRows: (fileId: string, columnName: string, limit?: number) => Promise<any[]>;
  fetchTypeIssueRows: (fileId: string, columnName: string, limit?: number) => Promise<any[]>;
}

// Panel configuration
const INITIAL_PANEL_WIDTH = 800;
const MIN_PANEL_WIDTH = 600;
const MAX_PANEL_WIDTH = 1200;

// Analysis cancellation
let analysisAbortController: AbortController | null = null;

/**
 * Load/save panel state
 */
function getInitialPanelState() {
  try {
    const saved = localStorage.getItem('inspector-panel-state');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        isOpen: false,
        width: Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, parsed.width || INITIAL_PANEL_WIDTH)),
      };
    }
  } catch (error) {
    console.warn('[Inspector] Failed to load panel state:', error);
  }
  return { isOpen: false, width: INITIAL_PANEL_WIDTH };
}

function savePanelState(width: number) {
  try {
    const currentState = JSON.parse(localStorage.getItem('inspector-panel-state') || '{}');
    localStorage.setItem('inspector-panel-state', JSON.stringify({
      ...currentState,
      width
    }));
  } catch (error) {
    console.warn('[Inspector] Failed to save panel state:', error);
  }
}

/**
 * Create the Inspector store
 */
export const useInspectorStore = create<InspectorState>((set, get) => {
  const initialState = getInitialPanelState();
  
  return {
    // Initial state
    isOpen: initialState.isOpen,
    width: initialState.width,
    isAnalyzing: false,
    analysisProgress: 0,
    analysisStatus: "",
    activeFileId: null,
    activeTableName: null,
    results: new Map(),
    error: null,

    // Panel actions
    openPanel: () => set({ isOpen: true }),
    closePanel: () => {
      set({ isOpen: false });
      if (analysisAbortController) {
        analysisAbortController.abort();
      }
    },
    togglePanel: () => {
      const { isOpen } = get();
      set({ isOpen: !isOpen });
      if (isOpen && analysisAbortController) {
        analysisAbortController.abort();
      }
    },
    setWidth: (width: number) => {
      const constrainedWidth = Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, width));
      set({ width: constrainedWidth });
      savePanelState(constrainedWidth);
    },

    // Main analysis function (completely rewritten to use new utilities)
    analyzeFile: async (fileId: string, tableName: string) => {
      const state = get();

      // Check if results already exist
      if (state.results.has(fileId)) {
        console.log(`[Inspector] Results already exist for ${fileId}`);
        set({ activeFileId: fileId, activeTableName: tableName });
        return;
      }

      // Setup analysis
      analysisAbortController = new AbortController();
      const startTime = Date.now();

      set({
        isAnalyzing: true,
        analysisProgress: 0,
        analysisStatus: "Initializing analysis...",
        activeFileId: fileId,
        activeTableName: tableName,
        error: null,
      });

      try {
        const duckDBStore = useDuckDBStore.getState();

        if (!duckDBStore.connection || !duckDBStore.isInitialized) {
          throw new Error("DuckDB is not initialized");
        }

        // Get escaped table name
        const escapedTableName = duckDBStore.registeredTables.get(tableName);
        if (!escapedTableName) {
          const availableTables = Array.from(duckDBStore.registeredTables.keys());
          throw new Error(`Table "${tableName}" not found. Available: ${availableTables.join(", ")}`);
        }

        console.log(`[Inspector] Starting analysis for ${fileId}/${tableName}`);

        // Debug test in development
        if (process.env.NODE_ENV === 'development') {
          try {
            const schema = await duckDBStore.getTableSchema(tableName);
            if (schema && schema.length > 0) {
              const debugInfo = await debugHistogramGeneration(
                duckDBStore.connection, 
                escapedTableName, 
                schema[0].name
              );
              console.log(`[Inspector] Debug test result:`, debugInfo);
            }
          } catch (debugError) {
            console.warn(`[Inspector] Debug test failed:`, debugError);
          }
        }

        // Step 1: Validate table (5%)
        set({ analysisProgress: 5, analysisStatus: "Validating table..." });
        
        const validation = await validateTable(duckDBStore.connection, escapedTableName);
        if (!validation.exists || !validation.hasData) {
          throw new Error(validation.error || "Table is empty or doesn't exist");
        }

        const totalRows = validation.rowCount;

        // Step 2: Get table schema (10%)
        set({ analysisProgress: 10, analysisStatus: "Getting table schema..." });
        
        const schema = await duckDBStore.getTableSchema(tableName);
        if (!schema || schema.length === 0) {
          throw new Error("Could not retrieve table schema");
        }

        const totalColumns = schema.length;
        console.log(`[Inspector] Analyzing ${totalColumns} columns, ${totalRows} rows`);

        // Step 3: Get duplicate row information (20%)
        set({ analysisProgress: 20, analysisStatus: "Checking for duplicates..." });
        
        const duplicateInfo = await getDuplicateRowInfo(duckDBStore.connection, escapedTableName);

        // Step 4: Analyze each column (20-80%)
        const columnAnalyses: CompleteColumnAnalysis[] = [];
        const allFrequentValues: { column: string; values: FrequentValue[] }[] = [];

        for (let i = 0; i < schema.length; i++) {
          const column = schema[i];
          const progress = 20 + (i / schema.length) * 60; // 20-80%
          
          set({
            analysisProgress: progress,
            analysisStatus: `Analyzing column: ${column.name} (${i + 1}/${schema.length})...`,
          });

          // Check for cancellation
          if (analysisAbortController?.signal.aborted) {
            throw new Error("Analysis was cancelled");
          }

          try {
            console.log(`[Inspector] Analyzing column ${column.name} (${column.type})`);
            
            const columnAnalysis = await analyzeColumn(
              duckDBStore.connection,
              escapedTableName,
              column.name,
              column.type,
              totalRows
            );
            
            columnAnalyses.push(columnAnalysis);

            // Collect frequent values for the final result
            if (columnAnalysis.frequent && columnAnalysis.frequent.length > 0) {
              allFrequentValues.push({
                column: column.name,
                values: columnAnalysis.frequent
              });
            }

            console.log(`[Inspector] Completed column ${column.name}`);

          } catch (columnError) {
            console.error(`[Inspector] Error analyzing ${column.name}:`, columnError);
            
            // Add minimal analysis on error
            columnAnalyses.push({
              basic: {
                name: column.name,
                type: column.type,
                totalRows,
                nullCount: 0,
                nullPercentage: 0,
                uniqueCount: 0,
                cardinality: 0
              },
              typeIssues: [{
                column: column.name,
                issue: 'Column analysis failed',
                count: 1,
                examples: [columnError instanceof Error ? columnError.message : String(columnError)],
                severity: 'high'
              }]
            });
          }
        }

        // Check for cancellation
        if (analysisAbortController?.signal.aborted) {
          throw new Error("Analysis was cancelled");
        }

        // Step 5: Perform quality assessment (85%)
        set({ analysisProgress: 85, analysisStatus: "Calculating quality scores..." });
        
        const basicColumnStats = columnAnalyses.map(analysis => analysis.basic);
        const allTypeIssues = columnAnalyses.flatMap(analysis => analysis.typeIssues);
        
        const qualityAssessment = await performQualityAssessment(
          duckDBStore.connection,
          escapedTableName,
          basicColumnStats,
          duplicateInfo.duplicateRows
        );

        // Step 6: Build final results (95%)
        set({ analysisProgress: 95, analysisStatus: "Finalizing results..." });

        // Convert column analyses to the expected format
        const columnMetrics: ColumnMetrics[] = columnAnalyses.map(analysis => ({
          name: analysis.basic.name,
          type: analysis.basic.type,
          nullCount: analysis.basic.nullCount,
          nullPercentage: analysis.basic.nullPercentage,
          uniqueCount: analysis.basic.uniqueCount,
          cardinality: analysis.basic.cardinality,
          numericStats: analysis.numeric,
          textStats: analysis.text,
          histogramData: analysis.histogram
        }));

        const analysisTimeMs = Date.now() - startTime;
        const metrics: InspectorMetrics = {
          healthScore: qualityAssessment.healthScore.healthScore,
          healthBreakdown: qualityAssessment.healthScore.healthBreakdown,
          totalRows,
          totalColumns,
          duplicateRows: duplicateInfo.duplicateRows,
          duplicatePercentage: duplicateInfo.duplicatePercentage,
          columnMetrics,
          typeIssues: qualityAssessment.typeIssues,
          frequentValues: allFrequentValues,
          recommendations: qualityAssessment.recommendations,
          analysisTimestamp: Date.now(),
          analysisTimeMs
        };

        // Store results
        const newResults = new Map(state.results);
        newResults.set(fileId, metrics);

        set({
          results: newResults,
          isAnalyzing: false,
          analysisProgress: 100,
          analysisStatus: `Analysis complete in ${(analysisTimeMs / 1000).toFixed(1)}s`,
        });

        console.log(`[Inspector] Analysis completed successfully`);
        console.log(`[Inspector] Health score: ${metrics.healthScore}%`);
        console.log(`[Inspector] Found ${metrics.typeIssues.length} type issues`);
        console.log(`[Inspector] Generated ${metrics.recommendations.length} recommendations`);

        // Clear status after delay
        setTimeout(() => {
          if (!get().isAnalyzing) {
            set({ analysisStatus: "", analysisProgress: 0 });
          }
        }, 3000);

      } catch (error) {
        console.error("[Inspector] Analysis failed:", error);
        
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isCancelled = errorMessage.includes("cancelled") || errorMessage.includes("aborted");
        
        set({
          error: isCancelled ? null : `Analysis failed: ${errorMessage}`,
          isAnalyzing: false,
          analysisProgress: 0,
          analysisStatus: isCancelled ? "" : "Analysis failed",
        });

        if (!isCancelled) {
          setTimeout(() => {
            if (!get().isAnalyzing) {
              set({ error: null, analysisStatus: "" });
            }
          }, 5000);
        }
      } finally {
        analysisAbortController = null;
      }
    },

    // Remaining methods stay the same
    switchAnalysisTarget: (fileId: string, tableName: string) => {
      set({ activeFileId: fileId, activeTableName: tableName });
      if (!get().results.has(fileId)) {
        get().analyzeFile(fileId, tableName);
      }
    },

    cancelAnalysis: () => {
      if (analysisAbortController) {
        analysisAbortController.abort();
      }
      set({
        isAnalyzing: false,
        analysisProgress: 0,
        analysisStatus: "Analysis cancelled",
        error: null
      });
      setTimeout(() => set({ analysisStatus: "" }), 2000);
    },

    clearResults: (fileId?: string) => {
      if (fileId) {
        const newResults = new Map(get().results);
        newResults.delete(fileId);
        set({ results: newResults });
      } else {
        set({ results: new Map() });
      }
    },

    exportResults: async (fileId: string) => {
      const results = get().results.get(fileId);
      if (!results) {
        throw new Error("No analysis results found");
      }

      const csvData: string[][] = [
        ["Category", "Metric", "Value", "Details"]
      ];

      // Health metrics
      csvData.push(["Health", "Overall Score", results.healthScore.toString(), "0-100 scale"]);
      csvData.push(["Health", "Completeness", results.healthBreakdown.completeness.toString(), ""]);
      csvData.push(["Health", "Uniqueness", results.healthBreakdown.uniqueness.toString(), ""]);
      csvData.push(["Health", "Consistency", results.healthBreakdown.consistency.toString(), ""]);

      // Basic metrics
      csvData.push(["Basic", "Total Rows", results.totalRows.toString(), ""]);
      csvData.push(["Basic", "Total Columns", results.totalColumns.toString(), ""]);
      csvData.push(["Basic", "Duplicate Rows", results.duplicateRows.toString(), ""]);

      // Column metrics
      results.columnMetrics.forEach(col => {
        csvData.push(["Column", col.name, "Null %", col.nullPercentage.toFixed(2)]);
        csvData.push(["Column", col.name, "Unique Count", col.uniqueCount.toString()]);
        csvData.push(["Column", col.name, "Cardinality", col.cardinality.toFixed(4)]);
      });

      // Recommendations
      results.recommendations.forEach((rec, i) => {
        csvData.push(["Recommendation", `${i + 1}`, rec, ""]);
      });

      const csvString = csvData
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\n");

      const blob = new Blob([csvString], { type: "text/csv" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      
      const timestamp = new Date().toISOString().split("T")[0];
      const filename = `data-inspector-${fileId}-${timestamp}.csv`;
      
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log(`[Inspector] Results exported to ${filename}`);
    },

    resetError: () => set({ error: null }),
    
    getResultsForFile: (fileId: string) => get().results.get(fileId) || null,

    // Data retrieval functions
    fetchDuplicateRows: async (fileId: string, limit = 100) => {
      const state = get();
      if (!state.activeTableName) {
        throw new Error("No active table");
      }

      const duckDBStore = useDuckDBStore.getState();
      const escapedTableName = duckDBStore.registeredTables.get(state.activeTableName);
      if (!escapedTableName) {
        throw new Error(`Table "${state.activeTableName}" not found`);
      }

      // Get duplicate rows using DuckDB window functions
      const query = `
        WITH duplicate_finder AS (
          SELECT *, ROW_NUMBER() OVER (PARTITION BY ${
            // Get all column names to create a proper duplicate check
            (await duckDBStore.getTableSchema(state.activeTableName))
              ?.map(col => `"${col.name}"`)
              .join(', ') || '*'
          }) as rn
          FROM ${escapedTableName}
        )
        SELECT *
        FROM duplicate_finder
        WHERE rn > 1
        ORDER BY rn
        LIMIT ${limit}
      `;

      const result = await duckDBStore.executePaginatedQuery(query, 1, limit, false, false);
      return result?.data || [];
    },

    fetchNullRows: async (fileId: string, columnName: string, limit = 100) => {
      const state = get();
      if (!state.activeTableName) {
        throw new Error("No active table");
      }

      const duckDBStore = useDuckDBStore.getState();
      const escapedTableName = duckDBStore.registeredTables.get(state.activeTableName);
      if (!escapedTableName) {
        throw new Error(`Table "${state.activeTableName}" not found`);
      }

      const query = `
        SELECT *
        FROM ${escapedTableName}
        WHERE "${columnName}" IS NULL
        LIMIT ${limit}
      `;

      const result = await duckDBStore.executePaginatedQuery(query, 1, limit, false, false);
      return result?.data || [];
    },

    fetchOutlierRows: async (fileId: string, columnName: string, limit = 100) => {
      const state = get();
      if (!state.activeTableName) {
        throw new Error("No active table");
      }

      const duckDBStore = useDuckDBStore.getState();
      const escapedTableName = duckDBStore.registeredTables.get(state.activeTableName);
      if (!escapedTableName) {
        throw new Error(`Table "${state.activeTableName}" not found`);
      }

      // Get column statistics from current results
      const currentResults = state.results.get(fileId);
      const columnMetrics = currentResults?.columnMetrics.find(col => col.name === columnName);
      
      if (!columnMetrics?.numericStats) {
        throw new Error(`Column "${columnName}" is not numeric or has no statistics`);
      }

      const { mean, std } = columnMetrics.numericStats;
      const outlierThreshold = mean + 2 * std;

      const query = `
        SELECT *
        FROM ${escapedTableName}
        WHERE "${columnName}" > ${outlierThreshold} OR "${columnName}" < ${mean - 2 * std}
        ORDER BY ABS("${columnName}" - ${mean}) DESC
        LIMIT ${limit}
      `;

      const result = await duckDBStore.executePaginatedQuery(query, 1, limit, false, false);
      return result?.data || [];
    },

    fetchTypeIssueRows: async (fileId: string, columnName: string, limit = 100) => {
      const state = get();
      if (!state.activeTableName) {
        throw new Error("No active table");
      }

      const duckDBStore = useDuckDBStore.getState();
      const escapedTableName = duckDBStore.registeredTables.get(state.activeTableName);
      if (!escapedTableName) {
        throw new Error(`Table "${state.activeTableName}" not found`);
      }

      // Get type issues from current results
      const currentResults = state.results.get(fileId);
      const typeIssues = currentResults?.typeIssues.filter(issue => issue.column === columnName) || [];
      
      if (typeIssues.length === 0) {
        return [];
      }

      // For demonstration, we'll show rows with potential type issues
      // This is a simplified approach - in reality, you might want more sophisticated detection
      const query = `
        SELECT *
        FROM ${escapedTableName}
        WHERE "${columnName}" IS NOT NULL
        AND TRY_CAST("${columnName}" AS DOUBLE) IS NULL
        AND "${columnName}" != ''
        LIMIT ${limit}
      `;

      const result = await duckDBStore.executePaginatedQuery(query, 1, limit, false, false);
      return result?.data || [];
    },
  };
});