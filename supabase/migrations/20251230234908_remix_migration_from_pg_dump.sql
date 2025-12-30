CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'contractor',
    'employee',
    'writer'
);


--
-- Name: job_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.job_status AS ENUM (
    'draft',
    'published',
    'closed',
    'filled'
);


--
-- Name: subscription_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.subscription_status AS ENUM (
    'active',
    'cancelled',
    'expired',
    'pending'
);


--
-- Name: contractor_has_published_jobs(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.contractor_has_published_jobs(_contractor_profile_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.jobs
    WHERE contractor_id = _contractor_profile_id
      AND status = 'published'::job_status
  );
$$;


--
-- Name: get_user_roles(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_roles(_user_id uuid) RETURNS SETOF public.app_role
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id
$$;


--
-- Name: handle_application_status_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_application_status_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- If status changed to rejected, decrement positions_filled
  IF OLD.status != 'rejected' AND NEW.status = 'rejected' THEN
    UPDATE public.jobs 
    SET positions_filled = GREATEST(positions_filled - 1, 0)
    WHERE id = NEW.job_id;
  END IF;
  
  -- If status changed FROM rejected to something else, increment again
  IF OLD.status = 'rejected' AND NEW.status != 'rejected' THEN
    UPDATE public.jobs 
    SET positions_filled = positions_filled + 1
    WHERE id = NEW.job_id;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: handle_conversation_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_conversation_delete() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Delete all messages in this conversation first
  DELETE FROM public.messages WHERE conversation_id = OLD.id;
  
  -- If this conversation is linked to a job application, restore the position
  IF OLD.job_application_id IS NOT NULL THEN
    -- Get the job_id from the application and decrement positions_filled
    UPDATE public.jobs 
    SET positions_filled = GREATEST(positions_filled - 1, 0)
    WHERE id = (SELECT job_id FROM public.job_applications WHERE id = OLD.job_application_id);
    
    -- Delete the job application
    DELETE FROM public.job_applications WHERE id = OLD.job_application_id;
  END IF;
  
  RETURN OLD;
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Create profile for new user
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', '')
  );
  
  -- Assign default role based on user_type from metadata (default to employee)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data ->> 'user_type')::app_role, 'employee')
  );
  
  RETURN NEW;
END;
$$;


--
-- Name: has_active_subscription(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_active_subscription(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions
    WHERE user_id = _user_id
      AND status = 'active'
      AND (ends_at IS NULL OR ends_at > now())
  )
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


--
-- Name: increment_positions_filled(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_positions_filled() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.jobs 
  SET positions_filled = positions_filled + 1
  WHERE id = NEW.job_id;
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: articles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.articles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    author_id uuid NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    excerpt text,
    content text NOT NULL,
    cover_image_url text,
    is_published boolean DEFAULT false NOT NULL,
    is_premium boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: contractor_packages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contractor_packages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    price_cents integer NOT NULL,
    jobs_per_week integer NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: contractor_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contractor_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    company_name text NOT NULL,
    company_description text,
    industry text,
    website text,
    country text,
    city text,
    suburb text,
    is_verified boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    phone text,
    is_entrepreneur boolean DEFAULT false
);


--
-- Name: contractor_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contractor_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contractor_profile_id uuid NOT NULL,
    package_id uuid NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    jobs_posted_this_week integer DEFAULT 0,
    week_start_date date DEFAULT CURRENT_DATE NOT NULL,
    starts_at timestamp with time zone DEFAULT now() NOT NULL,
    ends_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT contractor_subscriptions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'cancelled'::text, 'expired'::text])))
);


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_application_id uuid,
    contractor_user_id uuid NOT NULL,
    employee_user_id uuid NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT conversations_status_check CHECK ((status = ANY (ARRAY['active'::text, 'closed'::text])))
);


