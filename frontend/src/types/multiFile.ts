import { ColumnType } from "@/types/csv";
import { DataSourceType } from "@/types/json";

/**
 * Interface representing JSON schema information
 */
export interface JsonSchema {
  /** Array of JSON field definitions */
  fields?: any; //JsonField[];
  /** Indicates if JSON data has nested structure */
  isNested: boolean;
  /** Depth of arrays in JSON structure */
  arrayDepth: number;
}

/**
 * Google Sheets specific metadata
 */
export interface GoogleSheetsMetadata {
  sheetName: string;
  docId: string | null;
  sheetId: string | null;
  format: 'csv' | 'xlsx' | 'html' | null;
  importedAt: number;
}

/**
 * Remote source providers
 */
export type RemoteSourceProvider = "web" | "s3" | "gcs" | "google_sheets";

/**
 * Individual data file/dataset
 */
export interface DataFile {
  /** Unique identifier for the file */
  id: string;
  /** Display name of the file */
  fileName: string;
  /** Two-dimensional string array representing tabular data */
  data: string[][];
  /** Array of column type definitions for formatting */
  columnTypes: ColumnType[];
  /** Type of data source (CSV, JSON, etc.) */
  sourceType: DataSourceType;
  /** Raw data for JSON view (preserves object structure) */
  rawData?: any | null;
  /** Schema information for JSON data */
  jsonSchema?: JsonSchema | null;
  
  // Stats
  /** Total number of rows in the dataset */
  rowCount: number;
  /** Total number of columns in the dataset */
  columnCount: number;
  /** Whether data is loaded into DuckDB for querying */
  loadedToDuckDB: boolean;
  /** Name of the DuckDB table if loaded */
  tableName: string;
  
  // Remote source info
  /** Whether this is from a remote source */
  isRemote?: boolean;
  /** Remote URL if applicable */
  remoteURL?: string;
  /** Remote provider type */
  remoteProvider?: RemoteSourceProvider;
  /** Google Sheets specific metadata */
  googleSheets?: GoogleSheetsMetadata;
  
  // Timestamps
  /** When the file was imported */
  importedAt: number;
  /** When the file was last accessed/viewed */
  lastAccessedAt: number;
}

/**
 * File tab information for UI display
 */
export interface FileTab {
  id: string;
  fileName: string;
  sourceType: DataSourceType;
  isActive: boolean;
  isDirty?: boolean; // For future unsaved changes
  remoteProvider?: RemoteSourceProvider;
  hasGoogleSheetsMetadata?: boolean;
}

/**
 * Result from importing a file
 */
export interface DataLoadWithDuckDBResult {
  data: string[][];
  columnTypes: ColumnType[];
  fileName: string;
  rowCount: number;
  columnCount: number;
  sourceType?: DataSourceType;
  rawData?: any;
  schema?: JsonSchema;
  loadedToDuckDB: boolean;
  tableName?: string;
  isRemote?: boolean;
  remoteURL?: string;
  remoteProvider?: RemoteSourceProvider;
  googleSheets?: GoogleSheetsMetadata;
}