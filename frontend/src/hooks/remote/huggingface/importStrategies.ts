/**
 * @fileoverview Import strategy utilities for HuggingFace datasets
 * @module ImportStrategies
 */

import { useDuckDBStore } from "@/store/duckDBStore";
import { ColumnType } from "@/types/csv";
import { DataSourceType } from "@/types/json";
import {
  HFImportResult,
  HFImportOptions,
  ImportStrategy,
  AvailableFormat,
} from "./types";
import { getDatasetInfo, getParquetFiles, detectAvailableFormats } from "./api";
import { fetchWithCORSFallback } from "./network";

/**
 * Utility function to map file format to DataSourceType
 *
 * @param format - File format string
 * @returns Corresponding DataSourceType enum value
 */
export function getDataSourceTypeFromExtension(
  format?: string
): DataSourceType {
  switch (format) {
    case "csv":
      return DataSourceType.CSV;
    case "json":
      return DataSourceType.JSON;
    case "parquet":
    default:
      return DataSourceType.PARQUET;
  }
}

/**
 * Maps DuckDB schema types to ColumnType enum
 *
 * @param duckdbType - DuckDB column type string
 * @returns Corresponding ColumnType enum value
 *
 * @example
 * ```typescript
 * const colType = mapDuckDBTypeToColumnType("VARCHAR"); // ColumnType.Text
 * const numType = mapDuckDBTypeToColumnType("DOUBLE");  // ColumnType.Number
 * ```
 */
export function mapDuckDBTypeToColumnType(duckdbType: string): ColumnType {
  const type = duckdbType.toLowerCase();

  if (
    type.includes("int") ||
    type.includes("float") ||
    type.includes("double")
  ) {
    return ColumnType.Number;
  } else if (type.includes("bool")) {
    return ColumnType.Boolean;
  } else if (type.includes("date") || type.includes("time")) {
    return ColumnType.Date;
  } else if (type.includes("json") || type.includes("object")) {
    return ColumnType.Object;
  } else if (type.includes("array") || type.includes("list")) {
    return ColumnType.Array;
  } else {
    return ColumnType.Text;
  }
}

/**
 * Creates a streaming view for direct parquet access
 *
 * @param duckDB - DuckDB store instance
 * @param datasetId - HuggingFace dataset identifier
 * @param parquetUrl - Direct URL to parquet file
 * @param options - Import options
 * @returns Promise resolving to import result
 *
 * @example
 * ```typescript
 * const result = await createStreamingView(
 *   duckDBStore,
 *   "microsoft/DialoGPT-medium",
 *   "https://..../train.parquet",
 *   { split: "train" }
 * );
 * ```
 */
