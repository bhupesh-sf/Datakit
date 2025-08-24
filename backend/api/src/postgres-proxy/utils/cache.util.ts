import { Logger } from '@nestjs/common';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
}

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  maxSize?: number; // Maximum number of entries
  enableStats?: boolean; // Enable cache statistics
}

export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
  oldestEntry: number | null;
  newestEntry: number | null;
}

export class MemoryCache<T> {
  private readonly logger = new Logger(MemoryCache.name);
  private readonly cache = new Map<string, CacheEntry<T>>();
  private readonly options: Required<CacheOptions>;
  private cleanupInterval: NodeJS.Timeout;
  private stats = {
    hits: 0,
    misses: 0,
  };

  constructor(options: CacheOptions = {}) {
    this.options = {
      ttl: options.ttl || 5 * 60 * 1000, // 5 minutes default
      maxSize: options.maxSize || 1000,
      enableStats: options.enableStats !== false,
    };

    // Cleanup interval every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Destroy the cache and clean up resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
  }

  /**
   * Gets a value from cache
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      if (this.options.enableStats) {
        this.stats.misses++;
      }
      return null;
    }

    // Check if expired
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      if (this.options.enableStats) {
        this.stats.misses++;
      }
      return null;
    }

    // Update access info
    entry.lastAccessed = Date.now();
    entry.accessCount++;

    if (this.options.enableStats) {
      this.stats.hits++;
    }

    return entry.data;
  }

  /**
   * Sets a value in cache
   */
  set(key: string, value: T, customTTL?: number): void {
    // Check size limit and evict if necessary
    if (this.cache.size >= this.options.maxSize) {
      this.evictLeastRecentlyUsed();
    }

    const now = Date.now();
    const entry: CacheEntry<T> = {
      data: value,
      timestamp: now,
      lastAccessed: now,
      accessCount: 1,
    };

    this.cache.set(key, entry);
  }

  /**
   * Checks if a key exists in cache (without updating access stats)
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    return entry !== undefined && !this.isExpired(entry);
  }

  /**
   * Deletes a specific key from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Deletes all keys matching a pattern
   */
  deletePattern(pattern: string | RegExp): number {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    let deletedCount = 0;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * Clears all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.stats.hits = 0;
    this.stats.misses = 0;
  }

  /**
   * Gets cache statistics
   */
  getStats(): CacheStats {
    let oldestEntry: number | null = null;
    let newestEntry: number | null = null;

    for (const entry of this.cache.values()) {
      if (oldestEntry === null || entry.timestamp < oldestEntry) {
        oldestEntry = entry.timestamp;
      }
      if (newestEntry === null || entry.timestamp > newestEntry) {
        newestEntry = entry.timestamp;
      }
    }

    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;

    return {
      size: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: Math.round(hitRate * 100) / 100,
      oldestEntry,
      newestEntry,
    };
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): number {
    let removedCount = 0;
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.options.ttl) {
        this.cache.delete(key);
        removedCount++;
      }
    }

    if (removedCount > 0 && this.options.enableStats) {
      this.logger.log(`Cleaned up ${removedCount} expired cache entries`);
    }

    return removedCount;
  }

  /**
   * Evict least recently used entry
   */
  private evictLeastRecentlyUsed(): void {
    let lruKey: string | null = null;
    let oldestAccess = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestAccess) {
        oldestAccess = entry.lastAccessed;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
      if (this.options.enableStats) {
        this.logger.log(`Evicted LRU cache entry: ${lruKey}`);
      }
    }
  }

  /**
   * Check if entry is expired
   */
  private isExpired(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp > this.options.ttl;
  }
}

/**
 * Utility functions for cache key generation
 */
export class CacheKeyUtil {
  /**
   * Generates a cache key for schema discovery
   */
  static schemaKey(connectionId: string): string {
    return `schemas:${connectionId}`;
  }

  /**
   * Generates a cache key for table discovery
   */
  static tablesKey(
    connectionId: string,
    schemaName: string,
    filters?: Record<string, any>,
  ): string {
    const filterString = filters ? `:${JSON.stringify(filters)}` : '';
    return `tables:${connectionId}:${schemaName}${filterString}`;
  }

  /**
   * Generates a cache key for table schema
   */
  static tableSchemaKey(
    connectionId: string,
    schemaName: string,
    tableName: string,
  ): string {
    return `table_schema:${connectionId}:${schemaName}:${tableName}`;
  }

  /**
   * Generates a cache key for connection metadata
   */
  static connectionMetaKey(connectionId: string): string {
    return `connection_meta:${connectionId}`;
  }

  /**
   * Gets all cache keys for a specific connection
   */
  static getConnectionPattern(connectionId: string): RegExp {
    return new RegExp(`^[^:]+:${connectionId}($|:)`);
  }

  /**
   * Validates and sanitizes cache keys
   */
  static sanitizeKey(key: string): string {
    // Remove invalid characters and limit length
    return key.replace(/[^a-zA-Z0-9:_-]/g, '_').substring(0, 250); // Redis key limit
  }
}

/**
 * Cache decorator for method-level caching
 */
export function Cacheable(
  keyGenerator: (...args: any[]) => string,
  ttl: number = 5 * 60 * 1000,
) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor,
  ) {
    const method = descriptor.value;
    const cache = new MemoryCache({ ttl });

    descriptor.value = async function (...args: any[]) {
      const cacheKey = keyGenerator(...args);

      // Try to get from cache
      let result = cache.get(cacheKey);
      if (result !== null) {
        return result;
      }

      // Execute original method
      result = await method.apply(this, args);

      // Cache the result
      cache.set(cacheKey, result);

      return result;
    };
  };
}

/**
 * Cache warming utility
 */
export class CacheWarmer {
  private readonly logger = new Logger(CacheWarmer.name);

  /**
   * Warms up cache with common queries
   */
  async warmCache<T>(
    cache: MemoryCache<T>,
    operations: Array<{
      key: string;
      operation: () => Promise<T>;
      priority?: number;
    }>,
  ): Promise<void> {
    // Sort by priority (higher numbers first)
    operations.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    const promises = operations.map(async ({ key, operation }) => {
      try {
        const result = await operation();
        cache.set(key, result);
        this.logger.log(`Cache warmed for key: ${key}`);
      } catch (error) {
        this.logger.warn(
          `Failed to warm cache for key ${key}: ${error.message}`,
        );
      }
    });

    await Promise.allSettled(promises);
    this.logger.log(
      `Cache warming completed for ${operations.length} operations`,
    );
  }
}
