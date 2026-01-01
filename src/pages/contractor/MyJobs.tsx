import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, ArrowLeft, Briefcase, Eye, Edit, Trash2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Job = {
  id: string;
  title: string;
  status: string;
  job_type: string;
  location_city: string | null;
  created_at: string;
  hourly_rate_min: number | null;
  hourly_rate_max: number | null;
};

export default function MyJobs() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, isContractor } = useAuthContext();
  const { toast } = useToast();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [contractorProfileId, setContractorProfileId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || !isContractor())) {
      navigate("/auth");
    }
  }, [user, authLoading, isContractor, navigate]);

  useEffect(() => {
    async function fetchJobs() {
      if (!user) return;

      // First get contractor profile
      const { data: profile } = await supabase
        .from("contractor_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profile) {
        setIsLoading(false);
        return;
      }

      setContractorProfileId(profile.id);

      // Then fetch jobs
      const { data, error } = await supabase
        .from("jobs")
        .select("id, title, status, job_type, location_city, created_at, hourly_rate_min, hourly_rate_max")
        .eq("contractor_id", profile.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching jobs:", error);
        toast({
          title: "Error",
          description: "Failed to load your jobs.",
          variant: "destructive",
        });
      } else {
        setJobs(data || []);
      }

      setIsLoading(false);
    }

    if (user && isContractor()) {
      fetchJobs();
    }
  }, [user, isContractor, toast]);

  const handleDelete = async (jobId: string) => {
    const { error } = await supabase.from("jobs").delete().eq("id", jobId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete job.",
        variant: "destructive",
      });
      return;
    }

    setJobs(jobs.filter((j) => j.id !== jobId));
    toast({ title: "Job deleted" });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "published":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "draft":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "closed":
        return "bg-muted text-muted-foreground";
      case "filled":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container-tight py-8">
        <Button variant="ghost" asChild className="mb-6">
          <Link to="/dashboard">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
        </Button>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold font-display">My Job Postings</h1>
            <p className="text-muted-foreground">Manage your job listings</p>
          </div>
          <Button asChild>
            <Link to="/contractor/post-job">
              <Plus className="w-4 h-4 mr-2" />
              Post New Job
            </Link>
          </Button>
        </div>

        {!contractorProfileId ? (
          <div className="text-center py-16 bg-card rounded-xl border border-border/50">
            <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Set Up Your Profile</h2>
            <p className="text-muted-foreground mb-4">
              Complete your contractor profile to start posting jobs.
            </p>
            <Button asChild>
              <Link to="/contractor/profile">Complete Profile</Link>
            </Button>
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-xl border border-border/50">
            <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Jobs Yet</h2>
            <p className="text-muted-foreground mb-4">
              Create your first job posting to start finding workers.
            </p>
            <Button asChild>
              <Link to="/contractor/post-job">Post Your First Job</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="bg-card rounded-xl p-6 border border-border/50 shadow-soft"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold">{job.title}</h3>
                      <Badge className={getStatusColor(job.status)}>{job.status}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span className="capitalize">{job.job_type}</span>
                      {job.location_city && <span>{job.location_city}</span>}
                      {(job.hourly_rate_min || job.hourly_rate_max) && (
                        <span>
                          ${job.hourly_rate_min || "?"} - ${job.hourly_rate_max || "?"}/hr
                        </span>
                      )}
                      <span>
                        Posted {new Date(job.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" asChild>
                      <Link to={`/contractor/jobs/${job.id}/applicants`}>
                        <Users className="w-4 h-4" />
                      </Link>
                    </Button>
                    <Button variant="ghost" size="icon" asChild>
                      <Link to={`/contractor/jobs/${job.id}`}>
                        <Eye className="w-4 h-4" />
                      </Link>
                    </Button>
                    <Button variant="ghost" size="icon" asChild>
                      <Link to={`/contractor/jobs/${job.id}/edit`}>
                        <Edit className="w-4 h-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(job.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
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
