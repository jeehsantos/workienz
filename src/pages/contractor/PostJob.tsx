import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Plus, X } from "lucide-react";

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
  });

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

  const addSkill = () => {
    if (skillInput.trim() && !skills.includes(skillInput.trim())) {
      setSkills([...skills, skillInput.trim()]);
      setSkillInput("");
    }
  };

  const removeSkill = (skill: string) => {
    setSkills(skills.filter((s) => s !== skill));
  };

  const handleSubmit = async (e: React.FormEvent, status: "draft" | "published") => {
    e.preventDefault();
    if (!contractorProfile) return;

    setIsSubmitting(true);

    const { error } = await supabase.from("jobs").insert({
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
      status,
    });

    setIsSubmitting(false);

    if (error) {
      console.error("Error creating job:", error);
      toast({
        title: "Error",
        description: "Failed to create job posting. Please try again.",
        variant: "destructive",
      });
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

          <div className="grid sm:grid-cols-2 gap-4">
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

            <div className="space-y-2">
              <Label htmlFor="duration">Duration</Label>
              <Input
                id="duration"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                placeholder="e.g., 2 weeks, 1 month"
              />
            </div>
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
              <Label htmlFor="hourly_rate_min">Hourly Rate Min ($)</Label>
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
              <Label htmlFor="hourly_rate_max">Hourly Rate Max ($)</Label>
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
            <Label>Required Skills</Label>
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
              onClick={(e) => handleSubmit(e, "draft")}
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
