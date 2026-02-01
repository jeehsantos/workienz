-- Add missing DELETE policy for conversation_read_status
CREATE POLICY "Users can delete their own read status"
ON public.conversation_read_status FOR DELETE
USING (auth.uid() = user_id);

-- Update get_unread_message_count to add authorization check
CREATE OR REPLACE FUNCTION public.get_unread_message_count(_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  unread_count integer;
BEGIN
  -- Authorization check: only allow users to query their own unread count
  IF _user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: Cannot access unread count for other users';
  END IF;

  SELECT COUNT(*)::integer INTO unread_count
  FROM messages m
  INNER JOIN conversations c ON c.id = m.conversation_id
  WHERE (c.contractor_user_id = _user_id OR c.employee_user_id = _user_id)
    AND m.sender_user_id != _user_id
    AND c.status = 'active'
    AND m.created_at > COALESCE(
      (SELECT last_read_at 
       FROM conversation_read_status crs 
       WHERE crs.conversation_id = c.id 
       AND crs.user_id = _user_id),
      '1970-01-01'::timestamp with time zone
    );
  RETURN unread_count;
END;
$function$;

-- Clean up test users created by hardcoded migration (if they exist)
DELETE FROM auth.users 
WHERE id IN (
  'a1111111-1111-1111-1111-111111111111',
  'a2222222-2222-2222-2222-222222222222',
  'a3333333-3333-3333-3333-333333333333',
  'a4444444-4444-4444-4444-444444444444'
);