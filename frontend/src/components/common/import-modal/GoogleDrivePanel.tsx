import { useState, useCallback, useEffect } from 'react';
import { useDuckDBStore } from '@/store/duckDBStore';
import { ColumnType } from '@/types/csv';
import { DataSourceType } from '@/types/json';

// Google Drive API types
interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime: string;
  iconLink?: string;
  webViewLink: string;
}

interface GoogleDriveImportResult {
  data: string[][];
  columnTypes: ColumnType[];
  fileName: string;
  rowCount: number;
  columnCount: number;
  sourceType: DataSourceType;
  loadedToDuckDB: boolean;
  tableName: string;
  googleDrive: {
    fileId: string;
    fileName: string;
    mimeType: string;
  };
}

// Google API configuration
const GOOGLE_CONFIG = {
  apiKey: import.meta.env.VITE_GOOGLE_API_KEY || 'your-api-key-here',
  clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || 'your-client-id-here',
  discoveryDoc: 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
  scope: 'https://www.googleapis.com/auth/drive.readonly'
};

// Supported MIME types for import
const SUPPORTED_MIME_TYPES = [
  'text/csv',
  'application/json',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.google-apps.spreadsheet',
  'text/plain'
];

/**
 * Hook for importing files from Google Drive with OAuth authentication
 */
