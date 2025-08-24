import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import * as duckdb from 'duckdb';

import { PostgresConnection } from './entities/postgres-connection.entity';
import { DatabaseConnectionUtil } from './utils/database.util';
import { SecurityUtil } from './utils/security.util';
import { MemoryCache, CacheKeyUtil } from './utils/cache.util';
import {
  CreatePostgresConnectionDto,
  UpdatePostgresConnectionDto,
  TestConnectionDto,
} from './dto/connection.dto';
import {
  ExecuteQueryDto,
  QueryResultDto,
  QueryErrorDto,
} from './dto/query.dto';
import {
  SchemaInfoDto,
  TableInfoDto,
  ColumnInfoDto,
  GetSchemaTablesDto,
  IndexInfoDto,
  ForeignKeyInfoDto,
} from './dto/schema.dto';

@Injectable()
export class PostgresProxyService {
  private readonly logger = new Logger(PostgresProxyService.name);
  private readonly encryptionKey: string;
  private readonly duckdbInstances = new Map<string, duckdb.Database>();
  private readonly attachmentCache = new Map<string, boolean>();

  // Enhanced caching using utility classes
  private readonly schemaCache = new MemoryCache<SchemaInfoDto[]>({
    ttl: 5 * 60 * 1000,
  });
  private readonly tableCache = new MemoryCache<TableInfoDto[]>({
    ttl: 5 * 60 * 1000,
  });
  private readonly tableSchemaCache = new MemoryCache<TableInfoDto>({
    ttl: 5 * 60 * 1000,
  });

  constructor(
    @InjectRepository(PostgresConnection)
    private readonly connectionRepository: Repository<PostgresConnection>,
  ) {
    // Use environment variable for encryption key in production
    this.encryptionKey =
      process.env.POSTGRES_ENCRYPTION_KEY ||
      'default-dev-key-change-in-production';

    // Validate encryption key on startup
    const keyValidation = SecurityUtil.validateEncryptionKey(
      this.encryptionKey,
    );
    if (!keyValidation.isValid) {
      this.logger.warn(
        `Encryption key validation issues: ${keyValidation.issues.join(', ')}`,
      );
    }
  }

  // =====================================
  // ENCRYPTION/DECRYPTION UTILITIES
  // =====================================

  private encrypt(text: string): string {
    return SecurityUtil.encryptPassword(text, this.encryptionKey);
  }

  private decrypt(encryptedText: string): string {
    return SecurityUtil.decryptPassword(encryptedText, this.encryptionKey);
  }

  // =====================================
  // DUCKDB CONNECTION MANAGEMENT
  // =====================================

  private async getDuckDBInstance(
    connectionId: string,
  ): Promise<duckdb.Database> {
    if (this.duckdbInstances.has(connectionId)) {
      return this.duckdbInstances.get(connectionId)!;
    }

    try {
      const db = await DatabaseConnectionUtil.createDuckDBInstance({
        connectionId,
        enableLogging: true,
        memoryLimit: process.env.DUCKDB_MEMORY_LIMIT,
        threads: process.env.DUCKDB_THREADS
          ? parseInt(process.env.DUCKDB_THREADS)
          : undefined,
      });

      this.duckdbInstances.set(connectionId, db);
      return db;
    } catch (error) {
      this.logger.error(`Failed to create DuckDB instance: ${error.message}`);
      throw new InternalServerErrorException(
        'Failed to initialize database connection',
      );
    }
  }

  private async attachPostgresDatabase(
    db: duckdb.Database,
    connection: PostgresConnection,
    decryptedPassword: string,
    connectionId: string,
  ): Promise<void> {
    // Check if this connection is already attached
    const attachmentKey = `${connectionId}_attached`;
    if (this.attachmentCache.has(attachmentKey)) {
      this.logger.debug(
        `PostgreSQL database already attached for ${connectionId}`,
      );
      return;
    }

    try {
      const connectionString = DatabaseConnectionUtil.buildConnectionString(
        connection,
        decryptedPassword,
      );

      await DatabaseConnectionUtil.attachPostgreSQLDatabase(db, {
        connectionString,
        aliasName: 'pg_source',
        timeout: (connection.connectionTimeout || 30) * 1000,
      });

      // Mark as attached
      this.attachmentCache.set(attachmentKey, true);

      this.logger.log(
        `Successfully attached PostgreSQL database: ${connection.database}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to attach PostgreSQL database: ${error.message}`,
      );
      throw new BadRequestException(`Connection failed: ${error.message}`);
    }
  }

