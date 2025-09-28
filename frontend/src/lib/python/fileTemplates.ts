import { PythonCell } from '@/lib/python/types';

/**
 * Generate a file-specific notebook template based on the file's properties
 */
export function generateFileSpecificTemplate(
  tableName: string,
  fileName: string,
): PythonCell[] {
  const cleanTableName = tableName || 'data';
  const cleanFileName = fileName || 'data.csv';
  const now = new Date();
  
  return [
    {
      id: 'intro-' + Date.now(),
      type: 'markdown',
      code: `# ${cleanFileName} Analysis\n\nThis notebook analyzes the ** ${cleanTableName} ** table loaded from ${cleanFileName}.`,
      output: [],
      executionCount: null,
      isExecuting: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'imports-' + Date.now() + 1,
      type: 'code',
      code: `# Import necessary libraries
import pandas as pd
import matplotlib.pyplot as plt
import numpy as np

# Data is automatically available through the sql() function
print("📊 Data Analysis Environment Ready!")`,
      output: [],
      executionCount: null,
      isExecuting: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'analysis-' + Date.now() + 7,
      type: 'markdown',
      code: `## Further Analysis\n\nAdd your custom analysis below. You can:\n- Query the data using SQL: \`await sql("SELECT ...")\`\n- Use pandas for data manipulation\n- Create visualizations with matplotlib or seaborn\n- Perform statistical analysis with scipy\n- Build machine learning models with scikit-learn`,
      output: [],
      executionCount: null,
      isExecuting: false,
      createdAt: now,
      updatedAt: now,
    },  
  ];
}

/**
 * Generate an empty notebook template
 */
export function generateEmptyTemplate(): PythonCell[] {
  const now = new Date();
  
  return [
    {
      id: 'welcome-' + Date.now(),
      type: 'markdown',
      code: `# Data Analysis Notebook\n\nWelcome to DataKit! Load a file to start analyzing your data.`,
      output: [],
      executionCount: null,
      isExecuting: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'imports-' + Date.now() + 1,
      type: 'code',
      code: `# Import common libraries
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

print("Ready to analyze data!")`,
      output: [],
      executionCount: null,
      isExecuting: false,
      createdAt: now,
      updatedAt: now,
    },
  ];
}