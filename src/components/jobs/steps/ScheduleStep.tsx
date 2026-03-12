import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { Clock, Plus, X, Users } from "lucide-react";

type Shift = {
  id: string;
  date: Date | undefined;
  start_time: string;
  end_time: string;
  break_minutes: string;
  break_paid: boolean;
};

interface ScheduleStepProps {
  scheduleType: "shifts" | "fixed_term";
  shifts: Shift[];
  fixedTermStart: Date | undefined;
  fixedTermEnd: Date | undefined;
  weeklyHours?: string;
  onScheduleTypeChange: (type: "shifts" | "fixed_term") => void;
  onShiftsChange: (shifts: Shift[]) => void;
  onFixedTermStartChange: (date: Date | undefined) => void;
  onFixedTermEndChange: (date: Date | undefined) => void;
  onWeeklyHoursChange?: (hours: string) => void;
}

export function ScheduleStep({
  scheduleType,
  shifts,
  fixedTermStart,
  fixedTermEnd,
  weeklyHours,
  onScheduleTypeChange,
  onShiftsChange,
  onFixedTermStartChange,
  onFixedTermEndChange,
  onWeeklyHoursChange,
}: ScheduleStepProps) {
  const addShift = () => {
    onShiftsChange([
      ...shifts,
      { id: crypto.randomUUID(), date: undefined, start_time: "", end_time: "", break_minutes: "0", break_paid: false }
    ]);
  };

  const removeShift = (id: string) => {
    if (shifts.length > 1) {
      onShiftsChange(shifts.filter(s => s.id !== id));
    }
  };

  const updateShift = (id: string, field: keyof Shift, value: any) => {
    onShiftsChange(shifts.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const calculateDuration = () => {
    if (fixedTermStart && fixedTermEnd) {
      const diffTime = Math.abs(fixedTermEnd.getTime() - fixedTermStart.getTime());
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }
    return null;
  };

  const durationDays = calculateDuration();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">Schedule</h3>
      </div>

      <RadioGroup
        value={scheduleType}
        onValueChange={(v: "shifts" | "fixed_term") => onScheduleTypeChange(v)}
        className="flex gap-4"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="shifts" id="shifts" />
          <Label htmlFor="shifts" className="font-normal cursor-pointer">Shifts</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="fixed_term" id="fixed_term" />
          <Label htmlFor="fixed_term" className="font-normal cursor-pointer">Fixed Term</Label>
        </div>
      </RadioGroup>

      {scheduleType === "shifts" ? (
        <div className="space-y-4">
          <div className="p-6 bg-muted/50 rounded-lg border border-border/50">
            <div className="flex items-start gap-3">
              <Users className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm mb-1">Shift-Based Role</p>
                <p className="text-sm text-muted-foreground">
                  This is a shift-based role. You'll add and manage shifts after you've screened and built your Talent Pool.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date *</Label>
              <DatePicker
                value={fixedTermStart}
                onChange={onFixedTermStartChange}
                placeholder="Select start"
                disabledDates={(date) => date < new Date()}
              />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <DatePicker
                value={fixedTermEnd}
                onChange={onFixedTermEndChange}
                placeholder="Select end"
                disabledDates={(date) => date < new Date() || (fixedTermStart ? date < fixedTermStart : false)}
              />
            </div>
          </div>
          
          {/* Weekly Hours Input */}
          <div className="space-y-2">
            <Label>Weekly Working Hours *</Label>
            <Input
              type="number"
              min="1"
              max="60"
              placeholder="e.g., 40"
              value={weeklyHours || ""}
              onChange={(e) => onWeeklyHoursChange?.(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Expected hours per week for this fixed term position
            </p>
          </div>
          
          {durationDays && (
            <p className="text-sm text-muted-foreground">
              Duration: {durationDays} day{durationDays !== 1 ? 's' : ''}
              {weeklyHours && ` • ${weeklyHours} hours/week`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
