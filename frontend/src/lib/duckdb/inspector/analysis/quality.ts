import * as duckdb from '@duckdb/duckdb-wasm';
import { processDuckDBResult, safeToNumber } from '../utils/bigint';
import { escapeColumnName } from '../utils/filtering';
import { isNumericColumn, isDateColumn } from '../utils/validation';
import type { TypeIssue, HealthScore, BasicColumnStats } from '../types';

/**
 * Health score calculation weights
 */
const HEALTH_WEIGHTS = {
  completeness: 0.4, // 40% - missing data is critical
  uniqueness: 0.3,   // 30% - duplicates matter
  consistency: 0.3,  // 30% - data type issues
};

/**
 * Calculates overall data health score based on quality metrics
 * @param totalRows Total number of rows in the dataset
 * @param duplicateRows Number of duplicate rows
 * @param columnMetrics Array of column-level metrics
 * @param typeIssues Array of detected type issues
 * @returns Health score and breakdown
 */
export function calculateHealthScore(
  totalRows: number,
  duplicateRows: number,
  columnMetrics: Array<{
    nullCount: number;
    nullPercentage: number;
  }>,
  typeIssues: TypeIssue[]
): HealthScore {
  console.log(`[QualityAnalysis] Calculating health score for ${totalRows} rows, ${columnMetrics.length} columns`);
  
  // Completeness: average non-null percentage across columns
  const avgCompleteness = columnMetrics.length > 0 
    ? columnMetrics.reduce((sum, col) => sum + (100 - col.nullPercentage), 0) / columnMetrics.length
    : 100;
  
  // Uniqueness: inverse of duplicate percentage
  const duplicatePercentage = totalRows > 0 ? (duplicateRows / totalRows) * 100 : 0;
  const uniqueness = Math.max(0, 100 - duplicatePercentage);
  
  // Consistency: based on type issues with severity weighting
  let consistencyPenalty = 0;
  typeIssues.forEach(issue => {
    const severityMultiplier = issue.severity === 'high' ? 3 : issue.severity === 'medium' ? 2 : 1;
    const issuePenalty = severityMultiplier * Math.min(issue.count / totalRows * 100, 20); // Cap at 20% penalty per issue
    consistencyPenalty += issuePenalty;
  });
  const consistency = Math.max(0, 100 - consistencyPenalty);
  
  const healthScore = Math.round(
    avgCompleteness * HEALTH_WEIGHTS.completeness +
    uniqueness * HEALTH_WEIGHTS.uniqueness +
    consistency * HEALTH_WEIGHTS.consistency
  );
  
  const result: HealthScore = {
    healthScore: Math.max(0, Math.min(100, healthScore)),
    healthBreakdown: {
      completeness: Math.round(avgCompleteness),
      uniqueness: Math.round(uniqueness),
      consistency: Math.round(consistency)
    }
  };
  
  console.log(`[QualityAnalysis] Health score calculated:`, result);
  return result;
}

/**
 * Detects potential data type issues in a column
 * @param connection DuckDB connection
 * @param tableName Table name (should be properly escaped)
 * @param columnName Column name to analyze
 * @param expectedType Expected data type from schema
 * @returns Promise resolving to array of detected issues
 */
