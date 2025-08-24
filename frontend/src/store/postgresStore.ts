import { create } from "zustand";
import { devtools } from "zustand/middleware";
import {
  PostgreSQLConnection,
  PostgreSQLSchema,
  PostgreSQLTable,
  PostgreSQLTableInfo,
  QueryResult,
  QueryHistoryEntry,
  CreateConnectionRequest,
  UpdateConnectionRequest,
  TestConnectionRequest,
  ConnectionTestResult,
  QueryRequest,
  TablePreviewRequest,
  TablePreviewResult,
  PostgreSQLState,
} from "@/types/postgres";
import { postgreSQLService } from "@/lib/api/postgresService";

interface PostgreSQLStore extends PostgreSQLState {
  // Connection management actions
  testConnection: (config: TestConnectionRequest) => Promise<ConnectionTestResult>;
  createConnection: (config: CreateConnectionRequest) => Promise<PostgreSQLConnection>;
  updateConnection: (config: UpdateConnectionRequest) => Promise<PostgreSQLConnection>;
  deleteConnection: (id: string) => Promise<void>;
  loadConnections: () => Promise<void>;
  selectConnection: (connection: PostgreSQLConnection | null) => void;

  // Schema discovery actions
  loadSchemas: (connectionId: string) => Promise<void>;
  loadTables: (connectionId: string, schemaName: string) => Promise<void>;
  loadAllTables: (connectionId: string) => Promise<void>;
  selectSchema: (schemaName: string | null) => void;
  toggleTableSelection: (table: PostgreSQLTable) => void;
  clearTableSelection: () => void;
  
  // Table details actions
  loadTableInfo: (connectionId: string, schemaName: string, tableName: string) => Promise<PostgreSQLTableInfo>;
  previewTableData: (
    connectionId: string, 
    schemaName: string, 
    tableName: string, 
    options?: TablePreviewRequest
  ) => Promise<TablePreviewResult>;

  // Query execution actions
  executeQuery: (connectionId: string, query: QueryRequest) => Promise<QueryResult>;
  clearQueryResults: () => void;
  clearQueryError: () => void;

  // Schema tree UI state
  toggleSchemaExpanded: (schemaName: string) => void;
  setAllSchemasExpanded: (expanded: boolean) => void;

  // Error handling
  clearErrors: () => void;
  clearConnectionError: () => void;
  clearSchemaError: () => void;

  // Utility actions
  searchTables: (connectionId: string, searchTerm: string) => Promise<PostgreSQLTable[]>;
  getConnectionStats: (connectionId: string) => Promise<{
    totalTables: number;
    totalViews: number;
    schemaCount: number;
    largestTable?: { name: string; size: string };
  }>;
  
  // Reset state
  reset: () => void;
}

const initialState: PostgreSQLState = {
  connections: [],
  selectedConnection: null,
  isConnecting: false,
  connectionError: null,
  
  schemas: [],
  selectedSchema: null,
  tables: [],
  selectedTables: [],
  isLoadingSchemas: false,
  isLoadingTables: false,
  schemaError: null,
  
  queryResults: [],
  isExecutingQuery: false,
  queryError: null,
  queryHistory: [],
  
  schemaTreeExpanded: {},
  tableDetailsCache: {},
};

