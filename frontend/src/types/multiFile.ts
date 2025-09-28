import { ColumnType } from "@/types/csv";
import { DataSourceType } from "@/types/json";
import { ViewMode } from "@/components/navigation/ViewModeSelector";

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
 * PostgreSQL specific metadata
 */
export interface PostgreSQLMetadata {
  connectionId: string;
  connectionName: string;
  schema: string;
  table: string;
  originalRowCount?: number;
  queryUsed?: string;
}

/**
 * Remote source providers
 */
export type RemoteSourceProvider = "web" | "s3" | "gcs" | "google_sheets" | "postgresql";

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
  /** PostgreSQL specific metadata */
  postgresql?: PostgreSQLMetadata;
  
  // Timestamps
  /** When the file was imported */
  importedAt: number;
  /** When the file was last accessed/viewed */
  lastAccessedAt: number;
  
  // View mode
  /** Current view mode for this file */
  viewMode?: ViewMode;
  
  // Split view configuration
  /** Split view configuration for this file */
  splitView?: {
    isActive: boolean;
    partnerId: string | null;
    position: 'left' | 'right';
  };
  
  // File-specific workspace states
  /** SQL workspace state for this file */
  sqlState?: {
    query: string;
    lastExecutedQuery?: string;
    history: Array<{
      id: string;
      query: string;
      timestamp: number;
      executionTime?: number;
    }>;
    lastExecutedAt?: number;
  };
  
  /** Notebook workspace state for this file */
  notebookState?: {
    cells: any[]; // Python notebook cells
    kernelId?: string;
    lastExecutedAt?: number;
  };
  
  /** AI workspace state for this file */
  aiState?: {
    // Conversation history
    messages: Array<{
      role: 'system' | 'user' | 'assistant';
      content: string;
    }>;
    conversationId: string;
    
    // Current streaming/response state
    currentResponse: string | null;
    streamingResponse: string;
    isProcessing: boolean;
    currentError: string | null;
    
    // Token usage tracking
    currentTokenUsage: { input: number; output: number } | null;
    visualizationTokenUsage: { input: number; output: number } | null;
    
    // Query results
    queryResults: {
      data: any[] | null;
      columns: string[] | null;
      isLoading: boolean;
      error: string | null;
      totalRows: number;
      currentPage: number;
      totalPages: number;
      rowsPerPage: number;
    } | null;
    
    // Visualization state
    activeVisualizationId?: string;
    visualizations?: Array<{
      id: string;
      data: any[];
      config: any;
      chartType: string;
      sql: string;
      insights?: any[];
    }>;
    
    // Context and metadata
    tableContext?: {
      tableName: string;
      schema: Array<{ name: string; type: string }>;
      rowCount?: number;
      description?: string;
    };
    
    // Timestamps
    createdAt: number;
    lastMessageAt?: number;
    lastSavedAt?: number;
  };
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
  splitView?: {
    isActive: boolean;
    partnerId: string | null;
  };
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
  postgresql?: PostgreSQLMetadata;
}