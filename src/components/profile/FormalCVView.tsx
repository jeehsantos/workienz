import { MapPin, Phone, Mail, Globe, Calendar, Briefcase, GraduationCap, Users } from "lucide-react";
import { format } from "date-fns";
import type { EmployeeProfileData } from "@/types/employeeProfile";
import workieLogo from "@/assets/workie-logo.png";

interface FormalCVViewProps {
  profile: EmployeeProfileData;
}

export function FormalCVView({ profile }: FormalCVViewProps) {
  const locationParts = [profile.suburb, profile.city]
    .filter(Boolean);
  const locationString = locationParts.join(", ");

  // Format date for work experience
  const formatWorkDate = (dateStr: string) => {
    if (!dateStr) return "";
    const [year, month] = dateStr.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return format(date, "MMM yyyy");
  };

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
                  <div className="flex items-start gap-2 sm:ml-4">
                    <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <span className="font-medium">Current visa:</span>
                      <span className="text-gray-700 ml-1 sm:ml-2 break-words">{profile.visaStatus}</span>
                    </div>
                  </div>
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
                <h2 className="flex items-center gap-2 text-base sm:text-lg print:text-base font-bold text-gray-900 uppercase tracking-wide border-b border-gray-300 pb-1 mb-2 sm:mb-3 print:mb-2">
                  <Users className="w-4 h-4 text-gray-500" />
                  Professional Summary
                </h2>
                <p className="text-xs sm:text-sm print:text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {profile.bio}
                </p>
              </section>
            )}

            {/* Work Experience */}
            {profile.workExperience?.length > 0 && (
              <section>
                <h2 className="flex items-center gap-2 text-base sm:text-lg print:text-base font-bold text-gray-900 uppercase tracking-wide border-b border-gray-300 pb-1 mb-2 sm:mb-3 print:mb-2">
                  <Briefcase className="w-4 h-4 text-gray-500" />
                  Work Experience
                </h2>
                <div className="space-y-3 print:space-y-2">
                  {profile.workExperience.map((exp) => (
                    <div key={exp.id} className="text-xs sm:text-sm print:text-xs">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-0.5">
                        <div>
                          <h3 className="font-semibold text-gray-900">{exp.position}</h3>
                          <p className="text-gray-600">{exp.company}</p>
                        </div>
                        <span className="text-gray-500 text-xs">
                          {formatWorkDate(exp.startDate)} - {exp.current ? "Present" : formatWorkDate(exp.endDate || "")}
                        </span>
                      </div>
                      {exp.description && (
                        <p className="text-gray-700 mt-1 whitespace-pre-wrap">{exp.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Education */}
            {profile.education?.length > 0 && (
              <section>
                <h2 className="flex items-center gap-2 text-base sm:text-lg print:text-base font-bold text-gray-900 uppercase tracking-wide border-b border-gray-300 pb-1 mb-2 sm:mb-3 print:mb-2">
                  <GraduationCap className="w-4 h-4 text-gray-500" />
                  Education & Qualifications
                </h2>
                <div className="space-y-2 print:space-y-1.5">
                  {profile.education.map((edu) => (
                    <div key={edu.id} className="text-xs sm:text-sm print:text-xs">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-0.5">
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {edu.degree}{edu.field ? ` in ${edu.field}` : ""}
                          </h3>
                          <p className="text-gray-600">{edu.institution}</p>
                        </div>
                        <span className="text-gray-500 text-xs">
                          {edu.startYear} - {edu.current ? "Present" : edu.endYear || ""}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* References */}
            <section>
              <h2 className="flex items-center gap-2 text-base sm:text-lg print:text-base font-bold text-gray-900 uppercase tracking-wide border-b border-gray-300 pb-1 mb-2 sm:mb-3 print:mb-2">
                <Users className="w-4 h-4 text-gray-500" />
                References
              </h2>
              {profile.cvReferences?.length > 0 ? (
                <div className="space-y-2 print:space-y-1.5 text-xs sm:text-sm print:text-xs">
                  {profile.cvReferences.map((ref) => (
                    <div key={ref.id}>
                      <p className="font-semibold text-gray-900">{ref.name}</p>
                      <p className="text-gray-600">{ref.position}, {ref.company}</p>
                      {(ref.email || ref.phone) && (
                        <p className="text-gray-500">
                          {ref.email && <span>{ref.email}</span>}
                          {ref.email && ref.phone && <span> • </span>}
                          {ref.phone && <span>{ref.phone}</span>}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs sm:text-sm print:text-xs text-gray-600 italic">
                  References available upon request
                </p>
              )}
            </section>

          </div>

          {/* Sidebar Column - Hidden on mobile, shown on md+ and print */}
          <div className="hidden md:block print:block space-y-4 print:space-y-3">
            {/* Details */}
            <section>
              <h2 className="text-lg print:text-base font-bold text-gray-900 uppercase tracking-wide border-b border-gray-300 pb-1 mb-3 print:mb-2">
                Details
              </h2>
              <div className="space-y-1 text-sm print:text-xs text-gray-700">
                {locationString && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0 text-gray-500" />
                    <span className="break-words">{locationString}</span>
                  </div>
                )}
                {profile.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0 text-gray-500" />
                    <span className="break-words">{profile.phone}</span>
                  </div>
                )}
                {profile.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0 text-gray-500" />
                    <span className="break-words">{profile.email}</span>
                  </div>
                )}
                {profile.dateOfBirth && (
                  <div className="text-gray-600">
                    DOB: {format(new Date(profile.dateOfBirth), "MMM d, yyyy")}
                  </div>
                )}
              </div>
            </section>
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
