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
  Star,
} from "lucide-react";
import { useFavoriteWorkers } from "@/hooks/useFavoriteWorkers";
import { FavoriteWorkerDialog } from "@/components/jobs/FavoriteWorkerDialog";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import AIApplicantsView from "@/components/applicants/AIApplicantsView";

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
  hiring_style: string;
  hiring_config: Record<string, unknown>;
  location_city: string | null;
  job_type: string;
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
  
  // Favorite workers state
  const { favorites, fetchFavorites, addFavorite, removeFavorite } = useFavoriteWorkers();
  const [favoriteDialogOpen, setFavoriteDialogOpen] = useState(false);
  const [selectedApplicantForFav, setSelectedApplicantForFav] = useState<Applicant | null>(null);
  const [isRemovingFavorite, setIsRemovingFavorite] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || !isContractor())) {
      navigate("/auth");
    }
  }, [user, authLoading, isContractor, navigate]);

  // Fetch favorites when user is ready
  useEffect(() => {
    if (user && isContractor()) fetchFavorites();
  }, [user, isContractor, fetchFavorites]);

  useEffect(() => {
    async function fetchData() {
      if (!jobId || !user) return;

      // Fetch job
      const { data: jobData, error: jobError } = await supabase
        .from("jobs")
        .select("id, title, positions_available, positions_filled, hiring_style, hiring_config, location_city, job_type")
        .eq("id", jobId)
        .single();

      if (jobError) {
        console.error("Error fetching job:", jobError);
        setIsLoading(false);
        return;
      }

      setJob({ ...jobData, hiring_config: (jobData.hiring_config || {}) as Record<string, unknown> });

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

      const apps = applications || [];
      if (apps.length === 0) {
        setApplicants([]);
        setIsLoading(false);
        return;
      }

      // Batch fetch employee profiles
      const employeeIds = apps.map((a) => a.employee_id).filter(Boolean);
      const { data: employees } = await supabase
        .from("employee_profiles")
        .select("id, user_id, headline, city, experience_years, skills")
        .in("id", employeeIds);

      const empMap = new Map((employees || []).map((e) => [e.id, e]));

      // Batch fetch user profiles
      const userIds = (employees || []).map((e) => e.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", userIds);

      const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));

      // Batch fetch conversations
      const appIds = apps.map((a) => a.id);
      const { data: convos } = await supabase
        .from("conversations")
        .select("id, job_application_id")
        .in("job_application_id", appIds);

      const convoMap = new Map((convos || []).map((c) => [c.job_application_id, c.id]));

      // Enrich
      const enrichedApplicants = apps
        .map((app) => {
          const employee = empMap.get(app.employee_id);
          if (!employee) return null;
          const profile = profileMap.get(employee.user_id) || null;
          return {
            ...app,
            employee,
            profile: profile ? { full_name: profile.full_name, email: profile.email } : null,
            conversation_id: convoMap.get(app.id) || null,
          };
        })
        .filter(Boolean) as Applicant[];

      setApplicants(enrichedApplicants);
      setIsLoading(false);
    }

    if (user && isContractor()) {
      fetchData();
    }
  }, [jobId, user, isContractor]);

  const handleStatusChange = async (applicationId: string, newStatus: string) => {
    setUpdatingId(applicationId);

    const { data, error } = await supabase.functions.invoke("update-application-status", {
      body: { job_application_id: applicationId, new_status: newStatus },
    });

    setUpdatingId(null);

    if (error || data?.error) {
      console.error("Error updating status:", error || data?.error);
      toast({
        title: "Error",
        description: data?.error || "Failed to update application status.",
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
      approved_to_pool: { class: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", label: "In Talent Pool" },
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

  // Always render AI Applicants view (all jobs use AI-powered analysis)
  return <AIApplicantsView jobId={jobId!} job={job} />;
}