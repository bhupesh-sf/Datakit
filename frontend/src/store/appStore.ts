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
import { ViewMode } from "@/components/navigation/ViewModeSelector";
import { WorkspaceFile } from "@/types/folder";
import { useDuckDBStore } from "@/store/duckDBStore";


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
  /** Whether the app is running inside an iframe */
  isInIframe: boolean;
  /** Whether to show column stats in data grid */
  showColumnStats: boolean;
  /** View mode when no files are active */
  emptyStateViewMode: ViewMode;

  // AI Assistant Sidebar state
  /** Whether the AI assistant sidebar is open */
  showAIAssistant: boolean;
  /** Width of the AI assistant sidebar */
  assistantSidebarWidth: number;

  // Query history state
  /** Array of recent queries */
  recentQueries: SavedQuery[];
  /** Array of saved queries */
  savedQueries: SavedQuery[];
  /** Pending query to be loaded in query tab */
  pendingQuery: string | null;
  /** Pending notebook code to be loaded in notebook tab */
  pendingNotebookCode: string | null;

  // Workspace files (simplified)
  /** Files in the workspace */
  workspaceFiles: WorkspaceFile[];

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
  /** Set iframe state */
  setIsInIframe: (isInIframe: boolean) => void;
  /** Toggle column stats visibility */
  toggleColumnStats: () => void;
  /** Set column stats visibility */
  setShowColumnStats: (show: boolean) => void;
  /** Change view mode for active file or empty state */
  changeViewMode: (mode: ViewMode) => void;
  
  // AI Assistant Sidebar actions
  /** Toggle AI assistant sidebar */
  toggleAIAssistant: () => void;
  /** Set AI assistant sidebar visibility */
  setShowAIAssistant: (show: boolean) => void;
  /** Set AI assistant sidebar width */
  setAssistantSidebarWidth: (width: number) => void;
  
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
  /** Set a pending notebook code to be loaded in notebook tab */
  setPendingNotebookCode: (code: string | null) => void;

  // Workspace file actions (simplified)
  /** Add a file to workspace */
  addFileToWorkspace: (file: WorkspaceFile) => void;
  /** Remove a file from workspace */
  removeFileFromWorkspace: (fileId: string) => void;
  /** Update a workspace file */
  updateWorkspaceFile: (fileId: string, updates: Partial<WorkspaceFile>) => void;
  /** Load workspace files from storage */
  loadWorkspaceFilesFromStorage: () => Promise<void>;
  /** Persist workspace files to storage */
  saveWorkspaceFilesToStorage: () => Promise<void>;
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
  isInIframe: false,
  showColumnStats: false,
  emptyStateViewMode: 'preview' as ViewMode,

  // AI Assistant Sidebar state
  showAIAssistant: false,
  assistantSidebarWidth: 400,

  // Query history state
  recentQueries: [],
  savedQueries: [],
  pendingQuery: null,
  pendingNotebookCode: null,
  isRemoteModalOpen: false,
  activeProviderRemoteModal: 'huggingface' as ImportProvider,

  // Workspace file
  workspaceFiles: [],
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

// Detect if running inside an iframe
const detectIframe = () => {
  try {
    return window.self !== window.top;
  } catch (e) {
    // If we can't access window.top due to cross-origin restrictions,
    // we're likely in an iframe
    return true;
  }
};

