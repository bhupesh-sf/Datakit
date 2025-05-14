
import { create } from 'zustand';
import { get as getFromIndexDB, set as setToIndexDB, keys, del } from 'idb-keyval';

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
 * Interface for a saved or recent query
 */
export interface SavedQuery {
  /** Unique identifier for the query */
  id: string;
  /** User-provided or auto-generated name */
  name: string;
  /** SQL query text */
  query: string;
  /** Timestamp when the query was saved */
  timestamp: number;
  /** Whether this is a favorite/saved query */
  isFavorite: boolean;
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
  
  // Query history state
  /** Array of recent queries */
  recentQueries: SavedQuery[];
  /** Array of saved queries */
  savedQueries: SavedQuery[];
  
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
  
  // Query history actions
  /** Add a query to recent history */
  addRecentQuery: (query: string) => void;
  /** Save a query to favorites */
  saveQuery: (query: string, name?: string) => void;
  /** Delete a query */
  deleteQuery: (id: string) => void;
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
  
  // Query history state
  recentQueries: [],
  savedQueries: [],
};

/**
 * Maximum number of recent queries to keep
 */
const MAX_RECENT_QUERIES = 50;

/**
 * Zustand store for managing application state
 */
export const useAppStore = create<AppState>((set, get) => ({
  ...initialState,
  
  // Actions
  setData: (data) => set({ data }),
  
  setActiveTab: (activeTab) => set({ activeTab }),
  
  setJsonViewMode: (jsonViewMode) => set({ jsonViewMode }),
  
  // Load data from result
  loadData: (result) => {
    // Update app state with data from result
    set({
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
    });
    
    // Load saved queries and recent queries from IndexedDB
    keys().then(allKeys => {
      const savedKeys = allKeys.filter(k => String(k).startsWith('saved-query:'));
      const recentKeys = allKeys.filter(k => String(k).startsWith('recent-query:'));
      
      // Load saved queries
      Promise.all(savedKeys.map(key => getFromIndexDB(key)))
        .then(savedQueries => {
          set({ savedQueries: savedQueries.sort((a, b) => b.timestamp - a.timestamp) });
        })
        .catch(console.error);
      
      // Load recent queries
      Promise.all(recentKeys.map(key => getFromIndexDB(key)))
        .then(recentQueries => {
          set({ recentQueries: recentQueries.sort((a, b) => b.timestamp - a.timestamp) });
        })
        .catch(console.error);
    }).catch(console.error);
  },
  
  // Reset state
  resetState: () => set(initialState),
  
  // Query history actions
  addRecentQuery: (query) => {
    if (!query.trim()) return;
    
    const id = `recent-query:${Date.now()}`;
    const recentQuery: SavedQuery = {
      id,
      name: `Query at ${new Date().toLocaleString()}`,
      query,
      timestamp: Date.now(),
      isFavorite: false
    };
    
    // Save to IndexedDB
    setToIndexDB(id, recentQuery).catch(console.error);
    
    // Update state - add to beginning, limit to max entries
    set(state => ({
      recentQueries: [
        recentQuery, 
        ...state.recentQueries.filter(q => q.query !== query).slice(0, MAX_RECENT_QUERIES - 1)
      ]
    }));
  },
  
  saveQuery: (query, name) => {
    if (!query.trim()) return;
    
    const id = `saved-query:${Date.now()}`;
    const savedQuery: SavedQuery = {
      id,
      name: name || `Saved Query ${new Date().toLocaleString()}`,
      query,
      timestamp: Date.now(),
      isFavorite: true
    };
    
    // Save to IndexedDB
    setToIndexDB(id, savedQuery).catch(console.error);
    
    // Update state
    set(state => ({
      savedQueries: [savedQuery, ...state.savedQueries]
    }));
  },
  
  deleteQuery: (id) => {
    // Delete from IndexedDB
    del(id).catch(console.error);
    
    // Update state
    if (id.startsWith('saved-query:')) {
      set(state => ({
        savedQueries: state.savedQueries.filter(q => q.id !== id)
      }));
    } else {
      set(state => ({
        recentQueries: state.recentQueries.filter(q => q.id !== id)
      }));
    }
  }
}));