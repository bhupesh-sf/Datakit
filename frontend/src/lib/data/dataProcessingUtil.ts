import { DataLoadWithDuckDBResult } from "@/components/layout/Sidebar";

import { ColumnType } from "@/types/csv";
import { DataSourceType } from "@/types/json";

/**
 * Utility for processing different data formats into unified structure
 */
export class DataProcessingUtil {
  /**
   * Detect data source type from file extension or content
   */
  static detectSourceType(
    fileName: string,
    contentType?: string
  ): DataSourceType {
    const ext = fileName.split(".").pop()?.toLowerCase();

    // Extension-based detection
    switch (ext) {
      case "json":
      case "jsonl":
      case "ndjson":
        return DataSourceType.JSON;
      case "xlsx":
      case "xls":
        return DataSourceType.XLSX;
      case "parquet":
        return DataSourceType.PARQUET;
      case "txt":
        return DataSourceType.TXT;
      case "tsv":
        return DataSourceType.TSV;
      case "csv":
      default:
        return DataSourceType.CSV;
    }
  }

  /**
   * Detect column types from sample data
   */
  static detectColumnTypes(
    headers: string[],
    sampleRows: string[][]
  ): ColumnType[] {
    return headers.map((header, index) => {
      // Get sample values for this column (excluding header)
      const sampleValues = sampleRows
        .slice(1, 20)
        .map((row) => row[index])
        .filter((val) => val && val.trim());

      if (sampleValues.length === 0) return ColumnType.Text;

      // Check for numbers
      const numericValues = sampleValues.filter(
        (val) => !isNaN(Number(val)) && val.trim() !== ""
      );
      if (numericValues.length > sampleValues.length * 0.8) {
        return ColumnType.Number;
      }

      // Check for booleans
      const booleanValues = sampleValues.filter((val) =>
        ["true", "false", "1", "0", "yes", "no"].includes(val.toLowerCase())
      );
      if (booleanValues.length > sampleValues.length * 0.8) {
        return ColumnType.Boolean;
      }

      // Check for dates
      const dateValues = sampleValues.filter((val) => !isNaN(Date.parse(val)));
      if (dateValues.length > sampleValues.length * 0.6) {
        return ColumnType.Date;
      }

      return ColumnType.Text;
    });
  }

