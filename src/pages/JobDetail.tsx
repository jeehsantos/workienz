import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  ArrowLeft,
  MapPin,
  Clock,
  DollarSign,
  Building2,
  Calendar,
  CheckCircle,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Job = {
  id: string;
  title: string;
  description: string;
  requirements: string | null;
  job_type: string;
  duration: string | null;
  location_city: string | null;
  location_suburb: string | null;
  location_country: string | null;
  hourly_rate_min: number | null;
  hourly_rate_max: number | null;
  skills_required: string[] | null;
  positions_available: number;
  positions_filled: number;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  contractor: {
    id: string;
    company_name: string;
    company_description: string | null;
    industry: string | null;
  } | null;
};

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isEmployee } = useAuthContext();
  const { toast } = useToast();

  const [job, setJob] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasApplied, setHasApplied] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [coverLetter, setCoverLetter] = useState("");
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [employeeProfileId, setEmployeeProfileId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchJob() {
      if (!id) return;

      const { data, error } = await supabase
        .from("jobs")
        .select(`
          id,
          title,
          description,
          requirements,
          job_type,
          duration,
          location_city,
          location_suburb,
          location_country,
          hourly_rate_min,
          hourly_rate_max,
          skills_required,
          positions_available,
          positions_filled,
          starts_at,
          ends_at,
          created_at,
          contractor_id
        `)
        .eq("id", id)
        .single();

      if (error) {
        console.error("Error fetching job:", error);
        setIsLoading(false);
        return;
      }

      // Fetch contractor info
      const { data: contractor } = await supabase
        .from("contractor_profiles")
        .select("id, company_name, company_description, industry")
        .eq("id", data.contractor_id)
        .single();

      setJob({ ...data, contractor });
      setIsLoading(false);
    }

    fetchJob();
  }, [id]);

  useEffect(() => {
    async function checkApplication() {
      if (!user || !id || !isEmployee()) return;

      // Get employee profile
      const { data: profile } = await supabase
        .from("employee_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profile) {
        setEmployeeProfileId(profile.id);

        // Check if already applied
        const { data: application } = await supabase
          .from("job_applications")
          .select("id")
          .eq("job_id", id)
          .eq("employee_id", profile.id)
          .maybeSingle();

        setHasApplied(!!application);
      }
    }

    checkApplication();
  }, [user, id, isEmployee]);

  const handleApply = async () => {
    if (!employeeProfileId || !id) return;

    setIsApplying(true);

    const { error } = await supabase.from("job_applications").insert({
      job_id: id,
      employee_id: employeeProfileId,
      cover_letter: coverLetter || null,
    });

    setIsApplying(false);

    if (error) {
      console.error("Error applying:", error);
      toast({
        title: "Error",
        description: "Failed to submit application. Please try again.",
        variant: "destructive",
      });
      return;
    }

    setHasApplied(true);
    setShowApplyForm(false);
    toast({
      title: "Application Submitted!",
      description: "Your application has been sent to the employer.",
    });
  };

  if (isLoading) {
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
              <Link to="/jobs">Back to Jobs</Link>
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
          <Link to="/jobs">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Jobs
          </Link>
        </Button>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-card rounded-xl p-6 border border-border/50">
              <Badge variant="outline" className="capitalize mb-3">
                {job.job_type}
              </Badge>
              <h1 className="text-2xl font-bold mb-2 font-display">{job.title}</h1>
              <p className="text-muted-foreground mb-4">
                {job.contractor?.company_name || "Company"}
              </p>

              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-6">
                {job.location_city && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {job.location_suburb && `${job.location_suburb}, `}
                    {job.location_city}
                    {job.location_country && `, ${job.location_country}`}
                  </span>
                )}
                {job.duration && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {job.duration}
                  </span>
                )}
                {(job.hourly_rate_min || job.hourly_rate_max) && (
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-4 h-4" />$
                    {job.hourly_rate_min || "?"} - ${job.hourly_rate_max || "?"}/hr
                  </span>
                )}
              </div>

              <div className="prose prose-sm max-w-none dark:prose-invert">
                <h3>Description</h3>
                <p className="whitespace-pre-wrap">{job.description}</p>

                {job.requirements && (
                  <>
                    <h3>Requirements</h3>
                    <p className="whitespace-pre-wrap">{job.requirements}</p>
                  </>
                )}
              </div>

              {job.skills_required && job.skills_required.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold mb-2">Required Skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {job.skills_required.map((skill) => (
                      <Badge key={skill} variant="secondary">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Apply Section */}
            {user && isEmployee() && (
              <div className="bg-card rounded-xl p-6 border border-border/50">
                {hasApplied ? (
                  <div className="flex items-center gap-3 text-green-600 dark:text-green-400">
                    <CheckCircle className="w-6 h-6" />
                    <div>
                      <p className="font-semibold">Application Submitted</p>
                      <p className="text-sm text-muted-foreground">
                        The employer will review your application.
                      </p>
                    </div>
                  </div>
                ) : !employeeProfileId ? (
                  <div>
                    <p className="text-muted-foreground mb-3">
                      Complete your profile to apply for jobs.
                    </p>
                    <Button asChild>
                      <Link to="/employee/profile">Complete Profile</Link>
                    </Button>
                  </div>
                ) : showApplyForm ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="cover_letter">Cover Letter (Optional)</Label>
                      <Textarea
                        id="cover_letter"
                        value={coverLetter}
                        onChange={(e) => setCoverLetter(e.target.value)}
                        placeholder="Tell the employer why you're a great fit..."
                        rows={5}
                      />
                    </div>
                    <div className="flex gap-3">
                      <Button onClick={handleApply} disabled={isApplying}>
                        {isApplying && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Submit Application
                      </Button>
                      <Button variant="outline" onClick={() => setShowApplyForm(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button onClick={() => setShowApplyForm(true)} className="w-full">
                    Apply for this Job
                  </Button>
                )}
              </div>
            )}

            {!user && (
              <div className="bg-card rounded-xl p-6 border border-border/50 text-center">
                <p className="text-muted-foreground mb-3">
                  Sign in to apply for this job.
                </p>
                <Button asChild>
                  <Link to="/auth">Sign In</Link>
                </Button>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {job.contractor && (
              <div className="bg-card rounded-xl p-6 border border-border/50">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{job.contractor.company_name}</h3>
                    {job.contractor.industry && (
                      <p className="text-sm text-muted-foreground">{job.contractor.industry}</p>
                    )}
                  </div>
                </div>
                {job.contractor.company_description && (
                  <p className="text-sm text-muted-foreground">
                    {job.contractor.company_description}
                  </p>
                )}
              </div>
            )}

            <div className="bg-card rounded-xl p-6 border border-border/50">
              <h3 className="font-semibold mb-4">Job Details</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Posted</span>
                  <span>{new Date(job.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <span className="capitalize">{job.job_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Positions</span>
                  <span>{job.positions_available - job.positions_filled} of {job.positions_available} available</span>
                </div>
                {job.duration && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Duration</span>
                    <span>{job.duration}</span>
                  </div>
                )}
                {job.starts_at && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Start Date</span>
                    <span>{new Date(job.starts_at).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
