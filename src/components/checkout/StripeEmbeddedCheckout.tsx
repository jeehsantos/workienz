import { useCallback } from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY!);

interface StripeEmbeddedCheckoutProps {
  clientSecret: string;
  onComplete?: () => void;
}

export function StripeEmbeddedCheckout({ clientSecret, onComplete }: StripeEmbeddedCheckoutProps) {
  // EmbeddedCheckoutProvider requires fetchClientSecret as an async callback
  const fetchClientSecret = useCallback(async () => {
    return clientSecret;
  }, [clientSecret]);

  return (
    <EmbeddedCheckoutProvider
      stripe={stripePromise}
      options={{ 
        fetchClientSecret,
        onComplete,
      }}
    >
      <EmbeddedCheckout className="w-full" />
    </EmbeddedCheckoutProvider>
  );
}
