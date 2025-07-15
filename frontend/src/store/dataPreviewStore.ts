import { create } from 'zustand';

/**
 * Per-file pagination state
 */
interface FilePreviewState {
  currentPage: number;
  rowsPerPage: number;
  totalRows: number | null;
  totalPages: number;
  data: string[][] | null;
  columns: string[] | null;
  isLoading: boolean;
  isCountLoading: boolean;
  error: string | null;
  lastFetchTime: number;
}

/**
 * Store for managing data preview pagination state per file
 */
interface DataPreviewState {
  // Map of fileId to its preview state
  fileStates: Map<string, FilePreviewState>;

  // Actions
  initializeFileState: (fileId: string) => void;
  updateFileState: (fileId: string, updates: Partial<FilePreviewState>) => void;
  getFileState: (fileId: string) => FilePreviewState | undefined;
  clearFileState: (fileId: string) => void;
  clearAllStates: () => void;
}

// Default state for a new file
const createDefaultFileState = (): FilePreviewState => ({
  currentPage: 1,
  rowsPerPage: 1000,
  totalRows: null,
  totalPages: 0,
  data: null,
  columns: null,
  isLoading: false,
  isCountLoading: false,
  error: null,
  lastFetchTime: 0,
});

/**
 * Zustand store for data preview pagination
 */
export const useDataPreviewStore = create<DataPreviewState>((set, get) => ({
  fileStates: new Map(),

  initializeFileState: (fileId: string) => {
    set((state) => {
      const newStates = new Map(state.fileStates);
      if (!newStates.has(fileId)) {
        newStates.set(fileId, createDefaultFileState());
      }
      return { fileStates: newStates };
    });
  },

  updateFileState: (fileId: string, updates: Partial<FilePreviewState>) => {
    set((state) => {
      const newStates = new Map(state.fileStates);
      const currentState = newStates.get(fileId) || createDefaultFileState();
      newStates.set(fileId, { ...currentState, ...updates });
      return { fileStates: newStates };
    });
  },

  getFileState: (fileId: string) => {
    return get().fileStates.get(fileId);
  },

  clearFileState: (fileId: string) => {
    set((state) => {
      const newStates = new Map(state.fileStates);
      newStates.delete(fileId);
      return { fileStates: newStates };
    });
  },

  clearAllStates: () => {
    set({ fileStates: new Map() });
  },
}));

// Subscribe to file removals in appStore to clean up preview states
import { useAppStore } from './appStore';

useAppStore.subscribe(
  (state) => state.files,
  (files) => {
    const previewStore = useDataPreviewStore.getState();
    const fileIds = new Set(files.map((f) => f.id));

    // Clean up states for removed files
    previewStore.fileStates.forEach((_, fileId) => {
      if (!fileIds.has(fileId)) {
        previewStore.clearFileState(fileId);
      }
    });
  }
);
