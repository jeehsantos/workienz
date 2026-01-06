import { MapPin, Phone, Mail, Globe, Calendar, Briefcase } from "lucide-react";
import { format } from "date-fns";
import type { EmployeeProfileData } from "@/types/employeeProfile";
import workieLogo from "@/assets/workie-logo.png";

interface FormalCVViewProps {
  profile: EmployeeProfileData;
}

export function FormalCVView({ profile }: FormalCVViewProps) {
  const locationParts = [profile.suburb, profile.city, profile.region, profile.country]
    .filter(Boolean);
  const locationString = locationParts.join(", ");

  return (
    <div className="cv-container bg-white text-gray-900 max-w-[210mm] mx-auto print:max-w-none print:mx-0 print:shadow-none shadow-lg rounded-lg overflow-hidden">
      {/* CV Content - A4 optimized, responsive for mobile */}
      <div className="p-4 sm:p-6 md:p-8 print:p-[12mm] print:pb-[18mm]">
        {/* Header - No profile image in formal mode */}
        <header className="cv-header border-b-2 border-gray-800 pb-3 sm:pb-4 print:pb-3">
          <h1 className="text-xl sm:text-2xl md:text-3xl print:text-2xl font-bold text-gray-900 tracking-tight">
            {profile.fullName}
          </h1>
          <p className="text-base sm:text-lg md:text-xl print:text-lg text-gray-600 mt-1">
            {profile.professionalTitle}
          </p>
          
          {/* Contact Row - Stack on mobile */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-4 print:flex-row print:gap-3 mt-3 text-xs sm:text-sm text-gray-600">
            {profile.phone && (
              <span className="flex items-center gap-1">
                <Phone className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
                <span className="truncate">{profile.phone}</span>
              </span>
            )}
            {profile.email && (
              <span className="flex items-center gap-1">
                <Mail className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
                <span className="truncate">{profile.email}</span>
              </span>
            )}
            {locationString && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
                <span className="truncate">{locationString}</span>
              </span>
            )}
          </div>
        </header>

        {/* Two Column Layout - Stack on mobile */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] print:grid-cols-[1fr_180px] gap-6 md:gap-8 print:gap-5 mt-4 sm:mt-5 print:mt-4">
          {/* Main Column */}
          <div className="space-y-4 print:space-y-3">
            {/* Professional Summary */}
            {profile.bio && (
              <section>
                <h2 className="text-base sm:text-lg print:text-base font-bold text-gray-900 uppercase tracking-wide border-b border-gray-300 pb-1 mb-2 sm:mb-3 print:mb-2">
                  Professional Summary
                </h2>
                <p className="text-xs sm:text-sm print:text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {profile.bio}
                </p>
              </section>
            )}

            {/* Experience Summary */}
            <section>
              <h2 className="text-base sm:text-lg print:text-base font-bold text-gray-900 uppercase tracking-wide border-b border-gray-300 pb-1 mb-2 sm:mb-3 print:mb-2">
                Professional Details
              </h2>
              <div className="space-y-2 text-xs sm:text-sm print:text-xs">
                {profile.industry && (
                  <div className="flex items-start gap-2">
                    <Briefcase className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <span className="font-medium">Industry:</span>
                      <span className="text-gray-700 ml-1 sm:ml-2">{profile.industry}</span>
                    </div>
                  </div>
                )}
                {profile.experienceYears !== null && (
                  <div className="flex items-start gap-2">
                    <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <span className="font-medium">Experience:</span>
                      <span className="text-gray-700 ml-1 sm:ml-2">{profile.experienceYears} years</span>
                    </div>
                  </div>
                )}
                {profile.availability && (
                  <div className="flex items-start gap-2">
                    <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <span className="font-medium">Availability:</span>
                      <span className="text-gray-700 ml-1 sm:ml-2 capitalize">{profile.availability}</span>
                    </div>
                  </div>
                )}
                {profile.visaStatus && (
                  <div className="flex items-start gap-2">
                    <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <span className="font-medium">Visa:</span>
                      <span className="text-gray-700 ml-1 sm:ml-2 break-words">{profile.visaStatus}</span>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Work Capabilities */}
            <section>
              <h2 className="text-base sm:text-lg print:text-base font-bold text-gray-900 uppercase tracking-wide border-b border-gray-300 pb-1 mb-2 sm:mb-3 print:mb-2">
                Work Capabilities
              </h2>
              <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm print:text-xs">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${profile.comfortableHeavyLifting ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className="text-gray-700">Heavy Lifting</span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${profile.comfortableStanding ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className="text-gray-700">Standing Work</span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${profile.hasCar ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className="text-gray-700">Own Transport</span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${profile.hasIrdNumber ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className="text-gray-700">IRD Registered</span>
                </div>
              </div>
            </section>

            {/* Skills - Show in main column on mobile */}
            <section className="md:hidden">
              {profile.skills?.length > 0 && (
                <>
                  <h2 className="text-base print:text-base font-bold text-gray-900 uppercase tracking-wide border-b border-gray-300 pb-1 mb-2">
                    Skills
                  </h2>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.skills.map((skill) => (
                      <span key={skill} className="text-xs text-gray-700 bg-gray-100 px-2 py-1 rounded">
                        {skill}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </section>

            {/* Languages - Show in main column on mobile */}
            <section className="md:hidden">
              {profile.languages?.length > 0 && (
                <>
                  <h2 className="text-base print:text-base font-bold text-gray-900 uppercase tracking-wide border-b border-gray-300 pb-1 mb-2">
                    Languages
                  </h2>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.languages.map((lang) => (
                      <span key={lang} className="text-xs text-gray-700 bg-gray-100 px-2 py-1 rounded">
                        {lang}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </section>

            {/* Additional Info - Show in main column on mobile */}
            <section className="md:hidden">
              <h2 className="text-base print:text-base font-bold text-gray-900 uppercase tracking-wide border-b border-gray-300 pb-1 mb-2">
                Additional Info
              </h2>
              <div className="space-y-1 text-xs text-gray-700">
                {profile.dateOfBirth && (
                  <p>DOB: {format(new Date(profile.dateOfBirth), "MMM d, yyyy")}</p>
                )}
                <p>Country: {profile.country}</p>
              </div>
            </section>
          </div>

          {/* Sidebar Column - Hidden on mobile, shown on md+ and print */}
          <div className="hidden md:block print:block space-y-4 print:space-y-3">
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
                      <span className="break-words">{skill}</span>
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
                      <span className="break-words">{lang}</span>
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

        {/* Print-only Watermark - Positioned absolutely at bottom right */}
        <div className="cv-watermark hidden print:flex items-center gap-1.5">
          <span className="text-[8pt] text-gray-400">Powered by</span>
          <img 
            src={workieLogo} 
            alt="Workie" 
            className="h-3 w-auto opacity-50"
          />
        </div>
      </div>
    </div>
  );
}
