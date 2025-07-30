import type { PyodideInterface } from 'pyodide';
import type { PythonExecutionResult, CellOutput, DataFrameInfo } from './types';
import { getPyodide } from './init';

/**
 * Execute Python code and capture outputs
 */
export async function executePythonCode(
  code: string
): Promise<PythonExecutionResult> {
  const pyodide = getPyodide();
  if (!pyodide) {
    throw new Error('Pyodide not initialized');
  }

  const startTime = performance.now();
  const outputs: CellOutput[] = [];
  let error: string | undefined;

  try {
    // Setup output capture
    await pyodide.runPython(`
      import sys
      import io
      from contextlib import redirect_stdout, redirect_stderr
      
      # Create string buffers for capturing output
      _stdout_buffer = io.StringIO()
      _stderr_buffer = io.StringIO()
      _output_captured = []
      
      # Custom print function to capture output
      _original_print = print
      def _capture_print(*args, **kwargs):
          # Capture in buffer
          _original_print(*args, file=_stdout_buffer, **kwargs)
          # Also print normally for console
          _original_print(*args, **kwargs)
      
      print = _capture_print
    `);

    // Execute the user code
    let result;
    try {
      // Check if code needs async handling
      const needsAsync =
        code.includes('sql(') ||
        code.includes('query(') ||
        code.includes('sql_bridge.') ||
        code.includes('await ') ||
        code.includes('micropip.install');

      if (needsAsync) {
        // Use runPythonAsync for code that might call async functions
        result = await pyodide.runPythonAsync(code);
      } else {
        // Use regular runPython for synchronous code
        result = pyodide.runPython(code);
      }
    } catch (pythonError: any) {
      error = `${pythonError.name}: ${pythonError.message}`;

      outputs.push({
        id: crypto.randomUUID(),
        type: 'error',
        content: error,
        timestamp: new Date(),
      });
    }

    // Capture stdout
    const stdout = await pyodide.runPython(`
      output = _stdout_buffer.getvalue()
      _stdout_buffer.close()
      output
    `);

    if (stdout.trim()) {
      outputs.push({
        id: crypto.randomUUID(),
        type: 'text',
        content: stdout.trim(),
        timestamp: new Date(),
      });
    }

    // Check for matplotlib plots
    const hasPlot = await pyodide.runPython(`
      import matplotlib.pyplot as plt
      len(plt.get_fignums()) > 0
    `);

    if (hasPlot) {
      const plotData = await pyodide.runPython(`
        import matplotlib.pyplot as plt
        
        plots = []
        for fignum in plt.get_fignums():
            fig = plt.figure(fignum)
            plot_b64 = get_plot_base64(fig)
            plots.append(plot_b64)
            plt.close(fig)  # Close after capturing
        
        plots
      `);

      for (const plotB64 of plotData) {
        outputs.push({
          id: crypto.randomUUID(),
          type: 'image',
          content: plotB64,
          timestamp: new Date(),
        });
      }
    }

    // Check for DataFrames in the result
    if (result && typeof result === 'object') {
      try {
        const isDf = await pyodide.runPython(`
          import pandas as pd
          hasattr(_last_result, 'shape') and hasattr(_last_result, 'columns')
        `);

        if (isDf) {
          pyodide.globals.set('_last_result', result);
          const dfInfo = await pyodide.runPython(`
            df_to_dict(_last_result)
          `);

          outputs.push({
            id: crypto.randomUUID(),
            type: 'dataframe',
            content: JSON.stringify(dfInfo),
            timestamp: new Date(),
          });
        }
      } catch (dfError) {
        // Not a DataFrame, ignore
      }
    }

    // If there's a non-None result that's not a DataFrame, show it
    if (result !== undefined && result !== null && outputs.length === 0) {
      outputs.push({
        id: crypto.randomUUID(),
        type: 'text',
        content: String(result),
        timestamp: new Date(),
      });
    }

    // Restore original print
    await pyodide.runPython(`
      print = _original_print
    `);
  } catch (executionError: any) {
    error = `Execution Error: ${executionError.message}`;

    outputs.push({
      id: crypto.randomUUID(),
      type: 'error',
      content: error,
      timestamp: new Date(),
    });
  }

  const executionTime = performance.now() - startTime;

  return {
    output: outputs,
    error,
    executionTime,
  };
}

