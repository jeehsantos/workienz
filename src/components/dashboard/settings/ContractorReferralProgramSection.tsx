import { useState } from "react";
import { ChevronDown, ChevronUp, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ContractorReferralDashboard } from "@/components/referrals/ContractorReferralDashboard";

export function ContractorReferralProgramSection() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-between p-4 h-auto hover:bg-muted/50"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
              <Gift className="w-5 h-5 text-accent-foreground" />
            </div>
            <div className="text-left">
              <h4 className="font-semibold">Contractor Referral Program</h4>
              <p className="text-sm text-muted-foreground">
                Refer contractors and earn Premium access
              </p>
            </div>
          </div>
          {isOpen ? (
            <ChevronUp className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          )}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4">
        <div className="pt-4 border-t mt-2">
          <ContractorReferralDashboard />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
