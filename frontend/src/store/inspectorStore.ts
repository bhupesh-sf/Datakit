import { create } from "zustand";
import { useDuckDBStore } from "./duckDBStore";

export interface InspectorMetrics {
  // Health Score Components
  healthScore: number;
  healthBreakdown: {
    completeness: number; // 0-100 based on missing data %
    uniqueness: number; // 0-100 based on duplicate rows %
    consistency: number; // 0-100 based on data type issues %
  };

  // Data Quality Metrics
  totalRows: number;
  totalColumns: number;
  duplicateRows: number;
  duplicatePercentage: number;

  // Column-level Analysis
  columnMetrics: {
    name: string;
    type: string;
    nullCount: number;
    nullPercentage: number;
    uniqueCount: number;
    cardinality: number; // unique/total ratio

    // Type-specific metrics
    numericStats?: {
      min: number;
      max: number;
      mean: number;
      median: number;
      std: number;
      outliers: number;
    };

    textStats?: {
      avgLength: number;
      minLength: number;
      maxLength: number;
      emptyStrings: number;
    };

    dateStats?: {
      minDate: string;
      maxDate: string;
      invalidDates: number;
    };

    // Histogram data for charts
    histogramData?: {
      bin: string;
      count: number;
      range: string;
    }[];
  }[];

  // Data Type Issues
  typeIssues: {
    column: string;
    issue: string;
    count: number;
    examples: string[];
  }[];

  // Top frequent values per column (for categorical analysis)
  frequentValues: {
    column: string;
    values: { value: string; count: number; percentage: number }[];
  }[];
}

interface InspectorState {
  // Panel UI state - managed here since it's inspector-specific
  isOpen: boolean;
  width: number;

  // Analysis state
  isAnalyzing: boolean;
  analysisProgress: number;
  analysisStatus: string;

  // Current analysis target
  activeFileId: string | null;
  activeTableName: string | null;

  // Cached results per file
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

  // Export actions
  exportResults: (fileId: string) => Promise<void>;

  // Utility
  resetError: () => void;
}

const INITIAL_PANEL_WIDTH = 550; // Wider for charts
const MIN_PANEL_WIDTH = 500; // Minimum for charts
const MAX_PANEL_WIDTH = 800;

// Health score calculation weights
const HEALTH_WEIGHTS = {
  completeness: 0.4, // 40% - missing data is critical
  uniqueness: 0.3, // 30% - duplicates matter
  consistency: 0.3, // 30% - data type issues
};

const calculateHealthScore = (metrics: Partial<InspectorMetrics>): number => {
  if (!metrics.columnMetrics || metrics.totalRows === 0) return 0;

  // Completeness: average non-null percentage across columns
  const avgCompleteness =
    metrics.columnMetrics.reduce(
      (sum, col) => sum + (100 - col.nullPercentage),
      0
    ) / metrics.columnMetrics.length;

  // Uniqueness: inverse of duplicate percentage
  const uniqueness = 100 - (metrics.duplicatePercentage || 0);

  // Consistency: based on type issues (simplified for now)
  const consistency = Math.max(0, 100 - (metrics.typeIssues?.length || 0) * 10);

  const weightedScore =
    avgCompleteness * HEALTH_WEIGHTS.completeness +
    uniqueness * HEALTH_WEIGHTS.uniqueness +
    consistency * HEALTH_WEIGHTS.consistency;

  return Math.round(Math.max(0, Math.min(100, weightedScore)));
};

