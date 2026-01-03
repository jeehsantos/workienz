import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  ArrowLeft,
  MapPin,
  Clock,
  User,
  MessageCircle,
  Lock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

type WorkerProfile = {
  id: string;
  user_id: string;
  headline: string | null;
  city: string | null;
  suburb: string | null;
  country: string | null;
  experience_years: number | null;
  skills: string[] | null;
  is_available: boolean | null;
  availability: string | null;
  phone: string | null;
  bio: string | null;
  languages: string[] | null;
  date_of_birth: string | null;
  visa_status: string | null;
  profile: {
    full_name: string | null;
    email: string;
  } | null;
};

export default function WorkerProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isContractor } = useAuthContext();
  const { toast } = useToast();

  const [worker, setWorker] = useState<WorkerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStartingChat, setIsStartingChat] = useState(false);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [isApplicantOfContractor, setIsApplicantOfContractor] = useState(false);
  const [checkingSubscription, setCheckingSubscription] = useState(true);
  const [existingConversationId, setExistingConversationId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchWorker() {
      if (!id) return;

      const { data, error } = await supabase
        .from("employee_profiles")
        .select(`
          id,
          user_id,
          headline,
          city,
          suburb,
          country,
          experience_years,
          skills,
          is_available,
          availability,
          phone,
          bio,
          languages,
          date_of_birth,
          visa_status
        `)
        .eq("id", id)
        .single();

      if (error) {
        console.error("Error fetching worker:", error);
        setIsLoading(false);
        return;
      }

      // Fetch profile info
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("user_id", data.user_id)
        .single();

      setWorker({ ...data, profile });
      setIsLoading(false);

      // Check for existing conversation with this worker (for contractors)
      if (user && isContractor()) {
        const { data: existingConv } = await supabase
          .from("conversations")
          .select("id")
          .eq("contractor_user_id", user.id)
          .eq("employee_user_id", data.user_id)
          .maybeSingle();

        if (existingConv) {
          setExistingConversationId(existingConv.id);
        }
      }
    }

    fetchWorker();
  }, [id, user, isContractor]);

  // Check contractor subscription and if this worker is an applicant
  useEffect(() => {
    async function checkSubscriptionAndApplicant() {
      if (!user || !isContractor() || !id) {
        setCheckingSubscription(false);
        return;
      }

      // Get contractor profile
      const { data: contractorProfile } = await supabase
        .from("contractor_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (contractorProfile) {
        // Check for active subscription
        const { data: subscription } = await supabase
          .from("contractor_subscriptions")
          .select("id")
          .eq("contractor_profile_id", contractorProfile.id)
          .eq("status", "active")
          .maybeSingle();

        setHasActiveSubscription(!!subscription);

        // Check if this worker has applied to any of contractor's jobs
        const { data: contractorJobs } = await supabase
          .from("jobs")
          .select("id")
          .eq("contractor_id", contractorProfile.id);

        if (contractorJobs && contractorJobs.length > 0) {
          const jobIds = contractorJobs.map(j => j.id);
          
          // Check if this employee (by id) has applied to any of those jobs
          const { data: applications } = await supabase
            .from("job_applications")
            .select("id")
            .eq("employee_id", id)
            .in("job_id", jobIds)
            .limit(1);

          setIsApplicantOfContractor(!!applications && applications.length > 0);
        }

        // Check if there's an existing conversation with this worker
        const { data: existingConv } = await supabase
          .from("conversations")
          .select("id")
          .eq("contractor_user_id", user.id)
          .maybeSingle();

        // We need to filter by the worker's user_id, but we don't have it yet
        // So let's fetch it from the employee_profiles table
        if (existingConv) {
          // Actually we need to check for conversations with this specific worker
          // Let's fetch after we know the worker's user_id
        }
      }

      setCheckingSubscription(false);
    }

    checkSubscriptionAndApplicant();
  }, [user, isContractor, id]);

  const handleStartConversation = async () => {
    if (!user || !worker) return;

    // If there's an existing conversation (from application), navigate to it
    if (existingConversationId) {
      navigate(`/messages/${existingConversationId}`);
      return;
    }

    setIsStartingChat(true);

    // Check if worker is available
    if (!worker.is_available) {
      toast({
        title: "Not Available",
        description: "This job seeker is not currently available for work.",
      });
      setIsStartingChat(false);
      return;
    }

    // Create a direct conversation (without job application)
    const { data: newConv, error } = await supabase
      .from("conversations")
      .insert({
        contractor_user_id: user.id,
        employee_user_id: worker.user_id,
        job_application_id: null, // Direct contact - no application
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating conversation:", error);
      toast({
        title: "Error",
        description: "Failed to start conversation. Please try again.",
        variant: "destructive",
      });
      setIsStartingChat(false);
      return;
    }

    navigate(`/messages/${newConv.id}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!worker) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container-tight py-8">
          <div className="text-center py-16">
            <h1 className="text-2xl font-bold mb-4">Worker Not Found</h1>
            <Button asChild>
              <Link to="/contractor/search-workers">Back to Search</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const getAvailabilityLabel = (availability: string | null) => {
    const labels: Record<string, string> = {
      immediate: "Immediate",
      "1-week": "Within 1 Week",
      "2-weeks": "Within 2 Weeks",
      flexible: "Flexible",
    };
    return labels[availability || ""] || "Not specified";
  };

  const canViewFullProfile = user && isContractor() && (hasActiveSubscription || isApplicantOfContractor);
  const canContact = canViewFullProfile;

  return (
    <div className="min-h-screen bg-background">
      <div className="container-tight py-8">
        <Button variant="ghost" asChild className="mb-6">
          <Link to="/contractor/search-workers">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Search
          </Link>
        </Button>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-card rounded-xl p-6 border border-border/50">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold font-display">
                    {worker.profile?.full_name || "Job Seeker"}
                  </h1>
                  <p className="text-muted-foreground">
                    {worker.headline || "Looking for opportunities"}
                  </p>
                  {worker.is_available && (
                    <Badge className="mt-2 bg-green-500/10 text-green-600 border-green-500/20">
                      Available for Work
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-6">
                {worker.city && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {worker.suburb && `${worker.suburb}, `}
                    {worker.city}
                    {worker.country && `, ${worker.country}`}
                  </span>
                )}
                {worker.experience_years !== null && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {worker.experience_years} years experience
                  </span>
                )}
              </div>

              {/* Bio - only show if can view full profile */}
              {worker.bio && canViewFullProfile && (
                <div className="prose prose-sm max-w-none dark:prose-invert mb-6">
                  <h3>About</h3>
                  <p>{worker.bio}</p>
                </div>
              )}
              
              {/* Show restricted message for bio */}
              {worker.bio && !canViewFullProfile && user && isContractor() && (
                <div className="bg-muted/50 rounded-lg p-4 mb-6 border border-border/50">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Lock className="w-4 h-4" />
                    <span className="text-sm">Subscribe or receive an application from this worker to view their full bio.</span>
                  </div>
                </div>
              )}

              {worker.languages && worker.languages.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold mb-2">Languages</h3>
                  <div className="flex flex-wrap gap-2">
                    {worker.languages.map((lang) => (
                      <Badge key={lang} variant="outline">
                        {lang}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {worker.skills && worker.skills.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {worker.skills.map((skill) => (
                      <Badge key={skill} variant="secondary">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-card rounded-xl p-6 border border-border/50">
              <h3 className="font-semibold mb-4">Details</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Availability</span>
                  <span>{getAvailabilityLabel(worker.availability)}</span>
                </div>
                {worker.experience_years !== null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Experience</span>
                    <span>{worker.experience_years} years</span>
                  </div>
                )}
                {worker.visa_status && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Visa Status</span>
                    <span className="capitalize">{worker.visa_status.replace(/_/g, ' ')}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Contact section - only show to authenticated contractors with subscription */}
            {user && isContractor() && (
              <div className="bg-card rounded-xl p-6 border border-border/50">
                <h3 className="font-semibold mb-4">Contact</h3>
                {checkingSubscription ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : canContact ? (
                  worker.is_available ? (
                    <>
                      <p className="text-sm text-muted-foreground mb-4">
                        Start a conversation with this job seeker directly.
                      </p>
                      <Button 
                        className="w-full" 
                        onClick={handleStartConversation}
                        disabled={isStartingChat}
                      >
                        {isStartingChat ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <MessageCircle className="w-4 h-4 mr-2" />
                        )}
                        Start Conversation
                      </Button>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      This job seeker is not currently available for work.
                    </p>
                  )
                ) : (
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                      <Lock className="w-6 h-6 text-primary" />
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      You need an active subscription to contact workers.
                    </p>
                    <Button asChild size="sm" className="w-full">
                      <Link to="/pricing">Upgrade Now</Link>
                    </Button>
                  </div>
                )}
              </div>
            )}

            {!user && (
              <div className="bg-card rounded-xl p-6 border border-border/50 text-center">
                <p className="text-muted-foreground mb-3">
                  Sign in as a contractor to contact this worker.
                </p>
                <Button asChild>
                  <Link to="/auth">Sign In</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