  /**
   * Parse CSV content into tabular data
   */
  static parseCSV(content: string, delimiter = ","): string[][] {
    const lines = content.split("\n").filter((line) => line.trim());
    return lines.map((line) => {
      // Simple CSV parsing - you might want to use a more robust parser
      const result = [];
      let current = "";
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }

      result.push(current.trim());
      return result;
    });
  }

  /**
   * Parse JSON content into tabular data
   */
  static parseJSON(content: string): string[][] {
    try {
      const data = JSON.parse(content);

      if (!Array.isArray(data) || data.length === 0) {
        throw new Error("JSON must be an array of objects");
      }

      // Get all unique keys from all objects
      const allKeys = new Set<string>();
      data.forEach((item) => {
        if (typeof item === "object" && item !== null) {
          Object.keys(item).forEach((key) => allKeys.add(key));
        }
      });

      const headers = Array.from(allKeys);
      const rows = data.map((item) =>
        headers.map((key) => {
          const value = item[key];
          if (value === null || value === undefined) return "";
          if (typeof value === "object") return JSON.stringify(value);
          return String(value);
        })
      );

      return [headers, ...rows];
    } catch (error) {
      throw new Error(`Invalid JSON format: ${error.message}`);
    }
  }

  /**
   * Process different file formats into unified structure
   */
  static async processFileContent(
    content: string | ArrayBuffer,
    fileName: string,
    contentType?: string
  ): Promise<{
    data: string[][];
    columnTypes: ColumnType[];
    sourceType: DataSourceType;
    rowCount: number;
    columnCount: number;
  }> {
    const sourceType = this.detectSourceType(fileName, contentType);
    let data: string[][] = [];

    // Convert ArrayBuffer to string for text formats
    if (content instanceof ArrayBuffer) {
      if (
        sourceType === DataSourceType.XLSX ||
        sourceType === DataSourceType.PARQUET
      ) {
        throw new Error(
          `Binary format ${sourceType} requires specialized processing`
        );
      }
      content = new TextDecoder().decode(content);
    }

    // Parse based on detected format
    switch (sourceType) {
      case DataSourceType.CSV:
        data = this.parseCSV(content as string);
        break;
      case DataSourceType.TSV:
        data = this.parseCSV(content as string, "\t");
        break;
      case DataSourceType.JSON:
        data = this.parseJSON(content as string);
        break;
      case DataSourceType.TXT:
        // Treat as CSV by default
        data = this.parseCSV(content as string);
        break;
      default:
        throw new Error(`Unsupported format: ${sourceType}`);
    }

    if (data.length === 0) {
      throw new Error("No data found in file");
    }

    const headers = data[0] || [];
    const columnTypes = this.detectColumnTypes(headers, data);
    const rowCount = Math.max(0, data.length - 1); // Exclude header
    const columnCount = headers.length;

    return {
      data,
      columnTypes,
      sourceType,
      rowCount,
      columnCount,
    };
  }

  /**
   * Create DataLoadWithDuckDBResult from processed data
   */
  static createDataLoadResult(
    processedData: {
      data: string[][];
      columnTypes: ColumnType[];
      sourceType: DataSourceType;
      rowCount: number;
      columnCount: number;
    },
    fileName: string,
    options: {
      rawData?: any;
      tableName?: string;
      loadedToDuckDB?: boolean;
      isRemote?: boolean;
      remoteURL?: string;
      remoteProvider?: string;
      isStreamingImport?: boolean;
      convertedFromExcel?: boolean;
    } = {}
  ): DataLoadWithDuckDBResult {
    const tableName =
      options.tableName ||
      fileName.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();

    return {
      data: processedData.data,
      columnTypes: processedData.columnTypes,
      fileName,
      rowCount: processedData.rowCount,
      columnCount: processedData.columnCount,
      sourceType: processedData.sourceType,
      rawData: options.rawData,
      loadedToDuckDB: options.loadedToDuckDB ?? false,
      tableName,
      isRemote: options.isRemote,
      remoteURL: options.remoteURL,
      remoteProvider: options.remoteProvider as any,
      isStreamingImport: options.isStreamingImport,
      convertedFromExcel: options.convertedFromExcel,
    };
  }

  /**
   * Check if file size requires streaming
   */
  static shouldUseStreaming(fileSizeBytes: number): boolean {
    const sizeMB = fileSizeBytes / (1024 * 1024);
    const STREAMING_THRESHOLD = 10; // 10MB
    return sizeMB > STREAMING_THRESHOLD;
  }

  /**
   * Check if file is too large for browser processing
   */
  static isFileTooLarge(fileSizeBytes: number): boolean {
    const sizeGB = fileSizeBytes / (1024 * 1024 * 1024);
    const MAX_SIZE_GB = 2; // 2GB limit for browser
    return sizeGB > MAX_SIZE_GB;
  }

  /**
   * Get file size category
   */
  static getFileSizeCategory(
    fileSizeBytes: number
  ): "small" | "medium" | "large" | "huge" {
    const sizeMB = fileSizeBytes / (1024 * 1024);

    if (sizeMB < 1) return "small";
    if (sizeMB < 50) return "medium";
    if (sizeMB < 500) return "large";
    return "huge";
  }

  /**
   * Format file size for display
   */
  static formatFileSize(bytes: number): string {
    const sizes = ["B", "KB", "MB", "GB"];
    if (bytes === 0) return "0 B";

    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = (bytes / Math.pow(1024, i)).toFixed(1);

    return `${size} ${sizes[i]}`;
  }

  /**
   * Validate file for processing
   */
  static validateFile(
    fileName: string,
    fileSizeBytes: number
  ): {
    isValid: boolean;
    warnings: string[];
    errors: string[];
    recommendations: string[];
  } {
    const warnings: string[] = [];
    const errors: string[] = [];
    const recommendations: string[] = [];

    const sizeCategory = this.getFileSizeCategory(fileSizeBytes);
    const sizeMB = fileSizeBytes / (1024 * 1024);

    // Size validations
    if (this.isFileTooLarge(fileSizeBytes)) {
      errors.push(
        `File is too large (${this.formatFileSize(
          fileSizeBytes
        )}). Maximum supported size is 2GB.`
      );
      recommendations.push(
        "Consider splitting the file or using a server-side processing solution."
      );
    } else if (sizeCategory === "large") {
      warnings.push(
        `Large file detected (${this.formatFileSize(
          fileSizeBytes
        )}). Processing may take some time.`
      );
      recommendations.push(
        "Streaming import will be used automatically for better performance."
      );
    } else if (this.shouldUseStreaming(fileSizeBytes)) {
      warnings.push(
        `File size (${this.formatFileSize(
          fileSizeBytes
        )}) will use streaming import.`
      );
    }

    // Format validations
    const sourceType = this.detectSourceType(fileName);
    if (sourceType === DataSourceType.XLSX) {
      warnings.push(
        "Excel files will be converted to CSV format for processing."
      );
      recommendations.push(
        "For best performance, consider converting to CSV format before importing."
      );
    }

    return {
      isValid: errors.length === 0,
      warnings,
      errors,
      recommendations,
    };
  }
}

export default DataProcessingUtil;
