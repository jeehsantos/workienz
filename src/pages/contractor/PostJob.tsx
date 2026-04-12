import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, ArrowRight, Save, Send, AlertTriangle, EyeOff } from "lucide-react";
import { format } from "date-fns";
import { UpgradeButton } from "@/components/ui/upgrade-button";
import { useFavoriteWorkers } from "@/hooks/useFavoriteWorkers";
import { FavoritedWorkersSuggestion } from "@/components/jobs/FavoritedWorkersSuggestion";
import { TemplateConfirmation } from "@/components/jobs/TemplateConfirmation";
import { StepIndicator } from "@/components/jobs/StepIndicator";
import { JobDetailsStep } from "@/components/jobs/steps/JobDetailsStep";
import { LocationPayStep } from "@/components/jobs/steps/LocationPayStep";
import { RequirementsStep } from "@/components/jobs/steps/RequirementsStep";
import { BenefitsStep } from "@/components/jobs/steps/BenefitsStep";
import { ScheduleStep } from "@/components/jobs/steps/ScheduleStep";
import { ReviewStep } from "@/components/jobs/steps/ReviewStep";

type Shift = {
  id: string;
  date: Date | undefined;
  start_time: string;
  end_time: string;
  break_minutes: string;
  break_paid: boolean;
};

const STEPS = [
  { id: 1, title: "Job Details" },
  { id: 2, title: "Location" },
  { id: 3, title: "Requirements" },
  { id: 4, title: "Benefits" },
  { id: 5, title: "Schedule" },
  { id: 6, title: "Review" },
];

