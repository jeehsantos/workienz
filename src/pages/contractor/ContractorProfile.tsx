import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Building2, Globe, MapPin, Phone, Briefcase, FileText, Save } from "lucide-react";
import { ContractorLogoUpload } from "@/components/contractor/ContractorLogoUpload";
import { PreEmploymentFileUpload } from "@/components/contractor/PreEmploymentFileUpload";
import { useContractorUploadPermission } from "@/hooks/useContractorUploadPermission";

const INDUSTRIES = [
  "Agriculture", "Construction", "Education", "Entertainment", "Finance",
  "Food & Beverage", "Healthcare", "Hospitality", "IT & Technology",
  "Logistics & Transport", "Manufacturing", "Mining", "Real Estate",
  "Retail", "Tourism", "Other",
];

export default function ContractorProfile() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, isContractor } = useAuthContext();
  const { toast } = useToast();
  const uploadPermission = useContractorUploadPermission(user?.id);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [existingProfile, setExistingProfile] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    company_name: "",
    company_description: "",
    industry: "",
    website: "",
    city: "",
    suburb: "",
    country: "New Zealand",
    phone: "",
    pre_employment_file_url: "",
    pre_employment_file_name: "",
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
        setAvatarUrl(data.avatar_url || null);
        setFormData({
          company_name: data.company_name || "",
          company_description: data.company_description || "",
          industry: data.industry || "",
          website: data.website || "",
          city: data.city || "",
          suburb: data.suburb || "",
          country: data.country || "New Zealand",
          phone: data.phone || "",
          pre_employment_file_url: (data as any).pre_employment_file_url || "",
          pre_employment_file_name: (data as any).pre_employment_file_name || "",
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
      pre_employment_file_url: formData.pre_employment_file_url || null,
      pre_employment_file_name: formData.pre_employment_file_name || null,
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

    if (!existingProfile) {
      try {
        await supabase.functions.invoke('enroll-free-tier');
      } catch (err) {
        console.error("Error enrolling in free tier:", err);
      }
    }

    navigate("/dashboard");
  };

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container-tight py-6 sm:py-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 sm:mb-8">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold font-display">
              {existingProfile ? "Company Profile" : "Set Up Your Profile"}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {existingProfile
                ? "Manage your company details and hiring preferences."
                : "Complete your profile to start posting jobs."}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left column - Logo & Identity */}
            <div className="lg:col-span-1 space-y-6">
              <Card className="shadow-soft">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-primary" />
                    Company Logo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ContractorLogoUpload
                    userId={user?.id || ""}
                    currentAvatarUrl={avatarUrl}
                    companyName={formData.company_name}
                    onUploadComplete={(url) => setAvatarUrl(url)}
                    canUpload={uploadPermission.canUpload}
                    isPartner={uploadPermission.isPartner}
                  />
                </CardContent>
              </Card>

              {/* Pre-Employment Pack */}
              <Card className="shadow-soft">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    Pre-Employment Pack
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Upload a PDF or Word document to send to candidates once they are hired.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PreEmploymentFileUpload
                    userId={user?.id || ""}
                    currentFileUrl={formData.pre_employment_file_url || null}
                    currentFileName={formData.pre_employment_file_name || null}
                    onUploadComplete={(url, name) => {
                      setFormData((prev) => ({
                        ...prev,
                        pre_employment_file_url: url,
                        pre_employment_file_name: name,
                      }));
                    }}
                    onRemove={() => {
                      setFormData((prev) => ({
                        ...prev,
                        pre_employment_file_url: "",
                        pre_employment_file_name: "",
                      }));
                    }}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Right column - Details */}
            <div className="lg:col-span-2 space-y-6">
              {/* Company Info */}
              <Card className="shadow-soft">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-primary" />
                    Company Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="company_name">Company Name *</Label>
                    <Input
                      id="company_name"
                      value={formData.company_name}
                      onChange={(e) => updateField("company_name", e.target.value)}
                      placeholder="Your company name"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="company_description">About Your Company</Label>
                    <Textarea
                      id="company_description"
                      value={formData.company_description}
                      onChange={(e) => updateField("company_description", e.target.value)}
                      placeholder="Tell job seekers about your company, culture, and what makes you a great employer..."
                      rows={4}
                      className="resize-none"
                    />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="industry">Industry</Label>
                      <Select
                        value={formData.industry}
                        onValueChange={(value) => updateField("industry", value)}
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
                      <Label htmlFor="website" className="flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                        Website
                      </Label>
                      <Input
                        id="website"
                        type="url"
                        value={formData.website}
                        onChange={(e) => updateField("website", e.target.value)}
                        placeholder="https://yourcompany.co.nz"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Contact & Location */}
              <Card className="shadow-soft">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    Contact & Location
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                      Contact Phone
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => updateField("phone", e.target.value)}
                      placeholder="e.g., +64 9 123 4567"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="country">Country</Label>
                      <Input
                        id="country"
                        value={formData.country}
                        onChange={(e) => updateField("country", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={formData.city}
                        onChange={(e) => updateField("city", e.target.value)}
                        placeholder="e.g., Auckland"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="suburb">Suburb</Label>
                      <Input
                        id="suburb"
                        value={formData.suburb}
                        onChange={(e) => updateField("suburb", e.target.value)}
                        placeholder="e.g., Ponsonby"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Save */}
              <div className="flex justify-end">
                <Button type="submit" disabled={isSaving} size="lg" className="min-w-[160px]">
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  {isSaving ? "Saving..." : "Save Profile"}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
