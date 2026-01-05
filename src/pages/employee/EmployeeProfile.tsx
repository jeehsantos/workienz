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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Plus, X, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { dispatchProfileUpdated } from "@/hooks/useProfileRefresh";

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

const VISA_STATUSES = [
  "Citizen",
  "Permanent Resident",
  "Work Visa",
  "Student Visa",
  "Working Holiday Visa",
  "Partner of a Work Visa Holder",
  "Other",
];

export default function EmployeeProfile() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, isEmployee } = useAuthContext();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [existingProfile, setExistingProfile] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    headline: "",
    bio: "",
    city: "",
    suburb: "",
    country: "New Zealand",
    experience_years: "",
    availability: "flexible",
    is_available: true,
    phone: "",
    industry: "",
    visa_status: "",
  });

  // New preference states
  const [comfortableHeavyLifting, setComfortableHeavyLifting] = useState(false);
  const [comfortableStanding, setComfortableStanding] = useState(false);
  const [hasCar, setHasCar] = useState(false);
  const [hasIrdNumber, setHasIrdNumber] = useState(false);

  const [dateOfBirth, setDateOfBirth] = useState<Date | undefined>();
  const [languages, setLanguages] = useState<string[]>([]);
  const [languageInput, setLanguageInput] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");

  useEffect(() => {
    if (!authLoading && (!user || !isEmployee())) {
      navigate("/auth");
    }
  }, [user, authLoading, isEmployee, navigate]);

  useEffect(() => {
    async function fetchProfile() {
      if (!user) return;

      // Fetch both employee profile and user profile
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
          city: data.city || "",
          suburb: data.suburb || "",
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
        if ((data as any).date_of_birth) {
          setDateOfBirth(new Date((data as any).date_of_birth));
        }
      } else {
        // No employee profile yet, but get names from user profile
        if (profileResult.data) {
          setFormData(prev => ({
            ...prev,
            first_name: profileResult.data?.first_name || "",
            last_name: profileResult.data?.last_name || "",
          }));
        }
      }

      setIsLoading(false);
    }

    if (user && isEmployee()) {
      fetchProfile();
    }
  }, [user, isEmployee]);

  const addSkill = () => {
    if (skillInput.trim() && !skills.includes(skillInput.trim())) {
      setSkills([...skills, skillInput.trim()]);
      setSkillInput("");
    }
  };

  const removeSkill = (skill: string) => {
    setSkills(skills.filter((s) => s !== skill));
  };

  const addLanguage = () => {
    if (languageInput.trim() && !languages.includes(languageInput.trim())) {
      setLanguages([...languages, languageInput.trim()]);
      setLanguageInput("");
    }
  };

  const removeLanguage = (lang: string) => {
    setLanguages(languages.filter((l) => l !== lang));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSaving(true);

    const profileData = {
      user_id: user.id,
      headline: formData.headline || null,
      bio: formData.bio || null,
      city: formData.city || null,
      suburb: formData.suburb || null,
      country: formData.country || null,
      experience_years: formData.experience_years ? parseInt(formData.experience_years) : null,
      availability: formData.availability,
      is_available: formData.is_available,
      skills: skills.length > 0 ? skills : null,
      phone: formData.phone || null,
      industry: formData.industry || null,
      languages: languages.length > 0 ? languages : null,
      date_of_birth: dateOfBirth ? format(dateOfBirth, "yyyy-MM-dd") : null,
      visa_status: formData.visa_status || null,
      comfortable_heavy_lifting: comfortableHeavyLifting,
      comfortable_standing: comfortableStanding,
      has_car: hasCar,
      has_ird_number: hasIrdNumber,
    };

    let error;

    if (existingProfile) {
      const result = await supabase
        .from("employee_profiles")
        .update(profileData)
        .eq("id", existingProfile);
      error = result.error;
    } else {
      const result = await supabase.from("employee_profiles").insert(profileData);
      error = result.error;
    }

    // Also update the profiles table with first_name, last_name, and full_name
    if (!error) {
      const fullName = `${formData.first_name || ''} ${formData.last_name || ''}`.trim();
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          first_name: formData.first_name || null,
          last_name: formData.last_name || null,
          full_name: fullName || null,
        })
        .eq("user_id", user.id);
      
      if (profileError) {
        console.error("Error updating profile names:", profileError);
      } else {
        // Dispatch event to refresh navbar
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

        <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
          <div className="flex items-center justify-between p-4 bg-card rounded-lg border border-border/50">
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

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name</Label>
              <Input
                id="first_name"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                placeholder="e.g., John"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name</Label>
              <Input
                id="last_name"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                placeholder="e.g., Doe"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="headline">Professional Headline</Label>
            <Input
              id="headline"
              value={formData.headline}
              onChange={(e) => setFormData({ ...formData, headline: e.target.value })}
              placeholder="e.g., Experienced Warehouse Worker"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">About Me</Label>
            <Textarea
              id="bio"
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              placeholder="Share a short introduction about yourself, your background, and what you're looking for..."
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="industry">Preferred Industry</Label>
            <Select
              value={formData.industry}
              onValueChange={(value) => setFormData({ ...formData, industry: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select your preferred industry" />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRIES.map((ind) => (
                  <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Select the industry you'd like to work in
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date of Birth</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateOfBirth && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateOfBirth ? format(dateOfBirth, "PPP") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateOfBirth}
                    onSelect={setDateOfBirth}
                    disabled={(date) => date > new Date() || date < new Date("1940-01-01")}
                    initialFocus
                    className="pointer-events-auto"
                    captionLayout="dropdown-buttons"
                    fromYear={1940}
                    toYear={new Date().getFullYear()}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="visa_status">Visa Status</Label>
              <Select
                value={formData.visa_status}
                onValueChange={(value) => setFormData({ ...formData, visa_status: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select visa status" />
                </SelectTrigger>
                <SelectContent>
                  {VISA_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="e.g., Auckland"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="suburb">Suburb</Label>
              <Input
                id="suburb"
                value={formData.suburb}
                onChange={(e) => setFormData({ ...formData, suburb: e.target.value })}
                placeholder="e.g., Ponsonby"
              />
            </div>
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
                <SelectContent>
                  <SelectItem value="immediate">Immediate</SelectItem>
                  <SelectItem value="1-week">Within 1 Week</SelectItem>
                  <SelectItem value="2-weeks">Within 2 Weeks</SelectItem>
                  <SelectItem value="flexible">Flexible</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number (for employers to contact you)</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="e.g., +64 21 123 4567"
            />
          </div>

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

          {/* Work Preferences & Status Section */}
          <div className="space-y-4 p-6 bg-card rounded-lg border border-border/50">
            <div>
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

          <div className="pt-4">
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Profile
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}