/**
 * Get available variables in the Python namespace
 */
export async function getPythonVariables(): Promise<Record<string, any>> {
  const pyodide = getPyodide();
  if (!pyodide) {
    return {};
  }

  try {
    const variables = await pyodide.runPython(`
      import json
      import pandas as pd
      import numpy as np
      
      vars_info = {}
      # Create a snapshot to avoid "dictionary changed size during iteration" error
      globals_snapshot = dict(globals())
      for name, obj in globals_snapshot.items():
          if not name.startswith('_') and not callable(obj):
              try:
                  if isinstance(obj, pd.DataFrame):
                      vars_info[name] = {
                          'type': 'DataFrame',
                          'shape': obj.shape,
                          'columns': obj.columns.tolist()
                      }
                  elif isinstance(obj, np.ndarray):
                      vars_info[name] = {
                          'type': 'ndarray',
                          'shape': obj.shape,
                          'dtype': str(obj.dtype)
                      }
                  elif isinstance(obj, (list, tuple, dict)):
                      vars_info[name] = {
                          'type': type(obj).__name__,
                          'length': len(obj) if hasattr(obj, '__len__') else None
                      }
                  else:
                      vars_info[name] = {
                          'type': type(obj).__name__,
                          'value': str(obj)[:100]  # Truncate long values
                      }
              except:
                  pass  # Skip problematic objects
      
      json.dumps(vars_info)
    `);

    return JSON.parse(variables);
  } catch (error) {
    console.error('[Python] Failed to get variables:', error);
    return {};
  }
}

/**
 * Clear Python namespace (keep imports)
 */
export async function clearPythonNamespace(): Promise<void> {
  const pyodide = getPyodide();
  if (!pyodide) {
    return;
  }

  await pyodide.runPython(`
    # Get list of user-defined variables
    user_vars = [name for name in globals().keys() 
                 if not name.startswith('_') 
                 and name not in ['In', 'Out', 'exit', 'quit', 'get_plot_base64', 'df_to_dict']
                 and not callable(globals()[name])
                 and name not in ['np', 'pd', 'plt', 'matplotlib', 'numpy', 'pandas']]
    
    # Delete user variables
    for var in user_vars:
        try:
            del globals()[var]
        except:
            pass
    
    # Clear matplotlib figures
    import matplotlib.pyplot as plt
    plt.close('all')
  `);
}

/**
 * Format DataFrame for display
 */
export function formatDataFrame(dfInfoStr: string): {
  shape: [number, number];
  columns: string[];
  dtypes: Record<string, string>;
  preview: any[][];
  memory_usage?: number;
} {
  try {
    return JSON.parse(dfInfoStr);
  } catch (error) {
    console.error('[Python] Failed to parse DataFrame info:', error);
    return {
      shape: [0, 0],
      columns: [],
      dtypes: {},
      preview: [],
    };
  }
}

/**
 * Check if code contains plotting commands
 */
export function containsPlotting(code: string): boolean {
  const plottingPatterns = [
    /plt\.(plot|bar|scatter|hist|show|figure)/,
    /sns\.(plot|bar|scatter|hist)/,
    /plotly\.(graph_objects|express)/,
    /\.plot\(/,
    /\.hist\(/,
    /\.scatter\(/,
  ];

  return plottingPatterns.some((pattern) => pattern.test(code));
}

/**
 * Validate Python code syntax
 */
export async function validatePythonSyntax(
  code: string
): Promise<{ isValid: boolean; error?: string }> {
  const pyodide = getPyodide();
  if (!pyodide) {
    return { isValid: false, error: 'Pyodide not initialized' };
  }

  try {
    await pyodide.runPython(`
      import ast
      try:
          ast.parse('''${code.replace(/'/g, "\\'")}''')
          syntax_valid = True
          syntax_error = None
      except SyntaxError as e:
          syntax_valid = False
          syntax_error = str(e)
    `);

    const isValid = pyodide.globals.get('syntax_valid');
    const error = pyodide.globals.get('syntax_error');

    return { isValid, error: error || undefined };
  } catch (error) {
    return { isValid: false, error: String(error) };
  }
}
