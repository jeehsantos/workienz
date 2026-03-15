import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Edit, Printer } from "lucide-react";
import { useProfileRefreshListener } from "@/hooks/useProfileRefresh";
import { SocialProfileView } from "@/components/profile/SocialProfileView";
import { FormalCVView } from "@/components/profile/FormalCVView";
import { ProfileViewToggle } from "@/components/profile/ProfileViewToggle";
import { SkeletonProfile } from "@/components/ui/skeleton-components";
import type { EmployeeProfileData, ProfileViewMode } from "@/types/employeeProfile";

export default function ViewProfile() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isLoading: authLoading, isEmployee } = useAuthContext();
  const [isLoading, setIsLoading] = useState(true);
  const [profileData, setProfileData] = useState<EmployeeProfileData | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<string | undefined>(undefined);
  
  // Get view mode from URL or default to 'social'
  const viewMode = (searchParams.get('view') as ProfileViewMode) || 'social';

  const handleModeChange = (mode: ProfileViewMode) => {
    setSearchParams({ view: mode });
  };

  useEffect(() => {
    if (!authLoading && (!user || !isEmployee())) {
      navigate("/auth");
    }
  }, [user, authLoading, isEmployee, navigate]);

  const fetchProfile = useCallback(async () => {
    if (!user) return;

    const { data: empProfile } = await supabase
      .from("employee_profiles")
      .select("*, work_verification_status")
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: userProf } = await supabase
      .from("profiles")
      .select("full_name, first_name, last_name, email, avatar_url")
      .eq("user_id", user.id)
      .single();

    if (empProfile && userProf) {
      // Transform to centralized profile schema
      const transformedProfile: EmployeeProfileData = {
        fullName: userProf.full_name || `${userProf.first_name || ''} ${userProf.last_name || ''}`.trim(),
        firstName: userProf.first_name || '',
        lastName: userProf.last_name || '',
        email: userProf.email || user.email || '',
        avatarUrl: userProf.avatar_url,
        dateOfBirth: (empProfile as any).date_of_birth,
        professionalTitle: empProfile.headline || '',
        bio: (empProfile as any).bio || '',
        industry: (empProfile as any).industry || '',
        experienceYears: empProfile.experience_years,
        availability: empProfile.availability || 'flexible',
        isAvailable: empProfile.is_available ?? true,
        phone: (empProfile as any).phone || '',
        country: empProfile.country || 'New Zealand',
        region: (empProfile as any).location_region || '',
        city: empProfile.city || '',
        suburb: empProfile.suburb || '',
        skills: empProfile.skills || [],
        languages: (empProfile as any).languages || [],
        visaStatus: (empProfile as any).visa_status || '',
        comfortableHeavyLifting: (empProfile as any).comfortable_heavy_lifting || false,
        comfortableStanding: (empProfile as any).comfortable_standing || false,
        hasCar: (empProfile as any).has_car || false,
        hasIrdNumber: (empProfile as any).has_ird_number || false,
        enableFormalCv: (empProfile as any).enable_formal_cv || false,
        workExperience: (empProfile as any).work_experience || [],
        education: (empProfile as any).education || [],
        cvReferences: (empProfile as any).cv_references || [],
      };
      setProfileData(transformedProfile);
      setVerificationStatus(empProfile.work_verification_status || "unverified");
    }

    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    if (user && isEmployee()) {
      fetchProfile();
    }
  }, [user, isEmployee, fetchProfile]);

  // Listen for profile updates and refetch
  useProfileRefreshListener(fetchProfile);

  const handlePrint = () => {
    // Add print class to body for better print styling control
    document.body.classList.add('printing-cv');
    window.print();
    // Remove class after print dialog closes
    setTimeout(() => {
      document.body.classList.remove('printing-cv');
    }, 100);
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container-tight py-8">
          <div className="mb-6">
            <div className="h-10 w-32 bg-muted animate-pulse rounded" />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div className="h-9 w-48 bg-muted animate-pulse rounded" />
            <div className="h-10 w-32 bg-muted animate-pulse rounded" />
          </div>
          <SkeletonProfile showCover={false} showBio={true} showStats={true} />
        </div>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container-tight py-8">
          <div className="text-center py-16">
            <h1 className="text-2xl font-bold mb-4">Complete Your Profile</h1>
            <p className="text-muted-foreground mb-6">Set up your profile to start applying for jobs.</p>
            <Button asChild>
              <Link to="/employee/profile">Set Up Profile</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background print:bg-white print:min-h-0">
      <div className="container-tight py-8 print:p-0 print:max-w-none">
        {/* Navigation - Hidden on print */}
        <div className="print:hidden">
          <Button variant="ghost" asChild className="mb-6">
            <Link to="/dashboard">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>

          {/* Header with Toggle and Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <h1 className="text-3xl font-bold font-display">My Profile</h1>
              <ProfileViewToggle mode={viewMode} onModeChange={handleModeChange} />
            </div>
            
            <div className="flex items-center gap-2">
              {viewMode === 'formal' && (
                <div className="flex flex-col items-end gap-1">
                  <Button variant="outline" onClick={handlePrint}>
                    <Printer className="w-4 h-4 mr-2" />
                    Print to PDF
                  </Button>
                </div>
              )}
              <Button asChild>
                <Link to="/employee/profile">
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Profile
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Profile Views */}
        {viewMode === 'social' ? (
          <SocialProfileView profile={profileData} verificationStatus={verificationStatus} />
        ) : (
          <FormalCVView profile={profileData} />
        )}
      </div>
    </div>
  );
}
