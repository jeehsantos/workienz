

## Problem: Page Refreshes on Tab Switch

### Root Cause

In `src/hooks/useAuth.ts` (lines 221-244), there is a `visibilitychange` event listener that calls `supabase.auth.getSession()` **every time the tab becomes visible**. This updates `authState` with new `session` and `user` object references, even when the session hasn't actually changed. Since React uses reference equality, this triggers re-renders across the entire app, causing all components consuming `useAuthContext()` to re-render — which looks like a full page refresh.

```text
Tab switch → visibilitychange fires → getSession() → setAuthState() with new refs → full re-render
```

Additionally, `onAuthStateChange` already handles token refresh events (including `TOKEN_REFRESHED`), so the visibility handler is redundant for keeping the session in sync.

### Fix

**File: `src/hooks/useAuth.ts`** (lines 221-243)

Modify the `onVisibility` handler to only update state if the session actually changed (i.e., user signed in/out in another tab). Compare the user ID from the fetched session against the current state — if they match, skip the state update entirely.

```typescript
const onVisibility = () => {
  if (!isMounted) return;
  if (document.visibilityState !== "visible") return;
  supabase.auth.getSession().then(({ data: { session }, error }) => {
    if (!isMounted) return;
    if (error) {
      clearAuthStorage();
      clearAuthState();
      return;
    }
    // Only update state if the session user actually changed
    const currentUserId = authStateRef.current.user?.id ?? null;
    const newUserId = session?.user?.id ?? null;
    if (currentUserId !== newUserId) {
      setAuthState((prev) => ({
        ...prev,
        session,
        user: session?.user ?? null,
        isLoading: false,
      }));
    }
  }).catch(() => {
    clearAuthStorage();
    clearAuthState();
  });
};
```

This requires adding a `useRef` to track current auth state for the comparison (since the visibility handler is set up once and would otherwise capture stale state).

### Summary of Changes

1. Add `const authStateRef = useRef(authState)` and keep it in sync
2. Update `onVisibility` to compare user IDs before calling `setAuthState`
3. No other files need changes

