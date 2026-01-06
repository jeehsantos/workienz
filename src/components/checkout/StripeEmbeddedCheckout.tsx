import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY!);

interface StripeEmbeddedCheckoutProps {
  clientSecret: string;
}

export function StripeEmbeddedCheckout({ clientSecret }: StripeEmbeddedCheckoutProps) {
  return (
    <EmbeddedCheckoutProvider
      stripe={stripePromise}
      options={{ clientSecret }}
    >
      <EmbeddedCheckout className="w-full" />
    </EmbeddedCheckoutProvider>
  );
}
