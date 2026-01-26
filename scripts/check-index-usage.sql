-- Database Index Usage Statistics
-- This script checks the usage and effectiveness of indexes created in task 7
-- Run this in Supabase SQL Editor or via psql

-- ============================================================================
-- 1. INDEX USAGE STATISTICS
-- ============================================================================
-- Shows how many times each index has been used and how effective it is

SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
  CASE 
    WHEN idx_scan = 0 THEN '⚠️  Unused'
    WHEN idx_scan < 100 THEN '⚠️  Low usage'
    WHEN idx_scan < 1000 THEN '✅ Moderate usage'
    ELSE '✅ High usage'
  END as usage_status
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY idx_scan DESC;

-- ============================================================================
-- 2. INDEXES BY SIZE
-- ============================================================================
-- Shows the largest indexes to help identify potential bloat

SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
  pg_relation_size(indexrelid) as size_bytes,
  idx_scan as scans
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY pg_relation_size(indexrelid) DESC
LIMIT 20;

-- ============================================================================
-- 3. UNUSED INDEXES
-- ============================================================================
-- Identifies indexes that have never been used (candidates for removal)

SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as wasted_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND idx_scan = 0
  AND indexname NOT LIKE 'pg_toast%'
  AND indexname LIKE 'idx_%'
ORDER BY pg_relation_size(indexrelid) DESC;

-- ============================================================================
-- 4. INDEX EFFICIENCY
-- ============================================================================
-- Shows the ratio of tuples fetched vs tuples read (higher is better)

SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched,
  CASE 
    WHEN idx_tup_read = 0 THEN 0
    ELSE ROUND((idx_tup_fetch::numeric / idx_tup_read::numeric) * 100, 2)
  END as efficiency_percent,
  CASE 
    WHEN idx_tup_read = 0 THEN 'N/A'
    WHEN (idx_tup_fetch::numeric / idx_tup_read::numeric) > 0.9 THEN '✅ Excellent'
    WHEN (idx_tup_fetch::numeric / idx_tup_read::numeric) > 0.7 THEN '✅ Good'
    WHEN (idx_tup_fetch::numeric / idx_tup_read::numeric) > 0.5 THEN '⚠️  Fair'
    ELSE '❌ Poor'
  END as efficiency_rating
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND idx_scan > 0
  AND indexname LIKE 'idx_%'
ORDER BY efficiency_percent DESC;

-- ============================================================================
-- 5. TABLE SCAN STATISTICS
-- ============================================================================
-- Shows sequential scans vs index scans (more index scans is better)

SELECT
  schemaname,
  tablename,
  seq_scan as sequential_scans,
  idx_scan as index_scans,
  CASE 
    WHEN seq_scan + idx_scan = 0 THEN 0
    ELSE ROUND((idx_scan::numeric / (seq_scan + idx_scan)::numeric) * 100, 2)
  END as index_scan_percent,
  CASE 
    WHEN seq_scan + idx_scan = 0 THEN 'N/A'
    WHEN (idx_scan::numeric / (seq_scan + idx_scan)::numeric) > 0.9 THEN '✅ Excellent'
    WHEN (idx_scan::numeric / (seq_scan + idx_scan)::numeric) > 0.7 THEN '✅ Good'
    WHEN (idx_scan::numeric / (seq_scan + idx_scan)::numeric) > 0.5 THEN '⚠️  Fair'
    ELSE '❌ Poor - Consider adding indexes'
  END as scan_ratio_rating,
  pg_size_pretty(pg_relation_size(relid)) as table_size
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY seq_scan DESC;

-- ============================================================================
-- 6. FULL-TEXT SEARCH INDEXES
-- ============================================================================
-- Checks for the presence and usage of full-text search indexes

SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as scans,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_jobs_search_vector',
    'idx_articles_search_vector',
    'idx_employee_profiles_search_vector'
  )
ORDER BY tablename;

-- ============================================================================
-- 7. COMPOSITE INDEX USAGE
-- ============================================================================
-- Checks usage of composite indexes created in task 7.4

SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as scans,
  pg_size_pretty(pg_relation_size(indexrelid)) as size,
  CASE 
    WHEN idx_scan = 0 THEN '⚠️  Not used yet'
    WHEN idx_scan < 100 THEN '⚠️  Low usage'
    ELSE '✅ Active'
  END as status
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_jobs_status_created_at',
    'idx_jobs_status_location_city',
    'idx_jobs_status_industry_job_type',
    'idx_job_applications_employee_id_status',
    'idx_job_applications_job_id_status',
    'idx_messages_conversation_id_created_at',
    'idx_articles_is_published_created_at',
    'idx_articles_author_id_is_published',
    'idx_subscriptions_user_id_status',
    'idx_conversations_contractor_user_id_status',
    'idx_conversations_employee_user_id_status'
  )
ORDER BY idx_scan DESC;

-- ============================================================================
-- 8. FOREIGN KEY INDEX COVERAGE
-- ============================================================================
-- Verifies that all foreign keys have supporting indexes

SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE schemaname = 'public' 
        AND tablename = tc.table_name 
        AND indexdef LIKE '%' || kcu.column_name || '%'
    ) THEN '✅ Indexed'
    ELSE '❌ Missing index'
  END as index_status
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- ============================================================================
-- 9. INDEX BLOAT ESTIMATION
-- ============================================================================
-- Estimates index bloat (indexes that may need rebuilding)

SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
  idx_scan as scans,
  CASE 
    WHEN idx_scan = 0 THEN '⚠️  Consider dropping'
    WHEN pg_relation_size(indexrelid) > 10485760 AND idx_scan < 100 THEN '⚠️  Large but rarely used'
    ELSE '✅ OK'
  END as recommendation
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY pg_relation_size(indexrelid) DESC;

-- ============================================================================
-- 10. SUMMARY STATISTICS
-- ============================================================================
-- Overall summary of index health

SELECT
  COUNT(*) as total_indexes,
  COUNT(*) FILTER (WHERE idx_scan > 0) as used_indexes,
  COUNT(*) FILTER (WHERE idx_scan = 0) as unused_indexes,
  COUNT(*) FILTER (WHERE idx_scan > 1000) as highly_used_indexes,
  pg_size_pretty(SUM(pg_relation_size(indexrelid))) as total_index_size,
  pg_size_pretty(SUM(pg_relation_size(indexrelid)) FILTER (WHERE idx_scan = 0)) as unused_index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%';

-- ============================================================================
-- INTERPRETATION GUIDE
-- ============================================================================
-- 
-- Index Scans:
--   - 0: Index has never been used (consider removing)
--   - 1-100: Low usage (monitor)
--   - 100-1000: Moderate usage (good)
--   - 1000+: High usage (excellent)
--
-- Efficiency:
--   - > 90%: Excellent - index is very selective
--   - 70-90%: Good - index is working well
--   - 50-70%: Fair - index may need optimization
--   - < 50%: Poor - consider redesigning index
--
-- Sequential vs Index Scans:
--   - > 90% index scans: Excellent
--   - 70-90% index scans: Good
--   - 50-70% index scans: Fair
--   - < 50% index scans: Poor - need more indexes
--
-- Actions:
--   - Unused indexes: Consider dropping to save space
--   - Low efficiency: Review query patterns and index design
--   - High sequential scans: Add missing indexes
--   - Large unused indexes: Drop to reclaim space
--
-- ============================================================================