export async function detectTypeIssues(
  connection: duckdb.AsyncDuckDBConnection,
  tableName: string,
  columnName: string,
  expectedType: string
): Promise<TypeIssue[]> {
  const issues: TypeIssue[] = [];
  const lowerType = expectedType.toLowerCase();
  
  console.log(`[QualityAnalysis] Detecting type issues for ${columnName} (expected: ${expectedType})`);
  
  try {
    // For numeric columns, check for non-numeric strings
    if (isNumericColumn(expectedType)) {
      const numericIssueQuery = `
        SELECT 
          ${escapeColumnName(columnName)} as value,
          COUNT(*) as count
        FROM ${tableName}
        WHERE ${escapeColumnName(columnName)} IS NOT NULL 
          AND TRY_CAST(${escapeColumnName(columnName)} AS DOUBLE) IS NULL
        GROUP BY ${escapeColumnName(columnName)}
        ORDER BY count DESC
        LIMIT 5
      `;
      
      try {
        const result = await connection.query(numericIssueQuery);
        const examples = processDuckDBResult(result.toArray());
        
        if (examples.length > 0) {
          const totalIssues = examples.reduce((sum, row) => sum + safeToNumber(row.count), 0);
          issues.push({
            column: columnName,
            issue: 'Non-numeric values in numeric column',
            count: totalIssues,
            examples: examples.map(row => String(row.value)).slice(0, 3),
            severity: totalIssues > 100 ? 'high' : totalIssues > 10 ? 'medium' : 'low'
          });
        }
      } catch {
        // Ignore if query fails - might mean all values are properly numeric
      }
    }
    
    // For date columns, check for invalid dates
    if (isDateColumn(expectedType)) {
      const dateIssueQuery = `
        SELECT 
          ${escapeColumnName(columnName)} as value,
          COUNT(*) as count
        FROM ${tableName}
        WHERE ${escapeColumnName(columnName)} IS NOT NULL 
          AND TRY_CAST(${escapeColumnName(columnName)} AS DATE) IS NULL
        GROUP BY ${escapeColumnName(columnName)}
        ORDER BY count DESC
        LIMIT 5
      `;
      
      try {
        const result = await connection.query(dateIssueQuery);
        const examples = processDuckDBResult(result.toArray());
        
        if (examples.length > 0) {
          const totalIssues = examples.reduce((sum, row) => sum + safeToNumber(row.count), 0);
          issues.push({
            column: columnName,
            issue: 'Invalid date format',
            count: totalIssues,
            examples: examples.map(row => String(row.value)).slice(0, 3),
            severity: totalIssues > 50 ? 'high' : totalIssues > 5 ? 'medium' : 'low'
          });
        }
      } catch {
        // Ignore if query fails
      }
    }
    
    console.log(`[QualityAnalysis] Found ${issues.length} type issues for ${columnName}`);
    
  } catch (error) {
    console.error(`[QualityAnalysis] Error detecting type issues for ${columnName}:`, error);
  }
  
  return issues;
}

/**
 * Detects general data quality issues across all columns
 * @param connection DuckDB connection
 * @param tableName Table name (should be properly escaped)
 * @param columnNames Array of column names to analyze
 * @returns Promise resolving to quality issues summary
 */
export async function detectGeneralQualityIssues(
  connection: duckdb.AsyncDuckDBConnection,
  tableName: string,
  columnNames: string[]
): Promise<{
  emptyTable: boolean;
  allNullColumns: string[];
  suspiciouslyUniformColumns: string[];
  potentialDuplicateColumns: Array<{ col1: string; col2: string; similarity: number }>;
  highNullPercentageColumns: Array<{ column: string; nullPercentage: number }>;
}> {
  console.log(`[QualityAnalysis] Detecting general quality issues for ${columnNames.length} columns`);
  
  try {
    // Check if table is empty
    const rowCountQuery = `SELECT COUNT(*) as row_count FROM ${tableName}`;
    const rowCountResult = await connection.query(rowCountQuery);
    const totalRows = safeToNumber(processDuckDBResult(rowCountResult.toArray())[0].row_count);
    
    const emptyTable = totalRows === 0;
    
    if (emptyTable) {
      return {
        emptyTable: true,
        allNullColumns: [],
        suspiciouslyUniformColumns: [],
        potentialDuplicateColumns: [],
        highNullPercentageColumns: []
      };
    }
    
    // Find columns that are completely null
    const allNullColumns: string[] = [];
    const highNullPercentageColumns: Array<{ column: string; nullPercentage: number }> = [];
    
    for (const columnName of columnNames) {
      try {
        const nullCheckQuery = `
          SELECT 
            COUNT(*) as total_count,
            COUNT(${escapeColumnName(columnName)}) as non_null_count
          FROM ${tableName}
        `;
        
        const result = await connection.query(nullCheckQuery);
        const data = processDuckDBResult(result.toArray())[0];
        
        const totalCount = safeToNumber(data.total_count);
        const nonNullCount = safeToNumber(data.non_null_count);
        const nullPercentage = totalCount > 0 ? ((totalCount - nonNullCount) / totalCount) * 100 : 0;
        
        if (nonNullCount === 0) {
          allNullColumns.push(columnName);
        } else if (nullPercentage > 80) {
          highNullPercentageColumns.push({ column: columnName, nullPercentage });
        }
      } catch (error) {
        console.warn(`[QualityAnalysis] Failed to check nulls for column ${columnName}:`, error);
      }
    }
    
    // Find suspiciously uniform columns (all values are the same)
    const suspiciouslyUniformColumns: string[] = [];
    
    for (const columnName of columnNames) {
      if (allNullColumns.includes(columnName)) continue;
      
      try {
        const uniformQuery = `
          SELECT COUNT(DISTINCT ${escapeColumnName(columnName)}) as unique_count
          FROM ${tableName}
          WHERE ${escapeColumnName(columnName)} IS NOT NULL
        `;
        
        const result = await connection.query(uniformQuery);
        const uniqueCount = safeToNumber(processDuckDBResult(result.toArray())[0].unique_count);
        
        if (uniqueCount === 1) {
          suspiciouslyUniformColumns.push(columnName);
        }
      } catch (error) {
        console.warn(`[QualityAnalysis] Failed to check uniformity for column ${columnName}:`, error);
      }
    }
    
    const qualityIssues = {
      emptyTable,
      allNullColumns,
      suspiciouslyUniformColumns,
      potentialDuplicateColumns: [], // Complex analysis - could be added later
      highNullPercentageColumns
    };
    
    console.log(`[QualityAnalysis] Quality issues summary:`, {
      emptyTable,
      allNullColumns: allNullColumns.length,
      suspiciouslyUniformColumns: suspiciouslyUniformColumns.length,
      highNullColumns: highNullPercentageColumns.length
    });
    
    return qualityIssues;
    
  } catch (error) {
    console.error(`[QualityAnalysis] Error detecting general quality issues:`, error);
    return {
      emptyTable: false,
      allNullColumns: [],
      suspiciouslyUniformColumns: [],
      potentialDuplicateColumns: [],
      highNullPercentageColumns: []
    };
  }
}

