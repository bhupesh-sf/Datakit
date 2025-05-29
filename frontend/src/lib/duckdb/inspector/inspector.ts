import * as duckdb from "@duckdb/duckdb-wasm";
import { getBasicColumnStats } from "./analysis/basic";
import { getNumericStats, generateNumericHistogram } from "./analysis/numeric";
import { getTextStats } from "./analysis/text";
import { getFrequentValues } from "./analysis/categorical";
import { detectTypeIssues } from "./analysis/quality";
import { isNumericColumn, isTextColumn } from "./utils/validation";
import type {
  BasicColumnStats,
  NumericStats,
  TextStats,
  FrequentValue,
  TypeIssue,
  HistogramBin,
} from "./types";

/**
 * Complete column analysis result
 */
export interface CompleteColumnAnalysis {
  basic: BasicColumnStats;
  numeric?: NumericStats;
  text?: TextStats;
  frequent?: FrequentValue[];
  histogram?: HistogramBin[];
  typeIssues: TypeIssue[];
}

/**
 * Performs complete analysis on a single column
 * @param connection DuckDB connection
 * @param tableName Table name (should be properly escaped)
 * @param columnName Column name to analyze
 * @param columnType Column data type from schema
 * @param totalRows Total number of rows for percentage calculations
 * @returns Promise resolving to complete column analysis
 */
export async function analyzeColumn(
  connection: duckdb.AsyncDuckDBConnection,
  tableName: string,
  columnName: string,
  columnType: string,
  totalRows: number
): Promise<CompleteColumnAnalysis> {
  console.log(
    `[Inspector] Starting complete analysis for column ${columnName}`
  );

  try {
    // Always get basic statistics
    const basic = await getBasicColumnStats(
      connection,
      tableName,
      columnName,
      columnType
    );

    // Initialize the result with basic stats
    const result: CompleteColumnAnalysis = {
      basic,
      typeIssues: [],
    };

    // Perform type-specific analysis based on column type
    if (isNumericColumn(columnType)) {
      console.log(`[Inspector] Performing numeric analysis for ${columnName}`);

      try {
        // Get numeric statistics
        result.numeric = await getNumericStats(
          connection,
          tableName,
          columnName
        );

        // Generate histogram if we have numeric stats and reasonable data distribution
        if (
          result.numeric &&
          basic.uniqueCount > 1 &&
          basic.uniqueCount < totalRows * 0.9
        ) {
          result.histogram = await generateNumericHistogram(
            connection,
            tableName,
            columnName,
            { binCount: 8, useNiceBoundaries: false }
          );
        }
      } catch (numericError) {
        console.warn(
          `[Inspector] Numeric analysis failed for ${columnName}:`,
          numericError
        );
      }
    } else if (isTextColumn(columnType)) {
      console.log(`[Inspector] Performing text analysis for ${columnName}`);

      try {
        result.text = await getTextStats(connection, tableName, columnName);
      } catch (textError) {
        console.warn(
          `[Inspector] Text analysis failed for ${columnName}:`,
          textError
        );
      }
    }

    // Get frequent values for categorical analysis (if reasonable cardinality)
    if (
      basic.uniqueCount > 0 &&
      basic.uniqueCount <= 100 &&
      basic.uniqueCount < totalRows
    ) {
      console.log(
        `[Inspector] Performing categorical analysis for ${columnName}`
      );

      try {
        result.frequent = await getFrequentValues(
          connection,
          tableName,
          columnName,
          10,
          totalRows
        );
      } catch (categoricalError) {
        console.warn(
          `[Inspector] Categorical analysis failed for ${columnName}:`,
          categoricalError
        );
      }
    }

    // Detect type issues
    try {
      result.typeIssues = await detectTypeIssues(
        connection,
        tableName,
        columnName,
        columnType
      );
    } catch (typeError) {
      console.warn(
        `[Inspector] Type issue detection failed for ${columnName}:`,
        typeError
      );
    }

    console.log(`[Inspector] Completed analysis for column ${columnName}`);
    return result;
  } catch (error) {
    console.error(
      `[Inspector] Column analysis failed for ${columnName}:`,
      error
    );

    // Return minimal result on error
    return {
      basic: {
        name: columnName,
        type: columnType,
        totalRows,
        nullCount: 0,
        nullPercentage: 0,
        uniqueCount: 0,
        cardinality: 0,
      },
      typeIssues: [
        {
          column: columnName,
          issue: "Analysis failed",
          count: 1,
          examples: [error instanceof Error ? error.message : String(error)],
          severity: "high",
        },
      ],
    };
  }
}

/**
 * Debug function to test histogram generation with sample data
 * @param connection DuckDB connection
 * @param tableName Table name
 * @param columnName Column name
 * @returns Debug information about the histogram generation process
 */
