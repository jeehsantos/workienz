import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useUpgradeButtonVisibility } from "@/hooks/useUpgradeButtonVisibility";
import { Loader2, ArrowLeft, MapPin, Clock, DollarSign, Building2, CheckCircle, Users, AlertTriangle, Calendar, ShieldCheck, Lock, ClipboardList } from "lucide-react";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { JobDescription } from "@/components/jobs/JobDescription";
import { formatHourlyRate } from "@/lib/formatters";
import { ContractorAvatar } from "@/components/contractor/ContractorAvatar";

type JobShift = {
  id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  break_paid: boolean;
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
  experience_required: boolean;
  is_sse: boolean;
  weekly_hours: number | null;
  hiring_style: string;
  contractor: {
    id: string;
    company_name: string;
    company_description: string | null;
    industry: string | null;
    avatar_url: string | null;
  } | null;
  shifts: JobShift[];
};

// Advisory hint from validate-application (informational only)
interface AdvisoryHint {
  can_apply_hint: boolean;
  hint_reason: string | null;
  cooldown_remaining_days: number | null;
  is_subscribed: boolean;
  referral_credits_remaining: number;
  already_applied: boolean;
}

function UpgradeButtonInline({
  size = "sm",
  className = ""
}: {
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  const { showUpgrade, upgradeText, upgradeLink } = useUpgradeButtonVisibility();
  if (!showUpgrade) return null;
  return (
    <Button asChild size={size} className={className}>
      <Link to={upgradeLink}>{upgradeText}</Link>
    </Button>
  );
}

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isEmployee } = useAuthContext();
  const { toast } = useToast();

  const [job, setJob] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasApplied, setHasApplied] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState<string>('pending');
  const [isApplying, setIsApplying] = useState(false);
  const [coverLetter, setCoverLetter] = useState("");
  const [employeeProfileId, setEmployeeProfileId] = useState<string | null>(null);
  const [applicationError, setApplicationError] = useState<string | null>(null);

  // Advisory hints (informational warnings, do NOT block submission)
  const [advisoryHint, setAdvisoryHint] = useState<AdvisoryHint | null>(null);


  // Experience advisory (client-side hint only)
  const [employeeExperienceYears, setEmployeeExperienceYears] = useState<number | null>(null);
  const [employeeIndustry, setEmployeeIndustry] = useState<string | null>(null);

  useEffect(() => {
    async function fetchJob() {
      if (!id) return;
      const { data, error } = await supabase.from("jobs").select(`
          id, title, description, requirements, job_type, duration,
          location_city, location_suburb, location_country,
          hourly_rate_min, hourly_rate_max, skills_required,
          positions_available, positions_filled, starts_at, ends_at,
          created_at, contractor_id, industry, schedule_type,
          experience_required, is_sse, weekly_hours, hiring_style
        `).eq("id", id).single();

      if (error) {
        console.error("Error fetching job:", error);
        setIsLoading(false);
        return;
      }

      const { data: contractor } = await supabase
        .from("contractor_profiles")
        .select("id, company_name, company_description, industry, avatar_url")
        .eq("id", data.contractor_id)
        .single();

      let shifts: JobShift[] = [];
      if (data.schedule_type === "shifts") {
        const { data: shiftsData } = await supabase
          .from("job_shifts")
          .select("*")
          .eq("job_id", id)
          .order("shift_date", { ascending: true });
        shifts = shiftsData || [];
      }

      setJob({
        ...data,
        contractor,
        shifts,
        experience_required: (data as any).experience_required ?? false,
        is_sse: (data as any).is_sse ?? false,
        hiring_style: 'slot_1to1',
      });
      setIsLoading(false);

    }
    fetchJob();
  }, [id]);

  // Fetch advisory hints + basic profile info
  useEffect(() => {
    async function checkApplication() {
      if (!user || !id || !isEmployee()) return;

      // Get employee profile (minimal)
      const { data: profile } = await supabase
        .from("employee_profiles")
        .select("id, experience_years, industry")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profile) {
        setEmployeeProfileId(profile.id);
        setEmployeeExperienceYears(profile.experience_years);
        setEmployeeIndustry((profile as any).industry);

        // Check if already applied (for UI display)
        const { data: application } = await supabase
          .from("job_applications")
          .select("id, status")
          .eq("job_id", id)
          .eq("employee_id", profile.id)
          .maybeSingle();

        setHasApplied(!!application);
        if (application) setApplicationStatus(application.status);
      }

      // Fetch advisory hint from validate-application (non-blocking)
      try {
        const { data: hint } = await supabase.functions.invoke('validate-application', {
          body: { job_id: id },
        });
        if (hint && !hint.error) {
          setAdvisoryHint(hint);
          if (hint.already_applied) setHasApplied(true);
        }
      } catch {
        // Advisory failure is non-critical
      }
    }
    checkApplication();
  }, [user, id, isEmployee]);

  // Experience advisory hint (client-side only, does NOT block)
  const experienceWarning = useMemo(() => {
    if (!job || !employeeProfileId) return null;
    if (!job.experience_required) return null;

    if (!employeeExperienceYears || employeeExperienceYears === 0) {
      return "This job requires experience. Your profile shows no work experience.";
    }
    if (job.industry && employeeIndustry && job.industry !== employeeIndustry) {
      return `This job requires experience in ${job.industry}. Your profile shows experience in ${employeeIndustry}.`;
    }
    if (job.industry && !employeeIndustry) {
      return `This job requires experience in ${job.industry}. Please update your profile to indicate your industry experience.`;
    }
    return null;
  }, [job, employeeProfileId, employeeExperienceYears, employeeIndustry]);

  const hourlyRate = useMemo(
    () => formatHourlyRate(job?.hourly_rate_min, job?.hourly_rate_max),
    [job?.hourly_rate_min, job?.hourly_rate_max]
  );

  const proceedWithApplication = useCallback(async () => {
    if (!employeeProfileId || !id || !user || isApplying) return;

    setIsApplying(true);
    setApplicationError(null);

    try {
      const requestBody: Record<string, unknown> = {
        job_id: id,
        cover_letter: coverLetter || undefined,
      };


      const response = await supabase.functions.invoke('submit-application', {
        body: requestBody,
      });

      if (response.error) {
        let errorMessage = "Failed to submit application. Please try again.";
        let isUpgradePrompt = false;
        try {
          if (typeof response.error === 'object') {
            const ctx = (response.error as any).context;
            if (ctx && typeof ctx.json === 'function') {
              const body = await ctx.json();
              if (body?.error) errorMessage = body.error;
              if (body?.upgrade_prompt) isUpgradePrompt = true;
            } else if (response.error.message) {
              const jsonMatch = response.error.message.match(/\{[\s\S]*\}$/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                if (parsed?.error) errorMessage = parsed.error;
                if (parsed?.upgrade_prompt) isUpgradePrompt = true;
              } else {
                errorMessage = response.error.message;
              }
            }
          }
        } catch {
          // Keep default
        }
        setApplicationError(errorMessage);
        toast({
          title: isUpgradePrompt ? "Application Limit Reached" : "Application Error",
          description: errorMessage,
          variant: "destructive",
        });
        setIsApplying(false);
        return;
      }

      const result = response.data;
      if (result?.error) {
        setApplicationError(result.error);
        toast({
          title: result.upgrade_prompt ? "Application Limit Reached" : "Application Error",
          description: result.error,
          variant: "destructive",
        });
        setIsApplying(false);
        return;
      }

      if (!result?.success) {
        const msg = result?.error || "Failed to submit application.";
        setApplicationError(msg);
        toast({ title: "Application Error", description: msg, variant: "destructive" });
        setIsApplying(false);
        return;
      }

      setIsApplying(false);
      setHasApplied(true);
      setCoverLetter("");
      toast({
        title: "Application Submitted!",
        description: result.data?.conversation_id
          ? "You're now connected with the employer. Check your dashboard to view the conversation."
          : "Your application has been sent to the employer.",
      });
    } catch (error) {
      console.error("Error applying:", error);
      setApplicationError("An unexpected error occurred. Please try again.");
      toast({ title: "Error", description: "An unexpected error occurred. Please try again.", variant: "destructive" });
      setIsApplying(false);
    }
  }, [employeeProfileId, id, user, coverLetter, toast, job, isApplying]);

  const handleApply = useCallback(async () => {
    if (!employeeProfileId || !id || !user) return;
    proceedWithApplication();
  }, [employeeProfileId, id, user, proceedWithApplication]);

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

  // Determine if there's an advisory warning to show (non-blocking)
  const showCooldownWarning = advisoryHint && !advisoryHint.can_apply_hint && advisoryHint.cooldown_remaining_days && advisoryHint.cooldown_remaining_days > 0;
  const showLimitWarning = advisoryHint && !advisoryHint.can_apply_hint && !advisoryHint.cooldown_remaining_days && advisoryHint.hint_reason && !advisoryHint.already_applied;

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
                <Badge variant="outline" className="capitalize">{job.job_type}</Badge>
                {job.industry && <Badge variant="secondary">{job.industry}</Badge>}
                {job.experience_required && <Badge variant="destructive">Experience Required</Badge>}
              </div>
              <h1 className="text-2xl font-bold mb-2 font-display">{job.title}</h1>
              {user ? (
                <div className="text-muted-foreground mb-4">
                  <span>{job.contractor?.company_name || "Company"}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-muted-foreground mb-4">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Sign in to see company details</span>
                </div>
              )}

              <div className="flex flex-col gap-2 text-sm text-muted-foreground mb-6">
                <div className="flex flex-wrap gap-4">
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
                  {hourlyRate && (
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-4 h-4" />
                      {hourlyRate}
                    </span>
                  )}
                </div>
                {job.is_sse && (
                  <div className="flex items-center gap-2 text-foreground">
                    <ShieldCheck className="w-4 h-4" />
                    <span className="font-medium">SSE employer</span>
                  </div>
                )}
              </div>

              <JobDescription description={job.description} requirements={job.requirements} />

              {job.skills_required && job.skills_required.length > 0 && (
                <div className="mt-6 pt-4 border-t border-border/50">
                  <h3 className="text-sm font-semibold mb-2">Required Skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {job.skills_required.map(skill => (
                      <Badge key={skill} variant="secondary">{skill}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Schedule Section - hide shift details from employees; they browse via My Shifts */}
            {((!isEmployee && job.shifts.length > 0) || job.starts_at) && (
              <div className="bg-card rounded-xl p-6 border border-border/50">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  {job.schedule_type === "shifts" ? "Shift Schedule" : "Contract Period"}
                </h3>

                {job.schedule_type === "shifts" && job.shifts.length > 0 && (
                  <div className="space-y-3">
                    {job.shifts.map(shift => (
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

                {job.schedule_type === "fixed_term" && job.starts_at && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Start Date:</span>
                      <span className="font-medium">{format(new Date(job.starts_at), "EEEE, MMM d, yyyy")}</span>
                    </div>
                    {job.ends_at && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">End Date:</span>
                        <span className="font-medium">{format(new Date(job.ends_at), "EEEE, MMM d, yyyy")}</span>
                      </div>
                    )}
                    {job.weekly_hours && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Weekly Hours:</span>
                        <span className="font-medium">{job.weekly_hours} hours/week</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Apply Section */}
            {user && isEmployee() && (
              <div className="bg-card rounded-xl p-6 border border-border/50">
                {hasApplied ? (
                  <div className={`flex items-center gap-3 ${
                    applicationStatus === 'rejected' ? 'text-red-600 dark:text-red-400'
                    : applicationStatus === 'hired' ? 'text-green-600 dark:text-green-400'
                    : 'text-amber-600 dark:text-amber-400'
                  }`}>
                    {applicationStatus === 'rejected' ? <AlertTriangle className="w-6 h-6" /> : <CheckCircle className="w-6 h-6" />}
                    <div>
                      <p className="font-semibold">
                        {applicationStatus === 'rejected' ? 'Application Not Successful'
                          : applicationStatus === 'hired' ? "You've Been Hired!"
                          : 'Application Submitted'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {applicationStatus === 'rejected' ? 'The employer has decided not to proceed with your application.'
                          : applicationStatus === 'hired' ? 'Congratulations! Check your messages for next steps.'
                          : 'The employer will review your application.'}
                      </p>
                    </div>
                  </div>
                ) : !employeeProfileId ? (
                  <div>
                    <p className="text-muted-foreground mb-3">Complete your profile to apply for jobs.</p>
                    <Button asChild>
                      <Link to="/employee/profile">Complete Profile</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Ready to apply? Add a cover letter to stand out!
                    </p>

                    {/* Advisory warnings (non-blocking) */}
                    {experienceWarning && (
                      <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 rounded-lg text-sm">
                        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium">Experience Warning</p>
                          <p>{experienceWarning}</p>
                          <Button asChild size="sm" variant="outline" className="mt-2">
                            <Link to="/employee/profile">Update Profile</Link>
                          </Button>
                        </div>
                      </div>
                    )}

                    {showCooldownWarning && (
                      <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 rounded-lg text-sm">
                        <Clock className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium">Cooldown Notice</p>
                          <p>
                            You may need to wait {advisoryHint!.cooldown_remaining_days} more day{advisoryHint!.cooldown_remaining_days! > 1 ? 's' : ''} before applying.
                            This cooldown applies when you've used your free application slot and have no remaining referral credits.
                          </p>
                          <div className="flex gap-2 mt-2">
                            <UpgradeButtonInline />
                            <Button asChild size="sm" variant="outline">
                              <Link to="/dashboard?tab=settings">Invite Friends</Link>
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {showLimitWarning && (
                      <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 rounded-lg text-sm">
                        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium">Application Limit Notice</p>
                          <p>{advisoryHint!.hint_reason}</p>
                          <div className="flex gap-2 mt-2">
                            <UpgradeButtonInline />
                            <Button asChild size="sm" variant="outline">
                              <Link to="/dashboard?tab=settings">Invite Friends</Link>
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {applicationError && (
                      <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                        {applicationError}
                      </div>
                    )}

                    {/* Cover letter */}
                    <div className="space-y-2">
                      <Label htmlFor="cover_letter">Cover Letter (Optional)</Label>
                      <Textarea
                        id="cover_letter"
                        value={coverLetter}
                        onChange={e => setCoverLetter(e.target.value)}
                        placeholder="Tell the employer why you're a great fit for this position..."
                        rows={5}
                      />
                      <p className="text-xs text-muted-foreground">
                        A good cover letter increases your chances of getting noticed.
                      </p>
                    </div>

                    {/* Submit button — NEVER blocked by advisory hints */}
                    <Button
                      onClick={handleApply}
                      disabled={isApplying}
                      className="w-full"
                    >
                      {isApplying && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Submit Application
                    </Button>
                  </div>
                )}
              </div>
            )}

            {!user && (
              <div className="bg-card rounded-xl p-6 border border-border/50 text-center">
                <p className="text-muted-foreground mb-4">Sign in as a job seeker to apply for this position.</p>
                <Button asChild>
                  <Link to="/auth">Sign In to Apply</Link>
                </Button>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {user ? (
              <div className="bg-card rounded-xl p-6 border border-border/50">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  About the Company
                </h3>
                <div className="gap-4 flex-col flex items-center justify-center">
                  <ContractorAvatar avatarUrl={job.contractor?.avatar_url} companyName={job.contractor?.company_name} size="xl" />
                  <p className="font-medium text-lg">{job.contractor?.company_name || "Company"}</p>
                </div>
                {job.contractor?.company_description && (
                  <p className="text-sm text-muted-foreground mt-3">{job.contractor.company_description}</p>
                )}
              </div>
            ) : (
              <div className="bg-card rounded-xl p-6 border border-border/50 text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Lock className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Company Details Hidden</h3>
                <p className="text-sm text-muted-foreground mb-4">Sign in to view company information and apply for this job.</p>
                <Button asChild size="sm">
                  <Link to="/auth">Sign In</Link>
                </Button>
              </div>
            )}

            <div className="bg-card rounded-xl p-6 border border-border/50">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Positions
              </h3>
              <div className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Available</span>
                  <span className="font-medium">{job.positions_available}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Filled</span>
                  <span className="font-medium">{job.positions_filled}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Remaining</span>
                  <span className="font-medium text-primary">{job.positions_available - job.positions_filled}</span>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-xl p-6 border border-border/50">
              <p className="text-xs text-muted-foreground">
                Posted {format(new Date(job.created_at), "MMM d, yyyy")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
