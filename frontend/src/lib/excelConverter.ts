import * as XLSX from 'xlsx';

/**
 * Converts an Excel file to CSV format using SheetJS
 */
export async function convertExcelToCSV(file: File): Promise<{
  csvData: string;
  fileName: string;
  sheetNames: string[];
  rowCount: number;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Get the first sheet by default
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to CSV
        const csvData = XLSX.utils.sheet_to_csv(worksheet);
        
        // Get approximate row count
        const rowCount = csvData.split('\n').length - 1;
        
        // Create a file name without extension
        const baseName = file.name.replace(/\.[^/.]+$/, "");
        const csvFileName = `${baseName}_converted.csv`;
        
        resolve({
          csvData,
          fileName: csvFileName,
          sheetNames: workbook.SheetNames,
          rowCount
        });
      } catch (err) {
        reject(err);
      }
    };
    
    reader.onerror = (err) => {
      reject(err);
    };
    
    // Read the file as an array buffer
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Create a File object from the CSV data
 */
export function createCSVFile(csvData: string, fileName: string): File {
  const blob = new Blob([csvData], { type: 'text/csv' });
  return new File([blob], fileName, { type: 'text/csv' });
}