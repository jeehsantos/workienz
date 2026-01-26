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
import { Loader2, ArrowLeft } from "lucide-react";

const INDUSTRIES = [
  "Agriculture",
  "Construction",
  "Education",
  "Entertainment",
  "Finance",
  "Food & Beverage",
  "Healthcare",
  "Hospitality",
  "IT & Technology",
  "Logistics & Transport",
  "Manufacturing",
  "Mining",
  "Real Estate",
  "Retail",
  "Tourism",
  "Other",
];

export default function ContractorProfile() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, isContractor } = useAuthContext();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [existingProfile, setExistingProfile] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    company_name: "",
    company_description: "",
    industry: "",
    website: "",
    city: "",
    suburb: "",
    country: "New Zealand",
    phone: "",
  });

  useEffect(() => {
    if (!authLoading && (!user || !isContractor())) {
      navigate("/auth");
    }
  }, [user, authLoading, isContractor, navigate]);

  useEffect(() => {
    async function fetchProfile() {
      if (!user) return;

      const { data, error } = await supabase
        .from("contractor_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching profile:", error);
      } else if (data) {
        setExistingProfile(data.id);
        setFormData({
          company_name: data.company_name || "",
          company_description: data.company_description || "",
          industry: data.industry || "",
          website: data.website || "",
          city: data.city || "",
          suburb: data.suburb || "",
          country: data.country || "New Zealand",
          phone: (data as any).phone || "",
        });
      }

      setIsLoading(false);
    }

    if (user && isContractor()) {
      fetchProfile();
    }
  }, [user, isContractor]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSaving(true);

    const profileData = {
      user_id: user.id,
      company_name: formData.company_name,
      company_description: formData.company_description || null,
      industry: formData.industry || null,
      website: formData.website || null,
      city: formData.city || null,
      suburb: formData.suburb || null,
      country: formData.country || null,
      phone: formData.phone || null,
    };

    let error;

    if (existingProfile) {
      const result = await supabase
        .from("contractor_profiles")
        .update(profileData)
        .eq("id", existingProfile);
      error = result.error;
    } else {
      const result = await supabase.from("contractor_profiles").insert(profileData);
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
      description: "Your contractor profile has been updated.",
    });

    // Enroll in free tier if this is a new profile
    if (!existingProfile) {
      try {
        await supabase.functions.invoke('enroll-free-tier');
      } catch (err) {
        console.error("Error enrolling in free tier:", err);
      }
    }

    navigate("/dashboard");
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container-tight py-8">
          <div className="space-y-6 max-w-2xl">
            <div className="space-y-2">
              <div className="h-8 w-48 bg-muted animate-pulse rounded" />
              <div className="h-4 w-64 bg-muted animate-pulse rounded" />
            </div>
            <div className="space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                  <div className="h-10 w-full bg-muted animate-pulse rounded-md" />
                </div>
              ))}
            </div>
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

        <h1 className="text-3xl font-bold mb-2 font-display">
          {existingProfile ? "Edit" : "Set Up"} Contractor Profile
        </h1>
        <p className="text-muted-foreground mb-8">
          {existingProfile
            ? "Update your company information."
            : "Complete your profile to start posting jobs."}
        </p>

        <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
          <div className="space-y-2">
            <Label htmlFor="company_name">Company Name *</Label>
            <Input
              id="company_name"
              value={formData.company_name}
              onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
              placeholder="Your company name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company_description">Company Description</Label>
            <Textarea
              id="company_description"
              value={formData.company_description}
              onChange={(e) => setFormData({ ...formData, company_description: e.target.value })}
              placeholder="Tell job seekers about your company..."
              rows={4}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Select
                value={formData.industry}
                onValueChange={(value) => setFormData({ ...formData, industry: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((industry) => (
                    <SelectItem key={industry} value={industry}>
                      {industry}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                placeholder="https://yourcompany.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Contact Phone</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="e.g., +64 9 123 4567"
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
