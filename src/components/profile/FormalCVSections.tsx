import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Plus, X, Briefcase, GraduationCap, Users } from "lucide-react";
import type { WorkExperience, Education, CVReference } from "@/types/employeeProfile";

interface FormalCVSectionsProps {
  workExperience: WorkExperience[];
  education: Education[];
  cvReferences: CVReference[];
  onWorkExperienceChange: (items: WorkExperience[]) => void;
  onEducationChange: (items: Education[]) => void;
  onReferencesChange: (items: CVReference[]) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

export function FormalCVSections({
  workExperience,
  education,
  cvReferences,
  onWorkExperienceChange,
  onEducationChange,
  onReferencesChange,
}: FormalCVSectionsProps) {
  // Work Experience handlers
  const addWorkExperience = () => {
    onWorkExperienceChange([
      ...workExperience,
      {
        id: generateId(),
        company: "",
        position: "",
        description: "",
        startDate: "",
        endDate: "",
        current: false,
      },
    ]);
  };

  const updateWorkExperience = (id: string, field: keyof WorkExperience, value: any) => {
    onWorkExperienceChange(
      workExperience.map((exp) =>
        exp.id === id ? { ...exp, [field]: value } : exp
      )
    );
  };

  const removeWorkExperience = (id: string) => {
    onWorkExperienceChange(workExperience.filter((exp) => exp.id !== id));
  };

  // Education handlers
  const addEducation = () => {
    onEducationChange([
      ...education,
      {
        id: generateId(),
        institution: "",
        degree: "",
        field: "",
        startYear: new Date().getFullYear(),
        endYear: undefined,
        current: false,
      },
    ]);
  };

  const updateEducation = (id: string, field: keyof Education, value: any) => {
    onEducationChange(
      education.map((edu) =>
        edu.id === id ? { ...edu, [field]: value } : edu
      )
    );
  };

  const removeEducation = (id: string) => {
    onEducationChange(education.filter((edu) => edu.id !== id));
  };

  // References handlers
  const addReference = () => {
    onReferencesChange([
      ...cvReferences,
      {
        id: generateId(),
        name: "",
        position: "",
        company: "",
        email: "",
        phone: "",
      },
    ]);
  };

  const updateReference = (id: string, field: keyof CVReference, value: any) => {
    onReferencesChange(
      cvReferences.map((ref) =>
        ref.id === id ? { ...ref, [field]: value } : ref
      )
    );
  };

  const removeReference = (id: string) => {
    onReferencesChange(cvReferences.filter((ref) => ref.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Work Experience Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold">Work Experience</h3>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addWorkExperience}>
            <Plus className="w-4 h-4 mr-1" />
            Add Experience
          </Button>
        </div>

        {workExperience.length === 0 ? (
          <Card className="p-4 text-center text-muted-foreground border-dashed">
            <p className="text-sm">No work experience added yet.</p>
            <p className="text-xs mt-1">Click "Add Experience" to add your work history.</p>
          </Card>
        ) : (
          workExperience.map((exp, index) => (
            <Card key={exp.id} className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Experience {index + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeWorkExperience(exp.id)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Company *</Label>
                  <Input
                    value={exp.company}
                    onChange={(e) => updateWorkExperience(exp.id, "company", e.target.value)}
                    placeholder="Company name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Position *</Label>
                  <Input
                    value={exp.position}
                    onChange={(e) => updateWorkExperience(exp.id, "position", e.target.value)}
                    placeholder="Your role"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={exp.description}
                  onChange={(e) => updateWorkExperience(exp.id, "description", e.target.value)}
                  placeholder="Describe your responsibilities and achievements..."
                  rows={3}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date *</Label>
                  <Input
                    type="month"
                    value={exp.startDate}
                    onChange={(e) => updateWorkExperience(exp.id, "startDate", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="month"
                    value={exp.endDate || ""}
                    onChange={(e) => updateWorkExperience(exp.id, "endDate", e.target.value)}
                    disabled={exp.current}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={exp.current || false}
                  onCheckedChange={(checked) => {
                    updateWorkExperience(exp.id, "current", checked);
                    if (checked) updateWorkExperience(exp.id, "endDate", "");
                  }}
                />
                <label 
                  className="font-normal cursor-pointer text-sm"
                  onClick={() => {
                    const newValue = !exp.current;
                    updateWorkExperience(exp.id, "current", newValue);
                    if (newValue) updateWorkExperience(exp.id, "endDate", "");
                  }}
                >
                  I currently work here
                </label>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Education Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold">Education & Qualifications</h3>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addEducation}>
            <Plus className="w-4 h-4 mr-1" />
            Add Education
          </Button>
        </div>

        {education.length === 0 ? (
          <Card className="p-4 text-center text-muted-foreground border-dashed">
            <p className="text-sm">No education added yet.</p>
            <p className="text-xs mt-1">Click "Add Education" to add your qualifications.</p>
          </Card>
        ) : (
          education.map((edu, index) => (
            <Card key={edu.id} className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Education {index + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeEducation(edu.id)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Institution *</Label>
                  <Input
                    value={edu.institution}
                    onChange={(e) => updateEducation(edu.id, "institution", e.target.value)}
                    placeholder="University or school name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Degree/Certificate *</Label>
                  <Input
                    value={edu.degree}
                    onChange={(e) => updateEducation(edu.id, "degree", e.target.value)}
                    placeholder="e.g., Bachelor's, Certificate"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Field of Study</Label>
                <Input
                  value={edu.field}
                  onChange={(e) => updateEducation(edu.id, "field", e.target.value)}
                  placeholder="e.g., Computer Science"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Year *</Label>
                  <Input
                    type="number"
                    min="1950"
                    max={new Date().getFullYear()}
                    value={edu.startYear}
                    onChange={(e) => updateEducation(edu.id, "startYear", parseInt(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Year</Label>
                  <Input
                    type="number"
                    min="1950"
                    max={new Date().getFullYear() + 10}
                    value={edu.endYear || ""}
                    onChange={(e) => updateEducation(edu.id, "endYear", e.target.value ? parseInt(e.target.value) : undefined)}
                    disabled={edu.current}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={edu.current || false}
                  onCheckedChange={(checked) => {
                    updateEducation(edu.id, "current", checked);
                    if (checked) updateEducation(edu.id, "endYear", undefined);
                  }}
                />
                <label 
                  className="font-normal cursor-pointer text-sm"
                  onClick={() => {
                    const newValue = !edu.current;
                    updateEducation(edu.id, "current", newValue);
                    if (newValue) updateEducation(edu.id, "endYear", undefined);
                  }}
                >
                  Currently studying here
                </label>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* References Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold">References</h3>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addReference}>
            <Plus className="w-4 h-4 mr-1" />
            Add Reference
          </Button>
        </div>

        {cvReferences.length === 0 ? (
          <Card className="p-4 text-center text-muted-foreground border-dashed">
            <p className="text-sm">No references added yet.</p>
            <p className="text-xs mt-1">Click "Add Reference" to add your referees, or leave empty to show "References available upon request".</p>
          </Card>
        ) : (
          cvReferences.map((ref, index) => (
            <Card key={ref.id} className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Reference {index + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeReference(ref.id)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input
                    value={ref.name}
                    onChange={(e) => updateReference(ref.id, "name", e.target.value)}
                    placeholder="Referee's full name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Position *</Label>
                  <Input
                    value={ref.position}
                    onChange={(e) => updateReference(ref.id, "position", e.target.value)}
                    placeholder="e.g., Senior Manager"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Company *</Label>
                <Input
                  value={ref.company}
                  onChange={(e) => updateReference(ref.id, "company", e.target.value)}
                  placeholder="Company name"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={ref.email || ""}
                    onChange={(e) => updateReference(ref.id, "email", e.target.value)}
                    placeholder="referee@company.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    type="tel"
                    value={ref.phone || ""}
                    onChange={(e) => updateReference(ref.id, "phone", e.target.value)}
                    placeholder="+64 21 123 4567"
                  />
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}