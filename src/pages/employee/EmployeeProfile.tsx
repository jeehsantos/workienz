import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, User, Briefcase, Settings, FileText, Save } from "lucide-react";
import { format } from "date-fns";
import { dispatchProfileUpdated } from "@/hooks/useProfileRefresh";

// Import tab components
import { BasicInfoTab } from "@/components/profile/tabs/BasicInfoTab";
import { ProfessionalTab } from "@/components/profile/tabs/ProfessionalTab";
import { WorkDetailsTab } from "@/components/profile/tabs/WorkDetailsTab";
import { CVBuilderTab } from "@/components/profile/tabs/CVBuilderTab";

export default function EmployeeProfile() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, isEmployee } = useAuthContext();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [existingProfile, setExistingProfile] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("basic");

  // All form state will be managed here and passed to child components
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
    ird_number: "",
  });

  const [dateOfBirth, setDateOfBirth] = useState<Date | undefined>();
  const [languages, setLanguages] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  
  const [comfortableHeavyLifting, setComfortableHeavyLifting] = useState(false);
  const [comfortableStanding, setComfortableStanding] = useState(false);
  const [hasCar, setHasCar] = useState(false);
  const [hasIrdNumber, setHasIrdNumber] = useState(false);

  // CV Builder states
  const [workExperience, setWorkExperience] = useState<any[]>([]);
  const [education, setEducation] = useState<any[]>([]);
  const [cvReferences, setCvReferences] = useState<any[]>([]);

  useEffect(() => {
    if (!authLoading && (!user || !isEmployee())) {
      navigate("/auth");
    }
  }, [user, authLoading, isEmployee, navigate]);

  useEffect(() => {
    async function fetchProfile() {
      if (!user) return;

      const [employeeResult, profileResult] = await Promise.all([
        supabase.from("employee_profiles").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("profiles").select("first_name, last_name").eq("user_id", user.id).maybeSingle()
      ]);

      if (employeeResult.data) {
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
          ird_number: (data as any).ird_number || "",
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
        // Load CV data if exists
        setWorkExperience((data as any).work_experience || []);
        setEducation((data as any).education || []);
        setCvReferences((data as any).cv_references || []);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validation
    if (!formData.first_name || !formData.last_name) {
      toast({
        title: "Required Fields Missing",
        description: "Please provide your first and last name.",
        variant: "destructive",
      });
      setActiveTab("basic");
      return;
    }

    if (!dateOfBirth || !formData.headline || !formData.bio || !formData.industry || !formData.visa_status || !formData.ird_number || !formData.phone) {
      toast({
        title: "Required Fields Missing",
        description: "Please complete all required fields marked with *",
        variant: "destructive",
      });
      return;
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
      ird_number: formData.ird_number,
      location_region: formData.location_region || null,
      comfortable_heavy_lifting: comfortableHeavyLifting,
      comfortable_standing: comfortableStanding,
      has_car: hasCar,
      has_ird_number: hasIrdNumber,
      work_experience: workExperience.length > 0 ? workExperience : null,
      education: education.length > 0 ? education : null,
      cv_references: cvReferences.length > 0 ? cvReferences : null,
    };

    let error;
    if (existingProfile) {
      const result = await supabase.from("employee_profiles").update(profileData).eq("id", existingProfile);
      error = result.error;
    } else {
      const result = await supabase.from("employee_profiles").insert(profileData);
      error = result.error;
    }

    if (!error) {
      const fullName = `${formData.first_name} ${formData.last_name}`.trim();
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ first_name: formData.first_name, last_name: formData.last_name, full_name: fullName })
        .eq("user_id", user.id);
      
      if (!profileError) {
        dispatchProfileUpdated();
      }
    }

    setIsSaving(false);

    if (error) {
      toast({ title: "Error", description: "Failed to save profile. Please try again.", variant: "destructive" });
      return;
    }

    toast({ title: "Profile Saved", description: "Your profile has been updated." });
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
      <div className="container-tight py-6 sm:py-8 pb-32">
        <Button variant="ghost" asChild className="mb-4 sm:mb-6">
          <Link to="/dashboard">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
        </Button>

        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2 font-display">
            {existingProfile ? "Edit" : "Set Up"} Your Profile
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            {existingProfile
              ? "Update your profile to help contractors find you."
              : "Complete your profile so contractors can find and contact you."}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto sm:h-10 mb-6">
              <TabsTrigger value="basic" className="text-xs sm:text-sm py-2 sm:py-1.5">
                <User className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Basic Info</span>
                <span className="sm:hidden">Basic</span>
              </TabsTrigger>
              <TabsTrigger value="professional" className="text-xs sm:text-sm py-2 sm:py-1.5">
                <Briefcase className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Professional</span>
                <span className="sm:hidden">Work</span>
              </TabsTrigger>
              <TabsTrigger value="details" className="text-xs sm:text-sm py-2 sm:py-1.5">
                <Settings className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Work Details</span>
                <span className="sm:hidden">Details</span>
              </TabsTrigger>
              <TabsTrigger value="cv" className="text-xs sm:text-sm py-2 sm:py-1.5">
                <FileText className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">CV Builder</span>
                <span className="sm:hidden">CV</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="mt-0">
              <BasicInfoTab
                formData={formData}
                setFormData={setFormData}
                dateOfBirth={dateOfBirth}
                setDateOfBirth={setDateOfBirth}
              />
            </TabsContent>

            <TabsContent value="professional" className="mt-0">
              <ProfessionalTab
                formData={formData}
                setFormData={setFormData}
                skills={skills}
                setSkills={setSkills}
                languages={languages}
                setLanguages={setLanguages}
              />
            </TabsContent>

            <TabsContent value="details" className="mt-0">
              <WorkDetailsTab
                formData={formData}
                setFormData={setFormData}
                comfortableHeavyLifting={comfortableHeavyLifting}
                setComfortableHeavyLifting={setComfortableHeavyLifting}
                comfortableStanding={comfortableStanding}
                setComfortableStanding={setComfortableStanding}
                hasCar={hasCar}
                setHasCar={setHasCar}
                hasIrdNumber={hasIrdNumber}
                setHasIrdNumber={setHasIrdNumber}
              />
            </TabsContent>

            <TabsContent value="cv" className="mt-0">
              <CVBuilderTab
                workExperience={workExperience}
                setWorkExperience={setWorkExperience}
                education={education}
                setEducation={setEducation}
                cvReferences={cvReferences}
                setCvReferences={setCvReferences}
              />
            </TabsContent>
          </Tabs>

          <Card className="p-4 sm:p-6 mt-6 sticky bottom-4 sm:bottom-6 bg-card/95 backdrop-blur-sm border-2">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <p className="text-xs sm:text-sm text-muted-foreground">
                Fields marked with * are required
              </p>
              <Button type="submit" disabled={isSaving} className="w-full sm:w-auto">
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <Save className="w-4 h-4 mr-2" />
                Save Profile
              </Button>
            </div>
          </Card>
        </form>
      </div>
    </div>
  );
}
