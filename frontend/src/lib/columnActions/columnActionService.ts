import { aiService } from '@/lib/ai/aiService';
import { 
  ColumnAction, 
  ColumnActionRequest, 
  ColumnActionResult, 
  ColumnActionPreview,
  TransformStrategy 
} from '@/types/columnActions';
import { TransformationService } from '@/lib/duckdb/transformations';

export class ColumnActionService {
  
  /**
   * Generate SQL for a column action using AI or templates
   */
  async generateSQL(
    request: ColumnActionRequest,
    executeQuery?: (sql: string) => Promise<any>
  ): Promise<ColumnActionResult> {
    const { action, columnName, columnType, tableName, customPrompt, parameters } = request;
    
    let sql: string;
    let strategy: TransformStrategy = 'new-table'; // Always create new tables
    let newTableName: string | undefined;

    // Get current version if we have query executor
    let version = 1;
    if (executeQuery) {
      try {
        await TransformationService.initializeMetadataTable(executeQuery);
        version = await TransformationService.getCurrentVersion(tableName, executeQuery) + 1;
      } catch (error) {
        console.log('Could not get version, defaulting to 1');
      }
    }

    // Generate new table name
    const promptText = customPrompt || action.label;
    newTableName = TransformationService.generateTableName(
      tableName,
      version,
      promptText
    );

    // Use SQL template if available (simple operations)
    if (action.sqlTemplate && !customPrompt) {
      sql = this.interpolateTemplate(action.sqlTemplate, {
        columnName,
        tableName,
        columnType,
        ...parameters
      });
      // Convert to CREATE TABLE AS SELECT
      sql = this.convertToCreateTable(sql, tableName, newTableName);
    } 
    // Use AI to generate SQL
    else if (action.aiPromptTemplate || customPrompt) {
      const basePrompt = action.aiPromptTemplate || 
        'Generate SQL for DuckDB to work with column {columnName} of type {columnType} in table {tableName}. User request: {customPrompt}';
      
      // Include all columns info if available
      const allColumnsInfo = parameters.schema ? `\nEXACT TABLE SCHEMA WITH TYPES:\n${parameters.schema}` : '';
      const allColumnsNames = parameters.allColumns ? `\nColumn names only: ${parameters.allColumns}` : '';
      
      const enhancedPrompt = `${basePrompt}
        ${allColumnsInfo}
        ${allColumnsNames}
        
        CRITICAL REQUIREMENTS FOR DUCKDB:
        1. Generate a CREATE TABLE statement that creates a new table named "${newTableName}" based on the original table "${tableName}".
        
        2. The new table MUST include ALL columns from the original table with their EXACT TYPES as shown in the schema above.
        
        3. IMPORTANT: Explicitly list ALL columns in the SELECT statement. Do NOT use SELECT * as it may not preserve the transformation.
        
        4. For NON-TRANSFORMED columns: Select them AS-IS without any functions to preserve their original types.
           Example: If 'date_column' is type DATE, select it as just 'date_column', not CAST(date_column AS VARCHAR)
        
        5. For the TRANSFORMED column "${columnName}" only: Apply the requested transformation.
           - String to Number: TRY_CAST(${columnName} AS INTEGER/DECIMAL/DOUBLE)
           - Number to String: CAST(${columnName} AS VARCHAR)
           - Date operations: Use proper date functions
           - Text operations: UPPER(), LOWER(), TRIM(), etc.
        
        6. The SQL format MUST be: 
           CREATE TABLE ${newTableName} AS 
           SELECT 
             column1,  -- Keep original type
             column2,  -- Keep original type  
             TRANSFORMATION(${columnName}) as ${columnName},  -- Only transform this one
             column4,  -- Keep original type
             ...
           FROM ${tableName}
        
        7. Use TRY_CAST instead of CAST for type conversions that might fail (returns NULL instead of error)
        
        8. CRITICAL: Look at the schema above. Each column has a type like:
           ${allColumnsInfo ? 'The columns and their types are listed above.' : 'column_name (TYPE)'}
           You MUST preserve these exact types for all columns except the one being transformed.
        
        EXAMPLES with proper type preservation:
        - If schema is: id (INTEGER), name (VARCHAR), price (VARCHAR), created_at (DATE)
          And transforming price to number:
          CREATE TABLE new_table AS 
          SELECT 
            id,  -- stays INTEGER
            name,  -- stays VARCHAR
            TRY_CAST(price AS DECIMAL) as price,  -- transform VARCHAR to DECIMAL
            created_at  -- stays DATE
          FROM original_table
        
        - If schema is: id (INTEGER), email (VARCHAR), amount (DECIMAL), updated_at (TIMESTAMP)
          And making email uppercase:
          CREATE TABLE new_table AS 
          SELECT 
            id,  -- stays INTEGER
            UPPER(email) as email,  -- transform but stays VARCHAR
            amount,  -- stays DECIMAL
            updated_at  -- stays TIMESTAMP
          FROM original_table
        
        NEVER: Use functions on columns that aren't being transformed
        NEVER: Change the type of columns that aren't being transformed
        NEVER: Omit any columns from the original table`;

      const prompt = this.interpolateTemplate(enhancedPrompt, {
        columnName,
        tableName,
        columnType,
        customPrompt: customPrompt || '',
        ...parameters
      });

      try {
        // Always use 'datakit' provider for column actions (requires authentication)
        const provider = 'datakit';
        
        // Import DataKitProvider
        const { DataKitProvider } = await import('@/lib/ai/providers/datakit');
        
        // Initialize DataKit provider with the correct model (datakit-smart uses Claude 3.5 Sonnet backend)
        const datakitProvider = new DataKitProvider('datakit-smart');
        aiService.setProvider('datakit', datakitProvider);
        
        // Ensure the datakit provider is initialized and model is set
        const aiStore = (await import('@/store/aiStore')).useAIStore.getState();
        
        // Set the active provider and model if not already set
        if (aiStore.activeProvider !== 'datakit') {
          aiStore.setActiveProvider('datakit');
          aiStore.setActiveModel('datakit-smart');
        }
        
        // The datakit provider will automatically handle authentication
        // If user is not authenticated, the API will return 401
        
        // Use the AI service to generate SQL
        const aiResult = await aiService.generateSQL(provider, prompt, {
          tableName: tableName,
          schema: [], // Will be populated by the AI service  
          sampleData: [],
          rowCount: 0,
          description: `Table containing column ${columnName} of type ${columnType}`,
          tables: [{
            name: tableName,
            schema: [],
            description: `Table containing column ${columnName} of type ${columnType}`
          }]
        });

        sql = aiResult.sql;
        
        // Ensure the SQL uses the correct new table name
        if (!sql.toLowerCase().includes(newTableName.toLowerCase())) {
          sql = this.ensureCorrectTableName(sql, newTableName);
        }
        
        // Make type conversions safer
        sql = this.ensureTypeSafety(sql);
      } catch (error) {
        console.error('AI SQL generation failed:', error);
        throw new Error(`Failed to generate SQL: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      throw new Error('No SQL template or AI prompt available for this action');
    }

    // Strategy is always 'new-table' now
    strategy = 'new-table';

    // Generate preview query if needed
    let preview: ColumnActionResult['preview'];
    if (action.showPreview && action.previewQuery) {
      const previewQuery = this.interpolateTemplate(action.previewQuery, {
        columnName,
        tableName,
        columnType
      });
      preview = {
        query: previewQuery,
        description: this.generatePreviewDescription(action, columnName)
      };
    }

    return {
      sql,
      strategy,
      preview,
      newTableName
    };
  }

  /**
   * Generate preview data for confirmation dialogs
   */
  async generatePreview(
    previewQuery: string,
    executeQuery: (sql: string) => Promise<any>
  ): Promise<ColumnActionPreview> {
    try {
      const result = await executeQuery(previewQuery);
      const rows = result?.toArray() || [];
      
      // Extract affected rows count
      let affectedRows = 0;
      if (rows.length > 0) {
        const firstRow = rows[0];
        affectedRows = firstRow.rows_to_delete || 
                      firstRow.affected_rows || 
                      firstRow.count || 
                      rows.length;
      }

      return {
        affectedRows,
        sampleChanges: [], // Would need specific implementation per action type
        isReversible: false, // Most operations are not easily reversible
        warningMessage: affectedRows > 1000 
          ? `This will affect ${affectedRows.toLocaleString()} rows. This operation cannot be undone.`
          : undefined
      };
    } catch (error) {
      console.error('Preview generation failed:', error);
      return {
        affectedRows: 0,
        sampleChanges: [],
        isReversible: false,
        warningMessage: 'Could not generate preview. Proceed with caution.'
      };
    }
  }

  /**
   * Execute a column action with appropriate strategy
   */
  async executeAction(
    result: ColumnActionResult,
    executeQuery: (sql: string) => Promise<any>,
    onProgress?: (message: string) => void,
    metadata?: {
      prompt: string;
      columnName?: string;
      columnType?: string;
      parentTable: string;
    }
  ): Promise<{ success: boolean; message: string; newTableName?: string }> {
    try {
      onProgress?.(`Creating new table with transformation...`);
      
      // Execute the SQL
      await executeQuery(result.sql);
      
      // If we have a new table, record the transformation
      if (result.newTableName && metadata) {
        try {
          // Get row count of new table
          const countResult = await executeQuery(`SELECT COUNT(*) as cnt FROM ${result.newTableName}`);
          const rowCount = countResult?.toArray?.()?.[0]?.cnt || 0;
          
          // Record in metadata
          await TransformationService.recordTransformation({
            parentTable: metadata.parentTable,
            childTable: result.newTableName,
            version: parseInt(result.newTableName.match(/_v(\d+)_/)?.[1] || '1'),
            prompt: metadata.prompt,
            sql: result.sql,
            transformationType: TransformationService.inferTransformationType(result.sql, metadata.prompt),
            rowsAffected: rowCount,
            columnName: metadata.columnName,
            columnType: metadata.columnType
          }, executeQuery);
          
          onProgress?.(`Transformation recorded in history`);
        } catch (error) {
          console.error('Failed to record transformation metadata:', error);
          // Continue even if metadata recording fails
        }
      }
      
      return { 
        success: true, 
        message: result.newTableName 
          ? `Created new table "${result.newTableName}" with transformation`
          : 'Transformation completed successfully',
        newTableName: result.newTableName
      };
    } catch (error) {
      console.error('Action execution failed:', error);
      return {
        success: false,
        message: `Failed to execute action: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Interpolate template variables in SQL or prompts
   */
  private interpolateTemplate(template: string, variables: Record<string, string>): string {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      return variables[key] || match;
    });
  }

  /**
   * Infer transformation strategy from generated SQL
   */
  private inferStrategyFromSQL(sql: string): TransformStrategy {
    const normalizedSQL = sql.trim().toUpperCase();
    
    if (normalizedSQL.startsWith('SELECT')) {
      return 'direct';
    } else if (normalizedSQL.startsWith('CREATE VIEW')) {
      return 'view';
    } else if (normalizedSQL.startsWith('CREATE TABLE')) {
      return 'new-table';
    } else if (normalizedSQL.match(/^(UPDATE|DELETE|ALTER)/)) {
      return 'in-place-confirm';
    }
    
    return 'direct'; // Default fallback
  }

  /**
   * Generate a new table name for derived tables
   */
  private generateNewTableName(originalTable: string, actionId: string, columnName: string): string {
    const timestamp = Date.now().toString(36);
    const cleanActionId = actionId.replace(/[^a-zA-Z0-9]/g, '_');
    const cleanColumnName = columnName.replace(/[^a-zA-Z0-9]/g, '_');
    
    return `${originalTable}_${cleanActionId}_${cleanColumnName}_${timestamp}`;
  }

  /**
   * Generate human-readable preview description
   */
  private generatePreviewDescription(action: ColumnAction, columnName: string): string {
    switch (action.id) {
      case 'remove-nulls':
        return `Rows that will be included where ${columnName} is not null`;
      case 'remove-duplicates':
        return `Unique rows that will be kept based on ${columnName}`;
      case 'fill-nulls':
        return `Rows with ${columnName} filled`;
      case 'uppercase':
        return `Values in ${columnName} converted to uppercase`;
      case 'trim-spaces':
        return `Values in ${columnName} with whitespace trimmed`;
      default:
        return `Preview of transformation on ${columnName}`;
    }
  }

  /**
   * Convert UPDATE/DELETE/ALTER statements to CREATE TABLE AS SELECT
   */
  private convertToCreateTable(sql: string, originalTable: string, newTable: string): string {
    const sqlLower = sql.toLowerCase();
    
    // Handle DELETE statements
    if (sqlLower.startsWith('delete from')) {
      // Convert DELETE to SELECT with WHERE NOT
      const whereClause = sql.match(/WHERE\s+(.+)$/i)?.[1] || '';
      return `CREATE TABLE ${newTable} AS SELECT * FROM ${originalTable} WHERE NOT (${whereClause})`;
    }
    
    // Handle UPDATE statements
    if (sqlLower.startsWith('update')) {
      // Extract the SET clause
      const setMatch = sql.match(/SET\s+(.+?)(?:WHERE|$)/i);
      if (setMatch) {
        const setClause = setMatch[1];
        const whereMatch = sql.match(/WHERE\s+(.+)$/i);
        const whereClause = whereMatch ? `WHERE ${whereMatch[1]}` : '';
        
        // Parse the SET clause to build CASE statements
        const columnUpdates = setClause.split(',').map(update => {
          const [col, val] = update.split('=').map(s => s.trim());
          return `CASE WHEN ${whereClause || 'TRUE'} THEN ${val} ELSE ${col} END as ${col}`;
        });
        
        return `CREATE TABLE ${newTable} AS SELECT *, ${columnUpdates.join(', ')} FROM ${originalTable}`;
      }
    }
    
    // Handle ALTER statements
    if (sqlLower.startsWith('alter table')) {
      // For column type changes, cast in SELECT
      return `CREATE TABLE ${newTable} AS SELECT * FROM ${originalTable}`;
    }
    
    // Handle SELECT statements
    if (sqlLower.startsWith('select')) {
      return `CREATE TABLE ${newTable} AS ${sql}`;
    }
    
    // Handle CREATE VIEW statements
    if (sqlLower.startsWith('create view')) {
      return sql.replace(/CREATE\s+VIEW\s+\S+/i, `CREATE TABLE ${newTable}`);
    }
    
    // If already CREATE TABLE, ensure it has the right name
    if (sqlLower.startsWith('create table')) {
      return sql.replace(/CREATE\s+TABLE\s+\S+/i, `CREATE TABLE ${newTable}`);
    }
    
    // Default: wrap in CREATE TABLE AS SELECT
    return `CREATE TABLE ${newTable} AS ${sql}`;
  }

  /**
   * Ensure the SQL uses the correct new table name
   */
  private ensureCorrectTableName(sql: string, newTableName: string): string {
    // Replace any CREATE TABLE <name> with our new table name
    return sql.replace(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(["`]?)(\w+)\1/gi, 
      `CREATE TABLE ${newTableName}`);
  }
  
  /**
   * Post-process SQL to ensure type safety for conversions
   */
  private ensureTypeSafety(sql: string): string {
    // Replace unsafe CAST with TRY_CAST for type conversions that might fail
    // This prevents errors when converting incompatible types
    let safeSql = sql;
    
    // Replace CAST with TRY_CAST for common conversions that might fail
    safeSql = safeSql.replace(/\bCAST\s*\(\s*(\w+)\s+AS\s+(INTEGER|INT|BIGINT|DECIMAL|DOUBLE|FLOAT|NUMERIC)\s*\)/gi, 
      'TRY_CAST($1 AS $2)');
    
    return safeSql;
  }
}

export const columnActionService = new ColumnActionService();