--
-- Name: employee_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    headline text,
    skills text[],
    experience_years integer DEFAULT 0,
    availability text,
    country text,
    city text,
    suburb text,
    is_available boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    phone text,
    industry text,
    bio text,
    languages text[],
    date_of_birth date,
    visa_status text
);


--
-- Name: job_applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    cover_letter text,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: job_shifts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_shifts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_id uuid NOT NULL,
    shift_date date NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    break_minutes integer DEFAULT 0,
    break_paid boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: job_work_dates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_work_dates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_id uuid NOT NULL,
    work_date date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contractor_id uuid NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    requirements text,
    location_city text,
    location_suburb text,
    location_country text,
    job_type text DEFAULT 'temporary'::text NOT NULL,
    duration text,
    hourly_rate_min numeric,
    hourly_rate_max numeric,
    skills_required text[],
    status public.job_status DEFAULT 'draft'::public.job_status NOT NULL,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    positions_available integer DEFAULT 1 NOT NULL,
    positions_filled integer DEFAULT 0 NOT NULL,
    industry text,
    schedule_type text DEFAULT 'shifts'::text,
    experience_required boolean DEFAULT false
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    sender_user_id uuid NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT messages_content_length CHECK (((length(content) > 0) AND (length(content) <= 5000)))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    email text NOT NULL,
    full_name text,
    avatar_url text,
    phone text,
    bio text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    plan_name text DEFAULT 'basic'::text NOT NULL,
    status public.subscription_status DEFAULT 'pending'::public.subscription_status NOT NULL,
    starts_at timestamp with time zone DEFAULT now() NOT NULL,
    ends_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: articles articles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.articles
    ADD CONSTRAINT articles_pkey PRIMARY KEY (id);


--
-- Name: articles articles_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.articles
    ADD CONSTRAINT articles_slug_key UNIQUE (slug);


--
-- Name: contractor_packages contractor_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contractor_packages
    ADD CONSTRAINT contractor_packages_pkey PRIMARY KEY (id);


--
-- Name: contractor_profiles contractor_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contractor_profiles
    ADD CONSTRAINT contractor_profiles_pkey PRIMARY KEY (id);


--
-- Name: contractor_profiles contractor_profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contractor_profiles
    ADD CONSTRAINT contractor_profiles_user_id_key UNIQUE (user_id);


--
-- Name: contractor_subscriptions contractor_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contractor_subscriptions
    ADD CONSTRAINT contractor_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: employee_profiles employee_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_profiles
    ADD CONSTRAINT employee_profiles_pkey PRIMARY KEY (id);


--
-- Name: employee_profiles employee_profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_profiles
    ADD CONSTRAINT employee_profiles_user_id_key UNIQUE (user_id);


--
-- Name: job_applications job_applications_job_id_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_applications
    ADD CONSTRAINT job_applications_job_id_employee_id_key UNIQUE (job_id, employee_id);


--
-- Name: job_applications job_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_applications
    ADD CONSTRAINT job_applications_pkey PRIMARY KEY (id);


--
-- Name: job_shifts job_shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_shifts
    ADD CONSTRAINT job_shifts_pkey PRIMARY KEY (id);


--
-- Name: job_work_dates job_work_dates_job_id_work_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_work_dates
    ADD CONSTRAINT job_work_dates_job_id_work_date_key UNIQUE (job_id, work_date);


--
-- Name: job_work_dates job_work_dates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_work_dates
    ADD CONSTRAINT job_work_dates_pkey PRIMARY KEY (id);


--
-- Name: jobs jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: conversations on_conversation_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_conversation_delete BEFORE DELETE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.handle_conversation_delete();


--
-- Name: job_applications on_job_application_created; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_job_application_created AFTER INSERT ON public.job_applications FOR EACH ROW EXECUTE FUNCTION public.increment_positions_filled();


--
-- Name: job_applications on_job_application_status_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_job_application_status_change AFTER UPDATE OF status ON public.job_applications FOR EACH ROW EXECUTE FUNCTION public.handle_application_status_change();


