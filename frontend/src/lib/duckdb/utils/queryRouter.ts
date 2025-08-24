/**
 * Query Router Utility
 * 
 * Analyzes SQL queries to determine the appropriate execution target:
 * - PostgreSQL: Remote PostgreSQL connections
 * - MotherDuck: Cloud DuckDB databases  
 * - Local: Local DuckDB tables
 */

export interface TableReference {
  schema?: string;
  table: string;
  database?: string;
  isQuoted: boolean;
}

export interface QueryRouterResult {
  target: 'postgresql' | 'motherduck' | 'local' | 'hybrid';
  confidence: number; // 0-1, how confident we are in the routing decision
  tableReferences: TableReference[];
  postgresqlTables: TableReference[];
  motherduckTables: TableReference[];
  localTables: TableReference[];
  connectionId?: string; // For PostgreSQL routing
  reasoning: string; // Human-readable explanation of the routing decision
}

export interface PostgreSQLVirtualTable {
  connectionId: string;
  schemaName: string;
  tableName: string;
}

export class QueryRouter {
  private postgresVirtualTables: Map<string, PostgreSQLVirtualTable>;
  private postgresActiveConnections: Set<string>;
  private motherduckDatabases: Set<string>;

  constructor(
    postgresVirtualTables: Map<string, PostgreSQLVirtualTable> = new Map(),
    postgresActiveConnections: Set<string> = new Set(),
    motherduckDatabases: Set<string> = new Set()
  ) {
    this.postgresVirtualTables = postgresVirtualTables;
    this.postgresActiveConnections = postgresActiveConnections;
    this.motherduckDatabases = motherduckDatabases;
  }

  /**
   * Analyze a SQL query and determine the best execution target
   */
  analyzeQuery(sql: string): QueryRouterResult {
    const tableReferences = this.extractTableReferences(sql);
    
    // Categorize table references
    const postgresqlTables: TableReference[] = [];
    const motherduckTables: TableReference[] = [];
    const localTables: TableReference[] = [];
    
    let postgresConnectionId: string | undefined;

    for (const ref of tableReferences) {
      const classification = this.classifyTable(ref);
      
      if (classification.type === 'postgresql') {
        postgresqlTables.push(ref);
        if (!postgresConnectionId) {
          postgresConnectionId = classification.connectionId;
        }
      } else if (classification.type === 'motherduck') {
        motherduckTables.push(ref);
      } else {
        localTables.push(ref);
      }
    }

    // Determine routing target and confidence
    const result = this.determineTarget(
      postgresqlTables,
      motherduckTables,
      localTables,
      postgresConnectionId
    );

    return {
      ...result,
      tableReferences,
      postgresqlTables,
      motherduckTables,
      localTables,
      connectionId: postgresConnectionId,
    };
  }

  /**
   * Extract all table references from a SQL query
   */
  private extractTableReferences(sql: string): TableReference[] {
    const references: TableReference[] = [];
    const seen = new Set<string>();
    
    // More specific patterns ordered by complexity (most specific first)
    const patterns = [
      // Three-part: "database"."schema"."table" or database.schema.table
      {
        pattern: /(?:FROM|JOIN|UPDATE|INSERT\s+INTO)\s+(?:[\w\s]*\s+)?(?:["']([^"']+)["']|([a-zA-Z_][a-zA-Z0-9_]*))\.(?:["']([^"']+)["']|([a-zA-Z_][a-zA-Z0-9_]*))\.(?:["']([^"']+)["']|([a-zA-Z_][a-zA-Z0-9_]*))/gi,
        type: 'three-part'
      },
      
      // Two-part: "schema"."table" or schema.table
      {
        pattern: /(?:FROM|JOIN|UPDATE|INSERT\s+INTO)\s+(?:[\w\s]*\s+)?(?:["']([^"']+)["']|([a-zA-Z_][a-zA-Z0-9_]*))\.(?:["']([^"']+)["']|([a-zA-Z_][a-zA-Z0-9_]*))/gi,
        type: 'two-part'
      },
      
      // Single table: "table" or table (only if no schema.table patterns found)
      {
        pattern: /(?:FROM|JOIN|UPDATE|INSERT\s+INTO)\s+(?:[\w\s]*\s+)?(?:["']([^"']+)["']|([a-zA-Z_][a-zA-Z0-9_]*))/gi,
        type: 'single'
      }
    ];

    // Process patterns in order, skipping single table pattern if we found schema.table patterns
    let foundSchemaTable = false;

    for (const { pattern, type } of patterns) {
      // Skip single table pattern if we already found schema.table references
      if (type === 'single' && foundSchemaTable) {
        continue;
      }

      pattern.lastIndex = 0; // Reset regex
      let match;
      
      while ((match = pattern.exec(sql)) !== null) {
        let ref: TableReference | null = null;
        let refKey: string = '';

        if (type === 'three-part') {
          const database = match[1] || match[2];
          const schema = match[3] || match[4];
          const table = match[5] || match[6];
          
          if (database && schema && table) {
            ref = {
              database,
              schema,
              table,
              isQuoted: !!(match[1] || match[3] || match[5]),
            };
            refKey = `${database}.${schema}.${table}`;
            foundSchemaTable = true;
          }
        } else if (type === 'two-part') {
          const schema = match[1] || match[2];
          const table = match[3] || match[4];
          
          if (schema && table) {
            ref = {
              schema,
              table,
              isQuoted: !!(match[1] || match[3]),
            };
            refKey = `${schema}.${table}`;
            foundSchemaTable = true;
          }
        } else if (type === 'single') {
          const table = match[1] || match[2];
          
          if (table) {
            ref = {
              table,
              isQuoted: !!match[1],
            };
            refKey = table;
          }
        }

        // Add unique references only
        if (ref && !seen.has(refKey)) {
          seen.add(refKey);
          references.push(ref);
        }
      }
    }

    console.log(`[QueryRouter] Extracted table references:`, {
      sql: sql.substring(0, 100) + '...',
      references,
      foundSchemaTable
    });

    return references;
  }

