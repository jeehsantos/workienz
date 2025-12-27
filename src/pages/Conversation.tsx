import { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  ArrowLeft,
  Send,
  Phone,
  X,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Message = {
  id: string;
  content: string;
  sender_user_id: string;
  created_at: string;
};

type ConversationData = {
  id: string;
  status: string;
  contractor_user_id: string;
  employee_user_id: string;
  job_application_id: string | null;
  job_application: {
    id: string;
    status: string;
    job: {
      id: string;
      title: string;
    };
  } | null;
  other_party: {
    full_name: string | null;
    email: string;
    phone: string | null;
  } | null;
};

export default function Conversation() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isContractor } = useAuthContext();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [conversation, setConversation] = useState<ConversationData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isHiring, setIsHiring] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    async function fetchConversation() {
      if (!id) return;

      const { data: convData, error: convError } = await supabase
        .from("conversations")
        .select(`
          id,
          status,
          contractor_user_id,
          employee_user_id,
          job_application_id
        `)
        .eq("id", id)
        .single();

      if (convError || !convData) {
        console.error("Error fetching conversation:", convError);
        setIsLoading(false);
        return;
      }

      // Fetch job application and job info if exists
      let jobTitle = "Direct Contact";
      let jobId = null;
      let applicationStatus = "pending";
      if (convData.job_application_id) {
        const { data: appData } = await supabase
          .from("job_applications")
          .select(`
            id,
            job_id,
            status
          `)
          .eq("id", convData.job_application_id)
          .single();

        if (appData) {
          applicationStatus = appData.status;
          const { data: jobData } = await supabase
            .from("jobs")
            .select("id, title")
            .eq("id", appData.job_id)
            .single();
          if (jobData) {
            jobTitle = jobData.title;
            jobId = jobData.id;
          }
        }
      }

      // Determine other party
      const otherUserId =
        convData.contractor_user_id === user?.id
          ? convData.employee_user_id
          : convData.contractor_user_id;

      // Fetch other party profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name, email, phone")
        .eq("user_id", otherUserId)
        .single();

      // Also try to get phone from employee or contractor profile
      let phone = profileData?.phone || null;
      if (!phone) {
        if (convData.contractor_user_id === user?.id) {
          // User is contractor, other is employee
          const { data: empProfile } = await supabase
            .from("employee_profiles")
            .select("phone")
            .eq("user_id", otherUserId)
            .single();
          phone = empProfile?.phone || null;
        } else {
          // User is employee, other is contractor
          const { data: contProfile } = await supabase
            .from("contractor_profiles")
            .select("phone")
            .eq("user_id", otherUserId)
            .single();
          phone = contProfile?.phone || null;
        }
      }

      setConversation({
        ...convData,
        job_application: convData.job_application_id 
          ? { id: convData.job_application_id, status: applicationStatus, job: { id: jobId || "", title: jobTitle } } 
          : null,
        other_party: profileData ? { ...profileData, phone } : null,
      });

      // Fetch messages
      const { data: messagesData } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", id)
        .order("created_at", { ascending: true });

      setMessages(messagesData || []);
      setIsLoading(false);
    }

    fetchConversation();
  }, [id, user, navigate]);

  // Subscribe to new messages
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`messages-${id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${id}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !id || conversation?.status !== "active") return;

    setIsSending(true);

    const { error } = await supabase.from("messages").insert({
      conversation_id: id,
      sender_user_id: user.id,
      content: newMessage.trim(),
    });

    setIsSending(false);

    if (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
      return;
    }

    setNewMessage("");
  };

  const handleCloseConversation = async () => {
    if (!id) return;

    setIsClosing(true);

    // Delete the conversation - the trigger will handle restoring positions and deleting messages/application
    const { error } = await supabase
      .from("conversations")
      .delete()
      .eq("id", id);

    setIsClosing(false);

    if (error) {
      console.error("Error closing conversation:", error);
      toast({
        title: "Error",
        description: "Failed to close conversation. Please try again.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Conversation Closed",
      description: "This conversation has been closed and removed.",
    });

    navigate("/dashboard");
  };

  const handleHireApplicant = async () => {
    if (!conversation?.job_application_id) return;

    setIsHiring(true);

    const { error } = await supabase
      .from("job_applications")
      .update({ status: "hired" })
      .eq("id", conversation.job_application_id);

    setIsHiring(false);

    if (error) {
      console.error("Error hiring applicant:", error);
      toast({
        title: "Error",
        description: "Failed to update application status.",
        variant: "destructive",
      });
      return;
    }

    // Update local state
    setConversation(prev => prev ? {
      ...prev,
      job_application: prev.job_application ? { ...prev.job_application, status: "hired" } : null
    } : null);

    toast({
      title: "Applicant Hired!",
      description: "The application status has been updated to hired.",
    });
  };

  const handleShareContact = async () => {
    if (!user || !id || conversation?.status !== "active") return;

    setIsSending(true);

    // Get current user's profile and phone from contractor/employee profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email, phone")
      .eq("user_id", user.id)
      .single();

    let phone = profile?.phone || null;
    
    // Try to get phone from employee or contractor profile
    if (!phone) {
      const isContractorUser = conversation?.contractor_user_id === user.id;
      if (isContractorUser) {
        const { data: contProfile } = await supabase
          .from("contractor_profiles")
          .select("phone")
          .eq("user_id", user.id)
          .maybeSingle();
        phone = contProfile?.phone || null;
      } else {
        const { data: empProfile } = await supabase
          .from("employee_profiles")
          .select("phone")
          .eq("user_id", user.id)
          .maybeSingle();
        phone = empProfile?.phone || null;
      }
    }

    const contactInfo = [
      "📋 My Contact Information:",
      `Name: ${profile?.full_name || "Not provided"}`,
      `Email: ${profile?.email || "Not provided"}`,
      phone ? `Phone: ${phone}` : null,
    ].filter(Boolean).join("\n");

    const { error } = await supabase.from("messages").insert({
      conversation_id: id,
      sender_user_id: user.id,
      content: contactInfo,
    });

    setIsSending(false);

    if (error) {
      console.error("Error sharing contact:", error);
      toast({
        title: "Error",
        description: "Failed to share contact information.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Contact Shared",
      description: "Your contact information has been sent.",
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container-tight py-8">
          <div className="text-center py-16">
            <h1 className="text-2xl font-bold mb-4">Conversation Not Found</h1>
            <Button asChild>
              <Link to="/dashboard">Back to Dashboard</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isClosed = conversation.status === "closed";
  const isUserContractor = conversation.contractor_user_id === user?.id;
  const isHired = conversation.job_application?.status === "hired";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="border-b border-border/50 bg-card">
        <div className="container-tight py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" asChild>
                <Link to="/dashboard">
                  <ArrowLeft className="w-4 h-4" />
                </Link>
              </Button>
              <div>
                <h1 className="font-semibold">
                  {conversation.other_party?.full_name || "User"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {conversation.job_application?.job.title || "Direct Contact"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Show Hired badge or Hire button */}
              {conversation.job_application && isUserContractor && !isClosed && (
                isHired ? (
                  <span className="flex items-center gap-1 px-3 py-1 bg-green-500/10 text-green-600 rounded-full text-sm font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    Hired
                  </span>
                ) : (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleHireApplicant}
                    disabled={isHiring}
                  >
                    {isHiring && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Hire
                  </Button>
                )
              )}

              {!isClosed && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleShareContact}
                    disabled={isSending}
                  >
                    <Phone className="w-4 h-4 mr-2" />
                    Share My Contact
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <X className="w-4 h-4 mr-2" />
                        Close Chat
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Close this conversation?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently remove the chat. If this is linked to a job application, 
                          the position will become available again for other applicants.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleCloseConversation}
                          disabled={isClosing}
                        >
                          {isClosing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          Close Conversation
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="container-tight py-4 space-y-4">
          {isClosed && (
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <AlertCircle className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                This conversation has been closed.
              </p>
            </div>
          )}

          {messages.length === 0 && !isClosed && (
            <div className="text-center py-8 text-muted-foreground">
              <p>No messages yet. Start the conversation!</p>
            </div>
          )}

          {messages.map((message) => {
            const isOwn = message.sender_user_id === user?.id;
            return (
              <div
                key={message.id}
                className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-lg px-4 py-2 ${
                    isOwn
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  <p
                    className={`text-xs mt-1 ${
                      isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
                    }`}
                  >
                    {new Date(message.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      {!isClosed && (
        <div className="border-t border-border/50 bg-card">
          <div className="container-tight py-4">
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                disabled={isSending}
              />
              <Button type="submit" disabled={isSending || !newMessage.trim()}>
                {isSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
