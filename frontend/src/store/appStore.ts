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
import { DucklakeCatalog } from "@/lib/duckdb/ducklake";
import { WorkspaceFile } from "@/components/workspace/FileTreeView";

/**
 * Interface for a workspace
 */
export interface Workspace {
  /** Unique identifier for the workspace */
  id: string;
  /** User-provided workspace name */
  name: string;
  /** Array of files in this workspace */
  files: WorkspaceFile[];
  /** Timestamp when workspace was created */
  createdAt: number;
  /** Timestamp when workspace was last modified */
  lastModified: number;
  /** Whether this is the draft (unsaved) workspace */
  isDraft?: boolean;
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

  // Query history state
  /** Array of recent queries */
  recentQueries: SavedQuery[];
  /** Array of saved queries */
  savedQueries: SavedQuery[];
  /** Pending query to be loaded in query tab */
  pendingQuery: string | null;

  // Workspace state
  /** Array of all workspaces */
  workspaces: Workspace[];
  /** ID of the currently active workspace */
  activeWorkspaceId: string;
  /** Files in the current workspace (denormalized for easy access) */
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

  // Workspace actions
  /** Create a new workspace */
  createWorkspace: (name: string) => string;
  /** Switch to a different workspace */
  switchWorkspace: (workspaceId: string) => void;
  /** Rename a workspace */
  renameWorkspace: (workspaceId: string, newName: string) => void;
  /** Delete a workspace */
  deleteWorkspace: (workspaceId: string) => void;
  /** Add a file to the current workspace */
  addFileToWorkspace: (file: WorkspaceFile) => void;
  /** Remove a file from the current workspace */
  removeFileFromWorkspace: (fileId: string) => void;
  /** Rename a file in the current workspace */
  renameFileInWorkspace: (fileId: string, newName: string) => void;
  /** Save the draft workspace */
  saveDraftWorkspace: (name: string) => void;
  /** Load workspaces from storage */
  loadWorkspacesFromStorage: () => Promise<void>;
  /** Persist workspaces to storage */
  saveWorkspacesToStorage: () => Promise<void>;
}

