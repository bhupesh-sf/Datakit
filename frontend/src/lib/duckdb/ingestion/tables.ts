import * as duckdb from "@duckdb/duckdb-wasm";

export interface TableInfo {
  name: string;
  escapedName: string;
  isUserCreated: boolean;
  rowCount?: number;
  type?: "table" | "view";
}

/**
 * Gets the specific type of a database object
 */
export async function getObjectType(
  connection: duckdb.AsyncDuckDBConnection,
  objectName: string
): Promise<"table" | "view" | null> {
  try {
    // First try sqlite_master (fastest for regular tables/views)
    const masterQuery = `
      SELECT type 
      FROM sqlite_master 
      WHERE name = '${objectName}' 
      AND type IN ('table', 'view')
    `;

    const masterResult = await connection.query(masterQuery);
    const masterRows = masterResult.toArray();

    if (masterRows.length > 0) {
      return masterRows[0].type as "table" | "view";
    }

    // 🔧 NEW: Check information_schema for views (catches file-based views from large imports)
    try {
      const viewQuery = `
        SELECT table_name
        FROM information_schema.views 
        WHERE table_name = '${objectName}'
        AND table_schema = 'main'
      `;

      const viewResult = await connection.query(viewQuery);
      const viewRows = viewResult.toArray();

      if (viewRows.length > 0) {
        console.log(
          `[TableType] Found ${objectName} as view in information_schema`
        );
        return "view";
      }
    } catch (viewErr) {
      // information_schema might not be available
    }

    // Check if object is queryable (last resort)
    try {
      const escapedName = `"${objectName}"`;
      await connection.query(`SELECT 1 FROM ${escapedName} LIMIT 0`);

      console.warn(
        `[TableType] ${objectName} is queryable but not in catalogs, assuming table`
      );
      return "table";
    } catch (queryError) {
      return null;
    }
  } catch (err) {
    console.error(`[TableType] Error determining type for ${objectName}:`, err);
    return null;
  }
}

function isSystemObject(objectName: string): boolean {
  const name = objectName.toLowerCase();

  // DuckDB system objects to exclude
  const systemObjects = [
    // DuckDB internal views
    "duckdb_columns",
    "duckdb_constraints",
    "duckdb_databases",
    "duckdb_indexes",
    "duckdb_logs",
    "duckdb_schemas",
    "duckdb_tables",
    "duckdb_types",
    "duckdb_views",
    // SQLite system objects
    "sqlite_master",
    "sqlite_schema",
    "sqlite_temp_master",
    "sqlite_temp_schema",
    // Pragma objects
    "pragma_database_list",
    // Information schema objects
    "information_schema",
  ];

  // Check exact matches
  if (systemObjects.includes(name)) {
    return true;
  }

  // Check prefixes
  const systemPrefixes = [
    "sqlite_",
    "pragma_",
    "duckdb_",
    "information_schema",
    "pg_",
  ];

  if (systemPrefixes.some((prefix) => name.startsWith(prefix))) {
    return true;
  }

  return false;
}

/**
 * Discovers all tables AND views in the DuckDB instance
 */