  /**
   * Classify a table reference as PostgreSQL, MotherDuck, or Local
   */
  private classifyTable(ref: TableReference): { type: 'postgresql' | 'motherduck' | 'local'; connectionId?: string } {
    console.log(`[QueryRouter] Classifying table:`, ref);
    
    // Check if this matches a PostgreSQL virtual table
    for (const [tableKey, table] of this.postgresVirtualTables) {
      const schemaMatch = ref.schema === table.schemaName || (!ref.schema && table.schemaName === 'public');
      const tableMatch = ref.table === table.tableName;
      
      console.log(`[QueryRouter] Checking against PostgreSQL table:`, {
        virtualTable: table,
        schemaMatch,
        tableMatch,
        refSchema: ref.schema,
        refTable: ref.table
      });
      
      if (schemaMatch && tableMatch) {
        console.log(`[QueryRouter] Found PostgreSQL match:`, table.connectionId);
        return { type: 'postgresql', connectionId: table.connectionId };
      }
    }

    // Check if this is a MotherDuck database reference
    if (ref.database && this.motherduckDatabases.has(ref.database)) {
      console.log(`[QueryRouter] Found MotherDuck match:`, ref.database);
      return { type: 'motherduck' };
    }

    // Special MotherDuck database patterns
    if (ref.database && (
      ref.database.includes('my_db') || 
      ref.database.includes('sample_data') ||
      ref.database.startsWith('md:')
    )) {
      console.log(`[QueryRouter] Found MotherDuck pattern match:`, ref.database);
      return { type: 'motherduck' };
    }

    // Default to local
    console.log(`[QueryRouter] Defaulting to local for:`, ref);
    return { type: 'local' };
  }

  /**
   * Determine the final routing target based on classified tables
   */
  private determineTarget(
    postgresqlTables: TableReference[],
    motherduckTables: TableReference[],
    localTables: TableReference[],
    connectionId?: string
  ): Pick<QueryRouterResult, 'target' | 'confidence' | 'reasoning'> {
    const pgCount = postgresqlTables.length;
    const mdCount = motherduckTables.length;
    const localCount = localTables.length;
    const totalCount = pgCount + mdCount + localCount;

    // No tables found
    if (totalCount === 0) {
      return {
        target: 'local',
        confidence: 0.5,
        reasoning: 'No table references found, defaulting to local execution'
      };
    }

    // Pure PostgreSQL query
    if (pgCount > 0 && mdCount === 0 && localCount === 0) {
      const confidence = connectionId && this.postgresActiveConnections.has(connectionId) ? 0.95 : 0.7;
      return {
        target: 'postgresql',
        confidence,
        reasoning: `All ${pgCount} table(s) reference PostgreSQL. Connection: ${connectionId ? 'active' : 'not found'}`
      };
    }

    // Pure MotherDuck query
    if (mdCount > 0 && pgCount === 0 && localCount === 0) {
      return {
        target: 'motherduck',
        confidence: 0.9,
        reasoning: `All ${mdCount} table(s) reference MotherDuck databases`
      };
    }

    // Pure local query
    if (localCount > 0 && pgCount === 0 && mdCount === 0) {
      return {
        target: 'local',
        confidence: 0.8,
        reasoning: `All ${localCount} table(s) appear to be local DuckDB tables`
      };
    }

    // Hybrid query - not supported yet
    const components = [];
    if (pgCount > 0) components.push(`${pgCount} PostgreSQL`);
    if (mdCount > 0) components.push(`${mdCount} MotherDuck`);
    if (localCount > 0) components.push(`${localCount} local`);

    return {
      target: 'hybrid',
      confidence: 1.0,
      reasoning: `Cross-database query detected: ${components.join(', ')} tables`
    };
  }

  /**
   * Update the PostgreSQL virtual tables registry
   */
  updatePostgreSQLState(
    virtualTables: Map<string, PostgreSQLVirtualTable>,
    activeConnections: Set<string>
  ) {
    this.postgresVirtualTables = virtualTables;
    this.postgresActiveConnections = activeConnections;
  }

  /**
   * Update the MotherDuck databases registry
   */
  updateMotherDuckState(databases: Set<string>) {
    this.motherduckDatabases = databases;
  }
}

/**
 * Default singleton instance
 */
export const queryRouter = new QueryRouter();

/**
 * Convenience function for quick query analysis
 */
export function analyzeQuery(
  sql: string,
  postgresVirtualTables?: Map<string, PostgreSQLVirtualTable>,
  postgresActiveConnections?: Set<string>,
  motherduckDatabases?: Set<string>
): QueryRouterResult {
  const router = new QueryRouter(
    postgresVirtualTables,
    postgresActiveConnections,
    motherduckDatabases
  );
  return router.analyzeQuery(sql);
}