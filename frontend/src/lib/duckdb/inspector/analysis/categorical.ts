import * as duckdb from '@duckdb/duckdb-wasm';
import { processDuckDBResult, safeToNumber } from '../utils/bigint';
import { escapeColumnName } from '../utils/filtering';
import type { FrequentValue } from '../types';

/**
 * Gets frequent values for categorical analysis
 * @param connection DuckDB connection
 * @param tableName Table name (should be properly escaped)
 * @param columnName Column name to analyze
 * @param limit Maximum number of frequent values to return (default: 10)
 * @param totalRows Total number of rows in the table for percentage calculation
 * @returns Promise resolving to array of frequent values
 */
export async function getFrequentValues(
  connection: duckdb.AsyncDuckDBConnection,
  tableName: string,
  columnName: string,
  limit: number = 10,
  totalRows: number
): Promise<FrequentValue[]> {
  console.log(`[CategoricalAnalysis] Getting frequent values for ${columnName} (limit: ${limit})`);
  
  if (totalRows === 0) {
    return [];
  }
  
  try {
    const freqQuery = `
      SELECT 
        ${escapeColumnName(columnName)} as value, 
        COUNT(*) as count,
        (COUNT(*) * 100.0 / ${totalRows}) as percentage
      FROM ${tableName}
      WHERE ${escapeColumnName(columnName)} IS NOT NULL
      GROUP BY ${escapeColumnName(columnName)}
      ORDER BY count DESC
      LIMIT ${limit}
    `;
    
    const result = await connection.query(freqQuery);
    const frequentValues = processDuckDBResult(result.toArray()).map(row => ({
      value: String(row.value),
      count: safeToNumber(row.count),
      percentage: safeToNumber(row.percentage)
    }));
    
    console.log(`[CategoricalAnalysis] Found ${frequentValues.length} frequent values for ${columnName}`);
    return frequentValues;
    
  } catch (error) {
    console.error(`[CategoricalAnalysis] Error getting frequent values for ${columnName}:`, error);
    return [];
  }
}

/**
 * Analyzes the distribution characteristics of categorical data
 * @param connection DuckDB connection
 * @param tableName Table name (should be properly escaped)
 * @param columnName Column name to analyze
 * @param totalRows Total number of rows for calculations
 * @returns Promise resolving to distribution analysis
 */
export async function analyzeCategoricalDistribution(
  connection: duckdb.AsyncDuckDBConnection,
  tableName: string,
  columnName: string,
  totalRows: number
): Promise<{
  uniqueValues: number;
  dominantValue: { value: string; count: number; percentage: number } | null;
  entropy: number;
  giniImpurity: number;
  isUniform: boolean;
  concentrationRatio: number; // Top 5 values as % of total
}> {
  console.log(`[CategoricalAnalysis] Analyzing distribution for ${columnName}`);
  
  try {
    // Get value counts for distribution analysis
    const distributionQuery = `
      SELECT 
        ${escapeColumnName(columnName)} as value,
        COUNT(*) as count,
        (COUNT(*) * 100.0 / ${totalRows}) as percentage
      FROM ${tableName}
      WHERE ${escapeColumnName(columnName)} IS NOT NULL
      GROUP BY ${escapeColumnName(columnName)}
      ORDER BY count DESC
    `;
    
    const result = await connection.query(distributionQuery);
    const distribution = processDuckDBResult(result.toArray());
    
    if (distribution.length === 0) {
      return {
        uniqueValues: 0,
        dominantValue: null,
        entropy: 0,
        giniImpurity: 0,
        isUniform: false,
        concentrationRatio: 0
      };
    }
    
    const uniqueValues = distribution.length;
    const dominantValue = {
      value: String(distribution[0].value),
      count: safeToNumber(distribution[0].count),
      percentage: safeToNumber(distribution[0].percentage)
    };
    
    // Calculate entropy: -Σ(p * log2(p))
    let entropy = 0;
    let giniSum = 0;
    
    distribution.forEach(row => {
      const probability = safeToNumber(row.count) / totalRows;
      if (probability > 0) {
        entropy -= probability * Math.log2(probability);
        giniSum += probability * probability;
      }
    });
    
    const giniImpurity = 1 - giniSum;
    
    // Check if distribution is roughly uniform
    const expectedCount = totalRows / uniqueValues;
    const isUniform = distribution.every(row => {
      const count = safeToNumber(row.count);
      const deviation = Math.abs(count - expectedCount) / expectedCount;
      return deviation < 0.2; // Within 20% of expected
    });
    
    // Calculate concentration ratio (top 5 values)
    const top5Count = distribution
      .slice(0, Math.min(5, distribution.length))
      .reduce((sum, row) => sum + safeToNumber(row.count), 0);
    const concentrationRatio = (top5Count / totalRows) * 100;
    
    const analysis = {
      uniqueValues,
      dominantValue,
      entropy,
      giniImpurity,
      isUniform,
      concentrationRatio
    };
    
    console.log(`[CategoricalAnalysis] Distribution analysis for ${columnName}:`, analysis);
    return analysis;
    
  } catch (error) {
    console.error(`[CategoricalAnalysis] Distribution analysis failed for ${columnName}:`, error);
    return {
      uniqueValues: 0,
      dominantValue: null,
      entropy: 0,
      giniImpurity: 0,
      isUniform: false,
      concentrationRatio: 0
    };
  }
}

