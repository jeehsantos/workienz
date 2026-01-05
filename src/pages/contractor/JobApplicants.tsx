import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  ArrowLeft,
  User,
  Clock,
  MessageCircle,
  CheckCircle,
  XCircle,
  MapPin,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Applicant = {
  id: string;
  status: string;
  cover_letter: string | null;
  created_at: string;
  employee: {
    id: string;
    user_id: string;
    headline: string | null;
    city: string | null;
    experience_years: number | null;
    skills: string[] | null;
  };
  profile: {
    full_name: string | null;
    email: string;
  } | null;
  conversation_id: string | null;
};

type Job = {
  id: string;
  title: string;
  positions_available: number;
  positions_filled: number;
};

export default function JobApplicants() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { user, isLoading: authLoading, isContractor } = useAuthContext();
  const { toast } = useToast();

  const [job, setJob] = useState<Job | null>(null);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || !isContractor())) {
      navigate("/auth");
    }
  }, [user, authLoading, isContractor, navigate]);

  useEffect(() => {
    async function fetchData() {
      if (!jobId || !user) return;

      // Fetch job
      const { data: jobData, error: jobError } = await supabase
        .from("jobs")
        .select("id, title, positions_available, positions_filled")
        .eq("id", jobId)
        .single();

      if (jobError) {
        console.error("Error fetching job:", jobError);
        setIsLoading(false);
        return;
      }

      setJob(jobData);

      // Fetch applications
      const { data: applications, error: appError } = await supabase
        .from("job_applications")
        .select(`
          id,
          status,
          cover_letter,
          created_at,
          employee_id
        `)
        .eq("job_id", jobId)
        .order("created_at", { ascending: false });

      if (appError) {
        console.error("Error fetching applications:", appError);
        setIsLoading(false);
        return;
      }

      // Fetch employee profiles and user profiles
      const enrichedApplicants = await Promise.all(
        (applications || []).map(async (app) => {
          const { data: employee } = await supabase
            .from("employee_profiles")
            .select("id, user_id, headline, city, experience_years, skills")
            .eq("id", app.employee_id)
            .single();

          let profile = null;
          if (employee) {
            const { data: profileData } = await supabase
              .from("profiles")
              .select("full_name, email")
              .eq("user_id", employee.user_id)
              .single();
            profile = profileData;
          }

          // Check for existing conversation
          let conversationId = null;
          if (employee) {
            const { data: conv } = await supabase
              .from("conversations")
              .select("id")
              .eq("job_application_id", app.id)
              .maybeSingle();
            conversationId = conv?.id || null;
          }

          return {
            ...app,
            employee: employee!,
            profile,
            conversation_id: conversationId,
          };
        })
      );

      setApplicants(enrichedApplicants.filter((a) => a.employee));
      setIsLoading(false);
    }

    if (user && isContractor()) {
      fetchData();
    }
  }, [jobId, user, isContractor]);

  const handleStatusChange = async (applicationId: string, newStatus: string) => {
    setUpdatingId(applicationId);

    const { error } = await supabase
      .from("job_applications")
      .update({ status: newStatus })
      .eq("id", applicationId);

    setUpdatingId(null);

    if (error) {
      console.error("Error updating status:", error);
      toast({
        title: "Error",
        description: "Failed to update application status.",
        variant: "destructive",
      });
      return;
    }

    setApplicants(
      applicants.map((a) =>
        a.id === applicationId ? { ...a, status: newStatus } : a
      )
    );

    toast({
      title: "Status Updated",
      description: `Application marked as ${newStatus}.`,
    });
  };

  const handleStartConversation = async (applicant: Applicant) => {
    if (!user || !applicant.employee) return;

    // Check if conversation already exists
    if (applicant.conversation_id) {
      navigate(`/messages/${applicant.conversation_id}`);
      return;
    }

    // Create new conversation
    const { data: newConv, error } = await supabase
      .from("conversations")
      .insert({
        job_application_id: applicant.id,
        contractor_user_id: user.id,
        employee_user_id: applicant.employee.user_id,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating conversation:", error);
      toast({
        title: "Error",
        description: "Failed to start conversation.",
        variant: "destructive",
      });
      return;
    }

    navigate(`/messages/${newConv.id}`);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { class: string; label: string }> = {
      pending: { class: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20", label: "Pending" },
      shortlisted: { class: "bg-blue-500/10 text-blue-600 border-blue-500/20", label: "Shortlisted" },
      hired: { class: "bg-green-500/10 text-green-600 border-green-500/20", label: "Hired" },
      rejected: { class: "bg-red-500/10 text-red-600 border-red-500/20", label: "Rejected" },
    };
    const v = variants[status] || variants.pending;
    return <Badge className={v.class}>{v.label}</Badge>;
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container-tight py-8">
          <div className="text-center py-16">
            <h1 className="text-2xl font-bold mb-4">Job Not Found</h1>
            <Button asChild>
              <Link to="/contractor/jobs">Back to My Jobs</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container-tight py-8">
        <Button variant="ghost" asChild className="mb-6">
          <Link to="/contractor/jobs">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to My Jobs
          </Link>
        </Button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 font-display">Applicants</h1>
          <p className="text-muted-foreground">
            {job.title} • {applicants.length} application{applicants.length !== 1 ? "s" : ""}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Positions: {job.positions_available - job.positions_filled} of {job.positions_available} available
          </p>
        </div>

        {applicants.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-xl border border-border/50">
            <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Applications Yet</h2>
            <p className="text-muted-foreground">
              Check back later for applications from Workies.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {applicants.map((applicant) => (
              <div
                key={applicant.id}
                className="bg-card rounded-xl p-6 border border-border/50"
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <User className="w-6 h-6 text-primary" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-semibold">
                        {applicant.profile?.full_name || "The Workie"}
                      </h3>
                      {getStatusBadge(applicant.status)}
                    </div>

                    <p className="text-sm text-muted-foreground mb-2">
                      {applicant.employee.headline || "Looking for opportunities"}
                    </p>

                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-3">
                      {applicant.employee.city && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {applicant.employee.city}
                        </span>
                      )}
                      {applicant.employee.experience_years !== null && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {applicant.employee.experience_years} years
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        Applied {new Date(applicant.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    {applicant.employee.skills && applicant.employee.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {applicant.employee.skills.slice(0, 5).map((skill) => (
                          <Badge key={skill} variant="secondary" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {applicant.cover_letter && (
                      <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                        <p className="text-sm font-medium mb-1">Cover Letter</p>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {applicant.cover_letter}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 sm:min-w-[160px]">
                    <Select
                      value={applicant.status}
                      onValueChange={(value) => handleStatusChange(applicant.id, value)}
                      disabled={updatingId === applicant.id}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="shortlisted">Shortlist</SelectItem>
                        <SelectItem value="hired">Hire</SelectItem>
                        <SelectItem value="rejected">Reject</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStartConversation(applicant)}
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      {applicant.conversation_id ? "Open Chat" : "Start Chat"}
                    </Button>

                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/workers/${applicant.employee.id}`}>
                        View Profile
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}