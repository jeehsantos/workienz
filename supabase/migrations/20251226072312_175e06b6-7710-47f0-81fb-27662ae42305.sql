-- Allow conversations without job applications (for direct contact)
ALTER TABLE public.conversations 
ALTER COLUMN job_application_id DROP NOT NULL;

-- Drop the unique constraint on job_application_id to allow direct contacts
ALTER TABLE public.conversations 
DROP CONSTRAINT IF EXISTS conversations_job_application_id_key;