/**
 * Detects potential issues in categorical data
 * @param connection DuckDB connection
 * @param tableName Table name (should be properly escaped)
 * @param columnName Column name to analyze
 * @returns Promise resolving to categorical quality issues
 */
export async function detectCategoricalIssues(
  connection: duckdb.AsyncDuckDBConnection,
  tableName: string,
  columnName: string
): Promise<{
  duplicateCategories: Array<{ original: string; similar: string[]; count: number }>;
  inconsistentCasing: number;
  leadingTrailingSpaces: number;
  veryLongValues: number;
  singleCharValues: number;
  numericStrings: number;
}> {
  console.log(`[CategoricalAnalysis] Detecting categorical issues for ${columnName}`);
  
  try {
    // Basic quality issues
    const basicIssuesQuery = `
      SELECT 
        COUNT(CASE WHEN ${escapeColumnName(columnName)} != TRIM(${escapeColumnName(columnName)}) THEN 1 END) as leading_trailing_spaces,
        COUNT(CASE WHEN LENGTH(${escapeColumnName(columnName)}) > 100 THEN 1 END) as very_long_values,
        COUNT(CASE WHEN LENGTH(${escapeColumnName(columnName)}) = 1 THEN 1 END) as single_char_values
      FROM ${tableName}
      WHERE ${escapeColumnName(columnName)} IS NOT NULL
    `;
    
    const basicResult = await connection.query(basicIssuesQuery);
    const basicData = processDuckDBResult(basicResult.toArray())[0];
    
    // Case inconsistency detection
    const caseQuery = `
      SELECT COUNT(*) as inconsistent_casing
      FROM (
        SELECT LOWER(${escapeColumnName(columnName)}) as lower_val
        FROM ${tableName}
        WHERE ${escapeColumnName(columnName)} IS NOT NULL
        GROUP BY LOWER(${escapeColumnName(columnName)})
        HAVING COUNT(DISTINCT ${escapeColumnName(columnName)}) > 1
      ) case_issues
    `;
    
    let inconsistentCasing = 0;
    try {
      const caseResult = await connection.query(caseQuery);
      const caseData = processDuckDBResult(caseResult.toArray())[0];
      inconsistentCasing = safeToNumber(caseData.inconsistent_casing);
    } catch (caseError) {
      console.warn(`[CategoricalAnalysis] Case inconsistency check failed for ${columnName}:`, caseError);
    }
    
    // Numeric strings detection (values that look like numbers but are stored as text)
    let numericStrings = 0;
    try {
      const numericQuery = `
        SELECT COUNT(*) as numeric_strings
        FROM ${tableName}
        WHERE ${escapeColumnName(columnName)} IS NOT NULL
          AND TRY_CAST(${escapeColumnName(columnName)} AS DOUBLE) IS NOT NULL
          AND LENGTH(TRIM(${escapeColumnName(columnName)})) > 0
      `;
      
      const numericResult = await connection.query(numericQuery);
      const numericData = processDuckDBResult(numericResult.toArray())[0];
      numericStrings = safeToNumber(numericData.numeric_strings);
    } catch (numericError) {
      console.warn(`[CategoricalAnalysis] Numeric strings check failed for ${columnName}:`, numericError);
    }
    
    const issues = {
      duplicateCategories: [], // Would require more complex similarity analysis
      inconsistentCasing,
      leadingTrailingSpaces: safeToNumber(basicData.leading_trailing_spaces),
      veryLongValues: safeToNumber(basicData.very_long_values),
      singleCharValues: safeToNumber(basicData.single_char_values),
      numericStrings
    };
    
    console.log(`[CategoricalAnalysis] Categorical issues for ${columnName}:`, issues);
    return issues;
    
  } catch (error) {
    console.error(`[CategoricalAnalysis] Categorical issues detection failed for ${columnName}:`, error);
    return {
      duplicateCategories: [],
      inconsistentCasing: 0,
      leadingTrailingSpaces: 0,
      veryLongValues: 0,
      singleCharValues: 0,
      numericStrings: 0
    };
  }
}

/**
 * Gets rare values (values that appear very infrequently)
 * @param connection DuckDB connection
 * @param tableName Table name (should be properly escaped)
 * @param columnName Column name to analyze
 * @param threshold Percentage threshold below which values are considered rare (default: 1%)
 * @param limit Maximum number of rare values to return
 * @returns Promise resolving to rare values
 */
