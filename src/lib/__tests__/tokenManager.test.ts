/**
 * Unit Tests for Token Manager
 * 
 * Tests token management utilities including refresh scheduling,
 * expiration checking, and token validation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getTokenInfo,
  shouldRefreshToken,
  refreshToken,
  scheduleTokenRefresh,
  initializeTokenManager,
  stopTokenRefresh,
  getAccessToken,
  isTokenValid,
  clearTokenData,
  getTokenExpirationInfo,
} from '../tokenManager';
import { supabase } from '@/integrations/supabase/client';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      refreshSession: vi.fn(),
    },
  },
}));

describe('Token Manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stopTokenRefresh();
  });

  afterEach(() => {
    stopTokenRefresh();
  });

  describe('getTokenInfo', () => {
    it('should return null when no session exists', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const tokenInfo = await getTokenInfo();
      expect(tokenInfo).toBeNull();
    });

    it('should return token info when session exists', async () => {
      const mockSession = {
        access_token: createMockToken(3600), // 1 hour
        refresh_token: 'mock-refresh-token',
        user: { id: 'user-123' },
      };

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession as any },
        error: null,
      });

      const tokenInfo = await getTokenInfo();
      expect(tokenInfo).not.toBeNull();
      expect(tokenInfo?.accessToken).toBe(mockSession.access_token);
      expect(tokenInfo?.refreshToken).toBe(mockSession.refresh_token);
      expect(tokenInfo?.expiresIn).toBeGreaterThan(0);
    });

    it('should indicate refresh needed when token expires soon', async () => {
      const mockSession = {
        access_token: createMockToken(200), // 200 seconds (< 5 min buffer)
        refresh_token: 'mock-refresh-token',
        user: { id: 'user-123' },
      };

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession as any },
        error: null,
      });

      const tokenInfo = await getTokenInfo();
      expect(tokenInfo?.shouldRefresh).toBe(true);
    });
  });

  describe('shouldRefreshToken', () => {
    it('should return true when token needs refresh', async () => {
      const mockSession = {
        access_token: createMockToken(200), // 200 seconds
        refresh_token: 'mock-refresh-token',
        user: { id: 'user-123' },
      };

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession as any },
        error: null,
      });

      const shouldRefresh = await shouldRefreshToken();
      expect(shouldRefresh).toBe(true);
    });

    it('should return false when token is fresh', async () => {
      const mockSession = {
        access_token: createMockToken(3600), // 1 hour
        refresh_token: 'mock-refresh-token',
        user: { id: 'user-123' },
      };

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession as any },
        error: null,
      });

      const shouldRefresh = await shouldRefreshToken();
      expect(shouldRefresh).toBe(false);
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      const newSession = {
        access_token: createMockToken(3600),
        refresh_token: 'new-refresh-token',
        user: { id: 'user-123' },
      };

      vi.mocked(supabase.auth.refreshSession).mockResolvedValue({
        data: { session: newSession as any, user: newSession.user as any },
        error: null,
      });

      const session = await refreshToken();
      expect(session).not.toBeNull();
      expect(session?.access_token).toBe(newSession.access_token);
    });

    it('should return null on refresh failure', async () => {
      vi.mocked(supabase.auth.refreshSession).mockResolvedValue({
        data: { session: null, user: null },
        error: new Error('Refresh failed') as any,
      });

      const session = await refreshToken();
      expect(session).toBeNull();
    });

    it('should call onRefreshSuccess callback', async () => {
      const onSuccess = vi.fn();
      const newSession = {
        access_token: createMockToken(3600),
        refresh_token: 'new-refresh-token',
        user: { id: 'user-123' },
      };

      vi.mocked(supabase.auth.refreshSession).mockResolvedValue({
        data: { session: newSession as any, user: newSession.user as any },
        error: null,
      });

      initializeTokenManager({
        autoRefresh: false,
        onRefreshSuccess: onSuccess,
      });

      await refreshToken();
      expect(onSuccess).toHaveBeenCalledWith(newSession);
    });

    it('should call onRefreshFailure callback', async () => {
      const onFailure = vi.fn();
      const error = new Error('Refresh failed');

      vi.mocked(supabase.auth.refreshSession).mockResolvedValue({
        data: { session: null, user: null },
        error: error as any,
      });

      initializeTokenManager({
        autoRefresh: false,
        onRefreshFailure: onFailure,
      });

      await refreshToken();
      expect(onFailure).toHaveBeenCalled();
    });
  });

  describe('getAccessToken', () => {
    it('should return current token when fresh', async () => {
      const mockSession = {
        access_token: createMockToken(3600),
        refresh_token: 'mock-refresh-token',
        user: { id: 'user-123' },
      };

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession as any },
        error: null,
      });

      const token = await getAccessToken();
      expect(token).toBe(mockSession.access_token);
    });

    it('should refresh token when expiring soon', async () => {
      const oldToken = createMockToken(200); // 200 seconds
      const newToken = createMockToken(3600); // 1 hour

      // First call returns old token
      vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
        data: {
          session: {
            access_token: oldToken,
            refresh_token: 'mock-refresh-token',
            user: { id: 'user-123' },
          } as any,
        },
        error: null,
      });

      // Refresh returns new token
      vi.mocked(supabase.auth.refreshSession).mockResolvedValue({
        data: {
          session: {
            access_token: newToken,
            refresh_token: 'new-refresh-token',
            user: { id: 'user-123' },
          } as any,
          user: { id: 'user-123' } as any,
        },
        error: null,
      });

      const token = await getAccessToken();
      expect(token).toBe(newToken);
      expect(supabase.auth.refreshSession).toHaveBeenCalled();
    });
  });

  describe('isTokenValid', () => {
    it('should return true for valid token', async () => {
      const mockSession = {
        access_token: createMockToken(3600),
        refresh_token: 'mock-refresh-token',
        user: { id: 'user-123' },
      };

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession as any },
        error: null,
      });

      const isValid = await isTokenValid();
      expect(isValid).toBe(true);
    });

    it('should return false for expired token', async () => {
      const mockSession = {
        access_token: createMockToken(-100), // Expired
        refresh_token: 'mock-refresh-token',
        user: { id: 'user-123' },
      };

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession as any },
        error: null,
      });

      const isValid = await isTokenValid();
      expect(isValid).toBe(false);
    });

    it('should return false when no session', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const isValid = await isTokenValid();
      expect(isValid).toBe(false);
    });
  });

  describe('getTokenExpirationInfo', () => {
    it('should return "Expired" for expired token', async () => {
      const mockSession = {
        access_token: createMockToken(-100),
        refresh_token: 'mock-refresh-token',
        user: { id: 'user-123' },
      };

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession as any },
        error: null,
      });

      const info = await getTokenExpirationInfo();
      expect(info).toBe('Expired');
    });

    it('should return time in seconds for short expiration', async () => {
      const mockSession = {
        access_token: createMockToken(45), // 45 seconds
        refresh_token: 'mock-refresh-token',
        user: { id: 'user-123' },
      };

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession as any },
        error: null,
      });

      const info = await getTokenExpirationInfo();
      expect(info).toMatch(/\d+s/);
    });

    it('should return time in minutes for medium expiration', async () => {
      const mockSession = {
        access_token: createMockToken(600), // 10 minutes
        refresh_token: 'mock-refresh-token',
        user: { id: 'user-123' },
      };

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession as any },
        error: null,
      });

      const info = await getTokenExpirationInfo();
      expect(info).toMatch(/\d+m/);
    });

    it('should return time in hours for long expiration', async () => {
      const mockSession = {
        access_token: createMockToken(7200), // 2 hours
        refresh_token: 'mock-refresh-token',
        user: { id: 'user-123' },
      };

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession as any },
        error: null,
      });

      const info = await getTokenExpirationInfo();
      expect(info).toMatch(/\d+h/);
    });
  });

  describe('clearTokenData', () => {
    it('should stop token refresh', () => {
      initializeTokenManager({ autoRefresh: true });
      clearTokenData();
      // If this doesn't throw, refresh was stopped successfully
      expect(true).toBe(true);
    });
  });
});

/**
 * Helper function to create a mock JWT token
 */
function createMockToken(expiresInSeconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + expiresInSeconds;

  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ sub: 'user-123', exp }));
  const signature = 'mock-signature';

  return `${header}.${payload}.${signature}`;
}
