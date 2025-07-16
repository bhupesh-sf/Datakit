// Export utilities
export * from './exportUtils';
export * from './htmlReportUtils';
export * from './problemExportUtils';

// Common types
export interface InspectorUtilsConfig {
  defaultExportLimit?: number;
  includeTimestamps?: boolean;
  includeMetadata?: boolean;
}

// Constants
export const DEFAULT_EXPORT_LIMIT = 1000;
export const SUPPORTED_EXPORT_FORMATS = ['csv', 'json', 'txt', 'excel', 'html', 'pdf'] as const;
export const SUPPORTED_CHART_FORMATS = ['svg', 'png'] as const;

export type ExportFormat = typeof SUPPORTED_EXPORT_FORMATS[number];
export type ChartFormat = typeof SUPPORTED_CHART_FORMATS[number];