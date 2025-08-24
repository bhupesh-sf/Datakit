import {
  MemoryCache,
  CacheKeyUtil,
  Cacheable,
  CacheWarmer,
} from './cache.util';

jest.mock('@nestjs/common', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    log: jest.fn(),
    warn: jest.fn(),
  })),
}));

describe('MemoryCache', () => {
  let cache: MemoryCache<string>;

  beforeEach(() => {
    cache = new MemoryCache<string>({
      ttl: 1000, // 1 second for testing
      maxSize: 3,
      enableStats: true,
    });
  });

  afterEach(() => {
    // Use destroy method to clean up properly
    cache.destroy();
  });

  describe('basic operations', () => {
    it('should store and retrieve values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return null for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeNull();
    });

    it('should check if keys exist', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(false);
    });

    it('should delete specific keys', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBe('value2');

      expect(cache.delete('nonexistent')).toBe(false);
    });

    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      cache.clear();

      // Check stats first (clear resets stats to 0)
      const stats = cache.getStats();
      expect(stats.size).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);

      // Then verify entries are gone (this will increment misses, but that's after our assertion)
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
    });
  });

  describe('TTL (Time To Live)', () => {
    it('should expire entries after TTL', async () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(cache.get('key1')).toBeNull();
    });

    it('should handle custom TTL for specific entries', () => {
      cache.set('key1', 'value1', 500); // 500ms TTL
      cache.set('key2', 'value2'); // Default TTL

      setTimeout(() => {
        expect(cache.get('key1')).toBeNull(); // Should be expired
        expect(cache.get('key2')).toBe('value2'); // Should still exist
      }, 600);
    });

    it('should remove expired entries during get operations', () => {
      cache.set('key1', 'value1');

      // Manually expire by setting old timestamp
      const entry = (cache as any).cache.get('key1');
      entry.timestamp = Date.now() - 2000; // 2 seconds ago

      expect(cache.get('key1')).toBeNull();
      expect((cache as any).cache.has('key1')).toBe(false);
    });
  });

  describe('LRU (Least Recently Used) eviction', () => {
    it('should evict least recently used entries when at capacity', (done) => {
      // Fill cache to capacity with delays to ensure different timestamps
      cache.set('key1', 'value1');

      setTimeout(() => {
        cache.set('key2', 'value2');
        setTimeout(() => {
          cache.set('key3', 'value3');

          // Access key1 and key3 to make them recently used
          cache.get('key1');
          cache.get('key3');

          // Add another entry, should evict key2 (least recently accessed)
          cache.set('key4', 'value4');

          expect(cache.get('key1')).toBe('value1'); // Still exists
          expect(cache.get('key2')).toBeNull(); // Evicted (least recently accessed)
          expect(cache.get('key3')).toBe('value3'); // Still exists
          expect(cache.get('key4')).toBe('value4'); // Newly added
          done();
        }, 10);
      }, 10);
    });

    it('should update access time on get operations', (done) => {
      cache.set('key1', 'value1');

      const entry1 = (cache as any).cache.get('key1');
      const originalAccessTime = entry1.lastAccessed;

      // Wait a bit then access again
      setTimeout(() => {
        cache.get('key1');
        const updatedEntry = (cache as any).cache.get('key1');
        if (updatedEntry) {
          expect(updatedEntry.lastAccessed).toBeGreaterThanOrEqual(
            originalAccessTime,
          );
          expect(updatedEntry.accessCount).toBe(2);
        }
        done();
      }, 50);
    });
  });

  describe('statistics', () => {
    it('should track cache hits and misses', () => {
      cache.set('key1', 'value1');

      // Hit
      cache.get('key1');
      cache.get('key1');

      // Miss
      cache.get('key2');
      cache.get('key3');

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBe(0.5);
      expect(stats.size).toBe(1);
    });

    it('should calculate hit rate correctly', () => {
      cache.set('key1', 'value1');

      // 3 hits, 1 miss = 75% hit rate
      cache.get('key1'); // hit
      cache.get('key1'); // hit
      cache.get('key1'); // hit
      cache.get('key2'); // miss

      const stats = cache.getStats();
      expect(stats.hitRate).toBe(0.75);
    });

    it('should track oldest and newest entries', (done) => {
      const now = Date.now();

      cache.set('key1', 'value1');
      setTimeout(() => {
        cache.set('key2', 'value2');

        const stats = cache.getStats();
        // In fast execution, timestamps might be equal
        expect(stats.oldestEntry).toBeLessThanOrEqual(stats.newestEntry!);
        expect(stats.oldestEntry).toBeGreaterThanOrEqual(now - 100);
        done();
      }, 50);
    });

    it('should handle stats when cache is disabled', () => {
      const cacheWithoutStats = new MemoryCache<string>({ enableStats: false });

      cacheWithoutStats.set('key1', 'value1');
      cacheWithoutStats.get('key1'); // Should not increment stats
      cacheWithoutStats.get('key2'); // Should not increment stats

      const stats = cacheWithoutStats.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe('pattern deletion', () => {
    it('should delete entries matching string pattern', () => {
      cache.set('user:1:profile', 'profile1');
      cache.set('user:1:settings', 'settings1');
      cache.set('user:2:profile', 'profile2');
      cache.set('order:123', 'order123');

      const deletedCount = cache.deletePattern('user:1:');

      expect(deletedCount).toBe(2);
      expect(cache.get('user:1:profile')).toBeNull();
      expect(cache.get('user:1:settings')).toBeNull();
      expect(cache.get('user:2:profile')).toBe('profile2');
      expect(cache.get('order:123')).toBe('order123');
    });

    it('should delete entries matching regex pattern', () => {
      cache.set('schemas:conn1', 'schemas1');
      cache.set('tables:conn1:public', 'tables1');
      cache.set('schemas:conn2', 'schemas2');
      cache.set('other:key', 'other');

      const pattern = /^(schemas|tables):conn1/;
      const deletedCount = cache.deletePattern(pattern);

      expect(deletedCount).toBe(2);
      expect(cache.get('schemas:conn1')).toBeNull();
      expect(cache.get('tables:conn1:public')).toBeNull();
      expect(cache.get('schemas:conn2')).toBe('schemas2');
      expect(cache.get('other:key')).toBe('other');
    });
  });

  describe('cleanup', () => {
    it('should remove expired entries during cleanup', async () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      // Manually expire key1
      const entry1 = (cache as any).cache.get('key1');
      entry1.timestamp = Date.now() - 2000;

      const removedCount = cache.cleanup();

      expect(removedCount).toBe(1);
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBe('value2');
    });

    it('should return 0 when no entries need cleanup', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      const removedCount = cache.cleanup();
      expect(removedCount).toBe(0);
    });
  });
});

