-- Migration: Database Index Optimization
-- Purpose: Add comprehensive indexes for performance optimization
-- Related to: Task 7 - Implement database index optimization
-- Requirements: 4.1, 4.2, 4.3, 4.4, 14.1

-- ============================================================================
-- SUBTASK 7.1: Create indexes for frequently queried columns
-- ============================================================================

-- Jobs table indexes (frequently filtered and sorted columns)
CREATE INDEX IF NOT EXISTS idx_jobs_status 
ON public.jobs(status);

CREATE INDEX IF NOT EXISTS idx_jobs_created_at 
ON public.jobs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_jobs_location_city 
ON public.jobs(location_city);

CREATE INDEX IF NOT EXISTS idx_jobs_location_suburb 
ON public.jobs(location_suburb);

CREATE INDEX IF NOT EXISTS idx_jobs_location_country 
ON public.jobs(location_country);

CREATE INDEX IF NOT EXISTS idx_jobs_job_type 
ON public.jobs(job_type);

CREATE INDEX IF NOT EXISTS idx_jobs_industry 
ON public.jobs(industry);

-- Job applications indexes (frequently filtered columns)
CREATE INDEX IF NOT EXISTS idx_job_applications_status 
ON public.job_applications(status);

CREATE INDEX IF NOT EXISTS idx_job_applications_created_at 
ON public.job_applications(created_at DESC);

-- Messages indexes (frequently sorted by time)
CREATE INDEX IF NOT EXISTS idx_messages_created_at 
ON public.messages(created_at DESC);

-- ============================================================================
-- SUBTASK 7.2: Create indexes for foreign keys
-- ============================================================================

-- Jobs table foreign keys
CREATE INDEX IF NOT EXISTS idx_jobs_contractor_id 
ON public.jobs(contractor_id);

-- Job applications foreign keys
CREATE INDEX IF NOT EXISTS idx_job_applications_job_id 
ON public.job_applications(job_id);

CREATE INDEX IF NOT EXISTS idx_job_applications_employee_id 
ON public.job_applications(employee_id);

-- Job shifts foreign key
CREATE INDEX IF NOT EXISTS idx_job_shifts_job_id 
ON public.job_shifts(job_id);

-- Job work dates foreign key
CREATE INDEX IF NOT EXISTS idx_job_work_dates_job_id 
ON public.job_work_dates(job_id);

-- Messages foreign keys
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id 
ON public.messages(conversation_id);

CREATE INDEX IF NOT EXISTS idx_messages_sender_user_id 
ON public.messages(sender_user_id);

-- Conversations foreign keys
CREATE INDEX IF NOT EXISTS idx_conversations_contractor_user_id 
ON public.conversations(contractor_user_id);

CREATE INDEX IF NOT EXISTS idx_conversations_employee_user_id 
ON public.conversations(employee_user_id);

CREATE INDEX IF NOT EXISTS idx_conversations_job_application_id 
ON public.conversations(job_application_id);

CREATE INDEX IF NOT EXISTS idx_conversations_status 
ON public.conversations(status);

-- Articles foreign key
CREATE INDEX IF NOT EXISTS idx_articles_author_id 
ON public.articles(author_id);

CREATE INDEX IF NOT EXISTS idx_articles_is_published 
ON public.articles(is_published);

CREATE INDEX IF NOT EXISTS idx_articles_created_at 
ON public.articles(created_at DESC);

-- Contractor subscriptions foreign keys
CREATE INDEX IF NOT EXISTS idx_contractor_subscriptions_contractor_profile_id 
ON public.contractor_subscriptions(contractor_profile_id);

CREATE INDEX IF NOT EXISTS idx_contractor_subscriptions_package_id 
ON public.contractor_subscriptions(package_id);

-- Subscriptions foreign key
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id 
ON public.subscriptions(user_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_status 
ON public.subscriptions(status);

CREATE INDEX IF NOT EXISTS idx_subscriptions_ends_at 
ON public.subscriptions(ends_at);

-- Profiles foreign key
CREATE INDEX IF NOT EXISTS idx_profiles_user_id 
ON public.profiles(user_id);

-- User roles foreign key
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id 
ON public.user_roles(user_id);

-- Contractor profiles foreign key
CREATE INDEX IF NOT EXISTS idx_contractor_profiles_user_id 
ON public.contractor_profiles(user_id);

-- Employee profiles foreign key
CREATE INDEX IF NOT EXISTS idx_employee_profiles_user_id 
ON public.employee_profiles(user_id);

-- Notifications foreign key (already has index from migration 20260105071212)
-- CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);

-- Article reports foreign keys
CREATE INDEX IF NOT EXISTS idx_article_reports_article_id 
ON public.article_reports(article_id);

CREATE INDEX IF NOT EXISTS idx_article_reports_reporter_user_id 
ON public.article_reports(reporter_user_id);

