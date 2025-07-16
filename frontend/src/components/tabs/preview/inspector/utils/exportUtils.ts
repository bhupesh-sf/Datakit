import { InspectorMetrics } from '@/store/inspectorStore';

export interface ExportOptions {
  fileName?: string;
  includeMetadata?: boolean;
}

/**
 * Downloads a file with the given content
 */
export const downloadFile = (content: string, fileName: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Exports data as CSV format
 */
export const exportAsCSV = (data: any[], columnName: string, fileName: string) => {
  const csvContent = [
    columnName,
    ...data.map(value => `"${String(value).replace(/"/g, '""')}"`)
  ].join('\n');
  
  downloadFile(csvContent, `${fileName}.csv`, 'text/csv');
};

/**
 * Exports data as JSON format
 */
export const exportAsJSON = (data: any[], columnName: string, fileName: string) => {
  const jsonData = {
    column: columnName,
    values: data,
    metadata: {
      exportDate: new Date().toISOString(),
      totalValues: data.length
    }
  };
  
  downloadFile(JSON.stringify(jsonData, null, 2), `${fileName}.json`, 'application/json');
};

/**
 * Exports data as plain text format
 */
export const exportAsText = (data: any[], fileName: string) => {
  const textContent = data.join('\n');
  downloadFile(textContent, `${fileName}.txt`, 'text/plain');
};

/**
 * Exports data as Excel format (fallback to CSV)
 */
export const exportAsExcel = async (data: any[], columnName: string, fileName: string) => {
  // This would require a library like xlsx
  // For now, fall back to CSV
  exportAsCSV(data, columnName, fileName);
};

/**
 * Converts problem data to CSV format
 */
export const convertToCSV = (data: any[]): string => {
  if (data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        const stringValue = value === null || value === undefined ? '' : String(value);
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        return stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')
          ? `"${stringValue.replace(/"/g, '""')}"`
          : stringValue;
      }).join(',')
    )
  ].join('\n');
  
  return csvContent;
};

/**
 * Generates a timestamped filename
 */
export const generateFileName = (baseName: string, extension: string, suffix?: string): string => {
  const timestamp = new Date().toISOString().split('T')[0];
  const parts = [baseName, suffix, timestamp].filter(Boolean);
  return `${parts.join('_')}.${extension}`;
};