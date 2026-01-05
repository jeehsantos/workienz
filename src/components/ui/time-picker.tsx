import * as React from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";

interface TimePickerProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
const MINUTES = ["00", "15", "30", "45"];
const QUICK_TIMES = ["06:00", "07:00", "08:00", "09:00", "12:00", "13:00", "17:00", "18:00"];

export function TimePicker({
  value,
  onChange,
  placeholder = "Select time",
  disabled = false,
  className,
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false);

  const handleTimeSelect = (time: string) => {
    onChange(time);
    setOpen(false);
  };

  const handleHourMinuteSelect = (hour: string, minute: string) => {
    onChange(`${hour}:${minute}`);
    setOpen(false);
  };

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
        className="w-[280px] p-0" 
        align="start" 
        sideOffset={4}
        side="top"
      >
        {/* Quick select times */}
        <div className="p-3 border-b">
          <p className="text-xs font-medium text-muted-foreground mb-2">Quick select</p>
          <div className="grid grid-cols-4 gap-1">
            {QUICK_TIMES.map((time) => (
              <Button
                key={time}
                variant={value === time ? "default" : "outline"}
                size="sm"
                className="text-xs h-8"
                onClick={() => handleTimeSelect(time)}
              >
                {time}
              </Button>
            ))}
          </div>
        </div>

        {/* Hour and Minute grid */}
        <div className="p-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">Or select hour & minute</p>
          <div className="flex gap-3">
            {/* Hours */}
            <div className="flex-1">
              <p className="text-[10px] text-muted-foreground mb-1 text-center">Hour</p>
              <div className="grid grid-cols-4 gap-1 max-h-[140px] overflow-y-auto">
                {HOURS.map((hour) => (
                  <Button
                    key={hour}
                    variant={value?.startsWith(hour + ":") ? "default" : "ghost"}
                    size="sm"
                    className="text-xs h-7 px-2"
                    onClick={() => {
                      const currentMinute = value?.split(":")[1] || "00";
                      handleHourMinuteSelect(hour, currentMinute);
                    }}
                  >
                    {hour}
                  </Button>
                ))}
              </div>
            </div>

            {/* Minutes */}
            <div className="w-16">
              <p className="text-[10px] text-muted-foreground mb-1 text-center">Min</p>
              <div className="flex flex-col gap-1">
                {MINUTES.map((minute) => (
                  <Button
                    key={minute}
                    variant={value?.endsWith(":" + minute) ? "default" : "ghost"}
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => {
                      const currentHour = value?.split(":")[0] || "09";
                      handleHourMinuteSelect(currentHour, minute);
                    }}
                  >
                    :{minute}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
