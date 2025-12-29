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
  Mail,
  Phone,
  MessageCircle,
  Calendar,
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
    }

    fetchWorker();
  }, [id]);

  const handleStartConversation = async () => {
    if (!user || !worker) return;

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

              {worker.bio && (
                <div className="prose prose-sm max-w-none dark:prose-invert mb-6">
                  <h3>About</h3>
                  <p>{worker.bio}</p>
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

            {/* Contact section - only show to authenticated contractors */}
            {user && isContractor() && (
              <div className="bg-card rounded-xl p-6 border border-border/50">
                <h3 className="font-semibold mb-4">Contact</h3>
                {worker.is_available ? (
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