import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { 
  PythonCell, 
  PythonScript, 
  PythonPackage, 
  PythonExecutionResult, 
  PyodideState,
  DuckDBBridge,
  CellType
} from "@/lib/python/types";
import { 
  initializePyodide, 
  getPyodide, 
  isPyodideReady, 
  installPackage, 
  getInstalledPackages,
  createDuckDBBridge,
  resetInitialization
} from "@/lib/python/init";
import { 
  executePythonCode, 
  getPythonVariables, 
  clearPythonNamespace 
} from "@/lib/python/executor";
import { useDuckDBStore } from "./duckDBStore";

interface PythonState {
  // Pyodide runtime state
  pyodide: PyodideState;
  
  // Current notebook/script state
  currentScript: PythonScript | null;
  cells: PythonCell[];
  activeCellId: string | null;
  
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
  createCell: (type?: CellType, code?: string, index?: number) => string;
  updateCell: (cellId: string, code: string) => void;
  toggleCellEditMode: (cellId: string) => void;
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
  
  // Actions - Settings
  updateSettings: (settings: Partial<{
    autoSave: boolean;
    maxHistoryItems: number;
    cellExecutionTimeout: number;
  }>) => void;
}

// Create a unique ID generator
const createId = () => crypto.randomUUID();

// Create initial cells with welcome content
const createInitialCells = (): PythonCell[] => [
  // Welcome markdown cell
  {
    id: createId(),
    type: 'markdown',
    code: `# Welcome to DataKit Notebooks

DataKit Notebooks provide a environment for data analysis and visualization right in your browser. Here's what you can do:

### Features
- **Python Code Cells**: Execute Python code with numpy, pandas, matplotlib, and more
- **Markdown Text Cells**: Create rich documentation with formatted text
- **Data Integration**: Seamlessly work with your DuckDB data
- **Interactive Visualizations**: Create plots and charts that update in real-time

### Getting Started
1. Use the buttons below cells to add new **Code** or **Text** cells
3. Press **⌘+Enter** (Mac) or **Ctrl+Enter** (Windows) to execute code cells
4. Access your data through the integrated SQL interface
`,
    output: [],
    executionCount: null,
    isExecuting: false,
    isEditing: false, // Start in preview mode to show the rendered content
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  // Initial code cell
  {
    id: createId(),
    type: 'code',
    code: `# Welcome to DataKit Python environment!
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

# Your data analysis starts here
print("DataKit Notebooks ready!")
print(f"Python environment loaded with pandas {pd.__version__}")

# Example: Create a simple dataset
data = {
    'x': range(1, 11),
    'y': [i**2 for i in range(1, 11)]
}
df = pd.DataFrame(data)
print("\\nSample data created:")
df.head()`,
    output: [],
    executionCount: null,
    isExecuting: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
];

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
      cells: createInitialCells(),
      activeCellId: null,
      
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
        
        set(state => ({
          pyodide: { ...state.pyodide, isInitializing: true, error: null }
        }));
        
        try {
          console.log('[PythonStore] Initializing Pyodide...');
          const pyodideInstance = await initializePyodide();
          
          // Get installed packages
          const installed = await getInstalledPackages();
          
          set(state => ({
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
          set(state => ({
            pyodide: {
              ...state.pyodide,
              error: error instanceof Error ? error.message : String(error),
              isInitializing: false,
            }
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
          console.error(`[PythonStore] Failed to install ${packageName}:`, error);
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
          console.error('[PythonStore] Failed to refresh installed packages:', error);
        }
      },
      
      // Cell Management
      createCell: (type = 'code', code = "", index) => {
        const newCell: PythonCell = {
          id: createId(),
          type,
          code,
          output: [],
          executionCount: null,
          isExecuting: false,
          isEditing: type === 'markdown', // Markdown cells start in edit mode
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        set(state => {
          const cells = [...state.cells];
          const insertIndex = index !== undefined ? index : cells.length;
          cells.splice(insertIndex, 0, newCell);
          
          return { 
            cells,
            activeCellId: newCell.id 
          };
        });
        
        return newCell.id;
      },
      
      updateCell: (cellId, code) => {
        set(state => ({
          cells: state.cells.map(cell =>
            cell.id === cellId
              ? { ...cell, code, updatedAt: new Date() }
              : cell
          )
        }));
        
        // Auto-save if enabled
        if (get().autoSave && get().currentScript) {
          // Debounced save would be implemented here
        }
      },
      
      toggleCellEditMode: (cellId) => {
        set(state => ({
          cells: state.cells.map(cell =>
            cell.id === cellId
              ? { ...cell, isEditing: !cell.isEditing, updatedAt: new Date() }
              : cell
          )
        }));
      },
      
      convertCellType: (cellId: string, newType: CellType) => {
        set(state => ({
          cells: state.cells.map(cell =>
            cell.id === cellId
              ? { 
                  ...cell, 
                  type: newType, 
                  isEditing: newType === 'markdown',
                  output: newType === 'markdown' ? [] : cell.output,
                  executionCount: newType === 'markdown' ? null : cell.executionCount,
                  updatedAt: new Date() 
                }
              : cell
          )
        }));
      },
      
      deleteCell: (cellId) => {
        set(state => {
          const cells = state.cells.filter(cell => cell.id !== cellId);
          
          // Ensure at least one cell exists
          if (cells.length === 0) {
            const initialCells = createInitialCells();
            return {
              cells: initialCells,
              activeCellId: initialCells[0]?.id || null,
            };
          }
          
          // Update active cell if deleted
          const activeCellId = state.activeCellId === cellId 
            ? (cells[0]?.id || null)
            : state.activeCellId;
          
          return { cells, activeCellId };
        });
      },
      
      moveCell: (cellId, direction) => {
        set(state => {
          const cells = [...state.cells];
          const index = cells.findIndex(cell => cell.id === cellId);
          
          if (index === -1) return state;
          
          const newIndex = direction === 'up' ? index - 1 : index + 1;
          
          if (newIndex < 0 || newIndex >= cells.length) return state;
          
          // Swap cells
          [cells[index], cells[newIndex]] = [cells[newIndex], cells[index]];
          
          return { ...state, cells };
        });
      },
      
      clearCell: (cellId) => {
        set(state => ({
          cells: state.cells.map(cell =>
            cell.id === cellId
              ? { 
                  ...cell, 
                  output: [], 
                  executionCount: null,
                  updatedAt: new Date()
                }
              : cell
          )
        }));
      },
      
      executeCell: async (cellId) => {
        const state = get();
        if (!state.pyodide.isInitialized || state.isExecuting) {
          return;
        }
        
        const cell = state.cells.find(c => c.id === cellId);
        if (!cell || !cell.code.trim()) {
          return;
        }
        
        // Mark cell as executing
        set(state => ({
          isExecuting: true,
          cells: state.cells.map(c =>
            c.id === cellId
              ? { ...c, isExecuting: true, output: [] }
              : c
          )
        }));
        
        try {
          console.log(`[PythonStore] Executing cell: ${cellId}`);
          
          const result = await executePythonCode(cell.code);
          
          // Update cell with results
          set(state => {
            const executionCount = Math.max(
              ...state.cells.map(c => c.executionCount || 0)
            ) + 1;
            
            return {
              isExecuting: false,
              cells: state.cells.map(c =>
                c.id === cellId
                  ? {
                      ...c,
                      isExecuting: false,
                      output: result.output,
                      executionCount,
                      updatedAt: new Date(),
                    }
                  : c
              )
            };
          });
          
          // Refresh variables
          await get().refreshVariables();
          
          console.log(`[PythonStore] Cell executed successfully: ${cellId}`);
          
        } catch (error) {
          console.error(`[PythonStore] Cell execution failed: ${cellId}`, error);
          
          // Update cell with error
          set(state => ({
            isExecuting: false,
            cells: state.cells.map(c =>
              c.id === cellId
                ? {
                    ...c,
                    isExecuting: false,
                    output: [{
                      id: createId(),
                      type: 'error',
                      content: error instanceof Error ? error.message : String(error),
                      timestamp: new Date(),
                    }],
                    updatedAt: new Date(),
                  }
                : c
            )
          }));
        }
      },
      
      executeAllCells: async () => {
        const state = get();
        if (!state.pyodide.isInitialized || state.isExecuting) {
          return;
        }
        
        const cellsToExecute = state.cells.filter(cell => cell.code.trim());
        
        for (const cell of cellsToExecute) {
          await get().executeCell(cell.id);
          
          // Small delay between cells
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      },
      
      // Script Management
      createNewScript: (name) => {
        const initialCells = createInitialCells();
        const newScript: PythonScript = {
          id: createId(),
          name: name || `Script ${Date.now()}`,
          cells: initialCells,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        set({
          currentScript: newScript,
          cells: newScript.cells,
          activeCellId: newScript.cells[0]?.id || null,
        });
      },
      
      saveScript: (name, description) => {
        const state = get();
        
        const script: PythonScript = {
          id: state.currentScript?.id || createId(),
          name,
          description,
          cells: state.cells,
          createdAt: state.currentScript?.createdAt || new Date(),
          updatedAt: new Date(),
        };
        
        set(state => {
          const savedScripts = state.savedScripts.filter(s => s.id !== script.id);
          savedScripts.unshift(script);
          
          // Keep only maxHistoryItems
          const trimmedScripts = savedScripts.slice(0, state.maxHistoryItems);
          
          return {
            currentScript: script,
            savedScripts: trimmedScripts,
          };
        });
        
        console.log(`[PythonStore] Script saved: ${name}`);
      },
      
      loadScript: (scriptId) => {
        const state = get();
        const script = state.savedScripts.find(s => s.id === scriptId);
        
        if (!script) {
          console.error(`[PythonStore] Script not found: ${scriptId}`);
          return;
        }
        
        set({
          currentScript: script,
          cells: script.cells,
          activeCellId: script.cells[0]?.id || null,
        });
        
        console.log(`[PythonStore] Script loaded: ${script.name}`);
      },
      
      deleteScript: (scriptId) => {
        set(state => ({
          savedScripts: state.savedScripts.filter(s => s.id !== scriptId)
        }));
      },
      
      duplicateScript: (scriptId) => {
        const state = get();
        const script = state.savedScripts.find(s => s.id === scriptId);
        
        if (!script) return;
        
        const duplicatedScript: PythonScript = {
          ...script,
          id: createId(),
          name: `${script.name} (Copy)`,
          createdAt: new Date(),
          updatedAt: new Date(),
          cells: script.cells.map(cell => ({
            ...cell,
            id: createId(),
            output: [],
            executionCount: null,
            isExecuting: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
        };
        
        set(state => ({
          savedScripts: [duplicatedScript, ...state.savedScripts],
          currentScript: duplicatedScript,
          cells: duplicatedScript.cells,
          activeCellId: duplicatedScript.cells[0]?.id || null,
        }));
      },
      
      importScript: async (file) => {
        try {
          const content = await file.text();
          
          // Try to parse as JSON first (DataKit script format)
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
        const script = state.savedScripts.find(s => s.id === scriptId);
        
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
        set(state => ({
          cells: state.cells.map(cell => ({
            ...cell,
            output: [],
            executionCount: null,
            updatedAt: new Date(),
          }))
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
        set(state => ({ showPackageManager: !state.showPackageManager }));
      },
      
      toggleScriptHistory: () => {
        set(state => ({ showScriptHistory: !state.showScriptHistory }));
      },
      
      toggleVariableInspector: () => {
        set(state => ({ showVariableInspector: !state.showVariableInspector }));
      },
      
      toggleTemplates: () => {
        set(state => ({ showTemplates: !state.showTemplates }));
      },
      
      // Settings
      updateSettings: (settings) => {
        set(state => ({ ...state, ...settings }));
      },
    }),
    {
      name: 'python-store',
      partialize: (state) => ({
        savedScripts: state.savedScripts.slice(0, 10), // Only persist last 10 scripts
        autoSave: state.autoSave,
        maxHistoryItems: state.maxHistoryItems,
        cellExecutionTimeout: state.cellExecutionTimeout,
      }),
    }
  )
);