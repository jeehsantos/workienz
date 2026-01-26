-- Script to verify database indexes are properly created
-- Run this after applying the index optimization migration
-- Usage: psql -d your_database -f scripts/verify-indexes.sql

\echo '========================================='
\echo 'Database Index Verification Report'
\echo '========================================='
\echo ''

-- Check if all expected indexes exist
\echo '1. Checking for expected indexes...'
\echo ''

SELECT 
  CASE 
    WHEN COUNT(*) >= 50 THEN '✓ All expected indexes found'
    ELSE '✗ Missing indexes: ' || (50 - COUNT(*))::text
  END as status,
  COUNT(*) as indexes_found
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND indexname LIKE 'idx_%';

\echo ''
\echo '2. Index list by table...'
\echo ''

SELECT 
  tablename,
  COUNT(*) as index_count,
  string_agg(indexname, ', ' ORDER BY indexname) as indexes
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND indexname LIKE 'idx_%'
GROUP BY tablename
ORDER BY tablename;

\echo ''
\echo '3. Full-text search indexes...'
\echo ''

SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND indexname LIKE '%search_vector%';

\echo ''
\echo '4. Composite indexes...'
\echo ''

SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND indexname LIKE 'idx_%'
  AND indexdef LIKE '%,%'
ORDER BY tablename, indexname;

\echo ''
\echo '5. Index sizes...'
\echo ''

SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY pg_relation_size(indexrelid) DESC
LIMIT 20;

\echo ''
\echo '6. Index usage statistics (top 20)...'
\echo ''

SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY idx_scan DESC
LIMIT 20;

\echo ''
\echo '7. Unused indexes (potential candidates for removal)...'
\echo ''

SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as wasted_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
  AND idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;

\echo ''
\echo '8. Table statistics...'
\echo ''

SELECT 
  schemaname,
  tablename,
  n_live_tup as row_count,
  n_tup_ins as inserts,
  n_tup_upd as updates,
  n_tup_del as deletes,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;

\echo ''
\echo '9. Generated columns for full-text search...'
\echo ''

SELECT 
  table_name,
  column_name,
  data_type,
  is_generated,
  generation_expression
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'search_vector';

\echo ''
\echo '========================================='
\echo 'Verification Complete'
\echo '========================================='
\echo ''
\echo 'Next steps:'
\echo '1. Review unused indexes and consider removing them'
\echo '2. Monitor index usage over time'
\echo '3. Run ANALYZE on tables to update statistics'
\echo '4. Test query performance with EXPLAIN ANALYZE'
\echo ''