// Create initial draft workspace
const createDraftWorkspace = (): Workspace => ({
  id: 'draft',
  name: 'Draft',
  files: [],
  createdAt: Date.now(),
  lastModified: Date.now(),
  isDraft: true
});

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

  // Query history state
  recentQueries: [],
  savedQueries: [],
  pendingQuery: null,
  isRemoteModalOpen: false,
  activeProviderRemoteModal: 'huggingface' as ImportProvider,

  // Workspace state
  workspaces: [createDraftWorkspace()],
  activeWorkspaceId: 'draft',
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
  
  // Initialize workspaces on store creation
  ...((() => {
    // Load workspaces from storage on initialization
    setTimeout(() => {
      get().loadWorkspacesFromStorage();
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

  setIsInIframe: (isInIframe) => {
    set({ isInIframe });
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

  // Workspace actions
  createWorkspace: (name: string): string => {
    const workspaceId = `workspace-${Date.now()}`;
    const newWorkspace: Workspace = {
      id: workspaceId,
      name,
      files: [],
      createdAt: Date.now(),
      lastModified: Date.now(),
      isDraft: false
    };

    set((state) => ({
      workspaces: [...state.workspaces, newWorkspace],
      activeWorkspaceId: workspaceId,
      workspaceFiles: []
    }));

    // Only save to storage if not a draft workspace
    const activeWorkspace = get().workspaces.find(w => w.id === get().activeWorkspaceId);
    if (activeWorkspace && !activeWorkspace.isDraft) {
      get().saveWorkspacesToStorage();
    }
    return workspaceId;
  },

  switchWorkspace: (workspaceId: string) => {
    set((state) => {
      const workspace = state.workspaces.find(w => w.id === workspaceId);
      if (workspace) {
        return {
          activeWorkspaceId: workspaceId,
          workspaceFiles: workspace.files || []
        };
      }
      return state;
    });
  },

  renameWorkspace: (workspaceId: string, newName: string) => {
    set((state) => ({
      workspaces: state.workspaces.map(w =>
        w.id === workspaceId 
          ? { ...w, name: newName, lastModified: Date.now() }
          : w
      )
    }));
    // Only save to storage if not a draft workspace
    const activeWorkspace = get().workspaces.find(w => w.id === get().activeWorkspaceId);
    if (activeWorkspace && !activeWorkspace.isDraft) {
      get().saveWorkspacesToStorage();
    }
  },

  deleteWorkspace: (workspaceId: string) => {
    if (workspaceId === 'draft') return; // Can't delete draft
    
    set((state) => {
      const newWorkspaces = state.workspaces.filter(w => w.id !== workspaceId);
      const needsSwitch = state.activeWorkspaceId === workspaceId;
      
      return {
        workspaces: newWorkspaces,
        activeWorkspaceId: needsSwitch ? 'draft' : state.activeWorkspaceId,
        workspaceFiles: needsSwitch ? [] : state.workspaceFiles
      };
    });
    // Always save to storage after deleting a workspace (since we're deleting a non-draft workspace)
    get().saveWorkspacesToStorage();
  },

  addFileToWorkspace: (file: WorkspaceFile) => {
    set((state) => {
      const updatedWorkspaces = state.workspaces.map(w => {
        if (w.id === state.activeWorkspaceId) {
          return {
            ...w,
            files: [...(w.files || []), file],
            lastModified: Date.now()
          };
        }
        return w;
      });

      return {
        workspaces: updatedWorkspaces,
        workspaceFiles: [...state.workspaceFiles, file]
      };
    });
    // Only save to storage if not a draft workspace
    const activeWorkspace = get().workspaces.find(w => w.id === get().activeWorkspaceId);
    if (activeWorkspace && !activeWorkspace.isDraft) {
      get().saveWorkspacesToStorage();
    }
  },

  removeFileFromWorkspace: (fileId: string) => {
    // Get the workspace file before removing to check for corresponding file tabs
    const workspaceFile = get().workspaceFiles.find(f => f.id === fileId);
    
    set((state) => {
      const updatedWorkspaces = state.workspaces.map(w => {
        if (w.id === state.activeWorkspaceId) {
          return {
            ...w,
            files: w.files.filter(f => f.id !== fileId),
            lastModified: Date.now()
          };
        }
        return w;
      });

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
        workspaces: updatedWorkspaces,
        workspaceFiles: state.workspaceFiles.filter(f => f.id !== fileId),
        files: updatedFiles,
        activeFileId: newActiveFileId
      };
    });
    
    // Only save to storage if not a draft workspace
    const activeWorkspace = get().workspaces.find(w => w.id === get().activeWorkspaceId);
    if (activeWorkspace && !activeWorkspace.isDraft) {
      get().saveWorkspacesToStorage();
    }
  },
  // TODO: for now disabling on the UI, as it might bring some confusion on what does it happen to other tabs/query panel
  renameFileInWorkspace: (fileId: string, newName: string) => {
    // Get the old file name before renaming for matching with file tabs
    const oldWorkspaceFile = get().workspaceFiles.find(f => f.id === fileId);
    const oldFileName = oldWorkspaceFile?.name;
    
    set((state) => {
      const updatedWorkspaces = state.workspaces.map(w => {
        if (w.id === state.activeWorkspaceId) {
          return {
            ...w,
            files: w.files.map(f => 
              f.id === fileId ? { ...f, name: newName } : f
            ),
            lastModified: Date.now()
          };
        }
        return w;
      });

      // Find file tabs that match the old workspace file name and update them
      const updatedFiles = state.files.map(file => {
        // Check if this file tab corresponds to the renamed workspace file
        // Match by fileName (since workspace files and file tabs might have different IDs)
        if (oldFileName && file.fileName === oldFileName) {
          return {
            ...file,
            fileName: newName // Update the display name in the file tab
          };
        }
        return file;
      });

      return {
        workspaces: updatedWorkspaces,
        workspaceFiles: state.workspaceFiles.map(f =>
          f.id === fileId ? { ...f, name: newName } : f
        ),
        files: updatedFiles
      };
    });
    // Only save to storage if not a draft workspace
    const activeWorkspace = get().workspaces.find(w => w.id === get().activeWorkspaceId);
    if (activeWorkspace && !activeWorkspace.isDraft) {
      get().saveWorkspacesToStorage();
    }
  },

  saveDraftWorkspace: (name: string) => {
    const state = get();
    const draftWorkspace = state.workspaces.find(w => w.id === 'draft');
    
    if (draftWorkspace && draftWorkspace.files.length > 0) {
      const workspaceId = state.createWorkspace(name);
      
      // Copy files from draft to new workspace
      set((state) => {
        const updatedWorkspaces = state.workspaces.map(w => {
          if (w.id === workspaceId) {
            return {
              ...w,
              files: draftWorkspace.files,
              lastModified: Date.now()
            };
          } else if (w.id === 'draft') {
            return {
              ...w,
              files: [],
              lastModified: Date.now()
            };
          }
          return w;
        });

        return {
          workspaces: updatedWorkspaces,
          workspaceFiles: draftWorkspace.files
        };
      });
      
      // Only save to storage if not a draft workspace
    const activeWorkspace = get().workspaces.find(w => w.id === get().activeWorkspaceId);
    if (activeWorkspace && !activeWorkspace.isDraft) {
      get().saveWorkspacesToStorage();
    }
    }
  },

  loadWorkspacesFromStorage: async () => {
    try {
      const stored = await getFromIndexDB('datakit-workspaces');
      let storedHandles: Record<string, FileSystemFileHandle> = {};
      
      // Try to load file handles, but don't fail if it doesn't work
      try {
        storedHandles = await getFromIndexDB('datakit-file-handles') as Record<string, FileSystemFileHandle> || {};
      } catch (handleError) {
        console.warn('[AppStore] Could not load file handles (browser may not support this):', handleError);
      }
      
      if (stored && Array.isArray(stored)) {
        // Restore file handles to workspace files
        const workspacesWithHandles = stored.map(workspace => ({
          ...workspace,
          files: workspace.files.map(file => ({
            ...file,
            handle: storedHandles[file.id] || undefined
          }))
        }));
        
        // Ensure draft workspace exists
        const hasDraft = workspacesWithHandles.some(w => w.id === 'draft');
        const workspaces = hasDraft ? workspacesWithHandles : [createDraftWorkspace(), ...workspacesWithHandles];
        
        set({ 
          workspaces,
          workspaceFiles: workspaces.find(w => w.id === get().activeWorkspaceId)?.files || []
        });
        
        console.log('[AppStore] Loaded workspaces with', Object.keys(storedHandles).length, 'file handles');
      }
    } catch (error) {
      console.error('[AppStore] Failed to load workspaces:', error);
    }
  },

  saveWorkspacesToStorage: async () => {
    try {
      const workspaces = get().workspaces.filter(w => !w.isDraft);
      
      // Separate file handles from workspace data for storage
      const workspacesForStorage = workspaces.map(workspace => ({
        ...workspace,
        files: workspace.files.map(file => ({
          ...file,
          handle: undefined // Remove handles from JSON storage
        }))
      }));
      
      // Store workspace data without handles
      await setToIndexDB('datakit-workspaces', workspacesForStorage);
      
      // Try to store file handles separately, but don't fail if it doesn't work
      try {
        const fileHandles: Record<string, FileSystemFileHandle> = {};
        workspaces.forEach(workspace => {
          workspace.files.forEach(file => {
            if (file.handle) {
              fileHandles[file.id] = file.handle;
            }
          });
        });
        
        if (Object.keys(fileHandles).length > 0) {
          await setToIndexDB('datakit-file-handles', fileHandles);
          console.log('[AppStore] Saved', Object.keys(fileHandles).length, 'file handles');
        }
      } catch (handleError) {
        console.warn('[AppStore] Could not save file handles (browser may not support this):', handleError);
        // Continue without failing - workspace data is still saved
      }
    } catch (error) {
      console.error('[AppStore] Failed to save workspaces:', error);
    }
  }
}));
