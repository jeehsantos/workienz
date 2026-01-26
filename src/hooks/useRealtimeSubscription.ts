/**
 * useRealtimeSubscription Hook
 * 
 * Custom hook for managing Supabase real-time subscriptions with connection pooling.
 * Uses the RealtimeConnectionManager to optimize connection usage.
 * 
 * Requirements: 9.1, 9.5
 */

import { useEffect, useRef } from "react";
import { realtimeConnectionManager } from "@/lib/realtimeConnectionManager";

interface UseRealtimeSubscriptionOptions {
  channelName: string;
  event: "INSERT" | "UPDATE" | "DELETE" | "*";
  schema: string;
  table: string;
  filter?: string;
  callback: (payload: any) => void;
  enabled?: boolean;
  enableBatching?: boolean; // Enable update batching (Requirement 9.2)
}

/**
 * Hook for subscribing to real-time database changes with connection pooling
 * 
 * @example
 * ```tsx
 * // Without batching (default)
 * useRealtimeSubscription({
 *   channelName: `messages-${conversationId}`,
 *   event: "INSERT",
 *   schema: "public",
 *   table: "messages",
 *   filter: `conversation_id=eq.${conversationId}`,
 *   callback: (payload) => {
 *     setMessages(prev => [...prev, payload.new]);
 *   },
 *   enabled: !!conversationId,
 * });
 * 
 * // With batching enabled (for high-frequency updates)
 * useRealtimeSubscription({
 *   channelName: "notifications",
 *   event: "INSERT",
 *   schema: "public",
 *   table: "notifications",
 *   callback: (payload) => {
 *     if (payload.batched) {
 *       // Handle batched updates
 *       setNotifications(prev => [...payload.updates.map(u => u.new), ...prev]);
 *     } else {
 *       // Handle single update
 *       setNotifications(prev => [payload.new, ...prev]);
 *     }
 *   },
 *   enableBatching: true,
 * });
 * ```
 */
export function useRealtimeSubscription({
  channelName,
  event,
  schema,
  table,
  filter,
  callback,
  enabled = true,
  enableBatching = false,
}: UseRealtimeSubscriptionOptions) {
  const subscriberIdRef = useRef<string>(
    `subscriber-${Math.random().toString(36).substring(7)}`
  );
  const callbackRef = useRef(callback);

  // Keep callback ref up to date
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    const subscriberId = subscriberIdRef.current;

    // Subscribe using the connection manager
    const unsubscribe = realtimeConnectionManager.subscribe(
      channelName,
      subscriberId,
      {
        event: "postgres_changes",
        schema,
        table,
        filter,
      },
      (payload) => {
        callbackRef.current(payload);
      },
      {
        enableBatching,
      }
    );

    // Cleanup on unmount (Requirement 9.5)
    return () => {
      unsubscribe();
    };
  }, [channelName, event, schema, table, filter, enabled, enableBatching]);
}