export default function PostJob() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const templateJobId = searchParams.get("template");
  const { user, isLoading: authLoading, isContractor } = useAuthContext();
  const { toast } = useToast();
  const { favorites, isLoading: favoritesLoading, fetchFavorites } = useFavoriteWorkers();

  const [currentStep, setCurrentStep] = useState(1);
  const [contractorProfile, setContractorProfile] = useState<{ id: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(!!templateJobId);
  const [maxPositions, setMaxPositions] = useState(10);
  const [isFreeTier, setIsFreeTier] = useState(false);
  
  // Entitlement state from backend
  const [canPostJob, setCanPostJob] = useState(true);
  const [remainingPosts, setRemainingPosts] = useState<number | "unlimited">("unlimited");
  const [entitlementError, setEntitlementError] = useState<string | null>(null);
  const [entitlementErrorCode, setEntitlementErrorCode] = useState<string | null>(null);

  // Form data
  const [formData, setFormData] = useState({
    title: "", description: "", requirements: "",
    location_region: "", location_city: "", location_suburb: "",
    location_country: "New Zealand", job_type: "temporary",
    duration: "", hourly_rate: "", positions_available: "1", industry: "",
  });

  const [physicalRequirements, setPhysicalRequirements] = useState<string[]>([]);
  const [requiresCar, setRequiresCar] = useState(false);
  const [selectedBenefits, setSelectedBenefits] = useState<string[]>([]);
  const [experienceRequired, setExperienceRequired] = useState(false);
  const [isSSE, setIsSSE] = useState(false);
  
  const [scheduleType, setScheduleType] = useState<"shifts" | "fixed_term">("shifts");
  const [shifts, setShifts] = useState<Shift[]>([
    { id: crypto.randomUUID(), date: undefined, start_time: "", end_time: "", break_minutes: "0", break_paid: false }
  ]);
  const [fixedTermStart, setFixedTermStart] = useState<Date | undefined>();
  const [fixedTermEnd, setFixedTermEnd] = useState<Date | undefined>();
  const [weeklyHours, setWeeklyHours] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [showTemplateConfirmation, setShowTemplateConfirmation] = useState(!!templateJobId);
  // Auth check
  useEffect(() => {
    if (!authLoading && (!user || !isContractor())) {
      navigate("/auth");
    }
  }, [user, authLoading, isContractor, navigate]);

  // Fetch favorites
  useEffect(() => {
    if (user && isContractor()) fetchFavorites();
  }, [user, isContractor, fetchFavorites]);

  // Load template job data if template param exists
  useEffect(() => {
    async function loadTemplate() {
      if (!templateJobId || !user) return;

      const { data: templateJob, error } = await supabase
        .from("jobs")
        .select("title, description, requirements, location_city, location_suburb, location_country, job_type, duration, hourly_rate_min, industry, positions_available, skills_required, schedule_type, experience_required, is_sse, requires_heavy_lifting, requires_standing, requires_car, provides_training, provides_accommodation, starts_at, ends_at, weekly_hours")
        .eq("id", templateJobId)
        .single();

      if (error || !templateJob) {
        console.error("Failed to load template job:", error);
        toast({ title: "Template not found", description: "Could not load the job template.", variant: "destructive" });
        setIsLoadingTemplate(false);
        return;
      }

      // Pre-fill form data from template (don't copy schedule - it's date-specific)
      setFormData({
        title: templateJob.title || "",
        description: templateJob.description || "",
        requirements: templateJob.requirements || "",
        location_region: "",
        location_city: templateJob.location_city || "",
        location_suburb: templateJob.location_suburb || "",
        location_country: templateJob.location_country || "New Zealand",
        job_type: templateJob.job_type || "temporary",
        duration: templateJob.duration || "",
        hourly_rate: templateJob.hourly_rate_min?.toString() || "",
        positions_available: (templateJob.positions_available || 1).toString(),
        industry: templateJob.industry || "",
      });

      // Set other fields
      if (templateJob.skills_required) setSkills(templateJob.skills_required);
      if (templateJob.experience_required) setExperienceRequired(true);
      if (templateJob.is_sse) setIsSSE(true);
      if (templateJob.schedule_type === "fixed_term") setScheduleType("fixed_term");
      if (templateJob.requires_car) setRequiresCar(true);

      const physReqs: string[] = [];
      if (templateJob.requires_heavy_lifting) physReqs.push("Requires lifting > 10kg");
      if (templateJob.requires_standing) physReqs.push("Requires standing for long periods");
      setPhysicalRequirements(physReqs);

      const benefits: string[] = [];
      if (templateJob.provides_training) benefits.push("Provides training");
      if (templateJob.provides_accommodation) benefits.push("Provides accommodation");
      setSelectedBenefits(benefits);

      toast({ title: "Template loaded", description: "Review the details and post, or edit to customize." });
      setShowTemplateConfirmation(true);
      setIsLoadingTemplate(false);
    }

    if (user && templateJobId) loadTemplate();

  }, [user, templateJobId, toast]);

  // Fetch contractor profile, platform settings, and entitlements
  useEffect(() => {
    async function fetchData() {
      if (!user) return;

      // Run all three requests in parallel
      const [profileResult, settingsResult, entitlementResult] = await Promise.all([
        supabase
          .from("contractor_profiles")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("platform_settings")
          .select("setting_value")
          .eq("setting_key", "max_positions_per_job")
          .maybeSingle(),
        supabase.functions.invoke("validate-job-posting"),
      ]);

      // Process contractor profile
      if (profileResult.error) {
        console.error("Error fetching contractor profile:", profileResult.error);
        toast({ title: "Profile not found", description: "Please complete your contractor profile first.", variant: "destructive" });
        setIsLoadingProfile(false);
        return;
      }
      setContractorProfile(profileResult.data);

      // Process max positions setting
      if (settingsResult.data?.setting_value) {
        setMaxPositions(parseInt(settingsResult.data.setting_value) || 10);
      }

      // Process entitlements
      if (entitlementResult.error) {
        console.error("Error checking entitlements:", entitlementResult.error);
      } else if (entitlementResult.data) {
        const entitlementData = entitlementResult.data;
        setCanPostJob(entitlementData.can_post);
        setRemainingPosts(entitlementData.remaining_posts);
        if (!entitlementData.can_post) {
          setEntitlementError(entitlementData.message);
          setEntitlementErrorCode(entitlementData.error_code);
        }
        
        const isFreeTierPlan = entitlementData.plan_type === "free_tier" || entitlementData.plan_type === "free_contractor";
        if (isFreeTierPlan) {
          setIsFreeTier(true);
          setMaxPositions(1);
          setFormData(prev => ({ ...prev, positions_available: "1" }));
        }
      }

      setIsLoadingProfile(false);
    }

    if (user && isContractor()) fetchData();
  }, [user, isContractor, toast]);

  const updateFormData = (updates: Partial<typeof formData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const containsContactDetails = (value: string) => {
    const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
    const phoneRegex = /(\+?\d[\d\s().-]{7,}\d)/;

    return emailRegex.test(value) || phoneRegex.test(value);
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!formData.title || !formData.description || !formData.industry) {
          toast({ title: "Missing fields", description: "Please fill in all required fields.", variant: "destructive" });
          return false;
        }
        if (containsContactDetails(formData.description)) {
          toast({
            title: "Contact details not allowed",
            description: "It is not allowed to share contact details in the job post.",
            variant: "destructive",
          });
          return false;
        }
        const positions = parseInt(formData.positions_available);
        if (positions > maxPositions) {
          toast({ title: "Too many positions", description: `Maximum ${maxPositions} positions allowed.`, variant: "destructive" });
          return false;
        }
        return true;
      case 2:
        if (!formData.location_region || !formData.location_city) {
          toast({ title: "Location required", description: "Please select a region and city.", variant: "destructive" });
          return false;
        }
        return true;
      case 3:
        return true;
      case 4:
        return true;
      case 5:
        if (scheduleType === "shifts") {
          // Shift-based jobs don't require shift instances at posting time
          return true;
        } else {
          if (!fixedTermStart) {
            toast({ title: "Start date required", description: "Please select a start date.", variant: "destructive" });
            return false;
          }
          if (!weeklyHours || parseInt(weeklyHours) <= 0) {
            toast({ title: "Weekly hours required", description: "Please enter the weekly working hours.", variant: "destructive" });
            return false;
          }
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, STEPS.length));
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleStepClick = (step: number) => {
    if (step <= currentStep) {
      setCurrentStep(step);
    }
  };

  const createJob = async (status: "draft" | "published" | "private"): Promise<{ job_id?: string; error?: boolean }> => {
    if (!contractorProfile) return { error: true };

    // Validate for publishing
    if (status === "published" || status === "private") {
      if (!formData.hourly_rate) {
        toast({ title: "Hourly rate required", description: "Please enter an hourly rate.", variant: "destructive" });
        setCurrentStep(2);
        return { error: true };
      }
    }

    setIsSubmitting(true);

    // Prepare job data
    const jobData = {
      title: formData.title,
      description: formData.description,
      requirements: formData.requirements || null,
      location_city: formData.location_city || null,
      location_suburb: formData.location_suburb || null,
      location_country: formData.location_country || null,
      job_type: scheduleType === "shifts" ? "shift" : "normal",
      duration: formData.duration || null,
      hourly_rate_min: formData.hourly_rate ? parseFloat(formData.hourly_rate) : null,
      hourly_rate_max: null,
      skills_required: skills.length > 0 ? skills : null,
      positions_available: Math.min(parseInt(formData.positions_available) || 1, maxPositions),
      industry: formData.industry || null,
      schedule_type: scheduleType,
      starts_at: fixedTermStart ? fixedTermStart.toISOString() : null,
      ends_at: fixedTermEnd ? fixedTermEnd.toISOString() : null,
      weekly_hours: scheduleType === "fixed_term" && weeklyHours ? parseInt(weeklyHours) : null,
      experience_required: experienceRequired,
      is_sse: isSSE && formData.industry === "Agriculture",
      requires_heavy_lifting: physicalRequirements.includes("Requires lifting > 10kg"),
      requires_standing: physicalRequirements.includes("Requires standing for long periods"),
      requires_car: requiresCar,
      provides_training: selectedBenefits.includes("Provides training"),
      provides_accommodation: selectedBenefits.includes("Provides accommodation"),
      hiring_style: "open_ai_top10",
      hiring_config: { top_n: 10, question_count: 8, score_version: "v1", refresh_debounce_seconds: 60 },
    };

    // Prepare shifts data
    const validShifts = scheduleType === "shifts" 
      ? shifts.filter(s => s.date && s.start_time && s.end_time).map(s => ({
          shift_date: format(s.date!, "yyyy-MM-dd"),
          start_time: s.start_time,
          end_time: s.end_time,
          break_minutes: parseInt(s.break_minutes) || 0,
          break_paid: s.break_paid,
        }))
      : [];

    // Call backend edge function for job creation
    const { data, error } = await supabase.functions.invoke("create-job", {
      body: {
        jobData,
        status,
        shifts: validShifts,
      },
    });

    setIsSubmitting(false);

    if (error) {
      console.error("Error creating job:", error);
      toast({ title: "Error", description: "Failed to create job posting. Please try again.", variant: "destructive" });
      return { error: true };
    }

    // Handle backend errors (like entitlement issues)
    if (data?.error) {
      if (data.error === "ERR_NO_SUBSCRIPTION" || data.error === "ERR_LIMIT_REACHED") {
        toast({
          title: "Subscription Required",
          description: data.message,
          variant: "destructive",
        });
        setTimeout(() => navigate("/pricing"), 2000);
      } else {
        toast({ title: "Error", description: data.message || "Failed to create job.", variant: "destructive" });
      }
      return { error: true };
    }

    return { job_id: data.job_id };
  };

  const handleSubmit = async (status: "draft" | "published" | "private") => {
    const result = await createJob(status);
    if (result.error || !result.job_id) return;

    const isPrivatePost = status === "private";
    toast({
      title: isPrivatePost ? "Private Job Created!" : (status === "published" ? "Job Published!" : "Draft Saved"),
      description: isPrivatePost
        ? "Your private job has been created. You can now offer this position to your favorited workers."
        : (status === "published" 
          ? "Your job posting is now live."
          : "Your job has been saved as a draft."),
    });
    
    if (isPrivatePost && result.job_id) {
      navigate(`/contractor/jobs/${result.job_id}`);
    } else {
      navigate("/contractor/jobs");
    }
  };

  const handleOfferToWorker = async (employeeUserId: string) => {
    if (!contractorProfile) return;

    setIsSubmitting(true);
    const result = await createJob("private");
    if (result.error || !result.job_id) {
      setIsSubmitting(false);
      return;
    }

    // Call offer-position to create application + conversation
    const { data: offerData, error: offerError } = await supabase.functions.invoke("offer-position", {
      body: { job_id: result.job_id, employee_user_id: employeeUserId },
    });

    setIsSubmitting(false);

    if (offerError || !offerData?.success) {
      console.error("Error offering position:", offerError || offerData?.error);
      toast({
        title: "Job created but offer failed",
        description: offerData?.error || "Could not send the offer. You can try again from the job page.",
        variant: "destructive",
      });
      navigate(`/contractor/jobs/${result.job_id}`);
      return;
    }

    toast({
      title: "Position Offered!",
      description: `Offer sent to ${offerData.data.employee_name} for "${offerData.data.job_title}".`,
    });

    if (offerData.data.conversation_id) {
      navigate(`/messages/${offerData.data.conversation_id}`);
    } else {
      navigate(`/contractor/jobs/${result.job_id}`);
    }
  };

  if (authLoading || isLoadingProfile || isLoadingTemplate) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!contractorProfile) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container-tight py-8">
          <div className="text-center py-16">
            <h1 className="text-2xl font-bold mb-4">Complete Your Profile</h1>
            <p className="text-muted-foreground mb-6">You need to set up your contractor profile before posting jobs.</p>
            <Button asChild><Link to="/contractor/profile">Set Up Profile</Link></Button>
          </div>
        </div>
      </div>
    );
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <JobDetailsStep
            formData={formData}
            maxPositions={maxPositions}
            isFreeTier={isFreeTier}
            onChange={updateFormData}
          />
        );
      case 2:
        return (
          <LocationPayStep
            formData={formData}
            onChange={updateFormData}
          />
        );
      case 3:
        return (
          <RequirementsStep
            formData={formData}
            physicalRequirements={physicalRequirements}
            requiresCar={requiresCar}
            skills={skills}
            onFormChange={updateFormData}
            onPhysicalReqsChange={setPhysicalRequirements}
            onRequiresCarChange={setRequiresCar}
            onSkillsChange={setSkills}
          />
        );
      case 4:
        return (
          <BenefitsStep
            selectedBenefits={selectedBenefits}
            experienceRequired={experienceRequired}
            isSSE={isSSE}
            showSSE={formData.industry === "Agriculture"}
            onBenefitsChange={setSelectedBenefits}
            onExperienceChange={setExperienceRequired}
            onSSEChange={setIsSSE}
          />
        );
      case 5:
        return (
          <ScheduleStep
            scheduleType={scheduleType}
            shifts={shifts}
            fixedTermStart={fixedTermStart}
            fixedTermEnd={fixedTermEnd}
            weeklyHours={weeklyHours}
            onScheduleTypeChange={setScheduleType}
            onShiftsChange={setShifts}
            onFixedTermStartChange={setFixedTermStart}
            onFixedTermEndChange={setFixedTermEnd}
            onWeeklyHoursChange={setWeeklyHours}
          />
        );
      case 6:
        return (
          <ReviewStep
            formData={formData}
            physicalRequirements={physicalRequirements}
            requiresCar={requiresCar}
            selectedBenefits={selectedBenefits}
            experienceRequired={experienceRequired}
            isSSE={isSSE}
            skills={skills}
            scheduleType={scheduleType}
            shifts={shifts}
            fixedTermStart={fixedTermStart}
            fixedTermEnd={fixedTermEnd}
            onEditStep={setCurrentStep}
          />
        );
      default:
        return null;
    }
  };

  // Template confirmation view
  if (showTemplateConfirmation && templateJobId) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <Button variant="ghost" asChild className="mb-6">
            <Link to="/dashboard"><ArrowLeft className="w-4 h-4 mr-2" />Cancel and Back</Link>
          </Button>

          <TemplateConfirmation
            formData={formData}
            favorites={favorites}
            favoritesLoading={favoritesLoading}
            isSubmitting={isSubmitting}
            canPostJob={canPostJob}
            onPublish={() => handleSubmit("published")}
            onEditWizard={() => setShowTemplateConfirmation(false)}
            onOfferToWorker={handleOfferToWorker}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container-tight py-8">
        <Button variant="ghost" asChild className="mb-6">
          <Link to={templateJobId ? "#" : "/dashboard"} onClick={templateJobId ? (e) => { e.preventDefault(); setShowTemplateConfirmation(true); } : undefined}>
            <ArrowLeft className="w-4 h-4 mr-2" />{templateJobId ? "Back to Confirmation" : "Back to Dashboard"}
          </Link>
        </Button>

        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold font-display">
            {templateJobId ? "Edit Template Details" : "Post a Job"}
          </h1>
          {remainingPosts !== "unlimited" && (
            <span className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full">
              {remainingPosts} post{remainingPosts !== 1 ? "s" : ""} remaining
            </span>
          )}
        </div>
        <p className="text-muted-foreground mb-4">
          {templateJobId 
            ? "Edit the pre-filled details, then go back to confirm and post."
            : "Create a new job posting to find temporary workers."}
        </p>


        {/* Entitlement Warning */}
        {!canPostJob && entitlementError && (
          <div className={`mb-6 p-4 rounded-lg border flex items-start gap-3 ${
            entitlementErrorCode === "ERR_UNRESOLVED_PRIVATE_OFFER"
              ? "bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800"
              : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
          }`}>
            <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
              entitlementErrorCode === "ERR_UNRESOLVED_PRIVATE_OFFER"
                ? "text-purple-600 dark:text-purple-400"
                : "text-amber-600 dark:text-amber-400"
            }`} />
            <div>
              <p className={`font-medium ${
                entitlementErrorCode === "ERR_UNRESOLVED_PRIVATE_OFFER"
                  ? "text-purple-800 dark:text-purple-200"
                  : "text-amber-800 dark:text-amber-200"
              }`}>
                {entitlementErrorCode === "ERR_UNRESOLVED_PRIVATE_OFFER" ? "Pending Position Offer" : "Posting Limit Reached"}
              </p>
              <p className={`text-sm ${
                entitlementErrorCode === "ERR_UNRESOLVED_PRIVATE_OFFER"
                  ? "text-purple-700 dark:text-purple-300"
                  : "text-amber-700 dark:text-amber-300"
              }`}>{entitlementError}</p>
              {entitlementErrorCode !== "ERR_UNRESOLVED_PRIVATE_OFFER" && (
                <UpgradeButton size="sm" className="mt-3" />
              )}
              {entitlementErrorCode === "ERR_UNRESOLVED_PRIVATE_OFFER" && (
                <Button size="sm" variant="outline" className="mt-3" asChild>
                  <Link to="/contractor/jobs">View My Jobs</Link>
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Step Indicator */}
        <div className="mb-8">
          <StepIndicator
            steps={STEPS}
            currentStep={currentStep}
            onStepClick={handleStepClick}
          />
        </div>

        {/* Step Content */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            {renderStepContent()}
          </CardContent>
        </Card>

        {/* Navigation Buttons */}
        <div className="flex justify-between gap-4 pb-16">
          <div>
            {currentStep > 1 && (
              <Button type="button" variant="outline" onClick={handlePrevious}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Previous
              </Button>
            )}
          </div>

          <div className="flex gap-3 flex-wrap">
            {currentStep === STEPS.length ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleSubmit("draft")}
                  disabled={isSubmitting}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save as Draft
                </Button>
                {templateJobId && favorites.length > 0 && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => handleSubmit("private")}
                    disabled={isSubmitting || !canPostJob}
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <EyeOff className="w-4 h-4 mr-2" />
                    )}
                    Post as Private
                  </Button>
                )}
                <Button
                  type="button"
                  onClick={() => handleSubmit("published")}
                  disabled={isSubmitting || !canPostJob}
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Publish Job
                </Button>
              </>
            ) : (
              <Button type="button" onClick={handleNext}>
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
