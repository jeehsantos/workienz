-- Add admin role to idreamzjsm@gmail.com (keeping contractor role)
INSERT INTO public.user_roles (user_id, role)
VALUES ('04aa9ba9-1046-4466-8f31-d1b7d8baa9ee', 'admin');

-- Convert idreamzjsm@icloud.com from employee to writer
UPDATE public.user_roles 
SET role = 'writer'
WHERE user_id = '4f3ee969-3842-49be-a264-f848a57f3f6c' 
  AND role = 'employee';