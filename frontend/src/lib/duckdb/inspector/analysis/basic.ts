import * as duckdb from '@duckdb/duckdb-wasm';
import { processDuckDBResult } from '../utils/bigint';
import { escapeColumnName } from '../utils/filtering';
import type { BasicColumnStats } from '../types';

/**
 * Performs basic statistical analysis on a column
 * @param connection DuckDB connection
 * @param tableName Table name (should be properly escaped)
 * @param columnName Column name to analyze
 * @param columnType Column data type from schema
 * @returns Promise resolving to basic column statistics
 */
export async function getBasicColumnStats(
  connection: duckdb.AsyncDuckDBConnection,
  tableName: string,
  columnName: string,
  columnType: string
): Promise<BasicColumnStats> {
  console.log(`[BasicAnalysis] Getting basic stats for ${columnName}`);
  
  const basicStatsQuery = `
    SELECT 
      COUNT(*) as total_count,
      COUNT(${escapeColumnName(columnName)}) as non_null_count,
      COUNT(DISTINCT ${escapeColumnName(columnName)}) as unique_count
    FROM ${tableName}
  `;

  console.log(`[BasicAnalysis] Query:`, basicStatsQuery);
  
  const result = await connection.query(basicStatsQuery);
  const data = processDuckDBResult(result.toArray())[0];

  const totalRows = Number(data.total_count);
  const nonNullCount = Number(data.non_null_count);
  const uniqueCount = Number(data.unique_count);
  
  const nullCount = totalRows - nonNullCount;
  const nullPercentage = totalRows > 0 ? (nullCount / totalRows) * 100 : 0;
  const cardinality = totalRows > 0 ? uniqueCount / totalRows : 0;

  const stats: BasicColumnStats = {
    name: columnName,
    type: columnType,
    totalRows,
    nullCount,
    nullPercentage,
    uniqueCount,
    cardinality
  };

  console.log(`[BasicAnalysis] ${columnName} stats:`, {
    nullCount,
    nullPercentage: nullPercentage.toFixed(2) + '%',
    uniqueCount,
    cardinality: cardinality.toFixed(4)
  });

  return stats;
}

/**
 * Gets duplicate row information for the entire table
 * @param connection DuckDB connection
 * @param tableName Table name (should be properly escaped)
 * @returns Promise resolving to duplicate row information
 */
export async function getDuplicateRowInfo(
  connection: duckdb.AsyncDuckDBConnection,
  tableName: string
): Promise<{
  totalRows: number;
  duplicateRows: number;
  duplicatePercentage: number;
}> {
  console.log(`[BasicAnalysis] Checking for duplicate rows in table`);
  
  const duplicateQuery = `
    WITH row_counts AS (
      SELECT COUNT(*) as total_count FROM ${tableName}
    ),
    unique_counts AS (
      SELECT COUNT(*) as unique_count 
      FROM (SELECT DISTINCT * FROM ${tableName}) t
    )
    SELECT rc.total_count, uc.unique_count
    FROM row_counts rc, unique_counts uc
  `;
  
  const result = await connection.query(duplicateQuery);
  const data = processDuckDBResult(result.toArray())[0];
  
  const totalRows = Number(data.total_count);
  const uniqueRows = Number(data.unique_count);
  const duplicateRows = totalRows - uniqueRows;
  const duplicatePercentage = totalRows > 0 ? (duplicateRows / totalRows) * 100 : 0;

  console.log(`[BasicAnalysis] Duplicate analysis:`, {
    totalRows,
    uniqueRows,
    duplicateRows,
    duplicatePercentage: duplicatePercentage.toFixed(2) + '%'
  });

  return {
    totalRows,
    duplicateRows,
    duplicatePercentage
  };
}

/**
 * Gets row count for a table
 * @param connection DuckDB connection
 * @param tableName Table name (should be properly escaped)
 * @returns Promise resolving to row count
 */
export async function getRowCount(
  connection: duckdb.AsyncDuckDBConnection,
  tableName: string
): Promise<number> {
  const countQuery = `SELECT COUNT(*) as row_count FROM ${tableName}`;
  const result = await connection.query(countQuery);
  const data = processDuckDBResult(result.toArray())[0];
  return Number(data.row_count);
}

/**
 * Validates that a table exists and has data
 * @param connection DuckDB connection
 * @param tableName Table name (should be properly escaped)
 * @returns Promise resolving to validation result
 */
export async function validateTable(
  connection: duckdb.AsyncDuckDBConnection,
  tableName: string
): Promise<{
  exists: boolean;
  hasData: boolean;
  rowCount: number;
  error?: string;
}> {
  try {
    const rowCount = await getRowCount(connection, tableName);
    
    return {
      exists: true,
      hasData: rowCount > 0,
      rowCount
    };
  } catch (error) {
    console.error(`[BasicAnalysis] Table validation failed:`, error);
    
    return {
      exists: false,
      hasData: false,
      rowCount: 0,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}