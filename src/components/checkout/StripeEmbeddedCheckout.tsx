import { useCallback, useState } from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Loader2 } from "lucide-react";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY!);

interface StripeEmbeddedCheckoutProps {
  clientSecret: string;
  onComplete?: () => void;
}

export function StripeEmbeddedCheckout({ clientSecret, onComplete }: StripeEmbeddedCheckoutProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // EmbeddedCheckoutProvider requires fetchClientSecret as an async callback
  const fetchClientSecret = useCallback(async () => {
    console.log("[StripeEmbeddedCheckout] Fetching client secret...");
    return clientSecret;
  }, [clientSecret]);

  const handleComplete = useCallback(() => {
    console.log("[StripeEmbeddedCheckout] Checkout completed");
    onComplete?.();
  }, [onComplete]);

  if (error) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-destructive mb-2">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="text-primary hover:underline text-sm"
        >
          Refresh and try again
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-[400px] relative">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Loading payment form...</p>
          </div>
        </div>
      )}
      <EmbeddedCheckoutProvider
        stripe={stripePromise}
        options={{ 
          fetchClientSecret,
          onComplete: handleComplete,
        }}
      >
        <EmbeddedCheckout 
          className="w-full"
          onLoadError={(event) => {
            console.error("[StripeEmbeddedCheckout] Load error:", event);
            setError("Failed to load payment form. Please try again.");
            setIsLoading(false);
          }}
          onReady={() => {
            console.log("[StripeEmbeddedCheckout] Ready");
            setIsLoading(false);
          }}
        />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
