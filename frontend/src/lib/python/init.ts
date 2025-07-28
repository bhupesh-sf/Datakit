import { loadPyodide, type PyodideInterface } from "pyodide";
import type { PyodideState, DuckDBBridge } from "./types";

let pyodideInstance: PyodideInterface | null = null;
let initPromise: Promise<PyodideInterface> | null = null;

/**
 * Initialize Pyodide with required packages
 */
export async function initializePyodide(): Promise<PyodideInterface> {
  if (pyodideInstance) {
    return pyodideInstance;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    console.log("[Python] Initializing Pyodide...");
    
    let pyodide;
    try {
      pyodide = await loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/",
        stdout: (text: string) => {
          console.log("[Python stdout]", text);
        },
        stderr: (text: string) => {
          console.error("[Python stderr]", text);
        },
      });
      console.log("[Python] Pyodide core loaded successfully");
    } catch (error) {
      console.error("[Python] Failed to load Pyodide core:", error);
      throw new Error(`Failed to load Pyodide: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Install essential packages
    console.log("[Python] Installing core packages...");
    try {
      await pyodide.loadPackage([
        "numpy",
        "pandas", 
        "matplotlib",
        "micropip",
      ]);
      console.log("[Python] Core packages loaded successfully");
    } catch (error) {
      console.error("[Python] Failed to load core packages:", error);
      throw new Error(`Failed to load core packages: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Install additional packages via micropip (optional)
    try {
      console.log("[Python] Installing additional packages...");
      await pyodide.runPython(`
        import micropip
        await micropip.install(['plotly', 'seaborn'])
      `);
      console.log("[Python] Additional packages installed successfully");
    } catch (error) {
      console.warn("[Python] Failed to install additional packages (non-critical):", error);
      // Don't throw here, these are optional packages
    }

    // Setup matplotlib for web
    try {
      console.log("[Python] Setting up matplotlib...");
      await pyodide.runPython(`
        import matplotlib
        matplotlib.use('Agg')  # Use non-interactive backend
        import matplotlib.pyplot as plt
        import base64
        import io
        
        # Helper function to get plot as base64
        def get_plot_base64(fig=None, dpi=100, format='png'):
            if fig is None:
                fig = plt.gcf()
            
            buf = io.BytesIO()
            fig.savefig(buf, format=format, dpi=dpi, bbox_inches='tight')
            buf.seek(0)
            img_base64 = base64.b64encode(buf.read()).decode('utf-8')
            buf.close()
            
            return f"data:image/{format};base64,{img_base64}"
        
        # Make it globally available
        import builtins
        builtins.get_plot_base64 = get_plot_base64
      `);
      console.log("[Python] Matplotlib setup complete");
    } catch (error) {
      console.error("[Python] Failed to setup matplotlib:", error);
      throw new Error(`Failed to setup matplotlib: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Setup DataFrame display helpers
    try {
      console.log("[Python] Setting up DataFrame helpers...");
      await pyodide.runPython(`
        import pandas as pd
        import json
        
        def df_to_dict(df):
            """Convert DataFrame to dictionary for display"""
            return {
                'shape': df.shape,
                'columns': df.columns.tolist(),
                'dtypes': {col: str(dtype) for col, dtype in df.dtypes.items()},
                'preview': df.head(100).fillna('').values.tolist(),
                'memory_usage': df.memory_usage(deep=True).sum() if hasattr(df, 'memory_usage') else None
            }
        
        # Make it globally available
        import builtins
        builtins.df_to_dict = df_to_dict
      `);
      console.log("[Python] DataFrame helpers setup complete");
    } catch (error) {
      console.error("[Python] Failed to setup DataFrame helpers:", error);
      throw new Error(`Failed to setup DataFrame helpers: ${error instanceof Error ? error.message : String(error)}`);
    }

    pyodideInstance = pyodide;
    console.log("[Python] Pyodide initialized successfully");
    
    return pyodide;
  })();

  return initPromise;
}

/**
 * Get current Pyodide instance
 */
export function getPyodide(): PyodideInterface | null {
  return pyodideInstance;
}

/**
 * Check if Pyodide is initialized
 */
export function isPyodideReady(): boolean {
  return pyodideInstance !== null;
}

/**
 * Install a Python package
 */
export async function installPackage(packageName: string): Promise<void> {
  if (!pyodideInstance) {
    throw new Error("Pyodide not initialized");
  }

  console.log(`[Python] Installing package: ${packageName}`);
  
  try {
    // Try micropip first
    await pyodideInstance.runPython(`
      import micropip
      await micropip.install('${packageName}')
    `);
  } catch (error) {
    // Fallback to loadPackage for packages in the main distribution
    try {
      await pyodideInstance.loadPackage([packageName]);
    } catch (fallbackError) {
      console.error(`[Python] Failed to install ${packageName}:`, fallbackError);
      throw new Error(`Failed to install ${packageName}: ${fallbackError}`);
    }
  }
  
  console.log(`[Python] Successfully installed: ${packageName}`);
}

/**
 * Get list of installed packages
 */
export async function getInstalledPackages(): Promise<Map<string, string>> {
  if (!pyodideInstance) {
    return new Map();
  }

  try {
    const result = await pyodideInstance.runPython(`
      import sys
      import json
      
      packages = {}
      for name, module in sys.modules.items():
          if hasattr(module, '__version__'):
              packages[name] = module.__version__
          elif name in ['numpy', 'pandas', 'matplotlib', 'plotly', 'seaborn']:
              # For packages that might not have __version__ but are important
              packages[name] = 'installed'
      
      json.dumps(packages)
    `);

    const packagesObj = JSON.parse(result);
    return new Map(Object.entries(packagesObj));
  } catch (error) {
    console.error("[Python] Failed to get installed packages:", error);
    return new Map();
  }
}

/**
 * Create DuckDB bridge for Python
 */
export function createDuckDBBridge(duckDBStore: any): DuckDBBridge {
  return {
    async queryToPandas(sql: string): Promise<any> {
      if (!pyodideInstance) {
        throw new Error("Pyodide not initialized");
      }

      // Execute query in DuckDB
      const result = await duckDBStore.executePaginatedQuery(sql, 1, 10000, false, false);
      
      if (!result || !result.data) {
        throw new Error("Query returned no data");
      }

      // Convert to pandas DataFrame
      const dataJson = JSON.stringify({
        columns: result.columns,
        data: result.data
      });

      pyodideInstance.globals.set("query_data", dataJson);
      
      await pyodideInstance.runPython(`
        import pandas as pd
        import json
        
        data = json.loads(query_data)
        df = pd.DataFrame(data['data'], columns=data['columns'])
        
        # Store in global namespace
        globals()['_last_query_df'] = df
      `);

      return pyodideInstance.globals.get('_last_query_df');
    },

    async pandasToTable(df: any, tableName: string): Promise<void> {
      if (!pyodideInstance) {
        throw new Error("Pyodide not initialized");
      }

      // Convert DataFrame to records
      const records = await pyodideInstance.runPython(`
        import json
        json.dumps(${df.name}.to_dict('records'))
      `);

      const data = JSON.parse(records);
      const columns = Object.keys(data[0] || {});
      
      // Convert to format expected by DuckDB
      const rows = data.map((record: any) => columns.map(col => record[col]));
      
      // Create table in DuckDB
      await duckDBStore.loadData(rows, columns, tableName, []);
    },

    getTableNames(): string[] {
      return duckDBStore.getAvailableTables();
    },

    async getTableSchema(tableName: string): Promise<any> {
      return await duckDBStore.getTableSchema(tableName);
    }
  };
}

/**
 * Reset initialization state (for retry after error)
 */
export function resetInitialization(): void {
  initPromise = null;
  // Don't reset pyodideInstance if it exists and is working
}

/**
 * Cleanup Pyodide resources
 */
export function cleanup(): void {
  pyodideInstance = null;
  initPromise = null;
}