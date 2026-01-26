-- RLS Policy Audit Script
-- This script audits all tables for Row Level Security (RLS) status and policies
-- Run this in your Supabase SQL Editor to get a comprehensive RLS coverage report

-- ============================================================================
-- PART 1: Tables with RLS Enabled
-- ============================================================================

SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- ============================================================================
-- PART 2: Detailed RLS Policy Information
-- ============================================================================

SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd as command,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================================================
-- PART 3: Tables WITHOUT RLS Enabled (Security Risk!)
-- ============================================================================

SELECT 
    schemaname,
    tablename,
    'WARNING: RLS NOT ENABLED' as status
FROM pg_tables
WHERE schemaname = 'public'
    AND rowsecurity = false
ORDER BY tablename;

-- ============================================================================
-- PART 4: Tables with RLS Enabled but NO Policies (Blocks All Access!)
-- ============================================================================

SELECT 
    t.schemaname,
    t.tablename,
    'WARNING: RLS ENABLED BUT NO POLICIES' as status
FROM pg_tables t
WHERE t.schemaname = 'public'
    AND t.rowsecurity = true
    AND NOT EXISTS (
        SELECT 1 
        FROM pg_policies p 
        WHERE p.schemaname = t.schemaname 
            AND p.tablename = t.tablename
    )
ORDER BY t.tablename;

-- ============================================================================
-- PART 5: Policy Coverage by Operation Type
-- ============================================================================

SELECT 
    tablename,
    COUNT(CASE WHEN cmd = 'SELECT' THEN 1 END) as select_policies,
    COUNT(CASE WHEN cmd = 'INSERT' THEN 1 END) as insert_policies,
    COUNT(CASE WHEN cmd = 'UPDATE' THEN 1 END) as update_policies,
    COUNT(CASE WHEN cmd = 'DELETE' THEN 1 END) as delete_policies,
    COUNT(CASE WHEN cmd = 'ALL' THEN 1 END) as all_policies
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- ============================================================================
-- PART 6: Summary Statistics
-- ============================================================================

SELECT 
    'Total Tables' as metric,
    COUNT(*) as count
FROM pg_tables
WHERE schemaname = 'public'

UNION ALL

SELECT 
    'Tables with RLS Enabled' as metric,
    COUNT(*) as count
FROM pg_tables
WHERE schemaname = 'public'
    AND rowsecurity = true

UNION ALL

SELECT 
    'Tables without RLS' as metric,
    COUNT(*) as count
FROM pg_tables
WHERE schemaname = 'public'
    AND rowsecurity = false

UNION ALL

SELECT 
    'Total RLS Policies' as metric,
    COUNT(*) as count
FROM pg_policies
WHERE schemaname = 'public';
