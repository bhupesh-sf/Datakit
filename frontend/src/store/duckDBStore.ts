import { create } from "zustand";
import * as duckdb from "@duckdb/duckdb-wasm";

import { cleanup, initializeDuckDB } from "@/lib/duckdb/init";
import { isDevelopment } from "@/lib/duckdb/config";
import { executePaginatedQuery } from "@/lib/duckdb/query";
import { discoverAllTables, getTableSchema, detectTableModifyingSQL  } from "@/lib/duckdb/ingestion/tables";

import { PaginatedQueryResult } from "@/lib/duckdb/types";
import { ColumnType } from "@/types/csv";

import { SAMPLE_EMPLOYEES_DATA } from "./constants";

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
    const { db, connection, isInitialized } = get();

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

      const fileExt = fileName.split(".").pop()?.toLowerCase();
      const fileSizeMB = fileSize / (1024 * 1024);

      console.log(
        `[DuckDBStore] Hybrid import: ${fileName} (${fileSizeMB.toFixed(2)}MB)`
      );

      // Get the File object (DuckDB-WASM expects File, not FileSystemFileHandle)
      const file = await fileHandle.getFile();

      set({
        processingStatus: "Analyzing file for optimal import strategy...",
        processingProgress: 0.2,
      });

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

          // Excel files always use TABLE approach (since they're limited to 100MB)
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

        // 🔥 HYBRID APPROACH: Table for ≤600MB, View for >600MB
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
            console.log(`[DuckDBStore] Creating CSV TABLE for files ≤600MB`);
            createQuery = `CREATE TABLE ${escapedTableName} AS SELECT * FROM read_csv('${registeredFileName}', strict_mode=false)`;
          } else {
            set({
              processingStatus: `Creating instant CSV view (${fileSizeMB.toFixed(
                2
              )}MB)...`,
            });
            console.log(`[DuckDBStore] Creating CSV VIEW for files >600MB`);
            createQuery = `CREATE VIEW ${escapedTableName} AS SELECT * FROM read_csv('${registeredFileName}', strict_mode=false)`;
          }
        } else if (fileExt === "json") {
          if (useTableApproach) {
            set({
              processingStatus: `Creating JSON table (${fileSizeMB.toFixed(
                2
              )}MB)...`,
            });
            console.log(`[DuckDBStore] Creating JSON TABLE for files ≤600MB`);
            createQuery = `CREATE TABLE ${escapedTableName} AS SELECT * FROM read_json('${registeredFileName}')`;
          } else {
            set({
              processingStatus: `Creating instant JSON view (${fileSizeMB.toFixed(
                2
              )}MB)...`,
            });
            console.log(`[DuckDBStore] Creating JSON VIEW for files >600MB`);
            createQuery = `CREATE VIEW ${escapedTableName} AS SELECT * FROM read_json('${registeredFileName}')`;
          }
        } else if (fileExt === "parquet") {
          if (useTableApproach) {
            set({
              processingStatus: `Creating Parquet table (${fileSizeMB.toFixed(
                2
              )}MB)...`,
            });
            console.log(
              `[DuckDBStore] Creating Parquet TABLE for files ≤600MB`
            );
            createQuery = `CREATE TABLE ${escapedTableName} AS SELECT * FROM read_parquet('${registeredFileName}')`;
          } else {
            set({
              processingStatus: `Creating instant Parquet view (${fileSizeMB.toFixed(
                2
              )}MB)...`,
            });
            console.log(`[DuckDBStore] Creating Parquet VIEW for files >600MB`);
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
          // For tables ≤600MB: Count rows like importFileDirectly
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
          // For views >600MB: No counting, instant completion
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
          if (fileSizeMB <= 600) {
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
            `Supported formats: CSV, JSON, Parquet, Excel (.xlsx/.xls).`;
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
    const { db, connection, isInitialized } = get();

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
      const fileExt = file.name.split(".").pop()?.toLowerCase();
      const fileSize = file.size / (1024 * 1024); // Size in MB
      console.log(
        `[DuckDBStore] Importing file: ${file.name} (${fileSize.toFixed(2)} MB)`
      );

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
          const createTableQuery = `
            CREATE TABLE ${escapedTableName} AS 
            SELECT * FROM read_csv_auto('${fileName}', header=true, auto_detect=true)
          `;

          set({ processingStatus: "Importing CSV file..." });
          console.log(`[DuckDBStore] Creating table from CSV file`);
          await conn.query(createTableQuery);
        } else if (fileExt === "json") {
          set({ processingStatus: "Importing JSON file..." });
          const createTableQuery = `
            CREATE TABLE ${escapedTableName} AS 
            SELECT * FROM read_json_auto('${fileName}')
          `;
          console.log(`[DuckDBStore] Creating table from JSON file`);
          await conn.query(createTableQuery);
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
  executePaginatedQuery: async (sql, page, pageSize) => {
    const { connection, isInitialized, registeredTables } = get();

    if (!connection || !isInitialized) {
      await get().initialize();
      if (!get().connection) {
        set({ error: "DuckDB is not initialized" });
        return null;
      }
    }

    try {
      set({ isLoading: true, error: null });

      // Use the refactored function from our utilities
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

      // ✨ AUTO-DETECT TABLE CHANGES AFTER SUCCESSFUL EXECUTION
      // Only run auto-detection on the first page to avoid multiple triggers
      if (page === 1) {
        try {
          await get().autoDetectTableChanges(sql);
        } catch (autoDetectErr) {
          console.warn(
            "[DuckDBStore] Auto-detection failed in paginated query:",
            autoDetectErr
          );
          // Don't fail the main query for auto-detection issues
        }
      }

      set({ isLoading: false });

      return result;
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
      console.log("[DuckDBStore] Auto-refreshing tables...");


      // Discover all tables in the database
      const currentKnownTables = get().registeredTables;
      const discoveredTables = await discoverAllTables(
        connection,
        currentKnownTables
      );

      // Update the registered tables map
      const newRegisteredTables = new Map<string, string>();
      const newSchemaCache = new Map(get().schemaCache);

      let newTablesCount = 0;

      for (const tableInfo of discoveredTables) {
        newRegisteredTables.set(tableInfo.name, tableInfo.escapedName);

        // If this is a newly discovered table, fetch its schema
        if (
          tableInfo.isUserCreated &&
          !currentKnownTables.has(tableInfo.name)
        ) {
          try {
            const schema = await getTableSchema(
              connection,
              tableInfo.name,
              tableInfo.escapedName
            );
            newSchemaCache.set(tableInfo.name, schema);
            newTablesCount++;

            console.log(
              `[DuckDBStore] Discovered new table: ${tableInfo.name} with ${
                tableInfo.rowCount || 0
              } rows`
            );
          } catch (schemaErr) {
            console.warn(
              `[DuckDBStore] Failed to get schema for discovered table ${tableInfo.name}:`,
              schemaErr
            );
          }
        }
      }

      // Update state
      set({
        registeredTables: newRegisteredTables,
        schemaCache: newSchemaCache,
        lastTableRefresh: Date.now(),
      });

      if (newTablesCount > 0) {
        console.log(
          `[DuckDBStore] Auto-refresh complete. Discovered ${newTablesCount} new tables`
        );
      }
    } catch (err) {
      console.error("[DuckDBStore] Failed to auto-refresh tables:", err);
      // Don't set error state for auto-refresh failures - this is a background operation
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
      // Analyze the SQL for table-modifying commands
      const analysis = detectTableModifyingSQL(executedSQL);

      if (analysis.isModifying) {
        console.log(`[DuckDBStore] Detected table-modifying SQL:`, {
          commands: analysis.commands,
          possibleTables: analysis.possibleTableNames,
        });

        // Wait a brief moment for the query to complete fully
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Refresh tables to pick up any changes
        await get().refreshAllTables();
      }
    } catch (err) {
      console.warn("[DuckDBStore] Auto-detection failed:", err);
      // Don't throw here - this is a background operation
    }
  },
}));