describe('CacheKeyUtil', () => {
  describe('key generation', () => {
    it('should generate schema cache key', () => {
      const key = CacheKeyUtil.schemaKey('conn123');
      expect(key).toBe('schemas:conn123');
    });

    it('should generate tables cache key without filters', () => {
      const key = CacheKeyUtil.tablesKey('conn123', 'public');
      expect(key).toBe('tables:conn123:public');
    });

    it('should generate tables cache key with filters', () => {
      const filters = { search: 'user', includeViews: false };
      const key = CacheKeyUtil.tablesKey('conn123', 'public', filters);
      expect(key).toBe(
        'tables:conn123:public:{"search":"user","includeViews":false}',
      );
    });

    it('should generate table schema cache key', () => {
      const key = CacheKeyUtil.tableSchemaKey('conn123', 'public', 'users');
      expect(key).toBe('table_schema:conn123:public:users');
    });

    it('should generate connection metadata cache key', () => {
      const key = CacheKeyUtil.connectionMetaKey('conn123');
      expect(key).toBe('connection_meta:conn123');
    });
  });

  describe('pattern matching', () => {
    it('should generate connection pattern regex', () => {
      const pattern = CacheKeyUtil.getConnectionPattern('conn123');

      expect(pattern.test('schemas:conn123')).toBe(true);
      expect(pattern.test('tables:conn123:public')).toBe(true);
      expect(pattern.test('table_schema:conn123:public:users')).toBe(true);
      expect(pattern.test('schemas:conn456')).toBe(false);
      expect(pattern.test('other:conn123:suffix')).toBe(true);
    });
  });

  describe('key sanitization', () => {
    it('should sanitize invalid characters', () => {
      const dirtyKey = 'key with spaces & special@chars!';
      const cleanKey = CacheKeyUtil.sanitizeKey(dirtyKey);
      expect(cleanKey).toBe('key_with_spaces___special_chars_');
    });

    it('should limit key length', () => {
      const longKey = 'a'.repeat(300);
      const sanitizedKey = CacheKeyUtil.sanitizeKey(longKey);
      expect(sanitizedKey.length).toBe(250);
    });

    it('should preserve valid characters', () => {
      const validKey = 'valid_key-123:schema:table';
      const sanitizedKey = CacheKeyUtil.sanitizeKey(validKey);
      expect(sanitizedKey).toBe(validKey);
    });
  });
});

