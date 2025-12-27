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
  CheckCircle,
  Users,
  AlertTriangle,
  Calendar,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

type JobShift = {
  id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  break_paid: boolean;
};

type JobWorkDate = {
  id: string;
  work_date: string;
};

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
  industry: string | null;
  schedule_type: string | null;
  contractor: {
    id: string;
    company_name: string;
    company_description: string | null;
    industry: string | null;
  } | null;
  shifts: JobShift[];
  work_dates: JobWorkDate[];
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
  const [employeeIndustry, setEmployeeIndustry] = useState<string | null>(null);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [activeApplicationsCount, setActiveApplicationsCount] = useState(0);
  const [applicationError, setApplicationError] = useState<string | null>(null);

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
          contractor_id,
          industry,
          schedule_type
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

      // Fetch shifts if schedule_type is shifts
      let shifts: JobShift[] = [];
      if (data.schedule_type === "shifts") {
        const { data: shiftsData } = await supabase
          .from("job_shifts")
          .select("*")
          .eq("job_id", id)
          .order("shift_date", { ascending: true });
        shifts = shiftsData || [];
      }

      // Fetch work dates if schedule_type is fixed_term
      let work_dates: JobWorkDate[] = [];
      if (data.schedule_type === "fixed_term") {
        const { data: datesData } = await supabase
          .from("job_work_dates")
          .select("*")
          .eq("job_id", id)
          .order("work_date", { ascending: true });
        work_dates = datesData || [];
      }

      setJob({ ...data, contractor, shifts, work_dates });
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
        .select("id, industry")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profile) {
        setEmployeeProfileId(profile.id);
        setEmployeeIndustry(profile.industry);

        // Check if already applied
        const { data: application } = await supabase
          .from("job_applications")
          .select("id")
          .eq("job_id", id)
          .eq("employee_id", profile.id)
          .maybeSingle();

        setHasApplied(!!application);

        // Get active applications count (pending or shortlisted, not rejected or hired)
        const { count } = await supabase
          .from("job_applications")
          .select("id", { count: "exact", head: true })
          .eq("employee_id", profile.id)
          .in("status", ["pending", "shortlisted"]);

        setActiveApplicationsCount(count || 0);
      }

      // Check subscription
      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      setHasActiveSubscription(!!subscription);
    }

    checkApplication();
  }, [user, id, isEmployee]);

  const canApply = () => {
    if (!job || !employeeProfileId) return { allowed: false, reason: "Complete your profile first" };
    
    // Check industry match
    if (job.industry && employeeIndustry && job.industry !== employeeIndustry) {
      return { allowed: false, reason: `This job requires ${job.industry} industry experience. Update your profile to apply.` };
    }

    // Check application limits
    if (!hasActiveSubscription) {
      if (activeApplicationsCount >= 1) {
        return { allowed: false, reason: "Free users can only have 1 active application. Upgrade to Premium for unlimited applications." };
      }
    }

    return { allowed: true, reason: null };
  };

  const handleApply = async () => {
    if (!employeeProfileId || !id || !user) return;

    const eligibility = canApply();
    if (!eligibility.allowed) {
      setApplicationError(eligibility.reason);
      return;
    }

    setIsApplying(true);
    setApplicationError(null);

    // Insert job application
    const { data: appData, error } = await supabase.from("job_applications").insert({
      job_id: id,
      employee_id: employeeProfileId,
      cover_letter: coverLetter || null,
    }).select("id").single();

    if (error) {
      console.error("Error applying:", error);
      toast({
        title: "Error",
        description: "Failed to submit application. Please try again.",
        variant: "destructive",
      });
      setIsApplying(false);
      return;
    }

    // Auto-create conversation for this application
    if (appData && job?.contractor) {
      // Get contractor's user_id
      const { data: contractorData } = await supabase
        .from("contractor_profiles")
        .select("user_id")
        .eq("id", job.contractor.id)
        .single();

      if (contractorData) {
        // Create conversation
        await supabase.from("conversations").insert({
          job_application_id: appData.id,
          contractor_user_id: contractorData.user_id,
          employee_user_id: user.id,
        });
      }
    }

    setIsApplying(false);
    setHasApplied(true);
    setShowApplyForm(false);
    toast({
      title: "Application Submitted!",
      description: "Your application has been sent to the employer. They can now message you.",
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

  const eligibility = canApply();

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
              <div className="flex flex-wrap gap-2 mb-3">
                <Badge variant="outline" className="capitalize">
                  {job.job_type}
                </Badge>
                {job.industry && (
                  <Badge variant="secondary">{job.industry}</Badge>
                )}
              </div>
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

            {/* Schedule Section */}
            {(job.shifts.length > 0 || job.work_dates.length > 0) && (
              <div className="bg-card rounded-xl p-6 border border-border/50">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  {job.schedule_type === "shifts" ? "Shift Schedule" : "Work Dates"}
                </h3>
                
                {job.schedule_type === "shifts" && job.shifts.length > 0 && (
                  <div className="space-y-3">
                    {job.shifts.map((shift) => (
                      <div key={shift.id} className="p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">
                            {format(new Date(shift.shift_date), "EEEE, MMM d, yyyy")}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {shift.start_time} - {shift.end_time}
                          </span>
                        </div>
                        {shift.break_minutes > 0 && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {shift.break_minutes} min break ({shift.break_paid ? "paid" : "unpaid"})
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {job.schedule_type === "fixed_term" && job.work_dates.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {job.work_dates.map((wd) => (
                      <Badge key={wd.id} variant="outline">
                        {format(new Date(wd.work_date), "MMM d")}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

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
                ) : !eligibility.allowed ? (
                  <div className="flex items-start gap-3 text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="w-6 h-6 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Cannot Apply</p>
                      <p className="text-sm text-muted-foreground">
                        {eligibility.reason}
                      </p>
                      {eligibility.reason?.includes("Premium") && (
                        <Button asChild size="sm" className="mt-2">
                          <Link to="/pricing">Upgrade to Premium</Link>
                        </Button>
                      )}
                      {eligibility.reason?.includes("industry") && (
                        <Button asChild size="sm" variant="outline" className="mt-2">
                          <Link to="/employee/profile">Update Profile</Link>
                        </Button>
                      )}
                    </div>
                  </div>
                ) : showApplyForm ? (
                  <div className="space-y-4">
                    {applicationError && (
                      <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                        {applicationError}
                      </div>
                    )}
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
                {job.industry && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Industry</span>
                    <span>{job.industry}</span>
                  </div>
                )}
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
                {job.ends_at && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">End Date</span>
                    <span>{new Date(job.ends_at).toLocaleDateString()}</span>
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
