import { ColumnAction } from '@/types/columnActions';

export const COLUMN_ACTIONS: ColumnAction[] = [
  // ANALYZE Category - Direct execution
  {
    id: 'show-stats',
    label: 'Show Statistics',
    description: 'Calculate mean, median, min, max, standard deviation',
    icon: 'BarChart3',
    category: 'analyze',
    strategy: 'direct',
    aiPromptTemplate: 'Generate SQL to calculate comprehensive statistics (count, mean, median, min, max, stddev, percentiles) for column {columnName} of type {columnType} in table {tableName}',
    supportedTypes: ['INTEGER', 'DOUBLE', 'DECIMAL', 'BIGINT', 'FLOAT']
  },
  {
    id: 'find-outliers',
    label: 'Find Outliers',
    description: 'Identify values beyond 3 standard deviations',
    icon: 'AlertTriangle',
    category: 'analyze',
    strategy: 'direct',
    aiPromptTemplate: 'Generate SQL to find outliers in column {columnName} using statistical methods (values beyond 3 standard deviations) in table {tableName}',
    supportedTypes: ['INTEGER', 'DOUBLE', 'DECIMAL', 'BIGINT', 'FLOAT']
  },
  {
    id: 'value-frequency',
    label: 'Value Frequency',
    description: 'Count occurrences of each unique value',
    icon: 'Hash',
    category: 'analyze',
    strategy: 'direct',
    aiPromptTemplate: 'Generate SQL to show frequency distribution of values in column {columnName} in table {tableName}, ordered by count descending'
  },
  {
    id: 'check-nulls',
    label: 'Check Null Values',
    description: 'Count and show null values',
    icon: 'AlertCircle',
    category: 'analyze',
    strategy: 'direct',
    sqlTemplate: 'SELECT COUNT(*) as null_count, COUNT(*) * 100.0 / (SELECT COUNT(*) FROM "{tableName}") as null_percentage FROM "{tableName}" WHERE "{columnName}" IS NULL'
  },

  // CLEAN Category - In-place with confirmation
  {
    id: 'remove-nulls',
    label: 'Remove Null Rows',
    description: 'Delete rows where this column is null',
    icon: 'Trash2',
    category: 'clean',
    strategy: 'in-place-confirm',
    sqlTemplate: 'DELETE FROM "{tableName}" WHERE "{columnName}" IS NULL',
    showPreview: true,
    previewQuery: 'SELECT COUNT(*) as rows_to_delete FROM "{tableName}" WHERE "{columnName}" IS NULL'
  },
  {
    id: 'remove-duplicates',
    label: 'Remove Duplicates',
    description: 'Keep only unique values in this column',
    icon: 'Copy',
    category: 'clean',
    strategy: 'in-place-confirm',
    aiPromptTemplate: 'Generate SQL to remove duplicate rows based on column {columnName} in table {tableName}, keeping the first occurrence',
    showPreview: true
  },
  {
    id: 'fill-nulls',
    label: 'Fill Null Values',
    description: 'Replace null values with a default',
    icon: 'Edit3',
    category: 'clean',
    strategy: 'in-place-confirm',
    requiresInput: true,
    aiPromptTemplate: 'Generate SQL to replace NULL values in column {columnName} of table {tableName} with an appropriate default value for type {columnType}',
    showPreview: true
  },

  // TRANSFORM Category - In-place with confirmation
  {
    id: 'change-type',
    label: 'Change Data Type',
    description: 'Convert column to a different data type',
    icon: 'RefreshCw',
    category: 'transform',
    strategy: 'in-place-confirm',
    requiresInput: true,
    aiPromptTemplate: 'Generate SQL to alter column {columnName} in table {tableName} from type {columnType} to the specified target type, handling any conversion issues',
    showPreview: true
  },
  {
    id: 'uppercase',
    label: 'Convert to Uppercase',
    description: 'Transform text to uppercase',
    icon: 'Type',
    category: 'transform',
    strategy: 'in-place-confirm',
    sqlTemplate: 'UPDATE "{tableName}" SET "{columnName}" = UPPER("{columnName}") WHERE "{columnName}" IS NOT NULL',
    supportedTypes: ['VARCHAR', 'TEXT', 'STRING'],
    showPreview: true
  },
  {
    id: 'trim-spaces',
    label: 'Trim Whitespace',
    description: 'Remove leading and trailing spaces',
    icon: 'Scissors',
    category: 'transform',
    strategy: 'in-place-confirm',
    sqlTemplate: 'UPDATE "{tableName}" SET "{columnName}" = TRIM("{columnName}") WHERE "{columnName}" IS NOT NULL',
    supportedTypes: ['VARCHAR', 'TEXT', 'STRING'],
    showPreview: true
  },

  // FILTER Category - Create views
  {
    id: 'filter-condition',
    label: 'Filter by Condition',
    description: 'Show only rows matching a condition',
    icon: 'Filter',
    category: 'filter',
    strategy: 'view',
    requiresInput: true,
    aiPromptTemplate: 'Generate SQL to create a filtered view of table {tableName} where column {columnName} meets the specified condition'
  },
  {
    id: 'filter-top-values',
    label: 'Top 10 Values',
    description: 'Show rows with highest values',
    icon: 'TrendingUp',
    category: 'filter',
    strategy: 'view',
    sqlTemplate: 'CREATE VIEW "{tableName}_top_{columnName}" AS SELECT * FROM "{tableName}" ORDER BY "{columnName}" DESC LIMIT 10',
    supportedTypes: ['INTEGER', 'DOUBLE', 'DECIMAL', 'BIGINT', 'FLOAT']
  },

  // GENERATE Category - Create new tables
  {
    id: 'extract-date-parts',
    label: 'Extract Date Parts',
    description: 'Create columns for year, month, day',
    icon: 'Calendar',
    category: 'generate',
    strategy: 'new-table',
    aiPromptTemplate: 'Generate SQL to create a new table from {tableName} with additional columns extracting year, month, day, quarter from date column {columnName}',
    supportedTypes: ['DATE', 'TIMESTAMP', 'DATETIME']
  },
  {
    id: 'create-categories',
    label: 'Create Categories',
    description: 'Group values into categories/buckets',
    icon: 'Tags',
    category: 'generate',
    strategy: 'new-table',
    requiresInput: true,
    aiPromptTemplate: 'Generate SQL to create a new table from {tableName} with an additional category column that groups values from {columnName} into meaningful buckets'
  },
  {
    id: 'calculate-derived',
    label: 'Calculate Derived Column',
    description: 'Create a new column based on this one',
    icon: 'Calculator',
    category: 'generate',
    strategy: 'new-table',
    requiresInput: true,
    aiPromptTemplate: 'Generate SQL to create a new table from {tableName} with an additional calculated column derived from {columnName} based on the specified formula or logic'
  },

  // AI-powered custom action
  {
    id: 'custom-ai',
    label: 'Ask AI...',
    description: 'Describe what you want to do with this column',
    icon: 'Sparkles',
    category: 'generate',
    strategy: 'new-table', // Default, AI will determine actual strategy
    requiresInput: true,
    aiPromptTemplate: 'Based on the user request, generate appropriate SQL to work with column {columnName} of type {columnType} in table {tableName}. User request: {customPrompt}'
  }
];

export const getActionsForColumnType = (columnType: string): ColumnAction[] => {
  return COLUMN_ACTIONS.filter(action => 
    !action.supportedTypes || 
    action.supportedTypes.some(type => columnType.toUpperCase().includes(type))
  );
};

export const getActionsByCategory = (columnType: string) => {
  const availableActions = getActionsForColumnType(columnType);
  
  return availableActions.reduce((acc, action) => {
    if (!acc[action.category]) {
      acc[action.category] = [];
    }
    acc[action.category].push(action);
    return acc;
  }, {} as Record<string, ColumnAction[]>);
};