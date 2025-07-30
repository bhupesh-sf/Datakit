import { generatePDF, downloadJSON, downloadText } from './exportUtils';

interface QueryResult {
  query: string;
  results?: any[][];
  columns?: string[];
  executionTime?: number;
  totalRows?: number;
  error?: string;
}

interface QueryExportOptions {
  filename?: string;
  includeMetadata?: boolean;
  format?: 'csv' | 'json' | 'sql' | 'pdf';
}

/**
 * Export query results as CSV
 */
export const exportQueryAsCSV = (
  results: any[][] = [],
  columns: string[] = [],
  filename: string = 'Query_Results'
): void => {
  try {
    if (results.length === 0 || columns.length === 0) {
      throw new Error('No data to export');
    }

    // Create CSV content
    const csvContent = [
      // Header row
      columns.map(col => `"${col.replace(/"/g, '""')}"`).join(','),
      // Data rows
      ...results.map(row => 
        row.map(cell => {
          const cellValue = cell === null || cell === undefined ? '' : String(cell);
          return `"${cellValue.replace(/"/g, '""')}"`;
        }).join(',')
      )
    ].join('\n');

    downloadText(csvContent, filename, 'csv');

  } catch (error) {
    console.error('Failed to export CSV:', error);
    throw new Error('CSV export failed. Please try again.');
  }
};

/**
 * Export query results as JSON
 */
export const exportQueryAsJSON = (
  queryResult: QueryResult,
  options: QueryExportOptions = {}
): void => {
  try {
    const { filename = 'Query_Results', includeMetadata = true } = options;

    let exportData: any;

    if (includeMetadata) {
      exportData = {
        query: queryResult.query,
        executedAt: new Date().toISOString(),
        executionTime: queryResult.executionTime,
        totalRows: queryResult.totalRows,
        columns: queryResult.columns,
        data: queryResult.results,
        error: queryResult.error
      };
    } else {
      // Just export the raw data
      if (queryResult.columns && queryResult.results) {
        exportData = queryResult.results.map(row => {
          const obj: Record<string, any> = {};
          queryResult.columns!.forEach((col, index) => {
            obj[col] = row[index];
          });
          return obj;
        });
      } else {
        exportData = queryResult.results;
      }
    }

    downloadJSON(exportData, filename);

  } catch (error) {
    console.error('Failed to export JSON:', error);
    throw new Error('JSON export failed. Please try again.');
  }
};

/**
 * Export query as SQL file
 */
export const exportQueryAsSQL = (
  query: string,
  filename: string = 'Query'
): void => {
  try {
    if (!query.trim()) {
      throw new Error('No query to export');
    }

    const sqlContent = `-- DataKit SQL Query
-- Generated on: ${new Date().toLocaleDateString()}

${query}`;

    downloadText(sqlContent, filename, 'sql');

  } catch (error) {
    console.error('Failed to export SQL:', error);
    throw new Error('SQL export failed. Please try again.');
  }
};

/**
 * Generate HTML content for query results PDF
 */
