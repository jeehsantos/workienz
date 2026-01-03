import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUnreadRefreshListener } from "@/hooks/useProfileRefresh";

export interface UnreadConversation {
  id: string;
  jobTitle: string;
  otherPartyName: string;
  lastMessagePreview: string;
  lastMessageAt: string;
  unreadCount: number;
}

export function useUnreadMessages(userId: string | undefined) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadConversations, setUnreadConversations] = useState<UnreadConversation[]>([]);

  const fetchUnreadData = useCallback(async () => {
    if (!userId) {
      setUnreadCount(0);
      setUnreadConversations([]);
      return;
    }

    try {
      // Fetch unread count
      const { data: countData, error: countError } = await supabase.rpc("get_unread_message_count", {
        _user_id: userId,
      });

      if (countError) {
        console.error("Error fetching unread count:", countError);
        return;
      }

      setUnreadCount(countData || 0);

      // Only fetch conversation details if there are unread messages
      if (!countData || countData === 0) {
        setUnreadConversations([]);
        return;
      }

      // Fetch conversations with unread messages
      const { data: convData, error: convError } = await supabase
        .from("conversations")
        .select(`
          id,
          contractor_user_id,
          employee_user_id,
          job_application_id,
          status
        `)
        .or(`contractor_user_id.eq.${userId},employee_user_id.eq.${userId}`)
        .eq("status", "active");

      if (convError) {
        console.error("Error fetching conversations:", convError);
        return;
      }

      // Get user's read status for each conversation
      const { data: readStatusData } = await supabase
        .from("conversation_read_status")
        .select("conversation_id, last_read_at")
        .eq("user_id", userId);

      const readStatusMap = new Map(
        (readStatusData || []).map(rs => [rs.conversation_id, rs.last_read_at])
      );

      // Enrich conversations with unread message info
      const enrichedConversations: UnreadConversation[] = [];

      for (const conv of convData || []) {
        const lastReadAt = readStatusMap.get(conv.id) || "1970-01-01T00:00:00Z";

        // Get unread messages for this conversation
        const { data: unreadMessages, error: msgError } = await supabase
          .from("messages")
          .select("content, created_at")
          .eq("conversation_id", conv.id)
          .neq("sender_user_id", userId)
          .gt("created_at", lastReadAt)
          .order("created_at", { ascending: false })
          .limit(1);

        if (msgError || !unreadMessages || unreadMessages.length === 0) continue;

        // Count unread messages
        const { count } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", conv.id)
          .neq("sender_user_id", userId)
          .gt("created_at", lastReadAt);

        // Get job title
        let jobTitle = "Direct Contact";
        if (conv.job_application_id) {
          const { data: appData } = await supabase
            .from("job_applications")
            .select("job_id")
            .eq("id", conv.job_application_id)
            .maybeSingle();

          if (appData) {
            const { data: jobData } = await supabase
              .from("jobs")
              .select("title")
              .eq("id", appData.job_id)
              .maybeSingle();
            if (jobData) jobTitle = jobData.title;
          }
        }

        // Get other party name
        const otherUserId = conv.contractor_user_id === userId 
          ? conv.employee_user_id 
          : conv.contractor_user_id;

        const { data: profileData } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", otherUserId)
          .maybeSingle();

        enrichedConversations.push({
          id: conv.id,
          jobTitle,
          otherPartyName: profileData?.full_name || "User",
          lastMessagePreview: unreadMessages[0].content.substring(0, 50) + (unreadMessages[0].content.length > 50 ? "..." : ""),
          lastMessageAt: unreadMessages[0].created_at,
          unreadCount: count || 1,
        });
      }

      // Sort by most recent message
      enrichedConversations.sort((a, b) => 
        new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      );

      setUnreadConversations(enrichedConversations.slice(0, 5));
    } catch (error) {
      console.error("Error fetching unread data:", error);
    }
  }, [userId]);

  // Listen for manual unread refresh events (from conversation page)
  useUnreadRefreshListener(fetchUnreadData);

  useEffect(() => {
    fetchUnreadData();

    // Subscribe to new messages and read status updates for real-time updates
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
          fetchUnreadData();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversation_read_status",
        },
        () => {
          // Refetch on any read status change
          fetchUnreadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchUnreadData]);

  return { unreadCount, unreadConversations, refetch: fetchUnreadData };
}