export default function useGoogleDriveImport() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState('');

  // DuckDB store for data processing
  const duckDB = useDuckDBStore();

  // Initialize Google API
  useEffect(() => {
    const initializeGoogleAPI = async () => {
      try {
        // Wait for gapi to load
        await new Promise<void>((resolve) => {
          if (window.gapi) {
            resolve();
          } else {
            const script = document.createElement('script');
            script.src = 'https://apis.google.com/js/api.js';
            script.onload = () => resolve();
            document.head.appendChild(script);
          }
        });

        // Initialize the API
        await new Promise<void>((resolve) => {
          window.gapi.load('auth2:client', resolve);
        });

        await window.gapi.client.init({
          apiKey: GOOGLE_CONFIG.apiKey,
          clientId: GOOGLE_CONFIG.clientId,
          discoveryDocs: [GOOGLE_CONFIG.discoveryDoc],
          scope: GOOGLE_CONFIG.scope
        });

        // Check if user is already signed in
        const authInstance = window.gapi.auth2.getAuthInstance();
        if (authInstance.isSignedIn.get()) {
          setIsAuthenticated(true);
        }

        console.log('[GoogleDrive] API initialized successfully');
      } catch (err) {
        console.error('[GoogleDrive] Failed to initialize API:', err);
        setError('Failed to initialize Google Drive API. Please check your configuration.');
      }
    };

    initializeGoogleAPI();
  }, []);

  /**
   * Sign in to Google Drive
   */
  const signIn = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const authInstance = window.gapi.auth2.getAuthInstance();
      
      if (!authInstance) {
        throw new Error('Google Auth not initialized');
      }

      await authInstance.signIn();
      setIsAuthenticated(true);
      
      console.log('[GoogleDrive] User signed in successfully');
    } catch (err) {
      console.error('[GoogleDrive] Sign in failed:', err);
      setError(`Sign in failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Sign out from Google Drive
   */
  const signOut = useCallback(async () => {
    try {
      const authInstance = window.gapi.auth2.getAuthInstance();
      await authInstance.signOut();
      setIsAuthenticated(false);
      setFiles([]);
      setError(null);
      
      console.log('[GoogleDrive] User signed out successfully');
    } catch (err) {
      console.error('[GoogleDrive] Sign out failed:', err);
      setError(`Sign out failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, []);

  /**
   * Fetch files from Google Drive
   */
  const fetchFiles = useCallback(async () => {
    if (!isAuthenticated) {
      setError('Not authenticated with Google Drive');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Build query for supported file types
      const mimeTypeQuery = SUPPORTED_MIME_TYPES
        .map(type => `mimeType='${type}'`)
        .join(' or ');

      const response = await window.gapi.client.drive.files.list({
        q: `(${mimeTypeQuery}) and trashed=false`,
        fields: 'files(id,name,mimeType,size,modifiedTime,iconLink,webViewLink)',
        orderBy: 'modifiedTime desc',
        pageSize: 50
      });

      const fetchedFiles = response.result.files || [];
      setFiles(fetchedFiles);
      
      console.log(`[GoogleDrive] Fetched ${fetchedFiles.length} supported files`);
    } catch (err) {
      console.error('[GoogleDrive] Failed to fetch files:', err);
      setError(`Failed to fetch files: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  /**
   * Download file content from Google Drive
   */
  const downloadFile = useCallback(async (fileId: string, mimeType: string): Promise<Blob> => {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: {
          'Authorization': `Bearer ${window.gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().access_token}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }

    return response.blob();
  }, []);

  /**
   * Convert Google Sheets to CSV
   */
  const exportGoogleSheet = useCallback(async (fileId: string): Promise<Blob> => {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/csv`,
      {
        headers: {
          'Authorization': `Bearer ${window.gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().access_token}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to export Google Sheet: ${response.statusText}`);
    }

    return response.blob();
  }, []);

  /**
   * Download and import a file from Google Drive
   */
  const downloadAndImportFile = useCallback(async (
    fileId: string,
    fileName: string
  ): Promise<GoogleDriveImportResult> => {
    try {
      setImportProgress(0);
      setImportStatus('Downloading file from Google Drive...');

      // Get file metadata
      const fileResponse = await window.gapi.client.drive.files.get({
        fileId,
        fields: 'id,name,mimeType,size'
      });

      const fileInfo = fileResponse.result;
      setImportProgress(0.2);

      // Download file content
      let blob: Blob;
      let actualFileName = fileName;
      let sourceType = DataSourceType.CSV;

      if (fileInfo.mimeType === 'application/vnd.google-apps.spreadsheet') {
        setImportStatus('Exporting Google Sheet as CSV...');
        blob = await exportGoogleSheet(fileId);
        actualFileName = fileName.replace(/\.[^/.]+$/, '') + '.csv';
        sourceType = DataSourceType.CSV;
      } else {
        setImportStatus('Downloading file...');
        blob = await downloadFile(fileId, fileInfo.mimeType);
        
        // Determine source type from MIME type
        if (fileInfo.mimeType.includes('json')) {
          sourceType = DataSourceType.JSON;
        } else if (fileInfo.mimeType.includes('excel') || fileInfo.mimeType.includes('spreadsheet')) {
          sourceType = DataSourceType.XLSX;
        } else if (fileInfo.mimeType.includes('csv')) {
          sourceType = DataSourceType.CSV;
        } else if (fileInfo.mimeType.includes('text')) {
          sourceType = DataSourceType.TXT;
        }
      }

      setImportProgress(0.4);

      // Convert blob to File object
      const file = new File([blob], actualFileName, { type: blob.type });

      setImportStatus('Processing file with DuckDB...');
      setImportProgress(0.6);

      // Import using DuckDB
      const importResult = await duckDB.importFileDirectly(file);

      setImportStatus('Getting data preview...');
      setImportProgress(0.8);

      // Get schema and sample data
      const schemaResult = await duckDB.executeQuery(
        `PRAGMA table_info("${importResult.tableName}")`
      );
      
      if (!schemaResult) {
        throw new Error('Failed to get table schema');
      }

      const sampleResult = await duckDB.executeQuery(
        `SELECT * FROM "${importResult.tableName}" LIMIT 1000`
      );
      
      if (!sampleResult) {
        throw new Error('Failed to get data sample');
      }

      // Convert to expected format
      const headers = schemaResult.toArray().map((col: any) => col.name);
      const sampleData = [
        headers,
        ...sampleResult.toArray().map((row: any) =>
          headers.map((col: string) => {
            const value = row[col];
            return value !== null && value !== undefined ? String(value) : '';
          })
        ),
      ];

      // Detect column types from schema
      const columnTypes = schemaResult.toArray().map((col: any) => {
        const type = col.type.toLowerCase();
        if (type.includes('int') || type.includes('float') || type.includes('double')) {
          return ColumnType.Number;
        } else if (type.includes('bool')) {
          return ColumnType.Boolean;
        } else if (type.includes('date') || type.includes('time')) {
          return ColumnType.Date;
        } else if (type.includes('json') || type.includes('object')) {
          return ColumnType.Object;
        } else if (type.includes('array') || type.includes('list')) {
          return ColumnType.Array;
        } else {
          return ColumnType.Text;
        }
      });

      setImportStatus('Import completed successfully!');
      setImportProgress(1.0);

      const result: GoogleDriveImportResult = {
        data: sampleData,
        columnTypes,
        fileName: actualFileName,
        rowCount: importResult.rowCount,
        columnCount: headers.length,
        sourceType,
        loadedToDuckDB: true,
        tableName: importResult.tableName,
        googleDrive: {
          fileId,
          fileName: actualFileName,
          mimeType: fileInfo.mimeType
        }
      };

      console.log(`[GoogleDrive] Successfully imported file: ${actualFileName}`);
      return result;

    } catch (err) {
      console.error('[GoogleDrive] Import failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Import failed: ${errorMessage}`);
      throw err;
    } finally {
      // Reset progress after a delay
      setTimeout(() => {
        setImportProgress(0);
        setImportStatus('');
      }, 2000);
    }
  }, [duckDB, downloadFile, exportGoogleSheet]);

  return {
    // State
    isAuthenticated,
    isLoading,
    files,
    error,
    importProgress,
    importStatus,

    // Actions
    signIn,
    signOut,
    fetchFiles,
    downloadAndImportFile,

    // Utilities
    resetError: () => setError(null)
  };
}

// Extend window object for Google API
declare global {
  interface Window {
    gapi: any;
  }
}