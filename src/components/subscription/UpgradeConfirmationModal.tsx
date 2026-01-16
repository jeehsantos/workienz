import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, DollarSign, Gift, ArrowRight } from "lucide-react";

interface UpgradeConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlanName: string;
  targetPlanId: string;
  targetPlanName: string;
  targetPlanPriceCents: number;
  creditAmountCents: number;
  originalCreditCents: number;
  creditSourcePlan: string;
  entitlementsToDeactivate: string[];
  warningMessage: string;
  isSubscription: boolean;
}

export function UpgradeConfirmationModal({
  isOpen,
  onClose,
  currentPlanName,
  targetPlanId,
  targetPlanName,
  targetPlanPriceCents,
  creditAmountCents,
  originalCreditCents,
  creditSourcePlan,
  entitlementsToDeactivate,
  warningMessage,
  isSubscription,
}: UpgradeConfirmationModalProps) {
  const [confirmed, setConfirmed] = useState(false);
  const navigate = useNavigate();

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const finalAmount = Math.max(0, targetPlanPriceCents - creditAmountCents);

  const handleProceed = () => {
    // Navigate to checkout with credit info
    const params = new URLSearchParams({
      plan: targetPlanId,
      applyCredit: "true",
      creditAmount: creditAmountCents.toString(),
      entitlements: entitlementsToDeactivate.join(","),
    });
    navigate(`/checkout?${params.toString()}`);
    onClose();
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            Upgrade with Credit
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left space-y-4">
            <p>
              You have an unused <strong>{creditSourcePlan}</strong> that can be 
              credited toward your {targetPlanName} {isSubscription ? "subscription" : "purchase"}.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          {/* Price breakdown */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">{targetPlanName}</span>
              <span className="font-medium">{formatPrice(targetPlanPriceCents)}</span>
            </div>
            <div className="flex justify-between items-center text-green-600">
              <span className="flex items-center gap-1">
                <DollarSign className="h-4 w-4" />
                Credit ({creditSourcePlan})
              </span>
              <span>-{formatPrice(creditAmountCents)}</span>
            </div>
            <div className="border-t pt-2 mt-2 flex justify-between items-center font-semibold">
              <span>
                {isSubscription ? "Pay today" : "Total"}
              </span>
              <span className="text-lg">{formatPrice(finalAmount)}</span>
            </div>
            {isSubscription && (
              <p className="text-xs text-muted-foreground mt-2">
                Future billing: {formatPrice(targetPlanPriceCents)}/{targetPlanId.includes("quarterly") ? "quarter" : "month"}
              </p>
            )}
          </div>

          {/* Warning */}
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
            <div className="flex gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800 dark:text-amber-200">
                <p className="font-medium mb-1">Important</p>
                <p>{warningMessage}</p>
              </div>
            </div>
          </div>

          {/* Confirmation checkbox */}
          <div className="flex items-start gap-3 pt-2">
            <Checkbox
              id="confirm-deactivation"
              checked={confirmed}
              onCheckedChange={(checked) => setConfirmed(checked === true)}
            />
            <label
              htmlFor="confirm-deactivation"
              className="text-sm text-muted-foreground cursor-pointer leading-tight"
            >
              I understand my current {currentPlanName} entitlement will be deactivated
              and its value will be credited to this purchase.
            </label>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleProceed}
            disabled={!confirmed}
            className="gap-2"
          >
            Proceed to Checkout
            <ArrowRight className="h-4 w-4" />
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
