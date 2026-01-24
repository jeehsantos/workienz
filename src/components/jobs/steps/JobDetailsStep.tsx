import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

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
  onChange: (data: Partial<JobDetailsStepProps["formData"]>) => void;
}

const INDUSTRIES = [
  "Agriculture", "Construction", "Education", "Events & Hospitality",
  "Food & Beverage", "Healthcare", "Logistics & Warehousing",
  "Manufacturing", "Office & Admin", "Retail", "Transportation", "Other",
];

export function JobDetailsStep({ formData, maxPositions, isFreeTier = false, onChange }: JobDetailsStepProps) {
  return (
    <div className="space-y-6">
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
