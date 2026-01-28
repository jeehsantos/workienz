/**
 * Cache Manager
 * Provides in-memory caching with TTL support for Supabase queries
 * 
 * Requirements: 5.1, 5.5
 */

export interface CacheKeyOptions {
  userId?: string;
  params?: Record<string, any>;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export class CacheManager {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private readonly defaultTTL: number;

  constructor(defaultTTL: number = 5 * 60 * 1000) {
    this.defaultTTL = defaultTTL;
  }

  /**
   * Get a cached value
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set a cached value
   */
  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl ?? this.defaultTTL,
    });
  }

  /**
   * Delete a specific cache entry
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Invalidate cache entries matching a pattern
   */
  invalidate(pattern: string | RegExp): number {
    let count = 0;
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }
    
    return count;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Check if a key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }
}

/**
 * Generate a cache key from options
 */
export function generateCacheKey(base: string, options?: CacheKeyOptions): string {
  const parts = [`app:${base}`];
  
  if (options?.userId) {
    parts.push(`user:${options.userId}`);
  }
  
  if (options?.params) {
    const sortedParams = Object.keys(options.params)
      .sort()
      .map(key => `${key}:${options.params![key]}`)
      .join(',');
    if (sortedParams) {
      parts.push(`params:${sortedParams}`);
    }
  }
  
  return parts.join(':');
}

/**
 * Default cache manager instance
 */
export const defaultCacheManager = new CacheManager();

/**
 * Invalidate job-related cache entries
 */
export function invalidateJobCache(cache: CacheManager, jobId?: string): void {
  if (jobId) {
    cache.delete(`app:jobs:detail:params:id:${jobId}`);
  }
  cache.invalidate(/^app:jobs:list/);
}

/**
 * Invalidate profile-related cache entries
 */
export function invalidateProfileCache(cache: CacheManager, userId?: string): void {
  if (userId) {
    cache.delete(`app:profile:user:${userId}`);
  }
  cache.invalidate(/^app:profile/);
}

/**
 * Invalidate article-related cache entries
 */
export function invalidateArticleCache(cache: CacheManager, articleId?: string): void {
  if (articleId) {
    cache.delete(`app:articles:detail:params:id:${articleId}`);
  }
  cache.invalidate(/^app:articles:list/);
}

/**
 * Invalidate search-related cache entries
 */
export function invalidateSearchCache(cache: CacheManager): void {
  cache.invalidate(/^app:search/);
}

/**
 * Invalidate user-specific cache entries
 */
export function invalidateUserCache(cache: CacheManager, userId: string, scope?: string): void {
  if (scope) {
    cache.delete(`app:user:${userId}:${scope}`);
  } else {
    cache.invalidate(new RegExp(`^app:user:${userId}`));
  }
}
