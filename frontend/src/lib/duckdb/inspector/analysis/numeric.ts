import * as duckdb from "@duckdb/duckdb-wasm";
import { processDuckDBResult, safeToNumber } from "../utils/bigint";
import {
  getNumericFilterClause,
  getNumericFilterClauseFallback,
  escapeColumnName,
} from "../utils/filtering";
import type {
  NumericStats,
  HistogramBin,
  NumericRange,
  HistogramConfig,
} from "../types";

/**
 * Gets the numeric range (min/max) for a column
 * @param connection DuckDB connection
 * @param tableName Table name (should be properly escaped)
 * @param columnName Column name to analyze
 * @returns Promise resolving to numeric range information
 */
export async function getNumericRange(
  connection: duckdb.AsyncDuckDBConnection,
  tableName: string,
  columnName: string
): Promise<NumericRange | null> {
  console.log(`[NumericAnalysis] Getting range for ${columnName}`);

  // Try regex filtering first, fallback to TRY_CAST
  let rangeQuery: string;
  let result: duckdb.ResultStreamBatch;
  let data: any;

  try {
    // Try regex-based filtering first
    rangeQuery = `
      SELECT 
        MIN(CAST(${escapeColumnName(columnName)} AS DOUBLE)) as min_val,
        MAX(CAST(${escapeColumnName(columnName)} AS DOUBLE)) as max_val,
        COUNT(*) as total_count
      FROM ${tableName}
      WHERE ${getNumericFilterClause(columnName)}
    `;

    result = await connection.query(rangeQuery);
    data = processDuckDBResult(result.toArray())[0];
  } catch (regexError) {
    console.log(
      `[NumericAnalysis] Regex filtering failed, using TRY_CAST fallback for ${columnName}`
    );

    // Fallback to TRY_CAST method
    rangeQuery = `
      SELECT 
        MIN(${escapeColumnName(columnName)}) as min_val,
        MAX(${escapeColumnName(columnName)}) as max_val,
        COUNT(${escapeColumnName(columnName)}) as total_count
      FROM ${tableName}
      WHERE ${getNumericFilterClauseFallback(columnName)}
    `;

    result = await connection.query(rangeQuery);
    data = processDuckDBResult(result.toArray())[0];
  }

  if (
    !data ||
    data.min_val === null ||
    data.max_val === null ||
    data.total_count === 0
  ) {
    console.log(
      `[NumericAnalysis] No valid numeric data found for ${columnName}`
    );
    return null;
  }

  const min = safeToNumber(data.min_val);
  const max = safeToNumber(data.max_val);
  const totalCount = safeToNumber(data.total_count);

  console.log(
    `[NumericAnalysis] Range for ${columnName}: ${min} to ${max} (${totalCount} values)`
  );

  return {
    min,
    max,
    totalCount,
    isConstant: min === max,
  };
}

/**
 * Gets comprehensive numeric statistics for a column
 * @param connection DuckDB connection
 * @param tableName Table name (should be properly escaped)
 * @param columnName Column name to analyze
 * @returns Promise resolving to numeric statistics or null if failed
 */
