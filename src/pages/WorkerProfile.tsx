import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, MapPin, Clock, User, MessageCircle, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SkeletonProfile } from "@/components/ui/skeleton-components";
import { Skeleton } from "@/components/ui/skeleton";
import { UpgradeButton } from "@/components/ui/upgrade-button";

interface WorkerDTO {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  headline: string | null;
  bio: string | null;
  city: string | null;
  suburb: string | null;
  country: string | null;
  experience_years: number | null;
  skills: string[] | null;
  languages: string[] | null;
  availability: string | null;
  is_available: boolean | null;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  has_car: boolean | null;
  comfortable_standing: boolean | null;
  comfortable_heavy_lifting: boolean | null;
  visa_status: string | null;
}

export default function WorkerProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isContractor } = useAuthContext();
  const { toast } = useToast();

  const [worker, setWorker] = useState<WorkerDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStartingChat, setIsStartingChat] = useState(false);
  const [accessLevel, setAccessLevel] = useState<"full" | "limited">("limited");
  const [canContact, setCanContact] = useState(false);
  const [isApplicant, setIsApplicant] = useState(false);
  const [existingConversationId, setExistingConversationId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchWorkerProfile() {
      if (!id) return;

      const { data, error } = await supabase.functions.invoke("get-worker-profile", {
        body: { worker_id: id },
      });

      if (error || !data?.worker) {
        console.error("Error fetching worker:", error);
        setIsLoading(false);
        return;
      }

      setWorker(data.worker);
      setAccessLevel(data.access_level);
      setCanContact(data.can_contact);
      setIsApplicant(data.is_applicant);
      setIsLoading(false);

      // Check for existing conversation
      if (user && isContractor() && data.worker) {
        const { data: existingConv } = await supabase
          .from("conversations")
          .select("id")
          .eq("contractor_user_id", user.id)
          .eq("employee_user_id", data.worker.user_id)
          .maybeSingle();

        if (existingConv) {
          setExistingConversationId(existingConv.id);
        }
      }
    }

    fetchWorkerProfile();
  }, [id, user, isContractor]);

  const handleStartConversation = async () => {
    if (!user || !worker) return;

    if (existingConversationId) {
      navigate(`/messages/${existingConversationId}`);
      return;
    }

    setIsStartingChat(true);

    if (!worker.is_available) {
      toast({
        title: "Not Available",
        description: "This job seeker is not currently available for work.",
      });
      setIsStartingChat(false);
      return;
    }

    const { data: newConv, error } = await supabase
      .from("conversations")
      .insert({
        contractor_user_id: user.id,
        employee_user_id: worker.user_id,
        job_application_id: null,
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
      <div className="min-h-screen bg-background">
        <div className="container-tight py-8">
          <div className="mb-6">
            <Skeleton className="h-10 w-40" />
          </div>
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <SkeletonProfile showCover={false} showBio={true} showStats={false} />
            </div>
            <div className="space-y-6">
              <div className="bg-card rounded-xl p-6 border border-border/50 space-y-3">
                <Skeleton className="h-5 w-20" />
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ))}
              </div>
              <div className="bg-card rounded-xl p-6 border border-border/50 space-y-4">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
            </div>
          </div>
        </div>
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

  const displayName = worker.full_name || `${worker.first_name ?? ''} ${worker.last_name ?? ''}`.trim() || "The Workie";

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
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold font-display">{displayName}</h1>
                    {isApplicant && <Badge variant="secondary">Applicant</Badge>}
                  </div>
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
                    {accessLevel === "full" && worker.suburb && `${worker.suburb}, `}
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

              {/* Bio - only show if full access */}
              {worker.bio && accessLevel === "full" && (
                <div className="prose prose-sm max-w-none dark:prose-invert mb-6">
                  <h3>About</h3>
                  <p>{worker.bio}</p>
                </div>
              )}
              
              {/* Show restricted message for bio */}
              {accessLevel === "limited" && user && isContractor() && (
                <div className="bg-muted/50 rounded-lg p-4 mb-6 border border-border/50">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Lock className="w-4 h-4" />
                    <span className="text-sm">Subscribe or receive an application from this worker to view their full profile.</span>
                  </div>
                </div>
              )}

              {worker.languages && worker.languages.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold mb-2">Languages</h3>
                  <div className="flex flex-wrap gap-2">
                    {worker.languages.map((lang) => (
                      <Badge key={lang} variant="outline">{lang}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {worker.skills && worker.skills.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {worker.skills.map((skill) => (
                      <Badge key={skill} variant="secondary">{skill}</Badge>
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
                {accessLevel === "full" && worker.visa_status && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Visa Status</span>
                    <span className="capitalize">{worker.visa_status.replace(/_/g, ' ')}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Contact section */}
            {user && isContractor() && (
              <div className="bg-card rounded-xl p-6 border border-border/50">
                <h3 className="font-semibold mb-4">Contact</h3>
                {canContact ? (
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
                    <UpgradeButton size="sm" className="w-full" />
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
