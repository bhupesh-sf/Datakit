import { create } from 'zustand';

import { ColumnType } from '@/types/csv';
import { DataSourceType, JsonField } from '@/types/json';

/**
 * Interface representing JSON schema information
 */
interface JsonSchema {
  /** Array of JSON field definitions */
  fields?: JsonField[];
  /** Indicates if JSON data has nested structure */
  isNested: boolean;
  /** Depth of arrays in JSON structure */
  arrayDepth: number;
}

/**
 * Interface for application state managed by Zustand
 */
interface AppState {
  // Data state
  /** Two-dimensional string array representing tabular data */
  data: string[][] | undefined;
  /** Array of column type definitions for formatting */
  columnTypes: ColumnType[];
  /** Name of the currently loaded file */
  fileName: string;
  /** Type of data source (CSV, JSON, etc.) */
  sourceType: DataSourceType;
  /** Raw data for JSON view (preserves object structure) */
  rawData: any | null;
  /** Schema information for JSON data */
  jsonSchema: JsonSchema | null;
  
  // Stats
  /** Total number of rows in the dataset */
  rowCount: number;
  /** Total number of columns in the dataset */
  columnCount: number;
  /** Whether data is loaded into DuckDB for querying */
  inDuckDB: boolean;
  /** Name of the DuckDB table if loaded */
  tableName: string | undefined;
  
  // UI state
  /** Currently active tab ID */
  activeTab: string;
  /** View mode for JSON data (table or tree) */
  jsonViewMode: 'table' | 'tree';
  
  // Actions
  /** Set the data grid content */
  setData: (data: string[][] | undefined) => void;
  /** Change the active tab */
  setActiveTab: (tab: string) => void;
  /** Change the JSON view mode */
  setJsonViewMode: (mode: 'table' | 'tree') => void;
  
  /** Load data from parsed result */
  loadData: (result: any) => void;
  
  /** Reset state to initial values */
  resetState: () => void;
}

// Initial state
const initialState = {
  // Data state
  data: undefined,
  columnTypes: [],
  fileName: '',
  sourceType: DataSourceType.CSV,
  rawData: null,
  jsonSchema: null,
  
  // Stats
  rowCount: 0,
  columnCount: 0,
  inDuckDB: false,
  tableName: undefined,
  
  // UI state
  activeTab: 'preview',
  jsonViewMode: 'table' as const,
};

/**
 * Zustand store for managing application state
 */
export const useAppStore = create<AppState>((set) => ({
  ...initialState,
  
  // Actions
  setData: (data) => set({ data }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setJsonViewMode: (jsonViewMode) => set({ jsonViewMode }),
  
  // Load data from result
  loadData: (result) => set({
    data: result.data,
    columnTypes: result.columnTypes,
    fileName: result.fileName,
    sourceType: result.sourceType || DataSourceType.CSV,
    rawData: result.rawData || null,
    jsonSchema: result.schema || null,
    rowCount: result.rowCount,
    columnCount: result.columnCount,
    inDuckDB: result.loadedToDuckDB,
    tableName: result.tableName,
    // Intelligently set view mode if needed
    jsonViewMode: result.sourceType === DataSourceType.JSON && 
                 result.schema?.isNested ? 'tree' : 'table',
  }),
  
  // Reset state
  resetState: () => set(initialState),
}));