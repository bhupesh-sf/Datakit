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
 * Exports data as plain text format
 */
export const exportAsText = (data: any[], fileName: string) => {
  const textContent = data.join('\n');
  downloadFile(textContent, `${fileName}.txt`, 'text/plain');
};


/**
 * Converts problem data to CSV format
 */
export const convertToCSV = (data: any[], columns?: string[]): string => {
  if (data.length === 0) return '';
  
  // If columns are provided separately (for array-based data), use them
  if (columns && Array.isArray(data[0])) {
    const csvContent = [
      columns.join(','),
      ...data.map(row => 
        row.map((value: any) => {
          const stringValue = value === null || value === undefined ? '' : String(value);
          // Escape quotes and wrap in quotes if contains comma, quote, or newline
          return stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')
            ? `"${stringValue.replace(/"/g, '""')}"`
            : stringValue;
        }).join(',')
      )
    ].join('\n');
    
    return csvContent;
  }
  
  // Otherwise, assume object-based data and extract headers from first object
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