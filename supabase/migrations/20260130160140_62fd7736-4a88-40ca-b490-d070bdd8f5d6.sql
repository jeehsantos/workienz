-- Enable the pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Enable the pg_net extension for HTTP calls from cron
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant usage to postgres user for cron
GRANT USAGE ON SCHEMA cron TO postgres;

-- Grant execute on cron functions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA cron TO postgres;