export async function discoverAllTables(
  connection: duckdb.AsyncDuckDBConnection,
  knownTables: Map<string, string> = new Map()
): Promise<TableInfo[]> {
  try {
    // Step 1: Get objects from sqlite_master (with basic filtering)
    const masterQuery = `
      SELECT name, type
      FROM sqlite_master 
      WHERE type IN ('table', 'view')
      AND name NOT LIKE 'sqlite_%'
      AND name NOT LIKE 'duckdb_%'
      AND name NOT LIKE 'pragma_%'
      ORDER BY type, name
    `;

    let masterObjects: any[] = [];
    try {
      const masterResult = await connection.query(masterQuery);
      masterObjects = masterResult.toArray();
    } catch (masterErr) {
      console.warn("[Tables] sqlite_master query failed, trying fallback");
    }

    // Step 2: Get views from information_schema (catches file-based views)
    let schemaViews: any[] = [];
    try {
      const viewQuery = `
        SELECT table_name as name, 'view' as type
        FROM information_schema.views
        WHERE table_schema = 'main'
        AND table_name NOT LIKE 'sqlite_%'
        AND table_name NOT LIKE 'duckdb_%' 
        AND table_name NOT LIKE 'pragma_%'
      `;
      const viewResult = await connection.query(viewQuery);
      schemaViews = viewResult.toArray();
    } catch (viewErr) {
      // Fallback to information_schema for tables if needed
      try {
        const tableQuery = `
          SELECT table_name as name, 'table' as type
          FROM information_schema.tables 
          WHERE table_schema = 'main' 
          AND table_type = 'BASE TABLE'
          AND table_name NOT LIKE 'sqlite_%'
          AND table_name NOT LIKE 'duckdb_%'
        `;
        const tableResult = await connection.query(tableQuery);
        masterObjects = tableResult.toArray();
      } catch (tableErr) {
        console.warn(
          "[Tables] All discovery methods failed, using empty result"
        );
      }
    }

    // Step 3: Combine and deduplicate
    const allObjectsMap = new Map<
      string,
      { name: string; type: "table" | "view" }
    >();

    // Add from sqlite_master (highest priority) with filtering
    masterObjects.forEach((obj) => {
      if (!isSystemObject(obj.name)) {
        allObjectsMap.set(obj.name, { name: obj.name, type: obj.type });
      }
    });

    // Add views from information_schema (may find views not in sqlite_master) with filtering
    schemaViews.forEach((obj) => {
      if (!isSystemObject(obj.name) && !allObjectsMap.has(obj.name)) {
        allObjectsMap.set(obj.name, { name: obj.name, type: "view" });
      }
    });

    // Step 4: Process discovered objects
    const tableInfos: TableInfo[] = [];

    for (const obj of allObjectsMap.values()) {
      const objectName = obj.name;
      const objectType = obj.type;
      const escapedName = `"${objectName}"`;

      const isUserCreated =
        !knownTables.has(objectName) &&
        !isSystemObject(objectName) &&
        objectName !== "employees_sample";

      // Get row count - skip for views to avoid performance issues
      let rowCount: number | undefined;
      if (objectType === "table") {
        try {
          const countQuery = `SELECT COUNT(*) as count FROM ${escapedName}`;
          const countResult = await connection.query(countQuery);
          const countRow = countResult.toArray()[0];
          rowCount =
            typeof countRow.count === "bigint"
              ? Number(countRow.count)
              : countRow.count;
        } catch (countErr) {
          console.warn(
            `[Tables] Failed to get row count for table ${objectName}:`,
            countErr
          );
        }
      } else {
        // Skip row count for views (especially large file views)
        rowCount = undefined;
      }

      tableInfos.push({
        name: objectName,
        escapedName,
        isUserCreated,
        rowCount,
        type: objectType,
      });
    }


    const userTableInfos = tableInfos.filter((info) => info.isUserCreated);
    const systemTableInfos = tableInfos.filter((info) => !info.isUserCreated);

    console.log(`[Tables] Discovery complete:`, {
      total: tableInfos.length,
      userObjects: userTableInfos.length,
      systemObjects: systemTableInfos.length,
      tables: userTableInfos.filter((o) => o.type === "table").length,
      views: userTableInfos.filter((o) => o.type === "view").length,
      userTables: userTableInfos
        .filter((o) => o.type === "table")
        .map((o) => o.name),
      userViews: userTableInfos
        .filter((o) => o.type === "view")
        .map((o) => o.name),
    });

    return userTableInfos;
  } catch (err) {
    console.error("[Tables] Failed to discover tables:", err);
    throw new Error(
      `Failed to discover tables: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}

/**
 * Detects SQL commands that might create or modify tables/views
 */
export function detectTableModifyingSQL(sql: string): {
  isModifying: boolean;
  commands: string[];
  possibleTableNames: string[];
} {
  const normalizedSQL = sql.trim().toUpperCase();
  const commands: string[] = [];
  const possibleTableNames: string[] = [];

  const patterns = [
    {
      regex: /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(["`]?)(\w+)\1/gi,
      command: "CREATE TABLE",
    },
    {
      regex: /CREATE\s+VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?(["`]?)(\w+)\1/gi,
      command: "CREATE VIEW",
    },
    {
      regex:
        /CREATE\s+(?:TEMP|TEMPORARY)\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(["`]?)(\w+)\1/gi,
      command: "CREATE TEMP TABLE",
    },
    {
      regex: /ALTER\s+TABLE\s+(["`]?)(\w+)\1/gi,
      command: "ALTER TABLE",
    },
    {
      regex: /DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(["`]?)(\w+)\1/gi,
      command: "DROP TABLE",
    },
    {
      regex: /DROP\s+VIEW\s+(?:IF\s+EXISTS\s+)?(["`]?)(\w+)\1/gi,
      command: "DROP VIEW",
    },
    {
      regex: /INSERT\s+INTO\s+(["`]?)(\w+)\1/gi,
      command: "INSERT INTO",
    },
  ];

  let isModifying = false;

  for (const pattern of patterns) {
    let match;
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);

    while ((match = regex.exec(normalizedSQL)) !== null) {
      isModifying = true;
      commands.push(pattern.command);

      // Extract table name (group 2 in our regex patterns)
      if (match[2]) {
        possibleTableNames.push(match[2].toLowerCase());
      }
    }
  }

  return {
    isModifying,
    commands: [...new Set(commands)], // Remove duplicates
    possibleTableNames: [...new Set(possibleTableNames)], // Remove duplicates
  };
}

/**
 * Gets the schema for a specific table or view
 */
export async function getTableSchema(
  connection: duckdb.AsyncDuckDBConnection,
  tableName: string,
  escapedName?: string
): Promise<{ name: string; type: string }[]> {
  const tableRef = escapedName || `"${tableName}"`;

  try {
    // Try DESCRIBE first (works for both tables and views)
    let result;
    try {
      const describeQuery = `DESCRIBE ${tableRef}`;
      result = await connection.query(describeQuery);
    } catch (describeErr) {
      // Fallback to PRAGMA table_info (also works for views in DuckDB)
      const pragmaQuery = `PRAGMA table_info(${tableRef})`;
      result = await connection.query(pragmaQuery);
    }

    return result.toArray().map((col: any) => ({
      name: col.column_name || col.name || "",
      type: col.column_type || col.type || col.data_type || "",
    }));
  } catch (err) {
    console.error(`[Tables] Failed to get schema for ${tableName}:`, err);
    return [];
  }
}
