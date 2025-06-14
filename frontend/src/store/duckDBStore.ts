import { create } from "zustand";
import * as duckdb from "@duckdb/duckdb-wasm";

import { cleanup, initializeDuckDB } from "@/lib/duckdb/init";
import { isDevelopment } from "@/lib/duckdb/config";

import { executePaginatedQuery } from "@/lib/duckdb/query";

import {
  discoverAllTables,
  getTableSchema,
  detectTableModifyingSQL,
  getObjectType,
} from "@/lib/duckdb/ingestion/tables";
import { analyzeTxtFile } from "@/lib/duckdb/ingestion/analyzeTextFile";
import {
  createCsvViewWithFallback,
  importCsvWithFallback,
} from "@/lib/duckdb/ingestion/csv/utils";

import { PaginatedQueryResult } from "@/lib/duckdb/types";
import { ColumnType } from "@/types/csv";

import { SAMPLE_EMPLOYEES_DATA } from "./constants";
import {
  createJsonViewWithFallback,
  importJsonWithFallback,
} from "@/lib/duckdb/ingestion/json/utils";
import {
  addLimitIfMissing,
  hasLimitClause,
} from "@/lib/duckdb/query/pagination";

interface DuckDBState {
  // DB state
  db: duckdb.AsyncDuckDB | null;
  connection: duckdb.AsyncDuckDBConnection | null;
  isInitializing: boolean;
  isInitialized: boolean;
  error: string | null;

  // Table registry - maps raw names to escaped names
  registeredTables: Map<string, string>;

  // Sample table state
  hasSampleTable: boolean;
  sampleTableName: string;

  // Progress tracking
  isLoading: boolean;
  processingProgress: number;
  processingStatus: string;

  // Schema cache for performance
  schemaCache: Map<string, { name: string; type: string }[]>;
  lastSchemaCacheUpdate: number;

  // Auto-detection
  lastTableRefresh: number;

  // MotherDuck state
  motherDuckClient: unknown | null;
  motherDuckConnected: boolean;
  motherDuckConnecting: boolean;
  motherDuckError: string | null;
  motherDuckDatabases: Array<{ name: string; shared: boolean }>;
  selectedMotherDuckDatabase: string | null;
  motherDuckSchemas: Map<string, { name: string; type: string }[]>;

  // Actions
  initialize: () => Promise<boolean>;
  createSampleTable: () => Promise<void>;
  createTable: (
    tableName: string,
    headers: string[],
    columnTypes: ColumnType[]
  ) => Promise<string>;
  insertData: (
    tableName: string,
    data: string[][],
    onProgress?: (progress: number) => void
  ) => Promise<boolean>;
  loadData: (
    data: string[][],
    headers: string[],
    fileName: string,
    columnTypes: ColumnType[],
    onProgress?: (progress: number) => void
  ) => Promise<string>;
  executeQuery: (sql: string) => Promise<duckdb.ResultStreamBatch | null>;
  getAvailableTables: () => string[];
  getTableSchema: (
    tableName: string
  ) => Promise<{ name: string; type: string }[] | null>;
  getObjectType: (objectName: string) => Promise<"table" | "view" | null>;
  refreshSchemaCache: () => Promise<void>;
  resetError: () => void;
  cleanupDB: () => Promise<void>;
  importFileDirectlyStreaming: (
    fileHandle: FileSystemFileHandle,
    fileName: string,
    fileSize: number
  ) => Promise<{
    tableName: string;
    rowCount: number | boolean;
    convertedToCsv?: boolean;
  }>;
  importFileDirectly: (
    file: File
  ) => Promise<{ tableName: string; rowCount: number }>;
  executePaginatedQuery: (
    sql: string,
    page: number,
    pageSize: number
  ) => Promise<PaginatedQueryResult | null>;
  executeChartQuery: (
    tableName: string,
    dimension: string,
    measure: string,
    aggregation?: "sum" | "avg" | "min" | "max" | "count",
    limit?: number,
    filters?: { field: string; operator: string; value: string }[]
  ) => Promise<any[]>;
  refreshAllTables: () => Promise<void>;
  autoDetectTableChanges: (executedSQL: string) => Promise<void>;

  connectToMotherDuck: (token: string) => Promise<void>;
  disconnectFromMotherDuck: () => Promise<void>;
  executeMotherDuckQuery: (sql: string, databaseName?: string) => Promise<any>;
  refreshMotherDuckSchemas: (databaseName: string) => Promise<void>;
  getAllAvailableTables: () => Array<{
    name: string;
    source: "local" | "motherduck";
    database?: string;
  }>;
  extractTableReferences: (
    sql: string
  ) => Array<{ name: string; database?: string }>;
  isMotherDuckQuery: (sql: string) => {
    isMotherDuck: boolean;
    targetDatabase?: string;
    localTables: string[];
    motherDuckTables: Array<{ name: string; database: string }>;
    isHybrid: boolean;
  };
}