export async function createStreamingView(
  duckDB: ReturnType<typeof useDuckDBStore>,
  datasetId: string,
  parquetUrl: string,
  options: HFImportOptions & {
    split?: string;
    datasetInfo?: any;
    formats?: AvailableFormat[];
  }
): Promise<HFImportResult> {
  const [, dataset] = datasetId.split("/");
  const split = options.split || "train";

  // Create table name
  const cleanDatasetName = dataset.replace(/[^a-zA-Z0-9_-]/g, "_");
  const tableName = `${cleanDatasetName}_${split}`;
  const escapedTableName = `"${tableName}"`;

  console.log(`[ImportStrategy] Creating streaming view: ${tableName}`);

  // Test if DuckDB can read the parquet file directly
  const testQuery = `SELECT COUNT(*) as count FROM '${parquetUrl}' LIMIT 1`;

  try {
    const testResult = await duckDB.executeQuery(testQuery);
    if (!testResult) {
      throw new Error("Failed to test parquet file access");
    }
    console.log(`[ImportStrategy] Direct parquet access confirmed`);
  } catch (testError) {
    console.warn(`[ImportStrategy] Direct parquet access failed:`, testError);
    throw new Error("Direct streaming not supported for this dataset");
  }

  // Drop any existing table/view with same name
  await duckDB.executeQuery(`DROP VIEW IF EXISTS ${escapedTableName}`);
  await duckDB.executeQuery(`DROP TABLE IF EXISTS ${escapedTableName}`);

  // Create streaming view
  const createViewQuery = `CREATE VIEW ${escapedTableName} AS SELECT * FROM '${parquetUrl}'`;
  await duckDB.executeQuery(createViewQuery);

  // Get schema information
  const schemaResult = await duckDB.executeQuery(
    `PRAGMA table_info(${escapedTableName})`
  );

  if (!schemaResult) {
    throw new Error("Failed to get table schema");
  }

  // Get sample data for preview
  const sampleResult = await duckDB.executeQuery(
    `SELECT * FROM ${escapedTableName} LIMIT 100`
  );

  if (!sampleResult) {
    throw new Error("Failed to get data sample");
  }

  // Convert to expected format
  const headers = schemaResult.toArray().map((col: any) => col.name);
  const sampleData = [
    headers,
    ...sampleResult.toArray().map((row: any) =>
      headers.map((col: string) => {
        const value = row[col];
        return value !== null && value !== undefined ? String(value) : "";
      })
    ),
  ];

  // Map column types
  const columnTypes = schemaResult
    .toArray()
    .map((col: any) => mapDuckDBTypeToColumnType(col.type));

  // Try to get row count (with timeout for large datasets)
  let actualRowCount = 0;
  try {
    const countQuery = `SELECT COUNT(*) as count FROM ${escapedTableName}`;
    const countPromise = duckDB.executeQuery(countQuery);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Count timeout")), 30000)
    );

    const countResult = await Promise.race([countPromise, timeoutPromise]);
    if (countResult) {
      actualRowCount = countResult.toArray()[0].count;
    }
  } catch (countErr) {
    console.warn(`[ImportStrategy] Could not get exact row count:`, countErr);
  }

  await duckDB.registerTableManually(tableName, escapedTableName, {
    isLoading: false,
    // processingStatus: `TXT converted: ${(fileSizeMB || fileSize).toFixed(
    //   2
    // )}MB table with ${count} rows (single-column)`,
    processingProgress: 1.0,
  });

  await duckDB.refreshSchemaCache();

  const result: HFImportResult = {
    data: sampleData,
    columnTypes,
    fileName: `${tableName}.parquet`,
    rowCount: actualRowCount,
    columnCount: headers.length,
    sourceType: DataSourceType.PARQUET,
    loadedToDuckDB: true,
    tableName: tableName,
    huggingface: {
      datasetId,
      config: options.config || "default",
      split,
      parquetUrl,
      method: "direct",
      metadata: options.datasetInfo,
      availableFormats: options.formats,
    },
  };

  console.log(`[ImportStrategy] ✅ Streaming view created: ${tableName}`);
  return result;
}

/**
 * Downloads and imports dataset using alternative format
 *
 * @param duckDB - DuckDB store instance
 * @param format - Available format information
 * @param datasetId - Dataset identifier
 * @param options - Import options
 * @returns Promise resolving to import result
 */
export async function importAlternativeFormat(
  duckDB: ReturnType<typeof useDuckDBStore>,
  format: AvailableFormat,
  datasetId: string,
  options: HFImportOptions = {}
): Promise<HFImportResult> {
  console.log(`[ImportStrategy] Importing ${format.type.toUpperCase()} format`);

  const { blob, method, fileSize } = await fetchWithCORSFallback(
    format.url,
    `dataset.${format.type}`
  );

  // Create file for DuckDB import
  const file = new File(
    [blob],
    `${datasetId.replace("/", "_")}.${format.type}`,
    {
      type:
        format.type === "csv"
          ? "text/csv"
          : format.type === "json"
          ? "application/json"
          : "application/octet-stream",
    }
  );

  // Use DuckDB's direct import
  const importResult = await duckDB.importFileDirectly(file);

  // Get schema and sample data
  const schemaResult = await duckDB.executeQuery(
    `PRAGMA table_info("${importResult.tableName}")`
  );

  if (!schemaResult) {
    throw new Error("Failed to get table schema");
  }

  const sampleResult = await duckDB.executeQuery(
    `SELECT * FROM "${importResult.tableName}" LIMIT 1000`
  );

  if (!sampleResult) {
    throw new Error("Failed to get data sample");
  }

  // Convert to expected format
  const headers = schemaResult.toArray().map((col: any) => col.name);
  const sampleData = [
    headers,
    ...sampleResult.toArray().map((row: any) =>
      headers.map((col: string) => {
        const value = row[col];
        return value !== null && value !== undefined ? String(value) : "";
      })
    ),
  ];

  // Map column types
  const columnTypes = schemaResult
    .toArray()
    .map((col: any) => mapDuckDBTypeToColumnType(col.type));

  const sourceType = getDataSourceTypeFromExtension(format.type);

  return {
    data: sampleData,
    columnTypes,
    fileName: `${datasetId.replace("/", "_")}.${format.type}`,
    rowCount: importResult.rowCount,
    columnCount: headers.length,
    sourceType,
    loadedToDuckDB: true,
    tableName: importResult.tableName,
    huggingface: {
      datasetId,
      parquetUrl: format.url,
      fileSize,
      method,
    },
  };
}

