import { useCallback, useState } from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { Stripe } from "@stripe/stripe-js";
import { Loader2 } from "lucide-react";

interface StripeEmbeddedCheckoutProps {
  clientSecret: string;
  stripeInstance: Promise<Stripe | null>;
  onComplete?: () => void;
}

export function StripeEmbeddedCheckout({ clientSecret, stripeInstance, onComplete }: StripeEmbeddedCheckoutProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // EmbeddedCheckoutProvider requires fetchClientSecret as an async callback
  const fetchClientSecret = useCallback(async () => {
    console.log("[StripeEmbeddedCheckout] Fetching client secret...");
    return clientSecret;
  }, [clientSecret]);

  const handleReady = useCallback(() => {
    console.log("[StripeEmbeddedCheckout] Checkout form ready");
    setIsLoading(false);
  }, []);

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
        stripe={stripeInstance}
        options={{ 
          fetchClientSecret,
          onComplete: handleComplete,
        }}
      >
        <div onLoad={() => setIsLoading(false)}>
          <EmbeddedCheckout className="w-full" />
        </div>
      </EmbeddedCheckoutProvider>
    </div>
  );
}
