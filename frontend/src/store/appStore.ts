import { create } from "zustand";
import {
  get as getFromIndexDB,
  set as setToIndexDB,
  keys,
  del,
} from "idb-keyval";


import { DataSourceType } from "@/types/json";
import { 
  DataFile, 
  DataLoadWithDuckDBResult,
} from "@/types/multiFile";

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
  // Multi-file state
  /** Array of all imported files/datasets */
  files: DataFile[];
  /** ID of the currently active/viewed file */
  activeFileId: string | null;

  // UI state
  /** Currently active tab ID */
  activeTab: string;
  /** View mode for JSON data (table or tree) */
  jsonViewMode: "table" | "tree";
  /** Sidebar collapsed state */
  sidebarCollapsed: boolean;

  // Query history state
  /** Array of recent queries */
  recentQueries: SavedQuery[];
  /** Array of saved queries */
  savedQueries: SavedQuery[];

  // Multi-file actions
  /** Add a new file to the collection */
  addFile: (fileData: DataLoadWithDuckDBResult) => string;
  /** Remove a file from the collection */
  removeFile: (fileId: string) => void;
  /** Set the active file */
  setActiveFile: (fileId: string) => void;
  /** Close all files */
  closeAllFiles: () => void;
  /** Close all files except the specified one */
  closeOthersFiles: (keepFileId: string) => void;
  /** Update a file's data */
  updateFile: (fileId: string, updates: Partial<DataFile>) => void;

  // UI actions
  /** Change the active tab */
  setActiveTab: (tab: string) => void;
  /** Change the JSON view mode */
  setJsonViewMode: (mode: "table" | "tree") => void;
  /** Toggle sidebar collapsed state */
  toggleSidebar: () => void;
  /** Set sidebar collapsed state */
  setSidebarCollapsed: (collapsed: boolean) => void;

  // Legacy actions (for backward compatibility)
  /** Set the data grid content (updates active file) */
  setData: (data: string[][] | undefined) => void;
  /** Load data from parsed result (legacy - delegates to addFile) */
  loadData: (result: DataLoadWithDuckDBResult) => void;
  /** Reset state to initial values */
  resetState: () => void;

  // Query history actions
  /** Add a query to recent history */
  addRecentQuery: (query: string) => void;
  /** Save a query to favorites */
  saveQuery: (query: string, name?: string) => void;
  /** Delete a query */
  deleteQuery: (id: string) => void;
  loadQueriesFromStorage: () => void;
}

// Initial state
const initialState = {
  // Multi-file state
  files: [],
  activeFileId: null,

  // UI state
  activeTab: "preview",
  jsonViewMode: "table" as const,
  sidebarCollapsed: false,

  // Query history state
  recentQueries: [],
  savedQueries: [],
};

/**
 * Maximum number of recent queries to keep
 */
const MAX_RECENT_QUERIES = 50;

/**
 * Generate a unique file ID
 */
