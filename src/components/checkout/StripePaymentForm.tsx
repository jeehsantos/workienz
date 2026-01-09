import { useState, useEffect } from "react";
import {
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface StripePaymentFormProps {
  priceFormatted: string;
  onSuccess: (paymentIntentId: string) => void;
  onError: (error: string) => void;
}

export function StripePaymentForm({
  priceFormatted,
  onSuccess,
  onError,
}: StripePaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isElementsReady, setIsElementsReady] = useState(false);

  // Check if elements are ready - rely primarily on onReady callback
  useEffect(() => {
    // Only set ready to false initially, let onReady callback set it to true
    setIsElementsReady(false);
  }, [elements]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!stripe || !elements) {
      console.error("[StripePaymentForm] Stripe or Elements not loaded");
      return;
    }

    // Double-check that the Payment Element is mounted
    const paymentElement = elements.getElement(PaymentElement);
    if (!paymentElement) {
      console.error("[StripePaymentForm] Payment Element not found");
      setErrorMessage("Payment form not ready. Please refresh and try again.");
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      console.log("[StripePaymentForm] Confirming payment...");
      
      // Submit the form to collect payment method data
      const { error: submitError } = await elements.submit();
      if (submitError) {
        throw new Error(submitError.message || "Failed to submit payment form");
      }
      
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/checkout/success`,
        },
        redirect: "if_required",
      });

      if (error) {
        console.error("[StripePaymentForm] Payment error:", error);
        setErrorMessage(error.message || "An error occurred during payment.");
        onError(error.message || "Payment failed");
        toast({
          title: "Payment Failed",
          description: error.message || "An error occurred. Please try again.",
          variant: "destructive",
        });
      } else if (paymentIntent && paymentIntent.status === "succeeded") {
        console.log("[StripePaymentForm] Payment succeeded");
        if (!paymentIntent.id) {
          throw new Error("Payment succeeded but no payment intent id was returned");
        }
        onSuccess(paymentIntent.id);
      } else if (paymentIntent && paymentIntent.status === "requires_action") {
        // 3D Secure or other actions - Stripe handles this
        console.log("[StripePaymentForm] Payment requires additional action");
        toast({
          title: "Additional verification required",
          description: "Please complete the verification process.",
        });
      }
    } catch (err) {
      console.error("[StripePaymentForm] Payment exception:", err);
      const message = err instanceof Error ? err.message : "Payment failed";
      setErrorMessage(message);
      onError(message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Payment Element */}
      <div className="bg-muted/30 rounded-xl p-4 border border-border/30">
        <PaymentElement
          options={{
            layout: "tabs",
            business: { name: "Workie" },
          }}
          onReady={() => {
            console.log("[StripePaymentForm] Payment Element ready");
            setIsElementsReady(true);
          }}
          onLoadError={(error: any) => {
            console.error("[StripePaymentForm] Payment Element load error:", error);
            setErrorMessage("Failed to load payment form. Please refresh and try again.");
          }}
        />
      </div>

      {/* Error message */}
      {errorMessage && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      {/* Security Note */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Lock className="w-3.5 h-3.5" />
        <span>Your payment is secured by Stripe. We never store your card details.</span>
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={!stripe || !elements || !isElementsReady || isProcessing}
        className="w-full"
        size="lg"
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Processing...
          </>
        ) : !isElementsReady ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Loading payment form...
          </>
        ) : (
          <>
            <CreditCard className="w-4 h-4 mr-2" />
            Pay {priceFormatted}
          </>
        )}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        By continuing, you agree to our Terms of Service and Privacy Policy
      </p>
    </form>
  );
}
