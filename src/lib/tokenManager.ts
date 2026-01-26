/**
 * Token Management Utilities
 * 
 * Provides utilities for managing JWT tokens on the client side,
 * including automatic refresh before expiration and secure storage.
 * 
 * Requirements: 2.2, 15.1, 15.2
 */

import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";

export interface TokenInfo {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  expiresIn: number;
  shouldRefresh: boolean;
}

export interface TokenRefreshConfig {
  refreshBuffer: number; // seconds before expiration to trigger refresh
  autoRefresh: boolean;
  onRefreshSuccess?: (session: Session) => void;
  onRefreshFailure?: (error: Error) => void;
}

const DEFAULT_CONFIG: TokenRefreshConfig = {
  refreshBuffer: 300, // 5 minutes
  autoRefresh: true,
};

let refreshConfig: TokenRefreshConfig = { ...DEFAULT_CONFIG };
let refreshTimer: number | null = null;

/**
 * Decode JWT token to extract expiration time
 */
function decodeJWT(token: string): { exp?: number; sub?: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

/**
 * Get current token information from session
 */
export async function getTokenInfo(): Promise<TokenInfo | null> {
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error || !session) {
    return null;
  }

  const decoded = decodeJWT(session.access_token);
  if (!decoded || !decoded.exp) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = decoded.exp;
  const expiresIn = expiresAt - now;
  const shouldRefresh = expiresIn <= refreshConfig.refreshBuffer;

  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt,
    expiresIn,
    shouldRefresh,
  };
}

/**
 * Check if current token needs refresh
 */
export async function shouldRefreshToken(): Promise<boolean> {
  const tokenInfo = await getTokenInfo();
  return tokenInfo?.shouldRefresh ?? false;
}

/**
 * Manually refresh the current session token
 */
export async function refreshToken(): Promise<Session | null> {
  try {
    const { data: { session }, error } = await supabase.auth.refreshSession();

    if (error) {
      console.error("[TokenManager] Token refresh failed:", error.message);
      refreshConfig.onRefreshFailure?.(error);
      return null;
    }

    if (session) {
      console.log("[TokenManager] Token refreshed successfully");
      refreshConfig.onRefreshSuccess?.(session);
      
      // Schedule next refresh
      if (refreshConfig.autoRefresh) {
        scheduleTokenRefresh();
      }
    }

    return session;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("[TokenManager] Token refresh error:", err.message);
    refreshConfig.onRefreshFailure?.(err);
    return null;
  }
}

/**
 * Schedule automatic token refresh before expiration
 */
export async function scheduleTokenRefresh(): Promise<void> {
  // Clear existing timer
  if (refreshTimer !== null) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }

  const tokenInfo = await getTokenInfo();
  if (!tokenInfo) {
    return;
  }

  // Calculate when to refresh (buffer seconds before expiration)
  const refreshIn = Math.max(0, tokenInfo.expiresIn - refreshConfig.refreshBuffer);
  const refreshInMs = refreshIn * 1000;

  console.log(
    `[TokenManager] Token refresh scheduled in ${refreshIn}s (expires in ${tokenInfo.expiresIn}s)`
  );

  refreshTimer = window.setTimeout(async () => {
    console.log("[TokenManager] Auto-refreshing token");
    await refreshToken();
  }, refreshInMs);
}

/**
 * Initialize token manager with configuration
 */
export function initializeTokenManager(config: Partial<TokenRefreshConfig> = {}): void {
  refreshConfig = { ...DEFAULT_CONFIG, ...config };

  // Set up automatic refresh if enabled
  if (refreshConfig.autoRefresh) {
    scheduleTokenRefresh();

    // Re-schedule on visibility change (tab becomes active)
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        scheduleTokenRefresh();
      }
    });
  }
}

/**
 * Stop automatic token refresh
 */
export function stopTokenRefresh(): void {
  if (refreshTimer !== null) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

/**
 * Get token for API requests with automatic refresh
 */
export async function getAccessToken(): Promise<string | null> {
  // Check if token needs refresh
  if (await shouldRefreshToken()) {
    console.log("[TokenManager] Token needs refresh, refreshing now");
    const session = await refreshToken();
    return session?.access_token ?? null;
  }

  // Get current token
  const tokenInfo = await getTokenInfo();
  return tokenInfo?.accessToken ?? null;
}

/**
 * Validate token is not expired
 */
export async function isTokenValid(): Promise<boolean> {
  const tokenInfo = await getTokenInfo();
  if (!tokenInfo) {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  return tokenInfo.expiresAt > now;
}

/**
 * Clear all token data (for logout)
 */
export function clearTokenData(): void {
  stopTokenRefresh();
  
  // Clear Supabase session storage
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith("sb-") || key.includes("supabase") || key.includes("auth-token"))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    console.error("[TokenManager] Error clearing token data:", error);
  }
}

/**
 * Get token expiration time in human-readable format
 */
export async function getTokenExpirationInfo(): Promise<string | null> {
  const tokenInfo = await getTokenInfo();
  if (!tokenInfo) {
    return null;
  }

  const minutes = Math.floor(tokenInfo.expiresIn / 60);
  const seconds = tokenInfo.expiresIn % 60;

  if (tokenInfo.expiresIn <= 0) {
    return "Expired";
  } else if (minutes > 60) {
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}