export async function getNumericStats(
  connection: duckdb.AsyncDuckDBConnection,
  tableName: string,
  columnName: string
): Promise<NumericStats | null> {
  console.log(
    `[NumericAnalysis] Getting comprehensive stats for ${columnName}`
  );

  // Try regex filtering first, fallback to TRY_CAST
  let statsQuery: string;
  let result: duckdb.ResultStreamBatch;
  let stats: any;

  try {
    // Try regex-based filtering first
    statsQuery = `
      SELECT 
        MIN(CAST(${escapeColumnName(columnName)} AS DOUBLE)) as min_val,
        MAX(CAST(${escapeColumnName(columnName)} AS DOUBLE)) as max_val,
        AVG(CAST(${escapeColumnName(columnName)} AS DOUBLE)) as mean_val,
        MEDIAN(CAST(${escapeColumnName(columnName)} AS DOUBLE)) as median_val,
        STDDEV(CAST(${escapeColumnName(columnName)} AS DOUBLE)) as std_val,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY CAST(${escapeColumnName(
          columnName
        )} AS DOUBLE)) as q1,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY CAST(${escapeColumnName(
          columnName
        )} AS DOUBLE)) as q3,
        COUNT(*) as count_val
      FROM ${tableName}
      WHERE ${getNumericFilterClause(columnName)}
    `;

    result = await connection.query(statsQuery);
    stats = processDuckDBResult(result.toArray())[0];
  } catch (regexError) {
    console.log(
      `[NumericAnalysis] Regex filtering failed for stats, using TRY_CAST fallback for ${columnName}`
    );

    // Fallback to TRY_CAST method
    statsQuery = `
      SELECT 
        MIN(${escapeColumnName(columnName)}) as min_val,
        MAX(${escapeColumnName(columnName)}) as max_val,
        AVG(${escapeColumnName(columnName)}) as mean_val,
        MEDIAN(${escapeColumnName(columnName)}) as median_val,
        STDDEV(${escapeColumnName(columnName)}) as std_val,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY ${escapeColumnName(
          columnName
        )}) as q1,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ${escapeColumnName(
          columnName
        )}) as q3,
        COUNT(${escapeColumnName(columnName)}) as count_val
      FROM ${tableName}
      WHERE ${getNumericFilterClauseFallback(columnName)}
    `;

    result = await connection.query(statsQuery);
    stats = processDuckDBResult(result.toArray())[0];
  }

  if (!stats || stats.min_val === null) {
    console.log(
      `[NumericAnalysis] No valid numeric data for stats calculation: ${columnName}`
    );
    return null;
  }

  const q1 = safeToNumber(stats.q1);
  const q3 = safeToNumber(stats.q3);
  const iqr = q3 - q1;

  // Calculate outliers using IQR method (1.5 * IQR rule)
  let outliers = 0;
  if (iqr > 0) {
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    // Use the same filtering method as the main stats query
    let outlierQuery: string;
    if (statsQuery.includes("REGEXP_MATCHES")) {
      outlierQuery = `
        SELECT COUNT(*) as outlier_count
        FROM ${tableName}
        WHERE ${getNumericFilterClause(columnName)}
          AND (CAST(${escapeColumnName(
            columnName
          )} AS DOUBLE) < ${lowerBound} OR CAST(${escapeColumnName(
        columnName
      )} AS DOUBLE) > ${upperBound})
      `;
    } else {
      outlierQuery = `
        SELECT COUNT(*) as outlier_count
        FROM ${tableName}
        WHERE ${getNumericFilterClauseFallback(columnName)}
          AND (${escapeColumnName(
            columnName
          )} < ${lowerBound} OR ${escapeColumnName(columnName)} > ${upperBound})
      `;
    }

    try {
      const outlierResult = await connection.query(outlierQuery);
      const outlierData = processDuckDBResult(outlierResult.toArray())[0];
      outliers = safeToNumber(outlierData.outlier_count);
    } catch (outlierError) {
      console.warn(
        `[NumericAnalysis] Could not calculate outliers for ${columnName}:`,
        outlierError
      );
    }
  }

  const numericStats: NumericStats = {
    min: safeToNumber(stats.min_val),
    max: safeToNumber(stats.max_val),
    mean: safeToNumber(stats.mean_val),
    median: safeToNumber(stats.median_val),
    std: safeToNumber(stats.std_val),
    q1,
    q3,
    outliers,
  };

  console.log(`[NumericAnalysis] Stats for ${columnName}:`, numericStats);
  return numericStats;
}

/**
 * Generates bin boundaries using DuckDB's equi_width_bins or manual calculation
 * @param connection DuckDB connection
 * @param min Minimum value
 * @param max Maximum value
 * @param binCount Number of bins
 * @returns Promise resolving to array of bin boundaries
 */
