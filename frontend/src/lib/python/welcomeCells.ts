import type { PythonCell } from './types';

const createId = () => crypto.randomUUID();

/**
 * Creates welcome cells for new or empty notebooks
 */
export const createWelcomeCells = (): PythonCell[] => [
  // Welcome markdown cell
  {
    id: createId(),
    type: 'markdown',
    code: `# Welcome to DataKit Notebooks

DataKit Notebooks provide a environment for data analysis and visualization right in your browser.

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
  },
];
