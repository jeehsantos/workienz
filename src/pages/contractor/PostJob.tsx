import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Plus, X, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type Shift = {
  id: string;
  date: Date | undefined;
  start_time: string;
  end_time: string;
  break_minutes: string;
  break_paid: boolean;
};

const INDUSTRIES = [
  "Agriculture",
  "Construction",
  "Education",
  "Events & Hospitality",
  "Food & Beverage",
  "Healthcare",
  "Logistics & Warehousing",
  "Manufacturing",
  "Office & Admin",
  "Retail",
  "Transportation",
  "Other",
];

export default function PostJob() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, isContractor } = useAuthContext();
  const { toast } = useToast();

  const [contractorProfile, setContractorProfile] = useState<{ id: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    requirements: "",
    location_city: "",
    location_suburb: "",
    location_country: "New Zealand",
    job_type: "temporary",
    duration: "",
    hourly_rate_min: "",
    hourly_rate_max: "",
    positions_available: "1",
    industry: "",
  });

  const [experienceRequired, setExperienceRequired] = useState(false);
  const [scheduleType, setScheduleType] = useState<"shifts" | "fixed_term">("shifts");
  
  // Shifts state
  const [shifts, setShifts] = useState<Shift[]>([
    { id: crypto.randomUUID(), date: undefined, start_time: "", end_time: "", break_minutes: "0", break_paid: false }
  ]);

  // Fixed term state - simple start and end dates
  const [fixedTermStart, setFixedTermStart] = useState<Date | undefined>();
  const [fixedTermEnd, setFixedTermEnd] = useState<Date | undefined>();

  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");

  useEffect(() => {
    if (!authLoading && (!user || !isContractor())) {
      navigate("/auth");
    }
  }, [user, authLoading, isContractor, navigate]);

  useEffect(() => {
    async function fetchContractorProfile() {
      if (!user) return;

      const { data, error } = await supabase
        .from("contractor_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching contractor profile:", error);
        toast({
          title: "Profile not found",
          description: "Please complete your contractor profile first.",
          variant: "destructive",
        });
        return;
      }

      setContractorProfile(data);
      setIsLoadingProfile(false);
    }

    if (user && isContractor()) {
      fetchContractorProfile();
    }
  }, [user, isContractor, toast]);

  const addShift = () => {
    setShifts([...shifts, { id: crypto.randomUUID(), date: undefined, start_time: "", end_time: "", break_minutes: "0", break_paid: false }]);
  };

  const removeShift = (id: string) => {
    if (shifts.length > 1) {
      setShifts(shifts.filter(s => s.id !== id));
    }
  };

  const updateShift = (id: string, field: keyof Shift, value: any) => {
    setShifts(shifts.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const addSkill = () => {
    if (skillInput.trim() && !skills.includes(skillInput.trim())) {
      setSkills([...skills, skillInput.trim()]);
      setSkillInput("");
    }
  };

  const removeSkill = (skill: string) => {
    setSkills(skills.filter((s) => s !== skill));
  };

  const calculateDuration = () => {
    if (fixedTermStart && fixedTermEnd) {
      const diffTime = Math.abs(fixedTermEnd.getTime() - fixedTermStart.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return diffDays;
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent, status: "draft" | "published") => {
    e.preventDefault();
    if (!contractorProfile) return;

    // Validate schedule
    if (scheduleType === "shifts") {
      const validShifts = shifts.filter(s => s.date && s.start_time && s.end_time);
      if (validShifts.length === 0 && status === "published") {
        toast({
          title: "Please add at least one shift",
          description: "Add shift details before publishing.",
          variant: "destructive",
        });
        return;
      }
    } else {
      if (!fixedTermStart && status === "published") {
        toast({
          title: "Please select a start date",
          description: "A start date is required for fixed term jobs.",
          variant: "destructive",
        });
        return;
      }
    }

    setIsSubmitting(true);

    // Insert job
    const { data: jobData, error } = await supabase.from("jobs").insert({
      contractor_id: contractorProfile.id,
      title: formData.title,
      description: formData.description,
      requirements: formData.requirements || null,
      location_city: formData.location_city || null,
      location_suburb: formData.location_suburb || null,
      location_country: formData.location_country || null,
      job_type: formData.job_type,
      duration: formData.duration || null,
      hourly_rate_min: formData.hourly_rate_min ? parseFloat(formData.hourly_rate_min) : null,
      hourly_rate_max: formData.hourly_rate_max ? parseFloat(formData.hourly_rate_max) : null,
      skills_required: skills.length > 0 ? skills : null,
      positions_available: parseInt(formData.positions_available) || 1,
      status,
      industry: formData.industry || null,
      schedule_type: scheduleType,
      starts_at: fixedTermStart ? fixedTermStart.toISOString() : null,
      ends_at: fixedTermEnd ? fixedTermEnd.toISOString() : null,
      experience_required: experienceRequired,
    }).select("id").single();

    if (error || !jobData) {
      console.error("Error creating job:", error);
      toast({
        title: "Error",
        description: "Failed to create job posting. Please try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    // Insert shifts if schedule type is shifts
    if (scheduleType === "shifts") {
      const validShifts = shifts.filter(s => s.date && s.start_time && s.end_time);
      if (validShifts.length > 0) {
        const shiftsData = validShifts.map(s => ({
          job_id: jobData.id,
          shift_date: format(s.date!, "yyyy-MM-dd"),
          start_time: s.start_time,
          end_time: s.end_time,
          break_minutes: parseInt(s.break_minutes) || 0,
          break_paid: s.break_paid,
        }));
        
        await supabase.from("job_shifts").insert(shiftsData);
      }
    }

    setIsSubmitting(false);

    toast({
      title: status === "published" ? "Job Published!" : "Draft Saved",
      description: status === "published" 
        ? "Your job posting is now live."
        : "Your job has been saved as a draft.",
    });

    navigate("/contractor/jobs");
  };

  if (authLoading || isLoadingProfile) {
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
            <p className="text-muted-foreground mb-6">
              You need to set up your contractor profile before posting jobs.
            </p>
            <Button asChild>
              <Link to="/contractor/profile">Set Up Profile</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const durationDays = calculateDuration();

  return (
    <div className="min-h-screen bg-background">
      <div className="container-tight py-8">
        <Button variant="ghost" asChild className="mb-6">
          <Link to="/dashboard">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
        </Button>

        <h1 className="text-3xl font-bold mb-2 font-display">Post a Job</h1>
        <p className="text-muted-foreground mb-8">
          Create a new job posting to find temporary workers.
        </p>

        <form onSubmit={(e) => handleSubmit(e, "published")} className="space-y-6 max-w-2xl">
          <div className="space-y-2">
            <Label htmlFor="title">Job Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Warehouse Assistant"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Job Description *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the role, responsibilities, and what you're looking for..."
              rows={5}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="requirements">Requirements</Label>
            <Textarea
              id="requirements"
              value={formData.requirements}
              onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
              placeholder="List any specific requirements or qualifications..."
              rows={3}
            />
          </div>

          {/* Experience Required Toggle */}
          <div className="flex items-center justify-between p-4 bg-card rounded-lg border border-border/50">
            <div>
              <Label htmlFor="experience_required">Experience Required</Label>
              <p className="text-sm text-muted-foreground">
                Only job seekers with experience in this industry can apply
              </p>
            </div>
            <Switch
              id="experience_required"
              checked={experienceRequired}
              onCheckedChange={setExperienceRequired}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="industry">Industry *</Label>
              <Select
                value={formData.industry}
                onValueChange={(value) => setFormData({ ...formData, industry: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((ind) => (
                    <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="job_type">Job Type</Label>
              <Select
                value={formData.job_type}
                onValueChange={(value) => setFormData({ ...formData, job_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="temporary">Temporary</SelectItem>
                  <SelectItem value="short-term">Short-term</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="duration">Duration</Label>
              <Input
                id="duration"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                placeholder="e.g., 2 weeks, 1 month"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="positions_available">Positions Available *</Label>
              <Input
                id="positions_available"
                type="number"
                min="1"
                value={formData.positions_available}
                onChange={(e) => setFormData({ ...formData, positions_available: e.target.value })}
                required
              />
            </div>
          </div>

          {/* Schedule Type Section */}
          <div className="space-y-4 p-4 bg-card rounded-lg border border-border/50">
            <Label className="text-base font-semibold">Schedule Type *</Label>
            <RadioGroup
              value={scheduleType}
              onValueChange={(value: "shifts" | "fixed_term") => setScheduleType(value)}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="shifts" id="shifts" />
                <Label htmlFor="shifts" className="font-normal cursor-pointer">Shifts</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="fixed_term" id="fixed_term" />
                <Label htmlFor="fixed_term" className="font-normal cursor-pointer">Fixed Term</Label>
              </div>
            </RadioGroup>

            {scheduleType === "shifts" ? (
              <div className="space-y-4">
                {shifts.map((shift, index) => (
                  <div key={shift.id} className="p-4 bg-muted/50 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Shift {index + 1}</span>
                      {shifts.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeShift(shift.id)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Date *</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !shift.date && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {shift.date ? format(shift.date, "PPP") : "Select date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={shift.date}
                              onSelect={(date) => updateShift(shift.id, "date", date)}
                              disabled={(date) => date < new Date()}
                              initialFocus
                              className="pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Start Time *</Label>
                          <Input
                            type="time"
                            value={shift.start_time}
                            onChange={(e) => updateShift(shift.id, "start_time", e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">End Time *</Label>
                          <Input
                            type="time"
                            value={shift.end_time}
                            onChange={(e) => updateShift(shift.id, "end_time", e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Break (minutes)</Label>
                        <Input
                          type="number"
                          min="0"
                          value={shift.break_minutes}
                          onChange={(e) => updateShift(shift.id, "break_minutes", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Break Paid?</Label>
                        <Select
                          value={shift.break_paid ? "yes" : "no"}
                          onValueChange={(value) => updateShift(shift.id, "break_paid", value === "yes")}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="no">No</SelectItem>
                            <SelectItem value="yes">Yes</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))}
                
                <Button type="button" variant="outline" onClick={addShift} className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Another Shift
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Date *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !fixedTermStart && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {fixedTermStart ? format(fixedTermStart, "PPP") : "Select start date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={fixedTermStart}
                          onSelect={setFixedTermStart}
                          disabled={(date) => date < new Date()}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>End Date (Optional)</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !fixedTermEnd && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {fixedTermEnd ? format(fixedTermEnd, "PPP") : "Select end date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={fixedTermEnd}
                          onSelect={setFixedTermEnd}
                          disabled={(date) => date < new Date() || (fixedTermStart && date < fixedTermStart)}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                
                {durationDays && (
                  <p className="text-sm text-muted-foreground">
                    Total duration: {durationDays} day{durationDays !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="location_country">Country</Label>
              <Input
                id="location_country"
                value={formData.location_country}
                onChange={(e) => setFormData({ ...formData, location_country: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location_city">City</Label>
              <Input
                id="location_city"
                value={formData.location_city}
                onChange={(e) => setFormData({ ...formData, location_city: e.target.value })}
                placeholder="e.g., Auckland"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location_suburb">Suburb</Label>
              <Input
                id="location_suburb"
                value={formData.location_suburb}
                onChange={(e) => setFormData({ ...formData, location_suburb: e.target.value })}
                placeholder="e.g., Ponsonby"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="hourly_rate_min">Minimum Rate ($/hr)</Label>
              <Input
                id="hourly_rate_min"
                type="number"
                step="0.01"
                value={formData.hourly_rate_min}
                onChange={(e) => setFormData({ ...formData, hourly_rate_min: e.target.value })}
                placeholder="e.g., 25.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hourly_rate_max">Maximum Rate ($/hr)</Label>
              <Input
                id="hourly_rate_max"
                type="number"
                step="0.01"
                value={formData.hourly_rate_max}
                onChange={(e) => setFormData({ ...formData, hourly_rate_max: e.target.value })}
                placeholder="e.g., 35.00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Skills Required</Label>
            <div className="flex gap-2">
              <Input
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                placeholder="Add a skill..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSkill();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={addSkill}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {skills.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {skills.map((skill) => (
                  <span
                    key={skill}
                    className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm flex items-center gap-1"
                  >
                    {skill}
                    <button type="button" onClick={() => removeSkill(skill)}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-4 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={(e) => handleSubmit(e as any, "draft")}
              disabled={isSubmitting}
            >
              Save as Draft
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Publish Job
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}