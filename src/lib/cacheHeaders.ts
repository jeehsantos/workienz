/**
 * Cache Headers Utility
 * Provides HTTP cache headers for API responses
 * 
 * Requirements: 5.5
 */

export interface CacheHeaderOptions {
  maxAge?: number; // seconds
  sMaxAge?: number; // seconds (shared cache)
  staleWhileRevalidate?: number; // seconds
  staleIfError?: number; // seconds
  mustRevalidate?: boolean;
  noCache?: boolean;
  noStore?: boolean;
  public?: boolean;
  private?: boolean;
}

/**
 * Generate Cache-Control header value
 */
export function generateCacheControl(options: CacheHeaderOptions): string {
  const directives: string[] = [];

  if (options.noStore) {
    directives.push('no-store');
    return directives.join(', ');
  }

  if (options.noCache) {
    directives.push('no-cache');
  }

  if (options.public) {
    directives.push('public');
  } else if (options.private) {
    directives.push('private');
  }

  if (options.maxAge !== undefined) {
    directives.push(`max-age=${options.maxAge}`);
  }

  if (options.sMaxAge !== undefined) {
    directives.push(`s-maxage=${options.sMaxAge}`);
  }

  if (options.staleWhileRevalidate !== undefined) {
    directives.push(`stale-while-revalidate=${options.staleWhileRevalidate}`);
  }

  if (options.staleIfError !== undefined) {
    directives.push(`stale-if-error=${options.staleIfError}`);
  }

  if (options.mustRevalidate) {
    directives.push('must-revalidate');
  }

  return directives.join(', ');
}

/**
 * Preset cache configurations
 */
export const CachePresets = {
  /**
   * Static content that rarely changes (1 hour)
   */
  static: (): CacheHeaderOptions => ({
    public: true,
    maxAge: 3600,
    staleWhileRevalidate: 86400,
  }),

  /**
   * Dynamic content with short cache (5 minutes)
   */
  dynamic: (): CacheHeaderOptions => ({
    public: true,
    maxAge: 300,
    staleWhileRevalidate: 600,
  }),

  /**
   * User-specific content (private cache, 5 minutes)
   */
  private: (): CacheHeaderOptions => ({
    private: true,
    maxAge: 300,
  }),

  /**
   * No caching
   */
  noCache: (): CacheHeaderOptions => ({
    noStore: true,
  }),

  /**
   * Job listings (5 minutes, public)
   */
  jobListings: (): CacheHeaderOptions => ({
    public: true,
    maxAge: 300,
    staleWhileRevalidate: 600,
  }),

  /**
   * Job details (5 minutes, public)
   */
  jobDetails: (): CacheHeaderOptions => ({
    public: true,
    maxAge: 300,
    staleWhileRevalidate: 600,
  }),

  /**
   * User profiles (10 minutes, private)
   */
  userProfile: (): CacheHeaderOptions => ({
    private: true,
    maxAge: 600,
  }),

  /**
   * Articles (5 minutes, public)
   */
  articles: (): CacheHeaderOptions => ({
    public: true,
    maxAge: 300,
    staleWhileRevalidate: 600,
  }),
};

/**
 * Apply cache headers to a Response object
 */
export function applyCacheHeaders(
  response: Response,
  options: CacheHeaderOptions
): Response {
  const cacheControl = generateCacheControl(options);
  response.headers.set('Cache-Control', cacheControl);
  
  // Add ETag for conditional requests
  const etag = generateETag(response);
  if (etag) {
    response.headers.set('ETag', etag);
  }

  return response;
}

/**
 * Generate ETag from response body
 */
function generateETag(response: Response): string | null {
  // Simple hash-based ETag generation
  // In production, use a proper hashing algorithm
  try {
    const body = JSON.stringify(response);
    let hash = 0;
    for (let i = 0; i < body.length; i++) {
      const char = body.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `"${hash.toString(36)}"`;
  } catch {
    return null;
  }
}

/**
 * Check if request has valid cache
 */
export function hasValidCache(
  request: Request,
  etag: string
): boolean {
  const ifNoneMatch = request.headers.get('If-None-Match');
  return ifNoneMatch === etag;
}
