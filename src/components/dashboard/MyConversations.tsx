import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, Loader2, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Conversation = {
  id: string;
  status: string;
  updated_at: string;
  job_title: string;
  other_party_name: string;
};

interface MyConversationsProps {
  userId: string;
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
          job_application_id
        `)
        .or(`contractor_user_id.eq.${userId},employee_user_id.eq.${userId}`)
        .order("updated_at", { ascending: false })
        .limit(5);

      if (error) {
        console.error("Error fetching conversations:", error);
        setIsLoading(false);
        return;
      }

      // Enrich with job titles and other party names
      const enriched = await Promise.all(
        (convData || []).map(async (conv) => {
          // Get job title through job application (if exists)
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
          const otherUserId =
            conv.contractor_user_id === userId
              ? conv.employee_user_id
              : conv.contractor_user_id;

          const { data: profileData } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("user_id", otherUserId)
            .maybeSingle();

          return {
            id: conv.id,
            status: conv.status,
            updated_at: conv.updated_at,
            job_title: jobTitle,
            other_party_name: profileData?.full_name || "User",
          };
        })
      );

      setConversations(enriched);
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

  return (
    <div className="space-y-2">
      {conversations.map((conv) => (
        <Link
          key={conv.id}
          to={`/messages/${conv.id}`}
          className="block p-3 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border/50"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm truncate">
                  {conv.other_party_name}
                </p>
                <Badge
                  variant={conv.status === "active" ? "default" : "secondary"}
                  className="text-xs"
                >
                  {conv.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                Re: {conv.job_title}
              </p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