--
-- Name: articles update_articles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_articles_updated_at BEFORE UPDATE ON public.articles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: contractor_packages update_contractor_packages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_contractor_packages_updated_at BEFORE UPDATE ON public.contractor_packages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: contractor_profiles update_contractor_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_contractor_profiles_updated_at BEFORE UPDATE ON public.contractor_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: contractor_subscriptions update_contractor_subscriptions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_contractor_subscriptions_updated_at BEFORE UPDATE ON public.contractor_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: conversations update_conversations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: employee_profiles update_employee_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_employee_profiles_updated_at BEFORE UPDATE ON public.employee_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: job_applications update_job_applications_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_job_applications_updated_at BEFORE UPDATE ON public.job_applications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: jobs update_jobs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: subscriptions update_subscriptions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: contractor_profiles contractor_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contractor_profiles
    ADD CONSTRAINT contractor_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: contractor_subscriptions contractor_subscriptions_contractor_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contractor_subscriptions
    ADD CONSTRAINT contractor_subscriptions_contractor_profile_id_fkey FOREIGN KEY (contractor_profile_id) REFERENCES public.contractor_profiles(id) ON DELETE CASCADE;


--
-- Name: contractor_subscriptions contractor_subscriptions_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contractor_subscriptions
    ADD CONSTRAINT contractor_subscriptions_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.contractor_packages(id);


--
-- Name: conversations conversations_job_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_job_application_id_fkey FOREIGN KEY (job_application_id) REFERENCES public.job_applications(id) ON DELETE CASCADE;


--
-- Name: employee_profiles employee_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_profiles
    ADD CONSTRAINT employee_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: job_applications job_applications_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_applications
    ADD CONSTRAINT job_applications_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employee_profiles(id) ON DELETE CASCADE;


--
-- Name: job_applications job_applications_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_applications
    ADD CONSTRAINT job_applications_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;


--
-- Name: job_shifts job_shifts_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_shifts
    ADD CONSTRAINT job_shifts_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;


--
-- Name: job_work_dates job_work_dates_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_work_dates
    ADD CONSTRAINT job_work_dates_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;


--
-- Name: jobs jobs_contractor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_contractor_id_fkey FOREIGN KEY (contractor_id) REFERENCES public.contractor_profiles(id) ON DELETE CASCADE;


--
-- Name: messages messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: articles Admins can delete any article; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete any article" ON public.articles FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: subscriptions Admins can insert subscriptions for any user; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert subscriptions for any user" ON public.subscriptions FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: contractor_subscriptions Admins can manage all contractor subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all contractor subscriptions" ON public.contractor_subscriptions USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: contractor_packages Admins can manage packages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage packages" ON public.contractor_packages USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can manage roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage roles" ON public.user_roles TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: articles Admins can update any article; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update any article" ON public.articles FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: subscriptions Admins can update subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update subscriptions" ON public.subscriptions FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: articles Admins can view all articles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all articles" ON public.articles FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: contractor_profiles Admins can view all contractor profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all contractor profiles" ON public.contractor_profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: jobs Admins can view all jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all jobs" ON public.jobs FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: profiles Admins can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can view all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: subscriptions Admins can view all subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all subscriptions" ON public.subscriptions FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: employee_profiles Anyone can view employee profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view employee profiles" ON public.employee_profiles FOR SELECT TO authenticated USING (true);


--
-- Name: contractor_packages Anyone can view packages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view packages" ON public.contractor_packages FOR SELECT USING ((is_active = true));


--
-- Name: articles Anyone can view published articles metadata; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view published articles metadata" ON public.articles FOR SELECT USING ((is_published = true));


--
-- Name: jobs Anyone can view published jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view published jobs" ON public.jobs FOR SELECT USING ((status = 'published'::public.job_status));


