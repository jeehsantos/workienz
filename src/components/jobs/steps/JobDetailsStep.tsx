import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Users, Sparkles } from "lucide-react";

interface JobDetailsStepProps {
  formData: {
    title: string;
    description: string;
    industry: string;
    job_type: string;
    positions_available: string;
  };
  maxPositions: number;
  isFreeTier?: boolean;
  hiringStyle: "slot_1to1" | "open_ai_top10";
  onHiringStyleChange: (style: "slot_1to1" | "open_ai_top10") => void;
  onChange: (data: Partial<JobDetailsStepProps["formData"]>) => void;
}

const INDUSTRIES = [
  "Agriculture", "Construction", "Education", "Events & Hospitality",
  "Food & Beverage", "Healthcare", "Logistics & Warehousing",
  "Manufacturing", "Office & Admin", "Retail", "Transportation", "Other",
];

export function JobDetailsStep({ formData, maxPositions, isFreeTier = false, hiringStyle, onHiringStyleChange, onChange }: JobDetailsStepProps) {
  return (
    <div className="space-y-6">
      {/* Hiring Style Selector */}
      <div className="space-y-2">
        <Label>Hiring Style</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onHiringStyleChange("slot_1to1")}
            className={`flex items-start gap-3 p-4 rounded-lg border-2 text-left transition-colors ${
              hiringStyle === "slot_1to1"
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/30"
            }`}
          >
            <Users className={`w-5 h-5 mt-0.5 flex-shrink-0 ${hiringStyle === "slot_1to1" ? "text-primary" : "text-muted-foreground"}`} />
            <div>
              <p className="font-medium text-sm">1–1 Slot Hiring</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                You review each applicant and fill positions one-by-one.
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => onHiringStyleChange("open_ai_top10")}
            className={`flex items-start gap-3 p-4 rounded-lg border-2 text-left transition-colors ${
              hiringStyle === "open_ai_top10"
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/30"
            }`}
          >
            <Sparkles className={`w-5 h-5 mt-0.5 flex-shrink-0 ${hiringStyle === "open_ai_top10" ? "text-primary" : "text-muted-foreground"}`} />
            <div>
              <p className="font-medium text-sm">Open Applications + AI Top-10</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Applicants answer questions, AI ranks the top candidates for you.
              </p>
            </div>
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Job Title *</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="e.g., Warehouse Assistant"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Job Description *</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Describe the role, responsibilities..."
          rows={5}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Industry *</Label>
          <Select value={formData.industry} onValueChange={(v) => onChange({ industry: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Select industry" />
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={4}>
              {INDUSTRIES.map((ind) => (
                <SelectItem key={ind} value={ind}>{ind}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Job Type</Label>
          <Select value={formData.job_type} onValueChange={(v) => onChange({ job_type: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={4}>
              <SelectItem value="temporary">Temporary</SelectItem>
              <SelectItem value="short-term">Short-term</SelectItem>
              <SelectItem value="contract">Contract</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label>Positions Available *</Label>
          {isFreeTier && (
            <Badge variant="secondary" className="text-xs">Free Tier Limit</Badge>
          )}
        </div>
        <Input
          type="number"
          min="1"
          max={maxPositions}
          value={formData.positions_available}
          onChange={(e) => {
            // Enforce max positions limit
            const value = Math.min(parseInt(e.target.value) || 1, maxPositions);
            onChange({ positions_available: String(value) });
          }}
          disabled={isFreeTier}
          required
        />
        {isFreeTier ? (
          <p className="text-xs text-muted-foreground">
            Free tier is limited to 1 position per job posting. <span className="text-primary font-medium">Upgrade your plan</span> to post multiple positions.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Maximum {maxPositions} positions per job posting</p>
        )}
      </div>
    </div>
  );
}
