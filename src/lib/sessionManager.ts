/**
 * Session Management Utilities
 * 
 * Provides utilities for managing user sessions, including:
 * - Activity tracking for session timeout
 * - Automatic logout after inactivity period
 * - Session cleanup on logout
 * 
 * Requirements: 15.4, 15.5
 */

import { supabase } from "@/integrations/supabase/client";
import { clearTokenData } from "./tokenManager";

export interface SessionConfig {
  inactivityTimeout: number; // milliseconds
  warningBeforeTimeout: number; // milliseconds
  onInactivityWarning?: () => void;
  onSessionTimeout?: () => void;
}

const DEFAULT_CONFIG: SessionConfig = {
  inactivityTimeout: 24 * 60 * 60 * 1000, // 24 hours
  warningBeforeTimeout: 5 * 60 * 1000, // 5 minutes before timeout
};

let sessionConfig: SessionConfig = { ...DEFAULT_CONFIG };
let lastActivityTime: number = Date.now();
let inactivityTimer: number | null = null;
let warningTimer: number | null = null;
let isInitialized = false;

/**
 * Activity events to track
 */
const ACTIVITY_EVENTS = [
  "mousedown",
  "mousemove",
  "keypress",
  "scroll",
  "touchstart",
  "click",
];

/**
 * Update last activity timestamp
 */
function updateActivity(): void {
  lastActivityTime = Date.now();
  
  // Store in localStorage for cross-tab sync
  try {
    localStorage.setItem("session_last_activity", lastActivityTime.toString());
  } catch (error) {
    console.error("[SessionManager] Error storing activity time:", error);
  }
  
  // Reset timers
  scheduleInactivityCheck();
}

/**
 * Check if session has timed out due to inactivity
 */
function checkInactivity(): boolean {
  const now = Date.now();
  const inactiveTime = now - lastActivityTime;
  
  return inactiveTime >= sessionConfig.inactivityTimeout;
}

/**
 * Handle session timeout
 */
async function handleSessionTimeout(): Promise<void> {
  console.log("[SessionManager] Session timed out due to inactivity");
  
  // Call callback if provided
  sessionConfig.onSessionTimeout?.();
  
  // Sign out user
  await signOutAndCleanup();
}

/**
 * Handle inactivity warning
 */
function handleInactivityWarning(): void {
  console.log("[SessionManager] Inactivity warning triggered");
  
  // Call callback if provided
  sessionConfig.onInactivityWarning?.();
}

/**
 * Schedule inactivity check
 */
function scheduleInactivityCheck(): void {
  // Clear existing timers
  if (inactivityTimer !== null) {
    clearTimeout(inactivityTimer);
    inactivityTimer = null;
  }
  if (warningTimer !== null) {
    clearTimeout(warningTimer);
    warningTimer = null;
  }
  
  // Schedule warning timer
  const warningTime = sessionConfig.inactivityTimeout - sessionConfig.warningBeforeTimeout;
  if (warningTime > 0) {
    warningTimer = window.setTimeout(() => {
      if (checkInactivity()) {
        handleInactivityWarning();
      }
    }, warningTime);
  }
  
  // Schedule timeout timer
  inactivityTimer = window.setTimeout(() => {
    if (checkInactivity()) {
      handleSessionTimeout();
    }
  }, sessionConfig.inactivityTimeout);
}

/**
 * Initialize session manager
 */
