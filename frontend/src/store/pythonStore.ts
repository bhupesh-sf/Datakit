import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  PythonCell,
  PythonScript,
  PythonPackage,
  PythonExecutionResult,
  PyodideState,
  DuckDBBridge,
  CellType,
} from '@/lib/python/types';
import {
  initializePyodide,
  getPyodide,
  installPackage,
  getInstalledPackages,
  createDuckDBBridge,
  resetInitialization,
} from '@/lib/python/init';
import {
  executePythonCode,
  getPythonVariables,
  clearPythonNamespace,
} from '@/lib/python/executor';
import { useDuckDBStore } from './duckDBStore';

interface PythonState {
  // Pyodide runtime state
  pyodide: PyodideState;

  // Current notebook/script state
  currentScript: PythonScript | null;
  cells: PythonCell[];
  activeCellId: string | null;

  // Change tracking
  saveStatus: 'saved' | 'saving' | 'unsaved';
  lastSavedState: {
    script: PythonScript | null;
    cells: PythonCell[];
  } | null;

  // Script management
  savedScripts: PythonScript[];
  scriptHistory: PythonScript[];

  // Package management
  availablePackages: PythonPackage[];
  installedPackages: Map<string, string>;

  // Execution state
  isExecuting: boolean;
  executionQueue: string[];
  globalVariables: Record<string, any>;

  // DuckDB integration
  duckDBBridge: DuckDBBridge | null;

  // UI state
  showPackageManager: boolean;
  showScriptHistory: boolean;
  showVariableInspector: boolean;
  showTemplates: boolean;

  // Settings
  autoSave: boolean;
  maxHistoryItems: number;
  cellExecutionTimeout: number;

  // Actions - Runtime Management
  initializePython: () => Promise<boolean>;
  installPythonPackage: (packageName: string) => Promise<void>;
  refreshInstalledPackages: () => Promise<void>;

  // Actions - Cell Management
  createCell: (
    type?: CellType,
    code?: string,
    index?: number
  ) => string;
  updateCell: (cellId: string, code: string) => void;
  toggleCellEditMode: (cellId: string) => void;
  toggleCellInputCollapse: (cellId: string) => void;
  toggleCellOutputCollapse: (cellId: string) => void;
  convertCellType: (cellId: string, newType: CellType) => void;
  deleteCell: (cellId: string) => void;
  moveCell: (cellId: string, direction: 'up' | 'down') => void;
  clearCell: (cellId: string) => void;
  executeCell: (cellId: string) => Promise<void>;
  executeAllCells: () => Promise<void>;

  // Actions - Script Management
  createNewScript: (name?: string) => void;
  saveScript: (name: string, description?: string) => void;
  loadScript: (scriptId: string) => void;
  deleteScript: (scriptId: string) => void;
  duplicateScript: (scriptId: string) => void;
  importScript: (file: File) => Promise<void>;
  exportScript: (scriptId: string) => string;

  // Actions - Data Integration
  initializeDuckDBBridge: () => void;
  queryToPandas: (sql: string) => Promise<any>;
  pandasToTable: (df: any, tableName: string) => Promise<void>;

  // Actions - Utilities
  clearAllCells: () => void;
  clearPythonNamespace: () => Promise<void>;
  refreshVariables: () => Promise<void>;

  // Actions - UI
  setActiveCellId: (cellId: string | null) => void;
  togglePackageManager: () => void;
  toggleScriptHistory: () => void;
  toggleVariableInspector: () => void;
  toggleTemplates: () => void;

  // Actions - Change Tracking
  hasUnsavedChanges: () => boolean;
  markAsUnsaved: () => void;
  markAsSaving: () => void;
  markAsSaved: () => void;
  updateLastSavedState: () => void;

  // Actions - Settings
  updateSettings: (
    settings: Partial<{
      autoSave: boolean;
      maxHistoryItems: number;
      cellExecutionTimeout: number;
    }>
  ) => void;
}

// Create a unique ID generator
const createId = () => crypto.randomUUID();

