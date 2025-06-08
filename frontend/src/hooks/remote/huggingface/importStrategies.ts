import { useDuckDBStore } from "@/store/duckDBStore";

import { ColumnType } from "@/types/csv";
import { DataSourceType } from "@/types/json";
import {
  HFImportResult,
  HFImportOptions,
  ImportStrategy,
} from "./types";

import { getDatasetInfo, getParquetFiles, detectAvailableFormats } from "./api";
import { fetchWithCORSFallback } from "./network";

/**
 * Utility function to map file format to DataSourceType
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
 */
export async function createStreamingView(
  duckDB: ReturnType<typeof useDuckDBStore>,
  datasetId: string,
  parquetUrl: string,
  options: HFImportOptions & {
    split?: string;
    config?: string;
    datasetInfo?: any;
    formats?: any[];
  }
): Promise<HFImportResult> {
  const [, dataset] = datasetId.split("/");
  const split = options.split || "train";
  const config = options.config || "default";

  // Create table name
  const cleanDatasetName = dataset.replace(/[^a-zA-Z0-9_-]/g, "_");
  let tableName = cleanDatasetName;
  if (config && config !== "default") {
    tableName += `_${config}`;
  }
  if (split && split !== "train") {
    tableName += `_${split}`;
  }

  const escapedTableName = `"${tableName}"`;
  
  console.log(`[ImportStrategy] Creating streaming view: ${escapedTableName}`);

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
      config: config,
      split,
      parquetUrl,
      method: "streaming",
      metadata: options.datasetInfo,
      availableFormats: options.formats,
    },
  };

  console.log(`[ImportStrategy] ✅ Streaming view created: ${tableName}`);
  return result;
}

/**
 * Downloads and imports dataset using alternative format
 */
export async function importAlternativeFormat(
  duckDB: ReturnType<typeof useDuckDBStore>,
  format: {
    type: "parquet" | "csv" | "json";
    url: string;
    split: string;
    config: string;
    size?: number;
    filename?: string;
  },
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
      config: format.config,
      split: format.split,
      parquetUrl: format.url,
      fileSize,
      method,
    },
  };
}

/**
 * Standard parquet download and import strategy
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

  // Filter by split if specified
  let targetFiles = parquetInfo.parquet_files;
  if (options.split) {
    targetFiles = parquetInfo.parquet_files.filter(f => f.split === options.split);
    if (targetFiles.length === 0) {
      throw new Error(`No parquet files found for split: ${options.split}`);
    }
  }

  // Use first parquet file
  const firstParquetFile = targetFiles[0];
  const parquetUrl = firstParquetFile.url;
  const split = firstParquetFile.split || "train";

  // Download file
  const [, dataset] = datasetId.split("/");
  const fileName = `${dataset}_${config}_${split}.parquet`;
  const { blob, method, fileSize } = await fetchWithCORSFallback(
    parquetUrl,
    fileName
  );

  // Create file and import
  const cleanDatasetName = dataset.replace(/[^a-zA-Z0-9_-]/g, "_");
  let finalFileName = cleanDatasetName;
  if (config && config !== "default") {
    finalFileName += `_${config}`;
  }
  if (split && split !== "train") {
    finalFileName += `_${split}`;
  }
  finalFileName += ".parquet";


  const file = new File([blob], finalFileName, {
    type: "application/octet-stream",
  });

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

  // Filter formats by config/split if specified
  let targetFormats = formats;
  if (options.config || options.split) {
    targetFormats = formats.filter(f => {
      const configMatch = !options.config || f.config === options.config;
      const splitMatch = !options.split || f.split === options.split;
      return configMatch && splitMatch;
    });
  }

  // Strategy 1: Direct Streaming (fastest, if parquet available)
  const parquetFormat = targetFormats.find((f) => f.type === "parquet");
  if (parquetFormat) {
    strategies.push({
      name: "Direct Streaming",
      description: "Direct streaming from parquet",
      execute: () =>
        createStreamingView(duckDB, datasetId, parquetFormat.url, {
          ...options,
          config: parquetFormat.config,
          split: parquetFormat.split,
          datasetInfo,
          formats,
        }),
      requiresAuth: false,
      supportedFormats: ["parquet"],
    });
  }

  // Strategy 2: Parquet Download (reliable)
  if (parquetFormat) {
    strategies.push({
      name: "Parquet Download",
      description: "Download and import parquet",
      execute: () => importParquetDownload(duckDB, datasetId, options),
      requiresAuth: false,
      supportedFormats: ["parquet"],
    });
  }

  // Strategy 3: Alternative Formats (CSV, JSON fallback)
  const csvFormat = targetFormats.find((f) => f.type === "csv");
  if (csvFormat) {
    strategies.push({
      name: "CSV Alternative Format",
      description: "Download and import CSV",
      execute: () => importAlternativeFormat(duckDB, csvFormat, datasetId, options),
      requiresAuth: false,
      supportedFormats: ["csv"],
    });
  }

  const jsonFormat = targetFormats.find((f) => f.type === "json");
  if (jsonFormat) {
    strategies.push({
      name: "JSON Alternative Format",
      description: "Download and import JSON",
      execute: () => importAlternativeFormat(duckDB, jsonFormat, datasetId, options),
      requiresAuth: false,
      supportedFormats: ["json"],
    });
  }

  // If no strategies available, throw error
  if (strategies.length === 0) {
    const configInfo = options.config ? ` (config: ${options.config})` : "";
    const splitInfo = options.split ? ` (split: ${options.split})` : "";
    throw new Error(`No suitable import strategies available for ${datasetId}${configInfo}${splitInfo}`);
  }

  return strategies;
}

/**
 * Executes import strategies with progressive fallback
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

      const result = await strategy.execute();
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