export const usePostgreSQLStore = create<PostgreSQLStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // Connection Management
      testConnection: async (config: TestConnectionRequest) => {
        set({ isConnecting: true, connectionError: null });

        try {
          const result = await postgreSQLService.testConnection(config);
          set({ isConnecting: false });
          return result;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Connection test failed';
          set({ isConnecting: false, connectionError: errorMessage });
          throw error;
        }
      },

      createConnection: async (config: CreateConnectionRequest) => {
        set({ isConnecting: true, connectionError: null });

        try {
          const connection = await postgreSQLService.createConnection(config);
          
          set((state) => ({
            ...state,
            connections: [...state.connections, connection],
            selectedConnection: connection,
            isConnecting: false,
          }));

          return connection;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to create connection';
          set({ isConnecting: false, connectionError: errorMessage });
          throw error;
        }
      },

      updateConnection: async (config: UpdateConnectionRequest) => {
        set({ isConnecting: true, connectionError: null });

        try {
          const updatedConnection = await postgreSQLService.updateConnection(config);
          
          set((state) => {
            const index = state.connections.findIndex(c => c.id === config.id);
            const updatedConnections = [...state.connections];
            if (index !== -1) {
              updatedConnections[index] = updatedConnection;
            }
            return {
              ...state,
              connections: updatedConnections,
              selectedConnection: state.selectedConnection?.id === config.id ? updatedConnection : state.selectedConnection,
              isConnecting: false,
            };
          });

          return updatedConnection;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to update connection';
          set({ isConnecting: false, connectionError: errorMessage });
          throw error;
        }
      },

      deleteConnection: async (id: string) => {
        set({ isConnecting: true, connectionError: null });

        try {
          await postgreSQLService.deleteConnection(id);
          
          set((state) => ({
            ...state,
            connections: state.connections.filter(c => c.id !== id),
            selectedConnection: state.selectedConnection?.id === id ? null : state.selectedConnection,
            schemas: state.selectedConnection?.id === id ? [] : state.schemas,
            tables: state.selectedConnection?.id === id ? [] : state.tables,
            selectedTables: state.selectedConnection?.id === id ? [] : state.selectedTables,
            selectedSchema: state.selectedConnection?.id === id ? null : state.selectedSchema,
            schemaTreeExpanded: state.selectedConnection?.id === id ? {} : state.schemaTreeExpanded,
            isConnecting: false,
          }));
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to delete connection';
          set({ isConnecting: false, connectionError: errorMessage });
          throw error;
        }
      },

      loadConnections: async () => {
        set({ isConnecting: true, connectionError: null });

        try {
          const connections = await postgreSQLService.getConnections();
          set({ connections, isConnecting: false });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to load connections';
          set({ connections: [], isConnecting: false, connectionError: errorMessage });
        }
      },

      selectConnection: (connection: PostgreSQLConnection | null) => {
        set((state) => ({
          ...state,
          selectedConnection: connection,
          schemas: [],
          tables: [],
          selectedTables: [],
          selectedSchema: null,
          schemaTreeExpanded: {},
          queryResults: [],
        }));
      },

      // Schema Discovery
      loadSchemas: async (connectionId: string) => {
        set({ isLoadingSchemas: true, schemaError: null });

        try {
          const schemas = await postgreSQLService.getSchemas(connectionId);
          set({ schemas, isLoadingSchemas: false });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to load schemas';
          set({ isLoadingSchemas: false, schemaError: errorMessage });
          throw error;
        }
      },

      loadTables: async (connectionId: string, schemaName: string) => {
        set({ isLoadingTables: true, schemaError: null });

        try {
          const tables = await postgreSQLService.getTables(connectionId, schemaName);
          
          set((state) => ({
            ...state,
            tables: [...state.tables.filter(t => t.schemaName !== schemaName), ...tables],
            isLoadingTables: false,
          }));
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to load tables';
          set({ isLoadingTables: false, schemaError: errorMessage });
          throw error;
        }
      },

      loadAllTables: async (connectionId: string) => {
        set({ isLoadingTables: true, schemaError: null });

        try {
          const allTables = await postgreSQLService.getAllTables(connectionId);
          set({ tables: allTables, isLoadingTables: false });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to load all tables';
          set({ isLoadingTables: false, schemaError: errorMessage });
          throw error;
        }
      },

      selectSchema: (schemaName: string | null) => {
        set({ selectedSchema: schemaName });
      },

      toggleTableSelection: (table: PostgreSQLTable) => {
        set((state) => {
          const index = state.selectedTables.findIndex(
            t => t.schemaName === table.schemaName && t.tableName === table.tableName
          );
          
          const selectedTables = [...state.selectedTables];
          if (index === -1) {
            selectedTables.push(table);
          } else {
            selectedTables.splice(index, 1);
          }
          
          return { ...state, selectedTables };
        });
      },

      clearTableSelection: () => {
        set({ selectedTables: [] });
      },

      // Table Details
      loadTableInfo: async (connectionId: string, schemaName: string, tableName: string) => {
        const cacheKey = `${connectionId}:${schemaName}:${tableName}`;
        
        // Return cached info if available
        const cached = get().tableDetailsCache[cacheKey];
        if (cached) {
          return cached;
        }

        try {
          const tableInfo = await postgreSQLService.getTableInfo(connectionId, schemaName, tableName);
          
          set((state) => ({
            ...state,
            tableDetailsCache: {
              ...state.tableDetailsCache,
              [cacheKey]: tableInfo,
            },
          }));

          return tableInfo;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to load table info';
          set({ schemaError: errorMessage });
          throw error;
        }
      },

      previewTableData: async (
        connectionId: string, 
        schemaName: string, 
        tableName: string, 
        options?: TablePreviewRequest
      ) => {
        try {
          return await postgreSQLService.previewTableData(connectionId, schemaName, tableName, options);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to preview table data';
          set({ schemaError: errorMessage });
          throw error;
        }
      },

      // Query Execution
      executeQuery: async (connectionId: string, query: QueryRequest) => {
        set({ isExecutingQuery: true, queryError: null });

        try {
          const result = await postgreSQLService.executeQuery(connectionId, query);
          
          const historyEntry: QueryHistoryEntry = {
            id: Date.now().toString(),
            sql: query.sql,
            connectionId,
            connectionName: get().selectedConnection?.name || 'Unknown',
            executedAt: new Date().toISOString(),
            executionTime: result.executionTime,
            rowCount: result.rowCount,
            success: true,
          };

          set((state) => {
            const queryResults = [result, ...state.queryResults].slice(0, 10);
            const queryHistory = [historyEntry, ...state.queryHistory].slice(0, 50);
            
            return {
              ...state,
              queryResults,
              queryHistory,
              isExecutingQuery: false,
            };
          });

          return result;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Query execution failed';
          
          const historyEntry: QueryHistoryEntry = {
            id: Date.now().toString(),
            sql: query.sql,
            connectionId,
            connectionName: get().selectedConnection?.name || 'Unknown',
            executedAt: new Date().toISOString(),
            executionTime: 0,
            rowCount: 0,
            success: false,
            error: errorMessage,
          };

          set((state) => {
            const queryHistory = [historyEntry, ...state.queryHistory].slice(0, 50);
            
            return {
              ...state,
              queryError: errorMessage,
              isExecutingQuery: false,
              queryHistory,
            };
          });

          throw error;
        }
      },

      clearQueryResults: () => {
        set({ queryResults: [] });
      },

      clearQueryError: () => {
        set({ queryError: null });
      },

      // Schema Tree UI
      toggleSchemaExpanded: (schemaName: string) => {
        set((state) => ({
          ...state,
          schemaTreeExpanded: {
            ...state.schemaTreeExpanded,
            [schemaName]: !state.schemaTreeExpanded[schemaName],
          },
        }));
      },

      setAllSchemasExpanded: (expanded: boolean) => {
        const { schemas } = get();
        const expandedEntries: Record<string, boolean> = {};
        schemas.forEach(schema => {
          expandedEntries[schema.schemaName] = expanded;
        });
        
        set((state) => ({
          ...state,
          schemaTreeExpanded: {
            ...state.schemaTreeExpanded,
            ...expandedEntries,
          },
        }));
      },

      // Error Handling
      clearErrors: () => {
        set({ connectionError: null, schemaError: null, queryError: null });
      },

      clearConnectionError: () => {
        set({ connectionError: null });
      },

      clearSchemaError: () => {
        set({ schemaError: null });
      },

      // Utility Actions
      searchTables: async (connectionId: string, searchTerm: string) => {
        return await postgreSQLService.searchTables(connectionId, searchTerm);
      },

      getConnectionStats: async (connectionId: string) => {
        return await postgreSQLService.getConnectionStats(connectionId);
      },

      // Reset State
      reset: () => {
        set(initialState);
      },
    }),
    { name: "PostgreSQLStore" }
  )
);