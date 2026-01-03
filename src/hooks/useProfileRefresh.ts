import { useEffect, useCallback } from "react";

// Custom event name for profile updates
const PROFILE_UPDATED_EVENT = "profile-updated";

/**
 * Dispatch event when profile is updated
 */
export function dispatchProfileUpdated() {
  window.dispatchEvent(new CustomEvent(PROFILE_UPDATED_EVENT));
}

/**
 * Hook to listen for profile update events
 */
export function useProfileRefreshListener(callback: () => void) {
  useEffect(() => {
    const handler = () => callback();
    window.addEventListener(PROFILE_UPDATED_EVENT, handler);
    return () => window.removeEventListener(PROFILE_UPDATED_EVENT, handler);
  }, [callback]);
}

// Custom event for unread messages refresh
const UNREAD_REFRESH_EVENT = "unread-messages-refresh";

/**
 * Dispatch event when messages are read (conversation opened)
 */
export function dispatchUnreadRefresh() {
  window.dispatchEvent(new CustomEvent(UNREAD_REFRESH_EVENT));
}

/**
 * Hook to listen for unread refresh events
 */
export function useUnreadRefreshListener(callback: () => void) {
  const memoizedCallback = useCallback(callback, [callback]);
  
  useEffect(() => {
    const handler = () => memoizedCallback();
    window.addEventListener(UNREAD_REFRESH_EVENT, handler);
    return () => window.removeEventListener(UNREAD_REFRESH_EVENT, handler);
  }, [memoizedCallback]);
}
