import * as React from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Clock, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TimePickerProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
const minutes = ["00", "15", "30", "45"];

export function TimePicker({
  value,
  onChange,
  placeholder = "Select time",
  disabled = false,
  className,
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [selectedHour, setSelectedHour] = React.useState<string | null>(
    value ? value.split(":")[0] : null
  );
  const [selectedMinute, setSelectedMinute] = React.useState<string | null>(
    value ? value.split(":")[1] : null
  );

  React.useEffect(() => {
    if (value) {
      const [h, m] = value.split(":");
      setSelectedHour(h);
      setSelectedMinute(m);
    }
  }, [value]);

  const handleHourSelect = (hour: string) => {
    setSelectedHour(hour);
    if (selectedMinute) {
      onChange(`${hour}:${selectedMinute}`);
    }
  };

  const handleMinuteSelect = (minute: string) => {
    setSelectedMinute(minute);
    if (selectedHour) {
      onChange(`${selectedHour}:${minute}`);
      setOpen(false);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedHour(null);
    setSelectedMinute(null);
    onChange("");
  };

  const displayValue = value
    ? `${value.split(":")[0]}:${value.split(":")[1]}`
    : null;

  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <Clock className="mr-2 h-4 w-4" />
          {displayValue || placeholder}
          {value && (
            <X
              className="ml-auto h-4 w-4 opacity-50 hover:opacity-100"
              onClick={handleClear}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start" sideOffset={4}>
        <div className="flex">
          {/* Hours */}
          <div className="border-r">
            <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b">
              Hour
            </div>
            <ScrollArea className="h-[200px]">
              <div className="p-1">
                {hours.map((hour) => (
                  <Button
                    key={hour}
                    variant={selectedHour === hour ? "default" : "ghost"}
                    size="sm"
                    className={cn(
                      "w-full justify-center mb-0.5",
                      selectedHour === hour && "bg-primary text-primary-foreground"
                    )}
                    onClick={() => handleHourSelect(hour)}
                  >
                    {hour}
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </div>
          {/* Minutes */}
          <div>
            <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b">
              Min
            </div>
            <ScrollArea className="h-[200px]">
              <div className="p-1">
                {minutes.map((minute) => (
                  <Button
                    key={minute}
                    variant={selectedMinute === minute ? "default" : "ghost"}
                    size="sm"
                    className={cn(
                      "w-full justify-center mb-0.5",
                      selectedMinute === minute && "bg-primary text-primary-foreground"
                    )}
                    onClick={() => handleMinuteSelect(minute)}
                  >
                    {minute}
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
        {/* Quick select common times */}
        <div className="border-t p-2">
          <div className="text-xs font-medium text-muted-foreground mb-2">Quick select</div>
          <div className="flex flex-wrap gap-1">
            {["06:00", "08:00", "09:00", "12:00", "17:00", "18:00"].map((time) => (
              <Button
                key={time}
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => {
                  const [h, m] = time.split(":");
                  setSelectedHour(h);
                  setSelectedMinute(m);
                  onChange(time);
                  setOpen(false);
                }}
              >
                {time}
              </Button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