/**
 * Standard parquet download and import strategy
 *
 * @param duckDB - DuckDB store instance
 * @param datasetId - Dataset identifier
 * @param options - Import options
 * @returns Promise resolving to import result
 */
export async function importParquetDownload(
  duckDB: ReturnType<typeof useDuckDBStore>,
  datasetId: string,
  options: HFImportOptions = {}
): Promise<HFImportResult> {
  console.log(`[ImportStrategy] Standard parquet download for ${datasetId}`);

  // Get dataset metadata
  const datasetInfo = await getDatasetInfo(datasetId, options.authToken);

  // Get parquet files
  const config = options.config || "default";
  const parquetInfo = await getParquetFiles(
    datasetId,
    config,
    options.authToken
  );

  if (!parquetInfo.parquet_files || parquetInfo.parquet_files.length === 0) {
    throw new Error(
      "No parquet files available for this dataset configuration."
    );
  }

  // Use first parquet file
  const firstParquetFile = parquetInfo.parquet_files[0];
  const parquetUrl = firstParquetFile.url;
  const split = firstParquetFile.split || "train";

  // Download file
  const [, dataset] = datasetId.split("/");
  const fileName = `${dataset}_${split}.parquet`;
  const { blob, method, fileSize } = await fetchWithCORSFallback(
    parquetUrl,
    fileName
  );

  // Create file and import
  const cleanDatasetName = dataset.replace(/[^a-zA-Z0-9_-]/g, "_");
  const finalFileName = `${cleanDatasetName}_${split}.parquet`;

  const file = new File([blob], finalFileName, {
    type: "application/octet-stream",
  });

  const importResult = await duckDB.importFileDirectly(file);

  // Get schema and sample data (same as alternative format)
  const schemaResult = await duckDB.executeQuery(
    `PRAGMA table_info("${importResult.tableName}")`
  );

  if (!schemaResult) {
    throw new Error("Failed to get table schema");
  }

  const sampleResult = await duckDB.executeQuery(
    `SELECT * FROM "${importResult.tableName}" LIMIT 1000`
  );

  if (!sampleResult) {
    throw new Error("Failed to get data sample");
  }

  const headers = schemaResult.toArray().map((col: any) => col.name);
  const sampleData = [
    headers,
    ...sampleResult.toArray().map((row: any) =>
      headers.map((col: string) => {
        const value = row[col];
        return value !== null && value !== undefined ? String(value) : "";
      })
    ),
  ];

  const columnTypes = schemaResult
    .toArray()
    .map((col: any) => mapDuckDBTypeToColumnType(col.type));

  return {
    data: sampleData,
    columnTypes,
    fileName: finalFileName,
    rowCount: importResult.rowCount,
    columnCount: headers.length,
    sourceType: DataSourceType.PARQUET,
    loadedToDuckDB: true,
    tableName: importResult.tableName,
    huggingface: {
      datasetId,
      config,
      split,
      parquetUrl,
      fileSize,
      method,
      metadata: datasetInfo,
    },
  };
}

/**
 * Creates progressive fallback strategies for dataset import
 *
 * @param duckDB - DuckDB store instance
 * @param datasetId - Dataset identifier
 * @param options - Import options
 * @returns Array of import strategies in priority order
 *
 * @example
 * ```typescript
 * const strategies = createImportStrategies(duckDB, "microsoft/DialoGPT-medium");
 * for (const strategy of strategies) {
 *   try {
 *     const result = await strategy.fn();
 *     console.log(`Success with ${strategy.name}`);
 *     return result;
 *   } catch (error) {
 *     console.warn(`${strategy.name} failed:`, error);
 *   }
 * }
 * ```
 */
export async function createImportStrategies(
  duckDB: ReturnType<typeof useDuckDBStore>,
  datasetId: string,
  options: HFImportOptions = {}
): Promise<ImportStrategy[]> {
  // Get available formats first
  const { formats } = await detectAvailableFormats(
    datasetId,
    options.authToken
  );
  const datasetInfo = await getDatasetInfo(datasetId, options.authToken);

  const strategies: ImportStrategy[] = [];

  // Strategy 1: Direct Streaming (fastest, if parquet available)
  const parquetFormat = formats.find((f) => f.type === "parquet");
  if (parquetFormat) {
    strategies.push({
      name: "Direct Streaming",
      fn: () =>
        createStreamingView(duckDB, datasetId, parquetFormat.url, {
          ...options,
          split: parquetFormat.split,
          datasetInfo,
          formats,
        }),
    });
  }

  // Strategy 2: Parquet Download (reliable)
  if (parquetFormat) {
    strategies.push({
      name: "Parquet Download",
      fn: () => importParquetDownload(duckDB, datasetId, options),
    });
  }

  // Strategy 3: Alternative Formats (CSV, JSON fallback)
  const csvFormat = formats.find((f) => f.type === "csv");
  if (csvFormat) {
    strategies.push({
      name: "CSV Alternative Format",
      fn: () => importAlternativeFormat(duckDB, csvFormat, datasetId, options),
    });
  }

  const jsonFormat = formats.find((f) => f.type === "json");
  if (jsonFormat) {
    strategies.push({
      name: "JSON Alternative Format",
      fn: () => importAlternativeFormat(duckDB, jsonFormat, datasetId, options),
    });
  }

  // If no strategies available, throw error
  if (strategies.length === 0) {
    throw new Error("No suitable import strategies available for this dataset");
  }

  return strategies;
}

