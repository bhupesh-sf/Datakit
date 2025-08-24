import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PostgresProxyService } from './postgres-proxy.service';
import { SecurityUtil } from './utils/security.util';
import {
  CreatePostgresConnectionDto,
  UpdatePostgresConnectionDto,
  TestConnectionDto,
} from './dto/connection.dto';
import { ExecuteQueryDto } from './dto/query.dto';
import { GetSchemaTablesDto } from './dto/schema.dto';

@Controller('postgres-proxy')
@UseGuards(JwtAuthGuard) // All endpoints require authentication
export class PostgresProxyController {
  constructor(private readonly postgresProxyService: PostgresProxyService) {}

  // =====================================
  // CONNECTION MANAGEMENT ENDPOINTS
  // =====================================

  @Post('connections/test')
  async testConnection(@Body() testDto: TestConnectionDto) {
    const result = await this.postgresProxyService.testConnection(testDto);

    if (!result.success) {
      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_REQUEST,
          message: result.message,
          error: 'Connection Test Failed',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    return {
      statusCode: HttpStatus.OK,
      message: 'Connection test successful',
      data: result,
    };
  }

  @Post('connections')
  async createConnection(
    @Request() req: any,
    @Body() createDto: CreatePostgresConnectionDto,
  ) {
    const userId = req.user.id;
    const connection = await this.postgresProxyService.createConnection(
      userId,
      createDto,
    );

    return {
      statusCode: HttpStatus.CREATED,
      message: 'Connection created successfully',
      data: connection.toSafeObject(),
    };
  }

  @Get('connections')
  async getUserConnections(@Request() req: any) {
    const userId = req.user.id;
    const connections =
      await this.postgresProxyService.getUserConnections(userId);

    return {
      statusCode: HttpStatus.OK,
      message: 'Connections retrieved successfully',
      data: connections.map((conn) => conn.toSafeObject()),
    };
  }

  @Get('connections/:connectionId')
  async getConnection(
    @Request() req: any,
    @Param('connectionId') connectionId: string,
  ) {
    const userId = req.user.id;
    const connection = await this.postgresProxyService.getConnection(
      userId,
      connectionId,
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Connection retrieved successfully',
      data: connection.toSafeObject(),
    };
  }

  @Put('connections/:connectionId')
  async updateConnection(
    @Request() req: any,
    @Param('connectionId') connectionId: string,
    @Body() updateDto: UpdatePostgresConnectionDto,
  ) {
    const userId = req.user.id;
    const connection = await this.postgresProxyService.updateConnection(
      userId,
      connectionId,
      updateDto,
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Connection updated successfully',
      data: connection.toSafeObject(),
    };
  }

  @Delete('connections/:connectionId')
  async deleteConnection(
    @Request() req: any,
    @Param('connectionId') connectionId: string,
  ) {
    const userId = req.user.id;
    await this.postgresProxyService.deleteConnection(userId, connectionId);

    return {
      statusCode: HttpStatus.OK,
      message: 'Connection deleted successfully',
    };
  }

  // =====================================
  // QUERY EXECUTION ENDPOINTS
  // =====================================

  @Post('connections/:connectionId/query')
  async executeQuery(
    @Request() req: any,
    @Param('connectionId') connectionId: string,
    @Body() queryDto: ExecuteQueryDto,
  ) {
    const userId = req.user.id;

    // Enhanced SQL security validation using utility
    const securityValidation = SecurityUtil.validateSQLSecurity(queryDto.sql, {
      maxQueryLength: 100000, // 100KB limit
    });

    if (!securityValidation.isValid) {
      throw new HttpException(
        {
          statusCode: HttpStatus.FORBIDDEN,
          message: 'Query validation failed',
          errors: securityValidation.errors,
          error: 'Forbidden Operation',
        },
        HttpStatus.FORBIDDEN,
      );
    }

    const result = await this.postgresProxyService.executeQuery(
      userId,
      connectionId,
      queryDto,
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Query executed successfully',
      data: result,
    };
  }

  // =====================================
  // SCHEMA DISCOVERY ENDPOINTS
  // =====================================

  @Get('connections/:connectionId/schemas')
  async getSchemas(
    @Request() req: any,
    @Param('connectionId') connectionId: string,
  ) {
    const userId = req.user.id;
    const schemas = await this.postgresProxyService.discoverSchemas(
      userId,
      connectionId,
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Schemas retrieved successfully',
      data: schemas,
    };
  }

  @Get('connections/:connectionId/tables')
  async getAllTables(
    @Request() req: any,
    @Param('connectionId') connectionId: string,
    @Query() queryDto: GetSchemaTablesDto,
  ) {
    const userId = req.user.id;

    // Use default schema (will be resolved by service)
    const tables = await this.postgresProxyService.discoverTables(
      userId,
      connectionId,
      undefined, // Let service determine default schema
      queryDto,
    );

    // Get the actual schema used from the service
    const connection = await this.postgresProxyService.getConnection(
      userId,
      connectionId,
    );
    const actualSchema = connection.schema || 'public';

    return {
      statusCode: HttpStatus.OK,
      message: 'Tables retrieved successfully',
      data: tables,
      metadata: {
        schema: actualSchema,
        totalTables: tables.length,
        filters: {
          search: queryDto.search || null,
          includeTables: queryDto.includeTables !== false,
          includeViews: queryDto.includeViews !== false,
          includeMaterializedViews: queryDto.includeMaterializedViews !== false,
          includeSystemTables: queryDto.includeSystemTables === true,
          includeRowCounts: queryDto.includeRowCounts === true,
        },
      },
    };
  }

  @Get('connections/:connectionId/schemas/:schemaName/tables')
  async getSchemaTables(
    @Request() req: any,
    @Param('connectionId') connectionId: string,
    @Param('schemaName') schemaName: string,
    @Query() queryDto: GetSchemaTablesDto,
  ) {
    const userId = req.user.id;

    // Handle special cases for schema name
    const effectiveSchemaParam =
      schemaName === 'default' || schemaName === 'undefined'
        ? undefined
        : schemaName;

    const tables = await this.postgresProxyService.discoverTables(
      userId,
      connectionId,
      effectiveSchemaParam,
      queryDto,
    );

    // Get the actual schema used from the service
    const connection = await this.postgresProxyService.getConnection(
      userId,
      connectionId,
    );
    const actualSchema = effectiveSchemaParam || connection.schema || 'public';

    return {
      statusCode: HttpStatus.OK,
      message: 'Tables retrieved successfully',
      data: tables,
      metadata: {
        schema: actualSchema,
        totalTables: tables.length,
        filters: {
          search: queryDto.search || null,
          includeTables: queryDto.includeTables !== false,
          includeViews: queryDto.includeViews !== false,
          includeMaterializedViews: queryDto.includeMaterializedViews !== false,
          includeSystemTables: queryDto.includeSystemTables === true,
          includeRowCounts: queryDto.includeRowCounts === true,
        },
      },
    };
  }

  @Get('connections/:connectionId/schemas/:schemaName/tables/:tableName')
  async getTableSchema(
    @Request() req: any,
    @Param('connectionId') connectionId: string,
    @Param('schemaName') schemaName: string,
    @Param('tableName') tableName: string,
  ) {
    const userId = req.user.id;
    const tableSchema = await this.postgresProxyService.getTableSchema(
      userId,
      connectionId,
      schemaName,
      tableName,
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Table schema retrieved successfully',
      data: tableSchema,
    };
  }

  // =====================================
  // QUICK TABLE PREVIEW ENDPOINT
  // =====================================

  @Post(
    'connections/:connectionId/schemas/:schemaName/tables/:tableName/preview',
  )
  async previewTable(
    @Request() req: any,
    @Param('connectionId') connectionId: string,
    @Param('schemaName') schemaName: string,
    @Param('tableName') tableName: string,
    @Body() options: { limit?: number; offset?: number } = {},
  ) {
    const userId = req.user.id;

    // Generate a safe preview query
    const limit = Math.min(options.limit || 10, 100); // Max 100 rows for preview
    const offset = Math.max(options.offset || 0, 0);

    const previewQuery = {
      sql: `SELECT * FROM pg_source."${schemaName}"."${tableName}" LIMIT ${limit} OFFSET ${offset}`,
      limit: limit,
      timeout: 10000, // 10 second timeout for previews
    };

    const result = await this.postgresProxyService.executeQuery(
      userId,
      connectionId,
      previewQuery,
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Table preview retrieved successfully',
      data: result,
      metadata: {
        schema: schemaName,
        table: tableName,
        limit: limit,
        offset: offset,
        isPreview: true,
      },
    };
  }

  // =====================================
  // CACHE MANAGEMENT ENDPOINTS
  // =====================================

  @Delete('connections/:connectionId/cache')
  async clearConnectionCache(
    @Request() req: any,
    @Param('connectionId') connectionId: string,
  ) {
    const userId = req.user.id;

    // Verify user owns this connection
    await this.postgresProxyService.getConnection(userId, connectionId);

    // Clear cache
    this.postgresProxyService.clearConnectionCache(connectionId);

    return {
      statusCode: HttpStatus.OK,
      message: 'Connection cache cleared successfully',
    };
  }

  // =====================================
  // DEBUG ENDPOINT
  // =====================================

  @Get('connections/:connectionId/available-schemas')
  async getAvailableSchemas(
    @Request() req: any,
    @Param('connectionId') connectionId: string,
  ) {
    const userId = req.user.id;
    const schemas = await this.postgresProxyService.getAvailableSchemas(userId, connectionId);
    
    return {
      statusCode: HttpStatus.OK,
      message: 'Available schemas retrieved',
      data: schemas,
    };
  }

  @Get('connections/:connectionId/debug')
  async debugConnection(
    @Request() req: any,
    @Param('connectionId') connectionId: string,
  ) {
    const userId = req.user.id;
    const connection = await this.postgresProxyService.getConnection(
      userId,
      connectionId,
    );

    try {
      // Get available schemas first
      const availableSchemas = await this.postgresProxyService.getAvailableSchemas(userId, connectionId);
      
      // Test basic connection info
      const debugInfo = {
        connection: {
          id: connection.id,
          name: connection.name,
          host: connection.host,
          port: connection.port,
          database: connection.database,
          username: connection.username,
          schema: connection.schema || 'public',
          sslEnabled: connection.sslEnabled,
        },
        tests: {
          basicConnection: false,
          schemaQuery: false,
          tableQuery: false,
        },
        errors: [],
        schemas: availableSchemas,
        tableCounts: {},
      };

      // Test connection and schema discovery
      try {
        const schemas = await this.postgresProxyService.discoverSchemas(
          userId,
          connectionId,
        );
        debugInfo.tests.basicConnection = true;
        debugInfo.tests.schemaQuery = true;

        // Test table discovery with the first available schema
        if (availableSchemas.length > 0) {
          const testSchema = availableSchemas.includes('public') ? 'public' : availableSchemas[0];
          const tables = await this.postgresProxyService.discoverTables(
            userId,
            connectionId,
            testSchema,
          );
          debugInfo.tests.tableQuery = true;
          debugInfo.tableCounts[testSchema] = tables.length;
        }
      } catch (error) {
        debugInfo.errors.push({
          type: 'schema_discovery',
          message: error.message,
        });
      }

      return {
        statusCode: HttpStatus.OK,
        message: 'Debug information retrieved',
        data: debugInfo,
      };
    } catch (error) {
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Debug failed',
        data: {
          connection: {
            id: connection.id,
            name: connection.name,
          },
          error: error.message,
        },
      };
    }
  }

  // =====================================
  // HEALTH CHECK ENDPOINT
  // =====================================

  @Get('health')
  async healthCheck() {
    return {
      statusCode: HttpStatus.OK,
      message: 'PostgreSQL Proxy service is healthy',
      timestamp: new Date().toISOString(),
    };
  }
}
