/**
 * Cache Middleware for Edge Functions
 * Provides caching utilities for Supabase Edge Functions
 * 
 * Requirements: 5.1, 5.5
 */

import { CachePresets, generateCacheControl, type CacheHeaderOptions } from './cache-headers.ts';

/**
 * Simple in-memory cache for Edge Functions
 * Note: This cache is per-instance and will be cleared on cold starts
 */
class EdgeCache {
  private cache: Map<string, { data: any; expiresAt: number }> = new Map();

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

export const edgeCache = new EdgeCache();

/**
 * Wrap a handler with caching support
 */
export function withCache<T>(
  handler: () => Promise<T>,
  options: {
    key: string;
    ttl?: number;
    cacheHeaders?: CacheHeaderOptions;
  }
): Promise<{ data: T; fromCache: boolean; headers: Record<string, string> }> {
  const { key, ttl = 5 * 60 * 1000, cacheHeaders } = options;

  return (async () => {
    // Try cache first
    const cached = edgeCache.get<T>(key);
    if (cached) {
      return {
        data: cached,
        fromCache: true,
        headers: cacheHeaders ? {
          'Cache-Control': generateCacheControl(cacheHeaders),
          'X-Cache': 'HIT',
        } : {},
      };
    }

    // Execute handler
    const data = await handler();

    // Store in cache
    edgeCache.set(key, data, ttl);

    return {
      data,
      fromCache: false,
      headers: cacheHeaders ? {
        'Cache-Control': generateCacheControl(cacheHeaders),
        'X-Cache': 'MISS',
      } : {},
    };
  })();
}

/**
 * Create a cached response
 */
export function cachedResponse(
  data: any,
  options: {
    status?: number;
    cacheHeaders?: CacheHeaderOptions;
    fromCache?: boolean;
  } = {}
): Response {
  const { status = 200, cacheHeaders, fromCache = false } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (cacheHeaders) {
    headers['Cache-Control'] = generateCacheControl(cacheHeaders);
  }

  if (fromCache !== undefined) {
    headers['X-Cache'] = fromCache ? 'HIT' : 'MISS';
  }

  return new Response(JSON.stringify(data), {
    status,
    headers,
  });
}

/**
 * Generate cache key from request parameters
 */
export function generateCacheKey(
  resource: string,
  params: Record<string, any> = {}
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}:${JSON.stringify(params[key])}`)
    .join('|');

  return sortedParams ? `${resource}:${sortedParams}` : resource;
}

// Export cache presets for convenience
export { CachePresets };
