
# Fix Referral Verification on Profile Completion

## Problem Summary
The referral system has a gap in its workflow. When a user signs up via a referral link:
1. The referral is recorded with `status: 'pending'` (this works correctly)
2. The referred user completes their profile
3. **The referral never gets verified** because the `verify-referral` edge function is never called

The referrer sees their referred friend as "Pending" forever, even after the friend completes their profile.

## Current Flow vs Expected Flow

```text
CURRENT FLOW:
┌────────────────┐    ┌──────────────────┐    ┌──────────────────┐    ┌────────────────┐
│ User clicks    │───▶│ User signs up    │───▶│ process-referral │───▶│ Referral stays │
│ referral link  │    │ & signs in       │    │ creates "pending"│    │ PENDING forever│
└────────────────┘    └──────────────────┘    └──────────────────┘    └────────────────┘
                                                      │
                                        User completes profile
                                              (nothing happens)

EXPECTED FLOW:
┌────────────────┐    ┌──────────────────┐    ┌──────────────────┐    ┌────────────────┐
│ User clicks    │───▶│ User signs up    │───▶│ process-referral │───▶│ User completes │
│ referral link  │    │ & signs in       │    │ creates "pending"│    │ profile setup  │
└────────────────┘    └──────────────────┘    └──────────────────┘    └───────┬────────┘
                                                                              │
                                                                              ▼
                                    ┌────────────────────┐    ┌───────────────────────┐
                                    │ Referrer receives  │◀───│ verify-referral edge  │
                                    │ bonus credits!     │    │ function called       │
                                    └────────────────────┘    └───────────────────────┘
```

## Solution
Call the `verify-referral` edge function when an employee completes their profile setup for the first time.

### Implementation Details

**File: `src/pages/employee/EmployeeProfile.tsx`**

1. **Import the verification hook**
   - Add `useVerifyReferral` from `@/hooks/useReferrals`

2. **Initialize the hook in the component**
   - Create a `verifyReferral` mutation instance

3. **Trigger verification after successful first-time profile save**
   - In the `handleSubmit` function, after a successful INSERT (not UPDATE)
   - Call `verifyReferral.mutate()` to trigger the edge function
   - This verifies any pending referral for this user and credits the referrer

### Why This Approach?

1. **Backend-centric**: The actual verification logic remains in the edge function, not the frontend
2. **Idempotent**: The `verify-referral` function safely handles cases where there's no pending referral
3. **Single trigger point**: Profile completion is a clear milestone that happens exactly once
4. **Minimal changes**: Only requires adding ~5 lines to the existing profile save logic

---

## Technical Changes

### `src/pages/employee/EmployeeProfile.tsx`

**Add import:**
```typescript
import { useVerifyReferral } from "@/hooks/useReferrals";
```

**Initialize hook (inside component):**
```typescript
const verifyReferral = useVerifyReferral();
```

**Modify handleSubmit (after successful first-time profile creation):**
```typescript
// After the INSERT succeeds and before showing success toast:
if (!existingProfile) {
  // This is a new profile - verify any pending referral
  verifyReferral.mutate();
}
```

This small change connects the profile completion event to the referral verification system, ensuring referrers get their credits when their friends complete the signup process.
