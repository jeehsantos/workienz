import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useUnreadMessages(userId: string | undefined) {
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    if (!userId) {
      setUnreadCount(0);
      return;
    }

    try {
      const { data, error } = await supabase.rpc("get_unread_message_count", {
        _user_id: userId,
      });

      if (error) {
        console.error("Error fetching unread count:", error);
        return;
      }

      setUnreadCount(data || 0);
    } catch (error) {
      console.error("Error fetching unread count:", error);
    }
  }, [userId]);

  useEffect(() => {
    fetchUnreadCount();

    // Subscribe to new messages for real-time updates
    if (!userId) return;

    const channel = supabase
      .channel("unread-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        () => {
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchUnreadCount]);

  return { unreadCount, refetch: fetchUnreadCount };
}