/**
 * Generates quality recommendations based on detected issues
 * @param healthScore Overall health score results
 * @param typeIssues Array of type issues
 * @param generalIssues General quality issues
 * @param columnMetrics Basic column statistics
 * @returns Array of actionable recommendations
 */
export function generateQualityRecommendations(
  healthScore: HealthScore,
  typeIssues: TypeIssue[],
  generalIssues: Awaited<ReturnType<typeof detectGeneralQualityIssues>>,
  columnMetrics: BasicColumnStats[]
): string[] {
  console.log(`[QualityAnalysis] Generating quality recommendations`);
  
  const recommendations: string[] = [];
  
  // Health score recommendations
  if (healthScore.healthScore < 50) {
    recommendations.push("🔴 Critical: Data quality is very poor and needs immediate attention");
  } else if (healthScore.healthScore < 70) {
    recommendations.push("🟡 Warning: Data quality issues detected that should be addressed");
  } else if (healthScore.healthScore < 90) {
    recommendations.push("🟢 Good: Minor data quality improvements possible");
  } else {
    recommendations.push("✅ Excellent: Data quality is very good");
  }
  
  // Completeness recommendations
  if (healthScore.healthBreakdown.completeness < 80) {
    const highNullColumns = columnMetrics.filter(col => col.nullPercentage > 20);
    if (highNullColumns.length > 0) {
      recommendations.push(`📊 Consider handling missing data in: ${highNullColumns.map(col => col.name).join(', ')}`);
    }
  }
  
  // Uniqueness recommendations
  if (healthScore.healthBreakdown.uniqueness < 90) {
    recommendations.push("🔄 Consider removing or investigating duplicate rows");
  }
  
  // Type issue recommendations
  const highSeverityIssues = typeIssues.filter(issue => issue.severity === 'high');
  if (highSeverityIssues.length > 0) {
    recommendations.push(`⚠️ Fix critical data type issues in: ${highSeverityIssues.map(issue => issue.column).join(', ')}`);
  }
  
  const mediumSeverityIssues = typeIssues.filter(issue => issue.severity === 'medium');
  if (mediumSeverityIssues.length > 0) {
    recommendations.push(`🔧 Review data type issues in: ${mediumSeverityIssues.map(issue => issue.column).join(', ')}`);
  }
  
  // General issue recommendations
  if (generalIssues.allNullColumns.length > 0) {
    recommendations.push(`❌ Consider removing empty columns: ${generalIssues.allNullColumns.join(', ')}`);
  }
  
  if (generalIssues.suspiciouslyUniformColumns.length > 0) {
    recommendations.push(`📍 Review columns with only one value: ${generalIssues.suspiciouslyUniformColumns.join(', ')}`);
  }
  
  if (generalIssues.highNullPercentageColumns.length > 0) {
    const columnNames = generalIssues.highNullPercentageColumns.map(col => 
      `${col.column} (${col.nullPercentage.toFixed(1)}% null)`
    ).join(', ');
    recommendations.push(`🕳️ High missing data in: ${columnNames}`);
  }
  
  // Performance recommendations
  const highCardinalityColumns = columnMetrics.filter(col => col.cardinality > 0.9 && col.uniqueCount > 1000);
  if (highCardinalityColumns.length > 0) {
    recommendations.push(`🔑 Potential identifier columns: ${highCardinalityColumns.map(col => col.name).join(', ')}`);
  }
  
  // If no issues found
  if (recommendations.length === 1 && recommendations[0].includes("Excellent")) {
    recommendations.push("🎯 Data appears to be well-structured and clean");
    recommendations.push("📈 Consider advanced analytics or machine learning applications");
  }
  
  console.log(`[QualityAnalysis] Generated ${recommendations.length} recommendations`);
  return recommendations;
}

