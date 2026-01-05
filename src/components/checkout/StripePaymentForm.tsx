import { useState } from "react";
import {
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface StripePaymentFormProps {
  planName: string;
  priceFormatted: string;
  onSuccess: () => void;
  onError: (error: string) => void;
}

export function StripePaymentForm({
  planName,
  priceFormatted,
  onSuccess,
  onError,
}: StripePaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/checkout/success`,
        },
        redirect: "if_required",
      });

      if (error) {
        setErrorMessage(error.message || "An error occurred during payment.");
        onError(error.message || "Payment failed");
        toast({
          title: "Payment Failed",
          description: error.message || "An error occurred. Please try again.",
          variant: "destructive",
        });
      } else if (paymentIntent && paymentIntent.status === "succeeded") {
        onSuccess();
      } else if (paymentIntent && paymentIntent.status === "requires_action") {
        // 3D Secure or other actions - Stripe handles this
        toast({
          title: "Additional verification required",
          description: "Please complete the verification process.",
        });
      }
    } catch (err) {
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
        disabled={!stripe || !elements || isProcessing}
        className="w-full"
        size="lg"
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Processing...
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