-- Conversation read status foreign keys
CREATE INDEX IF NOT EXISTS idx_conversation_read_status_conversation_id 
ON public.conversation_read_status(conversation_id);

CREATE INDEX IF NOT EXISTS idx_conversation_read_status_user_id 
ON public.conversation_read_status(user_id);

-- ============================================================================
-- SUBTASK 7.3: Implement full-text search indexes
-- ============================================================================

-- Jobs full-text search (title and description)
-- Create a tsvector column for better performance
ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS search_vector tsvector 
GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(requirements, '')), 'C')
) STORED;

CREATE INDEX IF NOT EXISTS idx_jobs_search_vector 
ON public.jobs USING GIN(search_vector);

-- Articles full-text search (title and content)
ALTER TABLE public.articles 
ADD COLUMN IF NOT EXISTS search_vector tsvector 
GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(excerpt, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(content, '')), 'C')
) STORED;

CREATE INDEX IF NOT EXISTS idx_articles_search_vector 
ON public.articles USING GIN(search_vector);

-- Employee profiles full-text search (bio and skills)
-- Skills is already an array, so we handle it differently
ALTER TABLE public.employee_profiles 
ADD COLUMN IF NOT EXISTS search_vector tsvector 
GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce(bio, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(headline, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(array_to_string(skills, ' '), '')), 'C')
) STORED;

CREATE INDEX IF NOT EXISTS idx_employee_profiles_search_vector 
ON public.employee_profiles USING GIN(search_vector);

-- ============================================================================
-- SUBTASK 7.4: Create composite indexes for common query patterns
-- ============================================================================

-- Jobs: Common pattern - filter by status and sort by created_at
CREATE INDEX IF NOT EXISTS idx_jobs_status_created_at 
ON public.jobs(status, created_at DESC);

-- Jobs: Location-based searches with status filter
CREATE INDEX IF NOT EXISTS idx_jobs_status_location_city 
ON public.jobs(status, location_city);

-- Jobs: Industry and job type filtering with status
CREATE INDEX IF NOT EXISTS idx_jobs_status_industry_job_type 
ON public.jobs(status, industry, job_type);

-- Job applications: Employee's applications filtered by status
CREATE INDEX IF NOT EXISTS idx_job_applications_employee_id_status 
ON public.job_applications(employee_id, status);

-- Job applications: Job's applications filtered by status
CREATE INDEX IF NOT EXISTS idx_job_applications_job_id_status 
ON public.job_applications(job_id, status);

-- Subscriptions: User's active subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id_status 
ON public.subscriptions(user_id, status);

-- Subscriptions: Active subscriptions with end date check
CREATE INDEX IF NOT EXISTS idx_subscriptions_status_ends_at 
ON public.subscriptions(status, ends_at) 
WHERE status = 'active';

-- Conversations: User's conversations by status
CREATE INDEX IF NOT EXISTS idx_conversations_contractor_user_id_status 
ON public.conversations(contractor_user_id, status);

CREATE INDEX IF NOT EXISTS idx_conversations_employee_user_id_status 
ON public.conversations(employee_user_id, status);

-- Messages: Conversation messages sorted by time (for pagination)
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id_created_at 
ON public.messages(conversation_id, created_at DESC);

-- Articles: Published articles sorted by date
CREATE INDEX IF NOT EXISTS idx_articles_is_published_created_at 
ON public.articles(is_published, created_at DESC) 
WHERE is_published = true;

-- Articles: Author's articles by publication status
CREATE INDEX IF NOT EXISTS idx_articles_author_id_is_published 
ON public.articles(author_id, is_published);

-- Contractor subscriptions: Active subscriptions
CREATE INDEX IF NOT EXISTS idx_contractor_subscriptions_contractor_profile_id_status 
ON public.contractor_subscriptions(contractor_profile_id, status);

-- ============================================================================
-- COMMENTS AND DOCUMENTATION
-- ============================================================================

COMMENT ON INDEX idx_jobs_status IS 'Optimize filtering jobs by status (published, draft, closed, filled)';
COMMENT ON INDEX idx_jobs_created_at IS 'Optimize sorting jobs by creation date';
COMMENT ON INDEX idx_jobs_status_created_at IS 'Optimize common query pattern: filter by status and sort by date';
COMMENT ON INDEX idx_jobs_search_vector IS 'Full-text search index for job title, description, and requirements';
COMMENT ON INDEX idx_articles_search_vector IS 'Full-text search index for article title, excerpt, and content';
COMMENT ON INDEX idx_employee_profiles_search_vector IS 'Full-text search index for employee bio, headline, and skills';
COMMENT ON INDEX idx_messages_conversation_id_created_at IS 'Optimize message pagination within conversations';
COMMENT ON INDEX idx_subscriptions_user_id_status IS 'Optimize checking user subscription status';
