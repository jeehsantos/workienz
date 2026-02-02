/**
 * Full-Text Search Utilities
 * 
 * Helper functions for using PostgreSQL full-text search with the optimized indexes.
 * Related to Task 7.3 - Implement full-text search indexes
 */

/**
 * Sanitize and prepare a search query for PostgreSQL full-text search
 * Converts user input into a valid tsquery format
 * 
 * @param query - Raw user search input
 * @returns Sanitized query string for to_tsquery
 * 
 * @example
 * sanitizeSearchQuery("javascript developer") // Returns "javascript & developer"
 * sanitizeSearchQuery("react or vue") // Returns "react | vue"
 */
export function sanitizeSearchQuery(query: string): string {
  if (!query || query.trim().length === 0) {
    return '';
  }

  // Remove special characters that could break tsquery
  let sanitized = query
    .replace(/[^\w\s&|!()]/g, ' ')
    .trim();

  // Replace common words with operators
  sanitized = sanitized
    .replace(/\bAND\b/gi, '&')
    .replace(/\bOR\b/gi, '|')
    .replace(/\bNOT\b/gi, '!');

  // If no operators, treat as AND search (all words must match)
  if (!sanitized.includes('&') && !sanitized.includes('|') && !sanitized.includes('!')) {
    sanitized = sanitized.split(/\s+/).filter(Boolean).join(' & ');
  }

  return sanitized;
}

/**
 * Build a full-text search query for jobs
 * 
 * @param searchTerm - User's search input
 * @returns Supabase query filter
 * 
 * @example
 * const { data } = await supabase
 *   .from('jobs')
 *   .select('*')
 *   .textSearch('search_vector', buildJobSearchQuery('javascript developer'));
 */
export function buildJobSearchQuery(searchTerm: string): string {
  return sanitizeSearchQuery(searchTerm);
}

/**
 * Build a full-text search query for articles
 * 
 * @param searchTerm - User's search input
 * @returns Supabase query filter
 * 
 * @example
 * const { data } = await supabase
 *   .from('articles')
 *   .select('*')
 *   .textSearch('search_vector', buildArticleSearchQuery('career advice'));
 */
export function buildArticleSearchQuery(searchTerm: string): string {
  return sanitizeSearchQuery(searchTerm);
}

/**
 * Build a full-text search query for employee profiles
 * 
 * @param searchTerm - User's search input
 * @returns Supabase query filter
 * 
 * @example
 * const { data } = await supabase
 *   .from('employee_profiles')
 *   .select('*')
 *   .textSearch('search_vector', buildProfileSearchQuery('react developer'));
 */
export function buildProfileSearchQuery(searchTerm: string): string {
  return sanitizeSearchQuery(searchTerm);
}

/**
 * Search jobs using full-text search with ranking
 * 
 * @param supabase - Supabase client instance
 * @param searchTerm - User's search input
 * @param filters - Additional filters (status, location, etc.)
 * @param limit - Maximum number of results
 * @returns Promise with search results
 * 
 * @example
 * const results = await searchJobs(supabase, 'javascript developer', {
 *   status: 'published',
 *   location_city: 'Auckland'
 * }, 20);
 */
