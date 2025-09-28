// Generate simple unique IDs without external dependencies
const generateId = () => {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

export interface TransformationMetadata {
  id: string;
  parentTable: string;
  childTable: string;
  version: number;
  prompt: string;
  sql: string;
  transformationType: 'filter' | 'clean' | 'transform' | 'aggregate' | 'derive' | 'custom';
  rowsAffected?: number;
  createdAt: Date;
  columnName?: string;
  columnType?: string;
}

export interface TableLineage {
  tableId: string;
  tableName: string;
  version: number;
  parent?: TableLineage;
  children: TableLineage[];
  transformation?: TransformationMetadata;
}

export class TransformationService {
  /**
   * Initialize the metadata table for tracking transformations
   */
  static async initializeMetadataTable(executeQuery: (sql: string) => Promise<any>): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS datakit_transformations (
        id TEXT PRIMARY KEY,
        parent_table TEXT NOT NULL,
        child_table TEXT NOT NULL,
        version INTEGER NOT NULL,
        prompt TEXT NOT NULL,
        sql TEXT NOT NULL,
        transformation_type TEXT NOT NULL,
        rows_affected INTEGER,
        column_name TEXT,
        column_type TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    await executeQuery(sql);
    
    // Create index for faster lookups
    await executeQuery(`
      CREATE INDEX IF NOT EXISTS idx_transformations_parent 
      ON datakit_transformations(parent_table);
    `);
  }

  /**
   * Generate a smart table name based on the transformation
   */
  static generateTableName(
    originalTable: string,
    version: number,
    prompt: string,
    timestamp?: Date
  ): string {
    // Clean the original table name (remove existing version suffixes)
    const baseTableName = originalTable.replace(/_v\d+.*$/, '');
    
    // Extract action from prompt (simplified - can be enhanced with NLP)
    const action = this.extractActionFromPrompt(prompt);
    
    // Format timestamp
    const ts = timestamp || new Date();
    const dateStr = ts.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = ts.toISOString().slice(11, 16).replace(/:/g, '');
    
    // Generate name: tablename_v2_action_20250120_1430
    return `${baseTableName}_v${version}_${action}_${dateStr}_${timeStr}`;
  }

  /**
   * Extract a short action keyword from the prompt
   */
  private static extractActionFromPrompt(prompt: string): string {
    const promptLower = prompt.toLowerCase();
    
    // Common transformation keywords
    const actions = [
      { keywords: ['remove null', 'delete null', 'drop null'], action: 'no_nulls' },
      { keywords: ['remove duplicate', 'deduplicate', 'unique'], action: 'deduped' },
      { keywords: ['uppercase', 'upper'], action: 'uppercase' },
      { keywords: ['lowercase', 'lower'], action: 'lowercase' },
      { keywords: ['clean', 'cleaned'], action: 'cleaned' },
      { keywords: ['normalize', 'normalized'], action: 'normalized' },
      { keywords: ['filter', 'filtered', 'where'], action: 'filtered' },
      { keywords: ['aggregate', 'group', 'sum', 'count'], action: 'aggregated' },
      { keywords: ['join', 'merge'], action: 'joined' },
      { keywords: ['pivot', 'unpivot'], action: 'pivoted' },
      { keywords: ['rename', 'renamed'], action: 'renamed' },
      { keywords: ['convert', 'cast', 'change type'], action: 'converted' },
      { keywords: ['extract', 'parse'], action: 'extracted' },
      { keywords: ['calculate', 'compute', 'derived'], action: 'calculated' },
      { keywords: ['bucket', 'bin', 'group'], action: 'bucketed' },
      { keywords: ['outlier', 'anomaly'], action: 'outliers' },
      { keywords: ['statistic', 'stats', 'analyze'], action: 'analyzed' },
    ];
    
    for (const { keywords, action } of actions) {
      if (keywords.some(keyword => promptLower.includes(keyword))) {
        return action;
      }
    }
    
    // Default fallback
    return 'transformed';
  }

  /**
   * Get the current version number for a table
   */
  static async getCurrentVersion(
    tableName: string,
    executeQuery: (sql: string) => Promise<any>
  ): Promise<number> {
    try {
      // Clean the table name to get base name
      const baseTableName = tableName.replace(/_v\d+.*$/, '');
      
      const result = await executeQuery(`
        SELECT COALESCE(MAX(version), 0) as max_version
        FROM datakit_transformations
        WHERE parent_table LIKE '${baseTableName}%'
           OR child_table LIKE '${baseTableName}%'
      `);
      
      const rows = result?.toArray?.() || [];
      return rows[0]?.max_version || 0;
    } catch (error) {
      console.log('No transformation history found, starting at version 0');
      return 0;
    }
  }

  /**
   * Record a transformation in the metadata table
   */
  static async recordTransformation(
    metadata: Omit<TransformationMetadata, 'id' | 'createdAt'>,
    executeQuery: (sql: string) => Promise<any>
  ): Promise<TransformationMetadata> {
    const id = generateId();
    const createdAt = new Date();
    
    const sql = `
      INSERT INTO datakit_transformations (
        id, parent_table, child_table, version, prompt, sql,
        transformation_type, rows_affected, column_name, column_type, created_at
      ) VALUES (
        '${id}',
        '${metadata.parentTable}',
        '${metadata.childTable}',
        ${metadata.version},
        '${metadata.prompt.replace(/'/g, "''")}',
        '${metadata.sql.replace(/'/g, "''")}',
        '${metadata.transformationType}',
        ${metadata.rowsAffected || 'NULL'},
        ${metadata.columnName ? `'${metadata.columnName}'` : 'NULL'},
        ${metadata.columnType ? `'${metadata.columnType}'` : 'NULL'},
        '${createdAt.toISOString()}'
      );
    `;
    
    await executeQuery(sql);
    
    return {
      id,
      ...metadata,
      createdAt
    };
  }

  /**
   * Get transformation history for a table
   */
  static async getTableHistory(
    tableName: string,
    executeQuery: (sql: string) => Promise<any>
  ): Promise<TransformationMetadata[]> {
    const baseTableName = tableName.replace(/_v\d+.*$/, '');
    
    const result = await executeQuery(`
      SELECT * FROM datakit_transformations
      WHERE parent_table LIKE '${baseTableName}%'
         OR child_table LIKE '${baseTableName}%'
      ORDER BY created_at DESC
    `);
    
    const rows = result?.toArray?.() || [];
    
    return rows.map(row => ({
      id: row.id,
      parentTable: row.parent_table,
      childTable: row.child_table,
      version: row.version,
      prompt: row.prompt,
      sql: row.sql,
      transformationType: row.transformation_type,
      rowsAffected: row.rows_affected,
      columnName: row.column_name,
      columnType: row.column_type,
      createdAt: new Date(row.created_at)
    }));
  }

  /**
   * Build the lineage tree for a table
   */
  static async buildLineageTree(
    tableName: string,
    executeQuery: (sql: string) => Promise<any>
  ): Promise<TableLineage | null> {
    const history = await this.getTableHistory(tableName, executeQuery);
    
    if (history.length === 0) {
      return {
        tableId: tableName,
        tableName,
        version: 0,
        children: []
      };
    }
    
    // Build a map of all tables
    const tableMap = new Map<string, TableLineage>();
    
    // Create nodes for all tables
    history.forEach(t => {
      if (!tableMap.has(t.parentTable)) {
        tableMap.set(t.parentTable, {
          tableId: t.parentTable,
          tableName: t.parentTable,
          version: t.version - 1,
          children: []
        });
      }
      
      if (!tableMap.has(t.childTable)) {
        tableMap.set(t.childTable, {
          tableId: t.childTable,
          tableName: t.childTable,
          version: t.version,
          children: [],
          transformation: t
        });
      }
    });
    
    // Build relationships
    history.forEach(t => {
      const parent = tableMap.get(t.parentTable);
      const child = tableMap.get(t.childTable);
      
      if (parent && child) {
        child.parent = parent;
        parent.children.push(child);
      }
    });
    
    // Find root (table with no parent)
    const root = Array.from(tableMap.values()).find(t => !t.parent);
    return root || null;
  }

  /**
   * Get the latest version of a table family
   */
  static async getLatestVersion(
    baseTableName: string,
    executeQuery: (sql: string) => Promise<any>
  ): Promise<string | null> {
    const cleanBaseName = baseTableName.replace(/_v\d+.*$/, '');
    
    const result = await executeQuery(`
      SELECT child_table, version
      FROM datakit_transformations
      WHERE parent_table LIKE '${cleanBaseName}%'
         OR child_table LIKE '${cleanBaseName}%'
      ORDER BY version DESC, created_at DESC
      LIMIT 1
    `);
    
    const rows = result?.toArray?.() || [];
    return rows[0]?.child_table || baseTableName;
  }

  /**
   * Determine transformation type from SQL
   */
  static inferTransformationType(sql: string, prompt: string): TransformationMetadata['transformationType'] {
    const sqlLower = sql.toLowerCase();
    const promptLower = prompt.toLowerCase();
    
    if (sqlLower.includes('where') && !sqlLower.includes('group by')) {
      return 'filter';
    }
    if (sqlLower.includes('group by') || promptLower.includes('aggregate')) {
      return 'aggregate';
    }
    if (promptLower.includes('clean') || promptLower.includes('remove') || promptLower.includes('delete')) {
      return 'clean';
    }
    if (promptLower.includes('calculate') || promptLower.includes('derive')) {
      return 'derive';
    }
    if (sqlLower.includes('upper') || sqlLower.includes('lower') || sqlLower.includes('trim')) {
      return 'transform';
    }
    
    return 'custom';
  }
}

export const transformationService = new TransformationService();