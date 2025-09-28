import { DataSourceType } from '@/types/json';
import { DataFile, FileTab } from '@/types/multiFile';

// Define the store state type (extract from your store)
export interface AppState {
  files: any[];
  activeFileId: string | null;
  splitView?: {
    isActive: boolean;
    leftFileId: string | null;
    rightFileId: string | null;
    splitRatio: number;
  };
  activeTab: string;
  jsonViewMode: 'table' | 'tree';
  sidebarCollapsed: boolean;
  recentQueries: any[];
  savedQueries: any[];
}

// ✅ MEMOIZATION CACHE for selectFileTabs
let cachedFileTabs: FileTab[] = [];
let lastFilesLength = -1;
let lastActiveFileId: string | null = null;

// Multi-file selectors
export const selectActiveFile = (state: AppState): DataFile | null =>
  state.files.find((f) => f.id === state.activeFileId) || null;

// ✅ FIXED: Memoized selectFileTabs to prevent infinite loops
export const selectFileTabs = (state: AppState): FileTab[] => {
  // Check if we need to recompute
  const filesChanged = state.files.length !== lastFilesLength;
  const activeFileChanged = state.activeFileId !== lastActiveFileId;

  if (filesChanged || activeFileChanged) {
    // Only recompute when files array length or activeFileId changes
    cachedFileTabs = state.files.map((file) => ({
      id: file?.id,
      fileName: file?.fileName,
      sourceType: file?.sourceType,
      isActive: file?.id === state?.activeFileId,
      remoteProvider: file?.remoteProvider,
      hasGoogleSheetsMetadata: !!file.googleSheets,
      splitView: file?.splitView
        ? {
            isActive: file.splitView.isActive,
            partnerId: file.splitView.partnerId,
          }
        : undefined,
    }));

    // Update cache keys
    lastFilesLength = state.files.length;
    lastActiveFileId = state.activeFileId;
  }

  return cachedFileTabs;
};

export const selectHasFiles = (state: AppState) => state.files.length > 0;

export const selectActiveFileExists = (state: AppState) =>
  !!selectActiveFile(state);

// Backward compatibility selectors (delegate to active file)
export const selectData = (state: AppState) => selectActiveFile(state)?.data;

export const selectColumnTypes = (state: AppState) =>
  selectActiveFile(state)?.columnTypes || [];

export const selectFileName = (state: AppState) =>
  selectActiveFile(state)?.fileName || '';

export const selectSourceType = (state: AppState) =>
  selectActiveFile(state)?.sourceType || DataSourceType.CSV;

export const selectRawData = (state: AppState) =>
  selectActiveFile(state)?.rawData || null;

export const selectJsonSchema = (state: AppState) =>
  selectActiveFile(state)?.jsonSchema || null;

export const selectRowCount = (state: AppState) =>
  selectActiveFile(state)?.rowCount || 0;

export const selectColumnCount = (state: AppState) =>
  selectActiveFile(state)?.columnCount || 0;

export const selectInDuckDB = (state: AppState) =>
  selectActiveFile(state)?.loadedToDuckDB || false;

export const selectTableName = (state: AppState) =>
  selectActiveFile(state)?.tableName;

export const selectRemoteURL = (state: AppState) =>
  selectActiveFile(state)?.remoteURL;

export const selectRemoteProvider = (state: AppState) =>
  selectActiveFile(state)?.remoteProvider;

export const selectGoogleSheets = (state: AppState) =>
  selectActiveFile(state)?.googleSheets;

// Composite selectors for common use cases
export const selectActiveFileInfo = (state: AppState) => {
  const activeFile = selectActiveFile(state);
  if (!activeFile) return null;

  // Return the same object reference if no changes
  return activeFile;
};

// Split view selectors
export const selectSplitView = (state: AppState) => state.splitView;

export const selectIsSplitViewActive = (state: AppState) =>
  state.splitView?.isActive || false;

export const selectSplitViewLeftFile = (state: AppState): DataFile | null => {
  const splitView = state.splitView;
  if (!splitView?.leftFileId) return null;
  return state.files.find((f) => f.id === splitView.leftFileId) || null;
};

export const selectSplitViewRightFile = (state: AppState): DataFile | null => {
  const splitView = state.splitView;
  if (!splitView?.rightFileId) return null;
  return state.files.find((f) => f.id === splitView.rightFileId) || null;
};

export const selectSplitViewRatio = (state: AppState) =>
  state.splitView?.splitRatio || 0.5;
