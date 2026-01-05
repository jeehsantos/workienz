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
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Plus, X, Dumbbell, Gift, Car, GraduationCap, Home, MapPin, Clock } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { NZ_REGIONS, getCitiesByRegion, getSuburbsByCity } from "@/data/nzRegions";
import { TimePicker } from "@/components/ui/time-picker";
import { DatePicker } from "@/components/ui/date-picker";

type Shift = {
  id: string;
  date: Date | undefined;
  start_time: string;
  end_time: string;
  break_minutes: string;
  break_paid: boolean;
};

const INDUSTRIES = [
  "Agriculture", "Construction", "Education", "Events & Hospitality",
  "Food & Beverage", "Healthcare", "Logistics & Warehousing",
  "Manufacturing", "Office & Admin", "Retail", "Transportation", "Other",
];

const DEFAULT_BENEFITS = ["Provides training", "Provides accommodation"];
const DEFAULT_PHYSICAL_REQS = ["Requires lifting > 10kg", "Requires standing for long periods"];

export default function PostJob() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, isContractor } = useAuthContext();
  const { toast } = useToast();

  const [contractorProfile, setContractorProfile] = useState<{ id: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  const [formData, setFormData] = useState({
    title: "", description: "", requirements: "",
    location_region: "", location_city: "", location_suburb: "",
    location_country: "New Zealand", job_type: "temporary",
    duration: "", hourly_rate: "", positions_available: "1", industry: "",
  });

  // Physical requirements (checkboxes)
  const [physicalRequirements, setPhysicalRequirements] = useState<string[]>([]);
  const [customPhysicalReq, setCustomPhysicalReq] = useState("");
  const [allPhysicalReqs, setAllPhysicalReqs] = useState<string[]>(DEFAULT_PHYSICAL_REQS);

  // Logistical requirement
  const [requiresCar, setRequiresCar] = useState(false);

  // Benefits (checkboxes)
  const [selectedBenefits, setSelectedBenefits] = useState<string[]>([]);
  const [customBenefit, setCustomBenefit] = useState("");
  const [allBenefits, setAllBenefits] = useState<string[]>(DEFAULT_BENEFITS);

  const [experienceRequired, setExperienceRequired] = useState(false);
  const [isSSE, setIsSSE] = useState(false);
  const [scheduleType, setScheduleType] = useState<"shifts" | "fixed_term">("shifts");
  
  const [shifts, setShifts] = useState<Shift[]>([
    { id: crypto.randomUUID(), date: undefined, start_time: "", end_time: "", break_minutes: "0", break_paid: false }
  ]);
  const [fixedTermStart, setFixedTermStart] = useState<Date | undefined>();
  const [fixedTermEnd, setFixedTermEnd] = useState<Date | undefined>();

  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");

  // Available cities and suburbs based on selection
  const availableCities = formData.location_region ? getCitiesByRegion(formData.location_region) : [];
  const availableSuburbs = formData.location_region && formData.location_city 
    ? getSuburbsByCity(formData.location_region, formData.location_city) : [];


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
        toast({ title: "Profile not found", description: "Please complete your contractor profile first.", variant: "destructive" });
        return;
      }
      setContractorProfile(data);
      setIsLoadingProfile(false);
    }
    if (user && isContractor()) fetchContractorProfile();
  }, [user, isContractor, toast]);

  const addShift = () => {
    setShifts([...shifts, { id: crypto.randomUUID(), date: undefined, start_time: "", end_time: "", break_minutes: "0", break_paid: false }]);
  };

  const removeShift = (id: string) => {
    if (shifts.length > 1) setShifts(shifts.filter(s => s.id !== id));
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

  const removeSkill = (skill: string) => setSkills(skills.filter(s => s !== skill));

  const addCustomPhysicalReq = () => {
    if (customPhysicalReq.trim() && !allPhysicalReqs.includes(customPhysicalReq.trim())) {
      const newReq = customPhysicalReq.trim();
      setAllPhysicalReqs([...allPhysicalReqs, newReq]);
      setPhysicalRequirements([...physicalRequirements, newReq]);
      setCustomPhysicalReq("");
    }
  };

  const addCustomBenefit = () => {
    if (customBenefit.trim() && !allBenefits.includes(customBenefit.trim())) {
      const newBenefit = customBenefit.trim();
      setAllBenefits([...allBenefits, newBenefit]);
      setSelectedBenefits([...selectedBenefits, newBenefit]);
      setCustomBenefit("");
    }
  };

  const togglePhysicalReq = (req: string) => {
    setPhysicalRequirements(prev => 
      prev.includes(req) ? prev.filter(r => r !== req) : [...prev, req]
    );
  };

  const toggleBenefit = (benefit: string) => {
    setSelectedBenefits(prev => 
      prev.includes(benefit) ? prev.filter(b => b !== benefit) : [...prev, benefit]
    );
  };

  const calculateDuration = () => {
    if (fixedTermStart && fixedTermEnd) {
      const diffTime = Math.abs(fixedTermEnd.getTime() - fixedTermStart.getTime());
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent, status: "draft" | "published") => {
    e.preventDefault();
    if (!contractorProfile) return;

    // Validation
    if (status === "published") {
      if (!formData.hourly_rate) {
        toast({ title: "Hourly rate required", description: "Please enter an hourly rate.", variant: "destructive" });
        return;
      }
      if (!formData.location_region || !formData.location_city) {
        toast({ title: "Location required", description: "Please select a region and city.", variant: "destructive" });
        return;
      }
      if (scheduleType === "shifts") {
        const validShifts = shifts.filter(s => s.date && s.start_time && s.end_time);
        if (validShifts.length === 0) {
          toast({ title: "Please add at least one shift", description: "Add shift details before publishing.", variant: "destructive" });
          return;
        }
      } else if (!fixedTermStart) {
        toast({ title: "Please select a start date", description: "A start date is required for fixed term jobs.", variant: "destructive" });
        return;
      }
    }

    setIsSubmitting(true);

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
      hourly_rate_min: formData.hourly_rate ? parseFloat(formData.hourly_rate) : null,
      hourly_rate_max: null,
      skills_required: skills.length > 0 ? skills : null,
      positions_available: parseInt(formData.positions_available) || 1,
      status,
      industry: formData.industry || null,
      schedule_type: scheduleType,
      starts_at: fixedTermStart ? fixedTermStart.toISOString() : null,
      ends_at: fixedTermEnd ? fixedTermEnd.toISOString() : null,
      experience_required: experienceRequired,
      is_sse: isSSE && formData.industry === "Agriculture",
      requires_heavy_lifting: physicalRequirements.includes("Requires lifting > 10kg"),
      requires_standing: physicalRequirements.includes("Requires standing for long periods"),
      requires_car: requiresCar,
      provides_training: selectedBenefits.includes("Provides training"),
      provides_accommodation: selectedBenefits.includes("Provides accommodation"),
    }).select("id").single();

    if (error || !jobData) {
      console.error("Error creating job:", error);
      toast({ title: "Error", description: "Failed to create job posting. Please try again.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

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
      description: status === "published" ? "Your job posting is now live." : "Your job has been saved as a draft.",
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
            <p className="text-muted-foreground mb-6">You need to set up your contractor profile before posting jobs.</p>
            <Button asChild><Link to="/contractor/profile">Set Up Profile</Link></Button>
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
          <Link to="/dashboard"><ArrowLeft className="w-4 h-4 mr-2" />Back to Dashboard</Link>
        </Button>

        <h1 className="text-3xl font-bold mb-2 font-display">Post a Job</h1>
        <p className="text-muted-foreground mb-8">Create a new job posting to find temporary workers.</p>

        <form onSubmit={(e) => handleSubmit(e, "published")} className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                  <CardDescription>Essential details about the job</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Job Title *</Label>
                    <Input id="title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="e.g., Warehouse Assistant" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Job Description *</Label>
                    <Textarea id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Describe the role, responsibilities..." rows={5} required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Industry *</Label>
                      <Select value={formData.industry} onValueChange={(v) => setFormData({ ...formData, industry: v })}>
                        <SelectTrigger><SelectValue placeholder="Select industry" /></SelectTrigger>
                        <SelectContent position="popper" sideOffset={4}>
                          {INDUSTRIES.map((ind) => (<SelectItem key={ind} value={ind}>{ind}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Job Type</Label>
                      <Select value={formData.job_type} onValueChange={(v) => setFormData({ ...formData, job_type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent position="popper" sideOffset={4}>
                          <SelectItem value="temporary">Temporary</SelectItem>
                          <SelectItem value="short-term">Short-term</SelectItem>
                          <SelectItem value="contract">Contract</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Positions Available *</Label>
                    <Input type="number" min="1" value={formData.positions_available} onChange={(e) => setFormData({ ...formData, positions_available: e.target.value })} required />
                  </div>
                </CardContent>
              </Card>

              {/* Physical Requirements */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Dumbbell className="w-5 h-5" />Physical Requirements</CardTitle>
                  <CardDescription>Select physical demands for this role</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {allPhysicalReqs.map((req) => (
                    <div key={req} className="flex items-center space-x-2">
                      <Checkbox id={`req-${req}`} checked={physicalRequirements.includes(req)} onCheckedChange={() => togglePhysicalReq(req)} />
                      <Label htmlFor={`req-${req}`} className="font-normal cursor-pointer">{req}</Label>
                    </div>
                  ))}
                  <div className="flex gap-2 pt-2">
                    <Input value={customPhysicalReq} onChange={(e) => setCustomPhysicalReq(e.target.value)} placeholder="Add custom requirement..." className="flex-1" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomPhysicalReq(); }}} />
                    <Button type="button" variant="outline" size="icon" onClick={addCustomPhysicalReq}><Plus className="w-4 h-4" /></Button>
                  </div>
                </CardContent>
              </Card>

              {/* Logistical Requirements */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Car className="w-5 h-5" />Logistical Requirements</CardTitle>
                  <CardDescription>Transport and logistics needs</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="requires_car" checked={requiresCar} onCheckedChange={(c) => setRequiresCar(c as boolean)} />
                    <Label htmlFor="requires_car" className="font-normal cursor-pointer">Requires own vehicle/car</Label>
                  </div>
                </CardContent>
              </Card>

              {/* Job Benefits */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Gift className="w-5 h-5" />Job Benefits</CardTitle>
                  <CardDescription>What benefits do you offer?</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {allBenefits.map((benefit) => (
                    <div key={benefit} className="flex items-center space-x-2">
                      <Checkbox id={`benefit-${benefit}`} checked={selectedBenefits.includes(benefit)} onCheckedChange={() => toggleBenefit(benefit)} />
                      <Label htmlFor={`benefit-${benefit}`} className="font-normal cursor-pointer flex items-center gap-1">
                        {benefit === "Provides training" && <GraduationCap className="w-4 h-4" />}
                        {benefit === "Provides accommodation" && <Home className="w-4 h-4" />}
                        {benefit}
                      </Label>
                    </div>
                  ))}
                  <div className="flex gap-2 pt-2">
                    <Input value={customBenefit} onChange={(e) => setCustomBenefit(e.target.value)} placeholder="Add custom benefit..." className="flex-1" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomBenefit(); }}} />
                    <Button type="button" variant="outline" size="icon" onClick={addCustomBenefit}><Plus className="w-4 h-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            </div>


            {/* Right Column */}
            <div className="space-y-6">
              {/* Location & Pay */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><MapPin className="w-5 h-5" />Location & Pay</CardTitle>
                  <CardDescription>Where the job is and compensation</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Region *</Label>
                    <Select value={formData.location_region} onValueChange={(v) => setFormData({ ...formData, location_region: v, location_city: "", location_suburb: "" })}>
                      <SelectTrigger><SelectValue placeholder="Select region" /></SelectTrigger>
                      <SelectContent position="popper" sideOffset={4} className="max-h-[300px]">
                        {NZ_REGIONS.map((r) => (<SelectItem key={r.region} value={r.region}>{r.region}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>City *</Label>
                    <Select value={formData.location_city} onValueChange={(v) => setFormData({ ...formData, location_city: v, location_suburb: "" })} disabled={!formData.location_region}>
                      <SelectTrigger><SelectValue placeholder={formData.location_region ? "Select city" : "Select region first"} /></SelectTrigger>
                      <SelectContent position="popper" sideOffset={4} className="max-h-[300px]">
                        {availableCities.map((city) => (<SelectItem key={city} value={city}>{city}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Suburb *</Label>
                    <Select value={formData.location_suburb} onValueChange={(v) => setFormData({ ...formData, location_suburb: v })} disabled={!formData.location_city}>
                      <SelectTrigger><SelectValue placeholder={formData.location_city ? "Select suburb" : "Select city first"} /></SelectTrigger>
                      <SelectContent position="popper" sideOffset={4} className="max-h-[300px]">
                        {availableSuburbs.map((suburb) => (<SelectItem key={suburb} value={suburb}>{suburb}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Hourly Rate ($/hr) *</Label>
                    <Input type="number" step="0.01" min="0" value={formData.hourly_rate} onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })} placeholder="e.g., 25.00" required />
                  </div>
                </CardContent>
              </Card>

              {/* Additional Details */}
              <Card>
                <CardHeader><CardTitle>Additional Details</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Requirements</Label>
                    <Textarea value={formData.requirements} onChange={(e) => setFormData({ ...formData, requirements: e.target.value })} placeholder="List any specific requirements..." rows={3} />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <Label className="font-normal">Experience Required</Label>
                      <p className="text-xs text-muted-foreground">Only experienced workers can apply</p>
                    </div>
                    <Switch checked={experienceRequired} onCheckedChange={setExperienceRequired} />
                  </div>
                  {formData.industry === "Agriculture" && (
                    <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                      <div>
                        <Label className="font-normal text-amber-700 dark:text-amber-400">SSE Position</Label>
                        <p className="text-xs text-muted-foreground">For RSE/SSE workers</p>
                      </div>
                      <Switch checked={isSSE} onCheckedChange={setIsSSE} />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Skills Required</Label>
                    <div className="flex gap-2">
                      <Input value={skillInput} onChange={(e) => setSkillInput(e.target.value)} placeholder="Add a skill..." onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); }}} />
                      <Button type="button" variant="outline" size="icon" onClick={addSkill}><Plus className="w-4 h-4" /></Button>
                    </div>
                    {skills.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {skills.map((skill) => (
                          <span key={skill} className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm flex items-center gap-1">
                            {skill}
                            <button type="button" onClick={() => removeSkill(skill)}><X className="w-3 h-3" /></button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Schedule */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5" />Schedule</CardTitle>
                  <CardDescription>When do you need workers?</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <RadioGroup value={scheduleType} onValueChange={(v: "shifts" | "fixed_term") => setScheduleType(v)} className="flex gap-4">
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
                              <Button type="button" variant="ghost" size="sm" onClick={() => removeShift(shift.id)}><X className="w-4 h-4" /></Button>
                            )}
                          </div>
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Date *</Label>
                              <DatePicker
                                value={shift.date}
                                onChange={(date) => updateShift(shift.id, "date", date)}
                                placeholder="Select date"
                                disabledDates={(date) => date < new Date()}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label className="text-xs">Start Time *</Label>
                                <TimePicker 
                                  value={shift.start_time} 
                                  onChange={(value) => updateShift(shift.id, "start_time", value)} 
                                  placeholder="Start time"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">End Time *</Label>
                                <TimePicker 
                                  value={shift.end_time} 
                                  onChange={(value) => updateShift(shift.id, "end_time", value)} 
                                  placeholder="End time"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label className="text-xs">Break (min)</Label>
                                <Input type="number" min="0" value={shift.break_minutes} onChange={(e) => updateShift(shift.id, "break_minutes", e.target.value)} />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Break Paid?</Label>
                                <Select value={shift.break_paid ? "yes" : "no"} onValueChange={(v) => updateShift(shift.id, "break_paid", v === "yes")}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent position="popper" sideOffset={4}>
                                    <SelectItem value="no">No</SelectItem>
                                    <SelectItem value="yes">Yes</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      <Button type="button" variant="outline" onClick={addShift} className="w-full">
                        <Plus className="w-4 h-4 mr-2" />Add Another Shift
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Start Date *</Label>
                          <DatePicker
                            value={fixedTermStart}
                            onChange={setFixedTermStart}
                            placeholder="Select start"
                            disabledDates={(date) => date < new Date()}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>End Date</Label>
                          <DatePicker
                            value={fixedTermEnd}
                            onChange={setFixedTermEnd}
                            placeholder="Select end"
                            disabledDates={(date) => date < new Date() || (fixedTermStart ? date < fixedTermStart : false)}
                          />
                        </div>
                      </div>
                      {durationDays && <p className="text-sm text-muted-foreground">Duration: {durationDays} day{durationDays !== 1 ? 's' : ''}</p>}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4 pb-32">
            <Button type="button" variant="outline" onClick={(e) => handleSubmit(e as any, "draft")} disabled={isSubmitting}>Save as Draft</Button>
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
