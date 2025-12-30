-- Create test users directly in auth.users table
-- These users will have password: Test1234!
-- Password hash for "Test1234!" using bcrypt

-- Contractor test user
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  aud,
  role
) VALUES (
  'a1111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'contractor@test.com',
  crypt('Test1234!', gen_salt('bf')),
  now(),
  '{"full_name": "Test Contractor", "user_type": "contractor"}'::jsonb,
  now(),
  now(),
  '',
  '',
  'authenticated',
  'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- Employee test user
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  aud,
  role
) VALUES (
  'b2222222-2222-2222-2222-222222222222',
  '00000000-0000-0000-0000-000000000000',
  'employee@test.com',
  crypt('Test1234!', gen_salt('bf')),
  now(),
  '{"full_name": "Test Employee", "user_type": "employee"}'::jsonb,
  now(),
  now(),
  '',
  '',
  'authenticated',
  'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- Admin test user
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  aud,
  role
) VALUES (
  'c3333333-3333-3333-3333-333333333333',
  '00000000-0000-0000-0000-000000000000',
  'admin@test.com',
  crypt('Test1234!', gen_salt('bf')),
  now(),
  '{"full_name": "Test Admin", "user_type": "admin"}'::jsonb,
  now(),
  now(),
  '',
  '',
  'authenticated',
  'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- Writer test user
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  aud,
  role
) VALUES (
  'd4444444-4444-4444-4444-444444444444',
  '00000000-0000-0000-0000-000000000000',
  'writer@test.com',
  crypt('Test1234!', gen_salt('bf')),
  now(),
  '{"full_name": "Test Writer", "user_type": "writer"}'::jsonb,
  now(),
  now(),
  '',
  '',
  'authenticated',
  'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- The trigger handle_new_user will automatically create profiles and user_roles