// Load sidebar collapsed state from localStorage on initialization
const getSavedSidebarState = () => {
  try {
    // If we're in an iframe, always collapse the sidebar initially
    if (detectIframe()) {
      return true;
    }
    
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
  isInIframe: detectIframe(),
  showColumnStats: localStorage.getItem("show-column-stats") === "true",
  
  // Initialize workspace files on store creation
  ...((() => {
    // Load workspace files from storage on initialization
    setTimeout(() => {
      get().loadWorkspaceFilesFromStorage();
    }, 0);
    return {};
  })()),

  // Multi-file actions
  addFile: (fileData: DataLoadWithDuckDBResult): string => {
    // If this is a database attachment, don't add it as a regular file
    // since it doesn't have data to preview
    if (fileData.isDatabaseAttachment) {
      console.log('[AppStore] Database attached, not adding to files list:', fileData.fileName);
      console.log('[AppStore] Attached tables:', fileData.attachedTables);
      // Return a fake ID for compatibility
      return `db-attachment-${Date.now()}`;
    }
    
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
      postgresql: fileData.postgresql,
      importedAt: Date.now(),
      lastAccessedAt: Date.now(),
      // Initialize workspace states with default query
      sqlState: {
        query: `SELECT * FROM ${tableName} LIMIT 100`,
        history: [],
        lastExecutedAt: undefined,
      },
      // Initialize AI state for this file
      aiState: {
        messages: [],
        conversationId: `conv_${fileId}_${Date.now()}`,
        currentResponse: null,
        streamingResponse: "",
        isProcessing: false,
        currentError: null,
        currentTokenUsage: null,
        visualizationTokenUsage: null,
        queryResults: null,
        visualizations: [],
        tableContext: {
          tableName: tableName,
          schema: [],
          rowCount: fileData.rowCount,
          description: `${fileData.fileName} - ${fileData.columnCount} columns`,
        },
        createdAt: Date.now(),
        lastMessageAt: undefined,
        lastSavedAt: Date.now(),
      },
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
    const fileToRemove = get().files.find(f => f.id === fileId);
    
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

    if (fileToRemove?.loadedToDuckDB && fileToRemove.tableName) {
      const { dropTableOrView, registeredTables } = useDuckDBStore.getState();
      
      // Drop the table/view from DuckDB
      dropTableOrView(fileToRemove.tableName).then((success) => {
        if (success) {
          console.log(`[AppStore] Successfully dropped ${fileToRemove.isView ? 'VIEW' : 'TABLE'}: ${fileToRemove.tableName}`);
          
          // Remove from registered tables map
          const newRegisteredTables = new Map(registeredTables);
          newRegisteredTables.delete(fileToRemove.tableName);
          useDuckDBStore.setState({ registeredTables: newRegisteredTables });
        } else {
          console.warn(`[AppStore] Failed to drop ${fileToRemove.isView ? 'VIEW' : 'TABLE'}: ${fileToRemove.tableName}`);
        }
      }).catch((error) => {
        console.error(`[AppStore] Error dropping ${fileToRemove.isView ? 'VIEW' : 'TABLE'}: ${fileToRemove.tableName}`, error);
      });
    }
  },

  setActiveFile: (fileId: string) => {
    set((state) => {
      // Update last accessed time and initialize workspace states if needed
      const updatedFiles = state.files.map((file) => {
        if (file.id === fileId) {
          const updates: Partial<DataFile> = { 
            lastAccessedAt: Date.now() 
          };
          
          // Initialize sqlState if it doesn't exist
          if (!file.sqlState) {
            updates.sqlState = {
              query: "",
              history: [],
              lastExecutedAt: undefined,
            };
          }
          
          // Initialize aiState if it doesn't exist
          if (!file.aiState) {
            updates.aiState = {
              messages: [],
              conversationId: `conv_${fileId}_${Date.now()}`,
              currentResponse: null,
              streamingResponse: "",
              isProcessing: false,
              currentError: null,
              currentTokenUsage: null,
              visualizationTokenUsage: null,
              queryResults: null,
              visualizations: [],
              tableContext: {
                tableName: file.tableName,
                schema: [],
                rowCount: file.rowCount,
                description: `${file.fileName} - ${file.columnCount} columns`,
              },
              createdAt: Date.now(),
              lastMessageAt: undefined,
              lastSavedAt: Date.now(),
            };
          }
          
          return { ...file, ...updates };
        }
        return file;
      });

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

  setIsInIframe: (isInIframe) => {
    set({ isInIframe });
  },
  
  toggleColumnStats: () => {
    const newState = !get().showColumnStats;
    localStorage.setItem("show-column-stats", String(newState));
    set({ showColumnStats: newState });
  },
  
  setShowColumnStats: (show) => {
    localStorage.setItem("show-column-stats", String(show));
    set({ showColumnStats: show });
  },

  toggleAIAssistant: () => {
    const newState = !get().showAIAssistant;
    set({ showAIAssistant: newState });
  },

  setShowAIAssistant: (show) => {
    set({ showAIAssistant: show });
  },

  setAssistantSidebarWidth: (width) => {
    set({ assistantSidebarWidth: width });
  },

  // View mode change logic (reusable across components)
  changeViewMode: (mode: ViewMode) => {
    const { activeFileId, updateFile } = get();
    
    if (activeFileId) {
      // If there's an active file, update its view mode
      updateFile(activeFileId, { viewMode: mode });
      
      // Only pre-populate on initial query mode access, not when switching between view modes
      const activeFile = get().files.find(f => f.id === activeFileId);
      const currentState = get();
      if (mode === 'query' && activeFile?.tableName && !currentState.pendingQuery && !activeFile.sqlState?.query) {
        // Only set default query if the file has no existing SQL state
        const query = `SELECT * FROM ${activeFile.tableName} LIMIT 100`;
        get().setPendingQuery(query);
      } else if (mode === 'notebook' && activeFile?.tableName) {
        const pythonCode = `import pandas as pd
import duckdb

# Query the table
con = duckdb.connect()
df = con.execute("SELECT * FROM ${activeFile.tableName} LIMIT 100").df()

# Display basic information
print(f"Shape: {df.shape}")
print(f"\\nFirst 5 rows:")
df.head()`;
        get().setPendingNotebookCode(pythonCode);
      }
    } else {
      // If no active file, update empty state view mode
      set({ emptyStateViewMode: mode });
    }
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
  
  setPendingNotebookCode: (code) => {
    set({ pendingNotebookCode: code });
  },

  // Simplified workspace file actions

  addFileToWorkspace: (file: WorkspaceFile) => {
    set((state) => ({
      workspaceFiles: [...state.workspaceFiles, file]
    }));
    // Save to storage
    get().saveWorkspaceFilesToStorage();
  },

  removeFileFromWorkspace: (fileId: string) => {
    // Get the workspace file before removing to check for corresponding file tabs
    const workspaceFile = get().workspaceFiles.find(f => f.id === fileId);
    
    set((state) => {
      // Find and remove corresponding file tab(s) with the same name
      let updatedFiles = state.files;
      if (workspaceFile) {
        // Remove file tabs that match the workspace file name
        updatedFiles = state.files.filter(f => {
          // Check if file tab name matches workspace file name
          const tabFileName = f.fileName || '';
          const workspaceFileName = workspaceFile.name || '';
          return tabFileName !== workspaceFileName;
        });
      }

      // Handle active file switching if we removed the active file tab
      let newActiveFileId = state.activeFileId;
      const activeFileRemoved = workspaceFile && state.files.some(f => 
        f.id === state.activeFileId && (f.fileName === workspaceFile.name)
      );
      
      if (activeFileRemoved && updatedFiles.length > 0) {
        // Switch to the first available file
        newActiveFileId = updatedFiles[0].id;
      } else if (activeFileRemoved) {
        newActiveFileId = null;
      }

      return {
        workspaceFiles: state.workspaceFiles.filter(f => f.id !== fileId),
        files: updatedFiles,
        activeFileId: newActiveFileId
      };
    });
    
    // Save to storage
    get().saveWorkspaceFilesToStorage();
  },

  loadWorkspaceFilesFromStorage: async () => {
    try {
      const storedFiles = await getFromIndexDB('datakit-workspace-files');
      let storedHandles: Record<string, FileSystemFileHandle> = {};
      
      // Try to load file handles, but don't fail if it doesn't work
      try {
        storedHandles = await getFromIndexDB('datakit-file-handles') as Record<string, FileSystemFileHandle> || {};
      } catch (handleError) {
        console.warn('[AppStore] Could not load file handles (browser may not support this):', handleError);
      }
      
      if (storedFiles && Array.isArray(storedFiles)) {
        // Restore file handles to workspace files
        const filesWithHandles = storedFiles.map(file => ({
          ...file,
          handle: storedHandles[file.id] || undefined
        }));
        
        set({ workspaceFiles: filesWithHandles });
        
        console.log('[AppStore] Loaded', filesWithHandles.length, 'workspace files with', Object.keys(storedHandles).length, 'file handles');
      }
    } catch (error) {
      console.error('[AppStore] Failed to load workspace files:', error);
    }
  },

  saveWorkspaceFilesToStorage: async () => {
    try {
      const workspaceFiles = get().workspaceFiles;
      
      // Separate file handles from workspace file data for storage
      const filesForStorage = workspaceFiles.map(file => ({
        ...file,
        handle: undefined // Remove handles from JSON storage
      }));
      
      // Store workspace files without handles
      await setToIndexDB('datakit-workspace-files', filesForStorage);
      
      // Try to store file handles separately, but don't fail if it doesn't work
      try {
        const fileHandles: Record<string, FileSystemFileHandle> = {};
        workspaceFiles.forEach(file => {
          if (file.handle) {
            fileHandles[file.id] = file.handle;
          }
        });
        
        if (Object.keys(fileHandles).length > 0) {
          await setToIndexDB('datakit-file-handles', fileHandles);
          console.log('[AppStore] Saved', Object.keys(fileHandles).length, 'file handles');
        }
      } catch (handleError) {
        console.warn('[AppStore] Could not save file handles (browser may not support this):', handleError);
        // Continue without failing - workspace file data is still saved
      }
    } catch (error) {
      console.error('[AppStore] Failed to save workspace files:', error);
    }
  },

  updateWorkspaceFile: (fileId: string, updates: Partial<WorkspaceFile>) => {
    set((state) => ({
      workspaceFiles: state.workspaceFiles.map(f =>
        f.id === fileId ? { ...f, ...updates } : f
      )
    }));
    // Save to storage
    get().saveWorkspaceFilesToStorage();
  }
}));
