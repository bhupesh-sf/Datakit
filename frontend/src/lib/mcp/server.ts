import { useDuckDBStore } from "@/store/duckDBStore";
import { useAppStore } from "@/store/appStore";
import { selectTableName } from "@/store/selectors/appSelectors";

export interface MCPRequest {
  method: string;
  params?: any;
  id?: string;
}

export interface MCPResponse {
  result?: any;
  error?: {
    code: number;
    message: string;
  };
  id?: string;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export class DataKitMCPServer {
  private isRunning = false;
  private port = 3001;

  // Available MCP tools that DataKit exposes
  private tools: MCPTool[] = [
    {
      name: "query_database",
      description: "Execute SQL queries on the loaded dataset",
      inputSchema: {
        type: "object",
        properties: {
          sql: {
            type: "string",
            description: "SQL query to execute (DuckDB syntax)"
          },
          limit: {
            type: "number",
            description: "Maximum number of rows to return (default: 100)"
          }
        },
        required: ["sql"]
      }
    },
    {
      name: "get_schema",
      description: "Get the schema of the current dataset",
      inputSchema: {
        type: "object",
        properties: {
          table_name: {
            type: "string",
            description: "Optional table name (uses current table if not specified)"
          }
        }
      }
    },
    {
      name: "list_tables",
      description: "List all available tables in the database",
      inputSchema: {
        type: "object",
        properties: {}
      }
    },
    {
      name: "get_sample_data",
      description: "Get sample data from a table",
      inputSchema: {
        type: "object",
        properties: {
          table_name: {
            type: "string",
            description: "Table name (optional, uses current table if not specified)"
          },
          limit: {
            type: "number",
            description: "Number of sample rows (default: 10)"
          }
        }
      }
    }
  ];

  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    // In a real implementation, this would start a WebSocket or HTTP server
    // For now, we'll simulate the MCP server capabilities
    this.isRunning = true;
    console.log(`DataKit MCP Server started on port ${this.port}`);
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    console.log('DataKit MCP Server stopped');
  }

  isActive(): boolean {
    return this.isRunning;
  }

  getPort(): number {
    return this.port;
  }

  getAvailableTools(): MCPTool[] {
    return this.tools;
  }

  async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    try {
      switch (request.method) {
        case 'tools/list':
          return {
            result: {
              tools: this.tools
            },
            id: request.id
          };

        case 'tools/call':
          return await this.handleToolCall(request.params);

        case 'query_database':
          return await this.executeQuery(request.params);

        case 'get_schema':
          return await this.getSchema(request.params);

        case 'list_tables':
          return await this.listTables();

        case 'get_sample_data':
          return await this.getSampleData(request.params);

        default:
          return {
            error: {
              code: -32601,
              message: `Method not found: ${request.method}`
            },
            id: request.id
          };
      }
    } catch (error) {
      return {
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal error'
        },
        id: request.id
      };
    }
  }

  private async handleToolCall(params: any): Promise<MCPResponse> {
    const { name, arguments: args } = params;

    switch (name) {
      case 'query_database':
        return await this.executeQuery(args);
      case 'get_schema':
        return await this.getSchema(args);
      case 'list_tables':
        return await this.listTables();
      case 'get_sample_data':
        return await this.getSampleData(args);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  private async executeQuery(params: { sql: string; limit?: number }): Promise<MCPResponse> {
    const { sql, limit = 100 } = params;
    
    const { executeQuery } = useDuckDBStore.getState();
    
    try {
      // Add limit if not present
      const limitedSql = sql.trim().toLowerCase().includes('limit') 
        ? sql 
        : `${sql.replace(/;?\s*$/, '')} LIMIT ${limit}`;

      const result = await executeQuery(limitedSql);
      
      // Convert result to plain object
      const data = result?.toArray() || [];
      const columns = result?.schema.fields.map(field => ({
        name: field.name,
        type: field.type.toString()
      })) || [];

      return {
        result: {
          data,
          columns,
          rowCount: data.length,
          sql: limitedSql
        }
      };
    } catch (error) {
      throw new Error(`Query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async getSchema(params: { table_name?: string } = {}): Promise<MCPResponse> {
    const tableName = params.table_name || useAppStore.getState().fileName || selectTableName(useAppStore.getState());
    
    if (!tableName) {
      throw new Error('No table specified and no active table found');
    }

    const { getTableSchema } = useDuckDBStore.getState();
    
    try {
      const schema = await getTableSchema(tableName);
      
      return {
        result: {
          tableName,
          schema: schema || [],
          columnCount: schema?.length || 0
        }
      };
    } catch (error) {
      throw new Error(`Failed to get schema: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async listTables(): Promise<MCPResponse> {
    const { getAvailableTables } = useDuckDBStore.getState();
    
    try {
      const tables = getAvailableTables();
      
      return {
        result: {
          tables,
          count: tables.length
        }
      };
    } catch (error) {
      throw new Error(`Failed to list tables: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async getSampleData(params: { table_name?: string; limit?: number } = {}): Promise<MCPResponse> {
    const tableName = params.table_name || useAppStore.getState().fileName || selectTableName(useAppStore.getState());
    const limit = params.limit || 10;
    
    if (!tableName) {
      throw new Error('No table specified and no active table found');
    }

    return await this.executeQuery({
      sql: `SELECT * FROM ${tableName}`,
      limit
    });
  }

  // Generate MCP configuration for Claude Desktop
  generateClaudeConfig(): string {
    return JSON.stringify({
      mcpServers: {
        datakit: {
          command: "npx",
          args: ["datakit-mcp-server"],
          env: {
            DATAKIT_PORT: this.port.toString()
          }
        }
      }
    }, null, 2);
  }

  // Generate connection instructions
  getConnectionInstructions(): string {
    return `
# DataKit MCP Server Connection

## For Claude Desktop:
1. Add this to your Claude Desktop MCP configuration:

\`\`\`json
${this.generateClaudeConfig()}
\`\`\`

2. Restart Claude Desktop

## Available Tools:
${this.tools.map(tool => `- **${tool.name}**: ${tool.description}`).join('\n')}

## Connection Details:
- Server Type: DataKit MCP Server
- Port: ${this.port}
- Status: ${this.isRunning ? 'Running' : 'Stopped'}

## Example Usage in Claude:
"Can you query the current dataset and show me the top 10 rows?"
"What's the schema of the current table?"
"List all available tables in the database"
`;
  }
}

// Global MCP server instance
export const mcpServer = new DataKitMCPServer();