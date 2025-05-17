import * as duckdb from "@duckdb/duckdb-wasm";
import { ColumnType } from "@/types/csv";

import { TableCreationOptions, TableSchema } from "./types";

/**
 * Cleans an SQL query by removing comments and normalizing whitespace
 * 
 * @param sql - Raw SQL query that may contain comments
 * @returns Cleaned SQL query with comments removed
 */
export function cleanSqlQuery(sql: string): string {
  return sql
    .replace(/--.*$/gm, '') // Remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
    .trim(); // Remove leading/trailing whitespace
}

/**
 * Determines if a query is a SELECT statement by analyzing its structure
 * 
 * @param sql - SQL query to analyze (should be cleaned of comments first)
 * @returns True if the query is a SELECT statement
 */
export function isSelectQuery(sql: string): boolean {
  return /^\s*SELECT\b/i.test(sql);
}

/**
 * Adds pagination to a SELECT query using LIMIT and OFFSET
 * 
 * @param sql - Original SQL query
 * @param limit - Maximum number of rows to return
 * @param offset - Number of rows to skip
 * @returns Modified SQL query with pagination added
 */
export function addPaginationToQuery(sql: string, limit: number, offset: number): string {
  const cleanedSQL = cleanSqlQuery(sql);
  const noSemicolon = cleanedSQL.replace(';', '');
  
  // Only add LIMIT if not already present
  if (!noSemicolon.toUpperCase().includes("LIMIT")) {
    return `${noSemicolon} LIMIT ${limit} OFFSET ${offset}`;
  }
  
  return sql;
}

/**
 * Creates a COUNT query to get the total number of rows for a SELECT query
 * 
 * @param sql - Original SELECT query
 * @returns A new query that counts the total rows
 */
export function createCountQuery(sql: string): string {
  const noSemicolon = sql.replace(';', '');
  return `SELECT CAST(COUNT(*) AS INTEGER) as total_rows FROM (${noSemicolon}) as count_query`;
}

/**
 * Escapes a table name for use in SQL queries
 * 
 * @param tableName - Raw table name
 * @returns Properly escaped table name
 */
export function escapeTableName(tableName: string): string {
  return `"${tableName.replace(/"/g, '""')}"`;
}

/**
 * Converts from ColumnType to DuckDB data type
 * 
 * @param colType - Column type from application schema
 * @returns Equivalent DuckDB data type
 */
export function duckDBTypeFromColumnType(colType: ColumnType): string {
  switch (colType) {
    case ColumnType.Number:
      return "DOUBLE";
    case ColumnType.Boolean:
      return "BOOLEAN";
    case ColumnType.Date:
      return "VARCHAR"; // Using VARCHAR for dates to avoid parsing issues
    case ColumnType.Array:
    case ColumnType.Object:
      return "TEXT"; // Use TEXT instead of JSON for better compatibility
    default:
      return "VARCHAR";
  }
}

/**
 * Generates column definitions SQL for CREATE TABLE statements
 * 
 * @param options - Table creation options including headers and column types
 * @returns SQL column definitions string
 */
export function generateColumnDefinitions({ headers, columnTypes }: TableCreationOptions): string {
  return headers
    .map((header, index) => {
      const type =
        index < columnTypes.length
          ? duckDBTypeFromColumnType(columnTypes[index])
          : "VARCHAR";
      // Properly escape header names with double quotes
      return `"${header.replace(/"/g, '""')}" ${type}`;
    })
    .join(", ");
}




/**
 * Ensure all BigInt values are converted to safe JSON-compatible values
 * Can be applied to any structure (object, array, primitive)
 * 
 * @param value - Any value that might contain BigInt
 * @returns Same structure with BigInt values converted to Number or String
 */
export function ensureSafeJSON(value: any): any {
  if (typeof value === "bigint") {
    // Convert to number if within safe integer range, otherwise string
    if (value <= Number.MAX_SAFE_INTEGER && value >= Number.MIN_SAFE_INTEGER) {
      return Number(value);
    } else {
      return value.toString();
    }
  } else if (Array.isArray(value)) {
    return value.map(ensureSafeJSON);
  } else if (value !== null && typeof value === "object") {
    const result: Record<string, any> = {};
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        result[key] = ensureSafeJSON(value[key]);
      }
    }
    return result;
  }
  return value;
}


/**
 * Safely processes DuckDB result data, handling BigInt conversions
 * 
 * @param rawData - Raw array data from DuckDB query result
 * @returns Processed array with BigInt values converted to Number or String
 */
export function processDuckDBResult(rawData: any[]): any[] {
  return rawData.map((row) => {
    const processedRow: Record<string, any> = {};
    
    // For each property in the row
    for (const key in row) {
      if (Object.prototype.hasOwnProperty.call(row, key)) {
        const value = row[key];
        
        // Convert BigInt to Number if it's within safe integer range
        if (typeof value === "bigint") {
          if (value <= Number.MAX_SAFE_INTEGER && value >= Number.MIN_SAFE_INTEGER) {
            processedRow[key] = Number(value);
          } else {
            // For larger values, convert to string to avoid precision loss
            processedRow[key] = value.toString();
          }
        } else {
          processedRow[key] = value;
        }
      }
    }
    
    return processedRow;
  });
}

/**
 * Formats a value for use in SQL statements, handling various types
 * 
 * @param val - Value to format
 * @returns SQL-compatible representation of the value
 */
export function formatValueForSQL(val: any): string {
  if (val === null || val === undefined || val === "") {
    return "NULL";
  }
  
  // If it's already a string
  const stringVal = String(val);
  
  // Check if it's a number
  const num = Number(val);
  if (!isNaN(num) && stringVal.trim() !== "") {
    return stringVal; // Numeric value (no quotes)
  }
  
  // Check if it's a boolean
  const lowerVal = stringVal.toLowerCase();
  if (lowerVal === "true" || lowerVal === "false") {
    return lowerVal.toUpperCase();
  }
  
  // Default to string with proper escaping
  return `'${stringVal.replace(/'/g, "''")}'`;
}

/**
 * Extracts table schema from DuckDB result
 * 
 * @param result - DuckDB query result containing schema info
 * @returns Array of column definitions
 */
export function extractTableSchema(result: any[]): TableSchema[] {
  return result.map((col) => ({
    name: col.name,
    type: col.type,
  }));
}

/**
 * Generates a safe table name from a file name
 * 
 * @param fileName - Original file name
 * @returns Safe table name for SQL
 */
export function safeTableNameFromFileName(fileName: string): string {
  return fileName
    .replace(/\.[^/.]+$/, "") // Remove extension
    .replace(/[^a-zA-Z0-9_]/g, "_"); // Replace invalid chars with underscore
}

/**
 * Yields control back to the browser to prevent UI freezing
 * 
 * @returns Promise that resolves after yielding control
 */
export async function yieldToMainThread(): Promise<void> {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}