export async function getRareValues(
  connection: duckdb.AsyncDuckDBConnection,
  tableName: string,
  columnName: string,
  threshold: number = 1.0,
  limit: number = 20
): Promise<FrequentValue[]> {
  console.log(`[CategoricalAnalysis] Getting rare values for ${columnName} (threshold: ${threshold}%)`);
  
  try {
    // Get total count first
    const totalQuery = `SELECT COUNT(*) as total FROM ${tableName} WHERE ${escapeColumnName(columnName)} IS NOT NULL`;
    const totalResult = await connection.query(totalQuery);
    const totalRows = safeToNumber(processDuckDBResult(totalResult.toArray())[0].total);
    
    if (totalRows === 0) {
      return [];
    }
    
    const rareQuery = `
      SELECT 
        ${escapeColumnName(columnName)} as value,
        COUNT(*) as count,
        (COUNT(*) * 100.0 / ${totalRows}) as percentage
      FROM ${tableName}
      WHERE ${escapeColumnName(columnName)} IS NOT NULL
      GROUP BY ${escapeColumnName(columnName)}
      HAVING (COUNT(*) * 100.0 / ${totalRows}) < ${threshold}
      ORDER BY count ASC, ${escapeColumnName(columnName)}
      LIMIT ${limit}
    `;
    
    const result = await connection.query(rareQuery);
    const rareValues = processDuckDBResult(result.toArray()).map(row => ({
      value: String(row.value),
      count: safeToNumber(row.count),
      percentage: safeToNumber(row.percentage)
    }));
    
    console.log(`[CategoricalAnalysis] Found ${rareValues.length} rare values for ${columnName}`);
    return rareValues;
    
  } catch (error) {
    console.error(`[CategoricalAnalysis] Error getting rare values for ${columnName}:`, error);
    return [];
  }
}

/**
 * Generates a categorical summary with key insights
 * @param connection DuckDB connection
 * @param tableName Table name (should be properly escaped)
 * @param columnName Column name to analyze
 * @param totalRows Total number of rows for calculations
 * @returns Promise resolving to categorical summary
 */
export async function getCategoricalSummary(
  connection: duckdb.AsyncDuckDBConnection,
  tableName: string,
  columnName: string,
  totalRows: number
): Promise<{
  frequentValues: FrequentValue[];
  rareValues: FrequentValue[];
  distribution: Awaited<ReturnType<typeof analyzeCategoricalDistribution>>;
  qualityIssues: Awaited<ReturnType<typeof detectCategoricalIssues>>;
  insights: string[];
}> {
  console.log(`[CategoricalAnalysis] Generating categorical summary for ${columnName}`);
  
  try {
    // Run all analyses in parallel for efficiency
    const [frequentValues, rareValues, distribution, qualityIssues] = await Promise.all([
      getFrequentValues(connection, tableName, columnName, 10, totalRows),
      getRareValues(connection, tableName, columnName, 1.0, 10),
      analyzeCategoricalDistribution(connection, tableName, columnName, totalRows),
      detectCategoricalIssues(connection, tableName, columnName)
    ]);
    
    // Generate insights based on the analysis
    const insights: string[] = [];
    
    if (distribution.dominantValue && distribution.dominantValue.percentage > 50) {
      insights.push(`Dominated by "${distribution.dominantValue.value}" (${distribution.dominantValue.percentage.toFixed(1)}%)`);
    }
    
    if (distribution.isUniform) {
      insights.push("Values are uniformly distributed");
    } else if (distribution.concentrationRatio > 80) {
      insights.push("Highly concentrated - top 5 values make up most data");
    }
    
    if (distribution.uniqueValues === totalRows) {
      insights.push("All values are unique (likely an identifier)");
    } else if (distribution.uniqueValues < 5) {
      insights.push("Very few unique values (good for grouping)");
    }
    
    if (qualityIssues.inconsistentCasing > 0) {
      insights.push("Has inconsistent casing that could be standardized");
    }
    
    if (qualityIssues.leadingTrailingSpaces > 0) {
      insights.push("Contains values with extra whitespace");
    }
    
    if (qualityIssues.numericStrings > 0) {
      insights.push("Contains numeric values stored as text");
    }
    
    if (rareValues.length > distribution.uniqueValues * 0.8) {
      insights.push("Many rare values - consider grouping or cleaning");
    }
    
    const summary = {
      frequentValues,
      rareValues,
      distribution,
      qualityIssues,
      insights
    };
    
    console.log(`[CategoricalAnalysis] Generated summary with ${insights.length} insights for ${columnName}`);
    return summary;
    
  } catch (error) {
    console.error(`[CategoricalAnalysis] Error generating categorical summary for ${columnName}:`, error);
    
    // Return empty summary on error
    return {
      frequentValues: [],
      rareValues: [],
      distribution: {
        uniqueValues: 0,
        dominantValue: null,
        entropy: 0,
        giniImpurity: 0,
        isUniform: false,
        concentrationRatio: 0
      },
      qualityIssues: {
        duplicateCategories: [],
        inconsistentCasing: 0,
        leadingTrailingSpaces: 0,
        veryLongValues: 0,
        singleCharValues: 0,
        numericStrings: 0
      },
      insights: ["Analysis failed - unable to generate insights"]
    };
  }
}