export async function generateBinBoundaries(
  connection: duckdb.AsyncDuckDBConnection,
  min: number,
  max: number,
  binCount: number
): Promise<number[]> {
  console.log(
    `[NumericAnalysis] Generating ${binCount} bin boundaries for range ${min} to ${max}`
  );

  // If all values are the same, return single boundary
  if (min === max) {
    return [max];
  }

  // Try DuckDB's equi_width_bins function first
  try {
    const binBoundariesQuery = `SELECT unnest(equi_width_bins(${min}, ${max}, ${binCount}, false)) as boundary`;
    const boundariesResult = await connection.query(binBoundariesQuery);
    const boundariesData = processDuckDBResult(boundariesResult.toArray());
    const binBoundaries = boundariesData.map((row) =>
      safeToNumber(row.boundary)
    );

    console.log(
      `[NumericAnalysis] Generated ${binBoundaries.length} bin boundaries using equi_width_bins:`,
      binBoundaries
    );
    return binBoundaries;
  } catch (equiWidthError) {
    console.warn(
      `[NumericAnalysis] equi_width_bins not available, using manual binning:`,
      equiWidthError
    );

    // Fallback: create manual equal-width bins
    const binBoundaries: number[] = [];
    const binWidth = (max - min) / binCount;

    for (let i = 1; i <= binCount; i++) {
      binBoundaries.push(min + i * binWidth);
    }

    console.log(
      `[NumericAnalysis] Generated ${binBoundaries.length} bin boundaries manually:`,
      binBoundaries
    );
    return binBoundaries;
  }
}

/**
 * Generates histogram data for numeric columns
 * @param connection DuckDB connection
 * @param tableName Table name (should be properly escaped)
 * @param columnName Column name to analyze
 * @param config Histogram configuration
 * @returns Promise resolving to histogram bin data
 */
export async function generateNumericHistogram(
  connection: duckdb.AsyncDuckDBConnection,
  tableName: string,
  columnName: string,
  config: HistogramConfig = { binCount: 10, useNiceBoundaries: false }
): Promise<HistogramBin[]> {
  console.log(
    `[NumericAnalysis] Generating histogram for ${columnName} with ${config.binCount} bins`
  );

  // Get numeric range first
  const range = await getNumericRange(connection, tableName, columnName);
  if (!range) {
    return [];
  }

  const { min, max, totalCount } = range;

  // If all values are the same, create a single bin
  if (range.isConstant) {
    return [
      {
        bin: "B1",
        count: totalCount,
        range: `${min}`,
        binStart: min,
        binEnd: max,
      },
    ];
  }

  // Generate bin boundaries
  const binBoundaries =
    config.customBoundaries ||
    (await generateBinBoundaries(connection, min, max, config.binCount));

  // Determine which filtering method to use based on what worked for the range query
  const testQuery = `SELECT 1 FROM ${tableName} WHERE ${getNumericFilterClause(
    columnName
  )} LIMIT 1`;
  let useRegexFilter = true;

  try {
    await connection.query(testQuery);
  } catch {
    useRegexFilter = false;
  }

  // Generate histogram bins
  const histogramBins: HistogramBin[] = [];

  for (let i = 0; i < binBoundaries.length; i++) {
    const binStart = i === 0 ? min : binBoundaries[i - 1];
    const binEnd = binBoundaries[i];

    // Count values in this bin range
    let countQuery: string;
    if (useRegexFilter) {
      countQuery =
        i === binBoundaries.length - 1
          ? `SELECT COUNT(*) as count FROM ${tableName} 
           WHERE ${getNumericFilterClause(columnName)}
           AND CAST(${escapeColumnName(columnName)} AS DOUBLE) >= ${binStart} 
           AND CAST(${escapeColumnName(columnName)} AS DOUBLE) <= ${binEnd}`
          : `SELECT COUNT(*) as count FROM ${tableName} 
           WHERE ${getNumericFilterClause(columnName)}
           AND CAST(${escapeColumnName(columnName)} AS DOUBLE) >= ${binStart} 
           AND CAST(${escapeColumnName(columnName)} AS DOUBLE) < ${binEnd}`;
    } else {
      countQuery =
        i === binBoundaries.length - 1
          ? `SELECT COUNT(*) as count FROM ${tableName} 
           WHERE ${getNumericFilterClauseFallback(columnName)}
           AND ${escapeColumnName(
             columnName
           )} >= ${binStart} AND ${escapeColumnName(columnName)} <= ${binEnd}`
          : `SELECT COUNT(*) as count FROM ${tableName} 
           WHERE ${getNumericFilterClauseFallback(columnName)}
           AND ${escapeColumnName(
             columnName
           )} >= ${binStart} AND ${escapeColumnName(columnName)} < ${binEnd}`;
    }

    const countResult = await connection.query(countQuery);
    const countData = processDuckDBResult(countResult.toArray())[0];
    const count = safeToNumber(countData.count);

    histogramBins.push({
      bin: `B${i + 1}`,
      count,
      range: `${binStart.toFixed(2)}-${binEnd.toFixed(2)}`,
      binStart: Number(binStart.toFixed(2)),
      binEnd: Number(binEnd.toFixed(2)),
    });
  }

  console.log(
    `[NumericAnalysis] Generated histogram with ${histogramBins.length} bins for ${columnName}`
  );
  return histogramBins.filter(
    (bin) => bin.count > 0 || histogramBins.length <= 3
  ); // Keep empty bins only for small histograms
}

