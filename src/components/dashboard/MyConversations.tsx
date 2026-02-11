import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, Loader2, User, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";

type Conversation = {
  id: string;
  status: string;
  updated_at: string;
  job_title: string;
  other_party_name: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  activity_started_at: string | null;
  last_activity_at: string | null;
  hired_at: string | null;
  scheduled_deletion_at: string | null;
  application_status: string | null;
};

interface MyConversationsProps {
  userId: string;
}

function formatMessageTime(dateString: string | null): string {
  if (!dateString) return "";
  
  const date = new Date(dateString);
  
  if (isToday(date)) {
    return format(date, "h:mm a");
  } else if (isYesterday(date)) {
    return "Yesterday " + format(date, "h:mm a");
  } else {
    return format(date, "MMM d, h:mm a");
  }
}

export default function MyConversations({ userId }: MyConversationsProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchConversations() {
      // Fetch conversations where user is either contractor or employee
      const { data: convData, error } = await supabase
        .from("conversations")
        .select(`
          id,
          status,
          updated_at,
          contractor_user_id,
          employee_user_id,
          job_application_id,
          activity_started_at,
          last_activity_at,
          hired_at,
          scheduled_deletion_at
        `)
        .or(`contractor_user_id.eq.${userId},employee_user_id.eq.${userId}`)
        .order("updated_at", { ascending: false })
        .limit(5);

      if (error) {
        console.error("Error fetching conversations:", error);
        setIsLoading(false);
        return;
      }

      // Enrich with job titles, other party names, and last message info
      const enriched = await Promise.all(
        (convData || []).map(async (conv) => {
          // Get job title and application status through job application (if exists)
          let jobTitle = "Direct Contact";
          let applicationStatus: string | null = null;
          if (conv.job_application_id) {
            const { data: appData } = await supabase
              .from("job_applications")
              .select("job_id, status")
              .eq("id", conv.job_application_id)
              .maybeSingle();

            if (appData) {
              applicationStatus = appData.status;
              const { data: jobData } = await supabase
                .from("jobs")
                .select("title")
                .eq("id", appData.job_id)
                .maybeSingle();
              if (jobData) jobTitle = jobData.title;
            }
          }

          // Get other party name
          const otherUserId =
            conv.contractor_user_id === userId
              ? conv.employee_user_id
              : conv.contractor_user_id;

          const { data: profileData } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("user_id", otherUserId)
            .maybeSingle();

          // Get last message
          const { data: lastMessageData } = await supabase
            .from("messages")
            .select("content, created_at")
            .eq("conversation_id", conv.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          const derivedName = profileData?.full_name || "User";
          return {
            id: conv.id,
            status: conv.status,
            updated_at: conv.updated_at,
            job_title: jobTitle,
            other_party_name: derivedName,
            last_message_at: lastMessageData?.created_at || null,
            last_message_preview: lastMessageData?.content 
              ? lastMessageData.content.substring(0, 40) + (lastMessageData.content.length > 40 ? "..." : "")
              : null,
            activity_started_at: conv.activity_started_at,
            last_activity_at: conv.last_activity_at,
            hired_at: conv.hired_at,
            scheduled_deletion_at: conv.scheduled_deletion_at,
            application_status: applicationStatus,
          };
        })
      );

      // Filter out conversations that are past their scheduled deletion time
      const now = new Date();
      const filtered = enriched.filter((conv) => {
        if (conv.scheduled_deletion_at) {
          const deletionAt = new Date(conv.scheduled_deletion_at);
          if (deletionAt <= now) return false;
        }
        return true;
      });

      // Sort by last message time
      filtered.sort((a, b) => {
        const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
        const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
        return bTime - aTime;
      });

      setConversations(filtered);
      setIsLoading(false);
    }

    fetchConversations();
  }, [userId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No conversations yet</p>
      </div>
    );
  }

  // Calculate hired countdown for a conversation
  const getHiredStatus = (conv: Conversation) => {
    if (!conv.hired_at) {
      return null;
    }

    const now = new Date();
    if (conv.scheduled_deletion_at) {
      const deletionAt = new Date(conv.scheduled_deletion_at);
      const hoursLeft = Math.max(1, Math.ceil((deletionAt.getTime() - now.getTime()) / (1000 * 60 * 60)));
      return { isHired: true, hoursLeft };
    }

    // Hired but no deletion scheduled yet - show as hired
    return { isHired: true, hoursLeft: null };
  };

  // Calculate expiry status for a conversation (only for non-hired conversations)
  const getExpiryStatus = (conv: Conversation) => {
    // Don't show inactivity expiry for hired conversations
    if (conv.hired_at) return null;
    
    if (!conv.activity_started_at || !conv.last_activity_at || conv.status !== "active") {
      return null;
    }

    const now = new Date();
    const activityStart = new Date(conv.activity_started_at);
    const lastActivity = new Date(conv.last_activity_at);

    const hoursSinceStart = (now.getTime() - activityStart.getTime()) / (1000 * 60 * 60);
    const hoursSinceActivity = (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60);

    if (hoursSinceActivity < 24) return null;
    if (hoursSinceStart >= 72) return { status: "expired", hoursLeft: 0 };

    const hoursLeft = Math.max(0, Math.ceil(72 - hoursSinceStart));
    return { status: "warning", hoursLeft };
  };

  return (
    <div className="space-y-2">
      {conversations.map((conv) => {
        const hiredStatus = getHiredStatus(conv);
        const expiry = getExpiryStatus(conv);

        // Determine visual styling based on hired vs expiry
        const isHiredConv = hiredStatus?.isHired;
        const hasWarning = expiry?.status === "warning";

        return (
          <Link
            key={conv.id}
            to={`/messages/${conv.id}`}
            className={`block p-3 rounded-lg hover:bg-muted/50 transition-colors border ${
              isHiredConv
                ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20"
                : hasWarning
                  ? "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20"
                  : "border-transparent hover:border-border/50"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                isHiredConv
                  ? "bg-emerald-100 dark:bg-emerald-900/50"
                  : hasWarning 
                    ? "bg-amber-100 dark:bg-amber-900/50" 
                    : "bg-primary/10"
              }`}>
                {isHiredConv ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                ) : hasWarning ? (
                  <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                ) : (
                  <User className="w-5 h-5 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {conv.other_party_name}
                    </p>
                    {isHiredConv ? (
                      <Badge variant="outline" className="text-[10px] flex-shrink-0 border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Hired{hiredStatus.hoursLeft != null ? ` • ${hiredStatus.hoursLeft}h` : ""}
                      </Badge>
                    ) : hasWarning ? (
                      <Badge variant="outline" className="text-[10px] flex-shrink-0 border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        {expiry.hoursLeft}h left
                      </Badge>
                    ) : (
                      <Badge
                        variant={conv.status === "active" ? "default" : "secondary"}
                        className="text-xs flex-shrink-0"
                      >
                        {conv.status}
                      </Badge>
                    )}
                  </div>
                  {conv.last_message_at && (
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {formatMessageTime(conv.last_message_at)}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  Re: {conv.job_title}
                </p>
                {conv.last_message_preview && (
                  <p className="text-xs text-muted-foreground/70 truncate mt-0.5 italic">
                    "{conv.last_message_preview}"
                  </p>
                )}
                {isHiredConv && hiredStatus.hoursLeft != null && (
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1">
                    🎉 Hired! Archives in {hiredStatus.hoursLeft} hours
                  </p>
                )}
                {hasWarning && !isHiredConv && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                    Reply soon to keep this conversation active
                  </p>
                )}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
