

# Post-Hiring Chat Management System

## Overview
This plan implements enhanced chat management after an employee is hired by a contractor. The system will disable the Close button, enforce a 48-hour chat window with warnings, automatically clean up chats, and properly handle rejection of other open applications.

## Current State Analysis

### What Already Exists
1. **`hire-applicant` Edge Function**: Already handles:
   - Updating application status to "hired"
   - Setting employee availability to `false`
   - Sending congratulations message
   - Rejecting other pending applications with messages
   - Setting `scheduled_deletion_at` for rejected conversations

2. **`scheduled_deletion_at` Column**: Already exists in `conversations` table

3. **`cleanup-hired-conversations` Edge Function**: Exists but calls a missing DB function

### What's Missing/Broken
1. The `cleanup_scheduled_conversations` DB function doesn't exist (migration not applied)
2. The `hire-applicant` function doesn't set `scheduled_deletion_at` for the **hired conversation** itself
3. No UI logic to disable Close button for hired conversations
4. No 48-hour warning banner for hired conversations
5. No cron job to periodically run cleanup

---

## Implementation Plan

### Phase 1: Database Setup

**Migration to create cleanup function and add hired_at tracking:**

```sql
-- Add hired_at column to track when a conversation was hired
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS hired_at TIMESTAMP WITH TIME ZONE;

-- Create/update the cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_scheduled_conversations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- First, delete all messages for conversations scheduled for deletion
  DELETE FROM public.messages 
  WHERE conversation_id IN (
    SELECT id FROM public.conversations 
    WHERE scheduled_deletion_at IS NOT NULL 
      AND scheduled_deletion_at <= now()
  );
  
  -- Then delete the conversations themselves
  WITH deleted AS (
    DELETE FROM public.conversations
    WHERE scheduled_deletion_at IS NOT NULL
      AND scheduled_deletion_at <= now()
    RETURNING id
  )
  SELECT count(*) INTO v_deleted_count FROM deleted;
  
  RETURN v_deleted_count;
END;
$$;
```

### Phase 2: Update hire-applicant Edge Function

Modify to set `scheduled_deletion_at` and `hired_at` for the HIRED conversation:

```text
Changes to supabase/functions/hire-applicant/index.ts:

1. After finding/creating the conversation, set hired_at and scheduled_deletion_at:
   - hired_at = now()
   - scheduled_deletion_at = now() + 48 hours
   
2. Ensure status remains 'active' (not 'closed') for hired conversation
```

### Phase 3: Update Conversation.tsx UI

**A. Disable Close Button for Hired Conversations**

```text
Location: src/pages/Conversation.tsx

Logic:
- If job_application.status === 'hired' AND conversation originated from job_application
- Disable the Close button for BOTH contractor and employee
- Show tooltip: "This conversation will be automatically archived after 48 hours"
```

**B. Add 48-Hour Hired Warning Banner**

```text
New UI Component in Conversation.tsx:

When conversation has hired_at set and is within 48 hours:
- Show amber/yellow warning banner at top
- Display countdown: "This conversation will be archived in X hours"
- Show different messaging than the inactivity expiry
```

**C. Update Close Button Logic**

Current code (lines 753-761):
```jsx
<Button 
  variant="outline" 
  size="sm" 
  className="text-destructive hover:text-destructive h-9"
  onClick={() => setShowCloseDialog(true)}
>
  <X className="w-4 h-4 mr-2" />
  Close
</Button>
```

Updated logic:
```jsx
// Disable if conversation is hired (from job application)
const isHiredConversation = isHired && conversation?.job_application_id;

<Button 
  variant="outline" 
  size="sm" 
  className="text-destructive hover:text-destructive h-9"
  onClick={() => setShowCloseDialog(true)}
  disabled={isHiredConversation}
  title={isHiredConversation ? "Conversation will auto-archive in 48h" : undefined}
>
```

### Phase 4: Update cleanup-hired-conversations Edge Function

Already correct, just needs the DB function to exist. The function calls:
```typescript
const { data, error } = await supabase.rpc("cleanup_scheduled_conversations");
```

### Phase 5: Setup Cron Job for Automated Cleanup

**SQL to schedule hourly cleanup:**

```sql
SELECT cron.schedule(
  'cleanup-hired-conversations',
  '0 * * * *',  -- Every hour
  $$
  SELECT net.http_post(
    url:='https://xzrlnezeuubdoqllvodi.supabase.co/functions/v1/cleanup-hired-conversations',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);
```

### Phase 6: Update MyConversations Dashboard Component

Add visual indicators for hired conversations approaching deletion:

```text
Location: src/components/dashboard/MyConversations.tsx

Changes:
1. Fetch scheduled_deletion_at and job_application status
2. Show "Hired" badge with countdown for hired conversations
3. Different styling for hired vs regular expiry warnings
```

---

## Data Flow Diagram

```text
[Contractor clicks "Hire"]
         │
         ▼
[hire-applicant Edge Function]
         │
         ├── Set application.status = 'hired'
         ├── Set employee.is_available = false
         ├── Set conversation.hired_at = now()
         ├── Set conversation.scheduled_deletion_at = now() + 48h
         ├── Send congratulations message
         │
         ├── For OTHER applications by this employee:
         │     ├── Set status = 'rejected'
         │     ├── Send "hired elsewhere" message
         │     ├── Set status = 'closed'
         │     └── Set scheduled_deletion_at = now() + 48h
         │
         └── Send notifications to all parties
         
[Hourly Cron Job]
         │
         ▼
[cleanup-hired-conversations Edge Function]
         │
         ▼
[cleanup_scheduled_conversations() DB Function]
         │
         ├── Delete messages where conversation is past scheduled_deletion_at
         └── Delete conversations where past scheduled_deletion_at
```

---

## UI Changes Summary

### Conversation Page Changes

| Condition | Close Button | Banner Message |
|-----------|-------------|----------------|
| Normal active chat | Enabled | None |
| Inactivity warning (24h+) | Enabled | "Expires in Xh - send message to keep active" |
| Hired conversation | **Disabled** | "🎉 Hired! Chat archives in Xh" |
| Other apps rejected | N/A (status=closed) | "This candidate was hired elsewhere" |

### Dashboard Changes

- Hired conversations show "Hired" badge instead of "Active"
- Show archive countdown for hired conversations
- Different color scheme (green/success) vs expiry warnings (amber)

---

## Technical Notes

### Performance Considerations
- Added index on `scheduled_deletion_at` already exists
- Cleanup function uses efficient bulk DELETE
- Cron runs hourly, not every minute (reduces load)

### Security
- Cleanup uses SECURITY DEFINER with explicit search_path
- Edge function uses service role key for cleanup
- RLS policies remain unchanged - users can only see their own conversations

### Files to Modify

1. **New Migration**: Create `cleanup_scheduled_conversations` function + add `hired_at` column
2. **supabase/functions/hire-applicant/index.ts**: Set `hired_at` and `scheduled_deletion_at` for hired conversation
3. **src/pages/Conversation.tsx**: 
   - Fetch `hired_at` and `scheduled_deletion_at`
   - Disable Close button for hired conversations
   - Add hired countdown banner
   - Update mobile menu with same logic
4. **src/components/dashboard/MyConversations.tsx**: Add hired status display
5. **SQL Insert**: Setup cron job for hourly cleanup

