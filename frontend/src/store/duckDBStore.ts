import { create } from "zustand";
import * as duckdb from "@duckdb/duckdb-wasm";
import { cleanup, initializeDuckDB } from "@/lib/duckdb/init";
import { isDevelopment } from "@/lib/duckdb/config";

import { ColumnType } from "@/types/csv";
import { DataSourceType } from "@/types/json";

// Types for the store

interface PaginatedQueryResult {
  data: any[];
  columns: string[];
  totalRows: number;
  page: number;
  pageSize: number;
  totalPages: number;
  queryTime: number;
}

interface DuckDBState {
  // DB state
  db: duckdb.AsyncDuckDB | null;
  connection: duckdb.AsyncDuckDBConnection | null;
  isInitializing: boolean;
  isInitialized: boolean;
  error: string | null;

  // Table registry - maps raw names to escaped names
  registeredTables: Map<string, string>;

  // Progress tracking
  isLoading: boolean;
  processingProgress: number;
  processingStatus: string;

  // Actions
  initialize: () => Promise<boolean>;
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
  resetError: () => void;
  cleanupDB: () => Promise<void>;
  importFileDirectly: (
    file: File
  ) => Promise<{ tableName: string; rowCount: number }>;
  executePaginatedQuery: (
    sql: string,
    page: number,
    pageSize: number
  ) => Promise<PaginatedQueryResult | null>;
}

