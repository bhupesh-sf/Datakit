import { create } from "zustand";
import {
  get as getFromIndexDB,
  set as setToIndexDB,
  keys,
  del,
} from "idb-keyval";

import { DataSourceType } from "@/types/json";
import { DataFile, DataLoadWithDuckDBResult } from "@/types/multiFile";
import { ImportProvider } from "@/types/remoteImport";

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
 * Interface for split view state
 */
interface SplitViewState {
  /** Whether split view is currently active */
  isActive: boolean;
  /** ID of the file in the left panel */
  leftFileId: string | null;
  /** ID of the file in the right panel */
  rightFileId: string | null;
  /** Split ratio (0.5 = 50/50 split) */
  splitRatio: number;
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

  // Split view state
  /** Side-by-side file comparison state */
  splitView: SplitViewState;

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
  /** Pending query to be loaded in query tab */
  pendingQuery: string | null;

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

  // Split view actions
  /** Enable split view with two files */
  setSplitView: (leftFileId: string, rightFileId: string) => void;
  /** Close split view and return to single file view */
  closeSplitView: () => void;
  /** Update the split ratio */
  updateSplitRatio: (ratio: number) => void;
  /** Swap the left and right files */
  swapSplitFiles: () => void;
  /** Set split view for a specific file */
  setFileSplitView: (fileId: string, partnerId: string | null, position?: 'left' | 'right') => void;
  /** Clear split view for a specific file */
  clearFileSplitView: (fileId: string) => void;

  // UI actions
  /** Change the active tab */
  setActiveTab: (tab: string) => void;
  /** Change the JSON view mode */
  setJsonViewMode: (mode: "table" | "tree") => void;
  /** Toggle sidebar collapsed state */
  toggleSidebar: () => void;
  /** Set sidebar collapsed state */
  setSidebarCollapsed: (collapsed: boolean) => void;
  isRemoteModalOpen: boolean;
  activeProviderRemoteModal: ImportProvider;

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
  setIsRemoteModalOpen: (val: boolean) => void;
  setActiveProviderRemoteModal: (val: ImportProvider) => void;
  /** Set a pending query to be loaded in query tab */
  setPendingQuery: (query: string | null) => void;
}

