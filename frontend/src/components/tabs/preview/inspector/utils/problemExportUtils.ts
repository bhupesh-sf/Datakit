import { convertToCSV, downloadFile, generateFileName } from './exportUtils';

export type ProblemType = 'duplicates' | 'nulls' | 'type_issues';

export interface ProblemExportOptions {
  limit?: number;
  includeMetadata?: boolean;
}

/**
 * Fetches and exports problem data based on type
 * Note: This requires the inspector store functions to be passed as parameters
 */
export const handleProblemExport = async (
  problemType: ProblemType,
  activeFileId: string,
  activeFileName?: string,
  columnName?: string,
  fetchFunctions: {
    fetchDuplicateRows: (fileId: string, limit: number) => Promise<any[]>;
    fetchNullRows: (fileId: string, column: string, limit: number) => Promise<any[]>;
    fetchTypeIssueRows: (fileId: string, column: string, limit: number) => Promise<any[]>;
  },
  options: ProblemExportOptions = {}
) => {
  const { limit = 1000 } = options;

  try {
    let data: any[] = [];
    let fileName = '';

    switch (problemType) {
      case 'duplicates':
        data = await fetchFunctions.fetchDuplicateRows(activeFileId, limit);
        fileName = generateFileName(activeFileName || 'data', 'csv', 'duplicates');
        break;
      case 'nulls':
        if (!columnName) throw new Error('Column name required for null export');
        data = await fetchFunctions.fetchNullRows(activeFileId, columnName, limit);
        fileName = generateFileName(activeFileName || 'data', 'csv', `${columnName}_nulls`);
        break;
      case 'type_issues':
        if (!columnName) throw new Error('Column name required for type issues export');
        data = await fetchFunctions.fetchTypeIssueRows(activeFileId, columnName, limit);
        fileName = generateFileName(activeFileName || 'data', 'csv', `${columnName}_type_issues`);
        break;
      default:
        throw new Error(`Unsupported problem type: ${problemType}`);
    }

    if (data.length === 0) {
      throw new Error('No data found for export');
    }

    // Convert to CSV and download
    const csvContent = convertToCSV(data);
    downloadFile(csvContent, fileName, 'text/csv');
  } catch (error) {
    console.error('Problem export failed:', error);
    throw error;
  }
};

/**
 * Exports all problems as a comprehensive report
 */
export const exportAllProblems = async (
  activeFileId: string,
  activeTableName: string,
  activeFileName?: string,
  options: ProblemExportOptions = {}
) => {
  try {
    const problems = {
      duplicates: [],
      nulls: {},
      typeIssues: {}
    };

    // Fetch all problem types
    // Note: This would need to be implemented based on available columns
    // For now, just export duplicates as an example
    problems.duplicates = await useInspectorStore.getState().fetchDuplicateRows(activeFileId, options.limit || 1000);

    const report = {
      exportDate: new Date().toISOString(),
      file: activeFileName,
      problems,
      summary: {
        totalDuplicates: problems.duplicates.length,
        // Add other summaries as needed
      }
    };

    const fileName = generateFileName(activeFileName || 'data', 'json', 'problems_report');
    downloadFile(JSON.stringify(report, null, 2), fileName, 'application/json');
  } catch (error) {
    console.error('All problems export failed:', error);
    throw error;
  }
};