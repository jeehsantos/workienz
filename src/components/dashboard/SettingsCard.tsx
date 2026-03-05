import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface SettingsCardProps {
  showReferralProgram: boolean;
}

export function SettingsCard({ showReferralProgram }: SettingsCardProps) {
  const navigate = useNavigate();

  return (
    <div className="bg-card rounded-xl p-6 shadow-soft border border-border/50">
      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center mb-4">
        <Settings className="w-6 h-6 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2 font-display">Settings</h3>
      <p className="text-muted-foreground text-sm mb-4">
        Manage your account settings and preferences.
      </p>
      <Button variant="outline" size="sm" onClick={() => navigate("/settings")}>
        Open Settings
      </Button>
    </div>
  );
}
