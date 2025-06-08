import { ColumnType } from "@/types/csv";
import { DataSourceType } from "@/types/json";

/**
 * Maps file format extensions to DataSourceType enums
 * 
 * @param format - File format string
 * @returns Corresponding DataSourceType
 * 
 * @example
 * ```typescript
 * const sourceType = getDataSourceTypeFromExtension("parquet");
 * // Returns: DataSourceType.PARQUET
 * ```
 */
export function getDataSourceTypeFromExtension(format?: string): DataSourceType {
  switch (format?.toLowerCase()) {
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
 * Converts DuckDB column type strings to ColumnType enums
 * 
 * @param duckdbType - DuckDB column type string
 * @returns Corresponding ColumnType enum
 * 
 * @example
 * ```typescript
 * const colType = mapDuckDBTypeToColumnType("DOUBLE");
 * // Returns: ColumnType.Number
 * ```
 */
export function mapDuckDBTypeToColumnType(duckdbType: string): ColumnType {
  const type = duckdbType.toLowerCase();
  
  if (type.includes("int") || type.includes("float") || type.includes("double")) {
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
 * Generates a safe table name from dataset information
 * 
 * @param datasetId - HuggingFace dataset ID
 * @param split - Dataset split name
 * @returns Safe table name for DuckDB
 * 
 * @example
 * ```typescript
 * const tableName = generateTableName("microsoft/DialoGPT-medium", "train");
 * // Returns: "DialoGPT_medium_train"
 * ```
 */
export function generateTableName(datasetId: string, split: string = "train"): string {
  // Extract dataset name from org/dataset format
  const datasetName = datasetId.split("/").pop() || "dataset";
  
  // Clean and combine
  const cleanDatasetName = datasetName.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${cleanDatasetName}_${split}`;
}

/**
 * Creates an escaped table name for DuckDB queries
 * 
 * @param tableName - Raw table name
 * @returns Properly escaped table name
 * 
 * @example
 * ```typescript
 * const escaped = escapeTableName("my-table");
 * // Returns: "\"my-table\""
 * ```
 */
export function escapeTableName(tableName: string): string {
  return `"${tableName}"`;
}

/**
 * Processes DuckDB query results into a preview format
 * 
 * @param schemaResult - Schema query result from PRAGMA table_info
 * @param sampleResult - Sample data query result
 * @param limit - Maximum number of preview rows
 * @returns Formatted data array with headers
 * 
 * @example
 * ```typescript
 * const preview = processQueryResults(schemaResult, sampleResult, 100);
 * // Returns: [["col1", "col2"], ["row1col1", "row1col2"], ...]
 * ```
 */
export function processQueryResults(
  schemaResult: any,
  sampleResult: any,
  limit: number = 1000
): string[][] {
  if (!schemaResult || !sampleResult) {
    throw new Error("Invalid query results");
  }

  // Extract headers from schema
  const headers = schemaResult.toArray().map((col: any) => col.name);
  
  // Convert sample data rows
  const dataRows = sampleResult.toArray().map((row: any) =>
    headers.map((col: string) => {
      const value = row[col];
      return value !== null && value !== undefined ? String(value) : "";
    })
  );

  return [headers, ...dataRows];
}

/**
 * Extracts column types from DuckDB schema result
 * 
 * @param schemaResult - Schema query result from PRAGMA table_info
 * @returns Array of ColumnType enums
 * 
 * @example
 * ```typescript
 * const columnTypes = extractColumnTypes(schemaResult);
 * // Returns: [ColumnType.Number, ColumnType.Text, ColumnType.Boolean]
 * ```
 */
export function extractColumnTypes(schemaResult: any): ColumnType[] {
  if (!schemaResult) {
    return [];
  }

  return schemaResult.toArray().map((col: any) => 
    mapDuckDBTypeToColumnType(col.type)
  );
}


/**
 * Tests if a DuckDB view/table is queryable
 * 
 * @param duckDB - DuckDB store instance
 * @param tableName - Table/view name to test
 * @returns Promise resolving to true if queryable
 * 
 * @example
 * ```typescript
 * const isQueryable = await testTableQueryable(duckDBStore, "my_dataset");
 * if (!isQueryable) {
 *   console.error("Table is not accessible");
 * }
 * ```
 */
export async function testTableQueryable(
  duckDB: any,
  tableName: string
): Promise<boolean> {
  try {
    const escapedTableName = escapeTableName(tableName);
    const testQuery = `SELECT 1 FROM ${escapedTableName} LIMIT 1`;
    const result = await duckDB.executeQuery(testQuery);
    return !!result;
  } catch (err) {
    console.warn(`[DuckDBUtils] Table ${tableName} not queryable:`, err);
    return false;
  }
}
