import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { 
  MapPin, 
  Calendar, 
  Briefcase, 
  Phone, 
  Globe, 
  Mail,
  CheckCircle2,
  Car,
  Dumbbell,
  Clock,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { format } from "date-fns";
import type { EmployeeProfileData } from "@/types/employeeProfile";

interface SocialProfileViewProps {
  profile: EmployeeProfileData;
  verificationStatus?: string;
}

export function SocialProfileView({ profile, verificationStatus }: SocialProfileViewProps) {
  const locationParts = [profile.suburb, profile.city, profile.region, profile.country]
    .filter(Boolean);
  const locationString = locationParts.join(", ");

  return (
    <div className="space-y-6 print:hidden">
      {/* Banner & Profile Header */}
      <div className="relative">
        {/* Banner */}
        <div className="h-32 sm:h-40 bg-gradient-to-r from-primary/80 via-primary to-primary/60 rounded-t-xl" />
        
        {/* Profile Picture & Basic Info */}
        <div className="relative px-6 pb-6">
          {/* Avatar */}
          <div className="absolute -top-12 sm:-top-16 left-6">
            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-background bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center shadow-lg">
              {profile.avatarUrl ? (
                <img 
                  src={profile.avatarUrl} 
                  alt={profile.fullName}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span className="text-3xl sm:text-4xl font-bold text-primary">
                  {profile.firstName?.[0]}{profile.lastName?.[0]}
                </span>
              )}
            </div>
          </div>

          {/* Name & Title */}
          <div className="pt-14 sm:pt-20">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold font-display">{profile.fullName}</h1>
                <p className="text-lg text-muted-foreground">{profile.professionalTitle}</p>
              </div>
              <Badge 
                variant={profile.isAvailable ? "default" : "secondary"} 
                className="w-fit text-sm px-3 py-1"
              >
                {profile.isAvailable ? "✓ Available for work" : "Not available"}
              </Badge>
            </div>

            {/* Quick Info Row */}
            <div className="flex flex-wrap gap-4 mt-4 text-sm text-muted-foreground">
              {locationString && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {locationString}
                </span>
              )}
              {profile.industry && (
                <span className="flex items-center gap-1">
                  <Briefcase className="w-4 h-4" />
                  {profile.industry}
                </span>
              )}
              {profile.experienceYears !== null && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {profile.experienceYears} years exp.
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* About Section */}
      {profile.bio && (
        <Card className="p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-3">About</h2>
          <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {profile.bio}
          </p>
        </Card>
      )}

      {/* Skills Section - Interactive Tags */}
      {profile.skills?.length > 0 && (
        <Card className="p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Skills</h2>
          <div className="flex flex-wrap gap-2">
            {profile.skills.map((skill, index) => (
              <Badge 
                key={skill} 
                variant="outline"
                className="px-3 py-1.5 text-sm bg-primary/5 hover:bg-primary/10 transition-colors cursor-default border-primary/20"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {skill}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {/* Two Column Layout for Details */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Contact & Details */}
        <Card className="p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Contact & Details</h2>
          <div className="space-y-3">
            {profile.phone && (
              <div className="flex items-center gap-3 text-muted-foreground">
                <Phone className="w-4 h-4 text-primary" />
                <span>{profile.phone}</span>
              </div>
            )}
            {profile.email && (
              <div className="flex items-center gap-3 text-muted-foreground">
                <Mail className="w-4 h-4 text-primary" />
                <span>{profile.email}</span>
              </div>
            )}
            {profile.visaStatus && (
              <div className="flex items-center gap-3 text-muted-foreground">
                <Globe className="w-4 h-4 text-primary" />
                <span>{profile.visaStatus}</span>
              </div>
            )}
            {profile.dateOfBirth && (
              <div className="flex items-center gap-3 text-muted-foreground">
                <Calendar className="w-4 h-4 text-primary" />
                <span>Born {format(new Date(profile.dateOfBirth), "MMM d, yyyy")}</span>
              </div>
            )}
            {profile.availability && (
              <div className="flex items-center gap-3 text-muted-foreground">
                <Clock className="w-4 h-4 text-primary" />
                <span>Availability: {profile.availability}</span>
              </div>
            )}
          </div>
        </Card>

        {/* Languages */}
        {profile.languages?.length > 0 && (
          <Card className="p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Languages</h2>
            <div className="flex flex-wrap gap-2">
              {profile.languages.map((lang) => (
                <Badge key={lang} variant="secondary" className="px-3 py-1.5">
                  {lang}
                </Badge>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Work Preferences */}
      <Card className="p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Work Preferences</h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className={`flex items-center gap-2 p-3 rounded-lg ${profile.comfortableHeavyLifting ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
            <Dumbbell className="w-4 h-4" />
            <span className="text-sm">Heavy Lifting</span>
            {profile.comfortableHeavyLifting && <CheckCircle2 className="w-4 h-4 ml-auto" />}
          </div>
          <div className={`flex items-center gap-2 p-3 rounded-lg ${profile.comfortableStanding ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-sm">Standing Work</span>
            {profile.comfortableStanding && <CheckCircle2 className="w-4 h-4 ml-auto" />}
          </div>
          <div className={`flex items-center gap-2 p-3 rounded-lg ${profile.hasCar ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
            <Car className="w-4 h-4" />
            <span className="text-sm">Has Car</span>
            {profile.hasCar && <CheckCircle2 className="w-4 h-4 ml-auto" />}
          </div>
          <div className={`flex items-center gap-2 p-3 rounded-lg ${profile.hasIrdNumber ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-sm">IRD Number</span>
            {profile.hasIrdNumber && <CheckCircle2 className="w-4 h-4 ml-auto" />}
          </div>
        </div>
      </Card>
    </div>
  );
}