--
-- Name: job_shifts Anyone can view shifts for published jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view shifts for published jobs" ON public.job_shifts FOR SELECT USING ((job_id IN ( SELECT jobs.id
   FROM public.jobs
  WHERE (jobs.status = 'published'::public.job_status))));


--
-- Name: job_work_dates Anyone can view work dates for published jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view work dates for published jobs" ON public.job_work_dates FOR SELECT USING ((job_id IN ( SELECT jobs.id
   FROM public.jobs
  WHERE (jobs.status = 'published'::public.job_status))));


--
-- Name: job_applications Contractors can delete applications for their jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Contractors can delete applications for their jobs" ON public.job_applications FOR DELETE USING ((job_id IN ( SELECT jobs.id
   FROM public.jobs
  WHERE (jobs.contractor_id IN ( SELECT contractor_profiles.id
           FROM public.contractor_profiles
          WHERE (contractor_profiles.user_id = auth.uid()))))));


--
-- Name: jobs Contractors can delete their own jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Contractors can delete their own jobs" ON public.jobs FOR DELETE USING ((contractor_id IN ( SELECT contractor_profiles.id
   FROM public.contractor_profiles
  WHERE (contractor_profiles.user_id = auth.uid()))));


--
-- Name: jobs Contractors can insert their own jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Contractors can insert their own jobs" ON public.jobs FOR INSERT WITH CHECK ((contractor_id IN ( SELECT contractor_profiles.id
   FROM public.contractor_profiles
  WHERE (contractor_profiles.user_id = auth.uid()))));


--
-- Name: contractor_profiles Contractors can insert their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Contractors can insert their own profile" ON public.contractor_profiles FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) AND public.has_role(auth.uid(), 'contractor'::public.app_role)));


--
-- Name: job_shifts Contractors can manage their job shifts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Contractors can manage their job shifts" ON public.job_shifts USING ((job_id IN ( SELECT jobs.id
   FROM public.jobs
  WHERE (jobs.contractor_id IN ( SELECT contractor_profiles.id
           FROM public.contractor_profiles
          WHERE (contractor_profiles.user_id = auth.uid())))))) WITH CHECK ((job_id IN ( SELECT jobs.id
   FROM public.jobs
  WHERE (jobs.contractor_id IN ( SELECT contractor_profiles.id
           FROM public.contractor_profiles
          WHERE (contractor_profiles.user_id = auth.uid()))))));


--
-- Name: job_work_dates Contractors can manage their job work dates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Contractors can manage their job work dates" ON public.job_work_dates USING ((job_id IN ( SELECT jobs.id
   FROM public.jobs
  WHERE (jobs.contractor_id IN ( SELECT contractor_profiles.id
           FROM public.contractor_profiles
          WHERE (contractor_profiles.user_id = auth.uid())))))) WITH CHECK ((job_id IN ( SELECT jobs.id
   FROM public.jobs
  WHERE (jobs.contractor_id IN ( SELECT contractor_profiles.id
           FROM public.contractor_profiles
          WHERE (contractor_profiles.user_id = auth.uid()))))));


--
-- Name: job_applications Contractors can update application status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Contractors can update application status" ON public.job_applications FOR UPDATE USING ((job_id IN ( SELECT jobs.id
   FROM public.jobs
  WHERE (jobs.contractor_id IN ( SELECT contractor_profiles.id
           FROM public.contractor_profiles
          WHERE (contractor_profiles.user_id = auth.uid()))))));


--
-- Name: jobs Contractors can update their own jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Contractors can update their own jobs" ON public.jobs FOR UPDATE USING ((contractor_id IN ( SELECT contractor_profiles.id
   FROM public.contractor_profiles
  WHERE (contractor_profiles.user_id = auth.uid()))));


--
-- Name: contractor_profiles Contractors can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Contractors can update their own profile" ON public.contractor_profiles FOR UPDATE USING (((auth.uid() = user_id) AND public.has_role(auth.uid(), 'contractor'::public.app_role)));