// Initial state
const initialState = {
  // Multi-file state
  files: [],
  activeFileId: null,

  // Split view state
  splitView: {
    isActive: false,
    leftFileId: null,
    rightFileId: null,
    splitRatio: 0.5,
  },

  // UI state
  activeTab: "preview",
  jsonViewMode: "table" as const,
  sidebarCollapsed: false,

  // Query history state
  recentQueries: [],
  savedQueries: [],
  pendingQuery: null,
  isRemoteModalOpen: false,
  activeProviderRemoteModal: 'huggingface' as ImportProvider
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
  const shortId = fileId.split("_").pop() || "unknown";
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
    const tableName =
      fileData.tableName || generateTableName(fileData.fileName, fileId);

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

    set((state) => ({
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
    set((state) => {
      const newFiles = state.files.filter((f) => f.id !== fileId);
      let newActiveFileId = state.activeFileId;

      // Clear split view references to this file
      const updatedFiles = newFiles.map(file => {
        if (file.splitView?.partnerId === fileId) {
          return {
            ...file,
            splitView: undefined
          };
        }
        return file;
      });

      // If we're removing the active file, switch to another file
      if (state.activeFileId === fileId) {
        if (updatedFiles.length > 0) {
          // Try to find the next file, or fallback to the first
          const currentIndex = state.files.findIndex((f) => f.id === fileId);
          const nextFile =
            updatedFiles[Math.min(currentIndex, updatedFiles.length - 1)];
          newActiveFileId = nextFile.id;
        } else {
          newActiveFileId = null;
        }
      }

      return {
        files: updatedFiles,
        activeFileId: newActiveFileId,
      };
    });
  },

  setActiveFile: (fileId: string) => {
    set((state) => {
      // Update last accessed time
      const updatedFiles = state.files.map((file) =>
        file.id === fileId ? { ...file, lastAccessedAt: Date.now() } : file
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
    set((state) => ({
      files: state.files.filter((f) => f.id === keepFileId),
      activeFileId: keepFileId,
    }));
  },

  updateFile: (fileId: string, updates: Partial<DataFile>) => {
    set((state) => ({
      files: state.files.map((file) =>
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

  // Split view actions
  setSplitView: (leftFileId: string, rightFileId: string) => {
    set((state) => {
      // Update files with split view info
      const updatedFiles = state.files.map(file => {
        if (file.id === leftFileId) {
          return {
            ...file,
            splitView: {
              isActive: true,
              partnerId: rightFileId,
              position: 'left' as const
            }
          };
        } else if (file.id === rightFileId) {
          return {
            ...file,
            splitView: {
              isActive: true,
              partnerId: leftFileId,
              position: 'right' as const
            }
          };
        }
        return file;
      });

      return {
        files: updatedFiles,
        splitView: {
          isActive: true,
          leftFileId,
          rightFileId,
          splitRatio: 0.5,
        }
      };
    });
  },

  closeSplitView: () => {
    set((state) => {
      // Clear split view from files that were in split mode
      const updatedFiles = state.files.map(file => {
        if (file.splitView?.isActive) {
          return {
            ...file,
            splitView: undefined
          };
        }
        return file;
      });

      return {
        files: updatedFiles,
        splitView: {
          isActive: false,
          leftFileId: null,
          rightFileId: null,
          splitRatio: 0.5,
        }
      };
    });
  },

  updateSplitRatio: (ratio: number) => {
    set((state) => ({
      splitView: {
        ...state.splitView,
        splitRatio: Math.max(0.1, Math.min(0.9, ratio)), // Clamp between 10% and 90%
      }
    }));
  },

  swapSplitFiles: () => {
    set((state) => {
      // Swap files in split view
      const leftId = state.splitView.leftFileId;
      const rightId = state.splitView.rightFileId;
      
      const updatedFiles = state.files.map(file => {
        if (file.id === leftId && file.splitView) {
          return {
            ...file,
            splitView: {
              ...file.splitView,
              position: 'right' as const
            }
          };
        } else if (file.id === rightId && file.splitView) {
          return {
            ...file,
            splitView: {
              ...file.splitView,
              position: 'left' as const
            }
          };
        }
        return file;
      });

      return {
        files: updatedFiles,
        splitView: {
          ...state.splitView,
          leftFileId: state.splitView.rightFileId,
          rightFileId: state.splitView.leftFileId,
        }
      };
    });
  },

  setFileSplitView: (fileId: string, partnerId: string | null, position: 'left' | 'right' = 'left') => {
    set((state) => {
      const updatedFiles = state.files.map(file => {
        if (file.id === fileId) {
          return {
            ...file,
            splitView: partnerId ? {
              isActive: true,
              partnerId,
              position
            } : undefined
          };
        }
        return file;
      });

      return { files: updatedFiles };
    });
  },

  clearFileSplitView: (fileId: string) => {
    set((state) => {
      const updatedFiles = state.files.map(file => {
        if (file.id === fileId || file.splitView?.partnerId === fileId) {
          return {
            ...file,
            splitView: undefined
          };
        }
        return file;
      });

      return { files: updatedFiles };
    });
  },

  // Legacy actions
  setData: (data) => {
    // For backward compatibility, update active file if exists
    const state = get();
    const activeFile = state.files.find((f) => f.id === state.activeFileId);
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
      sidebarCollapsed: get().sidebarCollapsed,
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

  setIsRemoteModalOpen: (val) => {
    set({ isRemoteModalOpen: val });
  },
  setActiveProviderRemoteModal: (val) => {
    set({ activeProviderRemoteModal: val });
  },
  
  setPendingQuery: (query) => {
    set({ pendingQuery: query });
  },
}));
