import * as duckdb from "@duckdb/duckdb-wasm";

export interface TableInfo {
  name: string;
  escapedName: string;
  isUserCreated: boolean;
  rowCount?: number;
}

/**
 * Discovers all tables in the DuckDB instance
 */
export async function discoverAllTables(
  connection: duckdb.AsyncDuckDBConnection,
  knownTables: Map<string, string> = new Map()
): Promise<TableInfo[]> {
  try {
    // Query to get all tables from the database
    // Using information_schema or sqlite_master depending on what's available
    const tablesQuery = `
      SELECT table_name as name 
      FROM information_schema.tables 
      WHERE table_schema = 'main' 
      AND table_type = 'BASE TABLE'
    `;
    
    let result;
    try {
      result = await connection.query(tablesQuery);
    } catch (err) {
      // Fallback to sqlite_master if information_schema doesn't work
      const fallbackQuery = `
        SELECT name 
        FROM sqlite_master 
        WHERE type = 'table' 
        AND name NOT LIKE 'sqlite_%'
      `;
      result = await connection.query(fallbackQuery);
    }

    const tables = result.toArray();
    const tableInfos: TableInfo[] = [];

    for (const table of tables) {
      const tableName = table.name;
      const escapedName = `"${tableName}"`;
      const isUserCreated = !knownTables.has(tableName);

      // Get row count for the table
      let rowCount: number | undefined;
      try {
        const countQuery = `SELECT COUNT(*) as count FROM ${escapedName}`;
        const countResult = await connection.query(countQuery);
        const countRow = countResult.toArray()[0];
        rowCount = typeof countRow.count === 'bigint' ? Number(countRow.count) : countRow.count;
      } catch (countErr) {
        console.warn(`[DuckDB Tables] Failed to get row count for ${tableName}:`, countErr);
      }

      tableInfos.push({
        name: tableName,
        escapedName,
        isUserCreated,
        rowCount,
      });
    }

    return tableInfos;
  } catch (err) {
    console.error('[DuckDB Tables] Failed to discover tables:', err);
    throw new Error(`Failed to discover tables: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Detects SQL commands that might create or modify tables
 */
export function detectTableModifyingSQL(sql: string): {
  isModifying: boolean;
  commands: string[];
  possibleTableNames: string[];
} {
  const normalizedSQL = sql.trim().toUpperCase();
  const commands: string[] = [];
  const possibleTableNames: string[] = [];
  
  // Patterns for table-modifying commands
  const patterns = [
    {
      regex: /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(["`]?)(\w+)\1/gi,
      command: 'CREATE TABLE'
    },
    {
      regex: /CREATE\s+(?:TEMP|TEMPORARY)\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(["`]?)(\w+)\1/gi,
      command: 'CREATE TEMP TABLE'
    },
    {
      regex: /ALTER\s+TABLE\s+(["`]?)(\w+)\1/gi,
      command: 'ALTER TABLE'
    },
    {
      regex: /DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(["`]?)(\w+)\1/gi,
      command: 'DROP TABLE'
    },
    {
      regex: /INSERT\s+INTO\s+(["`]?)(\w+)\1/gi,
      command: 'INSERT INTO'
    }
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
    possibleTableNames: [...new Set(possibleTableNames)] // Remove duplicates
  };
}

/**
 * Gets the schema for a specific table
 */
export async function getTableSchema(
  connection: duckdb.AsyncDuckDBConnection,
  tableName: string,
  escapedName?: string
): Promise<{ name: string; type: string }[]> {
  const tableRef = escapedName || `"${tableName}"`;
  
  try {
    const schemaQuery = `PRAGMA table_info(${tableRef})`;
    const result = await connection.query(schemaQuery);
    
    return result.toArray().map((col: any) => ({
      name: col.name || col.column_name || '',
      type: col.type || col.column_type || col.data_type || ''
    }));
  } catch (err) {
    console.error(`[DuckDB Tables] Failed to get schema for ${tableName}:`, err);
    return [];
  }
}