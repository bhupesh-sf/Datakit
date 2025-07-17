import { downloadFile, convertToCSV } from './exportUtils';

export interface DataExportOptions {
  limit?: number;
  includeHeaders?: boolean;
  format?: 'csv' | 'json' | 'excel' | 'parquet';
}

/**
 * Exports CSV data from DuckDB query result
 */
export const exportCSVFromDuckDB = async (
  duckDBStore: any,
  tableName: string,
  fileName: string,
  options: DataExportOptions = {}
) => {
  const { limit = 100000 } = options;
  
  const query = `SELECT * FROM ${tableName}`;
  const result = await duckDBStore.executePaginatedQuery(query, 1, limit, false, false);
  
  if (!result?.data) throw new Error('No data found');
  
  const headers = result.columns;
  const csvContent = [
    headers.join(','),
    ...result.data.map((row: any) =>
      headers.map((header: string) => {
        const value = row[header];
        const stringValue = value === null || value === undefined ? '' : String(value);
        return stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')
          ? `"${stringValue.replace(/"/g, '""')}"`
          : stringValue;
      }).join(',')
    )
  ].join('\n');
  
  const timestamp = new Date().toISOString().split('T')[0];
  const finalFileName = `${fileName}_export_${timestamp}.csv`;
  downloadFile(csvContent, finalFileName, 'text/csv');
};

/**
 * Exports JSON data from analysis results
 */
export const exportJSONFromResults = (
  results: any,
  activeFile?: { fileName?: string },
  options: DataExportOptions = {}
) => {
  const exportData = {
    metadata: {
      fileName: activeFile?.fileName,
      exportDate: new Date().toISOString(),
      analysisTimestamp: results?.analysisTimestamp,
    },
    analysis: {
      totalRows: results?.totalRows,
      totalColumns: results?.totalColumns,
      healthScore: results?.healthScore,
      healthBreakdown: results?.healthBreakdown,
      columnMetrics: results?.columnMetrics,
      typeIssues: results?.typeIssues,
      recommendations: results?.recommendations,
      duplicateInfo: {
        duplicateRows: results?.duplicateRows,
        duplicatePercentage: results?.duplicatePercentage,
      },
    },
  };
  
  const fileName = `${activeFile?.fileName || 'data'}_analysis_${new Date().toISOString().split('T')[0]}.json`;
  downloadFile(JSON.stringify(exportData, null, 2), fileName, 'application/json');
};

/**
 * Exports Parquet-compatible data (JSON + CSV)
 */
export const exportParquetCompatible = async (
  duckDBStore: any,
  tableName: string,
  activeFile?: { fileName?: string },
  options: DataExportOptions = {}
) => {
  const { limit = 100000 } = options;
  
  try {
    // Try to use DuckDB's COPY TO PARQUET first
    const fileName = `${activeFile?.fileName?.replace(/\.[^/.]+$/, '') || 'data'}_export_${new Date().toISOString().split('T')[0]}.parquet`;
    
    try {
      const exportQuery = `COPY (SELECT * FROM ${tableName}) TO '${fileName}' (FORMAT PARQUET)`;
      await duckDBStore.executePaginatedQuery(exportQuery, 1, 1, false, false);
      throw new Error('Parquet export completed via DuckDB COPY command');
    } catch (duckdbError) {
      // DuckDB COPY TO file system might not work in browser
      console.log('DuckDB COPY failed, falling back to data extraction:', duckdbError);
      
      // Get the data first
      const query = `SELECT * FROM ${tableName} LIMIT ${limit}`;
      const result = await duckDBStore.executePaginatedQuery(query, 1, limit, false, false);
      
      if (!result.data || result.data.length === 0) {
        throw new Error('No data to export');
      }
      
      // Create a JSON representation that could be converted to Parquet
      const jsonData = result.data.map((row: any) => {
        const obj: any = {};
        result.columns.forEach((col: string, index: number) => {
          obj[col] = row[index];
        });
        return obj;
      });
      
      // Export as JSON with instructions for Parquet conversion
      const jsonContent = JSON.stringify({
        metadata: {
          originalFile: activeFile?.fileName,
          exportDate: new Date().toISOString(),
          rowCount: result.data.length,
          columns: result.columns,
          note: "This JSON file can be converted to Parquet using tools like Python pandas: pd.read_json('file.json').to_parquet('file.parquet')"
        },
        data: jsonData
      }, null, 2);
      
      const jsonFileName = `${activeFile?.fileName?.replace(/\.[^/.]+$/, '') || 'data'}_for_parquet_${new Date().toISOString().split('T')[0]}.json`;
      downloadFile(jsonContent, jsonFileName, 'application/json');
      
      // Also provide CSV as alternative
      const csvContent = convertToCSV(result.data, result.columns);
      const csvFileName = `${activeFile?.fileName?.replace(/\.[^/.]+$/, '') || 'data'}_export_${new Date().toISOString().split('T')[0]}.csv`;
      downloadFile(csvContent, csvFileName, 'text/csv');
      
      throw new Error('Parquet export completed as JSON + CSV. Use tools like Python pandas to convert JSON to Parquet format.');
    }
  } catch (error) {
    console.error('Parquet export failed:', error);
    throw error;
  }
};

/**
 * Exports column-specific data with distinct values
 */
export const exportColumnData = async (
  duckDBStore: any,
  tableName: string,
  columnName: string,
  format: string,
  activeFile?: { fileName?: string },
  options: DataExportOptions = {}
) => {
  const { limit = 1000000 } = options;
  
  try {
    const query = `SELECT DISTINCT "${columnName}" FROM ${tableName} WHERE "${columnName}" IS NOT NULL ORDER BY "${columnName}"`;
    const result = await duckDBStore.executePaginatedQuery(query, 1, limit, false, false);
    
    if (!result?.data) {
      throw new Error('No data found');
    }
    
    const columnData = result.data.map((row: any) => row[columnName]);
    const timestamp = new Date().toISOString().split('T')[0];
    const fileName = `${activeFile?.fileName || 'data'}_${columnName}_${timestamp}`;
    
    switch (format) {
      case 'csv':
        const csvContent = [columnName, ...columnData.map(value => `"${String(value).replace(/"/g, '""')}"`)].join('\n');
        downloadFile(csvContent, `${fileName}.csv`, 'text/csv');
        break;
      case 'json':
        const jsonData = {
          column: columnName,
          values: columnData,
          metadata: {
            exportDate: new Date().toISOString(),
            totalValues: columnData.length
          }
        };
        downloadFile(JSON.stringify(jsonData, null, 2), `${fileName}.json`, 'application/json');
        break;
      case 'txt':
        const textContent = columnData.join('\n');
        downloadFile(textContent, `${fileName}.txt`, 'text/plain');
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  } catch (error) {
    console.error('Column export failed:', error);
    throw error;
  }
};