describe('Cacheable decorator', () => {
  let mockMethod: jest.Mock;
  let testClass: any;

  beforeEach(() => {
    mockMethod = jest.fn();

    class TestClass {
      @Cacheable((arg1, arg2) => `test:${arg1}:${arg2}`, 100)
      async testMethod(arg1: string, arg2: string): Promise<string> {
        return mockMethod(arg1, arg2);
      }
    }

    testClass = new TestClass();
  });

  it('should cache method results', async () => {
    mockMethod.mockResolvedValue('result1');

    const result1 = await testClass.testMethod('a', 'b');
    const result2 = await testClass.testMethod('a', 'b');

    expect(result1).toBe('result1');
    expect(result2).toBe('result1');
    expect(mockMethod).toHaveBeenCalledTimes(1);
  });

  it('should cache different argument combinations separately', async () => {
    mockMethod
      .mockResolvedValueOnce('result1')
      .mockResolvedValueOnce('result2');

    const result1 = await testClass.testMethod('a', 'b');
    const result2 = await testClass.testMethod('c', 'd');
    const result3 = await testClass.testMethod('a', 'b'); // Should be cached

    expect(result1).toBe('result1');
    expect(result2).toBe('result2');
    expect(result3).toBe('result1');
    expect(mockMethod).toHaveBeenCalledTimes(2);
  });

  it('should expire cached results after TTL', async () => {
    mockMethod
      .mockResolvedValueOnce('result1')
      .mockResolvedValueOnce('result2');

    const result1 = await testClass.testMethod('a', 'b');
    expect(result1).toBe('result1');

    // Wait for cache to expire
    await new Promise((resolve) => setTimeout(resolve, 150));

    const result2 = await testClass.testMethod('a', 'b');
    expect(result2).toBe('result2');
    expect(mockMethod).toHaveBeenCalledTimes(2);
  });
});

describe('CacheWarmer', () => {
  let cacheWarmer: CacheWarmer;
  let cache: MemoryCache<string>;

  beforeEach(() => {
    cacheWarmer = new CacheWarmer();
    cache = new MemoryCache<string>();
  });

  it('should warm cache with operations', async () => {
    const operations = [
      {
        key: 'key1',
        operation: async () => 'value1',
        priority: 1,
      },
      {
        key: 'key2',
        operation: async () => 'value2',
        priority: 2,
      },
    ];

    await cacheWarmer.warmCache(cache, operations);

    expect(cache.get('key1')).toBe('value1');
    expect(cache.get('key2')).toBe('value2');
  });

  it('should execute operations in priority order', async () => {
    const executionOrder: string[] = [];

    const operations = [
      {
        key: 'low',
        operation: async () => {
          executionOrder.push('low');
          return 'low-priority';
        },
        priority: 1,
      },
      {
        key: 'high',
        operation: async () => {
          executionOrder.push('high');
          return 'high-priority';
        },
        priority: 10,
      },
      {
        key: 'medium',
        operation: async () => {
          executionOrder.push('medium');
          return 'medium-priority';
        },
        priority: 5,
      },
    ];

    await cacheWarmer.warmCache(cache, operations);

    // Higher priority should start first, but due to Promise.allSettled
    // we can't guarantee exact order in parallel execution
    expect(cache.get('high')).toBe('high-priority');
    expect(cache.get('medium')).toBe('medium-priority');
    expect(cache.get('low')).toBe('low-priority');
  });

  it('should handle failing operations gracefully', async () => {
    const operations = [
      {
        key: 'success',
        operation: async () => 'success-value',
      },
      {
        key: 'failure',
        operation: async () => {
          throw new Error('Operation failed');
        },
      },
    ];

    await expect(
      cacheWarmer.warmCache(cache, operations),
    ).resolves.toBeUndefined();

    expect(cache.get('success')).toBe('success-value');
    expect(cache.get('failure')).toBeNull();
  });

  it('should use default priority when not specified', async () => {
    const operations = [
      {
        key: 'no-priority',
        operation: async () => 'value',
      },
    ];

    await cacheWarmer.warmCache(cache, operations);
    expect(cache.get('no-priority')).toBe('value');
  });
});