/**
 * Performs a comprehensive data quality assessment
 * @param connection DuckDB connection
 * @param tableName Table name (should be properly escaped)
 * @param columnMetrics Basic column statistics
 * @param duplicateRows Number of duplicate rows
 * @returns Promise resolving to complete quality assessment
 */
export async function performQualityAssessment(
  connection: duckdb.AsyncDuckDBConnection,
  tableName: string,
  columnMetrics: BasicColumnStats[],
  duplicateRows: number
): Promise<{
  healthScore: HealthScore;
  typeIssues: TypeIssue[];
  generalIssues: Awaited<ReturnType<typeof detectGeneralQualityIssues>>;
  recommendations: string[];
  summary: {
    totalIssues: number;
    criticalIssues: number;
    warningIssues: number;
    infoIssues: number;
  };
}> {
  console.log(`[QualityAnalysis] Performing comprehensive quality assessment`);
  
  try {
    const totalRows = columnMetrics.length > 0 ? columnMetrics[0].totalRows : 0;
    const columnNames = columnMetrics.map(col => col.name);
    
    // Run quality analyses in parallel
    const [typeIssuesArrays, generalIssues] = await Promise.all([
      Promise.all(columnMetrics.map(col => 
        detectTypeIssues(connection, tableName, col.name, col.type)
      )),
      detectGeneralQualityIssues(connection, tableName, columnNames)
    ]);
    
    // Flatten type issues from all columns
    const typeIssues = typeIssuesArrays.flat();
    
    // Calculate health score
    const healthScore = calculateHealthScore(totalRows, duplicateRows, columnMetrics, typeIssues);
    
    // Generate recommendations
    const recommendations = generateQualityRecommendations(
      healthScore, 
      typeIssues, 
      generalIssues, 
      columnMetrics
    );
    
    // Categorize issues by severity
    const criticalIssues = typeIssues.filter(issue => issue.severity === 'high').length + 
                          (generalIssues.emptyTable ? 1 : 0) + 
                          generalIssues.allNullColumns.length;
    
    const warningIssues = typeIssues.filter(issue => issue.severity === 'medium').length + 
                         generalIssues.suspiciouslyUniformColumns.length + 
                         generalIssues.highNullPercentageColumns.length;
    
    const infoIssues = typeIssues.filter(issue => issue.severity === 'low').length;
    
    const totalIssues = criticalIssues + warningIssues + infoIssues;
    
    const assessment = {
      healthScore,
      typeIssues,
      generalIssues,
      recommendations,
      summary: {
        totalIssues,
        criticalIssues,
        warningIssues,
        infoIssues
      }
    };
    
    console.log(`[QualityAnalysis] Quality assessment completed:`, {
      healthScore: healthScore.healthScore,
      totalIssues,
      recommendations: recommendations.length
    });
    
    return assessment;
    
  } catch (error) {
    console.error(`[QualityAnalysis] Quality assessment failed:`, error);
    
    // Return minimal assessment on error
    return {
      healthScore: { healthScore: 0, healthBreakdown: { completeness: 0, uniqueness: 0, consistency: 0 } },
      typeIssues: [],
      generalIssues: {
        emptyTable: false,
        allNullColumns: [],
        suspiciouslyUniformColumns: [],
        potentialDuplicateColumns: [],
        highNullPercentageColumns: []
      },
      recommendations: ["❌ Quality assessment failed - unable to analyze data"],
      summary: { totalIssues: 1, criticalIssues: 1, warningIssues: 0, infoIssues: 0 }
    };
  }
}