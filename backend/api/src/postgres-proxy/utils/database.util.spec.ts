import { DatabaseConnectionUtil } from './database.util';
import { PostgresConnection } from '../entities/postgres-connection.entity';
import * as duckdb from 'duckdb';

jest.mock('duckdb');
jest.mock('@nestjs/common', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  })),
}));

describe('DatabaseConnectionUtil', () => {
  let mockDatabase: Partial<duckdb.Database>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDatabase = {
      exec: jest.fn(),
      all: jest.fn(),
      get: jest.fn(),
      close: jest.fn(),
    };

    (duckdb.Database as jest.MockedClass<typeof duckdb.Database>) = jest
      .fn()
      .mockImplementation(() => mockDatabase);
  });

  describe('createDuckDBInstance', () => {
    it('should create DuckDB instance with basic configuration', async () => {
      const mockExec = mockDatabase.exec as jest.Mock;
      mockExec.mockImplementation((query, callback) => callback(null));

      const options = { connectionId: 'test-conn-1' };
      const result = await DatabaseConnectionUtil.createDuckDBInstance(options);

      expect(result).toBe(mockDatabase);
      expect(mockExec).toHaveBeenCalledWith(
        'INSTALL postgres',
        expect.any(Function),
      );
      expect(mockExec).toHaveBeenCalledWith(
        'LOAD postgres',
        expect.any(Function),
      );
    });

    it('should apply memory and thread configuration', async () => {
      const mockExec = mockDatabase.exec as jest.Mock;
      mockExec.mockImplementation((query, callback) => callback(null));

      const options = {
        connectionId: 'test-conn-1',
        memoryLimit: '1GB',
        threads: 2,
      };

      await DatabaseConnectionUtil.createDuckDBInstance(options);

      expect(mockExec).toHaveBeenCalledWith(
        "SET memory_limit='1GB'",
        expect.any(Function),
      );
      expect(mockExec).toHaveBeenCalledWith(
        'SET threads=2',
        expect.any(Function),
      );
    });

    it('should reject on configuration error', async () => {
      const mockExec = mockDatabase.exec as jest.Mock;
      mockExec.mockImplementation((query, callback) => {
        if (query === 'INSTALL postgres') {
          callback(new Error('Extension not found'));
        } else {
          callback(null);
        }
      });

      const options = { connectionId: 'test-conn-1' };

      await expect(
        DatabaseConnectionUtil.createDuckDBInstance(options),
      ).rejects.toThrow('Extension not found');
    });
  });

  describe('attachPostgreSQLDatabase', () => {
    it('should attach PostgreSQL database successfully', async () => {
      const mockExec = mockDatabase.exec as jest.Mock;
      mockExec.mockImplementation((query, callback) => {
        expect(query).toBe(
          "ATTACH 'postgresql://user:pass@localhost:5432/testdb' AS pg_source (TYPE postgres)",
        );
        callback(null);
      });

      const options = {
        connectionString: 'postgresql://user:pass@localhost:5432/testdb',
      };

      await expect(
        DatabaseConnectionUtil.attachPostgreSQLDatabase(
          mockDatabase as duckdb.Database,
          options,
        ),
      ).resolves.toBeUndefined();
    });

    it('should use custom alias name', async () => {
      const mockExec = mockDatabase.exec as jest.Mock;
      mockExec.mockImplementation((query, callback) => {
        expect(query).toBe(
          "ATTACH 'postgresql://user:pass@localhost:5432/testdb' AS custom_db (TYPE postgres)",
        );
        callback(null);
      });

      const options = {
        connectionString: 'postgresql://user:pass@localhost:5432/testdb',
        aliasName: 'custom_db',
      };

      await DatabaseConnectionUtil.attachPostgreSQLDatabase(
        mockDatabase as duckdb.Database,
        options,
      );
    });

    it('should timeout on long attach operations', async () => {
      const mockExec = mockDatabase.exec as jest.Mock;
      mockExec.mockImplementation(() => {
        // Never call the callback to simulate hanging
      });

      const options = {
        connectionString: 'postgresql://user:pass@localhost:5432/testdb',
        timeout: 100, // 100ms timeout
      };

      await expect(
        DatabaseConnectionUtil.attachPostgreSQLDatabase(
          mockDatabase as duckdb.Database,
          options,
        ),
      ).rejects.toThrow('PostgreSQL attach timeout after 100ms');
    });

    it('should handle attach errors', async () => {
      const mockExec = mockDatabase.exec as jest.Mock;
      mockExec.mockImplementation((query, callback) => {
        callback(new Error('Connection refused'));
      });

      const options = {
        connectionString: 'postgresql://user:pass@localhost:5432/testdb',
      };

      await expect(
        DatabaseConnectionUtil.attachPostgreSQLDatabase(
          mockDatabase as duckdb.Database,
          options,
        ),
      ).rejects.toThrow('Connection refused');
    });
  });

  describe('executeQuery', () => {
    it('should execute query and return results', async () => {
      const mockAll = mockDatabase.all as jest.Mock;
      const mockResults = [
        { id: 1, name: 'test' },
        { id: 2, name: 'test2' },
      ];
      mockAll.mockImplementation((sql, callbackOrParams, maybeCallback) => {
        // Handle both signatures: (sql, callback) and (sql, params, callback)
        const callback =
          typeof callbackOrParams === 'function'
            ? callbackOrParams
            : maybeCallback;
        callback(null, mockResults);
      });

      const result = await DatabaseConnectionUtil.executeQuery(
        mockDatabase as duckdb.Database,
        'SELECT * FROM users',
        [],
        30000,
      );

      expect(result).toEqual(mockResults);
      // When params array is empty, the utility calls the no-params signature
      expect(mockAll).toHaveBeenCalledWith(
        'SELECT * FROM users',
        expect.any(Function),
      );
    });

    it('should handle query with parameters', async () => {
      const mockAll = mockDatabase.all as jest.Mock;
      mockAll.mockImplementation((sql, params, callback) => {
        expect(params).toEqual([1, 'test']);
        callback(null, []);
      });

      await DatabaseConnectionUtil.executeQuery(
        mockDatabase as duckdb.Database,
        'SELECT * FROM users WHERE id = ? AND name = ?',
        [1, 'test'],
      );
    });

    it('should timeout on long-running queries', async () => {
      const mockAll = mockDatabase.all as jest.Mock;
      mockAll.mockImplementation(() => {
        // Never call the callback
      });

      await expect(
        DatabaseConnectionUtil.executeQuery(
          mockDatabase as duckdb.Database,
          'SELECT * FROM users',
          [],
          100, // 100ms timeout
        ),
      ).rejects.toThrow('Query timeout after 100ms');
    });

    it('should handle query errors', async () => {
      const mockAll = mockDatabase.all as jest.Mock;
      mockAll.mockImplementation((sql, callbackOrParams, maybeCallback) => {
        const callback =
          typeof callbackOrParams === 'function'
            ? callbackOrParams
            : maybeCallback;
        callback(new Error('Syntax error'));
      });

      await expect(
        DatabaseConnectionUtil.executeQuery(
          mockDatabase as duckdb.Database,
          'INVALID SQL',
          [],
        ),
      ).rejects.toThrow('Syntax error');
    });

    it('should return empty array for null results', async () => {
      const mockAll = mockDatabase.all as jest.Mock;
      mockAll.mockImplementation((sql, callbackOrParams, maybeCallback) => {
        const callback =
          typeof callbackOrParams === 'function'
            ? callbackOrParams
            : maybeCallback;
        callback(null, null);
      });

      const result = await DatabaseConnectionUtil.executeQuery(
        mockDatabase as duckdb.Database,
        'SELECT * FROM empty_table',
      );

      expect(result).toEqual([]);
    });
  });

  describe('executeQuerySingle', () => {
    it('should return single row result', async () => {
      const mockGet = mockDatabase.get as jest.Mock;
      const mockResult = { count: 5 };
      mockGet.mockImplementation((sql, callbackOrParams, maybeCallback) => {
        const callback =
          typeof callbackOrParams === 'function'
            ? callbackOrParams
            : maybeCallback;
        callback(null, mockResult);
      });

      const result = await DatabaseConnectionUtil.executeQuerySingle(
        mockDatabase as duckdb.Database,
        'SELECT COUNT(*) as count FROM users',
      );

      expect(result).toEqual(mockResult);
    });

    it('should return null when no row found', async () => {
      const mockGet = mockDatabase.get as jest.Mock;
      mockGet.mockImplementation((sql, callbackOrParams, maybeCallback) => {
        const callback =
          typeof callbackOrParams === 'function'
            ? callbackOrParams
            : maybeCallback;
        callback(null, undefined);
      });

      const result = await DatabaseConnectionUtil.executeQuerySingle(
        mockDatabase as duckdb.Database,
        'SELECT * FROM users WHERE id = 999',
      );

      expect(result).toBeNull();
    });
  });

  describe('closeDuckDBInstance', () => {
    it('should close database successfully', async () => {
      const mockClose = mockDatabase.close as jest.Mock;
      mockClose.mockImplementation((callback) => callback(null));

      await expect(
        DatabaseConnectionUtil.closeDuckDBInstance(
          mockDatabase as duckdb.Database,
          'test-conn-1',
        ),
      ).resolves.toBeUndefined();

      expect(mockClose).toHaveBeenCalled();
    });

    it('should handle close errors gracefully', async () => {
      const mockClose = mockDatabase.close as jest.Mock;
      mockClose.mockImplementation((callback) =>
        callback(new Error('Close error')),
      );

      await expect(
        DatabaseConnectionUtil.closeDuckDBInstance(
          mockDatabase as duckdb.Database,
          'test-conn-1',
        ),
      ).resolves.toBeUndefined(); // Should not throw
    });
  });

  describe('buildConnectionString', () => {
    const mockConnection: PostgresConnection = {
      id: '1',
      name: 'test',
      host: 'localhost',
      port: 5432,
      database: 'testdb',
      username: 'user',
      schema: 'public',
      sslEnabled: false,
      connectionTimeout: 30,
      queryTimeout: 60000,
      encryptedPassword: 'encrypted',
      userId: 'user1',
      user: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      toConnectionString: jest.fn(),
      toSafeObject: jest.fn(),
    } as unknown as PostgresConnection;

    it('should build basic connection string', () => {
      const result = DatabaseConnectionUtil.buildConnectionString(
        mockConnection,
        'password123',
      );

      expect(result).toBe(
        'postgresql://user:password123@localhost:5432/testdb',
      );
    });

    it('should build SSL connection string', () => {
      const sslConnection = {
        ...mockConnection,
        sslEnabled: true,
      } as PostgresConnection;
      const result = DatabaseConnectionUtil.buildConnectionString(
        sslConnection,
        'password123',
      );

      expect(result).toBe(
        'postgresql://user:password123@localhost:5432/testdb?sslmode=require',
      );
    });

    it('should encode special characters in connection parameters', () => {
      const specialConnection = {
        ...mockConnection,
        username: 'user@domain',
        database: 'test-db',
      } as PostgresConnection;
      const result = DatabaseConnectionUtil.buildConnectionString(
        specialConnection,
        'pass@word',
      );

      expect(result).toBe(
        'postgresql://user%40domain:pass%40word@localhost:5432/test-db',
      );
    });

    it('should throw error for missing parameters', () => {
      const incompleteConnection = {
        ...mockConnection,
        host: '',
      } as PostgresConnection;

      expect(() =>
        DatabaseConnectionUtil.buildConnectionString(
          incompleteConnection,
          'password',
        ),
      ).toThrow('Missing required connection parameters');
    });

    it('should throw error for invalid host format', () => {
      const invalidConnection = {
        ...mockConnection,
        host: 'host with spaces',
      } as PostgresConnection;

      expect(() =>
        DatabaseConnectionUtil.buildConnectionString(
          invalidConnection,
          'password',
        ),
      ).toThrow('Invalid host format');
    });
  });

  describe('validateConnectionConfig', () => {
    it('should return no errors for valid connection', () => {
      const validConnection = {
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'user',
      };

      const errors =
        DatabaseConnectionUtil.validateConnectionConfig(validConnection);
      expect(errors).toEqual([]);
    });

    it('should return errors for missing required fields', () => {
      const invalidConnection = {
        host: '',
        port: 0,
        database: '',
        username: '',
      };

      const errors =
        DatabaseConnectionUtil.validateConnectionConfig(invalidConnection);

      expect(errors).toContain('Host is required');
      expect(errors).toContain('Port is required');
      expect(errors).toContain('Database name is required');
      expect(errors).toContain('Username is required');
    });

    it('should validate port range', () => {
      const invalidPorts = [{ port: -1 }, { port: 65536 }, { port: 99999 }];

      invalidPorts.forEach((config) => {
        const errors = DatabaseConnectionUtil.validateConnectionConfig({
          host: 'localhost',
          database: 'db',
          username: 'user',
          ...config,
        });
        expect(errors).toContain('Port must be between 1 and 65535');
      });

      // Port 0 is a special case - it's considered "missing"
      const zeroPortErrors = DatabaseConnectionUtil.validateConnectionConfig({
        host: 'localhost',
        database: 'db',
        username: 'user',
        port: 0,
      });
      expect(zeroPortErrors).toContain('Port is required');
    });

    it('should validate host format', () => {
      const invalidHosts = [
        'host with spaces',
        'host;with;semicolons',
        'host/with/slashes',
      ];

      invalidHosts.forEach((host) => {
        const errors = DatabaseConnectionUtil.validateConnectionConfig({
          host,
          port: 5432,
          database: 'db',
          username: 'user',
        });
        expect(errors).toContain('Host contains invalid characters');
      });
    });

    it('should allow valid host formats', () => {
      const validHosts = [
        'localhost',
        '127.0.0.1',
        'db.example.com',
        'db-server.local',
        'db_server',
      ];

      validHosts.forEach((host) => {
        const errors = DatabaseConnectionUtil.validateConnectionConfig({
          host,
          port: 5432,
          database: 'db',
          username: 'user',
        });
        expect(errors).not.toContain('Host contains invalid characters');
      });
    });
  });
});
