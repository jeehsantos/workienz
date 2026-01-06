import { cn } from "@/lib/utils";
import { User, FileText } from "lucide-react";
import type { ProfileViewMode } from "@/types/employeeProfile";

interface ProfileViewToggleProps {
  mode: ProfileViewMode;
  onModeChange: (mode: ProfileViewMode) => void;
}

export function ProfileViewToggle({ mode, onModeChange }: ProfileViewToggleProps) {
  return (
    <div className="inline-flex items-center bg-muted rounded-lg p-1 print:hidden">
      <button
        onClick={() => onModeChange('social')}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
          mode === 'social'
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <User className="w-4 h-4" />
        Social View
      </button>
      <button
        onClick={() => onModeChange('formal')}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
          mode === 'formal'
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <FileText className="w-4 h-4" />
        Formal CV
      </button>
    </div>
  );
}
