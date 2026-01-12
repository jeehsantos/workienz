import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Gift, GraduationCap, Home, Plus } from "lucide-react";

const DEFAULT_BENEFITS = ["Provides training", "Provides accommodation"];

interface BenefitsStepProps {
  selectedBenefits: string[];
  experienceRequired: boolean;
  isSSE: boolean;
  showSSE: boolean;
  onBenefitsChange: (benefits: string[]) => void;
  onExperienceChange: (value: boolean) => void;
  onSSEChange: (value: boolean) => void;
}

export function BenefitsStep({
  selectedBenefits,
  experienceRequired,
  isSSE,
  showSSE,
  onBenefitsChange,
  onExperienceChange,
  onSSEChange,
}: BenefitsStepProps) {
  const [allBenefits, setAllBenefits] = useState<string[]>(DEFAULT_BENEFITS);
  const [customBenefit, setCustomBenefit] = useState("");

  const toggleBenefit = (benefit: string) => {
    if (selectedBenefits.includes(benefit)) {
      onBenefitsChange(selectedBenefits.filter(b => b !== benefit));
    } else {
      onBenefitsChange([...selectedBenefits, benefit]);
    }
  };

  const addCustomBenefit = () => {
    if (customBenefit.trim() && !allBenefits.includes(customBenefit.trim())) {
      const newBenefit = customBenefit.trim();
      setAllBenefits([...allBenefits, newBenefit]);
      onBenefitsChange([...selectedBenefits, newBenefit]);
      setCustomBenefit("");
    }
  };

  return (
    <div className="space-y-6">
      {/* Job Benefits */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Gift className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Job Benefits</h3>
        </div>
        <div className="space-y-3">
          {allBenefits.map((benefit) => (
            <div key={benefit} className="flex items-center space-x-2">
              <Checkbox
                id={`benefit-${benefit}`}
                checked={selectedBenefits.includes(benefit)}
                onCheckedChange={() => toggleBenefit(benefit)}
              />
              <Label htmlFor={`benefit-${benefit}`} className="font-normal cursor-pointer flex items-center gap-1">
                {benefit === "Provides training" && <GraduationCap className="w-4 h-4" />}
                {benefit === "Provides accommodation" && <Home className="w-4 h-4" />}
                {benefit}
              </Label>
            </div>
          ))}
          <div className="flex gap-2 pt-2">
            <Input
              value={customBenefit}
              onChange={(e) => setCustomBenefit(e.target.value)}
              placeholder="Add custom benefit..."
              className="flex-1"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomBenefit(); }}}
            />
            <Button type="button" variant="outline" size="icon" onClick={addCustomBenefit}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Experience Required */}
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
        <div>
          <Label className="font-normal">Experience Required</Label>
          <p className="text-xs text-muted-foreground">Only experienced workers can apply</p>
        </div>
        <Switch checked={experienceRequired} onCheckedChange={onExperienceChange} />
      </div>

      {/* SSE Position (only for Agriculture) */}
      {showSSE && (
        <div className="flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
          <div>
            <Label className="font-normal text-amber-700 dark:text-amber-400">SSE Position</Label>
            <p className="text-xs text-muted-foreground">For RSE/SSE workers</p>
          </div>
          <Switch checked={isSSE} onCheckedChange={onSSEChange} />
        </div>
      )}
    </div>
  );
}