export function initializeSessionManager(config: Partial<SessionConfig> = {}): void {
  if (isInitialized) {
    console.warn("[SessionManager] Already initialized");
    return;
  }
  
  sessionConfig = { ...DEFAULT_CONFIG, ...config };
  
  // Try to restore last activity time from localStorage
  try {
    const stored = localStorage.getItem("session_last_activity");
    if (stored) {
      const storedTime = parseInt(stored, 10);
      if (!isNaN(storedTime)) {
        lastActivityTime = storedTime;
      }
    }
  } catch (error) {
    console.error("[SessionManager] Error restoring activity time:", error);
  }
  
  // Set up activity listeners
  ACTIVITY_EVENTS.forEach((event) => {
    document.addEventListener(event, updateActivity, { passive: true });
  });
  
  // Check for activity in other tabs
  window.addEventListener("storage", (event) => {
    if (event.key === "session_last_activity" && event.newValue) {
      const newTime = parseInt(event.newValue, 10);
      if (!isNaN(newTime) && newTime > lastActivityTime) {
        lastActivityTime = newTime;
        scheduleInactivityCheck();
      }
    }
  });
  
  // Check on visibility change
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      // Check if session timed out while tab was hidden
      if (checkInactivity()) {
        handleSessionTimeout();
      } else {
        // Update activity and reschedule
        updateActivity();
      }
    }
  });
  
  // Initial activity update and schedule
  updateActivity();
  
  isInitialized = true;
  console.log("[SessionManager] Initialized with timeout:", sessionConfig.inactivityTimeout / 1000 / 60, "minutes");
}

/**
 * Stop session manager
 */
export function stopSessionManager(): void {
  if (!isInitialized) {
    return;
  }
  
  // Remove activity listeners
  ACTIVITY_EVENTS.forEach((event) => {
    document.removeEventListener(event, updateActivity);
  });
  
  // Clear timers
  if (inactivityTimer !== null) {
    clearTimeout(inactivityTimer);
    inactivityTimer = null;
  }
  if (warningTimer !== null) {
    clearTimeout(warningTimer);
    warningTimer = null;
  }
  
  isInitialized = false;
  console.log("[SessionManager] Stopped");
}

/**
 * Get time until session timeout
 */
export function getTimeUntilTimeout(): number {
  const now = Date.now();
  const inactiveTime = now - lastActivityTime;
  const remainingTime = sessionConfig.inactivityTimeout - inactiveTime;
  
  return Math.max(0, remainingTime);
}

/**
 * Get time until inactivity warning
 */
export function getTimeUntilWarning(): number {
  const now = Date.now();
  const inactiveTime = now - lastActivityTime;
  const warningTime = sessionConfig.inactivityTimeout - sessionConfig.warningBeforeTimeout;
  const remainingTime = warningTime - inactiveTime;
  
  return Math.max(0, remainingTime);
}

/**
 * Check if session is active
 */
export function isSessionActive(): boolean {
  return !checkInactivity();
}

/**
 * Manually extend session (reset activity timer)
 */
export function extendSession(): void {
  updateActivity();
}

/**
 * Sign out and cleanup all session data
 * Requirements: 15.4
 */
export async function signOutAndCleanup(): Promise<void> {
  console.log("[SessionManager] Signing out and cleaning up session data");
  
  try {
    // Stop session manager
    stopSessionManager();
    
    // Clear token data
    clearTokenData();
    
    // Clear session activity tracking
    try {
      localStorage.removeItem("session_last_activity");
    } catch (error) {
      console.error("[SessionManager] Error clearing activity time:", error);
    }
    
    // Clear any cached data
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.startsWith("cache_") ||
          key.startsWith("query_") ||
          key.includes("user_data")
        )) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    } catch (error) {
      console.error("[SessionManager] Error clearing cached data:", error);
    }
    
    // Clear session storage
    try {
      sessionStorage.clear();
    } catch (error) {
      console.error("[SessionManager] Error clearing session storage:", error);
    }
    
    // Sign out from Supabase
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("[SessionManager] Error signing out:", error);
    }
    
    console.log("[SessionManager] Session cleanup complete");
  } catch (error) {
    console.error("[SessionManager] Error during sign out and cleanup:", error);
  }
}

/**
 * Get session info for debugging
 */
export function getSessionInfo(): {
  lastActivity: Date;
  timeUntilTimeout: number;
  timeUntilWarning: number;
  isActive: boolean;
} {
  return {
    lastActivity: new Date(lastActivityTime),
    timeUntilTimeout: getTimeUntilTimeout(),
    timeUntilWarning: getTimeUntilWarning(),
    isActive: isSessionActive(),
  };
}