--
-- Name: profiles Contractors can view applicant profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Contractors can view applicant profiles" ON public.profiles FOR SELECT USING ((user_id IN ( SELECT ep.user_id
   FROM (((public.employee_profiles ep
     JOIN public.job_applications ja ON ((ja.employee_id = ep.id)))
     JOIN public.jobs j ON ((j.id = ja.job_id)))
     JOIN public.contractor_profiles cp ON ((cp.id = j.contractor_id)))
  WHERE (cp.user_id = auth.uid()))));


--
-- Name: job_applications Contractors can view applications for their jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Contractors can view applications for their jobs" ON public.job_applications FOR SELECT USING ((job_id IN ( SELECT jobs.id
   FROM public.jobs
  WHERE (jobs.contractor_id IN ( SELECT contractor_profiles.id
           FROM public.contractor_profiles
          WHERE (contractor_profiles.user_id = auth.uid()))))));


--
-- Name: jobs Contractors can view their own jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Contractors can view their own jobs" ON public.jobs FOR SELECT USING ((contractor_id IN ( SELECT contractor_profiles.id
   FROM public.contractor_profiles
  WHERE (contractor_profiles.user_id = auth.uid()))));


--
-- Name: contractor_subscriptions Contractors can view their own subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Contractors can view their own subscriptions" ON public.contractor_subscriptions FOR SELECT USING ((contractor_profile_id IN ( SELECT contractor_profiles.id
   FROM public.contractor_profiles
  WHERE (contractor_profiles.user_id = auth.uid()))));


--
-- Name: job_applications Employees can apply to jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees can apply to jobs" ON public.job_applications FOR INSERT WITH CHECK ((employee_id IN ( SELECT employee_profiles.id
   FROM public.employee_profiles
  WHERE (employee_profiles.user_id = auth.uid()))));


--
-- Name: job_applications Employees can delete their own applications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees can delete their own applications" ON public.job_applications FOR DELETE USING ((employee_id IN ( SELECT employee_profiles.id
   FROM public.employee_profiles
  WHERE (employee_profiles.user_id = auth.uid()))));


--
-- Name: employee_profiles Employees can insert their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees can insert their own profile" ON public.employee_profiles FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) AND public.has_role(auth.uid(), 'employee'::public.app_role)));


--
-- Name: job_applications Employees can update their own applications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees can update their own applications" ON public.job_applications FOR UPDATE USING ((employee_id IN ( SELECT employee_profiles.id
   FROM public.employee_profiles
  WHERE (employee_profiles.user_id = auth.uid()))));


--
-- Name: employee_profiles Employees can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees can update their own profile" ON public.employee_profiles FOR UPDATE TO authenticated USING (((auth.uid() = user_id) AND public.has_role(auth.uid(), 'employee'::public.app_role))) WITH CHECK (((auth.uid() = user_id) AND public.has_role(auth.uid(), 'employee'::public.app_role)));


--
-- Name: profiles Employees can view job poster profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees can view job poster profiles" ON public.profiles FOR SELECT USING ((user_id IN ( SELECT cp.user_id
   FROM (public.contractor_profiles cp
     JOIN public.jobs j ON ((j.contractor_id = cp.id)))
  WHERE (j.status = 'published'::public.job_status))));


--
-- Name: job_applications Employees can view their own applications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees can view their own applications" ON public.job_applications FOR SELECT USING ((employee_id IN ( SELECT employee_profiles.id
   FROM public.employee_profiles
  WHERE (employee_profiles.user_id = auth.uid()))));


--
-- Name: conversations Participants can delete their conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Participants can delete their conversations" ON public.conversations FOR DELETE USING (((auth.uid() = contractor_user_id) OR (auth.uid() = employee_user_id)));