const generateFileId = (): string => {
  return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Generate a safe table name from file name
 */
const generateTableName = (fileName: string, fileId: string): string => {
  const safeName = fileName
    .replace(/\.[^/.]+$/, "") // Remove extension
    .replace(/[^a-zA-Z0-9_]/g, "_") // Replace non-alphanumeric with underscore
    .toLowerCase();
  
  // Add file ID suffix to ensure uniqueness
  const shortId = fileId.split('_').pop() || 'unknown';
  return `${safeName}_${shortId}`;
};

// Load sidebar collapsed state from localStorage on initialization
const getSavedSidebarState = () => {
  try {
    const savedState = localStorage.getItem("sidebar-collapsed");
    return savedState === "true"; // Convert string to boolean
  } catch (e) {
    return false; // Default to expanded if there's an error
  }
};

/**
 * Zustand store for managing application state
 */
export const useAppStore = create<AppState>((set, get) => ({
  ...initialState,
  sidebarCollapsed: getSavedSidebarState(),

  // Multi-file actions
  addFile: (fileData: DataLoadWithDuckDBResult): string => {
    const fileId = generateFileId();
    const tableName = fileData.tableName || generateTableName(fileData.fileName, fileId);
    
    const newFile: DataFile = {
      id: fileId,
      fileName: fileData.fileName,
      data: fileData.data,
      columnTypes: fileData.columnTypes,
      sourceType: fileData.sourceType || DataSourceType.CSV,
      rawData: fileData.rawData || null,
      jsonSchema: fileData.schema || null,
      rowCount: fileData.rowCount,
      columnCount: fileData.columnCount,
      loadedToDuckDB: fileData.loadedToDuckDB,
      tableName: tableName,
      isRemote: fileData.isRemote || false,
      remoteURL: fileData.remoteURL,
      remoteProvider: fileData.remoteProvider,
      googleSheets: fileData.googleSheets,
      importedAt: Date.now(),
      lastAccessedAt: Date.now(),
    };

    set(state => ({
      files: [...state.files, newFile],
      activeFileId: fileId, // Auto-switch to new file
    }));

    // Load queries from storage when first file is added
    if (get().files.length === 1) {
      get().loadQueriesFromStorage();
    }

    return fileId;
  },

  removeFile: (fileId: string) => {
    set(state => {
      const newFiles = state.files.filter(f => f.id !== fileId);
      let newActiveFileId = state.activeFileId;
      
      // If we're removing the active file, switch to another file
      if (state.activeFileId === fileId) {
        if (newFiles.length > 0) {
          // Try to find the next file, or fallback to the first
          const currentIndex = state.files.findIndex(f => f.id === fileId);
          const nextFile = newFiles[Math.min(currentIndex, newFiles.length - 1)];
          newActiveFileId = nextFile.id;
        } else {
          newActiveFileId = null;
        }
      }
      
      return {
        files: newFiles,
        activeFileId: newActiveFileId,
      };
    });
  },

  setActiveFile: (fileId: string) => {
    set(state => {
      // Update last accessed time
      const updatedFiles = state.files.map(file => 
        file.id === fileId 
          ? { ...file, lastAccessedAt: Date.now() }
          : file
      );
      
      return {
        files: updatedFiles,
        activeFileId: fileId,
      };
    });
  },

  closeAllFiles: () => {
    set({ files: [], activeFileId: null });
  },

  closeOthersFiles: (keepFileId: string) => {
    set(state => ({
      files: state.files.filter(f => f.id === keepFileId),
      activeFileId: keepFileId,
    }));
  },

  updateFile: (fileId: string, updates: Partial<DataFile>) => {
    set(state => ({
      files: state.files.map(file => 
        file.id === fileId 
          ? { ...file, ...updates, lastAccessedAt: Date.now() }
          : file
      ),
    }));
  },

  // UI actions
  setActiveTab: (activeTab) => set({ activeTab }),

  setJsonViewMode: (jsonViewMode) => set({ jsonViewMode }),

  toggleSidebar: () => {
    const newState = !get().sidebarCollapsed;
    localStorage.setItem("sidebar-collapsed", String(newState));
    set({ sidebarCollapsed: newState });
  },

  setSidebarCollapsed: (collapsed) => {
    localStorage.setItem("sidebar-collapsed", String(collapsed));
    set({ sidebarCollapsed: collapsed });
  },

  // Legacy actions
  setData: (data) => {
    // For backward compatibility, update active file if exists
    const state = get();
    const activeFile = state.files.find(f => f.id === state.activeFileId);
    if (activeFile && data) {
      get().updateFile(activeFile.id, { data });
    }
  },

  // Load data from result (legacy - now delegates to addFile)
  loadData: (result: DataLoadWithDuckDBResult) => {
    get().addFile(result);
  },

  // Reset state
  resetState: () =>
    set({ 
      ...initialState, 
      sidebarCollapsed: get().sidebarCollapsed 
    }),

  // Query history actions (unchanged)
  addRecentQuery: (query) => {
    if (!query.trim()) return;

    const id = `recent-query:${Date.now()}`;
    const recentQuery: SavedQuery = {
      id,
      name: `Query at ${new Date().toLocaleString()}`,
      query,
      timestamp: Date.now(),
      isFavorite: false,
    };

    setToIndexDB(id, recentQuery).catch(console.error);

    set((state) => ({
      recentQueries: [
        recentQuery,
        ...state.recentQueries
          .filter((q) => q.query !== query)
          .slice(0, MAX_RECENT_QUERIES - 1),
      ],
    }));
  },

  loadQueriesFromStorage: async () => {
    try {
      const allKeys = await keys();
      const savedKeys = allKeys.filter((k) =>
        String(k).startsWith("saved-query:")
      );
      const recentKeys = allKeys.filter((k) =>
        String(k).startsWith("recent-query:")
      );

      const savedQueryPromises = savedKeys.map((key) => getFromIndexDB(key));
      const savedQueries = await Promise.all(savedQueryPromises);

      const recentQueryPromises = recentKeys.map((key) => getFromIndexDB(key));
      const recentQueries = await Promise.all(recentQueryPromises);

      set({
        savedQueries: savedQueries.sort((a, b) => b.timestamp - a.timestamp),
        recentQueries: recentQueries.sort((a, b) => b.timestamp - a.timestamp),
      });
    } catch (err) {
      console.error("Error loading queries from storage:", err);
    }
  },

  saveQuery: (query, name) => {
    if (!query.trim()) return;

    const id = `saved-query:${Date.now()}`;
    const savedQuery: SavedQuery = {
      id,
      name: name || `Saved Query ${new Date().toLocaleString()}`,
      query,
      timestamp: Date.now(),
      isFavorite: true,
    };

    setToIndexDB(id, savedQuery).catch(console.error);

    set((state) => ({
      savedQueries: [savedQuery, ...state.savedQueries],
    }));
  },

  deleteQuery: (id) => {
    del(id).catch(console.error);

    if (id.startsWith("saved-query:")) {
      set((state) => ({
        savedQueries: state.savedQueries.filter((q) => q.id !== id),
      }));
    } else {
      set((state) => ({
        recentQueries: state.recentQueries.filter((q) => q.id !== id),
      }));
    }
  },
}));