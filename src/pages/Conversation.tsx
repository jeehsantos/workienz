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
  Briefcase,
  User,
  Building2,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { dispatchUnreadRefresh } from "@/hooks/useProfileRefresh";
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
import { Badge } from "@/components/ui/badge";

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
  activity_started_at: string | null;
  last_activity_at: string | null;
  reminder_count: number;
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
  // Destructure with a fallback to an empty object
    const { first_name, last_name, full_name } = worker.profile || {};

    // Create the display name logic
    const displayName = (first_name || last_name) 
      ? `${first_name ?? ''} ${last_name ?? ''}`.trim() 
      : full_name;

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
          job_application_id,
          activity_started_at,
          last_activity_at,
          reminder_count
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
        activity_started_at: convData.activity_started_at,
        last_activity_at: convData.last_activity_at,
        reminder_count: convData.reminder_count || 0,
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

      // Mark conversation as read
      if (user && messagesData && messagesData.length > 0) {
        await supabase
          .from("conversation_read_status")
          .upsert({
            conversation_id: id,
            user_id: user.id,
            last_read_at: new Date().toISOString(),
          }, {
            onConflict: 'conversation_id,user_id'
          });
        
        // Dispatch event to refresh unread count immediately
        dispatchUnreadRefresh();
      }
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

  const MAX_MESSAGE_LENGTH = 5000;

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedMessage = newMessage.trim();
    
    if (!trimmedMessage || !user || !id || conversation?.status !== "active") return;

    // Validate message length
    if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
      toast({
        title: "Message Too Long",
        description: `Message must be less than ${MAX_MESSAGE_LENGTH} characters.`,
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);

    const { error } = await supabase.from("messages").insert({
      conversation_id: id,
      sender_user_id: user.id,
      content: trimmedMessage,
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

  // Calculate expiry status
  const getExpiryStatus = () => {
    if (!conversation.activity_started_at || !conversation.last_activity_at || isClosed) {
      return { status: "active" as const, hoursLeft: 0, showWarning: false };
    }

    const now = new Date();
    const activityStart = new Date(conversation.activity_started_at);
    const lastActivity = new Date(conversation.last_activity_at);

    const hoursSinceStart = (now.getTime() - activityStart.getTime()) / (1000 * 60 * 60);
    const hoursSinceActivity = (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60);

    // If there's been activity in the last 24 hours, conversation is active
    if (hoursSinceActivity < 24) {
      return { status: "active" as const, hoursLeft: Math.ceil(24 - hoursSinceActivity), showWarning: false };
    }

    // If past 72 hours, it's expired
    if (hoursSinceStart >= 72) {
      return { status: "expired" as const, hoursLeft: 0, showWarning: true };
    }

    // In warning period (24-72 hours)
    const hoursLeft = Math.max(0, Math.ceil(72 - hoursSinceStart));
    return { status: "warning" as const, hoursLeft, showWarning: true };
  };

  const expiryStatus = getExpiryStatus();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Expiry Warning Banner */}
      {expiryStatus.showWarning && expiryStatus.status === "warning" && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 px-4 py-3">
          <div className="max-w-4xl mx-auto flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center flex-shrink-0 animate-pulse">
              <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-amber-800 dark:text-amber-200 text-sm">
                Conversation expiring soon
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                This conversation will close in <strong>{expiryStatus.hoursLeft} hours</strong> if there's no activity. 
                Send a message to keep it active!
              </p>
            </div>
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="border-b border-border/50 bg-card sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
              <Button variant="ghost" size="icon" className="flex-shrink-0 h-8 w-8 sm:h-9 sm:w-9" asChild>
                <Link to="/dashboard">
                  <ArrowLeft className="w-4 h-4" />
                </Link>
              </Button>
              
              {/* User info with avatar */}
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  {isUserContractor ? (
                    <User className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  ) : (
                    <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="font-semibold truncate text-sm sm:text-base">
                    {displayName || "User"}
                  </h1>
                  <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                    {conversation.job_application && (
                      <>
                        <Link 
                          to={`/jobs/${conversation.job_application.job.id}`}
                          className="text-xs sm:text-sm text-primary hover:underline flex items-center gap-1 truncate max-w-[120px] sm:max-w-none"
                        >
                          <Briefcase className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{conversation.job_application.job.title}</span>
                        </Link>
                        <Badge 
                          variant={
                            conversation.job_application.status === 'rejected' 
                              ? 'destructive' 
                              : conversation.job_application.status === 'hired'
                              ? 'default'
                              : 'secondary'
                          }
                          className="text-[10px] sm:text-xs px-1.5 py-0"
                        >
                          {conversation.job_application.status === 'rejected' 
                            ? 'Rejected' 
                            : conversation.job_application.status === 'hired'
                            ? 'Hired'
                            : 'Pending'}
                        </Badge>
                      </>
                    )}
                    {!conversation.job_application && (
                      <span className="text-xs sm:text-sm text-muted-foreground">Direct Contact</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions - Compact on mobile */}
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              {/* Show Hired badge or Hire button */}
              {conversation.job_application && isUserContractor && !isClosed && (
                isHired ? (
                  <span className="flex items-center gap-1 px-2 sm:px-3 py-1 bg-green-500/10 text-green-600 rounded-full text-xs sm:text-sm font-medium">
                    <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">Hired</span>
                  </span>
                ) : (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="default"
                        size="sm"
                        disabled={isHiring}
                        className="h-8 px-2 sm:px-3 text-xs sm:text-sm"
                      >
                        {isHiring && <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 animate-spin" />}
                        <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                        <span className="hidden sm:inline">Hire</span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Hire</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to hire this applicant? This will update their application status to "Hired".
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleHireApplicant} disabled={isHiring}>
                          {isHiring && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          Confirm Hire
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )
              )}

              {!isClosed && (
                <>
                  {/* Share Contact - shows text on desktop */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleShareContact}
                    disabled={isSending}
                    className="h-8 px-2 sm:px-3"
                    title="Share Contact Info"
                  >
                    <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2" />
                    <span className="hidden sm:inline">Share Contact</span>
                  </Button>

                  {/* Close Conversation */}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-destructive hover:text-destructive h-8 px-2 sm:px-3"
                        title="Close Conversation"
                      >
                        <X className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2" />
                        <span className="hidden sm:inline">Close</span>
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

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
          {/* Job context banner for job applications - hidden on mobile since info is in header */}
          {conversation.job_application?.job.id && (
            <div className="bg-muted/30 rounded-lg p-3 sm:p-4 border border-border/50 hidden sm:block">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Briefcase className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Application for</p>
                    <p className="font-medium">{conversation.job_application.job.title}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/jobs/${conversation.job_application.job.id}`}>
                    View Job Details
                  </Link>
                </Button>
              </div>
            </div>
          )}

          {isClosed && (
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <AlertCircle className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                This conversation has been closed.
              </p>
            </div>
          )}

          {messages.length === 0 && !isClosed && (
            <div className="text-center py-12 text-muted-foreground">
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <Send className="w-8 h-8" />
              </div>
              <p className="font-medium">No messages yet</p>
              <p className="text-sm mt-1">Start the conversation by sending a message below.</p>
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
                  className={`max-w-[80%] sm:max-w-[70%] rounded-2xl px-4 py-3 ${
                    isOwn
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted rounded-bl-md"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
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

      {/* Input Area */}
      {!isClosed && (
        <div className="border-t border-border/50 bg-card">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <form onSubmit={handleSendMessage} className="flex gap-3">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                disabled={isSending}
                className="flex-1"
              />
              <Button type="submit" disabled={isSending || !newMessage.trim()} size="icon">
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
