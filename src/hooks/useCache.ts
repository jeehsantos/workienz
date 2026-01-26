/**
 * React hook for caching Supabase queries
 * Provides automatic caching with TTL and invalidation support
 * 
 * Requirements: 5.1, 5.5
 */

import { useEffect, useState, useCallback } from 'react';
import { 
  defaultCacheManager, 
  generateCacheKey,
  type CacheKeyOptions 
} from '@/lib/cacheManager';

interface UseCacheOptions<T> {
  key: string;
  keyOptions?: CacheKeyOptions;
  ttl?: number;
  enabled?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

interface UseCacheResult<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  invalidate: () => void;
}

/**
 * Hook for caching async data fetching operations
 */
export function useCache<T>(
  fetchFn: () => Promise<T>,
  options: UseCacheOptions<T>
): UseCacheResult<T> {
  const { key, keyOptions, ttl, enabled = true, onSuccess, onError } = options;
  
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const cacheKey = generateCacheKey(key, keyOptions);

  const fetchData = useCallback(async () => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Try to get from cache first
      const cached = defaultCacheManager.get<T>(cacheKey);
      if (cached) {
        setData(cached);
        setIsLoading(false);
        onSuccess?.(cached);
        return;
      }

      // Fetch fresh data
      const result = await fetchFn();
      
      // Store in cache
      defaultCacheManager.set(cacheKey, result, ttl);
      
      setData(result);
      onSuccess?.(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [cacheKey, fetchFn, ttl, enabled, onSuccess, onError]);

  const invalidate = useCallback(() => {
    defaultCacheManager.delete(cacheKey);
  }, [cacheKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
    invalidate,
  };
}

/**
 * Hook for caching job postings list
 */
export function useCachedJobsList(
  fetchFn: () => Promise<any[]>,
  filters: {
    status?: string;
    location?: string;
    jobType?: string;
    industry?: string;
    page?: number;
    limit?: number;
  } = {}
) {
  return useCache(fetchFn, {
    key: 'jobs:list',
    keyOptions: { params: filters },
    ttl: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook for caching job detail
 */
export function useCachedJobDetail(
  fetchFn: () => Promise<any>,
  jobId: string
) {
  return useCache(fetchFn, {
    key: 'jobs:detail',
    keyOptions: { params: { id: jobId } },
    ttl: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook for caching user profile
 */
export function useCachedProfile(
  fetchFn: () => Promise<any>,
  userId: string
) {
  return useCache(fetchFn, {
    key: 'profile',
    keyOptions: { userId },
    ttl: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook for caching article list
 */
export function useCachedArticlesList(
  fetchFn: () => Promise<any[]>,
  filters: {
    category?: string;
    status?: string;
    page?: number;
    limit?: number;
  } = {}
) {
  return useCache(fetchFn, {
    key: 'articles:list',
    keyOptions: { params: filters },
    ttl: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook for caching article detail
 */
export function useCachedArticleDetail(
  fetchFn: () => Promise<any>,
  articleId: string
) {
  return useCache(fetchFn, {
    key: 'articles:detail',
    keyOptions: { params: { id: articleId } },
    ttl: 5 * 60 * 1000, // 5 minutes
  });
}
