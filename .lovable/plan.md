
# Email Confirmation Implementation Plan

## Overview
Implement a complete email verification flow that requires users to confirm their email address before accessing the platform. This will be a backend-first approach using a custom Edge Function to send branded emails via Resend.

## Current State Analysis
- **No email verification exists** - Users are immediately logged in after signup
- **Resend is already configured** - Password reset emails use it with branded templates
- **Logo already hosted** - Available at `https://workienz.lovable.app/workie-logo.png`
- **Referral verification** - The `verify-referral` function expects email confirmation to trigger

---

## Implementation Components

### 1. Backend: Edge Function for Confirmation Email
**File:** `supabase/functions/send-confirmation-email/index.ts`

Create a new Edge Function that:
- Accepts user email and generates a secure confirmation link using Supabase Admin API
- Sends a beautifully branded HTML email via Resend
- Uses the same design language as the password reset email (green gradient CTA, Workie logo, clean card layout)

**Email Design Elements:**
- Workie logo header
- Welcome message with user's first name
- Clear call-to-action button with green gradient
- Security notice about link expiration
- Footer with copyright

### 2. Configuration: Edge Function JWT Setting
**File:** `supabase/config.toml`

Add configuration entry:
```toml
[functions.send-confirmation-email]
verify_jwt = false
```

### 3. Frontend: Update Signup Flow
**File:** `src/hooks/useAuth.ts`

Modify the `signUp` function to:
- After successful signup, call the confirmation email Edge Function
- Return data indicating whether confirmation is needed

### 4. Frontend: Confirmation Pending UI
**File:** `src/pages/Auth.tsx`

Add a new state and UI component:
- `emailConfirmationPending` state
- Display a "Check Your Email" screen instead of redirecting
- Show the registered email address
- Provide a "Resend Email" button
- Include instructions to check spam folder

### 5. Frontend: Email Verification Handler Route
**File:** `src/pages/VerifyEmail.tsx` (new file)

Create a new page that:
- Handles the redirect from the confirmation email
- Processes the token automatically (Supabase handles this)
- Triggers the referral verification if applicable
- Shows success message and redirects to dashboard

### 6. Routing: Add Verification Route
**File:** `src/App.tsx`

Add the new route:
```tsx
<Route path="/verify-email" element={<VerifyEmail />} />
```

---

## User Flow

```text
┌─────────────────────────────────────────────────────────────────┐
│                         SIGNUP FLOW                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. User fills signup form                                      │
│              │                                                  │
│              ▼                                                  │
│  2. Frontend calls signUp()                                     │
│              │                                                  │
│              ▼                                                  │
│  3. Edge Function sends branded confirmation email              │
│              │                                                  │
│              ▼                                                  │
│  4. Show "Check Your Email" screen (no dashboard access)        │
│              │                                                  │
│              ▼                                                  │
│  5. User clicks email link                                      │
│              │                                                  │
│              ▼                                                  │
│  6. /verify-email page processes confirmation                   │
│              │                                                  │
│              ▼                                                  │
│  7. Trigger referral verification (if applicable)               │
│              │                                                  │
│              ▼                                                  │
│  8. Redirect to Dashboard with success message                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technical Details

### Confirmation Email Template
The email will match the existing password reset design:
- **Header:** Workie logo centered
- **Card:** White background with rounded corners and shadow
- **Title:** "Activate Your Account"
- **Body:** Personalized welcome message
- **CTA:** Green gradient button "Activate Account"
- **Expiry notice:** 24-hour link validity
- **Footer:** Copyright notice

### Security Considerations
- Uses Supabase Admin API `generateLink` with type "signup"
- Link expires after 24 hours
- Email confirmation required before accessing protected routes
- Frontend checks `user.email_confirmed_at` to determine access

### Sign-In Behavior Update
For users who try to sign in without confirming:
- Supabase returns `Email not confirmed` error
- Display helpful message with option to resend confirmation email

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `supabase/functions/send-confirmation-email/index.ts` | Create | Backend email sending with branded template |
| `supabase/config.toml` | Modify | Add function JWT config |
| `src/pages/VerifyEmail.tsx` | Create | Handle email confirmation callback |
| `src/pages/Auth.tsx` | Modify | Add confirmation pending state and UI |
| `src/hooks/useAuth.ts` | Modify | Integrate confirmation email sending |
| `src/App.tsx` | Modify | Add /verify-email route |

---

## Branded Email Preview

The confirmation email will look like this:

```
┌──────────────────────────────────────────┐
│                                          │
│            [Workie Logo]                 │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │                                    │  │
│  │    Activate Your Account           │  │
│  │                                    │  │
│  │    Hi [First Name],                │  │
│  │                                    │  │
│  │    Welcome to Workie! Click the    │  │
│  │    button below to verify your     │  │
│  │    email and start your journey.   │  │
│  │                                    │  │
│  │    ┌────────────────────────┐      │  │
│  │    │  Activate Account      │      │  │
│  │    └────────────────────────┘      │  │
│  │                                    │  │
│  │    This link expires in 24 hours   │  │
│  │                                    │  │
│  │    ─────────────────────────────   │  │
│  │    If you didn't create an         │  │
│  │    account, ignore this email.     │  │
│  │                                    │  │
│  └────────────────────────────────────┘  │
│                                          │
│       © 2026 Workie. All rights reserved │
│                                          │
└──────────────────────────────────────────┘
```

---

## Expected Outcome
After implementation:
1. Users must verify email before accessing the platform
2. Branded, professional confirmation emails matching Workie's design
3. Clear UX with "Check Your Email" screen and resend option
4. Automatic referral verification upon email confirmation
5. Secure, backend-driven email delivery via Resend
