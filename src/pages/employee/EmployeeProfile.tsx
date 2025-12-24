import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Plus, X } from "lucide-react";

export default function EmployeeProfile() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, isEmployee } = useAuthContext();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [existingProfile, setExistingProfile] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    headline: "",
    city: "",
    suburb: "",
    country: "New Zealand",
    experience_years: "",
    hourly_rate_min: "",
    hourly_rate_max: "",
    availability: "flexible",
    is_available: true,
    phone: "",
  });

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

      const { data, error } = await supabase
        .from("employee_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching profile:", error);
      } else if (data) {
        setExistingProfile(data.id);
        setFormData({
          headline: data.headline || "",
          city: data.city || "",
          suburb: data.suburb || "",
          country: data.country || "New Zealand",
          experience_years: data.experience_years?.toString() || "",
          hourly_rate_min: data.hourly_rate_min?.toString() || "",
          hourly_rate_max: data.hourly_rate_max?.toString() || "",
          availability: data.availability || "flexible",
          is_available: data.is_available ?? true,
          phone: (data as any).phone || "",
        });
        setSkills(data.skills || []);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSaving(true);

    const profileData = {
      user_id: user.id,
      headline: formData.headline || null,
      city: formData.city || null,
      suburb: formData.suburb || null,
      country: formData.country || null,
      experience_years: formData.experience_years ? parseInt(formData.experience_years) : null,
      hourly_rate_min: formData.hourly_rate_min ? parseFloat(formData.hourly_rate_min) : null,
      hourly_rate_max: formData.hourly_rate_max ? parseFloat(formData.hourly_rate_max) : null,
      availability: formData.availability,
      is_available: formData.is_available,
      skills: skills.length > 0 ? skills : null,
      phone: formData.phone || null,
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

    navigate("/dashboard");
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

          <div className="space-y-2">
            <Label htmlFor="headline">Professional Headline</Label>
            <Input
              id="headline"
              value={formData.headline}
              onChange={(e) => setFormData({ ...formData, headline: e.target.value })}
              placeholder="e.g., Experienced Warehouse Worker"
            />
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

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="hourly_rate_min">Minimum Hourly Rate ($)</Label>
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
              <Label htmlFor="hourly_rate_max">Maximum Hourly Rate ($)</Label>
              <Input
                id="hourly_rate_max"
                type="number"
                step="0.01"
                value={formData.hourly_rate_max}
                onChange={(e) => setFormData({ ...formData, hourly_rate_max: e.target.value })}
                placeholder="e.g., 40.00"
              />
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
