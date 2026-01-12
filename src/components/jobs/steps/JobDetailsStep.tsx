import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface JobDetailsStepProps {
  formData: {
    title: string;
    description: string;
    industry: string;
    job_type: string;
    positions_available: string;
  };
  maxPositions: number;
  onChange: (data: Partial<JobDetailsStepProps["formData"]>) => void;
}

const INDUSTRIES = [
  "Agriculture", "Construction", "Education", "Events & Hospitality",
  "Food & Beverage", "Healthcare", "Logistics & Warehousing",
  "Manufacturing", "Office & Admin", "Retail", "Transportation", "Other",
];

export function JobDetailsStep({ formData, maxPositions, onChange }: JobDetailsStepProps) {
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
        <Label>Positions Available *</Label>
        <Input
          type="number"
          min="1"
          max={maxPositions}
          value={formData.positions_available}
          onChange={(e) => onChange({ positions_available: e.target.value })}
          required
        />
        <p className="text-xs text-muted-foreground">Maximum {maxPositions} positions per job posting</p>
      </div>
    </div>
  );
}