// Load initial panel state from localStorage
const getInitialPanelState = () => {
  try {
    const saved = localStorage.getItem("inspector-panel-state");
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        isOpen: false, // Always start closed
        width: Math.max(
          MIN_PANEL_WIDTH,
          Math.min(MAX_PANEL_WIDTH, parsed.width || INITIAL_PANEL_WIDTH)
        ),
      };
    }
  } catch (error) {
    console.warn(
      "Failed to load inspector panel state from localStorage:",
      error
    );
  }
  return { isOpen: false, width: INITIAL_PANEL_WIDTH };
};

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
    openPanel: () => {
      set({ isOpen: true });
    },

    closePanel: () => {
      set({ isOpen: false });
    },

    togglePanel: () => {
      set((state) => ({ isOpen: !state.isOpen }));
    },

    setWidth: (width: number) => {
      const constrainedWidth = Math.max(
        MIN_PANEL_WIDTH,
        Math.min(MAX_PANEL_WIDTH, width)
      );
      set({ width: constrainedWidth });

      // Persist width to localStorage
      try {
        const currentState = JSON.parse(
          localStorage.getItem("inspector-panel-state") || "{}"
        );
        localStorage.setItem(
          "inspector-panel-state",
          JSON.stringify({
            ...currentState,
            width: constrainedWidth,
          })
        );
      } catch (error) {
        console.warn("Failed to save panel width to localStorage:", error);
      }
    },

    // Analysis actions
    analyzeFile: async (fileId: string, tableName: string) => {
      const state = get();

      // Check if we already have results for this file
      if (state.results.has(fileId)) {
        set({
          activeFileId: fileId,
          activeTableName: tableName,
        });
        return;
      }

      set({
        isAnalyzing: true,
        analysisProgress: 0,
        analysisStatus: "Starting analysis...",
        activeFileId: fileId,
        activeTableName: tableName,
        error: null,
      });

      try {
        const duckDBStore = useDuckDBStore.getState();

        if (!duckDBStore.connection || !duckDBStore.isInitialized) {
          throw new Error("DuckDB is not initialized");
        }

        // Debug: Log available tables
        const availableTables = Array.from(duckDBStore.registeredTables.keys());
        console.log("[Inspector] Available tables:", availableTables);
        console.log("[Inspector] Looking for table:", tableName);

        const escapedTableName = duckDBStore.registeredTables.get(tableName);
        if (!escapedTableName) {
          throw new Error(
            `Table "${tableName}" not found in registered tables. Available tables: ${availableTables.join(
              ", "
            )}`
          );
        }

        console.log("[Inspector] Using escaped table name:", escapedTableName);

        // Step 1: Basic table info
        set({
          analysisProgress: 10,
          analysisStatus: "Getting table information...",
        });

        const tableInfoQuery = `SELECT COUNT(*) as total_rows FROM ${escapedTableName}`;
        const tableInfoResult = await duckDBStore.connection.query(
          tableInfoQuery
        );
        const totalRows = Number(tableInfoResult.toArray()[0].total_rows);

        // Step 2: Get column information
        set({ analysisProgress: 20, analysisStatus: "Analyzing columns..." });

        const schema = await duckDBStore.getTableSchema(tableName);
        if (!schema) {
          throw new Error("Could not get table schema");
        }

        const totalColumns = schema.length;

        // Step 3: Check for duplicates
        set({
          analysisProgress: 30,
          analysisStatus: "Checking for duplicates...",
        });

        const duplicateQuery = `
          WITH row_counts AS (
            SELECT COUNT(*) as total_count FROM ${escapedTableName}
          ),
          unique_counts AS (
            SELECT COUNT(*) as unique_count 
            FROM (SELECT DISTINCT * FROM ${escapedTableName}) t
          )
          SELECT rc.total_count, uc.unique_count
          FROM row_counts rc, unique_counts uc
        `;
        const duplicateResult = await duckDBStore.connection.query(
          duplicateQuery
        );
        const duplicateData = duplicateResult.toArray()[0];
        const duplicateRows =
          Number(duplicateData.total_count) -
          Number(duplicateData.unique_count);
        const duplicatePercentage =
          totalRows > 0 ? (duplicateRows / totalRows) * 100 : 0;

        // Step 4: Analyze each column
        set({
          analysisProgress: 40,
          analysisStatus: "Analyzing individual columns...",
        });

        const columnMetrics = [];

        for (let i = 0; i < schema.length; i++) {
          const column = schema[i];
          const progress = 40 + (i / schema.length) * 40; // 40-80%
          set({
            analysisProgress: progress,
            analysisStatus: `Analyzing column: ${column.name}...`,
          });

          try {
            // Basic null analysis
            const nullQuery = `
              SELECT 
                COUNT(*) as total_count,
                COUNT("${column.name}") as non_null_count,
                COUNT(DISTINCT "${column.name}") as unique_count
              FROM ${escapedTableName}
            `;

            const nullResult = await duckDBStore.connection.query(nullQuery);
            const nullData = nullResult.toArray()[0];

            const nullCount =
              Number(nullData.total_count) - Number(nullData.non_null_count);
            const nullPercentage =
              totalRows > 0 ? (nullCount / totalRows) * 100 : 0;
            const uniqueCount = Number(nullData.unique_count);
            const cardinality = totalRows > 0 ? uniqueCount / totalRows : 0;

            const columnMetric = {
              name: column.name,
              type: column.type,
              nullCount,
              nullPercentage,
              uniqueCount,
              cardinality,
            };

            // Type-specific analysis
            const columnType = column.type.toLowerCase();

            if (
              columnType.includes("int") ||
              columnType.includes("double") ||
              columnType.includes("numeric")
            ) {
              // Numeric analysis with histogram
              try {
                const statsQuery = `
                  SELECT 
                    MIN("${column.name}") as min_val,
                    MAX("${column.name}") as max_val,
                    AVG("${column.name}") as mean_val,
                    MEDIAN("${column.name}") as median_val,
                    STDDEV("${column.name}") as std_val
                  FROM ${escapedTableName}
                  WHERE "${column.name}" IS NOT NULL
                `;

                const statsResult = await duckDBStore.connection.query(
                  statsQuery
                );
                const stats = statsResult.toArray()[0];

                if (stats && stats.min_val !== null) {
                  const min = Number(stats.min_val);
                  const max = Number(stats.max_val);
                  const mean = Number(stats.mean_val) || 0;
                  const median = Number(stats.median_val) || 0;
                  const std = Number(stats.std_val) || 0;

                  columnMetric.numericStats = {
                    min,
                    max,
                    mean,
                    median,
                    std,
                    outliers: 0, // TODO: Calculate outliers using IQR method
                  };

                  // Generate histogram data using DuckDB width_bucket
                  const binCount = 8;
                  const histogramQuery = `
                    WITH bins AS (
                      SELECT 
                        width_bucket("${
                          column.name
                        }", ${min}, ${max}, ${binCount}) as bin_num,
                        COUNT(*) as count
                      FROM ${escapedTableName}
                      WHERE "${column.name}" IS NOT NULL
                      GROUP BY bin_num
                      ORDER BY bin_num
                    ),
                    bin_ranges AS (
                      SELECT 
                        bin_num,
                        count,
                        ROUND(${min} + (bin_num - 1) * (${
                    max - min
                  }) / ${binCount}, 2) as bin_start,
                        ROUND(${min} + bin_num * (${
                    max - min
                  }) / ${binCount}, 2) as bin_end
                      FROM bins
                    )
                    SELECT 
                      bin_num,
                      count,
                      bin_start || '-' || bin_end as range,
                      'Bin ' || bin_num as bin
                    FROM bin_ranges
                    ORDER BY bin_num
                  `;

                  try {
                    const histogramResult = await duckDBStore.connection.query(
                      histogramQuery
                    );
                    const histogramData = histogramResult
                      .toArray()
                      .map((row) => ({
                        bin: String(row.bin),
                        count: Number(row.count),
                        range: String(row.range),
                      }));
                    columnMetric.histogramData = histogramData;
                  } catch (histErr) {
                    console.warn(
                      `Could not generate histogram for ${column.name}:`,
                      histErr
                    );
                  }
                }
              } catch (statsErr) {
                console.warn(
                  `Could not get numeric stats for ${column.name}:`,
                  statsErr
                );
              }
            } else if (
              columnType.includes("varchar") ||
              columnType.includes("text")
            ) {
              // Text analysis
              try {
                const textQuery = `
                  SELECT 
                    AVG(LENGTH("${column.name}")) as avg_length,
                    MIN(LENGTH("${column.name}")) as min_length,
                    MAX(LENGTH("${column.name}")) as max_length,
                    COUNT(CASE WHEN "${column.name}" = '' THEN 1 END) as empty_strings
                  FROM ${escapedTableName}
                  WHERE "${column.name}" IS NOT NULL
                `;

                const textResult = await duckDBStore.connection.query(
                  textQuery
                );
                const textStats = textResult.toArray()[0];

                if (textStats) {
                  columnMetric.textStats = {
                    avgLength: Number(textStats.avg_length) || 0,
                    minLength: Number(textStats.min_length) || 0,
                    maxLength: Number(textStats.max_length) || 0,
                    emptyStrings: Number(textStats.empty_strings) || 0,
                  };
                }
              } catch (textErr) {
                console.warn(
                  `Could not get text stats for ${column.name}:`,
                  textErr
                );
              }
            }

            columnMetrics.push(columnMetric);
          } catch (columnErr) {
            console.error(`Error analyzing column ${column.name}:`, columnErr);
            // Add basic metric even if detailed analysis fails
            columnMetrics.push({
              name: column.name,
              type: column.type,
              nullCount: 0,
              nullPercentage: 0,
              uniqueCount: 0,
              cardinality: 0,
            });
          }
        }

        // Step 5: Get frequent values for categorical columns
        set({
          analysisProgress: 85,
          analysisStatus: "Analyzing frequent values...",
        });

        const frequentValues = [];
        for (const column of schema.slice(0, 5)) {
          // Limit to first 5 columns for performance
          try {
            const freqQuery = `
              SELECT "${column.name}" as value, 
                     COUNT(*) as count,
                     (COUNT(*) * 100.0 / ${totalRows}) as percentage
              FROM ${escapedTableName}
              WHERE "${column.name}" IS NOT NULL
              GROUP BY "${column.name}"
              ORDER BY count DESC
              LIMIT 10
            `;

            const freqResult = await duckDBStore.connection.query(freqQuery);
            const values = freqResult.toArray().map((row) => ({
              value: String(row.value),
              count: Number(row.count),
              percentage: Number(row.percentage),
            }));

            frequentValues.push({
              column: column.name,
              values,
            });
          } catch (freqErr) {
            console.warn(
              `Could not get frequent values for ${column.name}:`,
              freqErr
            );
          }
        }

        // Step 6: Build final metrics
        set({ analysisProgress: 95, analysisStatus: "Finalizing analysis..." });

        const metrics: InspectorMetrics = {
          healthScore: 0, // Will be calculated below
          healthBreakdown: {
            completeness: 0,
            uniqueness: 0,
            consistency: 0,
          },
          totalRows,
          totalColumns,
          duplicateRows,
          duplicatePercentage,
          columnMetrics,
          typeIssues: [], // TODO: Implement type issue detection
          frequentValues,
        };

        // Calculate health score
        metrics.healthScore = calculateHealthScore(metrics);
        metrics.healthBreakdown = {
          completeness: Math.round(
            columnMetrics.reduce(
              (sum, col) => sum + (100 - col.nullPercentage),
              0
            ) / columnMetrics.length
          ),
          uniqueness: Math.round(100 - duplicatePercentage),
          consistency: Math.max(
            0,
            100 - (metrics.typeIssues?.length || 0) * 10
          ),
        };

        // Store results
        const newResults = new Map(state.results);
        newResults.set(fileId, metrics);

        set({
          results: newResults,
          isAnalyzing: false,
          analysisProgress: 100,
          analysisStatus: "Analysis complete!",
        });

        // Clear status after a delay
        setTimeout(() => {
          set({ analysisStatus: "", analysisProgress: 0 });
        }, 2000);
      } catch (error) {
        console.error("Inspector analysis failed:", error);
        set({
          error: `Analysis failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
          isAnalyzing: false,
          analysisProgress: 0,
          analysisStatus: "",
        });
      }
    },

    switchAnalysisTarget: (fileId: string, tableName: string) => {
      set({
        activeFileId: fileId,
        activeTableName: tableName,
      });

      // If we don't have results for this file, trigger analysis
      if (!get().results.has(fileId)) {
        get().analyzeFile(fileId, tableName);
      }
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
        throw new Error("No analysis results found for this file");
      }

      try {
        const csvData = [];

        // Header
        csvData.push(["Metric Category", "Metric Name", "Value", "Details"]);

        // Health Score
        csvData.push([
          "Health Score",
          "Overall Score",
          results.healthScore,
          "0-100 scale",
        ]);
        csvData.push([
          "Health Score",
          "Completeness",
          results.healthBreakdown.completeness,
          "Based on missing data",
        ]);
        csvData.push([
          "Health Score",
          "Uniqueness",
          results.healthBreakdown.uniqueness,
          "Based on duplicates",
        ]);
        csvData.push([
          "Health Score",
          "Consistency",
          results.healthBreakdown.consistency,
          "Based on data types",
        ]);

        // Basic Metrics
        csvData.push(["Basic Metrics", "Total Rows", results.totalRows, ""]);
        csvData.push([
          "Basic Metrics",
          "Total Columns",
          results.totalColumns,
          "",
        ]);
        csvData.push([
          "Basic Metrics",
          "Duplicate Rows",
          results.duplicateRows,
          "",
        ]);
        csvData.push([
          "Basic Metrics",
          "Duplicate Percentage",
          `${results.duplicatePercentage.toFixed(2)}%`,
          "",
        ]);

        // Column Metrics
        results.columnMetrics.forEach((col) => {
          csvData.push(["Column Analysis", col.name, "Data Type", col.type]);
          csvData.push([
            "Column Analysis",
            col.name,
            "Null Count",
            col.nullCount,
          ]);
          csvData.push([
            "Column Analysis",
            col.name,
            "Null Percentage",
            `${col.nullPercentage.toFixed(2)}%`,
          ]);
          csvData.push([
            "Column Analysis",
            col.name,
            "Unique Values",
            col.uniqueCount,
          ]);
          csvData.push([
            "Column Analysis",
            col.name,
            "Cardinality",
            col.cardinality.toFixed(4),
          ]);

          if (col.numericStats) {
            csvData.push([
              "Column Analysis",
              col.name,
              "Min Value",
              col.numericStats.min,
            ]);
            csvData.push([
              "Column Analysis",
              col.name,
              "Max Value",
              col.numericStats.max,
            ]);
            csvData.push([
              "Column Analysis",
              col.name,
              "Mean Value",
              col.numericStats.mean.toFixed(2),
            ]);
            csvData.push([
              "Column Analysis",
              col.name,
              "Median Value",
              col.numericStats.median.toFixed(2),
            ]);
          }

          if (col.textStats) {
            csvData.push([
              "Column Analysis",
              col.name,
              "Avg Length",
              col.textStats.avgLength.toFixed(1),
            ]);
            csvData.push([
              "Column Analysis",
              col.name,
              "Empty Strings",
              col.textStats.emptyStrings,
            ]);
          }
        });

        // Convert to CSV string
        const csvString = csvData
          .map((row) =>
            row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
          )
          .join("\n");

        // Download
        const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute(
          "download",
          `data-inspector-results-${fileId}-${
            new Date().toISOString().split("T")[0]
          }.csv`
        );
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error("Export failed:", error);
        throw new Error(
          `Export failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    },

    resetError: () => set({ error: null }),
  };
});