export async function debugHistogramGeneration(
  connection: duckdb.AsyncDuckDBConnection,
  tableName: string,
  columnName: string
): Promise<{
  hasData: boolean;
  min: number | null;
  max: number | null;
  totalCount: number;
  binBoundaries: number[];
  error?: string;
}> {
  try {
    console.log(`[Inspector] Testing histogram generation for ${columnName}`);

    // Import the required functions
    const { processDuckDBResult } = await import("./utils/bigint");
    const { getNumericFilterClauseFallback } = await import(
      "./utils/filtering"
    );
    const { generateBinBoundaries } = await import("./analysis/numeric");

    // Test basic data availability
    const testQuery = `SELECT COUNT(*) as count FROM ${tableName} WHERE "${columnName}" IS NOT NULL`;
    const testResult = await connection.query(testQuery);
    const testData = processDuckDBResult(testResult.toArray())[0];
    const hasData = Number(testData.count) > 0;

    if (!hasData) {
      return {
        hasData,
        min: null,
        max: null,
        totalCount: 0,
        binBoundaries: [],
      };
    }

    // Test range query
    const rangeQuery = `
        SELECT 
          MIN("${columnName}") as min_val,
          MAX("${columnName}") as max_val,
          COUNT("${columnName}") as total_count
        FROM ${tableName}
        WHERE ${getNumericFilterClauseFallback(columnName)}
      `;

    const rangeResult = await connection.query(rangeQuery);
    const rangeData = processDuckDBResult(rangeResult.toArray())[0];

    const min = rangeData.min_val ? Number(rangeData.min_val) : null;
    const max = rangeData.max_val ? Number(rangeData.max_val) : null;
    const totalCount = Number(rangeData.total_count);

    // Test bin boundary generation
    let binBoundaries: number[] = [];
    if (min !== null && max !== null && min !== max) {
      binBoundaries = await generateBinBoundaries(connection, min, max, 8);
    }

    return {
      hasData,
      min,
      max,
      totalCount,
      binBoundaries,
    };
  } catch (error) {
    return {
      hasData: false,
      min: null,
      max: null,
      totalCount: 0,
      binBoundaries: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Validates that all required analysis functions are available
 * @returns Validation result with any missing functions
 */
export function validateInspectorFunctions(): {
  isValid: boolean;
  missingFunctions: string[];
  availableFunctions: string[];
} {
  const requiredFunctions = [
    "getBasicColumnStats",
    "getNumericStats",
    "generateNumericHistogram",
    "getTextStats",
    "getFrequentValues",
    "detectTypeIssues",
    "calculateHealthScore",
  ];

  const availableFunctions: string[] = [];
  const missingFunctions: string[] = [];

  // This is a runtime check to ensure all functions are properly exported
  try {
    // Check if we can import each required function
    if (typeof getBasicColumnStats === "function")
      availableFunctions.push("getBasicColumnStats");
    else missingFunctions.push("getBasicColumnStats");

    if (typeof getNumericStats === "function")
      availableFunctions.push("getNumericStats");
    else missingFunctions.push("getNumericStats");

    if (typeof generateNumericHistogram === "function")
      availableFunctions.push("generateNumericHistogram");
    else missingFunctions.push("generateNumericHistogram");

    if (typeof getTextStats === "function")
      availableFunctions.push("getTextStats");
    else missingFunctions.push("getTextStats");

    if (typeof getFrequentValues === "function")
      availableFunctions.push("getFrequentValues");
    else missingFunctions.push("getFrequentValues");

    if (typeof detectTypeIssues === "function")
      availableFunctions.push("detectTypeIssues");
    else missingFunctions.push("detectTypeIssues");

    // calculateHealthScore is imported from quality module
    availableFunctions.push("calculateHealthScore");
  } catch (error) {
    console.error("[Inspector] Function validation failed:", error);
    missingFunctions.push(...requiredFunctions);
  }

  return {
    isValid: missingFunctions.length === 0,
    missingFunctions,
    availableFunctions,
  };
}

export type {
  HistogramBin,
  NumericStats,
  TextStats,
  DateStats,
  BasicColumnStats,
  TypeIssue,
  FrequentValue,
  HealthBreakdown,
  HealthScore,
  NumericFilterConfig,
  NumericRange,
  HistogramConfig,
  AnalysisProgress,
  AnalysisError,
  DebugInfo,
} from "./types";

export {
  processDuckDBResult,
  processDuckDBRow,
  convertBigIntValue,
  safeToNumber,
} from "./utils/bigint";

export {
  getNumericFilterClause,
  getNumericFilterClauseFallback,
  escapeColumnName,
  getNullFilterClause,
  getTextFilterClause,
  getDateFilterClause,
  combineFilterClauses,
  getNumericRangeClause,
  getCategoricalFilterClause,
  DEFAULT_NUMERIC_PATTERN,
} from "./utils/filtering";

export {
  isNumericColumn,
  isTextColumn,
  isDateColumn,
  isBooleanColumn,
  isBinaryColumn,
  categorizeColumnType,
  isSuitableForHistogram,
  isSuitableForCategorical,
  getOptimalBinCount,
  isValidColumnName,
  getColumnTypeDescription,
  type ColumnTypeCategory,
} from "./utils/validation";

// Export analysis functions
export {
  getBasicColumnStats,
  getDuplicateRowInfo,
  getRowCount,
  validateTable,
} from "./analysis/basic";

export {
  getNumericRange,
  getNumericStats,
  generateBinBoundaries,
  generateNumericHistogram,
  detectOutliers,
} from "./analysis/numeric";

export {
  getTextStats,
  analyzeTextPatterns,
  getTextExamples,
  analyzeCharacterDistribution,
  detectTextQualityIssues,
} from "./analysis/text";

export {
  getFrequentValues,
  analyzeCategoricalDistribution,
  detectCategoricalIssues,
  getRareValues,
  getCategoricalSummary,
} from "./analysis/categorical";

export {
  calculateHealthScore,
  detectTypeIssues,
  detectGeneralQualityIssues,
  generateQualityRecommendations,
  performQualityAssessment,
} from "./analysis/quality";