  /**
   * Transform user queries to use pg_source prefix
   * This handles queries like SELECT * FROM "schema"."table" -> SELECT * FROM "pg_source"."schema"."table"
   */
  private transformQueryForPgSource(sql: string): string {
    // More comprehensive regex that handles various SQL patterns
    let transformedSql = sql;

    // Pattern 1: FROM "schema"."table" -> FROM "pg_source"."schema"."table"
    transformedSql = transformedSql.replace(
      /FROM\s+(["']?)([^"'\s.]+)\1\.(["']?)([^"'\s.]+)\3/gi,
      'FROM "pg_source".$1$2$1.$3$4$3',
    );

    // Pattern 2: JOIN "schema"."table" -> JOIN "pg_source"."schema"."table"
    transformedSql = transformedSql.replace(
      /JOIN\s+(["']?)([^"'\s.]+)\1\.(["']?)([^"'\s.]+)\3/gi,
      'JOIN "pg_source".$1$2$1.$3$4$3',
    );

    // Pattern 3: Handle simple schema.table without quotes
    transformedSql = transformedSql.replace(
      /FROM\s+([a-zA-Z_][a-zA-Z0-9_]*\.[a-zA-Z_][a-zA-Z0-9_]*)/gi,
      (match, schemaTable) => {
        const [schema, table] = schemaTable.split('.');
        return `FROM "pg_source"."${schema}"."${table}"`;
      },
    );

    // Pattern 4: Handle JOIN with simple schema.table
    transformedSql = transformedSql.replace(
      /JOIN\s+([a-zA-Z_][a-zA-Z0-9_]*\.[a-zA-Z_][a-zA-Z0-9_]*)/gi,
      (match, schemaTable) => {
        const [schema, table] = schemaTable.split('.');
        return `JOIN "pg_source"."${schema}"."${table}"`;
      },
    );

    this.logger.debug(`Query transformation: ${sql} -> ${transformedSql}`);
    return transformedSql;
  }

  // =====================================
  // CONNECTION MANAGEMENT
  // =====================================

  async testConnection(
    testDto: TestConnectionDto,
  ): Promise<{ success: boolean; message: string; metadata?: any }> {
    this.logger.log(
      `Testing PostgreSQL connection to ${testDto.host}:${testDto.port}/${testDto.database}`,
    );

    try {
      // Create temporary DuckDB instance for testing
      const db = new duckdb.Database(':memory:');

      // Install PostgreSQL extension
      await new Promise<void>((resolve, reject) => {
        db.exec('INSTALL postgres; LOAD postgres;', (err) => {
          if (err) {
            reject(
              new InternalServerErrorException(
                'Failed to initialize database connection',
              ),
            );
            return;
          }
          resolve();
        });
      });

      // Create temporary connection object
      const tempConnection = new PostgresConnection();
      Object.assign(tempConnection, testDto);

      const connectionString = tempConnection.toConnectionString(
        testDto.password,
      );

      // Test connection using utility
      await DatabaseConnectionUtil.attachPostgreSQLDatabase(db, {
        connectionString,
        aliasName: 'pg_test',
        timeout: (testDto.connectionTimeout || 30) * 1000,
      });

      // Get PostgreSQL version for metadata
      const metadata = await DatabaseConnectionUtil.executeQuery(
        db,
        'SELECT version() as version FROM pg_test.pg_catalog.pg_stat_activity LIMIT 1',
        [],
        10000,
      )
        .then((rows) => ({
          version: rows[0]?.version || 'Unknown',
        }))
        .catch(() => ({
          version: 'Unknown',
        }));

      // Clean up
      await DatabaseConnectionUtil.closeDuckDBInstance(db, 'test');

      this.logger.log(
        `Connection test successful for ${testDto.host}:${testDto.port}/${testDto.database}`,
      );

      return {
        success: true,
        message: 'Connection successful',
        metadata,
      };
    } catch (error) {
      this.logger.error(`Connection test failed: ${error.message}`);
      return {
        success: false,
        message: error.message || 'Connection failed',
      };
    }
  }

  async createConnection(
    userId: string,
    createDto: CreatePostgresConnectionDto,
  ): Promise<PostgresConnection> {
    this.logger.log(
      `Creating PostgreSQL connection '${createDto.name}' for user ${userId}`,
    );

    // Test connection first
    const testResult = await this.testConnection(createDto);
    if (!testResult.success) {
      throw new BadRequestException(
        `Connection test failed: ${testResult.message}`,
      );
    }

    // Check for duplicate connection names for this user
    const existingConnection = await this.connectionRepository.findOne({
      where: { userId, name: createDto.name },
    });

    if (existingConnection) {
      throw new BadRequestException(
        `Connection with name '${createDto.name}' already exists`,
      );
    }

    // Create new connection
    const connection = new PostgresConnection();
    connection.userId = userId;
    connection.name = createDto.name;
    connection.host = createDto.host;
    connection.port = createDto.port;
    connection.database = createDto.database;
    connection.username = createDto.username;
    connection.encryptedPassword = this.encrypt(createDto.password);
    connection.schema = createDto.schema;
    connection.sslEnabled = createDto.sslEnabled || false;
    connection.sslConfig = createDto.sslConfig;
    connection.connectionTimeout = createDto.connectionTimeout || 30;
    connection.queryTimeout = createDto.queryTimeout || 30000;
    connection.lastConnectionTest = new Date();
    connection.metadata = testResult.metadata;

    const savedConnection = await this.connectionRepository.save(connection);

    this.logger.log(
      `PostgreSQL connection '${createDto.name}' created successfully`,
    );

    return savedConnection;
  }

  async getUserConnections(userId: string): Promise<PostgresConnection[]> {
    return this.connectionRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async getConnection(
    userId: string,
    connectionId: string,
  ): Promise<PostgresConnection> {
    const connection = await this.connectionRepository.findOne({
      where: { id: connectionId, userId },
    });

    if (!connection) {
      throw new NotFoundException('Connection not found');
    }

    return connection;
  }

  async updateConnection(
    userId: string,
    connectionId: string,
    updateDto: UpdatePostgresConnectionDto,
  ): Promise<PostgresConnection> {
    const connection = await this.getConnection(userId, connectionId);

    // If password is being updated, encrypt it
    if (updateDto.password) {
      updateDto.password = this.encrypt(updateDto.password);
    }

    Object.assign(connection, updateDto);

    return this.connectionRepository.save(connection);
  }

  async deleteConnection(userId: string, connectionId: string): Promise<void> {
    const connection = await this.getConnection(userId, connectionId);

    // Clean up DuckDB instance if it exists
    if (this.duckdbInstances.has(connectionId)) {
      const db = this.duckdbInstances.get(connectionId)!;
      await DatabaseConnectionUtil.closeDuckDBInstance(db, connectionId);
      this.duckdbInstances.delete(connectionId);
    }

    // Clear cache for this connection
    this.clearConnectionCache(connectionId);

    await this.connectionRepository.remove(connection);
    this.logger.log(`Deleted PostgreSQL connection ${connectionId}`);
  }

  // =====================================
  // QUERY EXECUTION
  // =====================================

  async executeQuery(
    userId: string,
    connectionId: string,
    queryDto: ExecuteQueryDto,
  ): Promise<QueryResultDto | QueryErrorDto> {
    const startTime = Date.now();
    const queryId = crypto.randomUUID();

    this.logger.log(
      `Executing query ${queryId} for connection ${connectionId}`,
    );

    try {
      const connection = await this.getConnection(userId, connectionId);
      const decryptedPassword = this.decrypt(connection.encryptedPassword);

      // Get or create DuckDB instance
      const db = await this.getDuckDBInstance(connectionId);

      // Attach PostgreSQL database
      await this.attachPostgresDatabase(
        db,
        connection,
        decryptedPassword,
        connectionId,
      );

      // Validate SQL security before execution
      const securityValidation = SecurityUtil.validateSQLSecurity(
        queryDto.sql,
        {
          maxQueryLength: 100000, // 100KB limit
        },
      );

      if (!securityValidation.isValid) {
        throw new BadRequestException(
          `Query validation failed: ${securityValidation.errors.join(', ')}`,
        );
      }

      // Transform query to use pg_source prefix
      const transformedQuery = this.transformQueryForPgSource(queryDto.sql);

      // Execute query
      const result = await DatabaseConnectionUtil.executeQuery(
        db,
        transformedQuery,
        [],
        queryDto.timeout || connection.queryTimeout,
      );

      const executionTime = Date.now() - startTime;

      // Convert BigInt values to strings or numbers for JSON serialization
      const serializedResult = result.map((row) => {
        const serializedRow: any = {};
        for (const [key, value] of Object.entries(row)) {
          if (typeof value === 'bigint') {
            // Convert BigInt to string if it's too large for JavaScript number,
            // otherwise convert to number
            if (
              value > Number.MAX_SAFE_INTEGER ||
              value < Number.MIN_SAFE_INTEGER
            ) {
              serializedRow[key] = value.toString();
            } else {
              serializedRow[key] = Number(value);
            }
          } else {
            serializedRow[key] = value;
          }
        }
        return serializedRow;
      });

      // Extract column information from first row
      const columns =
        serializedResult.length > 0
          ? Object.keys(serializedResult[0]).map((name) => ({
              name,
              type: typeof serializedResult[0][name], // Simple type detection
            }))
          : [];

      this.logger.log(
        `Query ${queryId} completed in ${executionTime}ms, returned ${serializedResult.length} rows`,
      );

      return {
        success: true,
        data: serializedResult,
        columns,
        metadata: {
          executionTime,
          rowCount: serializedResult.length,
          queryId,
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      this.logger.error(
        `Query ${queryId} failed after ${executionTime}ms: ${error.message}`,
      );

      return {
        success: false,
        error: {
          code: 'QUERY_EXECUTION_ERROR',
          message: error.message,
          detail: error.detail,
          hint: error.hint,
          position: error.position,
          sqlState: error.code,
        },
        metadata: {
          executionTime,
          queryId,
        },
      };
    }
  }

  // =====================================
  // SCHEMA DISCOVERY
  // =====================================

  async discoverSchemas(
    userId: string,
    connectionId: string,
  ): Promise<SchemaInfoDto[]> {
    this.logger.log(`Discovering schemas for connection ${connectionId}`);

    // Check cache first
    const cacheKey = CacheKeyUtil.schemaKey(connectionId);
    const cached = this.schemaCache.get(cacheKey);
    if (cached) {
      this.logger.log(
        `Returning cached schemas for connection ${connectionId}`,
      );
      return cached;
    }

    try {
      const connection = await this.getConnection(userId, connectionId);
      const decryptedPassword = this.decrypt(connection.encryptedPassword);

      // Get or create DuckDB instance
      const db = await this.getDuckDBInstance(connectionId);

      // Attach PostgreSQL database
      await this.attachPostgresDatabase(
        db,
        connection,
        decryptedPassword,
        connectionId,
      );

      // Query to get all schemas with table/view counts
      const schemaQuery = `
        SELECT 
          s.schema_name as name,
          CASE 
            WHEN s.schema_name IN ('information_schema', 'pg_catalog', 'pg_toast', 'pg_temp_1', 'pg_toast_temp_1') 
            THEN true 
            ELSE false 
          END as is_system,
          COALESCE(t.table_count, 0)::int as table_count,
          COALESCE(v.view_count, 0)::int as view_count,
          obj_description(n.oid, 'pg_namespace') as comment
        FROM pg_source.information_schema.schemata s
        LEFT JOIN pg_source.pg_catalog.pg_namespace n ON n.nspname = s.schema_name
        LEFT JOIN (
          SELECT 
            table_schema,
            COUNT(*)::int as table_count
          FROM pg_source.information_schema.tables 
          WHERE table_type = 'BASE TABLE'
          GROUP BY table_schema
        ) t ON t.table_schema = s.schema_name
        LEFT JOIN (
          SELECT 
            table_schema,
            COUNT(*)::int as view_count
          FROM pg_source.information_schema.views
          GROUP BY table_schema
        ) v ON v.table_schema = s.schema_name
        ORDER BY is_system ASC, s.schema_name ASC
      `;

      const result = await DatabaseConnectionUtil.executeQuery(
        db,
        schemaQuery,
        [],
        30000,
      );

      const schemas: SchemaInfoDto[] = result.map((row) => ({
        name: row.name,
        isSystem: row.is_system,
        tableCount: row.table_count || 0,
        viewCount: row.view_count || 0,
        comment: row.comment || undefined,
      }));

      // Cache the results
      this.schemaCache.set(cacheKey, schemas);

      this.logger.log(
        `Discovered ${schemas.length} schemas for connection ${connectionId}`,
      );
      return schemas;
    } catch (error) {
      this.logger.error(
        `Schema discovery failed for connection ${connectionId}: ${error.message}`,
      );
      throw new InternalServerErrorException(
        `Schema discovery failed: ${error.message}`,
      );
    }
  }

  async discoverTables(
    userId: string,
    connectionId: string,
    schemaName: string,
    options: GetSchemaTablesDto = {},
  ): Promise<TableInfoDto[]> {
    // Resolve effective schema name
    const connection = await this.getConnection(userId, connectionId);
    let effectiveSchema = schemaName || connection.schema || 'public';

    // Debug logging to understand schema resolution
    this.logger.log(
      `Schema resolution: requested='${schemaName}', connection.schema='${connection.schema}', effectiveSchema='${effectiveSchema}'`,
    );

    // If no schema specified, try 'public' first, then fallback to getting available schemas only if needed
    if (!schemaName && !connection.schema) {
      // First try 'public' schema without making additional DB calls
      effectiveSchema = 'public';
      this.logger.log(`No schema specified, defaulting to 'public' schema`);
    }

    this.logger.log(
      `Discovering tables in schema ${effectiveSchema} for connection ${connectionId}`,
    );

    // Check cache first (only cache if no specific filters are applied)
    const shouldCache = !options.search && !options.includeRowCounts;
    const cacheKey = CacheKeyUtil.tablesKey(
      connectionId,
      effectiveSchema,
      options,
    );

    if (shouldCache) {
      const cached = this.tableCache.get(cacheKey);
      if (cached) {
        this.logger.log(`Returning cached tables for schema ${schemaName}`);
        return cached;
      }
    }

    try {
      const decryptedPassword = this.decrypt(connection.encryptedPassword);

      // Get or create DuckDB instance
      const db = await this.getDuckDBInstance(connectionId);

      // Attach PostgreSQL database
      await this.attachPostgresDatabase(
        db,
        connection,
        decryptedPassword,
        connectionId,
      );

      // Validate that the schema exists
      const schemaExists = await this.validateSchemaExists(db, effectiveSchema);
      if (!schemaExists) {
        throw new NotFoundException(`Schema '${effectiveSchema}' not found`);
      }

      // Build WHERE conditions based on options
      let whereConditions = [`t.table_schema = '${effectiveSchema}'`];

      if (options.search) {
        whereConditions.push(`t.table_name ILIKE '%${options.search}%'`);
      }

      // Build table type filters
      let tableTypeFilters = [];
      if (options.includeTables !== false) {
        tableTypeFilters.push("'BASE TABLE'");
      }
      if (options.includeViews !== false) {
        tableTypeFilters.push("'VIEW'");
      }
      if (options.includeMaterializedViews !== false) {
        tableTypeFilters.push("'MATERIALIZED VIEW'");
      }

      if (tableTypeFilters.length > 0) {
        whereConditions.push(
          `t.table_type IN (${tableTypeFilters.join(', ')})`,
        );
      }

      // System tables filter - only exclude system schemas if user hasn't specifically requested one
      const systemSchemas = ['information_schema', 'pg_catalog', 'pg_toast'];
      if (
        !options.includeSystemTables &&
        !systemSchemas.includes(effectiveSchema)
      ) {
        whereConditions.push(
          `t.table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')`,
        );
      }

      const whereClause =
        whereConditions.length > 0
          ? `WHERE ${whereConditions.join(' AND ')}`
          : '';

      // Debug logging to see the where clause
      this.logger.log(`Table discovery WHERE clause: ${whereClause}`);

      // Main query to get table information (simplified to avoid system table issues)
      const tablesQuery = `
        SELECT 
          t.table_name as name,
          t.table_schema as schema,
          CASE 
            WHEN t.table_type = 'BASE TABLE' THEN 'table'
            WHEN t.table_type = 'VIEW' THEN 'view'
            WHEN t.table_type = 'MATERIALIZED VIEW' THEN 'materialized_view'
            ELSE 'table'
          END as type,
          NULL as row_count,
          NULL as size_bytes,
          NULL as comment
        FROM pg_source.information_schema.tables t
        ${whereClause}
        ORDER BY t.table_type, t.table_name
      `;

      const tablesResult = await DatabaseConnectionUtil.executeQuery(
        db,
        tablesQuery,
        [],
        30000,
      );

      // Get column information for all tables in one query (more efficient)
      const columnsByTable = new Map<string, ColumnInfoDto[]>();

      if (tablesResult.length > 0) {
        const tableNames = tablesResult.map((t) => `'${t.name}'`).join(', ');
        const allColumnsQuery = `
          SELECT 
            c.table_name,
            c.column_name as name,
            c.data_type as type,
            CASE WHEN c.is_nullable = 'YES' THEN true ELSE false END as nullable,
            c.column_default as default_value,
            c.ordinal_position,
            c.character_maximum_length,
            c.numeric_precision,
            c.numeric_scale
          FROM pg_source.information_schema.columns c
          WHERE c.table_schema = '${effectiveSchema}' AND c.table_name IN (${tableNames})
          ORDER BY c.table_name, c.ordinal_position
        `;

        const allColumnsResult = await DatabaseConnectionUtil.executeQuery(
          db,
          allColumnsQuery,
          [],
          30000,
        );

        // Group columns by table name
        for (const row of allColumnsResult) {
          const tableName = row.table_name;
          if (!columnsByTable.has(tableName)) {
            columnsByTable.set(tableName, []);
          }

          columnsByTable.get(tableName)!.push({
            name: row.name,
            type: row.type,
            nullable: row.nullable,
            defaultValue: row.default_value || undefined,
            isPrimaryKey: false,
            isForeignKey: false,
            isUnique: false,
            comment: undefined,
            ordinalPosition: row.ordinal_position,
            characterMaximumLength: row.character_maximum_length || undefined,
            numericPrecision: row.numeric_precision || undefined,
            numericScale: row.numeric_scale || undefined,
          });
        }
      }

      // Build the tables array
      const tables: TableInfoDto[] = tablesResult.map((tableRow) => ({
        name: tableRow.name,
        schema: tableRow.schema,
        type: tableRow.type,
        rowCount: tableRow.row_count || undefined,
        sizeBytes: tableRow.size_bytes || undefined,
        comment: tableRow.comment || undefined,
        columns: columnsByTable.get(tableRow.name) || [],
      }));

      // Cache the results if appropriate
      if (shouldCache) {
        this.tableCache.set(cacheKey, tables);
      }

      this.logger.log(
        `Discovered ${tables.length} tables in schema ${effectiveSchema}`,
      );
      return tables;
    } catch (error) {
      this.logger.error(
        `Table discovery failed for schema ${effectiveSchema}: ${error.message}`,
      );
      throw new InternalServerErrorException(
        `Table discovery failed: ${error.message}`,
      );
    }
  }

  async getTableSchema(
    userId: string,
    connectionId: string,
    schemaName: string,
    tableName: string,
  ): Promise<TableInfoDto> {
    this.logger.log(`Getting schema for table ${schemaName}.${tableName}`);

    // Check cache first
    const cacheKey = CacheKeyUtil.tableSchemaKey(
      connectionId,
      schemaName,
      tableName,
    );
    const cached = this.tableSchemaCache.get(cacheKey);
    if (cached) {
      this.logger.log(
        `Returning cached table schema for ${schemaName}.${tableName}`,
      );
      return cached;
    }

    try {
      const connection = await this.getConnection(userId, connectionId);
      const decryptedPassword = this.decrypt(connection.encryptedPassword);

      // Get or create DuckDB instance
      const db = await this.getDuckDBInstance(connectionId);

      // Attach PostgreSQL database
      await this.attachPostgresDatabase(
        db,
        connection,
        decryptedPassword,
        connectionId,
      );

      // Get basic table information
      const tableInfoQuery = `
        SELECT 
          table_name as name,
          table_schema as schema,
          CASE 
            WHEN table_type = 'BASE TABLE' THEN 'table'
            WHEN table_type = 'VIEW' THEN 'view'
            WHEN table_type = 'MATERIALIZED VIEW' THEN 'materialized_view'
            ELSE 'table'
          END as type,
          obj_description(pg_class.oid, 'pg_class') as comment
        FROM pg_source.information_schema.tables t
        LEFT JOIN pg_source.pg_catalog.pg_class pg_class ON pg_class.relname = t.table_name
        WHERE t.table_schema = '${schemaName}' AND t.table_name = '${tableName}'
      `;

      const tableInfoResult = await DatabaseConnectionUtil.executeQuerySingle(
        db,
        tableInfoQuery,
        [],
        30000,
      );

      if (!tableInfoResult) {
        throw new NotFoundException(
          `Table ${schemaName}.${tableName} not found`,
        );
      }

      const tableInfo = tableInfoResult;

      // Get detailed column information
      const columns = await this.getTableColumns(db, schemaName, tableName);

      // Get indexes
      const indexes = await this.getTableIndexes(db, schemaName, tableName);

      // Get foreign keys
      const foreignKeys = await this.getTableForeignKeys(
        db,
        schemaName,
        tableName,
      );

      // Get primary key
      const primaryKey = await this.getTablePrimaryKey(
        db,
        schemaName,
        tableName,
      );

      const result: TableInfoDto = {
        name: tableInfo.name,
        schema: tableInfo.schema,
        type: tableInfo.type,
        comment: tableInfo.comment || undefined,
        columns: columns,
        indexes: indexes,
        foreignKeys: foreignKeys,
        primaryKey: primaryKey,
      };

      // Cache the result
      this.tableSchemaCache.set(cacheKey, result);

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to get table schema for ${schemaName}.${tableName}: ${error.message}`,
      );
      throw new InternalServerErrorException(
        `Failed to get table schema: ${error.message}`,
      );
    }
  }

  private async getTableColumns(
    db: duckdb.Database,
    schemaName: string,
    tableName: string,
  ): Promise<ColumnInfoDto[]> {
    const columnsQuery = `
      SELECT 
        c.column_name as name,
        c.data_type as type,
        CASE WHEN c.is_nullable = 'YES' THEN true ELSE false END as nullable,
        c.column_default as default_value,
        c.ordinal_position,
        c.character_maximum_length,
        c.numeric_precision,
        c.numeric_scale,
        NULL as comment,
        false as is_primary_key,
        false as is_foreign_key,
        false as is_unique
      FROM pg_source.information_schema.columns c
      WHERE c.table_schema = '${schemaName}' AND c.table_name = '${tableName}'
      ORDER BY c.ordinal_position
    `;

    const rows = await DatabaseConnectionUtil.executeQuery(
      db,
      columnsQuery,
      [],
      30000,
    );

    const columns: ColumnInfoDto[] = rows.map((row) => ({
      name: row.name,
      type: row.type,
      nullable: row.nullable,
      defaultValue: row.default_value || undefined,
      isPrimaryKey: row.is_primary_key,
      isForeignKey: row.is_foreign_key,
      isUnique: row.is_unique,
      comment: row.comment || undefined,
      ordinalPosition: row.ordinal_position,
      characterMaximumLength: row.character_maximum_length || undefined,
      numericPrecision: row.numeric_precision || undefined,
      numericScale: row.numeric_scale || undefined,
    }));

    return columns;
  }

  private async getTableIndexes(
    db: duckdb.Database,
    schemaName: string,
    tableName: string,
  ): Promise<IndexInfoDto[]> {
    const indexQuery = `
      SELECT 
        i.indexname as name,
        i.indexdef as definition,
        CASE WHEN i.indexdef LIKE '%UNIQUE%' THEN true ELSE false END as is_unique,
        CASE WHEN i.indexdef LIKE '%PRIMARY KEY%' THEN true ELSE false END as is_primary
      FROM pg_source.pg_catalog.pg_indexes i
      WHERE i.schemaname = '${schemaName}' AND i.tablename = '${tableName}'
      ORDER BY i.indexname
    `;

    const rows = await DatabaseConnectionUtil.executeQuery(
      db,
      indexQuery,
      [],
      30000,
    );

    const indexes: IndexInfoDto[] = rows.map((row) => ({
      name: row.name,
      columns: [], // We'll parse this from the definition if needed
      isUnique: row.is_unique,
      isPrimary: row.is_primary,
      method: 'btree', // Default method
      definition: row.definition,
    }));

    return indexes;
  }

  private async getTableForeignKeys(
    db: duckdb.Database,
    schemaName: string,
    tableName: string,
  ): Promise<ForeignKeyInfoDto[]> {
    const fkQuery = `
      SELECT 
        tc.constraint_name as name,
        kcu.column_name,
        ccu.table_schema as referenced_schema,
        ccu.table_name as referenced_table,
        ccu.column_name as referenced_column,
        rc.update_rule as on_update,
        rc.delete_rule as on_delete
      FROM pg_source.information_schema.table_constraints tc
      JOIN pg_source.information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      JOIN pg_source.information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
      JOIN pg_source.information_schema.referential_constraints rc ON rc.constraint_name = tc.constraint_name
      WHERE tc.table_schema = '${schemaName}' AND tc.table_name = '${tableName}' AND tc.constraint_type = 'FOREIGN KEY'
      ORDER BY tc.constraint_name, kcu.ordinal_position
    `;

    const rows = await DatabaseConnectionUtil.executeQuery(
      db,
      fkQuery,
      [],
      30000,
    );

    // Group by constraint name
    const fkMap = new Map<string, ForeignKeyInfoDto>();

    for (const row of rows) {
      if (!fkMap.has(row.name)) {
        fkMap.set(row.name, {
          name: row.name,
          columns: [],
          referencedTable: row.referenced_table,
          referencedSchema: row.referenced_schema,
          referencedColumns: [],
          onUpdate: row.on_update,
          onDelete: row.on_delete,
        });
      }

      const fk = fkMap.get(row.name)!;
      fk.columns.push(row.column_name);
      fk.referencedColumns.push(row.referenced_column);
    }

    return Array.from(fkMap.values());
  }

  private async getTablePrimaryKey(
    db: duckdb.Database,
    schemaName: string,
    tableName: string,
  ): Promise<string[]> {
    const pkQuery = `
      SELECT ku.column_name
      FROM pg_source.information_schema.table_constraints tc
      JOIN pg_source.information_schema.key_column_usage ku ON tc.constraint_name = ku.constraint_name
      WHERE tc.table_schema = '${schemaName}' AND tc.table_name = '${tableName}' AND tc.constraint_type = 'PRIMARY KEY'
      ORDER BY ku.ordinal_position
    `;

    const rows = await DatabaseConnectionUtil.executeQuery(
      db,
      pkQuery,
      [],
      30000,
    );

    return rows.map((row) => row.column_name);
  }

  /**
   * Gets all available schemas from the PostgreSQL database
   */
  async getAvailableSchemas(
    userId: string,
    connectionId: string,
  ): Promise<string[]> {
    try {
      const connection = await this.getConnection(userId, connectionId);
      const decryptedPassword = this.decrypt(connection.encryptedPassword);

      // Get or create DuckDB instance
      const db = await this.getDuckDBInstance(connectionId);

      // Attach PostgreSQL database
      await this.attachPostgresDatabase(
        db,
        connection,
        decryptedPassword,
        connectionId,
      );

      const allSchemasQuery = `
        SELECT schema_name 
        FROM pg_source.information_schema.schemata 
        WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
        ORDER BY schema_name
      `;

      const schemas = await DatabaseConnectionUtil.executeQuery(
        db,
        allSchemasQuery,
        [],
        10000,
      );

      return schemas.map((s) => s.schema_name);
    } catch (error) {
      this.logger.error(`Failed to get available schemas: ${error.message}`);
      return [];
    }
  }

  /**
   * Validates that a schema exists in the PostgreSQL database (efficiently)
   */
  private async validateSchemaExists(
    db: duckdb.Database,
    schemaName: string,
  ): Promise<boolean> {
    try {
      // Only check if the specific schema exists
      const schemaCheckQuery = `
        SELECT schema_name 
        FROM pg_source.information_schema.schemata 
        WHERE schema_name = '${schemaName}'
        LIMIT 1
      `;

      const result = await DatabaseConnectionUtil.executeQuery(
        db,
        schemaCheckQuery,
        [],
        5000,
      );

      const schemaExists = result.length > 0;

      if (!schemaExists) {
        this.logger.warn(`Schema '${schemaName}' not found`);
      }

      return schemaExists;
    } catch (error) {
      this.logger.error(
        `Schema validation failed for '${schemaName}': ${error.message}`,
      );

      // If schema validation fails, let's try without validation (fallback)
      this.logger.warn(
        `Skipping schema validation due to error, proceeding with query attempt`,
      );
      return true; // Allow the query to proceed and fail naturally if schema doesn't exist
    }
  }

  // =====================================
  // CACHE MANAGEMENT
  // =====================================

  clearConnectionCache(connectionId: string): void {
    const pattern = CacheKeyUtil.getConnectionPattern(connectionId);

    const schemasDeleted = this.schemaCache.deletePattern(pattern);
    const tablesDeleted = this.tableCache.deletePattern(pattern);
    const tableSchemasDeleted = this.tableSchemaCache.deletePattern(pattern);

    const totalDeleted = schemasDeleted + tablesDeleted + tableSchemasDeleted;
    this.logger.log(
      `Cleared cache for connection ${connectionId} (${totalDeleted} entries)`,
    );
  }

  clearAllCache(): void {
    const schemaStats = this.schemaCache.getStats();
    const tableStats = this.tableCache.getStats();
    const tableSchemaStats = this.tableSchemaCache.getStats();
    const attachmentCacheSize = this.attachmentCache.size;
    const totalEntries =
      schemaStats.size +
      tableStats.size +
      tableSchemaStats.size +
      attachmentCacheSize;

    this.schemaCache.clear();
    this.tableCache.clear();
    this.tableSchemaCache.clear();
    this.attachmentCache.clear();

    this.logger.log(`Cleared all cache entries (${totalEntries} entries)`);
  }

  // =====================================
  // CLEANUP
  // =====================================

  async onModuleDestroy() {
    // Clean up all DuckDB instances
    for (const [connectionId, db] of this.duckdbInstances) {
      await DatabaseConnectionUtil.closeDuckDBInstance(db, connectionId);
    }
    this.duckdbInstances.clear();

    // Clear attachment cache
    this.attachmentCache.clear();

    // Clear all caches
    this.clearAllCache();
  }
}
