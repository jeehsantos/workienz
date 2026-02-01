import { useState } from "react";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ResetPasswordSection } from "./settings/ResetPasswordSection";
import { ReferralProgramSection } from "./settings/ReferralProgramSection";

interface SettingsCardProps {
  showReferralProgram: boolean;
}

export function SettingsCard({ showReferralProgram }: SettingsCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-card rounded-xl p-6 shadow-soft border border-border/50">
      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center mb-4">
        <Settings className="w-6 h-6 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2 font-display">Settings</h3>
      <p className="text-muted-foreground text-sm mb-4">
        Manage your account settings and preferences.
      </p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            Open Settings
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-display">Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <ResetPasswordSection />
            {showReferralProgram && <ReferralProgramSection />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