/**
 * Executes import strategies with progressive fallback
 *
 * @param strategies - Array of import strategies to try
 * @param onStrategyStart - Callback when a strategy starts
 * @param onStrategyFail - Callback when a strategy fails
 * @returns Promise resolving to successful import result
 * @throws {Error} When all strategies fail
 *
 * @example
 * ```typescript
 * const strategies = await createImportStrategies(duckDB, "dataset/name");
 * const result = await executeStrategiesWithFallback(
 *   strategies,
 *   (name) => console.log(`Trying ${name}...`),
 *   (name, error) => console.warn(`${name} failed:`, error)
 * );
 * ```
 */
export async function executeStrategiesWithFallback(
  strategies: ImportStrategy[],
  onStrategyStart?: (strategyName: string) => void,
  onStrategyFail?: (strategyName: string, error: Error) => void
): Promise<HFImportResult> {
  let lastError: Error | null = null;

  for (let i = 0; i < strategies.length; i++) {
    const strategy = strategies[i];

    try {
      onStrategyStart?.(strategy.name);
      console.log(
        `[ImportStrategy] Attempting strategy ${i + 1}/${strategies.length}: ${
          strategy.name
        }`
      );

      const result = await strategy.fn();
      console.log(`[ImportStrategy] ✅ Success with ${strategy.name}`);
      return result;
    } catch (error) {
      lastError = error as Error;
      console.warn(
        `[ImportStrategy] Strategy ${i + 1} (${strategy.name}) failed:`,
        error
      );

      onStrategyFail?.(strategy.name, lastError);

      // Don't retry on auth errors
      if (
        error instanceof Error &&
        (error.message.includes("Authentication") ||
          error.message.includes("Access denied"))
      ) {
        throw error;
      }

      // Brief pause between strategies
      if (i < strategies.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }

  throw lastError || new Error("All import strategies failed");
}

/**
 * Validates dataset compatibility with available import strategies
 *
 * @param datasetId - Dataset identifier to validate
 * @param authToken - Optional authentication token
 * @returns Promise resolving to compatibility information
 *
 * @example
 * ```typescript
 * const compat = await validateDatasetCompatibility("microsoft/DialoGPT-medium");
 * if (compat.isCompatible) {
 *   console.log(`Dataset supports: ${compat.supportedFormats.join(", ")}`);
 * } else {
 *   console.error("Dataset not compatible:", compat.reason);
 * }
 * ```
 */
export async function validateDatasetCompatibility(
  datasetId: string,
  authToken?: string
): Promise<{
  isCompatible: boolean;
  supportedFormats: string[];
  recommendedStrategy: string;
  reason?: string;
  estimatedSize?: number;
}> {
  try {
    // Check if dataset exists and is accessible
    await getDatasetInfo(datasetId, authToken);

    // Detect available formats
    const { formats, recommendedFormat } = await detectAvailableFormats(
      datasetId,
      authToken
    );

    if (formats.length === 0) {
      return {
        isCompatible: false,
        supportedFormats: [],
        recommendedStrategy: "none",
        reason: "No supported file formats found in dataset",
      };
    }

    // Determine recommended strategy
    let recommendedStrategy = "Alternative Format";
    if (formats.find((f) => f.type === "parquet")) {
      recommendedStrategy = "Direct Streaming";
    }

    // Estimate total size
    const estimatedSize = formats.reduce(
      (total, format) => total + (format.size || 0),
      0
    );

    return {
      isCompatible: true,
      supportedFormats: formats.map((f) => f.type),
      recommendedStrategy,
      estimatedSize,
    };
  } catch (error) {
    return {
      isCompatible: false,
      supportedFormats: [],
      recommendedStrategy: "none",
      reason: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
