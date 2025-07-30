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
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.28.0/full/",
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

    // Install essential packages one by one with yield points
    console.log("[Python] Installing core packages...");
    const corePackages = ["numpy", "pandas", "matplotlib", "micropip"];
    
    for (const pkg of corePackages) {
      try {
        console.log(`[Python] Loading ${pkg}...`);
        await pyodide.loadPackage([pkg]);
        // Yield to browser to prevent freezing
        await new Promise(resolve => setTimeout(resolve, 0));
      } catch (error) {
        console.error(`[Python] Failed to load ${pkg}:`, error);
        throw new Error(`Failed to load ${pkg}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    console.log("[Python] Core packages loaded successfully");

    // Install additional packages via micropip (optional)
    try {
      console.log("[Python] Installing additional packages...");
      await pyodide.runPythonAsync(`
        import micropip
        
        async def install_additional_packages():
            try:
                # Install basic packages first
                await micropip.install(['plotly', 'seaborn'])

                # Try to install and setup transformers-js-py
                try:
                    await micropip.install('transformers-js-py')
                    
                    # Try to load transformers.js
                    from transformers_js_py import import_transformers_js
                    transformers = await import_transformers_js()
                    
                    # Make it globally available
                    import builtins
                    builtins.transformers = transformers
                    builtins.transformers_available = True
                  
                except Exception as tf_error:
                    print(f"⚠️ transformers-js-py setup failed: {tf_error}")
                    print("   Hugging Face models will not be available")
                    import builtins
                    builtins.transformers = None
                    builtins.transformers_available = False
                    
            except Exception as e:
                print(f"⚠️ Some packages failed to install: {e}")
        
        # Install packages
        await install_additional_packages()
      `);
      console.log("[Python] Additional packages installed successfully");
    } catch (error) {
      console.warn("[Python] Failed to install additional packages (non-critical):", error);
      // Don't throw here, these are optional packages
    }

    // Setup matplotlib for web with yield point
    try {
      console.log("[Python] Setting up matplotlib...");
      await pyodide.runPythonAsync(`
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
        
        # Also make micropip globally available for easy package installation
        import micropip
        builtins.micropip = micropip
      `);
      // Yield to browser
      await new Promise(resolve => setTimeout(resolve, 0));
      console.log("[Python] Matplotlib setup complete");
    } catch (error) {
      console.error("[Python] Failed to setup matplotlib:", error);
      throw new Error(`Failed to setup matplotlib: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Setup DataFrame display helpers with yield point
    try {
      console.log("[Python] Setting up DataFrame helpers...");
      await pyodide.runPythonAsync(`
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
      // Yield to browser
      await new Promise(resolve => setTimeout(resolve, 0));
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
      import micropip
      
      packages = {}
      
      # Get packages from sys.modules (already imported)
      for name, module in sys.modules.items():
          if hasattr(module, '__version__'):
              packages[name] = module.__version__
          elif name in ['numpy', 'pandas', 'matplotlib', 'plotly', 'seaborn', 'scipy', 'requests', 'pillow', 'lxml', 'statsmodels']:
              # For packages that might not have __version__ but are important
              packages[name] = 'installed'
      
      # Check for packages that are available but not yet imported
      import importlib.util
      common_packages = ['scipy', 'requests', 'pillow', 'lxml', 'statsmodels', 'plotly', 'seaborn']
      for pkg_name in common_packages:
          if pkg_name not in packages:
              try:
                  spec = importlib.util.find_spec(pkg_name)
                  if spec is not None:
                      packages[pkg_name] = 'available'
              except (ImportError, ModuleNotFoundError):
                  pass
      
      # Also check installed packages via micropip
      try:
          installed = micropip.list()
          for pkg in installed:
              # micropip.list() returns a list of strings (package names)
              if isinstance(pkg, str) and pkg not in packages:
                  packages[pkg] = 'installed'
              # Handle case where it might return dict-like objects
              elif hasattr(pkg, 'get'):
                  pkg_name = pkg.get('name', '')
                  pkg_version = pkg.get('version', 'installed')
                  if pkg_name and pkg_name not in packages:
                      packages[pkg_name] = pkg_version
      except Exception as e:
          print(f"Could not get micropip package list: {e}")
      
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
  const bridge = {
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

      // Create DataFrame directly in Python
      const pyCode = `
import pandas as pd
import json

_query_result_data = json.loads('''${dataJson}''')
_query_result_df = pd.DataFrame(_query_result_data['data'], columns=_query_result_data['columns'])
_query_result_df
      `;
      
      const df = await pyodideInstance.runPythonAsync(pyCode);
      return df;
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
  
  // Expose the bridge to Python when it's created
  if (pyodideInstance) {
    // Create a Python wrapper class for the bridge
    pyodideInstance.runPython(`
      class DuckDBBridge:
          def __init__(self):
              pass
              
          def query_to_pandas(self, sql):
              """Execute a SQL query on DuckDB and return results as a pandas DataFrame"""
              # This will be replaced with the actual implementation
              pass
              
          def pandas_to_table(self, df, table_name):
              """Save a pandas DataFrame to DuckDB as a table"""
              # This will be replaced with the actual implementation
              pass
              
          def get_table_names(self):
              """Get list of available tables in DuckDB"""
              # This will be replaced with the actual implementation
              pass
              
          def get_table_schema(self, table_name):
              """Get schema information for a table"""
              # This will be replaced with the actual implementation
              pass
      
      # Create global instance
      duckdb_bridge = DuckDBBridge()
    `);
    
    // Inject JavaScript functions into Python bridge
    pyodideInstance.registerJsModule("duckdb_js_bridge", {
      queryToPandas: bridge.queryToPandas.bind(bridge),
      pandasToTable: bridge.pandasToTable.bind(bridge),
      getTableNames: bridge.getTableNames.bind(bridge),
      getTableSchema: bridge.getTableSchema.bind(bridge)
    });
  }
  
  return bridge;
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