import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Plus, X, FileText, ArrowRight, Save } from "lucide-react";
import { FormalCVSections } from "@/components/profile/FormalCVSections";
import type { WorkExperience, Education, CVReference } from "@/types/employeeProfile";
import { format } from "date-fns";
import { dispatchProfileUpdated } from "@/hooks/useProfileRefresh";
import { DatePicker } from "@/components/ui/date-picker";
import { NZ_REGIONS, getCitiesByRegion, getSuburbsByCity } from "@/data/nzRegions";
import { StepIndicator } from "@/components/jobs/StepIndicator";

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

/**
 * Available visa status options for New Zealand immigration categories
 */
const VISA_STATUSES = [
  "New Zealand Citizen",
  "Permanent Resident",
  "Accredited Employer Work Visa (AEWV)",
  "Essential Skills Work Visa",
  "Post Study Work Visa",
  "Working Holiday Visa",
  "Partner of a Work Visa Holder",
  "Skilled Migrant Category Resident Visa",
  "Refugee/Protected Person",
  "Student Visa (with work rights)",
  "Visitor Visa (with work rights)",
  "Other",
];

/**
 * Wizard steps configuration for the employee profile form
 * Defines the order and labels of steps in the wizard interface
 */
const STEPS = [
  { id: 1, title: "Identity" },
  { id: 2, title: "Professional" },
  { id: 3, title: "Compliance" },
  { id: 4, title: "Skills" },
  { id: 5, title: "Preferences" },
  { id: 6, title: "Enhanced CV" },
];

