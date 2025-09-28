export type ColumnActionCategory = 'analyze' | 'transform' | 'clean' | 'filter' | 'generate';

export type TransformStrategy = 'direct' | 'in-place-confirm' | 'new-table' | 'view';

export interface ColumnAction {
  id: string;
  label: string;
  description: string;
  icon: string; // Lucide icon name
  category: ColumnActionCategory;
  strategy: TransformStrategy;
  
  // SQL generation
  sqlTemplate?: string; // For simple operations
  aiPromptTemplate?: string; // For AI-powered operations
  
  // UI behavior
  requiresInput?: boolean;
  supportedTypes?: string[]; // Column types this action supports
  
  // Preview configuration
  showPreview?: boolean;
  previewQuery?: string; // Query to show preview of changes
}

export interface ColumnActionRequest {
  action: ColumnAction;
  columnName: string;
  columnType: string;
  tableName: string;
  customPrompt?: string;
  parameters?: Record<string, any>;
}

export interface ColumnActionResult {
  sql: string;
  strategy: TransformStrategy;
  preview?: {
    query: string;
    description: string;
  };
  newTableName?: string;
}

export interface ColumnActionPreview {
  affectedRows: number;
  sampleChanges: Array<{
    before: any;
    after: any;
  }>;
  isReversible: boolean;
  warningMessage?: string;
}