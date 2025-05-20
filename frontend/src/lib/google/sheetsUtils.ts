/**
 * Utilities for handling Google Sheets URL parsing and data fetching
 */

import { DataSourceType } from "@/types/json";

/**
 * Interface for parsed Google Sheets information
 */
export interface GoogleSheetsInfo {
  /** Is the URL a valid Google Sheets URL */
  isGoogleSheet: boolean;
  /** Document ID extracted from the URL */
  docId: string | null;
  /** Sheet ID (gid parameter) if specified */
  sheetId: string | null;
  /** Sheet name if available */
  sheetName: string | null;
  /** Detected format from the URL */
  format: 'csv' | 'xlsx' | 'html' | null;
  /** Complete export URL for fetching the sheet */
  exportUrl: string | null;
  /** Original URL provided by the user */
  originalUrl: string;
}

/**
 * Parse a URL to detect if it's a Google Sheets URL and extract relevant information
 */
export function parseGoogleSheetsUrl(url: string): GoogleSheetsInfo {
  const result: GoogleSheetsInfo = {
    isGoogleSheet: false,
    docId: null,
    sheetId: null,
    sheetName: null,
    format: null,
    exportUrl: null,
    originalUrl: url,
  };
  
  try {
    if (!url) return result;
    
    const urlObj = new URL(url);
    
    // Check if it's a Google Sheets URL
    if (!urlObj.hostname.includes('docs.google.com') || 
        !urlObj.pathname.includes('/spreadsheets/')) {
      return result;
    }
    
    result.isGoogleSheet = true;
    
    // Extract sheet ID (gid parameter) if present
    result.sheetId = urlObj.searchParams.get('gid') || null;
    
    // Try to get sheet name from URL
    result.sheetName = urlObj.searchParams.get('sheet') || null;
    
    // Extract document ID from URL
    let docId = '';
    
    if (url.includes('/d/')) {
      // Direct link format
      const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) docId = match[1];
    } else if (url.includes('/e/')) {
      // Published link format with encrypted ID
      const match = url.match(/\/e\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) docId = match[1];
    }
    
    result.docId = docId;
    
    // Determine format from URL
    if (url.includes('output=csv')) {
      result.format = 'csv';
    } else if (url.includes('output=xlsx')) {
      result.format = 'xlsx';
    } else if (url.includes('pubhtml')) {
      result.format = 'html';
    } else {
      // Default to CSV if no format specified
      result.format = 'csv';
    }
    
    // Generate proper export URL
    if (docId) {
      // For published sheets
      if (url.includes('/pub')) {
        // URL structure for published sheets
        const baseUrl = url.split('?')[0];
        const format = result.format;
        const gidParam = result.sheetId ? `&gid=${result.sheetId}` : '';
        result.exportUrl = `${baseUrl}?output=${format}${gidParam}`;
      } else {
        // For direct access URLs (may require authorization)
        result.exportUrl = getExportUrlFromDocId(docId, result.format, result.sheetId);
      }
    }
    
    return result;
  } catch (err) {
    console.error('Error parsing Google Sheets URL:', err);
    return result;
  }
}

/**
 * Generate an export URL for a Google Sheet by document ID
 */
export function getExportUrlFromDocId(
  docId: string, 
  format: 'csv' | 'xlsx' | 'html' = 'csv',
  sheetId: string | null = null
): string {
  const baseUrl = `https://docs.google.com/spreadsheets/d/${docId}/export`;
  const formatParam = `format=${format}`;
  const gidParam = sheetId ? `&gid=${sheetId}` : '';
  
  return `${baseUrl}?${formatParam}${gidParam}`;
}

/**
 * Fetches a Google Sheet and returns it as a File object
 */
