

# Fix Free Tier Application Blocking + Chat Expiry

## Problem Summary

Two interconnected bugs are preventing free-tier user `7idreamzjsm@gmail.com` from applying to new jobs:

1. **Chat expiry not closing applications**: The `process-chat-expiry` function closes inactive conversations but never updates the linked job application status. The old application stays "pending" forever, permanently consuming the user's application slot.

2. **Missing UI guard for free-tier slot limit**: The JobDetail page shows warnings for cooldown and subscriber limits, but has no guard for free-tier users who have hit their application slot limit. Instead, the user sees the "Submit Application" button, clicks it, and gets a raw backend error.

Additionally, there is no cron job configured to run `process-chat-expiry` automatically, meaning inactive conversations are never processed.

## Root Cause Analysis

```text
User applies Jan 31 --> Application = "pending", Conversation = "active"
                         |
7+ days pass, no contractor interaction
                         |
process-chat-expiry SHOULD run but:
  1. No cron job is set up to trigger it
  2. Even if it ran, it only sets conversation.status = "closed"
     -- it does NOT update job_application.status
                         |
Result: application stays "pending" forever
        --> counts against active_applications (1/1 for free tier)
        --> user cannot apply to any new job
```

## Solution

### 1. Update `process-chat-expiry` Edge Function

When closing a conversation due to 72+ hours of inactivity, also update the linked job application to a new "expired" status. This frees the user's application slot.

Changes:
- After setting `conversation.status = "closed"`, also update the linked `job_application.status` to `"expired"`
- Only expire applications that are still in "pending" status (not "hired" or already "rejected")
- Log the application expiry for audit purposes

### 2. Update `submit-application` Edge Function

The active applications query currently counts `pending` and `shortlisted` statuses. This is correct and doesn't need changes since once the chat expiry properly expires applications, they won't be counted. However, for additional safety:
- No changes needed since the fix in step 1 handles the root cause

### 3. Update `JobDetail.tsx` Frontend

Add a client-side guard for free-tier users who have hit their application slot limit (not just cooldown). Currently the page only shows:
- Cooldown warning (for free tier users in cooldown period)
- Application limit warning (for subscribed users only)

Missing: A warning for free-tier users who have used all their slots (base + referral credits) but are past the cooldown period. This is the exact scenario the user hit.

Changes:
- Extend the `checkApplication` logic in the free-tier branch to also check if `activeApplications >= totalAllowedApplications`
- If the slot limit is reached, set `applicationLimitReached` with an appropriate message and upgrade prompt
- The existing UI rendering for `applicationLimitReached` will handle the display, but update it to also show "Invite Friends" and "Upgrade" buttons for free-tier users

### 4. Set Up Cron Job for `process-chat-expiry`

Create a database migration to add a `pg_cron` job that invokes the `process-chat-expiry` function every hour. This ensures inactive conversations are processed automatically.

## Technical Details

### Database Migration

Enable `pg_cron` extension and create a scheduled job:

```sql
-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule process-chat-expiry to run every hour
SELECT cron.schedule(
  'process-chat-expiry',
  '0 * * * *',
  $$SELECT extensions.http(
    (
      'POST',
      '<supabase_url>/functions/v1/process-chat-expiry',
      ARRAY[extensions.http_header('Authorization', 'Bearer <service_role_key>')],
      'application/json',
      '{}'
    )::extensions.http_request
  );$$
);
```

### Edge Function Changes (`process-chat-expiry`)

After closing a conversation (line ~111-114), add:

```typescript
// Also expire the linked job application
if (conv.job_application_id) {
  const { error: appUpdateError } = await supabaseAdmin
    .from("job_applications")
    .update({ status: "expired" })
    .eq("id", conv.job_application_id)
    .eq("status", "pending");  // Only expire pending applications

  if (!appUpdateError) {
    logStep("Application expired", { applicationId: conv.job_application_id });
  }
}
```

### Frontend Changes (`JobDetail.tsx`)

In the free-tier branch of `checkApplication` (around line 198-246), after the cooldown check, add a slot limit check:

```typescript
// Check if free tier user has hit their slot limit
const totalAllowed = BASE_FREE_TIER_APPLICATIONS + referralCreditsRemaining;
if (activeApplications >= totalAllowed) {
  setApplicationLimitReached({
    reached: true,
    message: "You've reached the limit for free applications. Upgrade to Workie Premium or invite friends to earn more application credits.",
  });
}
```

Update the `applicationLimitReached` UI block to show both "Upgrade" and "Invite Friends" buttons when the user is on the free tier.

### Files Changed

| File | Action | Purpose |
|------|--------|---------|
| `supabase/functions/process-chat-expiry/index.ts` | Edit | Expire linked job applications when closing conversations |
| `src/pages/JobDetail.tsx` | Edit | Add free-tier slot limit UI guard with upgrade/referral prompt |
| Database migration | Create | Set up hourly cron job for chat expiry processing |

### Immediate Data Fix

For the specific user `7idreamzjsm@gmail.com`, the existing stale application (`d4819de5-...`) and conversation (`d89a7c6c-...`) will be cleaned up by manually triggering the updated `process-chat-expiry` function after deployment, or by running the cron job.