--
-- Name: messages Participants can send messages in active conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Participants can send messages in active conversations" ON public.messages FOR INSERT WITH CHECK (((sender_user_id = auth.uid()) AND (conversation_id IN ( SELECT conversations.id
   FROM public.conversations
  WHERE (((conversations.contractor_user_id = auth.uid()) OR (conversations.employee_user_id = auth.uid())) AND (conversations.status = 'active'::text))))));


--
-- Name: conversations Participants can update conversation status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Participants can update conversation status" ON public.conversations FOR UPDATE USING (((auth.uid() = contractor_user_id) OR (auth.uid() = employee_user_id)));


--
-- Name: messages Participants can view messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Participants can view messages" ON public.messages FOR SELECT USING ((conversation_id IN ( SELECT conversations.id
   FROM public.conversations
  WHERE ((conversations.contractor_user_id = auth.uid()) OR (conversations.employee_user_id = auth.uid())))));


--
-- Name: conversations Participants can view their conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Participants can view their conversations" ON public.conversations FOR SELECT USING (((auth.uid() = contractor_user_id) OR (auth.uid() = employee_user_id)));


--
-- Name: contractor_profiles Public can view contractors with jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view contractors with jobs" ON public.contractor_profiles FOR SELECT USING (public.contractor_has_published_jobs(id));


--
-- Name: conversations System can create conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can create conversations" ON public.conversations FOR INSERT WITH CHECK (((auth.uid() = contractor_user_id) OR (auth.uid() = employee_user_id)));


--
-- Name: messages System can delete messages in conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can delete messages in conversations" ON public.messages FOR DELETE USING ((conversation_id IN ( SELECT conversations.id
   FROM public.conversations
  WHERE ((conversations.contractor_user_id = auth.uid()) OR (conversations.employee_user_id = auth.uid())))));


--
-- Name: profiles Users can insert their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: subscriptions Users can insert their own subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own subscriptions" ON public.subscriptions FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Users can view conversation partner profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view conversation partner profiles" ON public.profiles FOR SELECT USING ((user_id IN ( SELECT conversations.contractor_user_id
   FROM public.conversations
  WHERE (conversations.employee_user_id = auth.uid())
UNION
 SELECT conversations.employee_user_id
   FROM public.conversations
  WHERE (conversations.contractor_user_id = auth.uid()))));


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_roles Users can view their own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: subscriptions Users can view their own subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own subscriptions" ON public.subscriptions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: contractor_profiles View contractors in conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "View contractors in conversations" ON public.contractor_profiles FOR SELECT USING ((user_id IN ( SELECT conversations.contractor_user_id
   FROM public.conversations
  WHERE (conversations.employee_user_id = auth.uid()))));


--
-- Name: contractor_profiles View own contractor profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "View own contractor profile" ON public.contractor_profiles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: articles Writers can delete their own articles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Writers can delete their own articles" ON public.articles FOR DELETE USING (((author_id = auth.uid()) AND public.has_role(auth.uid(), 'writer'::public.app_role)));


--
-- Name: articles Writers can insert articles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Writers can insert articles" ON public.articles FOR INSERT WITH CHECK (((author_id = auth.uid()) AND public.has_role(auth.uid(), 'writer'::public.app_role)));


--
-- Name: articles Writers can update their own articles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Writers can update their own articles" ON public.articles FOR UPDATE USING (((author_id = auth.uid()) AND public.has_role(auth.uid(), 'writer'::public.app_role)));


--
-- Name: articles Writers can view their own articles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Writers can view their own articles" ON public.articles FOR SELECT USING ((author_id = auth.uid()));


--
-- Name: articles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

--
-- Name: contractor_packages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contractor_packages ENABLE ROW LEVEL SECURITY;

--
-- Name: contractor_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contractor_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: contractor_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contractor_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: employee_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employee_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: job_applications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

--
-- Name: job_shifts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.job_shifts ENABLE ROW LEVEL SECURITY;

--
-- Name: job_work_dates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.job_work_dates ENABLE ROW LEVEL SECURITY;

--
-- Name: jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;