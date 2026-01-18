import { useState, useEffect } from "react";
import { useNavigate, Link, useParams } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, ArrowRight, Save, Send } from "lucide-react";
import { format } from "date-fns";

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

export default function EditJob() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { user, isLoading: authLoading, isContractor } = useAuthContext();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [isLoadingJob, setIsLoadingJob] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [maxPositions, setMaxPositions] = useState(10);
  const [jobStatus, setJobStatus] = useState<string>("draft");

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

  // Auth check
  useEffect(() => {
    if (!authLoading && (!user || !isContractor())) {
      navigate("/auth");
    }
  }, [user, authLoading, isContractor, navigate]);

  // Fetch job data
  useEffect(() => {
    async function fetchJob() {
      if (!jobId || !user) return;

      // Verify contractor profile
      const { data: contractorProfile } = await supabase
        .from("contractor_profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!contractorProfile) {
        toast({ title: "Profile not found", description: "Please complete your contractor profile first.", variant: "destructive" });
        navigate("/contractor/profile");
        return;
      }

      // Fetch job data
      const { data: job, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", jobId)
        .eq("contractor_id", contractorProfile.id)
        .single();

      if (error || !job) {
        toast({ title: "Job not found", description: "This job could not be found or you don't have access to edit it.", variant: "destructive" });
        navigate("/contractor/jobs");
        return;
      }

      // Populate form with existing data
      setFormData({
        title: job.title || "",
        description: job.description || "",
        requirements: job.requirements || "",
        location_region: "",
        location_city: job.location_city || "",
        location_suburb: job.location_suburb || "",
        location_country: job.location_country || "New Zealand",
        job_type: job.job_type || "temporary",
        duration: job.duration || "",
        hourly_rate: job.hourly_rate_min?.toString() || "",
        positions_available: job.positions_available?.toString() || "1",
        industry: job.industry || "",
      });

      // Set physical requirements based on job data
      const physReqs: string[] = [];
      if (job.requires_heavy_lifting) physReqs.push("Requires lifting > 10kg");
      if (job.requires_standing) physReqs.push("Requires standing for long periods");
      setPhysicalRequirements(physReqs);
      
      setRequiresCar(job.requires_car || false);
      
      // Set benefits
      const benefits: string[] = [];
      if (job.provides_training) benefits.push("Provides training");
      if (job.provides_accommodation) benefits.push("Provides accommodation");
      setSelectedBenefits(benefits);

      setExperienceRequired(job.experience_required || false);
      setIsSSE((job as any).is_sse || false);
      setScheduleType(job.schedule_type === "fixed_term" ? "fixed_term" : "shifts");
      setSkills(job.skills_required || []);
      setJobStatus(job.status);
      setWeeklyHours((job as any).weekly_hours?.toString() || "");

      // Set wizard step
      if (job.wizard_step) {
        setCurrentStep(job.wizard_step);
      }

      if (job.starts_at) setFixedTermStart(new Date(job.starts_at));
      if (job.ends_at) setFixedTermEnd(new Date(job.ends_at));

      // Fetch shifts
      if (job.schedule_type === "shifts") {
        const { data: shiftsData } = await supabase
          .from("job_shifts")
          .select("*")
          .eq("job_id", jobId)
          .order("shift_date", { ascending: true });

        if (shiftsData && shiftsData.length > 0) {
          setShifts(shiftsData.map(s => ({
            id: s.id,
            date: new Date(s.shift_date),
            start_time: s.start_time,
            end_time: s.end_time,
            break_minutes: s.break_minutes?.toString() || "0",
            break_paid: s.break_paid || false,
          })));
        }
      }

      // Fetch max positions setting
      const { data: settings } = await supabase
        .from("platform_settings")
        .select("setting_value")
        .eq("setting_key", "max_positions_per_job")
        .maybeSingle();

      if (settings?.setting_value) {
        setMaxPositions(parseInt(settings.setting_value) || 10);
      }

      setIsLoadingJob(false);
    }

    if (user && isContractor()) fetchJob();
  }, [jobId, user, isContractor, toast, navigate]);

  const updateFormData = (updates: Partial<typeof formData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!formData.title || !formData.description || !formData.industry) {
          toast({ title: "Missing fields", description: "Please fill in all required fields.", variant: "destructive" });
          return false;
        }
        const positions = parseInt(formData.positions_available);
        if (positions > maxPositions) {
          toast({ title: "Too many positions", description: `Maximum ${maxPositions} positions allowed.`, variant: "destructive" });
          return false;
        }
        return true;
      case 2:
        if (!formData.location_city) {
          toast({ title: "Location required", description: "Please enter a city.", variant: "destructive" });
          return false;
        }
        return true;
      case 3:
      case 4:
        return true;
      case 5:
        if (scheduleType === "shifts") {
          const validShifts = shifts.filter(s => s.date && s.start_time && s.end_time);
          if (validShifts.length === 0) {
            toast({ title: "Schedule required", description: "Please add at least one shift.", variant: "destructive" });
            return false;
          }
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

  const handleSubmit = async (status: "draft" | "published") => {
    if (!jobId) return;

    // Validate for publishing
    if (status === "published") {
      if (!formData.hourly_rate) {
        toast({ title: "Hourly rate required", description: "Please enter an hourly rate.", variant: "destructive" });
        setCurrentStep(2);
        return;
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
      job_type: formData.job_type,
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

    // Call backend edge function for job update
    const { data, error } = await supabase.functions.invoke("create-job", {
      body: {
        jobData,
        status,
        shifts: validShifts,
        jobId, // Pass job ID for update
      },
    });

    setIsSubmitting(false);

    if (error) {
      console.error("Error updating job:", error);
      toast({ title: "Error", description: "Failed to update job posting. Please try again.", variant: "destructive" });
      return;
    }

    if (data?.error) {
      toast({ title: "Error", description: data.message || "Failed to update job.", variant: "destructive" });
      return;
    }

    toast({
      title: status === "published" ? "Job Published!" : "Draft Saved",
      description: status === "published" 
        ? "Your job posting is now live."
        : "Your job has been saved as a draft.",
    });
    navigate("/contractor/jobs");
  };

  if (authLoading || isLoadingJob) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
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

  const isDraft = jobStatus === "draft";

  return (
    <div className="min-h-screen bg-background">
      <div className="container-tight py-8">
        <Button variant="ghost" asChild className="mb-6">
          <Link to="/contractor/jobs"><ArrowLeft className="w-4 h-4 mr-2" />Back to My Jobs</Link>
        </Button>

        <h1 className="text-3xl font-bold mb-2 font-display">
          {isDraft ? "Complete Your Job Draft" : "Edit Job"}
        </h1>
        <p className="text-muted-foreground mb-8">
          {isDraft 
            ? "Complete the remaining steps to publish your job posting."
            : "Update your job posting details."
          }
        </p>

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

          <div className="flex gap-3">
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
                {isDraft && (
                  <Button
                    type="button"
                    onClick={() => handleSubmit("published")}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    Publish Job
                  </Button>
                )}
                {!isDraft && (
                  <Button
                    type="button"
                    onClick={() => handleSubmit("published")}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Save Changes
                  </Button>
                )}
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