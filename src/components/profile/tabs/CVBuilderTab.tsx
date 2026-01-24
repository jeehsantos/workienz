import { Card } from "@/components/ui/card";
import { FormalCVSections } from "@/components/profile/FormalCVSections";
import type { WorkExperience, Education, CVReference } from "@/types/employeeProfile";
import { Info } from "lucide-react";

interface CVBuilderTabProps {
  workExperience: WorkExperience[];
  setWorkExperience: (items: WorkExperience[]) => void;
  education: Education[];
  setEducation: (items: Education[]) => void;
  cvReferences: CVReference[];
  setCvReferences: (items: CVReference[]) => void;
}

export function CVBuilderTab({
  workExperience,
  setWorkExperience,
  education,
  setEducation,
  cvReferences,
  setCvReferences,
}: CVBuilderTabProps) {
  return (
    <div className="space-y-6">
      <Card className="p-4 sm:p-6 bg-primary/5 border-primary/20">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-primary mb-1">Build Your Professional CV</h3>
            <p className="text-sm text-muted-foreground">
              Add your work experience, education, and references to create a comprehensive CV. 
              This information will be displayed in your Formal CV view and can be printed as a PDF.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              <strong>Optional:</strong> You can skip this section if you only want a social profile.
            </p>
          </div>
        </div>
      </Card>

      <FormalCVSections
        workExperience={workExperience}
        education={education}
        cvReferences={cvReferences}
        onWorkExperienceChange={setWorkExperience}
        onEducationChange={setEducation}
        onReferencesChange={setCvReferences}
      />
    </div>
  );
}
