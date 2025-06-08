/**
 * @fileoverview Type definitions for HuggingFace dataset import functionality
 * @module HuggingFaceTypes
 */

import { ColumnType } from "@/types/csv";
import { DataSourceType } from "@/types/json";

/**
 * Result type from HuggingFace dataset import operations
 */
export interface HFImportResult {
  /** Preview data including headers */
  data: string[][];
  /** Detected column types for each column */
  columnTypes: ColumnType[];
  /** Generated filename for the imported dataset */
  fileName: string;
  /** Total number of rows in the dataset */
  rowCount: number;
  /** Total number of columns in the dataset */
  columnCount: number;
  /** Source data type (Parquet, CSV, JSON, etc.) */
  sourceType: DataSourceType;
  /** Whether the data was successfully loaded into DuckDB */
  loadedToDuckDB: boolean;
  /** Table name used in DuckDB */
  tableName: string;
  /** HuggingFace-specific metadata */
  huggingface: HFMetadata;
}

/**
 * HuggingFace-specific metadata for imported datasets
 */
export interface HFMetadata {
  /** Original dataset identifier (org/dataset) */
  datasetId: string;
  /** Configuration name used for import */
  config?: string;
  /** Split name (train, test, validation, etc.) */
  split?: string;
  /** Direct URL to the imported file */
  parquetUrl: string;
  /** File size in bytes */
  fileSize?: number;
  /** Import method used */
  method: "direct" | "proxy" | "failed";
  /** Full dataset metadata from HF API */
  metadata?: any;
  /** Available formats detected for this dataset */
  availableFormats?: AvailableFormat[];
}

/**
 * Dataset ID validation result
 */
export interface DatasetIdValidation {
  /** Whether the dataset ID format is valid */
  isValid: boolean;
  /** Extracted organization name */
  organization?: string;
  /** Extracted dataset name */
  dataset?: string;
  /** Error message if validation failed */
  error?: string;
}

/**
 * Import configuration options
 */
export interface HFImportOptions {
  /** HuggingFace authentication token */
  authToken?: string;
  /** Dataset configuration to use */
  config?: string;
  /** Dataset split to import */
  split?: string;
  /** Dataset subset (deprecated) */
  subset?: string;
  /** Preferred file format for import */
  preferredFormat?: "parquet" | "csv" | "json" | "auto";
}

/**
 * Available file format information
 */
export interface AvailableFormat {
  /** File format type */
  type: "parquet" | "csv" | "json" | "xlsx" | "txt";
  /** Direct URL to the file */
  url: string;
  /** File size in bytes */
  size?: number;
  /** Dataset split this file represents */
  split?: string;
}

/**
 * Format detection result
 */
export interface FormatDetectionResult {
  /** List of available formats */
  formats: AvailableFormat[];
  /** Recommended format based on performance/compatibility */
  recommendedFormat: string;
}

/**
 * Memory monitoring information
 */
export interface MemoryInfo {
  /** Used memory in MB */
  usedMB: number;
  /** Memory usage ratio (0-1) */
  ratio: number;
}

/**
 * File fetch result with metadata
 */
export interface FetchResult {
  /** Downloaded file as Blob */
  blob: Blob;
  /** Method used for download */
  method: "direct" | "proxy";
  /** File size in bytes */
  fileSize: number;
}

/**
 * Import strategy configuration
 */
export interface ImportStrategy {
  /** Strategy name for logging */
  name: string;
  /** Strategy execution function */
  fn: () => Promise<HFImportResult>;
}