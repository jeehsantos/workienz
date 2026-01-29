import { useState, useEffect, useRef, useMemo, memo, useCallback } from "react";
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
  MoreVertical,
  UserCircle,
  Share2,
  Flag,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { SubscriberFeatureDialog } from "@/components/chat/SubscriberFeatureDialog";

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
  hired_at: string | null;
  scheduled_deletion_at: string | null;
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
  other_party_user_id: string | null;
};

// Memoized Message component to prevent unnecessary re-renders
const MessageBubble = memo(({ message, isOwn }: { message: Message; isOwn: boolean }) => {
  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-3 py-2 sm:px-4 sm:py-3 ${
          isOwn
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-muted rounded-bl-md"
        }`}
      >
        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        <p className={`text-[10px] sm:text-xs mt-1 ${isOwn ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
          {new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
});

MessageBubble.displayName = 'MessageBubble';

export default function Conversation() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isContractor } = useAuthContext();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [conversation, setConversation] = useState<ConversationData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isHiring, setIsHiring] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [showSubscriberDialog, setShowSubscriberDialog] = useState(false);
  const [isFreeTier, setIsFreeTier] = useState(false);
  const [checkingFreeTier, setCheckingFreeTier] = useState(false);
  
  // Pagination state (Requirement 9.3)
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [oldestMessageId, setOldestMessageId] = useState<string | null>(null);
  const MESSAGES_PER_PAGE = 50;

  // Check if contractor is on free tier
  useEffect(() => {
    async function checkFreeTierStatus() {
      if (!user || !isContractor) return;
      
      setCheckingFreeTier(true);
      try {
        const { data: entitlements } = await supabase
          .from("contractor_entitlements")
          .select("plan_type, status")
          .eq("user_id", user.id)
          .eq("status", "active");

        if (entitlements && entitlements.length > 0) {
          // Check if user only has free tier (no paid plans)
          const hasPaidPlan = entitlements.some(e => e.plan_type !== "free_contractor");
          const hasFreeTier = entitlements.some(e => e.plan_type === "free_contractor");
          setIsFreeTier(hasFreeTier && !hasPaidPlan);
        }
      } catch (error) {
        console.error("Error checking free tier status:", error);
      } finally {
        setCheckingFreeTier(false);
      }
    }

    checkFreeTierStatus();
  }, [user, isContractor]);

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
          reminder_count,
          hired_at,
          scheduled_deletion_at
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
          .select(`id, job_id, status`)
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
          const { data: empProfile } = await supabase
            .from("employee_profiles")
            .select("phone")
            .eq("user_id", otherUserId)
            .single();
          phone = empProfile?.phone || null;
        } else {
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
        hired_at: convData.hired_at,
        scheduled_deletion_at: convData.scheduled_deletion_at,
        job_application: convData.job_application_id 
          ? { id: convData.job_application_id, status: applicationStatus, job: { id: jobId || "", title: jobTitle } } 
          : null,
        other_party: profileData ? { ...profileData, phone } : null,
        other_party_user_id: otherUserId,
      });

      // Fetch messages with pagination (Requirement 9.3: Limit initial load to 50 messages)
      const { data: messagesData, error: messagesError } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", id)
        .order("created_at", { ascending: false })
        .limit(MESSAGES_PER_PAGE);

      if (messagesError) {
        console.error("Error fetching messages:", messagesError);
      }

      const messages = (messagesData || []).reverse(); // Reverse to show oldest first
      setMessages(messages);
      
      // Check if there are more messages
      if (messages.length === MESSAGES_PER_PAGE) {
        setHasMoreMessages(true);
        setOldestMessageId(messages[0]?.id || null);
      } else {
        setHasMoreMessages(false);
      }
      
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
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
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

  // Load more messages (infinite scroll for message history - Requirement 9.3)
  const loadMoreMessages = useCallback(async () => {
    if (!id || !oldestMessageId || isLoadingMore || !hasMoreMessages) return;

    setIsLoadingMore(true);

    try {
      // Get the oldest message's created_at timestamp
      const oldestMessage = messages.find(m => m.id === oldestMessageId);
      if (!oldestMessage) {
        setIsLoadingMore(false);
        return;
      }

      const { data: olderMessages, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", id)
        .lt("created_at", oldestMessage.created_at)
        .order("created_at", { ascending: false })
        .limit(MESSAGES_PER_PAGE);

      if (error) {
        console.error("Error loading more messages:", error);
        setIsLoadingMore(false);
        return;
      }

      if (olderMessages && olderMessages.length > 0) {
        const reversedMessages = olderMessages.reverse();
        setMessages(prev => [...reversedMessages, ...prev]);
        setOldestMessageId(reversedMessages[0]?.id || null);
        
        // Check if there are more messages
        if (olderMessages.length < MESSAGES_PER_PAGE) {
          setHasMoreMessages(false);
        }
      } else {
        setHasMoreMessages(false);
      }
    } catch (error) {
      console.error("Error in loadMoreMessages:", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [id, oldestMessageId, isLoadingMore, hasMoreMessages, messages, MESSAGES_PER_PAGE]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedMessage = newMessage.trim();
    
    if (!trimmedMessage || !user || !id || conversation?.status !== "active") return;

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
    inputRef.current?.focus();
  };

  const handleCloseConversation = async () => {
    if (!id) return;

    setIsClosing(true);

    const { error } = await supabase
      .from("conversations")
      .delete()
      .eq("id", id);

    setIsClosing(false);
    setShowCloseDialog(false);

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

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        toast({
          title: "Error",
          description: "You must be logged in to hire applicants.",
          variant: "destructive",
        });
        setIsHiring(false);
        return;
      }

      const response = await supabase.functions.invoke('hire-applicant', {
        body: { application_id: conversation.job_application_id },
      });

      if (response.error) {
        console.error("Error hiring applicant:", response.error);
        toast({
          title: "Error",
          description: response.error.message || "Failed to hire applicant.",
          variant: "destructive",
        });
        setIsHiring(false);
        return;
      }

      const result = response.data;

      if (!result.success) {
        toast({
          title: "Error",
          description: result.error || "Failed to hire applicant.",
          variant: "destructive",
        });
        setIsHiring(false);
        return;
      }

      setConversation(prev => prev ? {
        ...prev,
        job_application: prev.job_application ? { ...prev.job_application, status: "hired" } : null
      } : null);

      toast({
        title: "🎉 Applicant Hired!",
        description: "Congratulations message sent. The worker's availability has been updated. Other pending applications have been closed.",
      });
    } catch (error) {
      console.error("Error hiring applicant:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsHiring(false);
    }
  };

  const handleShareContact = async () => {
    if (!user || !id || conversation?.status !== "active") return;

    // Check if contractor is on free tier - show upgrade dialog
    const isUserContractor = conversation?.contractor_user_id === user.id;
    if (isUserContractor && isFreeTier) {
      setShowSubscriberDialog(true);
      return;
    }

    setIsSending(true);

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email, phone")
      .eq("user_id", user.id)
      .single();

    let phone = profile?.phone || null;
    
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

  const handleViewProfile = () => {
    if (!conversation?.other_party_user_id) return;
    
    const isUserContractor = conversation.contractor_user_id === user?.id;
    if (isUserContractor) {
      // Contractor viewing employee profile - use /workers/:id route
      navigate(`/workers/${conversation.other_party_user_id}`);
    } else {
      // Employee viewing contractor profile
      navigate(`/contractor/${conversation.other_party_user_id}`);
    }
  };

  const isClosed = conversation?.status === "closed";
  const isUserContractor = conversation?.contractor_user_id === user?.id;
  const isHired = conversation?.job_application?.status === "hired";
  // Check if this is a hired conversation (has job_application and is hired)
  const isHiredConversation = isHired && conversation?.job_application_id;

  // Memoize hired countdown status - for 48h archive warning after hiring
  const hiredCountdown = useMemo(() => {
    if (!conversation?.hired_at || !conversation?.scheduled_deletion_at) {
      return { isHiredChat: false, hoursLeft: 0 };
    }

    const now = new Date();
    const deletionAt = new Date(conversation.scheduled_deletion_at);
    const hoursLeft = Math.max(0, Math.ceil((deletionAt.getTime() - now.getTime()) / (1000 * 60 * 60)));

    return { isHiredChat: true, hoursLeft };
  }, [conversation?.hired_at, conversation?.scheduled_deletion_at]);

  // Memoize expiry status calculation - MUST be before any early returns
  const expiryStatus = useMemo(() => {
    // Don't show inactivity expiry if this is a hired conversation (has its own countdown)
    if (hiredCountdown.isHiredChat) {
      return { status: "active" as const, hoursLeft: 0, showWarning: false };
    }

    if (!conversation?.activity_started_at || !conversation?.last_activity_at || isClosed) {
      return { status: "active" as const, hoursLeft: 0, showWarning: false };
    }

    const now = new Date();
    const activityStart = new Date(conversation.activity_started_at);
    const lastActivity = new Date(conversation.last_activity_at);

    const hoursSinceStart = (now.getTime() - activityStart.getTime()) / (1000 * 60 * 60);
    const hoursSinceActivity = (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60);

    if (hoursSinceActivity < 24) {
      return { status: "active" as const, hoursLeft: Math.ceil(24 - hoursSinceActivity), showWarning: false };
    }

    if (hoursSinceStart >= 72) {
      return { status: "expired" as const, hoursLeft: 0, showWarning: true };
    }

    const hoursLeft = Math.max(0, Math.ceil(72 - hoursSinceStart));
    return { status: "warning" as const, hoursLeft, showWarning: true };
  }, [conversation?.activity_started_at, conversation?.last_activity_at, isClosed, hiredCountdown.isHiredChat]);

  if (isLoading) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="h-[100dvh] bg-background">
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

  return (
    <div className="h-[100dvh] bg-background flex flex-col overflow-hidden">
      {/* Hired Conversation Banner - 48h archive countdown */}
      {hiredCountdown.isHiredChat && hiredCountdown.hoursLeft > 0 && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-200 dark:border-emerald-800 px-4 py-2 flex-shrink-0">
          <div className="max-w-4xl mx-auto flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <p className="text-xs sm:text-sm text-emerald-700 dark:text-emerald-300">
              🎉 <strong>Hired!</strong> This conversation will be archived in <strong>{hiredCountdown.hoursLeft}h</strong>
            </p>
          </div>
        </div>
      )}

      {/* Expiry Warning Banner (for non-hired conversations) */}
      {expiryStatus.showWarning && expiryStatus.status === "warning" && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 px-4 py-2 flex-shrink-0">
          <div className="max-w-4xl mx-auto flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-300">
              Expires in <strong>{expiryStatus.hoursLeft}h</strong> - send a message to keep active
            </p>
          </div>
        </div>
      )}

      {/* Header - Fixed */}
      <div className="border-b border-border/50 bg-card flex-shrink-0">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-2 sm:py-3">
          <div className="flex items-center justify-between gap-2">
            {/* Left: Back + User Info */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Button variant="ghost" size="icon" className="flex-shrink-0 h-9 w-9" asChild>
                <Link to="/dashboard">
                  <ArrowLeft className="w-4 h-4" />
                </Link>
              </Button>
              
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  {isUserContractor ? (
                    <User className="w-4 h-4 text-primary" />
                  ) : (
                    <Building2 className="w-4 h-4 text-primary" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="font-semibold truncate text-sm">
                    {conversation.other_party?.full_name || "User"}
                  </h1>
                  <div className="flex items-center gap-1.5">
                    {conversation.job_application && (
                      <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                        {conversation.job_application.job.title}
                      </span>
                    )}
                    {isHired && (
                      <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4">Hired</Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* View Profile Button - Only visible for Contractors */}
              {isUserContractor && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleViewProfile}
                  className="h-9 px-3 hidden sm:flex"
                >
                  <UserCircle className="w-4 h-4 mr-2" />
                  View Profile
                </Button>
              )}

              {/* Desktop Actions */}
              {!isClosed && (
                <div className="hidden sm:flex items-center gap-1">
                  {conversation.job_application && isUserContractor && !isHired && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="default" size="sm" disabled={isHiring} className="h-9">
                          {isHiring && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Hire
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirm Hire</AlertDialogTitle>
                          <AlertDialogDescription className="space-y-2">
                            <p>Are you sure you want to hire this applicant? This will:</p>
                            <ul className="list-disc list-inside text-sm space-y-1 mt-2">
                              <li>Send a congratulations message to the worker</li>
                              <li>Set their availability to "unavailable"</li>
                              <li>Automatically close their other pending applications</li>
                              <li>Archive this conversation after 48 hours</li>
                            </ul>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleHireApplicant} disabled={isHiring}>
                            Confirm Hire
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}

                  <Button variant="outline" size="sm" onClick={handleShareContact} disabled={isSending} className="h-9">
                    <Share2 className="w-4 h-4 mr-2" />
                    Share Contact
                  </Button>

                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-destructive hover:text-destructive h-9"
                    onClick={() => setShowCloseDialog(true)}
                    disabled={!!isHiredConversation}
                    title={isHiredConversation ? "This conversation will be archived automatically in 48 hours" : undefined}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Close
                  </Button>
                </div>
              )}

              {/* Mobile: More Actions Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 sm:hidden">
                    <MoreVertical className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {/* View Profile - Only for Contractors */}
                  {isUserContractor && (
                    <DropdownMenuItem onClick={handleViewProfile} className="h-11">
                      <UserCircle className="w-4 h-4 mr-3" />
                      View Profile
                    </DropdownMenuItem>
                  )}
                  
                  {conversation.job_application?.job.id && (
                    <DropdownMenuItem asChild className="h-11">
                      <Link to={`/jobs/${conversation.job_application.job.id}`}>
                        <Briefcase className="w-4 h-4 mr-3" />
                        View Job Details
                      </Link>
                    </DropdownMenuItem>
                  )}

                  {!isClosed && (
                    <>
                      <DropdownMenuSeparator />
                      
                      {conversation.job_application && isUserContractor && !isHired && (
                        <DropdownMenuItem onClick={handleHireApplicant} disabled={isHiring} className="h-11">
                          <CheckCircle2 className="w-4 h-4 mr-3" />
                          Hire Applicant
                        </DropdownMenuItem>
                      )}

                      <DropdownMenuItem onClick={handleShareContact} disabled={isSending} className="h-11">
                        <Share2 className="w-4 h-4 mr-3" />
                        Share My Contact
                      </DropdownMenuItem>

                      {conversation.other_party?.phone && (
                        <DropdownMenuItem asChild className="h-11">
                          <a href={`tel:${conversation.other_party.phone}`}>
                            <Phone className="w-4 h-4 mr-3" />
                            Call {conversation.other_party.full_name?.split(' ')[0] || 'User'}
                          </a>
                        </DropdownMenuItem>
                      )}

                      <DropdownMenuSeparator />
                      
                      {!isHiredConversation && (
                        <DropdownMenuItem 
                          onClick={() => setShowCloseDialog(true)}
                          className="h-11 text-destructive focus:text-destructive"
                        >
                          <X className="w-4 h-4 mr-3" />
                          Close Conversation
                        </DropdownMenuItem>
                      )}
                      {isHiredConversation && (
                        <DropdownMenuItem disabled className="h-11 text-muted-foreground">
                          <Clock className="w-4 h-4 mr-3" />
                          Auto-archives in {hiredCountdown.hoursLeft}h
                        </DropdownMenuItem>
                      )}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Area - Flexible, takes remaining space */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 space-y-3">
          {/* Job context banner - Desktop only */}
          {conversation.job_application?.job.id && (
            <div className="bg-muted/30 rounded-lg p-3 border border-border/50 hidden sm:flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Briefcase className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Application for</p>
                  <p className="font-medium text-sm">{conversation.job_application.job.title}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to={`/jobs/${conversation.job_application.job.id}`}>View Job</Link>
              </Button>
            </div>
          )}

          {isClosed && (
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <AlertCircle className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">This conversation has been closed.</p>
            </div>
          )}

          {messages.length === 0 && !isClosed && (
            <div className="text-center py-8 text-muted-foreground">
              <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                <Send className="w-6 h-6" />
              </div>
              <p className="font-medium text-sm">No messages yet</p>
              <p className="text-xs mt-1">Start the conversation below</p>
            </div>
          )}

          {/* Load More Messages Button (Requirement 9.3) */}
          {hasMoreMessages && messages.length > 0 && (
            <div className="flex justify-center py-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadMoreMessages}
                disabled={isLoadingMore}
                className="text-xs"
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  `Load older messages`
                )}
              </Button>
            </div>
          )}

          {messages.map((message) => {
            const isOwn = message.sender_user_id === user?.id;
            return <MessageBubble key={message.id} message={message} isOwn={isOwn} />;
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area - Fixed at bottom */}
      {!isClosed && (
        <div className="border-t border-border/50 bg-card flex-shrink-0 safe-area-bottom">
          <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3">
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <Input
                ref={inputRef}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                disabled={isSending}
                className="flex-1 h-11"
                autoComplete="off"
              />
              <Button 
                type="submit" 
                disabled={isSending || !newMessage.trim()} 
                size="icon"
                className="h-11 w-11 flex-shrink-0"
              >
                {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Close Conversation Dialog */}
      <AlertDialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close this conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the chat. If linked to a job application, 
              the position will become available again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCloseConversation} disabled={isClosing}>
              {isClosing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Close Conversation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Subscriber Feature Dialog for Free Tier */}
      <SubscriberFeatureDialog
        open={showSubscriberDialog}
        onOpenChange={setShowSubscriberDialog}
        featureName="Share Contact Information"
        featureDescription="Sharing your contact details is a premium feature. Upgrade your plan to directly share your phone number and email with workers."
      />
    </div>
  );
}

