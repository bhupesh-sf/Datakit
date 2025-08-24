import * as duckdb from 'duckdb';
import { Logger } from '@nestjs/common';
import { PostgresConnection } from '../entities/postgres-connection.entity';

export interface DuckDBConnectionOptions {
  connectionId: string;
  enableLogging?: boolean;
  memoryLimit?: string;
  threads?: number;
}

export interface PostgreSQLAttachOptions {
  connectionString: string;
  aliasName?: string;
  timeout?: number;
}

export class DatabaseConnectionUtil {
  private static readonly logger = new Logger(DatabaseConnectionUtil.name);

  /**
   * Creates and initializes a new DuckDB instance with PostgreSQL extension
   */
  static async createDuckDBInstance(
    options: DuckDBConnectionOptions,
  ): Promise<duckdb.Database> {
    const { connectionId, enableLogging = false } = options;

    return new Promise((resolve, reject) => {
      const db = new duckdb.Database(':memory:');

      // Configure DuckDB settings
      const configQueries = ['INSTALL postgres', 'LOAD postgres'];

      // Add optional configurations
      if (options.memoryLimit) {
        configQueries.push(`SET memory_limit='${options.memoryLimit}'`);
      }
      if (options.threads) {
        configQueries.push(`SET threads=${options.threads}`);
      }

      const executeConfig = (queries: string[], index = 0): void => {
        if (index >= queries.length) {
          if (enableLogging) {
            this.logger.log(
              `DuckDB instance created for connection ${connectionId}`,
            );
          }
          resolve(db);
          return;
        }

        db.exec(queries[index], (err) => {
          if (err) {
            this.logger.error(
              `Failed to configure DuckDB (${queries[index]}): ${err.message}`,
            );
            reject(err);
            return;
          }
          executeConfig(queries, index + 1);
        });
      };

      executeConfig(configQueries);
    });
  }

  /**
   * Safely attaches a PostgreSQL database to DuckDB
   */
  static async attachPostgreSQLDatabase(
    db: duckdb.Database,
    options: PostgreSQLAttachOptions,
  ): Promise<void> {
    const {
      connectionString,
      aliasName = 'pg_source',
      timeout = 30000,
    } = options;

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`PostgreSQL attach timeout after ${timeout}ms`));
      }, timeout);

      // First try to detach if already exists, then attach
      const detachQuery = `DETACH DATABASE IF EXISTS ${aliasName}`;

      db.exec(detachQuery, (detachErr) => {
        // Ignore detach errors (database might not exist)
        if (detachErr) {
          this.logger.warn(
            `Detach warning for ${aliasName}: ${detachErr.message}`,
          );
        }

        const attachQuery = `ATTACH '${connectionString}' AS ${aliasName} (TYPE postgres)`;

        db.exec(attachQuery, (err) => {
          clearTimeout(timeoutId);

          if (err) {
            this.logger.error(`Failed to attach PostgreSQL: ${err.message}`);
            reject(err);
            return;
          }

          // Verify attachment by testing a simple query
          const verificationQuery = `SELECT 1 as test FROM ${aliasName}.information_schema.schemata LIMIT 1`;

          db.all(verificationQuery, (verifyErr: Error | null, rows: any) => {
            if (verifyErr) {
              this.logger.error(
                `PostgreSQL attachment verification failed: ${verifyErr.message}`,
              );
              reject(
                new Error(
                  `PostgreSQL attachment failed verification: ${verifyErr.message}`,
                ),
              );
              return;
            }

            this.logger.log(
              `Successfully attached and verified PostgreSQL as ${aliasName}`,
            );
            resolve();
          });
        });
      });
    });
  }

  /**
   * Safely closes a DuckDB instance
   */
  static async closeDuckDBInstance(
    db: duckdb.Database,
    connectionId?: string,
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      db.close((err) => {
        if (err) {
          this.logger.warn(
            `Error closing DuckDB instance ${connectionId || 'unknown'}: ${err.message}`,
          );
        } else if (connectionId) {
          this.logger.log(
            `Closed DuckDB instance for connection ${connectionId}`,
          );
        }
        resolve();
      });
    });
  }

  /**
   * Executes a query with timeout and error handling
   */
  static async executeQuery<T = any>(
    db: duckdb.Database,
    sql: string,
    params: any[] = [],
    timeout: number = 30000,
  ): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Query timeout after ${timeout}ms`));
      }, timeout);

      const callback = (err: Error | null, rows: any) => {
        clearTimeout(timeoutId);

        if (err) {
          reject(err);
          return;
        }

        resolve((rows || []) as T[]);
      };

      // Cast to any to handle overload issues
      if (params.length > 0) {
        (db as any).all(sql, params, callback);
      } else {
        (db as any).all(sql, callback);
      }
    });
  }

  /**
   * Executes a single row query
   */
  static async executeQuerySingle<T = any>(
    db: duckdb.Database,
    sql: string,
    params: any[] = [],
    timeout: number = 30000,
  ): Promise<T | null> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Query timeout after ${timeout}ms`));
      }, timeout);

      const callback = (err: Error | null, row: any) => {
        clearTimeout(timeoutId);

        if (err) {
          reject(err);
          return;
        }

        resolve((row as T) || null);
      };

      // Cast to any to handle overload issues
      if (params.length > 0) {
        (db as any).get(sql, params, callback);
      } else {
        (db as any).get(sql, callback);
      }
    });
  }

  /**
   * Builds a safe PostgreSQL connection string
   */
  static buildConnectionString(
    connection: PostgresConnection,
    password: string,
  ): string {
    const { host, port, database, username, sslEnabled } = connection;

    // Validate inputs
    if (!host || !port || !database || !username || !password) {
      throw new Error('Missing required connection parameters');
    }

    // Basic validation for host (prevent injection)
    if (!/^[a-zA-Z0-9._-]+$/.test(host)) {
      throw new Error('Invalid host format');
    }

    // Build connection string
    const sslParam = sslEnabled ? '?sslmode=require' : '';
    return `postgresql://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(database)}${sslParam}`;
  }

  /**
   * Validates a connection configuration
   */
  static validateConnectionConfig(
    connection: Partial<PostgresConnection>,
  ): string[] {
    const errors: string[] = [];

    if (!connection.host) {
      errors.push('Host is required');
    } else if (!/^[a-zA-Z0-9._-]+$/.test(connection.host)) {
      errors.push('Host contains invalid characters');
    }

    if (!connection.port) {
      errors.push('Port is required');
    } else if (connection.port < 1 || connection.port > 65535) {
      errors.push('Port must be between 1 and 65535');
    }

    if (!connection.database) {
      errors.push('Database name is required');
    }

    if (!connection.username) {
      errors.push('Username is required');
    }

    return errors;
  }
}
