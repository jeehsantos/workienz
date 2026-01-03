import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Edit, MapPin, Calendar, Briefcase, Phone, Globe, User } from "lucide-react";
import { format } from "date-fns";
import { useProfileRefreshListener } from "@/hooks/useProfileRefresh";

export default function ViewProfile() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, isEmployee } = useAuthContext();
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    if (!authLoading && (!user || !isEmployee())) {
      navigate("/auth");
    }
  }, [user, authLoading, isEmployee, navigate]);

  const fetchProfile = useCallback(async () => {
    if (!user) return;

    const { data: empProfile } = await supabase
      .from("employee_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: userProf } = await supabase
      .from("profiles")
      .select("full_name, email, avatar_url")
      .eq("user_id", user.id)
      .single();

    setProfile(empProfile);
    setUserProfile(userProf);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    if (user && isEmployee()) {
      fetchProfile();
    }
  }, [user, isEmployee, fetchProfile]);

  // Listen for profile updates and refetch
  useProfileRefreshListener(fetchProfile);
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
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
    <div className="min-h-screen bg-background">
      <div className="container-tight py-8">
        <Button variant="ghost" asChild className="mb-6">
          <Link to="/dashboard">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
        </Button>

        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold font-display">My Profile</h1>
          <Button asChild>
            <Link to="/employee/profile">
              <Edit className="w-4 h-4 mr-2" />
              Edit Profile
            </Link>
          </Button>
        </div>

        <div className="bg-card rounded-xl p-6 border border-border/50 space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-10 h-10 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">{userProfile?.full_name || "No name set"}</h2>
              {profile.headline && <p className="text-muted-foreground">{profile.headline}</p>}
              <Badge variant={profile.is_available ? "default" : "secondary"} className="mt-2">
                {profile.is_available ? "Available for work" : "Not available"}
              </Badge>
            </div>
          </div>

          {profile.bio && (
            <div>
              <h3 className="font-semibold mb-2">About Me</h3>
              <p className="text-muted-foreground whitespace-pre-wrap">{profile.bio}</p>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            {(profile.city || profile.country) && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="w-4 h-4" />
                {[profile.suburb, profile.city, profile.country].filter(Boolean).join(", ")}
              </div>
            )}
            {profile.industry && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Briefcase className="w-4 h-4" />
                {profile.industry}
              </div>
            )}
            {profile.experience_years !== null && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="w-4 h-4" />
                {profile.experience_years} years experience
              </div>
            )}
            {profile.phone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="w-4 h-4" />
                {profile.phone}
              </div>
            )}
            {profile.visa_status && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Globe className="w-4 h-4" />
                {profile.visa_status}
              </div>
            )}
            {profile.date_of_birth && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="w-4 h-4" />
                Born {format(new Date(profile.date_of_birth), "MMM d, yyyy")}
              </div>
            )}
          </div>

          {profile.languages?.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Languages</h3>
              <div className="flex flex-wrap gap-2">
                {profile.languages.map((lang: string) => (
                  <Badge key={lang} variant="secondary">{lang}</Badge>
                ))}
              </div>
            </div>
          )}

          {profile.skills?.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Skills</h3>
              <div className="flex flex-wrap gap-2">
                {profile.skills.map((skill: string) => (
                  <Badge key={skill} variant="outline">{skill}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
