import { useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
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
import { ArrowUp, ArrowDown, Loader2, Calendar, AlertTriangle, Info } from "lucide-react";

interface PlanChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlanId: string;
  currentPlanName: string;
  currentPrice: number;
  newPlanId: string;
  newPlanName: string;
  newPrice: number;
  nextBillingDate: string | null;
  isCurrentPlanOneTime?: boolean; // Whether current plan is a one-time purchase (no billing cycle)
  onSuccess: () => void;
}

export function PlanChangeModal({
  isOpen,
  onClose,
  currentPlanId,
  currentPlanName,
  currentPrice,
  newPlanId,
  newPlanName,
  newPrice,
  nextBillingDate,
  isCurrentPlanOneTime = false,
  onSuccess,
}: PlanChangeModalProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const isUpgrade = newPrice > currentPrice;
  const priceDifference = Math.abs(newPrice - currentPrice);

  // Check if new plan is a subscription (not one-time)
  const oneTimePlans = ["single_post", "14_day_sprint"];
  const isNewPlanSubscription = !oneTimePlans.includes(newPlanId);

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      // If upgrading from one-time purchase to subscription, redirect to checkout
      // because there's no Stripe subscription to update
      if (isCurrentPlanOneTime && isNewPlanSubscription) {
        window.location.href = `/checkout?plan=${newPlanId}`;
        return;
      }

      const { data, error } = await supabase.functions.invoke("update-subscription", {
        body: { newPlanId },
      });

      if (error) throw error;

      toast({
        title: `Plan ${isUpgrade ? "Upgrade" : "Downgrade"} Scheduled`,
        description: data.message || `Your plan will change to ${newPlanName} on your next billing date.`,
      });

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Plan change error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update subscription. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              isUpgrade ? "bg-primary/10" : "bg-amber-500/10"
            }`}>
              {isUpgrade ? (
                <ArrowUp className="w-5 h-5 text-primary" />
              ) : (
                <ArrowDown className="w-5 h-5 text-amber-500" />
              )}
            </div>
            <AlertDialogTitle className="text-xl">
              {isUpgrade ? "Upgrade" : "Downgrade"} to {newPlanName}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="space-y-4 pt-2">
              {/* Plan comparison */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Current plan</span>
                  <span className="font-medium">{currentPlanName} ({formatPrice(currentPrice)})</span>
                </div>
                <div className="border-t border-border/50" />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">New plan</span>
                  <span className="font-semibold text-foreground">{newPlanName} ({formatPrice(newPrice)})</span>
                </div>
              </div>

              {/* Billing information - different messaging for one-time to subscription upgrade */}
              {isCurrentPlanOneTime && isNewPlanSubscription ? (
                <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg border border-primary/10">
                  <Calendar className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Start New Subscription
                    </p>
                    <p className="text-sm text-muted-foreground">
                      You'll be redirected to checkout to start your new {newPlanName} subscription. Your current one-time purchase benefits remain active until they expire.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg border border-primary/10">
                  <Calendar className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Effective on next billing date
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {nextBillingDate 
                        ? `Your plan will change on ${format(new Date(nextBillingDate), "MMMM d, yyyy")}`
                        : "Your plan will change at the start of your next billing cycle"}
                    </p>
                  </div>
                </div>
              )}

              {/* Price difference notice - only show for subscription to subscription changes */}
              {!isCurrentPlanOneTime && (
                <div className="flex items-start gap-3 p-3 bg-amber-500/5 rounded-lg border border-amber-500/10">
                  <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {isUpgrade 
                        ? `You won't be charged the difference of ${formatPrice(priceDifference)} for this billing period. The new price applies from your next billing cycle.`
                        : `Your current plan features remain active until your next billing date. The lower price of ${formatPrice(newPrice)} applies from then.`}
                    </p>
                  </div>
                </div>
              )}

              {/* Info for one-time to subscription upgrade */}
              {isCurrentPlanOneTime && isNewPlanSubscription && (
                <div className="flex items-start gap-3 p-3 bg-blue-500/5 rounded-lg border border-blue-500/10">
                  <Info className="w-5 h-5 text-blue-500 mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">
                      You'll be charged {formatPrice(newPrice)} for your first billing period. This subscription will auto-renew until cancelled.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-4">
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading}
            className={isUpgrade ? "" : "bg-amber-500 hover:bg-amber-600"}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              `Confirm ${isUpgrade ? "Upgrade" : "Downgrade"}`
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
