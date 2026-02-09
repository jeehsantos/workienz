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
import { ContractorReferralProgramSection } from "./settings/ContractorReferralProgramSection";

interface SettingsCardProps {
  showReferralProgram: boolean;
  showContractorReferral?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SettingsCard({ showReferralProgram, showContractorReferral, open, onOpenChange }: SettingsCardProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = typeof open === "boolean";
  const dialogOpen = isControlled ? open : internalOpen;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!isControlled) {
      setInternalOpen(nextOpen);
    }

    onOpenChange?.(nextOpen);
  };

  return (
    <div className="bg-card rounded-xl p-6 shadow-soft border border-border/50">
      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center mb-4">
        <Settings className="w-6 h-6 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2 font-display">Settings</h3>
      <p className="text-muted-foreground text-sm mb-4">
        Manage your account settings and preferences.
      </p>
      <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            Open Settings
          </Button>
        </DialogTrigger>
        <DialogContent className="box-border w-[calc(100vw-1.5rem)] max-w-[600px] max-h-[85vh] overflow-y-auto rounded-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-display">Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <ResetPasswordSection />
            {showReferralProgram && <ReferralProgramSection />}
            {showContractorReferral && <ContractorReferralProgramSection />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
