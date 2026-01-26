import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dumbbell, Car, Plus, X } from "lucide-react";

const DEFAULT_PHYSICAL_REQS = ["Requires lifting > 10kg", "Requires standing for long periods"];

interface RequirementsStepProps {
  formData: {
    requirements: string;
  };
  physicalRequirements: string[];
  requiresCar: boolean;
  experienceRequired: boolean;
  skills: string[];
  onFormChange: (data: { requirements: string }) => void;
  onPhysicalReqsChange: (reqs: string[]) => void;
  onExperienceChange: (value: boolean) => void;
  onRequiresCarChange: (value: boolean) => void;
  onSkillsChange: (skills: string[]) => void;
}

export function RequirementsStep({
  formData,
  physicalRequirements,
  experienceRequired,
  requiresCar,
  skills,
  onExperienceChange,
  onFormChange,
  onPhysicalReqsChange,
  onRequiresCarChange,
  onSkillsChange,
}: RequirementsStepProps) {
  const [allPhysicalReqs, setAllPhysicalReqs] = useState<string[]>(DEFAULT_PHYSICAL_REQS);
  const [customPhysicalReq, setCustomPhysicalReq] = useState("");
  const [skillInput, setSkillInput] = useState("");

  const togglePhysicalReq = (req: string) => {
    if (physicalRequirements.includes(req)) {
      onPhysicalReqsChange(physicalRequirements.filter(r => r !== req));
    } else {
      onPhysicalReqsChange([...physicalRequirements, req]);
    }
  };

  const addCustomPhysicalReq = () => {
    if (customPhysicalReq.trim() && !allPhysicalReqs.includes(customPhysicalReq.trim())) {
      const newReq = customPhysicalReq.trim();
      setAllPhysicalReqs([...allPhysicalReqs, newReq]);
      onPhysicalReqsChange([...physicalRequirements, newReq]);
      setCustomPhysicalReq("");
    }
  };

  const addSkill = () => {
    if (skillInput.trim() && !skills.includes(skillInput.trim())) {
      onSkillsChange([...skills, skillInput.trim()]);
      setSkillInput("");
    }
  };

  const removeSkill = (skill: string) => {
    onSkillsChange(skills.filter(s => s !== skill));
  };

  return (
    <div className="space-y-6">

      {/* Experience Required */}
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
        <div>
          <Label className="font-normal">Experience Required</Label>
          <p className="text-xs text-muted-foreground">Only experienced workers can apply</p>
        </div>
        <Switch checked={experienceRequired} onCheckedChange={onExperienceChange} />
      </div>

      {/* Physical Requirements */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Dumbbell className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Physical Requirements</h3>
        </div>
        <div className="space-y-3">
          {allPhysicalReqs.map((req) => (
            <div key={req} className="flex items-center space-x-2">
              <Checkbox
                id={`req-${req}`}
                checked={physicalRequirements.includes(req)}
                onCheckedChange={() => togglePhysicalReq(req)}
              />
              <Label htmlFor={`req-${req}`} className="font-normal cursor-pointer">{req}</Label>
            </div>
          ))}
          <div className="flex gap-2 pt-2">
            <Input
              value={customPhysicalReq}
              onChange={(e) => setCustomPhysicalReq(e.target.value)}
              placeholder="Add custom requirement..."
              className="flex-1"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomPhysicalReq(); }}}
            />
            <Button type="button" variant="outline" size="icon" onClick={addCustomPhysicalReq}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Logistical Requirements */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Car className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Logistical Requirements</h3>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="requires_car"
            checked={requiresCar}
            onCheckedChange={(c) => onRequiresCarChange(c as boolean)}
          />
          <Label htmlFor="requires_car" className="font-normal cursor-pointer">Requires own vehicle/car</Label>
        </div>
      </div>

      {/* Additional Requirements */}
      <div className="space-y-2">
        <Label>Additional Requirements</Label>
        <Textarea
          value={formData.requirements}
          onChange={(e) => onFormChange({ requirements: e.target.value })}
          placeholder="List any specific requirements..."
          rows={3}
        />
      </div>

      {/* Skills Required */}
      <div className="space-y-2">
        <Label>Skills Required</Label>
        <div className="flex gap-2">
          <Input
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            placeholder="Add a skill..."
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); }}}
          />
          <Button type="button" variant="outline" size="icon" onClick={addSkill}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        {skills.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {skills.map((skill) => (
              <span key={skill} className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm flex items-center gap-1">
                {skill}
                <button type="button" onClick={() => removeSkill(skill)}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
