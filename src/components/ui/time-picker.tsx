import * as React from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Clock } from "lucide-react";

interface TimePickerProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, "0"));

export function TimePicker({
  value,
  onChange,
  placeholder = "Select time",
  disabled = false,
  className,
}: TimePickerProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = React.useState(false);

  const selectedHour = value?.split(":")[0] || "";
  const selectedMinute = value?.split(":")[1] || "";

  const hourListRef = React.useRef<HTMLDivElement>(null);
  const minuteListRef = React.useRef<HTMLDivElement>(null);

  // Scroll to selected values when popover opens
  React.useEffect(() => {
    if (open && selectedHour) {
      requestAnimationFrame(() => {
        const hourIdx = HOURS.indexOf(selectedHour);
        if (hourIdx >= 0 && hourListRef.current) {
          const item = hourListRef.current.children[hourIdx] as HTMLElement;
          item?.scrollIntoView({ block: "center", behavior: "instant" });
        }
        const minIdx = MINUTES.indexOf(selectedMinute);
        if (minIdx >= 0 && minuteListRef.current) {
          const item = minuteListRef.current.children[minIdx] as HTMLElement;
          item?.scrollIntoView({ block: "center", behavior: "instant" });
        }
      });
    }
  }, [open, selectedHour, selectedMinute]);

  const handleSelect = (hour: string, minute: string) => {
    onChange(`${hour}:${minute}`);
  };

  // Mobile: use native time input for best OS-level UX
  if (isMobile) {
    return (
      <div className={cn("relative", className)}>
        <div className="relative">
          <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="time"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={cn(
              "flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm ring-offset-background",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "disabled:cursor-not-allowed disabled:opacity-50",
              !value && "text-muted-foreground"
            )}
          />
        </div>
      </div>
    );
  }

  // Desktop: clean scrollable columns
  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal h-10",
            !value && "text-muted-foreground",
            className
          )}
        >
          <Clock className="mr-2 h-4 w-4 flex-shrink-0" />
          <span>{value || placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[200px] p-0"
        align="start"
        sideOffset={4}
      >
        <div className="flex border-b border-border px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground flex-1 text-center">Hour</span>
          <span className="text-xs font-medium text-muted-foreground flex-1 text-center">Min</span>
        </div>
        <div className="flex h-[220px]">
          {/* Hours column */}
          <div
            ref={hourListRef}
            className="flex-1 overflow-y-auto border-r border-border scrollbar-thin py-1"
          >
            {HOURS.map((hour) => (
              <button
                key={hour}
                type="button"
                onClick={() => handleSelect(hour, selectedMinute || "00")}
                className={cn(
                  "w-full px-3 py-1.5 text-sm text-center transition-colors hover:bg-accent",
                  selectedHour === hour
                    ? "bg-primary text-primary-foreground font-medium hover:bg-primary/90"
                    : "text-foreground"
                )}
              >
                {hour}
              </button>
            ))}
          </div>

          {/* Minutes column */}
          <div
            ref={minuteListRef}
            className="flex-1 overflow-y-auto scrollbar-thin py-1"
          >
            {MINUTES.map((minute) => (
              <button
                key={minute}
                type="button"
                onClick={() => handleSelect(selectedHour || "08", minute)}
                className={cn(
                  "w-full px-3 py-1.5 text-sm text-center transition-colors hover:bg-accent",
                  selectedMinute === minute
                    ? "bg-primary text-primary-foreground font-medium hover:bg-primary/90"
                    : "text-foreground"
                )}
              >
                {minute}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