// Create the store
export const useDuckDBStore = create<DuckDBState>((set, get) => ({
  // Initial state
  db: null,
  connection: null,
  isInitializing: false,
  isInitialized: false,
  error: null,
  registeredTables: new Map(),
  isLoading: false,
  processingProgress: 0,
  processingStatus: "",

  // Initialize DuckDB - should be called early in app lifecycle
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
            return "VARCHAR"; // Using VARCHAR for dates to avoid parsing issues
          case ColumnType.Array:
          case ColumnType.Object:
            return "TEXT"; // Use TEXT instead of JSON for better compatibility
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
          // Properly escape header names with double quotes
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
      const batchSize = 1000; // Start with smaller batches for debugging
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

  // Execute a SQL query
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
          // This regex matches the table name when it's not already in quotes
          // and not part of another identifier
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

  // Get available tables
  getAvailableTables: () => {
    return Array.from(get().registeredTables.keys());
  },

  // Get table schema
  getTableSchema: async (tableName) => {
    const { connection, isInitialized, registeredTables } = get();

    if (!connection || !isInitialized) {
      return null;
    }

    try {
      const escapedTableName =
        registeredTables.get(tableName) || `"${tableName}"`;
      const schemaQuery = `PRAGMA table_info(${escapedTableName})`;
      const result = await connection.query(schemaQuery);
      return result.toArray().map((col) => ({
        name: col.name,
        type: col.type,
      }));
    } catch (err) {
      console.error(
        `[DuckDBStore] Failed to get schema for ${tableName}:`,
        err
      );
      return null;
    }
  },

  // Reset error state
  resetError: () => set({ error: null }),

  // Cleanup function for DB
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
    });
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
          false
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

  executePaginatedQuery: async (sql, page, pageSize) => {
    const { connection, isInitialized, registeredTables } = get();
    const startTime = performance.now();

    if (!connection || !isInitialized) {
      await get().initialize();
      if (!get().connection) {
        set({ error: "DuckDB is not initialized" });
        return null;
      }
    }

    try {
      console.log(
        `[DuckDBStore] Executing paginated query (page: ${page}, size: ${pageSize})`
      );
      set({ isLoading: true, error: null });

      // Process the SQL query to add table name quotes if needed
      let processedSQL = sql;
      const knownTableNames = Array.from(registeredTables.keys());
      for (const tableName of knownTableNames) {
        const tableNameRegex = new RegExp(
          `\\b${tableName}\\b(?=(?:[^"]*"[^"]*")*[^"]*$)`,
          "g"
        );
        const escapedName = registeredTables.get(tableName) || `"${tableName}"`;
        processedSQL = processedSQL.replace(tableNameRegex, escapedName);
      }

      // Clean SQL for analysis (remove comments and normalize whitespace)
      const cleanSQL = processedSQL
        .replace(/--.*$/gm, "") // Remove single-line comments
        .replace(/\/\*[\s\S]*?\*\//g, "") // Remove multi-line comments
        .trim();

      // Determine if this is a SELECT query (case insensitive)
      const isSelectQuery = /^\s*SELECT\b/i.test(cleanSQL);

      if (!isSelectQuery) {
        console.warn(
          `[DuckDBStore] Non-SELECT query detected, pagination may not work as expected: ${cleanSQL.substring(
            0,
            50
          )}...`
        );
      }

      // 1. First, get the total count without pagination
      let countQuery;
      let totalRows = 0;
      let totalPages = 0;

      if (isSelectQuery) {
        // For standard SELECT queries, we wrap them in a COUNT
        // Use CAST to handle BigInt conversion issues
        countQuery = `SELECT CAST(COUNT(*) AS INTEGER) as total_rows FROM (${processedSQL}) as count_query`;

        console.log(`[DuckDBStore] Executing count query: ${countQuery}`);

        try {
          const countResult = await connection.query(countQuery);
          const countArray = countResult.toArray();

          // Safely extract the count, handling various numeric types
          if (countArray && countArray.length > 0) {
            const countValue = countArray[0].total_rows;

            // Handle BigInt or Number conversions
            if (typeof countValue === "bigint") {
              totalRows = Number(countValue);
              console.log(
                `[DuckDBStore] Converted BigInt count (${countValue}) to Number (${totalRows})`
              );
            } else {
              totalRows = countValue || 0;
            }

            totalPages = Math.ceil(totalRows / pageSize);
            console.log(
              `[DuckDBStore] Total rows: ${totalRows}, Total pages: ${totalPages}`
            );
          } else {
            console.warn(
              `[DuckDBStore] Count query returned no results, setting totalRows to 0`
            );
            totalRows = 0;
            totalPages = 0;
          }
        } catch (countErr) {
          console.error(`[DuckDBStore] Error executing count query:`, countErr);
          console.log(
            `[DuckDBStore] Falling back to direct query without count`
          );
          // If count fails, we'll try to proceed with the main query
          totalRows = 0;
          totalPages = 1;
        }
      } else {
        // For non-SELECT queries, we don't paginate
        console.log(`[DuckDBStore] Non-SELECT query, skipping pagination`);
        totalRows = 0;
        totalPages = 1;
      }

      // 2. Now execute the actual query with pagination
      let paginatedSQL = processedSQL;

      // Only add LIMIT and OFFSET if it's a SELECT query without existing LIMIT
      if (isSelectQuery && !cleanSQL.toUpperCase().includes("LIMIT")) {
        const offset = (page - 1) * pageSize;
        paginatedSQL = `${processedSQL} LIMIT ${pageSize} OFFSET ${offset}`;
        console.log(
          `[DuckDBStore] Applying pagination: LIMIT ${pageSize} OFFSET ${offset}`
        );
      }

      console.log(`[DuckDBStore] Executing paginated SQL: ${paginatedSQL}`);
      const result = await connection.query(paginatedSQL);

      const endTime = performance.now();
      const queryTime = endTime - startTime;

      // Safely convert to array, handling any BigInt conversions
      let resultData = [];
      try {
        // Get raw data
        const rawData = result.toArray();

        // Process data to handle BigInt values
        resultData = rawData.map((row) => {
          const processedRow = {};

          // For each property in the row
          for (const key in row) {
            if (Object.prototype.hasOwnProperty.call(row, key)) {
              const value = row[key];

              // Convert BigInt to Number if it's within safe integer range
              if (typeof value === "bigint") {
                if (
                  value <= Number.MAX_SAFE_INTEGER &&
                  value >= Number.MIN_SAFE_INTEGER
                ) {
                  processedRow[key] = Number(value);
                } else {
                  // For larger values, convert to string to avoid precision loss
                  processedRow[key] = value.toString();
                }
              } else {
                processedRow[key] = value;
              }
            }
          }

          return processedRow;
        });
      } catch (conversionErr) {
        console.error(
          `[DuckDBStore] Error converting result data:`,
          conversionErr
        );
        // Fallback to empty result set
        resultData = [];
      }

      const columns = result.schema.fields.map((f) => f.name);

      // If we didn't get a count (non-SELECT query), use result size
      if (totalRows === 0 && resultData.length > 0) {
        if (isSelectQuery) {
          // For SELECT queries without count, we know there's at least this many rows
          totalRows = (page - 1) * pageSize + resultData.length;
          // If we got less than pageSize, we might be on the last page
          const isLastPage = resultData.length < pageSize;
          totalPages = isLastPage ? page : page + 1; // At least current page + 1 more
        } else {
          totalRows = resultData.length;
          totalPages = 1;
        }
      }

      set({ isLoading: false });

      console.log(
        `[DuckDBStore] Query executed successfully. Returned ${resultData.length} rows out of ${totalRows} total`
      );

      return {
        data: resultData,
        columns,
        totalRows,
        page,
        pageSize,
        totalPages,
        queryTime,
      };
    } catch (err) {
      console.error(`[DuckDBStore] Paginated query execution error:`, err);
      set({
        error: `Query execution error: ${
          err instanceof Error ? err.message : String(err)
        }`,
        isLoading: false,
      });
      return null;
    }
  },
}));