export async function fetchGoogleSheet(
  sheetInfo: GoogleSheetsInfo
): Promise<{
  file: File;
  sheetName: string;
  size: number;
  rows: number;
  dataSourceType: DataSourceType;
}> {
  if (!sheetInfo.exportUrl) {
    throw new Error('No export URL available to fetch the Google Sheet');
  }
  
  try {
    console.log(`[GoogleSheets] Fetching sheet from: ${sheetInfo.exportUrl}`);
    
    // Fetch the sheet data
    const response = await fetch(sheetInfo.exportUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch Google Sheet: ${response.statusText} (${response.status})`);
    }
    
    // Get content size
    const contentLength = response.headers.get('content-length');
    const size = contentLength ? parseInt(contentLength, 10) : 0;
    
    // Process based on format
    const format = sheetInfo.format || 'csv';
    const timestamp = Date.now();
    const fileName = `google_sheet_${timestamp}.${format}`;
    let file: File;
    let dataSourceType: DataSourceType;
    
    if (format === 'csv') {
      const text = await response.text();
      file = new File([text], fileName, { type: 'text/csv' });
      dataSourceType = DataSourceType.CSV;
      
      // Estimate row count from CSV
      const rows = countCsvRows(text);
      
      return {
        file,
        sheetName: sheetInfo.sheetName || 'Sheet1',
        size,
        rows,
        dataSourceType
      };
    } else if (format === 'xlsx') {
      const blob = await response.blob();
      file = new File([blob], fileName, { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      dataSourceType = DataSourceType.XLSX;
      
      // We can't easily count rows in XLSX without parsing it
      return {
        file,
        sheetName: sheetInfo.sheetName || 'Sheet1',
        size,
        rows: -1, // Unknown until processed
        dataSourceType
      };
    } else {
      throw new Error(`Unsupported format: ${format}`);
    }
  } catch (err) {
    console.error('[GoogleSheets] Error fetching sheet:', err);
    throw err;
  }
}

/**
 * Quickly estimate the number of rows in a CSV string
 */
function countCsvRows(csvText: string): number {
  // Quick estimate by counting newlines
  return csvText.split('\n').length - 1; // -1 for header row
}

/**
 * Check if a Google Sheet is accessible and get basic info
 */
export async function checkGoogleSheetAccessibility(
  url: string
): Promise<{
  accessible: boolean;
  format?: 'csv' | 'xlsx' | 'html';
  contentLength?: number;
  error?: string;
}> {
  try {
    const sheetInfo = parseGoogleSheetsUrl(url);
    
    if (!sheetInfo.isGoogleSheet || !sheetInfo.exportUrl) {
      return {
        accessible: false,
        error: 'Not a valid Google Sheets URL'
      };
    }
    
    // Try a HEAD request first to check accessibility without downloading content
    const headResponse = await fetch(sheetInfo.exportUrl, { method: 'HEAD' });
    
    if (!headResponse.ok) {
      return {
        accessible: false,
        error: `Server returned status ${headResponse.status}: ${headResponse.statusText}`
      };
    }
    
    // Get content size if available
    const contentLength = headResponse.headers.get('content-length');
    const size = contentLength ? parseInt(contentLength, 10) : undefined;
    
    return {
      accessible: true,
      format: sheetInfo.format || 'csv',
      contentLength: size
    };
  } catch (err) {
    return {
      accessible: false,
      error: err instanceof Error ? err.message : 'Unknown error checking Google Sheet'
    };
  }
}

/**
 * Extract a user-friendly sheet name from the URL or sheet info
 */
export function getDisplaySheetName(sheetInfo: GoogleSheetsInfo): string {
  if (sheetInfo.sheetName) {
    return sheetInfo.sheetName;
  }
  
  // Try to extract a name from the URL
  try {
    const url = new URL(sheetInfo.originalUrl);
    const path = url.pathname;
    
    // For published sheets, try to get the document name
    if (path.includes('/pub')) {
      const matches = path.match(/\/d\/([^\/]+)/);
      if (matches && matches[1]) {
        return `Google Sheet: ${matches[1]}`;
      }
    }
    
    // Default fallback
    return 'Google Sheet';
  } catch {
    return 'Google Sheet';
  }
}