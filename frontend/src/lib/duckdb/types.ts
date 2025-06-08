import * as duckdb from "@duckdb/duckdb-wasm";
import { ColumnType } from "@/types/csv";

/**
 * Result of a paginated query including the data and pagination metadata
 */
export interface PaginatedQueryResult {
  /** Array of result objects for the current page */
  data: unknown[];
  /** Column names from the query result */
  columns: string[];
  /** Total number of rows in the complete result set */
  totalRows: number;
  /** Current page number (1-based) */
  page: number;
  /** Number of rows per page */
  pageSize: number;
  /** Total number of pages based on rowsPerPage */
  totalPages: number;
  /** Execution time of the query in milliseconds */
  queryTime: number;
}

/**
 * Options for executing a paginated query
 */
export interface PaginatedQueryOptions {
  /** SQL query to execute */
  sql: string;
  /** Page number to retrieve (1-based) */
  page: number;
  /** Number of rows per page */
  pageSize: number;
  /** Whether to automatically add LIMIT and OFFSET clauses */
  applyPagination?: boolean;
  /** Whether to execute a COUNT query to get total rows */
  countTotalRows?: boolean;
}

/**
 * Options for importing a file directly
 */
export interface FileImportOptions {
  /** File to import */
  file: File;
  /** Whether to attempt converting known formats */
  convertIfNeeded?: boolean;
  /** Progress callback function */
  onProgress?: (progress: number) => void;
}

/**
 * Options for creating a table
 */
export interface TableCreationOptions {
  /** Table name */
  tableName: string;
  /** Column headers */
  headers: string[];
  /** Column data types */
  columnTypes: ColumnType[];
}

/**
 * Result of a file import operation
 */
export interface FileImportResult {
  /** Name of the created table */
  tableName: string;
  /** Number of rows in the imported data */
  rowCount: number;
  /** Original file format (if converted) */
  originalFormat?: string;
  /** Whether the file was converted during import */
  convertedToCsv?: boolean;
}

/**
 * Schema information for a table
 */
export interface TableSchema {
  /** Column name */
  name: string;
  /** DuckDB data type */
  type: string;
}

/**
 * Core DuckDB objects initialized for use
 */
export interface DuckDBInstance {
  /** The DuckDB database instance */
  db: duckdb.AsyncDuckDB;
  /** A connection to the database */
  conn: duckdb.AsyncDuckDBConnection;
}


export interface ImportResult {
  tableName: string;
  rowCount: number | boolean;
  convertedToCsv?: boolean;
  isView?: boolean;
  objectType?: 'table' | 'view';
  fileSizeMB?: number;
  fileType?: string;
  instantImport?: boolean;
  columnCount?: number;
  txtFormat?: string;
  delimiter?: string;
  delimiterName?: string;
}

export interface StreamingImportResult extends ImportResult {
  rowCount: number | boolean;
}

export interface DirectImportResult {
  tableName: string;
  rowCount: number;
  originalFormat?: string;
  convertedToCsv?: boolean;
}