export const useDuckDBStore = create<DuckDBState>((set, get) => ({
  // Initial state
  db: null,
  connection: null,
  isInitializing: false,
  isInitialized: false,
  error: null,
  registeredTables: new Map(),
  hasSampleTable: false,
  sampleTableName: "employees_sample",
  isLoading: false,
  processingProgress: 0,
  processingStatus: "",
  schemaCache: new Map(),
  lastSchemaCacheUpdate: 0,
  lastTableRefresh: 0,
  motherDuckClient: null,
  motherDuckConnected: false,
  motherDuckConnecting: false,
  motherDuckError: null,
  motherDuckDatabases: [],
  selectedMotherDuckDatabase: null,
  motherDuckSchemas: new Map(),

  // Initialize DuckDB and create sample table
  initialize: async () => {
    if (get().isInitialized || get().isInitializing) {
      return get().isInitialized;
    }

    set({ isInitializing: true, error: null });

    try {
      const { db, conn } = await initializeDuckDB();

      set({
        db,
        connection: conn,
        isInitialized: true,
        isInitializing: false,
      });

      console.log(
        `[DuckDBStore] DuckDB initialized successfully in ${
          isDevelopment ? "development" : "production"
        } mode`
      );

      // Create sample table immediately after initialization
      await get().createSampleTable();

      return true;
    } catch (err) {
      console.error("[DuckDBStore] Failed to initialize DuckDB:", err);
      set({
        error: `Failed to initialize DuckDB: ${
          err instanceof Error ? err.message : String(err)
        }`,
        isInitializing: false,
      });
      return false;
    }
  },

  // Create sample employees table
  createSampleTable: async () => {
    const { connection, isInitialized, sampleTableName } = get();

    if (!connection || !isInitialized) {
      throw new Error("DuckDB is not initialized");
    }

    try {
      console.log(`[DuckDBStore] Creating sample table: ${sampleTableName}`);

      // Create the sample table
      const escapedTableName = `"${sampleTableName}"`;
      const createTableSQL = `
        CREATE TABLE ${escapedTableName} (
          id INTEGER,
          name VARCHAR,
          department VARCHAR,
          salary INTEGER
        )
      `;

      await connection.query(createTableSQL);

      // Insert sample data
      const values = SAMPLE_EMPLOYEES_DATA.map(
        (row) => `(${row[0]}, '${row[1]}', '${row[2]}', ${row[3]})`
      ).join(", ");

      const insertSQL = `
        INSERT INTO ${escapedTableName} (id, name, department, salary)
        VALUES ${values}
      `;

      await connection.query(insertSQL);

      // Register the sample table
      const newTables = new Map(get().registeredTables);
      newTables.set(sampleTableName, escapedTableName);

      set({
        registeredTables: newTables,
        hasSampleTable: true,
      });

      console.log(
        `[DuckDBStore] Sample table '${sampleTableName}' created with ${SAMPLE_EMPLOYEES_DATA.length} rows`
      );

      // Refresh schema cache
      await get().refreshSchemaCache();
    } catch (err) {
      console.error(`[DuckDBStore] Failed to create sample table:`, err);
      throw err;
    }
  },

  // Refresh schema cache for all tables
  refreshSchemaCache: async () => {
    const { connection, registeredTables } = get();
    if (!connection) return;

    try {
      const newCache = new Map();

      // Create a snapshot of current tables to avoid race conditions
      const tablesToProcess = Array.from(registeredTables.entries());

      for (const [tableName, escapedName] of tablesToProcess) {
        try {
          const schemaQuery = `PRAGMA table_info(${escapedName})`;
          const result = await connection.query(schemaQuery);
          const schema = result.toArray().map((col) => ({
            name: col.name,
            type: col.type,
          }));
          newCache.set(tableName, schema);
        } catch (err) {
          console.warn(
            `[DuckDBStore] Failed to get schema for ${tableName}:`,
            err
          );
        }
      }

      // Only update state once with all the new schemas
      set((state) => ({
        schemaCache: new Map([...state.schemaCache, ...newCache]),
        lastSchemaCacheUpdate: Date.now(),
      }));

      console.log(
        `[DuckDBStore] Schema cache refreshed for ${newCache.size} tables`
      );
    } catch (err) {
      console.error(`[DuckDBStore] Failed to refresh schema cache:`, err);
    }
  },

  // Create a table with the given schema
  createTable: async (tableName, headers, columnTypes) => {
    const { connection, isInitialized } = get();

    if (!connection || !isInitialized) {
      await get().initialize();
      if (!get().connection) {
        throw new Error("DuckDB is not initialized");
      }
    }

    try {
      set({ isLoading: true, processingStatus: "Creating table structure..." });
      console.log(`[DuckDBStore] Creating table: ${tableName}`);
      console.log(`[DuckDBStore] Headers:`, headers);
      console.log(`[DuckDBStore] Column types:`, columnTypes);

      // Convert ColumnType to DuckDB type
      const duckDBTypeFromColumnType = (colType: ColumnType): string => {
        switch (colType) {
          case ColumnType.Number:
            return "DOUBLE";
          case ColumnType.Boolean:
            return "BOOLEAN";
          case ColumnType.Date:
            return "VARCHAR";
          case ColumnType.Array:
          case ColumnType.Object:
            return "TEXT";
          default:
            return "VARCHAR";
        }
      };

      // Generate column definitions with proper escaping
      const columnDefs = headers
        .map((header, index) => {
          const type =
            index < columnTypes.length
              ? duckDBTypeFromColumnType(columnTypes[index])
              : "VARCHAR";
          return `"${header.replace(/"/g, '""')}" ${type}`;
        })
        .join(", ");

      console.log(`[DuckDBStore] Column definitions:`, columnDefs);

      // Drop table if exists (with proper escaping)
      const escapedTableName = `"${tableName}"`;
      const dropQuery = `DROP TABLE IF EXISTS ${escapedTableName}`;
      console.log(`[DuckDBStore] Executing:`, dropQuery);
      await get().connection!.query(dropQuery);

      // Create the table (with proper escaping)
      const createQuery = `CREATE TABLE ${escapedTableName} (${columnDefs})`;
      console.log(`[DuckDBStore] Executing:`, createQuery);
      await get().connection!.query(createQuery);

      // Register the table with proper escaping
      const newTables = new Map(get().registeredTables);
      newTables.set(tableName, escapedTableName);
      set({ registeredTables: newTables });

      // Verify table creation
      const verifyQuery = `SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`;
      console.log(`[DuckDBStore] Verifying table creation:`, verifyQuery);
      const verifyResult = await get().connection!.query(verifyQuery);
      const tables = verifyResult.toArray();
      console.log(`[DuckDBStore] Verification result:`, tables);

      if (tables.length === 0) {
        throw new Error(`Table "${tableName}" was not created successfully`);
      }

      set({ isLoading: false });
      console.log(`[DuckDBStore] Table created successfully`);

      // Refresh schema cache
      await get().refreshSchemaCache();

      return escapedTableName;
    } catch (err) {
      console.error(`[DuckDBStore] Failed to create table:`, err);
      set({
        error: `Failed to create table: ${
          err instanceof Error ? err.message : String(err)
        }`,
        isLoading: false,
      });
      throw err;
    }
  },

  // Insert data into a table
  insertData: async (tableName, data, onProgress) => {
    const { connection, isInitialized, registeredTables } = get();

    if (!connection || !isInitialized) {
      throw new Error("DuckDB is not initialized");
    }

    // Get the properly escaped table name
    const escapedTableName =
      registeredTables.get(tableName) || `"${tableName}"`;

    try {
      console.log(`[DuckDBStore] Starting data insertion for ${tableName}`);
      console.log(`[DuckDBStore] Total rows to insert: ${data.length}`);

      set({
        isLoading: true,
        processingStatus: `Inserting data into ${tableName}...`,
      });

      // Get table schema
      const schemaQuery = `PRAGMA table_info(${escapedTableName})`;
      console.log(`[DuckDBStore] Getting schema:`, schemaQuery);
      const schema = await connection.query(schemaQuery);
      const columnNames = schema.toArray().map((col) => col.name);
      console.log(`[DuckDBStore] Column names:`, columnNames);

      // Process in smaller batches to prevent blocking
      const batchSize = 1000;
      const totalBatches = Math.ceil(data.length / batchSize);
      let totalInserted = 0;

      console.log(
        `[DuckDBStore] Processing ${totalBatches} batches of size ${batchSize}`
      );

      for (let i = 0; i < data.length; i += batchSize) {
        const currentBatch = Math.floor(i / batchSize) + 1;
        console.log(
          `[DuckDBStore] Processing batch ${currentBatch}/${totalBatches} (rows ${
            i + 1
          }-${Math.min(i + batchSize, data.length)})`
        );

        const batch = data.slice(i, i + batchSize);

        // Format values for SQL with proper escaping
        const values = batch
          .map((row, rowIndex) => {
            try {
              // Format each value based on the column
              const formattedValues = row.map((val, colIndex) => {
                if (val === null || val === undefined || val === "") {
                  return "NULL";
                }

                // Simple type handling without relying on schema type names
                // Check if it's a number
                const num = Number(val);
                if (!isNaN(num) && val.trim() !== "") {
                  return val; // Numeric value (no quotes)
                }

                // Check if it's a boolean
                const lowerVal = val.toLowerCase();
                if (lowerVal === "true" || lowerVal === "false") {
                  return lowerVal.toUpperCase();
                }

                // Default to string with proper escaping
                return `'${val.replace(/'/g, "''")}'`;
              });

              return `(${formattedValues.join(", ")})`;
            } catch (rowErr) {
              console.error(
                `[DuckDBStore] Error formatting row ${i + rowIndex}:`,
                rowErr
              );
              throw rowErr;
            }
          })
          .join(",\n");

        if (values.length > 0) {
          const columns = columnNames.map((c) => `"${c}"`).join(", ");
          const insertSQL = `INSERT INTO ${escapedTableName} (${columns}) VALUES ${values}`;

          try {
            // Execute the insert
            await connection.query(insertSQL);
            totalInserted += batch.length;

            // Log progress every 10 batches or on last batch
            if (currentBatch % 10 === 0 || currentBatch === totalBatches) {
              console.log(
                `[DuckDBStore] Successfully inserted ${totalInserted} rows (${(
                  (totalInserted / data.length) *
                  100
                ).toFixed(1)}%)`
              );
            }

            // Update progress
            if (onProgress) {
              const progress = Math.min((i + batch.length) / data.length, 1);
              onProgress(progress);
              set({ processingProgress: progress });
            }

            // Yield control to browser after each batch
            await new Promise((resolve) => {
              requestAnimationFrame(resolve);
            });
          } catch (insertErr) {
            console.error(
              `[DuckDBStore] Error inserting batch ${currentBatch}:`,
              insertErr
            );
            console.error(
              `[DuckDBStore] Failed SQL:`,
              insertSQL.substring(0, 500) + "..."
            );
            throw insertErr;
          }
        }
      }

      // Verify final row count
      try {
        const countQuery = `SELECT COUNT(*) as count FROM ${escapedTableName}`;
        console.log(`[DuckDBStore] Verifying final count:`, countQuery);
        const countResult = await connection.query(countQuery);
        const count = countResult.toArray()[0].count;
        console.log(
          `[DuckDBStore] Successfully inserted ${count} rows into ${tableName} (expected: ${data.length})`
        );

        if (count !== data.length) {
          console.warn(
            `[DuckDBStore] Row count mismatch! Expected: ${data.length}, Actual: ${count}`
          );
        }
      } catch (countErr) {
        console.warn(`[DuckDBStore] Failed to get final row count:`, countErr);
      }

      set({ isLoading: false, processingProgress: 0, processingStatus: "" });
      console.log(`[DuckDBStore] Data insertion completed`);

      // Refresh schema cache
      await get().refreshSchemaCache();

      return true;
    } catch (err) {
      console.error(`[DuckDBStore] Failed to insert data into DuckDB:`, err);
      set({
        error: `Failed to insert data: ${
          err instanceof Error ? err.message : String(err)
        }`,
        isLoading: false,
        processingProgress: 0,
        processingStatus: "",
      });
      throw err;
    }
  },

  // Load data from a file into DuckDB
  loadData: async (data, headers, fileName, columnTypes, onProgress) => {
    try {
      // Initialize DB if needed
      if (!get().isInitialized) {
        await get().initialize();
      }

      console.log(`[DuckDBStore] Starting loadData`);
      console.log(`[DuckDBStore] File: ${fileName}`);
      console.log(
        `[DuckDBStore] Data size: ${data.length} rows x ${headers.length} columns`
      );

      // Generate table name with proper escaping
      const rawTableName = fileName
        ? `${fileName.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_]/g, "_")}`
        : "imported_data";

      console.log(`[DuckDBStore] Generated table name: ${rawTableName}`);

      // Create table structure
      await get().createTable(rawTableName, headers, columnTypes);

      // Insert data
      await get().insertData(rawTableName, data, onProgress);

      console.log(`[DuckDBStore] Data loading completed successfully`);
      console.log(`[DuckDBStore] Table name for queries: "${rawTableName}"`);

      return rawTableName;
    } catch (err) {
      console.error(`[DuckDBStore] Failed to load data:`, err);
      throw err;
    }
  },

  registerTableManually: async (
    tableName: string,
    escapedTableName: string,
    options: any
  ) => {
    console.log(
      `[DuckDBStore] Manually registering: ${tableName} -> ${escapedTableName}`
    );

    const currentTables = new Map(get().registeredTables);
    currentTables.set(tableName, escapedTableName);

    set({
      registeredTables: currentTables,
      lastTableRefresh: Date.now(),
      ...options,
    });
  },

  executeQuery: async (sql) => {
    const { connection, isInitialized, registeredTables } = get();

    if (!connection || !isInitialized) {
      await get().initialize();
      if (!get().connection) {
        set({ error: "DuckDB is not initialized" });
        return null;
      }
    }

    try {
      console.log(`[DuckDBStore] Executing query:`, sql);
      set({ isLoading: true, error: null });

      // PRE-PROCESSING: Replace unquoted table names with quoted ones
      let processedSQL = sql;

      // Log available tables for debugging
      try {
        const tablesQuery = `SELECT name FROM sqlite_master WHERE type='table'`;
        const tablesResult = await get().connection!.query(tablesQuery);
        const tables = tablesResult.toArray();
        console.log(`[DuckDBStore] Available tables:`, tables);

        // Get all known table names
        const knownTableNames = Array.from(registeredTables.keys());

        // Replace unquoted table names with quoted versions
        for (const tableName of knownTableNames) {
          const tableNameRegex = new RegExp(
            `\\b${tableName}\\b(?=(?:[^"]*"[^"]*")*[^"]*$)`,
            "g"
          );
          const escapedName =
            registeredTables.get(tableName) || `"${tableName}"`;
          processedSQL = processedSQL.replace(tableNameRegex, escapedName);
        }

        if (processedSQL !== sql) {
          console.log(`[DuckDBStore] Processed SQL query:`, processedSQL);
        }
      } catch (tablesErr) {
        console.error(`[DuckDBStore] Could not list tables:`, tablesErr);
      }

      const result = await connection.query(processedSQL);
      set({ isLoading: false });
      console.log(`[DuckDBStore] Query executed successfully`);
      return result;
    } catch (err) {
      console.error(`[DuckDBStore] Query execution error:`, err);
      set({
        error: `Query execution error: ${
          err instanceof Error ? err.message : String(err)
        }`,
        isLoading: false,
      });
      return null;
    }
  },

  getAvailableTables: () => {
    return Array.from(get().registeredTables.keys());
  },

  getObjectType: async (
    objectName: string
  ): Promise<"table" | "view" | null> => {
    const { connection, isInitialized } = get();

    if (!connection || !isInitialized) {
      return null;
    }

    return await getObjectType(connection, objectName);
  },

  getTableSchema: async (tableName) => {
    const { connection, isInitialized, registeredTables, schemaCache } = get();

    if (!connection || !isInitialized) {
      return null;
    }

    // Check cache first
    if (schemaCache.has(tableName)) {
      return schemaCache.get(tableName)!;
    }

    try {
      const escapedTableName =
        registeredTables.get(tableName) || `"${tableName}"`;
      const schemaQuery = `PRAGMA table_info(${escapedTableName})`;
      const result = await connection.query(schemaQuery);
      const schema = result.toArray().map((col) => ({
        name: col.name,
        type: col.type,
      }));

      // Update cache using functional update to avoid race conditions
      set((state) => ({
        schemaCache: new Map(state.schemaCache).set(tableName, schema),
      }));

      return schema;
    } catch (err) {
      console.error(
        `[DuckDBStore] Failed to get schema for ${tableName}:`,
        err
      );
      return null;
    }
  },

  resetError: () => set({ error: null }),

  cleanupDB: async () => {
    const { db, connection } = get();

    if (connection) {
      await connection.close();
    }

    if (db) {
      await db.terminate();
    }

    cleanup();

    set({
      db: null,
      connection: null,
      isInitialized: false,
      registeredTables: new Map(),
      hasSampleTable: false,
      schemaCache: new Map(),
      lastSchemaCacheUpdate: 0,
    });
  },

  importFileDirectlyStreaming: async (
    fileHandle: FileSystemFileHandle,
    fileName: string,
    fileSize: number
  ) => {
    const { connection, isInitialized } = get();

    if (!connection || !isInitialized) {
      await get().initialize();
      if (!get().connection || !get().db) {
        throw new Error("DuckDB is not initialized");
      }
    }

    const fileExt = fileName.split(".").pop()?.toLowerCase();
    const fileSizeMB = fileSize / (1024 * 1024);

    try {
      set({
        isLoading: true,
        error: null,
        processingStatus: "Preparing to import file...",
        processingProgress: 0.1,
      });

      console.log(
        `[DuckDBStore] Hybrid import: ${fileName} (${fileSizeMB.toFixed(2)}MB)`
      );

      // Get the File object
      const file = await fileHandle.getFile();

      set({
        processingStatus: "Analyzing file for optimal import strategy...",
        processingProgress: 0.2,
      });

      // TXT files - analyze and convert to CSV
      if (fileExt === "txt") {
        set({ processingStatus: "Analyzing TXT file structure..." });

        const analysis = await analyzeTxtFile(file);
        console.log(`[DuckDBStore] TXT analysis:`, analysis);

        // If it's delimited (any delimiter), import directly
        if (analysis.format === "delimited_direct" && analysis.separator) {
          const delimiterName =
            {
              ",": "comma",
              "\t": "tab",
              "|": "pipe",
              ";": "semicolon",
              " ": "space",
            }[analysis.separator] || "custom";

          set({
            processingStatus: `TXT file is ${delimiterName}-delimited, importing directly...`,
          });

          const baseName = fileName.replace(/\.[^/.]+$/, "");
          const rawTableName = baseName.replace(/[^a-zA-Z0-9_]/g, "_");
          const escapedTableName = `"${rawTableName}"`;

          await get().connection!.query(
            `DROP VIEW IF EXISTS ${escapedTableName}`
          );
          await get().connection!.query(
            `DROP TABLE IF EXISTS ${escapedTableName}`
          );

          const conn = await get().db!.connect();

          try {
            const registeredFileName = `import_${Date.now()}.csv`; // Always register as .csv for DuckDB
            await get().db!.registerFileHandle(
              registeredFileName,
              file,
              duckdb.DuckDBDataProtocol.BROWSER_FILEREADER,
              false
            );

            set({
              processingStatus: `Creating table from ${delimiterName}-delimited TXT...`,
            });

            // Try multiple approaches with the detected delimiter
            let success = false;

            // Approach 1: Explicit delimiter with strict_mode=false
            try {
              const createTableQuery = `CREATE TABLE ${escapedTableName} AS SELECT * FROM read_csv('${registeredFileName}', 
                header=true, 
                delim='${analysis.separator}',
                quote='"',
                escape='"',
                strict_mode=false,
                auto_detect=true
              )`;

              console.log(
                `[DuckDBStore] Trying ${delimiterName}-delimited import:`,
                createTableQuery
              );
              await conn.query(createTableQuery);
              success = true;
            } catch (err1) {
              console.log(`[DuckDBStore] Strict approach failed:`, err1);

              // Approach 2: Very permissive
              try {
                await get().connection!.query(
                  `DROP TABLE IF EXISTS ${escapedTableName}`
                );
                const createTableQuery = `CREATE TABLE ${escapedTableName} AS SELECT * FROM read_csv('${registeredFileName}', 
                  header=true, 
                  delim='${analysis.separator}',
                  strict_mode=false,
                  ignore_errors=true,
                  auto_detect=true
                )`;

                console.log(
                  `[DuckDBStore] Trying permissive ${delimiterName}-delimited import:`,
                  createTableQuery
                );
                await conn.query(createTableQuery);
                success = true;
              } catch (err2) {
                console.log(`[DuckDBStore] Permissive approach failed:`, err2);

                // Approach 3: Force all varchar
                try {
                  await get().connection!.query(
                    `DROP TABLE IF EXISTS ${escapedTableName}`
                  );
                  const createTableQuery = `CREATE TABLE ${escapedTableName} AS SELECT * FROM read_csv('${registeredFileName}', 
                    header=true, 
                    delim='${analysis.separator}',
                    strict_mode=false,
                    ignore_errors=true,
                    all_varchar=true
                  )`;

                  console.log(
                    `[DuckDBStore] Trying varchar-only ${delimiterName}-delimited import:`,
                    createTableQuery
                  );
                  await conn.query(createTableQuery);
                  success = true;
                } catch (err3) {
                  console.log(`[DuckDBStore] All approaches failed:`, err3);
                  throw new Error(
                    `Failed to import ${delimiterName}-delimited TXT file: ${
                      err3 instanceof Error ? err3.message : String(err3)
                    }`
                  );
                }
              }
            }

            if (!success) {
              throw new Error(
                `Failed to import ${delimiterName}-delimited TXT file`
              );
            }

            await conn.close();

            // Count rows and get column info
            const countQuery = `SELECT COUNT(*) as count FROM ${escapedTableName}`;
            const countResult = await get().connection!.query(countQuery);
            const count = countResult.toArray()[0].count;

            const columnsQuery = `PRAGMA table_info(${escapedTableName})`;
            const columnsResult = await get().connection!.query(columnsQuery);
            const columns = columnsResult.toArray();

            console.log(
              `[DuckDBStore] Successfully imported ${count} rows with ${columns.length} columns from ${delimiterName}-delimited TXT:`,
              columns.map((c) => c.name)
            );

            const newTables = new Map(get().registeredTables);
            newTables.set(rawTableName, escapedTableName);

            set({
              registeredTables: newTables,
              isLoading: false,
              processingStatus: `TXT imported: ${(
                fileSizeMB || fileSize
              ).toFixed(2)}MB table with ${count} rows, ${
                columns.length
              } columns (${delimiterName}-delimited)`,
              processingProgress: 1.0,
            });

            await get().refreshSchemaCache();
            return {
              tableName: rawTableName,
              rowCount: count,
              columnCount: columns.length,
              isView: false,
              convertedToCsv: false,
              fileSizeMB: fileSizeMB || fileSize,
              instantImport: false,
              txtFormat: "delimited_direct",
              delimiter: analysis.separator,
              delimiterName: delimiterName,
            };
          } catch (err) {
            await conn.close();
            throw err;
          }
        }

        // For single-column format, do the conversion as before
        set({ processingStatus: "Converting single-column TXT to CSV..." });

        const text = await file.text();
        const lines = text.split("\n").filter((line) => line.trim() !== "");

        // Single column format - each line becomes a row
        const csvData =
          "line_content\n" +
          lines
            .map((line) => {
              const escaped = line.trim().replace(/"/g, '""');
              return escaped.includes(",") ? `"${escaped}"` : escaped;
            })
            .join("\n");

        const baseName = fileName.replace(/\.[^/.]+$/, "");
        const csvFile = new File([csvData], `${baseName}_converted.csv`, {
          type: "text/csv",
        });

        const rawTableName = baseName.replace(/[^a-zA-Z0-9_]/g, "_");
        const escapedTableName = `"${rawTableName}"`;

        await get().connection!.query(
          `DROP VIEW IF EXISTS ${escapedTableName}`
        );
        await get().connection!.query(
          `DROP TABLE IF EXISTS ${escapedTableName}`
        );

        const conn = await get().db!.connect();

        try {
          const registeredFileName = `import_${Date.now()}.csv`;
          await get().db!.registerFileHandle(
            registeredFileName,
            csvFile,
            duckdb.DuckDBDataProtocol.BROWSER_FILEREADER,
            false
          );

          set({ processingStatus: "Creating table from single-column TXT..." });
          const createTableQuery = `CREATE TABLE ${escapedTableName} AS SELECT * FROM read_csv('${registeredFileName}', header=true, auto_detect=true)`;
          await conn.query(createTableQuery);
          await conn.close();

          // Count rows
          const countQuery = `SELECT COUNT(*) as count FROM ${escapedTableName}`;
          const countResult = await get().connection!.query(countQuery);
          const count = countResult.toArray()[0].count;

          console.log(
            `[DuckDBStore] Successfully imported ${count} rows from single-column TXT conversion`
          );

          const newTables = new Map(get().registeredTables);
          newTables.set(rawTableName, escapedTableName);

          set({
            registeredTables: newTables,
            isLoading: false,
            processingStatus: `TXT converted: ${(
              fileSizeMB || fileSize
            ).toFixed(2)}MB table with ${count} rows (single-column)`,
            processingProgress: 1.0,
          });

          await get().refreshSchemaCache();
          return {
            tableName: rawTableName,
            rowCount: count,
            isView: false,
            convertedToCsv: true,
            fileSizeMB: fileSizeMB || fileSize,
            instantImport: false,
            txtFormat: "single_column",
          };
        } catch (err) {
          await conn.close();
          throw err;
        }
      }

      // Excel files - handle with size limits and convert to CSV
      if (fileExt === "xlsx" || fileExt === "xls") {
        const MAX_EXCEL_SIZE = 100;
        if (fileSizeMB > MAX_EXCEL_SIZE) {
          throw new Error(
            `Excel files over ${MAX_EXCEL_SIZE}MB are not supported due to browser memory limitations. ` +
              `Current file: ${fileSizeMB.toFixed(
                2
              )}MB. Please convert to CSV or Parquet format.`
          );
        }

        set({ processingStatus: "Converting Excel file to CSV..." });
        const XLSX = await import("xlsx");
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(new Uint8Array(arrayBuffer), {
          type: "array",
        });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const csvData = XLSX.utils.sheet_to_csv(worksheet);

        const baseName = fileName.replace(/\.[^/.]+$/, "");
        const csvFile = new File([csvData], `${baseName}_converted.csv`, {
          type: "text/csv",
        });

        const rawTableName = baseName.replace(/[^a-zA-Z0-9_]/g, "_");
        const escapedTableName = `"${rawTableName}"`;

        await get().connection!.query(
          `DROP VIEW IF EXISTS ${escapedTableName}`
        );
        await get().connection!.query(
          `DROP TABLE IF EXISTS ${escapedTableName}`
        );

        const conn = await get().db!.connect();

        try {
          const registeredFileName = `import_${Date.now()}.csv`;
          await get().db!.registerFileHandle(
            registeredFileName,
            csvFile,
            duckdb.DuckDBDataProtocol.BROWSER_FILEREADER,
            false
          );

          set({
            processingStatus: "Creating table from converted Excel data...",
          });
          const createTableQuery = `CREATE TABLE ${escapedTableName} AS SELECT * FROM read_csv('${registeredFileName}', strict_mode=false)`;
          await conn.query(createTableQuery);
          await conn.close();

          // Count rows for Excel tables
          const countQuery = `SELECT COUNT(*) as count FROM ${escapedTableName}`;
          const countResult = await get().connection!.query(countQuery);
          const count = countResult.toArray()[0].count;

          console.log(
            `[DuckDBStore] Successfully imported ${count} rows from Excel conversion`
          );

          const newTables = new Map(get().registeredTables);
          newTables.set(rawTableName, escapedTableName);

          set({
            registeredTables: newTables,
            isLoading: false,
            processingStatus: `Excel converted: ${fileSizeMB.toFixed(
              2
            )}MB table with ${count} rows`,
            processingProgress: 1.0,
          });

          await get().refreshSchemaCache();
          return {
            tableName: rawTableName,
            rowCount: count,
            isView: false,
            convertedToCsv: true,
            fileSizeMB: fileSizeMB,
            instantImport: false,
          };
        } catch (err) {
          await conn.close();
          throw err;
        }
      }

      // For all other file types - use HYBRID approach based on file size
      const rawTableName = fileName
        .replace(/\.[^/.]+$/, "")
        .replace(/[^a-zA-Z0-9_]/g, "_");
      const escapedTableName = `"${rawTableName}"`;

      // Clean up any existing table/view
      await get().connection!.query(`DROP VIEW IF EXISTS ${escapedTableName}`);
      await get().connection!.query(`DROP TABLE IF EXISTS ${escapedTableName}`);
      set({ processingProgress: 0.3 });

      const conn = await get().db!.connect();

      try {
        const registeredFileName = `hybrid_${Date.now()}.${fileExt}`;

        console.log(
          `[DuckDBStore] Registering file: ${registeredFileName} (${fileSizeMB.toFixed(
            2
          )}MB)`
        );

        // Register the file with DuckDB
        await get().db!.registerFileHandle(
          registeredFileName,
          file,
          duckdb.DuckDBDataProtocol.BROWSER_FILEREADER,
          true
        );

        set({ processingProgress: 0.5 });
        console.log(`[DuckDBStore] File registered successfully`);

        // HYBRID APPROACH: Table for ≤500MB, View for >500MB
        const useTableApproach = fileSizeMB <= 500;

        let createQuery = "";
        const queryType = useTableApproach ? "TABLE" : "VIEW";

        if (fileExt === "csv") {
          if (useTableApproach) {
            set({
              processingStatus: `Creating CSV table (${fileSizeMB.toFixed(
                2
              )}MB)...`,
            });
            console.log(`[DuckDBStore] Creating CSV TABLE for files ≤500MB`);

            await importCsvWithFallback(
              conn,
              escapedTableName,
              registeredFileName,
              true
            );
          } else {
            set({
              processingStatus: `Creating instant CSV view (${fileSizeMB.toFixed(
                2
              )}MB)...`,
            });
            console.log(`[DuckDBStore] Creating CSV VIEW for files >500MB`);

            await createCsvViewWithFallback(
              conn,
              escapedTableName,
              registeredFileName
            );
          }
        } else if (fileExt === "json") {
          if (useTableApproach) {
            set({
              processingStatus: `Creating JSON table (${fileSizeMB.toFixed(
                2
              )}MB)...`,
            });
            console.log(`[DuckDBStore] Creating JSON TABLE for files ≤500MB`);

            await importJsonWithFallback(
              conn,
              escapedTableName,
              registeredFileName,
              true
            );
          } else {
            set({
              processingStatus: `Creating instant JSON view (${fileSizeMB.toFixed(
                2
              )}MB)...`,
            });
            console.log(`[DuckDBStore] Creating JSON VIEW for files >500MB`);

            await createJsonViewWithFallback(
              conn,
              escapedTableName,
              registeredFileName
            );
          }
        } else if (fileExt === "parquet") {
          if (useTableApproach) {
            set({
              processingStatus: `Creating Parquet table (${fileSizeMB.toFixed(
                2
              )}MB)...`,
            });
            console.log(
              `[DuckDBStore] Creating Parquet TABLE for files ≤500MB`
            );
            createQuery = `CREATE TABLE ${escapedTableName} AS SELECT * FROM read_parquet('${registeredFileName}')`;
          } else {
            set({
              processingStatus: `Creating instant Parquet view (${fileSizeMB.toFixed(
                2
              )}MB)...`,
            });
            console.log(`[DuckDBStore] Creating Parquet VIEW for files >500MB`);
            createQuery = `CREATE VIEW ${escapedTableName} AS SELECT * FROM read_parquet('${registeredFileName}')`;
          }
        } else {
          throw new Error(`Unsupported file type: ${fileExt}`);
        }

        console.log(
          `[DuckDBStore] Executing ${queryType} creation (${
            useTableApproach ? "table" : "view"
          } approach)`
        );
        set({ processingProgress: 0.7 });

        // Execute the table/view creation
        await conn.query(createQuery);

        set({ processingProgress: 0.85 });
        await conn.close();

        // Handle row counting based on approach
        let rowCount = null;
        let statusMessage = "";

        if (useTableApproach) {
          set({ processingStatus: "Verifying table and counting rows..." });
          console.log(`[DuckDBStore] Counting rows for table approach`);

          try {
            const countQuery = `SELECT COUNT(*) as count FROM ${escapedTableName}`;
            const countResult = await get().connection!.query(countQuery);
            rowCount = countResult.toArray()[0].count;

            console.log(
              `[DuckDBStore] TABLE created with ${rowCount} rows: ${rawTableName} (${fileSizeMB.toFixed(
                2
              )}MB ${fileExt})`
            );
            statusMessage = `Table created: ${fileSizeMB.toFixed(
              2
            )}MB ${fileExt.toUpperCase()} with ${rowCount} rows`;
          } catch (countErr) {
            console.error(`[DuckDBStore] Error counting rows:`, countErr);
            throw new Error(
              "Error verifying table. The table may be empty or corrupted."
            );
          }
        } else {
          console.log(
            `[DuckDBStore] VIEW created instantly: ${rawTableName} (${fileSizeMB.toFixed(
              2
            )}MB ${fileExt})`
          );
          statusMessage = `View created: ${fileSizeMB.toFixed(
            2
          )}MB ${fileExt.toUpperCase()} file ready to query`;
        }

        set({ processingProgress: 0.95 });

        // Register the table/view in our store
        const newTables = new Map(get().registeredTables);
        newTables.set(rawTableName, escapedTableName);

        set({
          registeredTables: newTables,
          isLoading: false,
          processingStatus: statusMessage,
          processingProgress: 1.0,
        });

        await get().refreshSchemaCache();

        return {
          tableName: rawTableName,
          rowCount: rowCount,
          isView: !useTableApproach,
          fileSizeMB: fileSizeMB,
          fileType: fileExt,
          instantImport: !useTableApproach,
        };
      } catch (err) {
        if (conn) await conn.close();
        throw err;
      }
    } catch (err) {
      console.error(`[DuckDBStore] Hybrid import failed:`, err);

      let errorMessage = err instanceof Error ? err.message : String(err);

      // Enhanced error messages
      if (err instanceof Error) {
        const errMsg = err.message.toLowerCase();

        if (
          errMsg.includes("call stack") ||
          errMsg.includes("maximum call stack")
        ) {
          errorMessage =
            `File structure too complex for ${fileSizeMB.toFixed(2)}MB file. ` +
            `Try converting to Parquet format or simplifying the file structure.`;
        } else if (
          errMsg.includes("memory") ||
          errMsg.includes("out of bounds")
        ) {
          if (fileSizeMB <= 500) {
            errorMessage =
              `Memory limit exceeded with ${fileSizeMB.toFixed(
                2
              )}MB file during table creation. ` +
              `Try using a device with more RAM or the file may be too complex for table import.`;
          } else {
            errorMessage =
              `Memory limit exceeded with ${fileSizeMB.toFixed(2)}MB file. ` +
              `Try using a device with more RAM or converting to Parquet format.`;
          }
        } else if (errMsg.includes("worker") || errMsg.includes("terminate")) {
          errorMessage =
            `Browser crashed processing ${fileSizeMB.toFixed(2)}MB file. ` +
            `File may be corrupted or too complex for browser processing.`;
        } else if (
          errMsg.includes("unsupported") ||
          errMsg.includes("format")
        ) {
          errorMessage =
            `File format not supported or file may be corrupted. ` +
            `Supported formats: CSV, JSON, Parquet, Excel (.xlsx/.xls), TXT.`;
        }
      }

      set({
        error: `Import failed: ${errorMessage}`,
        isLoading: false,
        processingProgress: 0,
        processingStatus: "Import failed",
      });

      throw err;
    }
  },

  importFileDirectly: async (file: File) => {
    const { connection, isInitialized } = get();

    // Initialize if needed
    if (!connection || !isInitialized) {
      await get().initialize();
      if (!get().connection || !get().db) {
        throw new Error("DuckDB is not initialized");
      }
    }

    try {
      set({
        isLoading: true,
        error: null,
        processingStatus: "Preparing to import file...",
        processingProgress: 0.1,
      });

      // Get file extension and size
      const fileName = file.name;
      const fileExt = file.name.split(".").pop()?.toLowerCase();
      const fileSize = file.size / (1024 * 1024); // Size in MB
      console.log(
        `[DuckDBStore] Importing file: ${file.name} (${fileSize.toFixed(2)} MB)`
      );

      if (fileExt === "txt") {
        set({ processingStatus: "Analyzing TXT file structure..." });

        const analysis = await analyzeTxtFile(file);
        console.log(`[DuckDBStore] TXT analysis:`, analysis);

        // If it's delimited (any delimiter), import directly
        if (analysis.format === "delimited_direct" && analysis.separator) {
          const delimiterName =
            {
              ",": "comma",
              "\t": "tab",
              "|": "pipe",
              ";": "semicolon",
              " ": "space",
            }[analysis.separator] || "custom";

          set({
            processingStatus: `TXT file is ${delimiterName}-delimited, importing directly...`,
          });

          const baseName = fileName.replace(/\.[^/.]+$/, "");
          const rawTableName = baseName.replace(/[^a-zA-Z0-9_]/g, "_");
          const escapedTableName = `"${rawTableName}"`;

          await get().connection!.query(
            `DROP VIEW IF EXISTS ${escapedTableName}`
          );
          await get().connection!.query(
            `DROP TABLE IF EXISTS ${escapedTableName}`
          );

          const conn = await get().db!.connect();

          try {
            const registeredFileName = `import_${Date.now()}.csv`; // Always register as .csv for DuckDB
            await get().db!.registerFileHandle(
              registeredFileName,
              file,
              duckdb.DuckDBDataProtocol.BROWSER_FILEREADER,
              false
            );

            set({
              processingStatus: `Creating table from ${delimiterName}-delimited TXT...`,
            });

            // Try multiple approaches with the detected delimiter
            let success = false;

            // Approach 1: Explicit delimiter with strict_mode=false
            try {
              const createTableQuery = `CREATE TABLE ${escapedTableName} AS SELECT * FROM read_csv('${registeredFileName}', 
                header=true, 
                delim='${analysis.separator}',
                quote='"',
                escape='"',
                strict_mode=false,
                auto_detect=true
              )`;

              console.log(
                `[DuckDBStore] Trying ${delimiterName}-delimited import:`,
                createTableQuery
              );
              await conn.query(createTableQuery);
              success = true;
            } catch (err1) {
              console.log(`[DuckDBStore] Strict approach failed:`, err1);

              // Approach 2: Very permissive
              try {
                await get().connection!.query(
                  `DROP TABLE IF EXISTS ${escapedTableName}`
                );
                const createTableQuery = `CREATE TABLE ${escapedTableName} AS SELECT * FROM read_csv('${registeredFileName}', 
                  header=true, 
                  delim='${analysis.separator}',
                  strict_mode=false,
                  ignore_errors=true,
                  auto_detect=true
                )`;

                console.log(
                  `[DuckDBStore] Trying permissive ${delimiterName}-delimited import:`,
                  createTableQuery
                );
                await conn.query(createTableQuery);
                success = true;
              } catch (err2) {
                console.log(`[DuckDBStore] Permissive approach failed:`, err2);

                // Approach 3: Force all varchar
                try {
                  await get().connection!.query(
                    `DROP TABLE IF EXISTS ${escapedTableName}`
                  );
                  const createTableQuery = `CREATE TABLE ${escapedTableName} AS SELECT * FROM read_csv('${registeredFileName}', 
                    header=true, 
                    delim='${analysis.separator}',
                    strict_mode=false,
                    ignore_errors=true,
                    all_varchar=true
                  )`;

                  console.log(
                    `[DuckDBStore] Trying varchar-only ${delimiterName}-delimited import:`,
                    createTableQuery
                  );
                  await conn.query(createTableQuery);
                  success = true;
                } catch (err3) {
                  console.log(`[DuckDBStore] All approaches failed:`, err3);
                  throw new Error(
                    `Failed to import ${delimiterName}-delimited TXT file: ${
                      err3 instanceof Error ? err3.message : String(err3)
                    }`
                  );
                }
              }
            }

            if (!success) {
              throw new Error(
                `Failed to import ${delimiterName}-delimited TXT file`
              );
            }

            await conn.close();

            // Count rows and get column info
            const countQuery = `SELECT COUNT(*) as count FROM ${escapedTableName}`;
            const countResult = await get().connection!.query(countQuery);
            const count = countResult.toArray()[0].count;

            const columnsQuery = `PRAGMA table_info(${escapedTableName})`;
            const columnsResult = await get().connection!.query(columnsQuery);
            const columns = columnsResult.toArray();

            console.log(
              `[DuckDBStore] Successfully imported ${count} rows with ${columns.length} columns from ${delimiterName}-delimited TXT:`,
              columns.map((c) => c.name)
            );

            const newTables = new Map(get().registeredTables);
            newTables.set(rawTableName, escapedTableName);

            set({
              registeredTables: newTables,
              isLoading: false,
              processingStatus: `TXT imported: ${(fileSize || fileSize).toFixed(
                2
              )}MB table with ${count} rows, ${
                columns.length
              } columns (${delimiterName}-delimited)`,
              processingProgress: 1.0,
            });

            await get().refreshSchemaCache();
            return {
              tableName: rawTableName,
              rowCount: count,
              columnCount: columns.length,
              isView: false,
              convertedToCsv: false,
              fileSizeMB: fileSize,
              instantImport: false,
              txtFormat: "delimited_direct",
              delimiter: analysis.separator,
              delimiterName: delimiterName,
            };
          } catch (err) {
            await conn.close();
            throw err;
          }
        }

        // For single-column format, do the conversion as before
        set({ processingStatus: "Converting single-column TXT to CSV..." });

        const text = await file.text();
        const lines = text.split("\n").filter((line) => line.trim() !== "");

        // Single column format - each line becomes a row
        const csvData =
          "line_content\n" +
          lines
            .map((line) => {
              const escaped = line.trim().replace(/"/g, '""');
              return escaped.includes(",") ? `"${escaped}"` : escaped;
            })
            .join("\n");

        const baseName = fileName.replace(/\.[^/.]+$/, "");
        const csvFile = new File([csvData], `${baseName}_converted.csv`, {
          type: "text/csv",
        });

        const rawTableName = baseName.replace(/[^a-zA-Z0-9_]/g, "_");
        const escapedTableName = `"${rawTableName}"`;

        await get().connection!.query(
          `DROP VIEW IF EXISTS ${escapedTableName}`
        );
        await get().connection!.query(
          `DROP TABLE IF EXISTS ${escapedTableName}`
        );

        const conn = await get().db!.connect();

        try {
          const registeredFileName = `import_${Date.now()}.csv`;
          await get().db!.registerFileHandle(
            registeredFileName,
            csvFile,
            duckdb.DuckDBDataProtocol.BROWSER_FILEREADER,
            false
          );

          set({ processingStatus: "Creating table from single-column TXT..." });
          const createTableQuery = `CREATE TABLE ${escapedTableName} AS SELECT * FROM read_csv('${registeredFileName}', header=true, auto_detect=true)`;
          await conn.query(createTableQuery);
          await conn.close();

          // Count rows
          const countQuery = `SELECT COUNT(*) as count FROM ${escapedTableName}`;
          const countResult = await get().connection!.query(countQuery);
          const count = countResult.toArray()[0].count;

          console.log(
            `[DuckDBStore] Successfully imported ${count} rows from single-column TXT conversion`
          );

          const newTables = new Map(get().registeredTables);
          newTables.set(rawTableName, escapedTableName);

          set({
            registeredTables: newTables,
            isLoading: false,
            processingStatus: `TXT converted: ${fileSize.toFixed(
              2
            )}MB table with ${count} rows (single-column)`,
            processingProgress: 1.0,
          });

          await get().refreshSchemaCache();
          return {
            tableName: rawTableName,
            rowCount: count,
            isView: false,
            convertedToCsv: true,
            fileSizeMB: fileSize,
            instantImport: false,
            txtFormat: "single_column",
          };
        } catch (err) {
          await conn.close();
          throw err;
        }
      }

      // For Excel files larger than 2MB, use SheetJS conversion
      if (fileExt === "xlsx" || fileExt === "xls") {
        try {
          set({
            processingStatus: "Converting Excel file to CSV format...",
            processingProgress: 0.15,
          });

          // Dynamically import SheetJS to avoid loading it unless needed
          const XLSX = await import("xlsx");

          // Read the Excel file
          const arrayBuffer = await file.arrayBuffer();
          const data = new Uint8Array(arrayBuffer);

          set({ processingProgress: 0.3 });
          console.log(`[DuckDBStore] Parsing Excel file with SheetJS`);

          // Parse the workbook
          const workbook = XLSX.read(data, { type: "array" });

          // Get the first sheet
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];

          set({
            processingStatus: `Converting Excel sheet "${firstSheetName}" to CSV...`,
            processingProgress: 0.5,
          });

          // Convert to CSV
          const csvData = XLSX.utils.sheet_to_csv(worksheet);

          // Create a CSV File object
          const baseName = file.name.replace(/\.[^/.]+$/, "");
          const csvFileName = `${baseName}_converted.csv`;
          const csvBlob = new Blob([csvData], { type: "text/csv" });
          const csvFile = new File([csvBlob], csvFileName, {
            type: "text/csv",
          });

          set({
            processingStatus: "Importing converted CSV data...",
            processingProgress: 0.6,
          });

          // Now proceed with normal CSV import for the converted file
          // Generate a safe table name from the original file name
          const rawTableName = baseName.replace(/[^a-zA-Z0-9_]/g, "_");
          const escapedTableName = `"${rawTableName}"`;

          // Drop existing table if any
          const dropQuery = `DROP TABLE IF EXISTS ${escapedTableName}`;
          await get().connection!.query(dropQuery);

          // Create a temporary connection for this operation
          const conn = await get().db!.connect();

          try {
            // Register the CSV file with DuckDB
            const registeredFileName = `import_${Date.now()}.csv`;

            await get().db!.registerFileHandle(
              registeredFileName,
              csvFile,
              duckdb.DuckDBDataProtocol.BROWSER_FILEREADER,
              false
            );

            set({ processingProgress: 0.7 });

            // Import the CSV
            const createTableQuery = `
              CREATE TABLE ${escapedTableName} AS 
              SELECT * FROM read_csv_auto('${registeredFileName}', header=true, auto_detect=true)
            `;

            console.log(`[DuckDBStore] Importing converted CSV data`);
            await conn.query(createTableQuery);

            // Close the temporary connection
            await conn.close();

            // Verify the import
            const countQuery = `SELECT COUNT(*) as count FROM ${escapedTableName}`;
            const countResult = await get().connection!.query(countQuery);
            const count = countResult.toArray()[0].count;

            console.log(
              `[DuckDBStore] Successfully imported ${count} rows from Excel via CSV conversion`
            );

            // Register the table in our store
            const newTables = new Map(get().registeredTables);
            newTables.set(rawTableName, escapedTableName);

            set({
              registeredTables: newTables,
              isLoading: false,
              processingStatus: `Import complete (converted from Excel to CSV)`,
              processingProgress: 1.0,
            });

            // Refresh schema cache
            await get().refreshSchemaCache();

            return {
              tableName: rawTableName,
              rowCount: count,
              originalFormat: fileExt,
              convertedToCsv: true,
            };
          } catch (err) {
            // Make sure to close the connection on error
            await conn.close();
            throw err;
          }
        } catch (convErr) {
          console.error(`[DuckDBStore] Excel conversion failed:`, convErr);
          throw new Error(
            `Excel conversion failed: ${
              convErr instanceof Error ? convErr.message : String(convErr)
            }`
          );
        }
      }

      // Generate a safe table name from the file name
      const rawTableName = file.name
        .replace(/\.[^/.]+$/, "")
        .replace(/[^a-zA-Z0-9_]/g, "_");

      const escapedTableName = `"${rawTableName}"`;
      console.log(
        `[DuckDBStore] Importing file directly as table: ${rawTableName}`
      );

      // Drop existing table if any
      const dropQuery = `DROP TABLE IF EXISTS ${escapedTableName}`;
      await get().connection!.query(dropQuery);
      set({ processingProgress: 0.2 });

      // Create a temporary connection for this operation
      const conn = await get().db!.connect();

      try {
        // Register the file with DuckDB
        const fileName = `import_${Date.now()}.${fileExt}`;

        await get().db!.registerFileHandle(
          fileName,
          file,
          duckdb.DuckDBDataProtocol.BROWSER_FILEREADER,
          true
        );

        set({ processingProgress: 0.4 });
        console.log(`[DuckDBStore] File registered with DuckDB as ${fileName}`);

        if (fileExt === "csv") {
          set({ processingStatus: "Importing CSV file..." });
          console.log(`[DuckDBStore] Creating table from CSV file`);

          await importCsvWithFallback(conn, escapedTableName, fileName, false);
        } else if (fileExt === "json") {
          set({ processingStatus: "Importing JSON file..." });
          console.log(`[DuckDBStore] Creating table from JSON file`);

          await importJsonWithFallback(conn, escapedTableName, fileName, false);
        } else if (fileExt === "parquet") {
          set({ processingStatus: "Importing Parquet file..." });
          const createTableQuery = `
            CREATE TABLE ${escapedTableName} AS 
            SELECT * FROM read_parquet('${fileName}')
          `;
          console.log(`[DuckDBStore] Creating table from Parquet file`);
          await conn.query(createTableQuery);
        } else {
          throw new Error(`Unsupported file type: ${fileExt}`);
        }

        set({ processingProgress: 0.9 });

        // Close the temporary connection
        await conn.close();

        // Verify the import
        try {
          const countQuery = `SELECT COUNT(*) as count FROM ${escapedTableName}`;
          console.log(
            `[DuckDBStore] Verifying import with query: ${countQuery}`
          );
          const countResult = await get().connection!.query(countQuery);
          const count = countResult.toArray()[0].count;
          console.log(
            `[DuckDBStore] Successfully imported table with ${count} rows`
          );

          // Register the table in our store
          const newTables = new Map(get().registeredTables);
          newTables.set(rawTableName, escapedTableName);

          set({
            registeredTables: newTables,
            isLoading: false,
            processingStatus: "Import complete",
            processingProgress: 1.0,
          });

          // Refresh schema cache
          await get().refreshSchemaCache();

          return {
            tableName: rawTableName,
            rowCount: count,
          };
        } catch (countErr) {
          console.error(`[DuckDBStore] Error verifying import:`, countErr);
          throw new Error(
            "Error verifying import. The table may be empty or corrupted."
          );
        }
      } catch (err) {
        // Make sure to close the connection on error
        if (conn) {
          await conn.close();
        }
        throw err;
      }
    } catch (err) {
      console.error(`[DuckDBStore] Direct file import failed:`, err);

      // Provide clearer error messages based on common failures
      let errorMessage = `Import failed: ${
        err instanceof Error ? err.message : String(err)
      }`;

      if (err instanceof Error) {
        const errMsg = err.message.toLowerCase();

        if (errMsg.includes("memory") || errMsg.includes("out of bounds")) {
          errorMessage =
            "Import failed: The file is too large for browser memory limits. Try a smaller file or convert Excel to CSV format.";
        } else if (
          errMsg.includes("function") ||
          errMsg.includes("signature")
        ) {
          errorMessage =
            "Import failed: This operation is not supported in the browser version of DuckDB. Try a different approach or convert to CSV.";
        } else if (errMsg.includes("xlsx") || errMsg.includes("excel")) {
          errorMessage =
            "Excel import failed: Excel files are challenging to process in browsers. For best results, convert to CSV format.";
        }
      }

      set({
        error: errorMessage,
        isLoading: false,
        processingProgress: 0,
        processingStatus: "Import failed",
      });
      throw err;
    }
  },

  /**
   * Execute a SQL query with pagination
   */

  executePaginatedQuery: async (
    sql: string,
    page: number,
    pageSize: number
  ) => {
    const {
      connection,
      isInitialized,
      registeredTables,
      motherDuckConnected,
      motherDuckClient,
    } = get();

    if (!connection || !isInitialized) {
      await get().initialize();
      if (!get().connection) {
        set({ error: "DuckDB is not initialized" });
        return null;
      }
    }

    try {
      set({ isLoading: true, error: null });

      // SMART DETECTION: Analyze the query to determine execution target
      const queryAnalysis = get().isMotherDuckQuery(sql);

      console.log("[DuckDBStore] Query analysis:", {
        isMotherDuck: queryAnalysis.isMotherDuck,
        isHybrid: queryAnalysis.isHybrid,
        targetDatabase: queryAnalysis.targetDatabase,
        localTables: queryAnalysis.localTables,
        motherDuckTables: queryAnalysis.motherDuckTables,
      });

      // Handle hybrid queries
      if (queryAnalysis.isHybrid) {
        set({ isLoading: false });
        throw new Error(
          `Cross-database query detected!\n\n` +
            `This query references both local and MotherDuck tables:\n` +
            `• Local: ${queryAnalysis.localTables.join(", ")}\n` +
            `• MotherDuck: ${queryAnalysis.motherDuckTables
              .map((t) => `${t.database}.${t.name}`)
              .join(", ")}\n\n` +
            `DataKit will support cross database queries in future.\n` +
            `Please run separate queries for each database.`
        );
      }

      // Execute in MotherDuck if it's a MotherDuck query
      if (
        queryAnalysis.isMotherDuck &&
        motherDuckConnected &&
        motherDuckClient
      ) {
        console.log(
          `[DuckDBStore] Executing in MotherDuck (database: ${queryAnalysis.targetDatabase})`
        );
        console.log(`[DuckDBStore] Original SQL: "${sql}"`);

        // Check if this is a DDL statement (CREATE/DROP/ALTER)
        const isDDL = /^\s*(CREATE|DROP|ALTER)\s+/i.test(sql);

        if (isDDL) {
          console.log(
            `[DuckDBStore] DDL detected - executing without pagination`
          );

          const startTime = Date.now();
          const result = await get().executeMotherDuckQuery(
            sql,
            queryAnalysis.targetDatabase
          );
          const queryTime = Date.now() - startTime;

          // DDL operations typically don't return data
          set({ isLoading: false });

          // Trigger schema refresh if it was a successful DDL operation
          if (queryAnalysis.targetDatabase) {
            setTimeout(() => {
              get().refreshMotherDuckSchemas(queryAnalysis.targetDatabase!);
            }, 500);
          }

          return {
            data: [],
            columns: [],
            totalRows: 0,
            totalPages: 1,
            currentPage: 1,
            pageSize: pageSize,
            queryTime,
          };
        }

        // For non-DDL queries, continue with pagination logic
        const userHasLimit = hasLimitClause(sql);
        console.log(`[DuckDBStore] hasLimitClause() returned: ${userHasLimit}`);
        console.log(
          `[DuckDBStore] Current page: ${page}, pageSize: ${pageSize}`
        );

        if (userHasLimit) {
          console.log(`[DuckDBStore] BRANCH: User has LIMIT - executing as-is`);

          const startTime = Date.now();
          const result = await get().executeMotherDuckQuery(
            sql,
            queryAnalysis.targetDatabase
          );
          const queryTime = Date.now() - startTime;

          const columns =
            result && result.length > 0 ? Object.keys(result[0]) : [];

          set({ isLoading: false });

          return {
            data: Array.isArray(result) ? result : [],
            columns,
            totalRows: result.length,
            totalPages: 1,
            currentPage: 1,
            pageSize: result.length,
            queryTime,
          };
        } else {
          console.log(
            `[DuckDBStore] BRANCH: No LIMIT found - applying pagination`
          );

          const paginatedSql = addLimitIfMissing(sql, page, pageSize);
          console.log(
            `[DuckDBStore] addLimitIfMissing() returned: "${paginatedSql}"`
          );

          const startTime = Date.now();
          const result = await get().executeMotherDuckQuery(
            paginatedSql,
            queryAnalysis.targetDatabase
          );
          const queryTime = Date.now() - startTime;

          // Get total count for pagination
          let totalRows = result ? result.length : 0;
          try {
            let cleanSql = sql.trim();
            if (cleanSql.endsWith(";")) {
              cleanSql = cleanSql.slice(0, -1).trim();
            }

            const countQuery = cleanSql.replace(
              /SELECT\s+.*?\s+FROM/i,
              "SELECT COUNT(*) as total FROM"
            );
            console.log(`[DuckDBStore] Count query: ${countQuery}`);

            const countResult = await get().executeMotherDuckQuery(
              countQuery,
              queryAnalysis.targetDatabase
            );
            if (countResult && countResult[0]) {
              const rawTotal = countResult[0].total;
              totalRows =
                typeof rawTotal === "bigint"
                  ? Number(rawTotal)
                  : rawTotal || result.length;
              console.log(`[DuckDBStore] Total rows from count: ${totalRows}`);
            }
          } catch (countErr) {
            console.warn("[DuckDBStore] Failed to get total count:", countErr);
            totalRows = result.length;
          }

          const columns =
            result && result.length > 0 ? Object.keys(result[0]) : [];

          set({ isLoading: false });

          return {
            data: Array.isArray(result) ? result : [],
            columns,
            totalRows: totalRows,
            totalPages: Math.ceil(totalRows / pageSize),
            currentPage: page,
            pageSize: pageSize,
            queryTime,
          };
        }
      }

      // Check if query references unknown MotherDuck tables but not connected
      else if (
        queryAnalysis.motherDuckTables.length > 0 &&
        !motherDuckConnected
      ) {
        set({ isLoading: false });
        throw new Error(
          `This query references MotherDuck tables but you're not connected:\n` +
            `${queryAnalysis.motherDuckTables
              .map((t) => `• ${t.database}.${t.name}`)
              .join("\n")}\n\n` +
            `Please connect to MotherDuck first.`
        );
      }

      // Execute locally
      else {
        console.log("[DuckDBStore] Executing locally");
        const result = await executePaginatedQuery(
          {
            sql,
            page,
            pageSize,
            applyPagination: true,
            countTotalRows: true,
          },
          connection,
          registeredTables
        );

        if (page === 1) {
          try {
            await get().autoDetectTableChanges(sql);
          } catch (autoDetectErr) {
            console.warn("[DuckDBStore] Auto-detection failed:", autoDetectErr);
          }
        }

        set({ isLoading: false });
        return result;
      }
    } catch (err) {
      console.error(`[DuckDBStore] Paginated query execution error:`, err);
      set({
        error: `Query execution error: ${
          err instanceof Error ? err.message : String(err)
        }`,
        isLoading: false,
      });
      throw err;
    }
  },

  extractTableReferences: (sql: string) => {
    const references: Array<{ name: string; database?: string }> = [];

    // Patterns to match table references in different SQL clauses
    const patterns = [
      // FROM/JOIN with optional database qualification
      /(?:FROM|JOIN)\s+(?:"([^"]+)"\.)?(?:"([^"]+)"|([a-zA-Z_][a-zA-Z0-9_]*))(?:\s+(?:AS\s+)?(?:[a-zA-Z_][a-zA-Z0-9_]*))?/gi,
      // INSERT INTO
      /INSERT\s+INTO\s+(?:"([^"]+)"\.)?(?:"([^"]+)"|([a-zA-Z_][a-zA-Z0-9_]*))(?:\s+(?:AS\s+)?(?:[a-zA-Z_][a-zA-Z0-9_]*))?/gi,
      // UPDATE
      /UPDATE\s+(?:"([^"]+)"\.)?(?:"([^"]+)"|([a-zA-Z_][a-zA-Z0-9_]*))(?:\s+(?:AS\s+)?(?:[a-zA-Z_][a-zA-Z0-9_]*))?/gi,
      // CREATE TABLE/VIEW with database qualification
      /CREATE\s+(?:TABLE|VIEW)\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"([^"]+)"\.)?(?:"([^"]+)"|([a-zA-Z_][a-zA-Z0-9_]*))/gi,
      // DROP TABLE/VIEW with database qualification
      /DROP\s+(?:TABLE|VIEW)\s+(?:IF\s+EXISTS\s+)?(?:"([^"]+)"\.)?(?:"([^"]+)"|([a-zA-Z_][a-zA-Z0-9_]*))/gi,
      // ALTER TABLE
      /ALTER\s+TABLE\s+(?:"([^"]+)"\.)?(?:"([^"]+)"|([a-zA-Z_][a-zA-Z0-9_]*))/gi,
    ];

    patterns.forEach((pattern) => {
      let match;
      while ((match = pattern.exec(sql)) !== null) {
        const [, database, quotedTable, unquotedTable] = match;
        const tableName = quotedTable || unquotedTable;

        if (tableName) {
          references.push({
            name: tableName,
            database: database || undefined,
          });
        }
      }
    });

    // Remove duplicates
    const unique = references.filter(
      (ref, index, self) =>
        index ===
        self.findIndex(
          (r) => r.name === ref.name && r.database === ref.database
        )
    );

    return unique;
  },

  isMotherDuckQuery: (sql: string) => {
    const state = get();
    const { registeredTables, motherDuckSchemas } = state;

    // Extract all table references from the SQL
    const tableRefs = get().extractTableReferences(sql);

    if (tableRefs.length === 0) {
      return {
        isMotherDuck: false,
        localTables: [],
        motherDuckTables: [],
        isHybrid: false,
      };
    }

    const localTables: string[] = [];
    const motherDuckTables: Array<{ name: string; database: string }> = [];

    // Check if this is a DDL operation (CREATE/DROP/ALTER)
    const isDDL = /^\s*(CREATE|DROP|ALTER)\s+/i.test(sql);

    // Check each table reference
    tableRefs.forEach((ref) => {
      // If database is specified, it's ALWAYS a MotherDuck reference
      // Don't check if table exists for DDL operations!
      if (ref.database) {
        // For DDL operations, just check if the database exists
        if (isDDL) {
          // Even if the database doesn't exist yet, treat it as MotherDuck
          // (user might be creating a new database)
          motherDuckTables.push({ name: ref.name, database: ref.database });
          return;
        }

        // For non-DDL operations, check if the database exists
        const hasSchemas = motherDuckSchemas.has(ref.database);
        if (hasSchemas) {
          const schemas = motherDuckSchemas.get(ref.database) || [];
          const tableExists = schemas.some(
            (schema) => schema.name === ref.name
          );
          if (tableExists) {
            motherDuckTables.push({ name: ref.name, database: ref.database });
            return;
          }
          // If database exists but table doesn't, still treat as MotherDuck
          // (might be a typo or the table was just dropped)
          motherDuckTables.push({ name: ref.name, database: ref.database });
          return;
        } else {
          // Database not in schema - but if it has database prefix, it's still MotherDuck
          motherDuckTables.push({ name: ref.name, database: ref.database });
          return;
        }
      }

      // No database specified - check if it's a local table
      if (registeredTables.has(ref.name)) {
        localTables.push(ref.name);
        return;
      }

      // If no database specified, check all MotherDuck databases for this table
      let foundInMotherDuck = false;
      motherDuckSchemas.forEach((schemas, databaseName) => {
        const tableExists = schemas.some((schema) => schema.name === ref.name);
        if (tableExists && !foundInMotherDuck) {
          motherDuckTables.push({ name: ref.name, database: databaseName });
          foundInMotherDuck = true;
        }
      });

      // If not found anywhere, assume it might be a local table or CTE
      if (!foundInMotherDuck) {
        localTables.push(ref.name);
      }
    });

    const isHybrid = localTables.length > 0 && motherDuckTables.length > 0;
    const isMotherDuckOnly =
      motherDuckTables.length > 0 && localTables.length === 0;

    // Determine target database (prefer the first one found)
    const targetDatabase =
      motherDuckTables.length > 0 ? motherDuckTables[0].database : undefined;

    return {
      isMotherDuck: isMotherDuckOnly,
      targetDatabase,
      localTables,
      motherDuckTables,
      isHybrid,
    };
  },

  executeChartQuery: async (
    tableName: string,
    dimension: string,
    measure: string,
    aggregation: "sum" | "avg" | "min" | "max" | "count" = "sum",
    limit: number = 100,
    filters: { field: string; operator: string; value: string }[] = []
  ) => {
    const { connection, isInitialized } = get();

    if (!connection || !isInitialized) {
      throw new Error("DuckDB is not initialized");
    }

    try {
      // Build WHERE clause if filters exist
      let whereClause = "";
      if (filters.length > 0) {
        whereClause =
          "WHERE " +
          filters
            .map((f) => `"${f.field}" ${f.operator} '${f.value}'`)
            .join(" AND ");
      }

      // Create SQL for different chart types
      const sql = `
      SELECT 
        "${dimension}" as dimension, 
        ${aggregation}("${measure}") as value,
        COUNT(*) as count
      FROM "${tableName}"
      ${whereClause}
      GROUP BY "${dimension}"
      ORDER BY value DESC
      LIMIT ${limit}
    `;

      console.log(`[DuckDBStore] Chart query: ${sql}`);
      const result = await connection.query(sql);

      return result.toArray().map((row) => ({
        dimension: row.dimension,
        value: typeof row.value === "bigint" ? Number(row.value) : row.value,
        count: typeof row.count === "bigint" ? Number(row.count) : row.count,
      }));
    } catch (err) {
      console.error(`[DuckDBStore] Chart query execution error:`, err);
      throw err;
    }
  },

  refreshAllTables: async () => {
    const { connection, isInitialized } = get();

    if (!connection || !isInitialized) {
      console.warn("[DuckDBStore] Cannot refresh tables - not initialized");
      return;
    }

    try {
      console.log("[DuckDBStore] Auto-refreshing tables and views...");

      const currentKnownTables = get().registeredTables;
      const newRegisteredTables = new Map(currentKnownTables); // Copy existing
      const newSchemaCache = new Map(get().schemaCache);

      const discoveredObjects = await discoverAllTables(
        connection,
        currentKnownTables
      );

      let newObjectsCount = 0;

      for (const objectInfo of discoveredObjects) {
        // 🔧 FIXED: Only add if it's actually NEW (not already registered)
        if (!currentKnownTables.has(objectInfo.name)) {
          newRegisteredTables.set(objectInfo.name, objectInfo.escapedName);

          try {
            const schema = await getTableSchema(
              connection,
              objectInfo.name,
              objectInfo.escapedName
            );
            newSchemaCache.set(objectInfo.name, schema);
            newObjectsCount++;

            const objectTypeLabel =
              objectInfo.type === "view" ? "view" : "table";
            console.log(
              `[DuckDBStore] Discovered new ${objectTypeLabel}: ${
                objectInfo.name
              } with ${objectInfo.rowCount || 0} rows`
            );
          } catch (schemaErr) {
            console.warn(
              `[DuckDBStore] Failed to get schema for discovered ${objectInfo.type} ${objectInfo.name}:`,
              schemaErr
            );
          }
        } else {
          // Object already exists, just make sure it's still in the map
          // (it should be since we copied currentKnownTables)
          console.log(
            `[DuckDBStore] Object ${objectInfo.name} already registered, skipping`
          );
        }
      }

      const existingCount = currentKnownTables.size;
      const newCount = newRegisteredTables.size;

      console.log(`[DuckDBStore] Registration update:`, {
        before: existingCount,
        after: newCount,
        newObjects: newObjectsCount,
        preservedExisting: newCount - newObjectsCount,
      });

      set({
        registeredTables: newRegisteredTables,
        schemaCache: newSchemaCache,
        lastTableRefresh: Date.now(),
      });

      if (newObjectsCount > 0) {
        const tables = discoveredObjects.filter(
          (o) => o.type === "table"
        ).length;
        const views = discoveredObjects.filter((o) => o.type === "view").length;
        console.log(
          `[DuckDBStore] Auto-refresh complete. Found ${tables} tables and ${views} views (${newObjectsCount} new)`
        );
      } else {
        console.log(
          "[DuckDBStore] Auto-refresh complete. No new objects found."
        );
      }
    } catch (err) {
      console.error("[DuckDBStore] Failed to auto-refresh tables:", err);
    }
  },

  /**
   * Auto-detects table changes based on executed SQL and refreshes if needed
   */
  autoDetectTableChanges: async (executedSQL: string) => {
    const { connection, isInitialized } = get();

    if (!connection || !isInitialized) {
      return;
    }

    try {
      // Use the updated detection function
      const analysis = detectTableModifyingSQL(executedSQL);

      if (analysis.isModifying) {
        console.log(`[DuckDBStore] Detected table-modifying SQL:`, {
          commands: analysis.commands,
          possibleTableNames: analysis.possibleTableNames,
          isMotherDuck: analysis.isMotherDuck,
          database: analysis.database,
        });

        if (analysis.isMotherDuck && analysis.database) {
          // It's a MotherDuck DDL operation
          console.log(
            `[DuckDBStore] Detected MotherDuck DDL for database: ${analysis.database}`
          );

          // Wait a moment for the operation to complete
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Refresh MotherDuck schemas for that database
          try {
            await get().refreshMotherDuckSchemas(analysis.database);
            console.log(
              `[DuckDBStore] Refreshed MotherDuck schemas for ${analysis.database}`
            );
          } catch (refreshErr) {
            console.warn(
              `[DuckDBStore] Failed to refresh MotherDuck schemas:`,
              refreshErr
            );
          }
        } else {
          // It's a local operation
          console.log(`[DuckDBStore] Detected local DDL operation`);

          // Wait a brief moment for the query to complete
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Refresh local tables
          await get().refreshAllTables();
        }
      }
    } catch (err) {
      console.warn("[DuckDBStore] Auto-detection failed:", err);
      // Don't throw here - this is a background operation
    }
  },

  // In useDuckDBStore, update the connectToMotherDuck method:

  connectToMotherDuck: async (token: string) => {
    set({ motherDuckConnecting: true, motherDuckError: null });

    try {
      console.log("[DuckDBStore] Connecting to MotherDuck...");

      const { MDConnection } = await import("@motherduck/wasm-client");
      const client = await MDConnection.create({ mdToken: token });
      await client.isInitialized();

      const result = await client.evaluateQuery("SHOW DATABASES");
      let databases: Array<{ name: string; shared: boolean }> = [];

      if (result?.data?.toRows) {
        const rows = result.data.toRows();
        databases = rows
          .map((row: any) => ({
            name: row.database_name || row.name || row.Database || row[0] || "",
            shared: row.shared || false,
          }))
          .filter(
            (db: any) => db.name && db.name !== "system" && db.name !== "temp"
          );
      }

      set({
        motherDuckClient: client,
        motherDuckConnected: true,
        motherDuckConnecting: false,
        motherDuckDatabases: databases,
        selectedMotherDuckDatabase:
          databases.length > 0 ? databases[0].name : null,
      });

      console.log(
        `[DuckDBStore] Connected to MotherDuck with ${databases.length} databases`
      );

      // Auto-fetch schemas for the first database to improve UX
      if (databases.length > 0) {
        try {
          await get().refreshMotherDuckSchemas(databases[0].name);
          console.log(
            `[DuckDBStore] Auto-loaded schemas for ${databases[0].name}`
          );
        } catch (err) {
          console.warn(
            `[DuckDBStore] Failed to auto-load schemas for ${databases[0].name}:`,
            err
          );
        }
      }
    } catch (err) {
      console.error("[DuckDBStore] MotherDuck connection failed:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Connection failed";
      set({
        motherDuckConnecting: false,
        motherDuckError: errorMessage,
      });
      throw err;
    }
  },

  disconnectFromMotherDuck: async () => {
    const { motherDuckClient } = get();

    try {
      if (motherDuckClient) {
        await motherDuckClient.close();
      }
    } catch (err) {
      console.warn("[DuckDBStore] Error during MotherDuck disconnect:", err);
    }

    set({
      motherDuckClient: null,
      motherDuckConnected: false,
      motherDuckConnecting: false,
      motherDuckError: null,
      motherDuckDatabases: [],
      selectedMotherDuckDatabase: null,
      motherDuckSchemas: new Map(),
    });

    console.log("[DuckDBStore] Disconnected from MotherDuck");
  },

  executeMotherDuckQuery: async (sql: string, databaseName?: string) => {
    const { motherDuckClient, selectedMotherDuckDatabase } = get();

    if (!motherDuckClient) {
      throw new Error("MotherDuck client not available");
    }

    const dbToUse = databaseName || selectedMotherDuckDatabase;

    console.log(
      `[DuckDBStore] Executing MotherDuck query in database '${dbToUse}':`
    );
    console.log(`[DuckDBStore] SQL: ${sql}`);

    try {
      // Check if query has qualified table names (database.table pattern)
      const hasQualifiedNames =
        /"\w+"\."\w+"/.test(sql) || sql.includes(`"${dbToUse}".`);

      let finalSql = sql;

      if (!hasQualifiedNames && dbToUse) {
        // Only add USE if no qualified names and we have a target database
        await motherDuckClient.evaluateQuery(`USE ${dbToUse}`);
        console.log(`[DuckDBStore] Switched to database: ${dbToUse}`);
      }

      console.log(`[DuckDBStore] About to execute: ${finalSql}`);
      const result = await motherDuckClient.evaluateQuery(finalSql);

      // DEBUG: Log the raw result structure
      console.log(`[DuckDBStore] Raw result type:`, typeof result);
      console.log(`[DuckDBStore] Raw result structure:`, {
        hasData: !!result?.data,
        dataType: typeof result?.data,
        dataIsArray: Array.isArray(result?.data),
        dataToRows: typeof result?.data?.toRows,
        dataToArray: typeof result?.data?.toArray,
      });

      let extractedData = [];

      // Extract data from MotherDuck result with better debugging
      if (result?.data?.toRows) {
        extractedData = result.data.toRows();
        console.log(
          `[DuckDBStore] Used toRows(), got ${extractedData.length} rows`
        );
      } else if (result?.data?.toArray) {
        extractedData = result.data.toArray();
        console.log(
          `[DuckDBStore] Used toArray(), got ${extractedData.length} rows`
        );
      } else if (Array.isArray(result?.data)) {
        extractedData = result.data;
        console.log(
          `[DuckDBStore] Used direct array, got ${extractedData.length} rows`
        );
      } else {
        console.warn(`[DuckDBStore] Unknown result format:`, result);
        extractedData = [];
      }

      // CRITICAL: If we got way more rows than expected, something went wrong
      if (sql.toLowerCase().includes("limit")) {
        const limitMatch = sql.match(/limit\s+(\d+)/i);
        if (limitMatch) {
          const expectedLimit = parseInt(limitMatch[1], 10);
          if (extractedData.length > expectedLimit * 2) {
            // Allow some buffer
            console.error(
              `[DuckDBStore] LIMIT clause ignored! Expected ~${expectedLimit} rows, got ${extractedData.length}`
            );
            console.error(
              `[DuckDBStore] This suggests MotherDuck is not respecting the LIMIT clause`
            );

            // FALLBACK: Manually limit the results client-side
            console.warn(
              `[DuckDBStore] Applying client-side limit to ${expectedLimit} rows`
            );
            extractedData = extractedData.slice(0, expectedLimit);
          }
        }
      }

      console.log(`[DuckDBStore] Final result: ${extractedData.length} rows`);
      return extractedData;
    } catch (err) {
      console.error("[DuckDBStore] MotherDuck query failed:", err);
      throw err;
    }
  },

  refreshMotherDuckSchemas: async (databaseName: string) => {
    const { motherDuckClient } = get();

    if (!motherDuckClient) {
      throw new Error("MotherDuck client not available");
    }

    try {
      console.log(
        `[DuckDBStore] Refreshing schemas for MotherDuck database: ${databaseName}`
      );

      // Switch to the database
      await motherDuckClient.evaluateQuery(`USE ${databaseName}`);

      // Get all tables
      const tablesResult = await motherDuckClient.evaluateQuery("SHOW TABLES");
      let tableNames: Set<string> = new Set();
      let schemas: { name: string; type: string }[] = [];

      if (tablesResult?.data?.toRows) {
        const rows = tablesResult.data.toRows();
        rows.forEach((row: any) => {
          const tableName = row.name || row.table_name || row[0] || "";
          if (tableName) {
            tableNames.add(tableName);
            schemas.push({
              name: tableName,
              type: "table",
            });
          }
        });
      }

      // Get all views and mark them correctly
      try {
        const viewsResult = await motherDuckClient.evaluateQuery("SHOW VIEWS");
        if (viewsResult?.data?.toRows) {
          const viewRows = viewsResult.data.toRows();
          viewRows.forEach((row: any) => {
            const viewName = row.name || row.view_name || row[0] || "";
            if (viewName) {
              // Remove from tables if it was listed there
              if (tableNames.has(viewName)) {
                schemas = schemas.filter((s) => s.name !== viewName);
              }
              // Add as view
              schemas.push({
                name: viewName,
                type: "view",
              });
            }
          });
        }
      } catch (viewErr) {
        console.log("[DuckDBStore] No views or views query failed:", viewErr);
      }

      // Alternative approach: Use information_schema if available
      try {
        const infoSchemaResult = await motherDuckClient.evaluateQuery(`
        SELECT table_name, table_type 
        FROM information_schema.tables 
        WHERE table_schema = '${databaseName}'
      `);

        if (infoSchemaResult?.data?.toRows) {
          const infoRows = infoSchemaResult.data.toRows();
          // Create a map for accurate type information
          const typeMap = new Map<string, string>();

          infoRows.forEach((row: any) => {
            if (row.table_name && row.table_type) {
              const type = row.table_type.toLowerCase().includes("view")
                ? "view"
                : "table";
              typeMap.set(row.table_name, type);
            }
          });

          // Update schemas with accurate types
          schemas = schemas.map((schema) => ({
            ...schema,
            type: typeMap.get(schema.name) || schema.type,
          }));
        }
      } catch (infoErr) {
        console.log(
          "[DuckDBStore] information_schema query failed, using SHOW TABLES/VIEWS results"
        );
      }

      set((state) => ({
        motherDuckSchemas: new Map(state.motherDuckSchemas).set(
          databaseName,
          schemas
        ),
      }));

      console.log(
        `[DuckDBStore] Refreshed ${schemas.length} schemas for ${databaseName}:`,
        schemas.map((s) => `${s.name} (${s.type})`).join(", ")
      );
    } catch (err) {
      console.error(
        `[DuckDBStore] Failed to refresh schemas for ${databaseName}:`,
        err
      );
      throw err;
    }
  },

  getAllAvailableTables: () => {
    const state = get();
    const tables: Array<{
      name: string;
      source: "local" | "motherduck";
      database?: string;
    }> = [];

    // Local tables
    Array.from(state.registeredTables.keys()).forEach((tableName) => {
      tables.push({
        name: tableName,
        source: "local",
      });
    });

    // MotherDuck tables
    state.motherDuckSchemas.forEach((schemas, databaseName) => {
      schemas.forEach((schema) => {
        tables.push({
          name: schema.name,
          source: "motherduck",
          database: databaseName,
        });
      });
    });

    return tables;
  },
}));
