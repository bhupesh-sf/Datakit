/**
 * Unit tests for Query Router Utility
 */

import { QueryRouter, analyzeQuery, PostgreSQLVirtualTable } from './queryRouter';

describe('QueryRouter', () => {
  let router: QueryRouter;
  let mockPostgresVirtualTables: Map<string, PostgreSQLVirtualTable>;
  let mockPostgresActiveConnections: Set<string>;
  let mockMotherDuckDatabases: Set<string>;

  beforeEach(() => {
    // Mock PostgreSQL virtual tables
    mockPostgresVirtualTables = new Map([
      ['public.users', { connectionId: 'pg-conn-1', schemaName: 'public', tableName: 'users' }],
      ['public.orders', { connectionId: 'pg-conn-1', schemaName: 'public', tableName: 'orders' }],
      ['inventory.products', { connectionId: 'pg-conn-2', schemaName: 'inventory', tableName: 'products' }],
    ]);

    mockPostgresActiveConnections = new Set(['pg-conn-1', 'pg-conn-2']);
    
    mockMotherDuckDatabases = new Set(['my_db', 'sample_data', 'analytics_db']);

    router = new QueryRouter(
      mockPostgresVirtualTables,
      mockPostgresActiveConnections,
      mockMotherDuckDatabases
    );
  });

  describe('PostgreSQL Query Detection', () => {
    it('should detect quoted PostgreSQL table references', () => {
      const sql = 'SELECT * FROM "public"."users" WHERE id = 1';
      const result = router.analyzeQuery(sql);

      expect(result.target).toBe('postgresql');
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.connectionId).toBe('pg-conn-1');
      expect(result.postgresqlTables).toHaveLength(1);
      expect(result.postgresqlTables[0]).toEqual({
        schema: 'public',
        table: 'users',
        isQuoted: true,
      });
    });

    it('should detect unquoted PostgreSQL table references', () => {
      const sql = 'SELECT * FROM public.users LIMIT 10';
      const result = router.analyzeQuery(sql);

      expect(result.target).toBe('postgresql');
      expect(result.connectionId).toBe('pg-conn-1');
      expect(result.postgresqlTables[0]).toEqual({
        schema: 'public',
        table: 'users',
        isQuoted: false,
      });
    });

    it('should detect PostgreSQL tables with default public schema', () => {
      const sql = 'SELECT * FROM users';
      const result = router.analyzeQuery(sql);

      expect(result.target).toBe('postgresql');
      expect(result.connectionId).toBe('pg-conn-1');
      expect(result.reasoning).toContain('PostgreSQL');
    });

    it('should handle complex PostgreSQL queries with JOINs', () => {
      const sql = `
        SELECT u.name, o.total 
        FROM public.users u 
        JOIN public.orders o ON u.id = o.user_id 
        WHERE o.total > 100
      `;
      const result = router.analyzeQuery(sql);

      expect(result.target).toBe('postgresql');
      expect(result.postgresqlTables).toHaveLength(2);
      expect(result.postgresqlTables.map(t => t.table)).toContain('users');
      expect(result.postgresqlTables.map(t => t.table)).toContain('orders');
    });

    it('should handle different schema PostgreSQL tables', () => {
      const sql = 'SELECT * FROM inventory.products WHERE category = "electronics"';
      const result = router.analyzeQuery(sql);

      expect(result.target).toBe('postgresql');
      expect(result.connectionId).toBe('pg-conn-2');
      expect(result.postgresqlTables[0]).toEqual({
        schema: 'inventory',
        table: 'products',
        isQuoted: false,
      });
    });
  });

  describe('MotherDuck Query Detection', () => {
    it('should detect MotherDuck database references', () => {
      const sql = 'SELECT * FROM my_db.schema.table';
      const result = router.analyzeQuery(sql);

      expect(result.target).toBe('motherduck');
      expect(result.motherduckTables).toHaveLength(1);
      expect(result.motherduckTables[0]).toEqual({
        database: 'my_db',
        schema: 'schema',
        table: 'table',
        isQuoted: false,
      });
    });

    it('should detect quoted MotherDuck references', () => {
      const sql = 'SELECT * FROM "sample_data"."main"."employees"';
      const result = router.analyzeQuery(sql);

      expect(result.target).toBe('motherduck');
      expect(result.motherduckTables[0]).toEqual({
        database: 'sample_data',
        schema: 'main',
        table: 'employees',
        isQuoted: true,
      });
    });
  });

  describe('Local DuckDB Query Detection', () => {
    it('should detect local table references', () => {
      const sql = 'SELECT * FROM local_table';
      const result = router.analyzeQuery(sql);

      expect(result.target).toBe('local');
      expect(result.localTables).toHaveLength(1);
      expect(result.localTables[0]).toEqual({
        table: 'local_table',
        isQuoted: false,
      });
    });

    it('should handle quoted local tables', () => {
      const sql = 'SELECT * FROM "my local file.csv"';
      const result = router.analyzeQuery(sql);

      expect(result.target).toBe('local');
      expect(result.localTables[0]).toEqual({
        table: 'my local file.csv',
        isQuoted: true,
      });
    });
  });

  describe('Hybrid Query Detection', () => {
    it('should detect cross-database queries', () => {
      const sql = `
        SELECT p.name, u.email 
        FROM inventory.products p 
        JOIN my_db.users.profile u ON p.user_id = u.id
      `;
      const result = router.analyzeQuery(sql);

      expect(result.target).toBe('hybrid');
      expect(result.confidence).toBe(1.0);
      expect(result.postgresqlTables).toHaveLength(1);
      expect(result.motherduckTables).toHaveLength(1);
      expect(result.reasoning).toContain('Cross-database query');
    });

    it('should detect PostgreSQL + Local hybrid queries', () => {
      const sql = `
        SELECT p.name, l.data 
        FROM public.users p 
        JOIN local_table l ON p.id = l.user_id
      `;
      const result = router.analyzeQuery(sql);

      expect(result.target).toBe('hybrid');
      expect(result.postgresqlTables).toHaveLength(1);
      expect(result.localTables).toHaveLength(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle queries with no table references', () => {
      const sql = 'SELECT 1 as test';
      const result = router.analyzeQuery(sql);

      expect(result.target).toBe('local');
      expect(result.confidence).toBe(0.5);
      expect(result.reasoning).toContain('No table references');
    });

    it('should handle complex SQL with subqueries', () => {
      const sql = `
        SELECT * FROM (
          SELECT user_id, COUNT(*) as order_count 
          FROM public.orders 
          GROUP BY user_id
        ) subquery 
        WHERE order_count > 5
      `;
      const result = router.analyzeQuery(sql);

      expect(result.target).toBe('postgresql');
      expect(result.postgresqlTables).toHaveLength(1);
      expect(result.postgresqlTables[0].table).toBe('orders');
    });

    it('should handle INSERT/UPDATE/DELETE queries', () => {
      const sql = 'INSERT INTO public.users (name, email) VALUES ("John", "john@example.com")';
      const result = router.analyzeQuery(sql);

      expect(result.target).toBe('postgresql');
      expect(result.postgresqlTables[0].table).toBe('users');
    });

    it('should handle inactive PostgreSQL connections', () => {
      // Remove connection from active set
      mockPostgresActiveConnections.delete('pg-conn-1');
      router.updatePostgreSQLState(mockPostgresVirtualTables, mockPostgresActiveConnections);

      const sql = 'SELECT * FROM public.users';
      const result = router.analyzeQuery(sql);

      expect(result.target).toBe('postgresql');
      expect(result.confidence).toBeLessThan(0.8); // Lower confidence for inactive connection
      expect(result.reasoning).toContain('not found');
    });
  });

  describe('Real-world Test Cases', () => {
    it('should handle the user reported case', () => {
      const sql = `-- Sample employee data is available for testing
-- Import your own files to query your data
SELECT *
FROM "public"."users"
LIMIT 10;`;
      
      const result = router.analyzeQuery(sql);

      expect(result.target).toBe('postgresql');
      expect(result.connectionId).toBe('pg-conn-1');
      expect(result.postgresqlTables).toHaveLength(1);
      expect(result.postgresqlTables[0]).toEqual({
        schema: 'public',
        table: 'users',
        isQuoted: true,
      });
    });

    it('should handle unquoted version of user reported case', () => {
      const sql = 'SELECT * FROM public.users LIMIT 10';
      const result = router.analyzeQuery(sql);

      expect(result.target).toBe('postgresql');
      expect(result.connectionId).toBe('pg-conn-1');
    });

    it('should handle queries with aliases and complex formatting', () => {
      const sql = `
        SELECT 
          u.id,
          u.name,
          COUNT(o.id) as order_count
        FROM public.users AS u
        LEFT JOIN public.orders o ON u.id = o.user_id
        WHERE u.created_at > '2024-01-01'
        GROUP BY u.id, u.name
        ORDER BY order_count DESC
      `;
      
      const result = router.analyzeQuery(sql);

      expect(result.target).toBe('postgresql');
      expect(result.postgresqlTables).toHaveLength(2);
      expect(result.postgresqlTables.map(t => t.table).sort()).toEqual(['orders', 'users']);
    });
  });
});

describe('analyzeQuery convenience function', () => {
  it('should work with provided parameters', () => {
    const mockVirtualTables = new Map([
      ['public.test', { connectionId: 'test-conn', schemaName: 'public', tableName: 'test' }]
    ]);
    const mockActiveConnections = new Set(['test-conn']);

    const result = analyzeQuery(
      'SELECT * FROM public.test',
      mockVirtualTables,
      mockActiveConnections
    );

    expect(result.target).toBe('postgresql');
    expect(result.connectionId).toBe('test-conn');
  });
});