import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Table,
  Search,
  CheckCircle,
  AlertCircle,
  Loader,
  Trash2,
  Edit,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/Button';
import AuthGate from '@/components/auth/AuthGate';

import { usePostgreSQLStore } from '@/store/postgresStore';
import { useDuckDBStore } from '@/store/duckDBStore';
import { useAuth } from '@/hooks/auth/useAuth';

import {
  PostgreSQLConnection,
  PostgreSQLTable,
  PostgreSQLImportResult,
  CreateConnectionRequest,
} from '@/types/postgres';

interface PostgreSQLPanelProps {
  onImport: (result: PostgreSQLImportResult) => void;
}

interface ConnectionFormData {
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  schema: string;
  sslEnabled: boolean;
  connectionTimeout: number;
  queryTimeout: number;
}

const PostgreSQLPanel: React.FC<PostgreSQLPanelProps> = ({ onImport }) => {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();

  const [currentStep, setCurrentStep] = useState<
    'connections' | 'form' | 'tables'
  >('connections');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTables, setSelectedTables] = useState<PostgreSQLTable[]>([]);
  const [editingConnection, setEditingConnection] =
    useState<PostgreSQLConnection | null>(null);
  const [formData, setFormData] = useState<ConnectionFormData>({
    name: '',
    host: '',
    port: 5432,
    database: '',
    username: '',
    password: '',
    schema: 'public',
    sslEnabled: false,
    connectionTimeout: 30,
    queryTimeout: 60000,
  });

  const {
    connections,
    selectedConnection,
    isConnecting,
    connectionError,
    tables,
    isLoadingSchemas,
    isLoadingTables,
    schemaError,
    loadConnections,
    selectConnection,
    createConnection,
    deleteConnection,
    loadSchemas,
    loadTables,
    testConnection,
    clearErrors,
  } = usePostgreSQLStore();

  const {
    connectToPostgreSQL,
    addVirtualPostgreSQLTable
  } = useDuckDBStore();


  useEffect(() => {
    if (isAuthenticated) {
      loadConnections();
    }
  }, [isAuthenticated, loadConnections]);

  // Load schemas and tables when connection is selected
  useEffect(() => {
    if (selectedConnection) {
      loadSchemas(selectedConnection.id).then(() => {
        // Load tables only for the connection's default schema instead of all schemas
        const defaultSchema = selectedConnection.schema || 'public';
        loadTables(selectedConnection.id, defaultSchema);
      });
    }
  }, [selectedConnection, loadSchemas, loadTables]);

  const handleCreateConnection = async () => {
    try {
      clearErrors();

      // Test connection first
      const testResult = await testConnection({
        host: formData.host,
        port: formData.port,
        database: formData.database,
        username: formData.username,
        password: formData.password,
        sslEnabled: formData.sslEnabled,
        connectionTimeout: formData.connectionTimeout,
      });

      if (!testResult.success) {
        throw new Error(testResult.message);
      }

      // Create connection
      const connectionData: CreateConnectionRequest = {
        name: formData.name,
        host: formData.host,
        port: formData.port,
        database: formData.database,
        username: formData.username,
        password: formData.password,
        schema: formData.schema,
        sslEnabled: formData.sslEnabled,
        connectionTimeout: formData.connectionTimeout,
        queryTimeout: formData.queryTimeout,
      };

      await createConnection(connectionData);
      setCurrentStep('tables');
    } catch (error) {
      console.error('Failed to create connection:', error);
    }
  };

  const handleDeleteConnection = async (connection: PostgreSQLConnection) => {
    if (
      confirm(
        t('importModal.postgresql.confirmDelete', { name: connection.name })
      )
    ) {
      try {
        await deleteConnection(connection.id);
      } catch (error) {
        console.error('Failed to delete connection:', error);
      }
    }
  };

  const handleSelectConnection = (connection: PostgreSQLConnection) => {
    selectConnection(connection);
    setCurrentStep('tables');
  };

  const handleTableSelect = (table: PostgreSQLTable) => {
    setSelectedTables((prev) => {
      const prevArray = prev || [];
      const exists = prevArray.find(
        (t) =>
          t.schemaName === table.schemaName && t.tableName === table.tableName
      );

      if (exists) {
        return prevArray.filter(
          (t) =>
            !(
              t.schemaName === table.schemaName &&
              t.tableName === table.tableName
            )
        );
      } else {
        return [...prevArray, table];
      }
    });
  };

  const handleImportTables = async () => {
    if (!selectedConnection || selectedTables.length === 0) return;

    try {
      await connectToPostgreSQL(selectedConnection.id);

      // Add each selected table as a virtual table in DuckDB bridge
      for (const table of selectedTables) {
        const columns =
          table.columns?.map((col) => ({
            name: col.columnName,
            type: col.dataType,
          })) || [];

        addVirtualPostgreSQLTable(selectedConnection.id, table, columns);

        // Create individual file entry for each table (like file imports do)
        const tableFileName = `${table.schemaName}.${table.tableName}`;

        onImport({
          data: [], // Empty for remote tables
          columnTypes:
            table.columns?.map((col) => ({
              name: col.columnName,
              type: col.dataType,
            })) || [],
          fileName: tableFileName,
          rowCount: table.rowCount || 0,
          columnCount: table.columns?.length || 0,
          sourceType: 'postgres' as any,
          loadedToDuckDB: false,
          tableName: tableFileName, // Use schema.table as tableName for DuckDB queries
          isRemote: true,
          remoteProvider: 'postgresql' as any,
          remoteURL: `postgres://${selectedConnection.host}:${selectedConnection.port}/${selectedConnection.database}`,
          postgresql: {
            connectionId: selectedConnection.id,
            connectionName: selectedConnection.name,
            schema: table.schemaName,
            table: table.tableName,
            originalRowCount: table.rowCount || 0,
            queryUsed: `SELECT * FROM "${table.schemaName}"."${table.tableName}"`,
          },
        });
      }
    } catch (error) {
      console.error('Failed to import tables:', error);
    }
  };

  const filteredTables = (tables || []).filter(
    (table) =>
      table.tableName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      table.schemaName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderConnectionsList = () => (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-white">
              {t('importModal.postgresql.connections.title')}
            </h3>
            <p className="text-sm text-white/60 mt-1">
              {t('importModal.postgresql.connections.description')}
            </p>
          </div>
          <Button
            onClick={() => setCurrentStep('form')}
            className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('importModal.postgresql.connections.addConnection')}
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {connectionError && (
        <div className="mx-6 mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <div className="flex items-center text-red-400">
            <AlertCircle className="h-4 w-4 mr-2" />
            <span className="text-sm">{connectionError}</span>
          </div>
        </div>
      )}

      {/* Connections List */}
      <div className="flex-1 overflow-y-auto p-6">
        {isConnecting ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="h-6 w-6 animate-spin text-blue-400" />
            <span className="ml-2 text-white/60">{t('importModal.postgresql.loading.connections')}</span>
          </div>
        ) : connections.length === 0 ? (
          <div className="text-center py-12">
            <h4 className="text-lg font-medium text-white mb-2">
              {t('importModal.postgresql.noConnections.title')}
            </h4>
            <p className="text-white/60 mb-6 max-w-sm mx-auto">
              {t('importModal.postgresql.noConnections.description')}
            </p>
            <Button
              onClick={() => setCurrentStep('form')}
              className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t('importModal.postgresql.noConnections.createConnection')}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {(connections || []).map((connection) => (
              <motion.div
                key={connection.id}
                className={cn(
                  'group relative p-4 rounded-lg border transition-all duration-200 cursor-pointer',
                  selectedConnection?.id === connection.id
                    ? 'bg-blue-500/10 border-blue-500/30 text-white'
                    : 'bg-white/5 border-white/10 hover:border-white/20 text-white/80 hover:text-white'
                )}
                onClick={() => handleSelectConnection(connection)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">
                        {connection.name}
                      </h4>
                      <p className="text-sm opacity-60 truncate">
                        {connection.host}:{connection.port}/
                        {connection.database}
                      </p>
                      <div className="flex items-center mt-1">
                        <div
                          className={cn(
                            'w-2 h-2 rounded-full mr-2',
                            connection.isActive ? 'bg-green-400' : 'bg-red-400'
                          )}
                        />
                        <span className="text-xs opacity-60">
                          {connection.isActive ? t('importModal.postgresql.status.active') : t('importModal.postgresql.status.inactive')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingConnection(connection);
                        setCurrentStep('form');
                      }}
                      className="h-8 w-8 p-0 hover:bg-white/10"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteConnection(connection);
                      }}
                      className="h-8 w-8 p-0 hover:bg-red-500/20 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderConnectionForm = () => (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-white">
              {editingConnection
                ? t('importModal.postgresql.form.editConnection')
                : t('importModal.postgresql.form.newConnection')}
            </h3>
            <p className="text-sm text-white/60 mt-1">
              {t('importModal.postgresql.form.description')}
            </p>
          </div>
        
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-md space-y-6">
          {/* Basic Info */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              {t('importModal.postgresql.form.connectionName')}
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder={t('importModal.postgresql.form.connectionNamePlaceholder')}
              className="w-full p-2 bg-white/5 border border-white/20 rounded text-white placeholder:text-white/50 focus:outline-none focus:border-blue-500/50"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-white mb-2">
                {t('importModal.postgresql.form.host')}
              </label>
              <input
                type="text"
                value={formData.host}
                onChange={(e) =>
                  setFormData({ ...formData, host: e.target.value })
                }
                placeholder={t('importModal.postgresql.form.hostPlaceholder')}
                className="w-full p-2 bg-white/5 border border-white/20 rounded text-white placeholder:text-white/50 focus:outline-none focus:border-blue-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                {t('importModal.postgresql.form.port')}
              </label>
              <input
                type="number"
                value={formData.port}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    port: parseInt(e.target.value) || 5432,
                  })
                }
                placeholder={t('importModal.postgresql.form.portPlaceholder')}
                className="w-full p-2 bg-white/5 border border-white/20 rounded text-white placeholder:text-white/50 focus:outline-none focus:border-blue-500/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">
              {t('importModal.postgresql.form.database')}
            </label>
            <input
              type="text"
              value={formData.database}
              onChange={(e) =>
                setFormData({ ...formData, database: e.target.value })
              }
              placeholder={t('importModal.postgresql.form.databasePlaceholder')}
              className="w-full p-2 bg-white/5 border border-white/20 rounded text-white placeholder:text-white/50 focus:outline-none focus:border-blue-500/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">
              {t('importModal.postgresql.form.username')}
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) =>
                setFormData({ ...formData, username: e.target.value })
              }
              placeholder={t('importModal.postgresql.form.usernamePlaceholder')}
              className="w-full p-2 bg-white/5 border border-white/20 rounded text-white placeholder:text-white/50 focus:outline-none focus:border-blue-500/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">
              {t('importModal.postgresql.form.password')}
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              placeholder={t('importModal.postgresql.form.passwordPlaceholder')}
              className="w-full p-2 bg-white/5 border border-white/20 rounded text-white placeholder:text-white/50 focus:outline-none focus:border-blue-500/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">
              {t('importModal.postgresql.form.defaultSchema')}
            </label>
            <input
              type="text"
              value={formData.schema}
              onChange={(e) =>
                setFormData({ ...formData, schema: e.target.value })
              }
              placeholder={t('importModal.postgresql.form.schemaPlaceholder')}
              className="w-full p-2 bg-white/5 border border-white/20 rounded text-white placeholder:text-white/50 focus:outline-none focus:border-blue-500/50"
            />
          </div>

          {/* SSL Toggle */}
          <div className="flex items-center space-x-3">
            <input
              id="ssl-enabled"
              type="checkbox"
              checked={formData.sslEnabled}
              onChange={(e) =>
                setFormData({ ...formData, sslEnabled: e.target.checked })
              }
              className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-500"
            />
            <label htmlFor="ssl-enabled" className="text-sm text-white">
              {t('importModal.postgresql.form.enableSSL')}
            </label>
          </div>
        </div>

        {/* Error Display */}
        {connectionError && (
          <div className="mt-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg max-w-md">
            <div className="flex items-center text-red-400">
              <AlertCircle className="h-4 w-4 mr-2" />
              <span className="text-sm">{connectionError}</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-white/10">
        <div className="flex justify-end space-x-3">
          <Button
            variant="ghost"
            onClick={() => {
              setCurrentStep('connections');
              setEditingConnection(null);
            }}
            disabled={isConnecting}
          >
            {t('importModal.postgresql.form.cancel')}
          </Button>
          <Button
            onClick={handleCreateConnection}
            disabled={
              isConnecting ||
              !formData.name ||
              !formData.host ||
              !formData.database ||
              !formData.username ||
              !formData.password
            }
            className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 disabled:opacity-50"
          >
            {isConnecting ? (
              <>
                <Loader className="h-4 w-4 mr-2 animate-spin" />
                {t('importModal.postgresql.form.testing')}
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                {editingConnection ? t('importModal.postgresql.form.update') : t('importModal.postgresql.form.testCreate')}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );

  const renderTableSelector = () => (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-white">{t('importModal.postgresql.tables.title')}</h3>
            <p className="text-sm text-white/60 mt-1">
              {t('importModal.postgresql.tables.description', { name: selectedConnection?.name })}
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={() => setCurrentStep('connections')}
            size="sm"
          >
            {t('importModal.postgresql.tables.backToConnections')}
          </Button>
        </div>

        {/* Search */}
        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/40" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('importModal.postgresql.tables.searchPlaceholder')}
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/20 rounded text-white placeholder:text-white/50 focus:outline-none focus:border-blue-500/50"
          />
        </div>
      </div>

      {/* Error Display */}
      {schemaError && (
        <div className="mx-6 mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <div className="flex items-center text-red-400">
            <AlertCircle className="h-4 w-4 mr-2" />
            <span className="text-sm">{schemaError}</span>
          </div>
        </div>
      )}

      {/* Tables List */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoadingSchemas || isLoadingTables ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="h-6 w-6 animate-spin text-blue-400" />
            <span className="ml-2 text-white/60">{t('importModal.postgresql.loading.tables')}</span>
          </div>
        ) : filteredTables.length === 0 ? (
          <div className="text-center py-12">
            <Table className="h-12 w-12 text-white/30 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-white mb-2">
              {t('importModal.postgresql.noTables.title')}
            </h4>
            <p className="text-white/60">
              {searchTerm
                ? t('importModal.postgresql.noTables.noMatches')
                : t('importModal.postgresql.noTables.noTablesFound')}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTables.map((table) => {
              const isSelected = (selectedTables || []).some(
                (t) =>
                  t.schemaName === table.schemaName &&
                  t.tableName === table.tableName
              );

              return (
                <motion.div
                  key={`${table.schemaName}.${table.tableName}`}
                  className={cn(
                    'group p-4 rounded-lg border transition-all duration-200 cursor-pointer',
                    isSelected
                      ? 'bg-blue-500/10 border-blue-500/30'
                      : 'bg-white/5 border-white/10 hover:border-white/20'
                  )}
                  onClick={() => handleTableSelect(table)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div
                        className={cn(
                          'w-8 h-8 rounded-md flex items-center justify-center border',
                          table.tableType === 'table'
                            ? 'bg-green-500/20 border-green-500/30 text-green-400'
                            : 'bg-blue-500/20 border-blue-500/30 text-blue-400'
                        )}
                      >
                        <Table className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="font-medium text-white">
                          {table.schemaName}.{table.tableName}
                        </h4>
                        <p className="text-sm text-white/60">
                          {table.tableType} 
                          {/* •{' '} */}
                          {/* {table.rowCount?.toLocaleString() || '?'} rows */}
                        </p>
                      </div>
                    </div>

                    {isSelected && (
                      <CheckCircle className="h-5 w-5 text-blue-400" />
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      {(selectedTables || []).length > 0 && (
        <div className="p-6 border-t border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-sm text-white/60">
              {t('importModal.postgresql.tables.selectedCount', { count: (selectedTables || []).length })}
            </span>
            <Button
              variant="outline"
              onClick={handleImportTables}
              className=" hover:border-blue-500"
            >
              {t('importModal.postgresql.tables.connectSelected')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  if (!isAuthenticated) {
    return (
      <AuthGate
        title={t('importModal.postgresql.auth.title')}
        description={t('importModal.postgresql.auth.description')}
      />
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentStep}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.2 }}
        className="h-full"
      >
        {currentStep === 'connections' && renderConnectionsList()}
        {currentStep === 'form' && renderConnectionForm()}
        {currentStep === 'tables' && renderTableSelector()}
      </motion.div>
    </AnimatePresence>
  );
};

export default PostgreSQLPanel;
