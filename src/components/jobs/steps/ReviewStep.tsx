import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Briefcase, 
  MapPin, 
  DollarSign, 
  Dumbbell, 
  Car, 
  Gift, 
  Clock,
  Edit2,
  Check,
  X
} from "lucide-react";
import { format } from "date-fns";

type Shift = {
  id: string;
  date: Date | undefined;
  start_time: string;
  end_time: string;
  break_minutes: string;
  break_paid: boolean;
};

interface ReviewStepProps {
  formData: {
    title: string;
    description: string;
    industry: string;
    job_type: string;
    positions_available: string;
    location_region: string;
    location_city: string;
    location_suburb: string;
    hourly_rate: string;
    requirements: string;
  };
  physicalRequirements: string[];
  requiresCar: boolean;
  selectedBenefits: string[];
  experienceRequired: boolean;
  isSSE: boolean;
  skills: string[];
  scheduleType: "shifts" | "fixed_term";
  shifts: Shift[];
  fixedTermStart: Date | undefined;
  fixedTermEnd: Date | undefined;
  onEditStep: (step: number) => void;
}

export function ReviewStep({
  formData,
  physicalRequirements,
  requiresCar,
  selectedBenefits,
  experienceRequired,
  isSSE,
  skills,
  scheduleType,
  shifts,
  fixedTermStart,
  fixedTermEnd,
  onEditStep,
}: ReviewStepProps) {
  const validShifts = shifts.filter(s => s.date && s.start_time && s.end_time);

  const SectionCard = ({ 
    title, 
    icon: Icon, 
    step, 
    children 
  }: { 
    title: string; 
    icon: any; 
    step: number; 
    children: React.ReactNode 
  }) => (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Icon className="w-4 h-4 text-primary" />
            {title}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => onEditStep(step)}>
            <Edit2 className="w-3 h-3 mr-1" />
            Edit
          </Button>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold">Review Your Job Posting</h3>
        <p className="text-sm text-muted-foreground">Please review all details before publishing</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Job Details */}
        <SectionCard title="Job Details" icon={Briefcase} step={1}>
          <div className="space-y-2 text-sm">
            <p><span className="font-medium">Title:</span> {formData.title || "Not set"}</p>
            <p><span className="font-medium">Industry:</span> {formData.industry || "Not set"}</p>
            <p><span className="font-medium">Type:</span> {formData.job_type}</p>
            <p><span className="font-medium">Positions:</span> {formData.positions_available}</p>
            {formData.description && (
              <p className="text-muted-foreground line-clamp-2">{formData.description}</p>
            )}
          </div>
        </SectionCard>

        {/* Location & Pay */}
        <SectionCard title="Location & Pay" icon={MapPin} step={2}>
          <div className="space-y-2 text-sm">
            <p><span className="font-medium">Region:</span> {formData.location_region || "Not set"}</p>
            <p><span className="font-medium">City:</span> {formData.location_city || "Not set"}</p>
            {formData.location_suburb && (
              <p><span className="font-medium">Suburb:</span> {formData.location_suburb}</p>
            )}
            <p className="flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              <span className="font-medium">{formData.hourly_rate || "0"}/hr</span>
            </p>
          </div>
        </SectionCard>

        {/* Requirements */}
        <SectionCard title="Requirements" icon={Dumbbell} step={3}>
          <div className="space-y-2 text-sm">
            {physicalRequirements.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {physicalRequirements.map((req) => (
                  <Badge key={req} variant="secondary" className="text-xs">{req}</Badge>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No physical requirements</p>
            )}
            <p className="flex items-center gap-2">
              <Car className="w-3 h-3" />
              Requires car: {requiresCar ? <Check className="w-3 h-3 text-green-500" /> : <X className="w-3 h-3 text-muted-foreground" />}
            </p>
            {skills.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {skills.map((skill) => (
                  <Badge key={skill} variant="outline" className="text-xs">{skill}</Badge>
                ))}
              </div>
            )}
          </div>
        </SectionCard>

        {/* Benefits */}
        <SectionCard title="Benefits" icon={Gift} step={4}>
          <div className="space-y-2 text-sm">
            {selectedBenefits.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {selectedBenefits.map((benefit) => (
                  <Badge key={benefit} variant="secondary" className="text-xs">{benefit}</Badge>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No benefits listed</p>
            )}
            <p className="flex items-center gap-2">
              Experience required: {experienceRequired ? <Check className="w-3 h-3 text-green-500" /> : <X className="w-3 h-3 text-muted-foreground" />}
            </p>
            {formData.industry === "Agriculture" && (
              <p className="flex items-center gap-2">
                SSE Position: {isSSE ? <Check className="w-3 h-3 text-green-500" /> : <X className="w-3 h-3 text-muted-foreground" />}
              </p>
            )}
          </div>
        </SectionCard>

        {/* Schedule - Full Width */}
        <div className="md:col-span-2">
          <SectionCard title="Schedule" icon={Clock} step={5}>
            <div className="space-y-2 text-sm">
              <p><span className="font-medium">Type:</span> {scheduleType === "shifts" ? "Shifts" : "Fixed Term"}</p>
              {scheduleType === "shifts" ? (
                validShifts.length > 0 ? (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {validShifts.map((shift, index) => (
                      <div key={shift.id} className="p-2 bg-muted/50 rounded text-xs">
                        <p className="font-medium">Shift {index + 1}</p>
                        <p>{shift.date ? format(shift.date, "MMM d, yyyy") : ""}</p>
                        <p>{shift.start_time} - {shift.end_time}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No shifts added</p>
                )
              ) : (
                <div>
                  <p><span className="font-medium">Start:</span> {fixedTermStart ? format(fixedTermStart, "MMM d, yyyy") : "Not set"}</p>
                  {fixedTermEnd && (
                    <p><span className="font-medium">End:</span> {format(fixedTermEnd, "MMM d, yyyy")}</p>
                  )}
                </div>
              )}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