/**
 * Detects potential outliers in a numeric column
 * @param connection DuckDB connection
 * @param tableName Table name (should be properly escaped)
 * @param columnName Column name to analyze
 * @param method Method to use for outlier detection ('iqr' | 'zscore')
 * @returns Promise resolving to outlier information
 */
export async function detectOutliers(
  connection: duckdb.AsyncDuckDBConnection,
  tableName: string,
  columnName: string,
  method: "iqr" | "zscore" = "iqr"
): Promise<{
  count: number;
  percentage: number;
  examples: any[];
}> {
  console.log(
    `[NumericAnalysis] Detecting outliers for ${columnName} using ${method} method`
  );

  if (method === "iqr") {
    // Get quartiles for IQR method
    const stats = await getNumericStats(connection, tableName, columnName);
    if (!stats || !stats.q1 || !stats.q3) {
      return { count: 0, percentage: 0, examples: [] };
    }

    const iqr = stats.q3 - stats.q1;
    if (iqr <= 0) {
      return { count: 0, percentage: 0, examples: [] };
    }

    const lowerBound = stats.q1 - 1.5 * iqr;
    const upperBound = stats.q3 + 1.5 * iqr;

    // Count and get examples of outliers
    const outlierQuery = `
      SELECT ${escapeColumnName(columnName)} as value, COUNT(*) as count
      FROM ${tableName}
      WHERE ${getNumericFilterClauseFallback(columnName)}
        AND (${escapeColumnName(
          columnName
        )} < ${lowerBound} OR ${escapeColumnName(columnName)} > ${upperBound})
      GROUP BY ${escapeColumnName(columnName)}
      ORDER BY count DESC
      LIMIT 10
    `;

    const result = await connection.query(outlierQuery);
    const outlierData = processDuckDBResult(result.toArray());

    const totalOutliers = outlierData.reduce(
      (sum, row) => sum + safeToNumber(row.count),
      0
    );
    const range = await getNumericRange(connection, tableName, columnName);
    const totalCount = range?.totalCount || 1;
    const percentage = (totalOutliers / totalCount) * 100;

    return {
      count: totalOutliers,
      percentage,
      examples: outlierData.map((row) => ({
        value: safeToNumber(row.value),
        count: safeToNumber(row.count),
      })),
    };
  }

  // Z-score method could be implemented here
  return { count: 0, percentage: 0, examples: [] };
}