export default function EmployeeProfile() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, isEmployee } = useAuthContext();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [existingProfile, setExistingProfile] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    headline: "",
    bio: "",
    location_region: "",
    location_city: "",
    location_suburb: "",
    country: "New Zealand",
    experience_years: "",
    availability: "flexible",
    is_available: true,
    phone: "",
    industry: "",
    visa_status: "",
  });

  const [comfortableHeavyLifting, setComfortableHeavyLifting] = useState(false);
  const [comfortableStanding, setComfortableStanding] = useState(false);
  const [hasCar, setHasCar] = useState(false);
  const [hasIrdNumber, setHasIrdNumber] = useState(false);

  const [dateOfBirth, setDateOfBirth] = useState<Date | undefined>();
  const [languages, setLanguages] = useState<string[]>([]);
  const [languageInput, setLanguageInput] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");

  const [enableFormalCv, setEnableFormalCv] = useState(false);
  const [workExperience, setWorkExperience] = useState<WorkExperience[]>([]);
  const [education, setEducation] = useState<Education[]>([]);
  const [cvReferences, setCvReferences] = useState<CVReference[]>([]);

  const availableCities = formData.location_region ? getCitiesByRegion(formData.location_region) : [];
  const availableSuburbs = formData.location_region && formData.location_city 
    ? getSuburbsByCity(formData.location_region, formData.location_city) : [];

  /**
   * Validates the current step before allowing navigation
   * @param step - The step number to validate
   * @returns boolean indicating if the step is valid
   */
  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1: // Identity
        if (!formData.first_name || !formData.last_name) {
          toast({
            title: "Required Fields Missing",
            description: "Please provide your first and last name.",
            variant: "destructive",
          });
          return false;
        }
        if (!dateOfBirth) {
          toast({
            title: "Required Field Missing",
            description: "Please provide your date of birth.",
            variant: "destructive",
          });
          return false;
        }
        return true;
      case 2: // Professional
        if (!formData.headline) {
          toast({
            title: "Required Field Missing",
            description: "Please provide a professional headline.",
            variant: "destructive",
          });
          return false;
        }
        if (!formData.bio) {
          toast({
            title: "Required Field Missing",
            description: "Please provide an 'About Me' description.",
            variant: "destructive",
          });
          return false;
        }
        if (!formData.industry) {
          toast({
            title: "Required Field Missing",
            description: "Please select your preferred industry.",
            variant: "destructive",
          });
          return false;
        }
        return true;
      case 3: // Compliance & Contact
        if (!formData.visa_status) {
          toast({
            title: "Required Field Missing",
            description: "Please select your visa status.",
            variant: "destructive",
          });
          return false;
        }
        if (!formData.phone) {
          toast({
            title: "Required Field Missing",
            description: "Please provide your phone number.",
            variant: "destructive",
          });
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  /**
   * Handles navigation to the next step
   */
  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, STEPS.length));
    }
  };

  /**
   * Handles navigation to the previous step
   */
  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  /**
   * Handles clicking on a step indicator
   * @param step - The step number to navigate to
   */
  const handleStepClick = (step: number) => {
    if (step <= currentStep) {
      setCurrentStep(step);
    }
  };

  useEffect(() => {
    if (!authLoading && (!user || !isEmployee())) {
      navigate("/auth");
    }
  }, [user, authLoading, isEmployee, navigate]);

  useEffect(() => {
    async function fetchProfile() {
      if (!user) return;

      const [employeeResult, profileResult] = await Promise.all([
        supabase
          .from("employee_profiles")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("user_id", user.id)
          .maybeSingle()
      ]);

      if (employeeResult.error) {
        console.error("Error fetching profile:", employeeResult.error);
      } else if (employeeResult.data) {
        const data = employeeResult.data;
        setExistingProfile(data.id);
        setFormData({
          first_name: profileResult.data?.first_name || "",
          last_name: profileResult.data?.last_name || "",
          headline: data.headline || "",
          bio: (data as any).bio || "",
          location_region: (data as any).location_region || "",
          location_city: data.city || "",
          location_suburb: data.suburb || "",
          country: data.country || "New Zealand",
          experience_years: data.experience_years?.toString() || "",
          availability: data.availability || "flexible",
          is_available: data.is_available ?? true,
          phone: (data as any).phone || "",
          industry: (data as any).industry || "",
          visa_status: (data as any).visa_status || "",
        });
        setSkills(data.skills || []);
        setLanguages((data as any).languages || []);
        setComfortableHeavyLifting((data as any).comfortable_heavy_lifting || false);
        setComfortableStanding((data as any).comfortable_standing || false);
        setHasCar((data as any).has_car || false);
        setHasIrdNumber((data as any).has_ird_number || false);
        setEnableFormalCv((data as any).enable_formal_cv || false);
        setWorkExperience((data as any).work_experience || []);
        setEducation((data as any).education || []);
        setCvReferences((data as any).cv_references || []);
        if ((data as any).date_of_birth) {
          setDateOfBirth(new Date((data as any).date_of_birth));
        }
      } else if (profileResult.data) {
        setFormData(prev => ({
          ...prev,
          first_name: profileResult.data?.first_name || "",
          last_name: profileResult.data?.last_name || "",
        }));
      }

      setIsLoading(false);
    }

    if (user && isEmployee()) {
      fetchProfile();
    }
  }, [user, isEmployee]);

  /**
   * Adds a new skill to the skills array if it's not already present
   * Clears the skill input field after adding
   */
  const addSkill = () => {
    if (skillInput.trim() && !skills.includes(skillInput.trim())) {
      setSkills([...skills, skillInput.trim()]);
      setSkillInput("");
    }
  };

  /**
   * Removes a skill from the skills array
   * @param skill - The skill to remove
   */
  const removeSkill = (skill: string) => {
    setSkills(skills.filter((s) => s !== skill));
  };

  /**
   * Adds a new language to the languages array if it's not already present
   * Clears the language input field after adding
   */
  const addLanguage = () => {
    if (languageInput.trim() && !languages.includes(languageInput.trim())) {
      setLanguages([...languages, languageInput.trim()]);
      setLanguageInput("");
    }
  };

  /**
   * Removes a language from the languages array
   * @param lang - The language to remove
   */
  const removeLanguage = (lang: string) => {
    setLanguages(languages.filter((l) => l !== lang));
  };

  /**
   * Handles form submission and saves the employee profile
   * Validates all required fields and updates both employee_profiles and profiles tables
   * @param e - The form submission event
   */
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user) return;

    // Validate all steps
    for (let step = 1; step <= 3; step++) {
      if (!validateStep(step)) {
        setCurrentStep(step);
        return;
      }
    }

    setIsSaving(true);

    const profileData = {
      user_id: user.id,
      headline: formData.headline,
      bio: formData.bio,
      city: formData.location_city || null,
      suburb: formData.location_suburb || null,
      country: formData.country,
      experience_years: formData.experience_years ? parseInt(formData.experience_years) : null,
      availability: formData.availability,
      is_available: formData.is_available,
      skills: skills.length > 0 ? skills : null,
      phone: formData.phone,
      industry: formData.industry,
      languages: languages.length > 0 ? languages : null,
      date_of_birth: format(dateOfBirth, "yyyy-MM-dd"),
      visa_status: formData.visa_status,
      location_region: formData.location_region || null,
      comfortable_heavy_lifting: comfortableHeavyLifting,
      comfortable_standing: comfortableStanding,
      has_car: hasCar,
      has_ird_number: hasIrdNumber,
      enable_formal_cv: enableFormalCv,
      work_experience: JSON.parse(JSON.stringify(workExperience)),
      education: JSON.parse(JSON.stringify(education)),
      cv_references: JSON.parse(JSON.stringify(cvReferences)),
    };

    let error;

    if (existingProfile) {
      const result = await supabase
        .from("employee_profiles")
        .update(profileData as any)
        .eq("id", existingProfile);
      error = result.error;
    } else {
      const result = await supabase.from("employee_profiles").insert(profileData as any);
      error = result.error;
    }

    if (!error) {
      const fullName = `${formData.first_name} ${formData.last_name}`.trim();
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          first_name: formData.first_name,
          last_name: formData.last_name,
          full_name: fullName,
        })
        .eq("user_id", user.id);
      
      if (profileError) {
        console.error("Error updating profile names:", profileError);
      } else {
        dispatchProfileUpdated();
      }
    }

    setIsSaving(false);

    if (error) {
      console.error("Error saving profile:", error);
      toast({
        title: "Error",
        description: "Failed to save profile. Please try again.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Profile Saved",
      description: "Your profile has been updated.",
    });

    navigate("/employee/view-profile");
  };

  /**
   * Renders the content for the current step
   */
  const renderStepContent = () => {
    switch (currentStep) {
      case 1: // Identity
        return (
          <div className="space-y-6">
            {/* Availability Toggle */}
            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
              <div>
                <Label htmlFor="is_available">Available for Work</Label>
                <p className="text-sm text-muted-foreground">
                  Show your profile to contractors looking for workers
                </p>
              </div>
              <Switch
                id="is_available"
                checked={formData.is_available}
                onCheckedChange={(checked) => setFormData({ ...formData, is_available: checked })}
              />
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Personal Information</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name *</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    placeholder="e.g., John"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name *</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    placeholder="e.g., Doe"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Date of Birth *</Label>
                <DatePicker
                  value={dateOfBirth}
                  onChange={setDateOfBirth}
                  placeholder="Select your date of birth"
                  disabledDates={(date) => date > new Date() || date < new Date("1940-01-01")}
                />
              </div>
            </div>
          </div>
        );

      case 2: // Professional
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Professional Information</h3>
            <div className="space-y-2">
              <Label htmlFor="headline">Professional Headline *</Label>
              <Input
                id="headline"
                value={formData.headline}
                onChange={(e) => setFormData({ ...formData, headline: e.target.value })}
                placeholder="e.g., Experienced Warehouse Worker"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">About Me *</Label>
              <Textarea
                id="bio"
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                placeholder="Share a short introduction about yourself, your background, and what you're looking for..."
                rows={4}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="industry">Preferred Industry *</Label>
              <Select
                value={formData.industry}
                onValueChange={(value) => setFormData({ ...formData, industry: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select your preferred industry" />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4}>
                  {INDUSTRIES.map((ind) => (
                    <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="experience_years">Years of Experience</Label>
                <Input
                  id="experience_years"
                  type="number"
                  min="0"
                  value={formData.experience_years}
                  onChange={(e) => setFormData({ ...formData, experience_years: e.target.value })}
                  placeholder="e.g., 5"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="availability">Availability</Label>
                <Select
                  value={formData.availability}
                  onValueChange={(value) => setFormData({ ...formData, availability: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
                    <SelectItem value="immediate">Immediate</SelectItem>
                    <SelectItem value="1-week">Within 1 Week</SelectItem>
                    <SelectItem value="2-weeks">Within 2 Weeks</SelectItem>
                    <SelectItem value="flexible">Flexible</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        );

      case 3: // Compliance & Contact
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Compliance & Contact</h3>
            <div className="space-y-2">
              <Label htmlFor="visa_status">Visa Status *</Label>
              <Select
                value={formData.visa_status}
                onValueChange={(value) => setFormData({ ...formData, visa_status: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select visa status" />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4} className="max-h-[300px]">
                  {VISA_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number *</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="e.g., +64 21 123 4567"
                required
              />
              <p className="text-xs text-muted-foreground">For employers to contact you</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={formData.country}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Region</Label>
                <Select
                  value={formData.location_region}
                  onValueChange={(v) => setFormData({ ...formData, location_region: v, location_city: "", location_suburb: "" })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select region" />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4} className="max-h-[300px]">
                    {NZ_REGIONS.map((r) => (
                      <SelectItem key={r.region} value={r.region}>{r.region}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>City</Label>
                <Select
                  value={formData.location_city}
                  onValueChange={(v) => setFormData({ ...formData, location_city: v, location_suburb: "" })}
                  disabled={!formData.location_region}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formData.location_region ? "Select city" : "Select region first"} />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4} className="max-h-[300px]">
                    {availableCities.map((city) => (
                      <SelectItem key={city} value={city}>{city}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Suburb</Label>
                <Select
                  value={formData.location_suburb}
                  onValueChange={(v) => setFormData({ ...formData, location_suburb: v })}
                  disabled={!formData.location_city}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formData.location_city ? "Select suburb" : "Select city first"} />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4} className="max-h-[300px]">
                    {availableSuburbs.map((suburb) => (
                      <SelectItem key={suburb} value={suburb}>{suburb}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        );

      case 4: // Skills & Languages
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Skills & Languages</h3>
            <div className="space-y-2">
              <Label>Languages</Label>
              <div className="flex gap-2">
                <Input
                  value={languageInput}
                  onChange={(e) => setLanguageInput(e.target.value)}
                  placeholder="Add a language..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addLanguage();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={addLanguage}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {languages.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {languages.map((lang) => (
                    <span
                      key={lang}
                      className="px-3 py-1 bg-secondary text-secondary-foreground rounded-full text-sm flex items-center gap-1"
                    >
                      {lang}
                      <button type="button" onClick={() => removeLanguage(lang)}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Skills</Label>
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
          </div>
        );

      case 5: // Work Preferences
        return (
          <div className="space-y-4">
            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-1">Work Preferences & Status</h3>
              <p className="text-sm text-muted-foreground">
                Help employers find the right match by sharing your preferences
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                <div>
                  <Label htmlFor="comfortable_heavy_lifting" className="font-normal">Comfortable with Heavy Lifting</Label>
                  <p className="text-xs text-muted-foreground">Can lift {'>'} 10kg</p>
                </div>
                <Switch
                  id="comfortable_heavy_lifting"
                  checked={comfortableHeavyLifting}
                  onCheckedChange={setComfortableHeavyLifting}
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                <div>
                  <Label htmlFor="comfortable_standing" className="font-normal">Comfortable Standing</Label>
                  <p className="text-xs text-muted-foreground">For long periods</p>
                </div>
                <Switch
                  id="comfortable_standing"
                  checked={comfortableStanding}
                  onCheckedChange={setComfortableStanding}
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                <div>
                  <Label htmlFor="has_car" className="font-normal">Has Car</Label>
                  <p className="text-xs text-muted-foreground">Own transport available</p>
                </div>
                <Switch
                  id="has_car"
                  checked={hasCar}
                  onCheckedChange={setHasCar}
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                <div>
                  <Label htmlFor="has_ird_number" className="font-normal">Has IRD Number</Label>
                  <p className="text-xs text-muted-foreground">Tax number ready</p>
                </div>
                <Switch
                  id="has_ird_number"
                  checked={hasIrdNumber}
                  onCheckedChange={setHasIrdNumber}
                />
              </div>
            </div>
          </div>
        );

      case 6: // Enhanced CV
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/20">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="text-lg font-semibold">Enhanced CV Details</h3>
                  <p className="text-sm text-muted-foreground">
                    Enable to add detailed work experience, education, and references for a professional CV
                  </p>
                </div>
              </div>
              <Switch
                id="enable_formal_cv"
                checked={enableFormalCv}
                onCheckedChange={setEnableFormalCv}
              />
            </div>

            {enableFormalCv && (
              <div className="mt-6 pt-4 border-t border-border/50">
                <FormalCVSections
                  workExperience={workExperience}
                  education={education}
                  cvReferences={cvReferences}
                  onWorkExperienceChange={setWorkExperience}
                  onEducationChange={setEducation}
                  onReferencesChange={setCvReferences}
                />
              </div>
            )}
          </div>
        );

      default:
        return null;
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

        <h1 className="text-3xl font-bold mb-2 font-display">
          {existingProfile ? "Edit" : "Set Up"} Your Profile
        </h1>
        <p className="text-muted-foreground mb-8">
          {existingProfile
            ? "Update your profile to help contractors find you."
            : "Complete your profile so contractors can find and contact you."}
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
              <Button
                type="button"
                onClick={() => handleSubmit()}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Profile
              </Button>
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
