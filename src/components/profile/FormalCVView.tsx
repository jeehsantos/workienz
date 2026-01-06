import { MapPin, Phone, Mail, Globe, Calendar, Briefcase } from "lucide-react";
import { format } from "date-fns";
import type { EmployeeProfileData } from "@/types/employeeProfile";

interface FormalCVViewProps {
  profile: EmployeeProfileData;
}

export function FormalCVView({ profile }: FormalCVViewProps) {
  const locationParts = [profile.suburb, profile.city, profile.region, profile.country]
    .filter(Boolean);
  const locationString = locationParts.join(", ");

  return (
    <div className="cv-container bg-white text-gray-900 max-w-[210mm] mx-auto print:max-w-none print:mx-0">
      {/* CV Content - A4 optimized */}
      <div className="p-8 print:p-[15mm] space-y-6 print:space-y-4">
        {/* Header - No profile image in formal mode */}
        <header className="border-b-2 border-gray-800 pb-4 print:pb-3">
          <h1 className="text-3xl print:text-2xl font-bold text-gray-900 tracking-tight">
            {profile.fullName}
          </h1>
          <p className="text-xl print:text-lg text-gray-600 mt-1">
            {profile.professionalTitle}
          </p>
          
          {/* Contact Row */}
          <div className="flex flex-wrap gap-4 print:gap-3 mt-3 text-sm text-gray-600">
            {profile.phone && (
              <span className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" />
                {profile.phone}
              </span>
            )}
            {profile.email && (
              <span className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5" />
                {profile.email}
              </span>
            )}
            {locationString && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {locationString}
              </span>
            )}
          </div>
        </header>

        {/* Two Column Layout */}
        <div className="grid grid-cols-[1fr_250px] print:grid-cols-[1fr_200px] gap-8 print:gap-6">
          {/* Main Column */}
          <div className="space-y-5 print:space-y-4">
            {/* Professional Summary */}
            {profile.bio && (
              <section>
                <h2 className="text-lg print:text-base font-bold text-gray-900 uppercase tracking-wide border-b border-gray-300 pb-1 mb-3 print:mb-2">
                  Professional Summary
                </h2>
                <p className="text-sm print:text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {profile.bio}
                </p>
              </section>
            )}

            {/* Experience Summary */}
            <section>
              <h2 className="text-lg print:text-base font-bold text-gray-900 uppercase tracking-wide border-b border-gray-300 pb-1 mb-3 print:mb-2">
                Professional Details
              </h2>
              <div className="space-y-2 text-sm print:text-xs">
                {profile.industry && (
                  <div className="flex items-start gap-2">
                    <Briefcase className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-medium">Industry:</span>
                      <span className="text-gray-700 ml-2">{profile.industry}</span>
                    </div>
                  </div>
                )}
                {profile.experienceYears !== null && (
                  <div className="flex items-start gap-2">
                    <Calendar className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-medium">Experience:</span>
                      <span className="text-gray-700 ml-2">{profile.experienceYears} years</span>
                    </div>
                  </div>
                )}
                {profile.availability && (
                  <div className="flex items-start gap-2">
                    <Calendar className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-medium">Availability:</span>
                      <span className="text-gray-700 ml-2 capitalize">{profile.availability}</span>
                    </div>
                  </div>
                )}
                {profile.visaStatus && (
                  <div className="flex items-start gap-2">
                    <Globe className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-medium">Visa Status:</span>
                      <span className="text-gray-700 ml-2">{profile.visaStatus}</span>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Work Capabilities */}
            <section>
              <h2 className="text-lg print:text-base font-bold text-gray-900 uppercase tracking-wide border-b border-gray-300 pb-1 mb-3 print:mb-2">
                Work Capabilities
              </h2>
              <div className="grid grid-cols-2 gap-2 text-sm print:text-xs">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${profile.comfortableHeavyLifting ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className="text-gray-700">Heavy Lifting</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${profile.comfortableStanding ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className="text-gray-700">Standing Work</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${profile.hasCar ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className="text-gray-700">Own Transport</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${profile.hasIrdNumber ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className="text-gray-700">IRD Registered</span>
                </div>
              </div>
            </section>
          </div>

          {/* Sidebar Column */}
          <div className="space-y-5 print:space-y-4">
            {/* Skills */}
            {profile.skills?.length > 0 && (
              <section>
                <h2 className="text-lg print:text-base font-bold text-gray-900 uppercase tracking-wide border-b border-gray-300 pb-1 mb-3 print:mb-2">
                  Skills
                </h2>
                <ul className="space-y-1">
                  {profile.skills.map((skill) => (
                    <li key={skill} className="text-sm print:text-xs text-gray-700 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full flex-shrink-0" />
                      {skill}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Languages */}
            {profile.languages?.length > 0 && (
              <section>
                <h2 className="text-lg print:text-base font-bold text-gray-900 uppercase tracking-wide border-b border-gray-300 pb-1 mb-3 print:mb-2">
                  Languages
                </h2>
                <ul className="space-y-1">
                  {profile.languages.map((lang) => (
                    <li key={lang} className="text-sm print:text-xs text-gray-700 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full flex-shrink-0" />
                      {lang}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Additional Info */}
            <section>
              <h2 className="text-lg print:text-base font-bold text-gray-900 uppercase tracking-wide border-b border-gray-300 pb-1 mb-3 print:mb-2">
                Additional Info
              </h2>
              <div className="space-y-1 text-sm print:text-xs text-gray-700">
                {profile.dateOfBirth && (
                  <p>DOB: {format(new Date(profile.dateOfBirth), "MMM d, yyyy")}</p>
                )}
                <p>Country: {profile.country}</p>
              </div>
            </section>
          </div>
        </div>

        {/* Print-only Watermark Footer */}
        <footer className="hidden print:block pt-4 mt-auto border-t border-gray-200">
          <p className="text-xs text-gray-400 text-center">
            Powered by Workie • Generated on {format(new Date(), "MMMM d, yyyy")}
          </p>
        </footer>
      </div>
    </div>
  );
}
