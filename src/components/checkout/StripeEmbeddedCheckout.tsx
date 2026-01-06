import { useCallback } from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY!);

interface StripeEmbeddedCheckoutProps {
  clientSecret: string;
}

export function StripeEmbeddedCheckout({ clientSecret }: StripeEmbeddedCheckoutProps) {
  // EmbeddedCheckoutProvider requires fetchClientSecret as an async callback
  const fetchClientSecret = useCallback(() => {
    return Promise.resolve(clientSecret);
  }, [clientSecret]);

  return (
    <EmbeddedCheckoutProvider
      stripe={stripePromise}
      options={{ fetchClientSecret }}
    >
      <EmbeddedCheckout className="w-full" />
    </EmbeddedCheckoutProvider>
  );
}
