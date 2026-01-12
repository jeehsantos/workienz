import { useCallback, useState, useEffect, useRef } from "react";
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
  const containerRef = useRef<HTMLDivElement>(null);
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // EmbeddedCheckoutProvider requires fetchClientSecret as an async callback
  const fetchClientSecret = useCallback(async () => {
    console.log("[StripeEmbeddedCheckout] Fetching client secret...");
    return clientSecret;
  }, [clientSecret]);

  const handleComplete = useCallback(() => {
    console.log("[StripeEmbeddedCheckout] Checkout completed");
    onComplete?.();
  }, [onComplete]);

  // Clear loading state when we have what we need to render
  // and add a failsafe timeout
  useEffect(() => {
    if (clientSecret && stripeInstance) {
      // Use requestAnimationFrame + setTimeout to ensure DOM has time to render
      requestAnimationFrame(() => {
        setTimeout(() => {
          console.log("[StripeEmbeddedCheckout] Clearing loading state after render");
          setIsLoading(false);
        }, 100);
      });
    }

    // Failsafe: if still loading after 6 seconds, force clear
    loadingTimeoutRef.current = setTimeout(() => {
      if (isLoading) {
        console.log("[StripeEmbeddedCheckout] Failsafe: forcing loading state to false");
        setIsLoading(false);
      }
    }, 6000);

    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [clientSecret, stripeInstance]);

  // Also detect when Stripe embeds its iframe using MutationObserver
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          // Check if Stripe has added its iframe
          const iframe = containerRef.current?.querySelector('iframe');
          if (iframe) {
            console.log("[StripeEmbeddedCheckout] Stripe iframe detected, clearing loading state");
            setIsLoading(false);
            observer.disconnect();
            break;
          }
        }
      }
    });

    observer.observe(containerRef.current, { 
      childList: true, 
      subtree: true 
    });

    return () => observer.disconnect();
  }, []);

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
    <div className="min-h-[400px] relative" ref={containerRef}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10 pointer-events-none">
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
        <EmbeddedCheckout className="w-full" />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