export async function searchJobs(
  supabase: any,
  searchTerm: string,
  filters: {
    status?: string;
    location_city?: string;
    location_country?: string;
    industry?: string;
    job_type?: string;
  } = {},
  limit: number = 20
) {
  const query = buildJobSearchQuery(searchTerm);
  
  // Join with contractor_profiles to get has_priority for sorting
  const selectFields = `
    *,
    contractor_profiles!inner(has_priority)
  `;
  
  if (!query) {
    // If no search term, return filtered results without text search
    let dbQuery = supabase
      .from('jobs')
      .select(selectFields);
    
    if (filters.status) dbQuery = dbQuery.eq('status', filters.status);
    if (filters.location_city) dbQuery = dbQuery.eq('location_city', filters.location_city);
    if (filters.location_country) dbQuery = dbQuery.eq('location_country', filters.location_country);
    if (filters.industry) dbQuery = dbQuery.eq('industry', filters.industry);
    if (filters.job_type) dbQuery = dbQuery.eq('job_type', filters.job_type);
    
    // Order by priority first (descending so true comes first), then by created_at
    return dbQuery
      .order('contractor_profiles(has_priority)', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);
  }

  // Use full-text search with filters
  let dbQuery = supabase
    .from('jobs')
    .select(selectFields)
    .textSearch('search_vector', query);
  
  if (filters.status) dbQuery = dbQuery.eq('status', filters.status);
  if (filters.location_city) dbQuery = dbQuery.eq('location_city', filters.location_city);
  if (filters.location_country) dbQuery = dbQuery.eq('location_country', filters.location_country);
  if (filters.industry) dbQuery = dbQuery.eq('industry', filters.industry);
  if (filters.job_type) dbQuery = dbQuery.eq('job_type', filters.job_type);
  
  // Order by priority first, then by created_at
  return dbQuery
    .order('contractor_profiles(has_priority)', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
}

/**
 * Search articles using full-text search with ranking
 * 
 * @param supabase - Supabase client instance
 * @param searchTerm - User's search input
 * @param publishedOnly - Only return published articles
 * @param limit - Maximum number of results
 * @returns Promise with search results
 * 
 * @example
 * const results = await searchArticles(supabase, 'career advice', true, 20);
 */
export async function searchArticles(
  supabase: any,
  searchTerm: string,
  publishedOnly: boolean = true,
  limit: number = 20
) {
  const query = buildArticleSearchQuery(searchTerm);
  
  if (!query) {
    // If no search term, return recent articles
    let dbQuery = supabase
      .from('articles')
      .select('*');
    
    if (publishedOnly) {
      dbQuery = dbQuery.eq('is_published', true);
    }
    
    return dbQuery
      .order('created_at', { ascending: false })
      .limit(limit);
  }

  // Use full-text search
  let dbQuery = supabase
    .from('articles')
    .select('*')
    .textSearch('search_vector', query);
  
  if (publishedOnly) {
    dbQuery = dbQuery.eq('is_published', true);
  }
  
  return dbQuery.limit(limit);
}

/**
 * Search employee profiles using full-text search
 * 
 * @param supabase - Supabase client instance
 * @param searchTerm - User's search input
 * @param filters - Additional filters (availability, location, etc.)
 * @param limit - Maximum number of results
 * @returns Promise with search results
 * 
 * @example
 * const results = await searchProfiles(supabase, 'react developer', {
 *   is_available: true,
 *   city: 'Auckland'
 * }, 20);
 */
export async function searchProfiles(
  supabase: any,
  searchTerm: string,
  filters: {
    is_available?: boolean;
    city?: string;
    country?: string;
    industry?: string;
  } = {},
  limit: number = 20
) {
  const query = buildProfileSearchQuery(searchTerm);
  
  if (!query) {
    // If no search term, return filtered results
    let dbQuery = supabase
      .from('employee_profiles')
      .select('*');
    
    if (filters.is_available !== undefined) dbQuery = dbQuery.eq('is_available', filters.is_available);
    if (filters.city) dbQuery = dbQuery.eq('city', filters.city);
    if (filters.country) dbQuery = dbQuery.eq('country', filters.country);
    if (filters.industry) dbQuery = dbQuery.eq('industry', filters.industry);
    
    return dbQuery.limit(limit);
  }

  // Use full-text search with filters
  let dbQuery = supabase
    .from('employee_profiles')
    .select('*')
    .textSearch('search_vector', query);
  
  if (filters.is_available !== undefined) dbQuery = dbQuery.eq('is_available', filters.is_available);
  if (filters.city) dbQuery = dbQuery.eq('city', filters.city);
  if (filters.country) dbQuery = dbQuery.eq('country', filters.country);
  if (filters.industry) dbQuery = dbQuery.eq('industry', filters.industry);
  
  return dbQuery.limit(limit);
}

/**
 * Highlight search terms in text
 * Useful for displaying search results with highlighted matches
 * 
 * @param text - Text to highlight
 * @param searchTerm - Search term to highlight
 * @returns Text with <mark> tags around matches
 * 
 * @example
 * highlightSearchTerms("JavaScript Developer", "javascript")
 * // Returns "<mark>JavaScript</mark> Developer"
 */
export function highlightSearchTerms(text: string, searchTerm: string): string {
  if (!text || !searchTerm) return text;
  
  const terms = searchTerm
    .split(/\s+/)
    .filter(term => term.length > 2) // Only highlight terms longer than 2 chars
    .map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')); // Escape regex chars
  
  if (terms.length === 0) return text;
  
  const regex = new RegExp(`(${terms.join('|')})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

/**
 * Extract a snippet from text around search terms
 * Useful for showing context in search results
 * 
 * @param text - Full text
 * @param searchTerm - Search term
 * @param maxLength - Maximum snippet length
 * @returns Snippet with search term context
 * 
 * @example
 * extractSnippet("This is a long text about JavaScript development...", "javascript", 100)
 * // Returns "...long text about JavaScript development..."
 */
export function extractSnippet(
  text: string,
  searchTerm: string,
  maxLength: number = 200
): string {
  if (!text || !searchTerm) return text.substring(0, maxLength);
  
  const lowerText = text.toLowerCase();
  const lowerTerm = searchTerm.toLowerCase().split(/\s+/)[0]; // Use first word
  
  const index = lowerText.indexOf(lowerTerm);
  
  if (index === -1) {
    // Term not found, return beginning
    return text.substring(0, maxLength) + (text.length > maxLength ? '...' : '');
  }
  
  // Calculate snippet boundaries
  const start = Math.max(0, index - Math.floor(maxLength / 2));
  const end = Math.min(text.length, start + maxLength);
  
  let snippet = text.substring(start, end);
  
  // Add ellipsis if needed
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';
  
  return snippet;
}
