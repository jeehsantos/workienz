/**
 * useNotifications Hook
 * 
 * Manages user notifications with real-time updates and debouncing.
 * Implements notification debouncing to prevent UI thrashing (Requirement 9.4).
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  action_url: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

const DEBOUNCE_DELAY = 500; // 500ms debounce delay (Requirement 9.4)

export function useNotifications(userId: string | undefined) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  // Debouncing state (Requirement 9.4)
  const pendingUpdatesRef = useRef<Notification[]>([]);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  const fetchNotifications = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        console.error("Error fetching notifications:", error);
        return;
      }

      const notifs = (data || []) as Notification[];
      setNotifications(notifs);
      setUnreadCount(notifs.filter((n) => !n.read).length);
    } catch (err) {
      console.error("Error in fetchNotifications:", err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Debounced notification update handler (Requirement 9.4)
  const flushPendingUpdates = useCallback(() => {
    if (pendingUpdatesRef.current.length === 0 || !isMountedRef.current) return;

    const updates = [...pendingUpdatesRef.current];
    pendingUpdatesRef.current = [];

    console.info(
      `[useNotifications] Flushing ${updates.length} batched notification updates`
    );

    // Apply all pending updates
    setNotifications((prev) => {
      const newNotifications = [...updates, ...prev.slice(0, 19)];
      return newNotifications;
    });
    
    setUnreadCount((prev) => prev + updates.filter(n => !n.read).length);
  }, []);

  const debouncedAddNotification = useCallback((notification: Notification) => {
    // Add to pending updates
    pendingUpdatesRef.current.push(notification);

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer to flush updates after debounce delay
    debounceTimerRef.current = setTimeout(() => {
      flushPendingUpdates();
      debounceTimerRef.current = null;
    }, DEBOUNCE_DELAY);
  }, [flushPendingUpdates]);

  const markAsRead = useCallback(async (notificationId: string) => {
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", notificationId);

    if (!error) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!userId) return;

    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
      .eq("read", false);

    if (!error) {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    }
  }, [userId]);

  const deleteNotification = useCallback(async (notificationId: string) => {
    const notification = notifications.find((n) => n.id === notificationId);
    
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", notificationId);

    if (!error) {
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      if (notification && !notification.read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    }
  }, [notifications]);

  // Initial fetch
  useEffect(() => {
    isMountedRef.current = true;
    fetchNotifications();
    
    return () => {
      isMountedRef.current = false;
      // Clear any pending debounce timer on unmount
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [fetchNotifications]);

  // Realtime subscription for new notifications with debouncing (Requirement 9.4)
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotif = payload.new as Notification;
          // Use debounced handler instead of immediate update
          debouncedAddNotification(newNotif);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as Notification;
          setNotifications((prev) =>
            prev.map((n) => (n.id === updated.id ? updated : n))
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const deleted = payload.old as { id: string };
          setNotifications((prev) => prev.filter((n) => n.id !== deleted.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, debouncedAddNotification]);

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refetch: fetchNotifications,
  };
}
