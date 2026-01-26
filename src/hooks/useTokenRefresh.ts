/**
 * React Hook for Token Refresh Management
 * 
 * Provides a React hook for managing automatic token refresh
 * and monitoring token expiration status.
 * 
 * Requirements: 2.2, 15.1, 15.2
 */

import { useEffect, useState, useCallback } from "react";
import { Session } from "@supabase/supabase-js";
import {
  initializeTokenManager,
  stopTokenRefresh,
  getTokenInfo,
  refreshToken,
  getTokenExpirationInfo,
  TokenInfo,
} from "@/lib/tokenManager";
import { useAuthContext } from "@/contexts/AuthContext";

export interface UseTokenRefreshOptions {
  refreshBuffer?: number; // seconds before expiration to trigger refresh
  autoRefresh?: boolean;
  onRefreshSuccess?: (session: Session) => void;
  onRefreshFailure?: (error: Error) => void;
}

export interface UseTokenRefreshReturn {
  tokenInfo: TokenInfo | null;
  isRefreshing: boolean;
  expirationInfo: string | null;
  refreshNow: () => Promise<void>;
}

/**
 * Hook for managing token refresh
 * 
 * Usage:
 * ```typescript
 * const { tokenInfo, isRefreshing, expirationInfo, refreshNow } = useTokenRefresh({
 *   refreshBuffer: 300, // 5 minutes
 *   autoRefresh: true,
 * });
 * ```
 */
export function useTokenRefresh(
  options: UseTokenRefreshOptions = {}
): UseTokenRefreshReturn {
  const { user } = useAuthContext();
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expirationInfo, setExpirationInfo] = useState<string | null>(null);

  // Update token info periodically
  const updateTokenInfo = useCallback(async () => {
    const info = await getTokenInfo();
    setTokenInfo(info);

    const expInfo = await getTokenExpirationInfo();
    setExpirationInfo(expInfo);
  }, []);

  // Manual refresh function
  const refreshNow = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshToken();
      await updateTokenInfo();
    } finally {
      setIsRefreshing(false);
    }
  }, [updateTokenInfo]);

  // Initialize token manager when user is authenticated
  useEffect(() => {
    if (!user) {
      stopTokenRefresh();
      setTokenInfo(null);
      setExpirationInfo(null);
      return;
    }

    // Initialize with options
    initializeTokenManager({
      refreshBuffer: options.refreshBuffer ?? 300,
      autoRefresh: options.autoRefresh ?? true,
      onRefreshSuccess: (session) => {
        updateTokenInfo();
        options.onRefreshSuccess?.(session);
      },
      onRefreshFailure: (error) => {
        updateTokenInfo();
        options.onRefreshFailure?.(error);
      },
    });

    // Initial token info update
    updateTokenInfo();

    // Update token info every 30 seconds
    const interval = setInterval(updateTokenInfo, 30000);

    return () => {
      clearInterval(interval);
      stopTokenRefresh();
    };
  }, [user, options.refreshBuffer, options.autoRefresh, updateTokenInfo]);

  return {
    tokenInfo,
    isRefreshing,
    expirationInfo,
    refreshNow,
  };
}