export const usePythonStore = create<PythonState>()(
  persist(
    (set, get) => ({
      // Initial state
      pyodide: {
        pyodide: null,
        isInitializing: false,
        isInitialized: false,
        error: null,
        installedPackages: new Map(),
        standardPackages: ['numpy', 'pandas', 'matplotlib', 'micropip'],
      },

      currentScript: null,
      cells: [], // Start with empty cells, will be populated on initialization
      activeCellId: null,

      // Change tracking
      saveStatus: 'saved',
      lastSavedState: null,

      savedScripts: [],
      scriptHistory: [],

      availablePackages: [],
      installedPackages: new Map(),

      isExecuting: false,
      executionQueue: [],
      globalVariables: {},

      duckDBBridge: null,

      showPackageManager: false,
      showScriptHistory: false,
      showVariableInspector: false,
      showTemplates: false,

      autoSave: true,
      maxHistoryItems: 50,
      cellExecutionTimeout: 30000,

      // Runtime Management
      initializePython: async () => {
        const state = get();
        if (state.pyodide.isInitialized || state.pyodide.isInitializing) {
          return state.pyodide.isInitialized;
        }

        set((state) => ({
          pyodide: { ...state.pyodide, isInitializing: true, error: null },
        }));

        try {
          console.log('[PythonStore] Initializing Pyodide...');
          const pyodideInstance = await initializePyodide();

          // Get installed packages
          const installed = await getInstalledPackages();

          set((state) => ({
            pyodide: {
              ...state.pyodide,
              pyodide: pyodideInstance,
              isInitialized: true,
              isInitializing: false,
              installedPackages: installed,
            },
            installedPackages: installed,
          }));

          // Initialize DuckDB bridge
          get().initializeDuckDBBridge();

          console.log('[PythonStore] Pyodide initialized successfully');
          return true;
        } catch (error) {
          console.error('[PythonStore] Failed to initialize Pyodide:', error);
          resetInitialization(); // Allow retry
          set((state) => ({
            pyodide: {
              ...state.pyodide,
              error: error instanceof Error ? error.message : String(error),
              isInitializing: false,
            },
          }));
          return false;
        }
      },

      installPythonPackage: async (packageName: string) => {
        const state = get();
        if (!state.pyodide.isInitialized) {
          throw new Error('Pyodide not initialized');
        }

        try {
          console.log(`[PythonStore] Installing package: ${packageName}`);
          await installPackage(packageName);

          // Refresh installed packages
          await get().refreshInstalledPackages();

          console.log(`[PythonStore] Successfully installed: ${packageName}`);
        } catch (error) {
          console.error(
            `[PythonStore] Failed to install ${packageName}:`,
            error
          );
          throw error;
        }
      },

      refreshInstalledPackages: async () => {
        const state = get();
        if (!state.pyodide.isInitialized) {
          return;
        }

        try {
          const installed = await getInstalledPackages();
          set({ installedPackages: installed });
        } catch (error) {
          console.error(
            '[PythonStore] Failed to refresh installed packages:',
            error
          );
        }
      },

      // Cell Management
      createCell: (type = 'code', code = '', index) => {
        const newCell: PythonCell = {
          id: createId(),
          type,
          code,
          output: [],
          executionCount: null,
          isExecuting: false,
          isEditing: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        set((state) => {
          const cells = [...state.cells];
          const insertIndex = index !== undefined ? index : cells.length;
          cells.splice(insertIndex, 0, newCell);

          return {
            cells,
            activeCellId: newCell.id,
          };
        });

        // Mark as unsaved since we added a cell
        get().markAsUnsaved();

        return newCell.id;
      },

      updateCell: (cellId, code) => {
        set((state) => ({
          cells: state.cells.map((cell) =>
            cell.id === cellId ? { ...cell, code, updatedAt: new Date() } : cell
          ),
        }));

        // Mark as unsaved since content changed
        get().markAsUnsaved();

        // Auto-save if enabled
        if (get().autoSave && get().currentScript) {
          // Debounced save would be implemented here
        }
      },

      toggleCellEditMode: (cellId) => {
        set((state) => ({
          cells: state.cells.map((cell) =>
            cell.id === cellId
              ? { ...cell, isEditing: !cell.isEditing, updatedAt: new Date() }
              : cell
          ),
        }));
      },

      toggleCellInputCollapse: (cellId) => {
        set((state) => ({
          cells: state.cells.map((cell) =>
            cell.id === cellId
              ? { ...cell, isInputCollapsed: !cell.isInputCollapsed, updatedAt: new Date() }
              : cell
          ),
        }));
      },

      toggleCellOutputCollapse: (cellId) => {
        set((state) => ({
          cells: state.cells.map((cell) =>
            cell.id === cellId
              ? { ...cell, isOutputCollapsed: !cell.isOutputCollapsed, updatedAt: new Date() }
              : cell
          ),
        }));
      },

      convertCellType: (cellId: string, newType: CellType) => {
        set((state) => ({
          cells: state.cells.map((cell) =>
            cell.id === cellId
              ? {
                  ...cell,
                  type: newType,
                  isEditing: newType === 'markdown',
                  output: newType === 'markdown' ? [] : cell.output,
                  executionCount:
                    newType === 'markdown' ? null : cell.executionCount,
                  updatedAt: new Date(),
                }
              : cell
          ),
        }));
      },

      deleteCell: (cellId) => {
        set((state) => {
          const cells = state.cells.filter((cell) => cell.id !== cellId);

          // Update active cell if deleted
          const activeCellId =
            state.activeCellId === cellId
              ? cells[0]?.id || null
              : state.activeCellId;

          return { cells, activeCellId };
        });

        // Mark as unsaved since we deleted a cell
        get().markAsUnsaved();
      },

      moveCell: (cellId, direction) => {
        set((state) => {
          const cells = [...state.cells];
          const index = cells.findIndex((cell) => cell.id === cellId);

          if (index === -1) return state;

          const newIndex = direction === 'up' ? index - 1 : index + 1;

          if (newIndex < 0 || newIndex >= cells.length) return state;

          // Swap cells
          [cells[index], cells[newIndex]] = [cells[newIndex], cells[index]];

          return { ...state, cells };
        });
      },

      clearCell: (cellId) => {
        set((state) => ({
          cells: state.cells.map((cell) =>
            cell.id === cellId
              ? {
                  ...cell,
                  output: [],
                  executionCount: null,
                  updatedAt: new Date(),
                }
              : cell
          ),
        }));
      },

      executeCell: async (cellId) => {
        const state = get();
        if (!state.pyodide.isInitialized || state.isExecuting) {
          return;
        }

        const cell = state.cells.find((c) => c.id === cellId);
        if (!cell || !cell.code.trim()) {
          return;
        }

        // Mark cell as executing
        set((state) => ({
          isExecuting: true,
          cells: state.cells.map((c) =>
            c.id === cellId ? { ...c, isExecuting: true, output: [] } : c
          ),
        }));

        try {
          console.log(`[PythonStore] Executing cell: ${cellId}`);

          const result = await executePythonCode(cell.code);

          // Update cell with results
          set((state) => {
            const executionCount =
              Math.max(...state.cells.map((c) => c.executionCount || 0)) + 1;

            return {
              isExecuting: false,
              cells: state.cells.map((c) =>
                c.id === cellId
                  ? {
                      ...c,
                      isExecuting: false,
                      output: result.output,
                      executionCount,
                      updatedAt: new Date(),
                    }
                  : c
              ),
            };
          });

          // Refresh variables
          await get().refreshVariables();

          console.log(`[PythonStore] Cell executed successfully: ${cellId}`);
        } catch (error) {
          console.error(
            `[PythonStore] Cell execution failed: ${cellId}`,
            error
          );

          // Update cell with error
          set((state) => ({
            isExecuting: false,
            cells: state.cells.map((c) =>
              c.id === cellId
                ? {
                    ...c,
                    isExecuting: false,
                    output: [
                      {
                        id: createId(),
                        type: 'error',
                        content:
                          error instanceof Error
                            ? error.message
                            : String(error),
                        timestamp: new Date(),
                      },
                    ],
                    updatedAt: new Date(),
                  }
                : c
            ),
          }));
        }
      },

      executeAllCells: async () => {
        const state = get();
        if (!state.pyodide.isInitialized || state.isExecuting) {
          return;
        }

        const cellsToExecute = state.cells.filter((cell) => cell.code.trim());

        for (const cell of cellsToExecute) {
          await get().executeCell(cell.id);

          // Small delay between cells
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      },

      // Script Management
      createNewScript: (name) => {
        const newScript: PythonScript = {
          id: createId(),
          name: name || `Script ${Date.now()}`,
          cells: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        set({
          currentScript: newScript,
          cells: [],
          activeCellId: null,
        });

        // Reset change tracking for new script
        get().updateLastSavedState();
        set({ saveStatus: 'saved' });
      },

      saveScript: (name, description) => {
        const state = get();

        // Mark as saving
        get().markAsSaving();

        const script: PythonScript = {
          id: state.currentScript?.id || createId(),
          name,
          description,
          cells: state.cells,
          createdAt: state.currentScript?.createdAt || new Date(),
          updatedAt: new Date(),
        };

        set((state) => {
          const savedScripts = state.savedScripts.filter(
            (s) => s.id !== script.id
          );
          savedScripts.unshift(script);

          // Keep only maxHistoryItems
          const trimmedScripts = savedScripts.slice(0, state.maxHistoryItems);

          return {
            currentScript: script,
            savedScripts: trimmedScripts,
          };
        });

        // Mark as saved and update baseline
        get().markAsSaved();

        console.log(`[PythonStore] Script saved: ${name}`);
      },

      loadScript: (scriptId) => {
        const state = get();
        const script = state.savedScripts.find((s) => s.id === scriptId);

        if (!script) {
          console.error(`[PythonStore] Script not found: ${scriptId}`);
          return;
        }

        set({
          currentScript: script,
          cells: script.cells,
          activeCellId: script.cells[0]?.id || null,
        });

        // Mark as saved and set baseline since we just loaded a saved script
        get().markAsSaved();

        console.log(`[PythonStore] Script loaded: ${script.name}`);
      },

      deleteScript: (scriptId) => {
        set((state) => ({
          savedScripts: state.savedScripts.filter((s) => s.id !== scriptId),
        }));
      },

      duplicateScript: (scriptId) => {
        const state = get();
        const script = state.savedScripts.find((s) => s.id === scriptId);

        if (!script) return;

        const duplicatedScript: PythonScript = {
          ...script,
          id: createId(),
          name: `${script.name} (Copy)`,
          createdAt: new Date(),
          updatedAt: new Date(),
          cells: script.cells.map((cell) => ({
            ...cell,
            id: createId(),
            output: [],
            executionCount: null,
            isExecuting: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
        };

        set((state) => ({
          savedScripts: [duplicatedScript, ...state.savedScripts],
          currentScript: duplicatedScript,
          cells: duplicatedScript.cells,
          activeCellId: duplicatedScript.cells[0]?.id || null,
        }));
      },

      importScript: async (file) => {
        try {
          const content = await file.text();

          // Check if it's a Jupyter notebook (.ipynb)
          if (file.name.endsWith('.ipynb')) {
            try {
              const notebookData = JSON.parse(content);
              
              // Validate Jupyter notebook format
              if (!notebookData.cells || !Array.isArray(notebookData.cells)) {
                throw new Error('Invalid Jupyter notebook format: missing cells array');
              }
              
              if (!notebookData.nbformat || typeof notebookData.nbformat !== 'number') {
                console.warn('Jupyter notebook missing nbformat, assuming nbformat 4');
              }
              
              // Validate that cells have required properties
              for (const cell of notebookData.cells) {
                if (!cell.cell_type || !['code', 'markdown', 'raw'].includes(cell.cell_type)) {
                  throw new Error(`Invalid cell type: ${cell.cell_type}`);
                }
                if (cell.source === undefined) {
                  throw new Error('Cell missing source property');
                }
              }

              // Convert Jupyter cells to DataKit format
              const cells: PythonCell[] = notebookData.cells
                .filter((jupyterCell: any) => jupyterCell.cell_type !== 'raw') // Skip raw cells
                .map((jupyterCell: any) => {
                const cellType = jupyterCell.cell_type === 'code' ? 'code' : 'markdown';
                
                // Handle source as array or string, preserving formatting
                let code = '';
                if (Array.isArray(jupyterCell.source)) {
                  // Join array elements, preserving newlines that might be embedded
                  code = jupyterCell.source.join('').replace(/\n$/, ''); // Remove trailing newline if present
                } else if (typeof jupyterCell.source === 'string') {
                  code = jupyterCell.source;
                }

                return {
                  id: createId(),
                  type: cellType,
                  code,
                  output: [], // We don't import outputs from Jupyter notebooks
                  executionCount: jupyterCell.execution_count || null,
                  isExecuting: false,
                  isEditing: false,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                };
              });

              const script: PythonScript = {
                id: createId(),
                name: file.name.replace('.ipynb', ''),
                description: notebookData.metadata?.description,
                cells,
                createdAt: new Date(),
                updatedAt: new Date(),
              };

              set({
                currentScript: script,
                cells: script.cells,
                activeCellId: script.cells[0]?.id || null,
              });

              console.log(`[PythonStore] Jupyter notebook imported: ${script.name}`);
              return;
            } catch (error) {
              console.error('[PythonStore] Failed to parse Jupyter notebook:', error);
              throw new Error('Invalid Jupyter notebook format');
            }
          }

          // Try to parse as JSON (DataKit script format)
          try {
            const scriptData = JSON.parse(content);
            const script: PythonScript = {
              id: createId(),
              name: scriptData.name || file.name.replace('.json', ''),
              description: scriptData.description,
              cells: scriptData.cells || [],
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            set({
              currentScript: script,
              cells: script.cells,
              activeCellId: script.cells[0]?.id || null,
            });
          } catch (jsonError) {
            // Treat as plain Python file
            const cell: PythonCell = {
              id: createId(),
              type: 'code',
              code: content,
              output: [],
              executionCount: null,
              isExecuting: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            const script: PythonScript = {
              id: createId(),
              name: file.name.replace('.py', ''),
              cells: [cell],
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            set({
              currentScript: script,
              cells: script.cells,
              activeCellId: cell.id,
            });
          }
        } catch (error) {
          console.error('[PythonStore] Failed to import script:', error);
          throw error;
        }
      },

      exportScript: (scriptId) => {
        const state = get();
        const script = state.savedScripts.find((s) => s.id === scriptId);

        if (!script) {
          throw new Error('Script not found');
        }

        const exportData = {
          name: script.name,
          description: script.description,
          cells: script.cells,
          createdAt: script.createdAt,
          updatedAt: script.updatedAt,
          exportedAt: new Date(),
          version: '1.0',
        };

        return JSON.stringify(exportData, null, 2);
      },

      // Data Integration
      initializeDuckDBBridge: () => {
        const duckDBStore = useDuckDBStore.getState();
        const bridge = createDuckDBBridge(duckDBStore);

        set({ duckDBBridge: bridge });

        // Inject the bridge into Python environment
        const pyodide = getPyodide();
        if (pyodide) {
          try {
            // Create proxy functions that can be called from Python
            pyodide.runPython(`
              import js
              import pandas as pd
              from pyodide.ffi import to_js
              
              class SQLBridge:
                  async def query_to_pandas(self, sql):
                      """Execute a SQL query on DuckDB and return results as a pandas DataFrame"""
                      # Call the JavaScript async function
                      result = await _sql_query_to_pandas(sql)
                      return result
                  
                  async def pandas_to_table(self, df, table_name):
                      """Save a pandas DataFrame to DuckDB as a table"""
                      await _sql_pandas_to_table(df, table_name)
                  
                  def get_table_names(self):
                      """Get list of available tables in DuckDB"""
                      return _sql_get_table_names()
                  
                  async def get_table_schema(self, table_name):
                      """Get schema information for a table"""
                      result = await _sql_get_table_schema(table_name)
                      return result
              
              # Create global instance
              sql_bridge = SQLBridge()
              
              # Create async convenience functions
              async def query(sql_str):
                  """Query DuckDB and return pandas DataFrame"""
                  return await sql_bridge.query_to_pandas(sql_str)
              
              async def sql(query_str):
                  """Execute SQL query and return pandas DataFrame"""
                  return await sql_bridge.query_to_pandas(query_str)
            `);

            // Register the JavaScript async functions
            pyodide.globals.set('_sql_query_to_pandas', async (sql: string) => {
              const result = await bridge.queryToPandas(sql);
              return result;
            });

            pyodide.globals.set(
              '_sql_pandas_to_table',
              async (df: any, tableName: string) => {
                await bridge.pandasToTable(df, tableName);
              }
            );

            pyodide.globals.set('_sql_get_table_names', () => {
              return bridge.getTableNames();
            });

            pyodide.globals.set(
              '_sql_get_table_schema',
              async (tableName: string) => {
                return await bridge.getTableSchema(tableName);
              }
            );

            console.log(
              '[PythonStore] DuckDB bridge injected into Python environment'
            );
          } catch (error) {
            console.error(
              '[PythonStore] Failed to inject DuckDB bridge:',
              error
            );
          }
        }

        console.log('[PythonStore] DuckDB bridge initialized');
      },

      queryToPandas: async (sql) => {
        const state = get();
        if (!state.duckDBBridge) {
          throw new Error('DuckDB bridge not initialized');
        }

        return await state.duckDBBridge.queryToPandas(sql);
      },

      pandasToTable: async (df, tableName) => {
        const state = get();
        if (!state.duckDBBridge) {
          throw new Error('DuckDB bridge not initialized');
        }

        return await state.duckDBBridge.pandasToTable(df, tableName);
      },

      // Utilities
      clearAllCells: () => {
        set((state) => ({
          cells: state.cells.map((cell) => ({
            ...cell,
            output: [],
            executionCount: null,
            updatedAt: new Date(),
          })),
        }));
      },

      clearPythonNamespace: async () => {
        const state = get();
        if (!state.pyodide.isInitialized) {
          return;
        }

        try {
          await clearPythonNamespace();
          await get().refreshVariables();
          console.log('[PythonStore] Python namespace cleared');
        } catch (error) {
          console.error('[PythonStore] Failed to clear namespace:', error);
        }
      },

      refreshVariables: async () => {
        const state = get();
        if (!state.pyodide.isInitialized) {
          return;
        }

        try {
          const variables = await getPythonVariables();
          set({ globalVariables: variables });
        } catch (error) {
          console.error('[PythonStore] Failed to refresh variables:', error);
        }
      },

      // UI Actions
      setActiveCellId: (cellId) => {
        set({ activeCellId: cellId });
      },

      togglePackageManager: () => {
        set((state) => ({ showPackageManager: !state.showPackageManager }));
      },

      toggleScriptHistory: () => {
        set((state) => ({ showScriptHistory: !state.showScriptHistory }));
      },

      toggleVariableInspector: () => {
        set((state) => ({
          showVariableInspector: !state.showVariableInspector,
        }));
      },

      toggleTemplates: () => {
        set((state) => ({ showTemplates: !state.showTemplates }));
      },

      // Change Tracking
      hasUnsavedChanges: () => {
        const state = get();

        if (!state.lastSavedState) {
          // No baseline - consider unsaved if we have any content
          return (
            state.cells.length > 0 ||
            (state.currentScript?.name &&
              state.currentScript.name.trim() !== '')
          );
        }

        // Compare current state with last saved state
        const currentStateJson = JSON.stringify({
          script: state.currentScript,
          cells: state.cells,
        });

        const lastSavedStateJson = JSON.stringify(state.lastSavedState);

        return currentStateJson !== lastSavedStateJson;
      },

      markAsUnsaved: () => {
        set({ saveStatus: 'unsaved' });
      },

      markAsSaving: () => {
        set({ saveStatus: 'saving' });
      },

      markAsSaved: () => {
        const state = get();
        set({
          saveStatus: 'saved',
          lastSavedState: {
            script: state.currentScript,
            cells: [...state.cells],
          },
        });
      },

      updateLastSavedState: () => {
        const state = get();
        set({
          lastSavedState: {
            script: state.currentScript,
            cells: [...state.cells],
          },
        });
      },

      // Settings
      updateSettings: (settings) => {
        set((state) => ({ ...state, ...settings }));
      },
    }),
    {
      name: 'python-store',
      partialize: (state) => ({
        savedScripts: state.savedScripts.slice(0, 50), // Only persist last 50 scripts
        autoSave: state.autoSave,
        maxHistoryItems: state.maxHistoryItems,
        cellExecutionTimeout: state.cellExecutionTimeout,
      }),
    }
  )
);