const generateQueryResultsHTML = (queryResult: QueryResult): string => {
  const { query, results = [], columns = [], executionTime, totalRows, error } = queryResult;

  let html = `
    <div style="margin-bottom: 20px;">
      <h2 style="color: #000; margin-bottom: 10px;">SQL Query</h2>
      <pre style="background-color: #f8f8f8; padding: 15px; border-radius: 4px; border: 1px solid #e0e0e0; font-family: 'Consolas', 'Monaco', monospace; white-space: pre-wrap; word-break: break-word;">${query}</pre>
    </div>
  `;

  // Add metadata
  if (executionTime !== undefined || totalRows !== undefined) {
    html += `
      <div style="margin-bottom: 20px; padding: 10px; background-color: #f5f5f5; border-radius: 4px; border: 1px solid #e0e0e0;">
        <h3 style="color: #000; margin: 0 0 5px 0; font-size: 14px;">Execution Details</h3>
    `;
    
    if (executionTime !== undefined) {
      html += `<p style="margin: 2px 0; font-size: 12px;">Execution Time: ${executionTime.toFixed(0)}ms</p>`;
    }
    
    if (totalRows !== undefined) {
      html += `<p style="margin: 2px 0; font-size: 12px;">Total Rows: ${totalRows.toLocaleString()}</p>`;
    }
    
    html += '</div>';
  }

  // Add error if exists
  if (error) {
    html += `
      <div style="margin-bottom: 20px; padding: 10px; background-color: #ffebee; border-radius: 4px; border: 1px solid #e57373; color: #c62828;">
        <h3 style="color: #c62828; margin: 0 0 5px 0; font-size: 14px;">Error</h3>
        <p style="margin: 0; font-size: 12px; white-space: pre-wrap;">${error}</p>
      </div>
    `;
    return html;
  }

  // Add results table
  if (results.length > 0 && columns.length > 0) {
    html += `
      <div>
        <h2 style="color: #000; margin-bottom: 10px;">Results</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <thead>
            <tr style="background-color: #f5f5f5;">
    `;

    // Table headers
    columns.forEach(column => {
      html += `
        <th style="border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: bold; color: #000;">
          ${column}
        </th>
      `;
    });

    html += `
            </tr>
          </thead>
          <tbody>
    `;

    // Table rows (limit to first 100 rows for PDF)
    const limitedResults = results.slice(0, 100);
    limitedResults.forEach((row, rowIndex) => {
      html += `<tr style="${rowIndex % 2 === 0 ? 'background-color: #fafafa;' : ''}">`;
      
      row.forEach(cell => {
        const cellValue = cell === null || cell === undefined ? '' : String(cell);
        const truncatedValue = cellValue.length > 100 ? cellValue.substring(0, 100) + '...' : cellValue;
        html += `
          <td style="border: 1px solid #ddd; padding: 6px; color: #333; word-break: break-word;">
            ${truncatedValue}
          </td>
        `;
      });
      
      html += '</tr>';
    });

    html += `
          </tbody>
        </table>
    `;

    // Add note if results were truncated
    if (results.length > 100) {
      html += `
        <p style="margin-top: 10px; font-size: 11px; color: #666; font-style: italic;">
          Note: Only the first 100 rows are shown in this PDF. Total rows: ${results.length.toLocaleString()}
        </p>
      `;
    }

    html += '</div>';
  } else {
    html += `
      <div style="padding: 20px; text-align: center; color: #666; font-style: italic;">
        No results to display
      </div>
    `;
  }

  return html;
};

/**
 * Export query results as PDF
 */
export const exportQueryAsPDF = async (
  queryResult: QueryResult,
  filename: string = 'Query_Results'
): Promise<void> => {
  try {
    const htmlContent = generateQueryResultsHTML(queryResult);
    
    await generatePDF(htmlContent, {
      filename,
      title: 'SQL Query Results',
      includeTimestamp: true
    });

  } catch (error) {
    console.error('Failed to export PDF:', error);
    throw new Error('PDF export failed. Please try again.');
  }
};

/**
 * Auto-detect best export format based on data
 */
export const getRecommendedExportFormat = (queryResult: QueryResult): 'csv' | 'json' | 'sql' => {
  const { results = [], columns = [], error } = queryResult;

  // If there's an error, export as SQL
  if (error) return 'sql';

  // If no results, export as SQL
  if (results.length === 0) return 'sql';

  // If results are structured (tabular), recommend CSV
  if (columns.length > 0 && results.length > 0) return 'csv';

  // Default to JSON for complex data
  return 'json';
};

/**
 * Unified export function that handles all formats
 */
export const exportQuery = async (
  queryResult: QueryResult,
  format: 'csv' | 'json' | 'sql' | 'pdf',
  filename?: string
): Promise<void> => {
  const baseName = filename || 'DataKit_Query_Export';

  switch (format) {
    case 'csv':
      return exportQueryAsCSV(queryResult.results, queryResult.columns, baseName);
    
    case 'json':
      return exportQueryAsJSON(queryResult, { filename: baseName });
    
    case 'sql':
      return exportQueryAsSQL(queryResult.query, baseName);
    
    case 'pdf':
      return exportQueryAsPDF(queryResult, baseName);
    
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
};