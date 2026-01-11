import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { loadStripe, Stripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { useAuthContext } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Check, CreditCard, Shield, Info, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StripePaymentForm } from "@/components/checkout/StripePaymentForm";
import { StripeEmbeddedCheckout } from "@/components/checkout/StripeEmbeddedCheckout";
// Stripe publishable key (safe to expose in frontend)
const STRIPE_PUBLISHABLE_KEY = "pk_test_51SlOSuLpM66OQZ3PLtksU9feUwDZ1AImfhFr6Kn8s6uSZ5v1Wi7kbblbcVJA9p3TLTd3T0O837IHeElItmvNbOB900WMcPPR4K";

interface PlanProduct {
  id: string;
  plan_id: string;
  plan_name: string;
  plan_type: string;
  description: string | null;
  price_cents: number;
  interval: string | null;
  features: string[] | null;
}

export default function Checkout() {
  const [searchParams] = useSearchParams();
  const planId = searchParams.get("plan");
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuthContext();
  const { toast } = useToast();

  const [plan, setPlan] = useState<PlanProduct | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isCreatingIntent, setIsCreatingIntent] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);
  const [stripeInstance, setStripeInstance] = useState<Stripe | null>(null);
  const [paymentType, setPaymentType] = useState<"payment" | "embedded_checkout" | null>(null);
  const stripeLoadAttempted = useRef(false);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      if (planId) {
        navigate(`/auth?mode=signup&plan=${planId}`);
      } else {
        navigate("/auth");
      }
    }
  }, [user, authLoading, navigate, planId]);

  // Fetch plan details
  useEffect(() => {
    const fetchPlan = async () => {
      if (!planId) {
        navigate("/pricing");
        return;
      }

      const { data, error } = await supabase
        .from("plan_products")
        .select("*")
        .eq("plan_id", planId)
        .single();

      if (error || !data) {
        toast({
          title: "Plan not found",
          description: "The selected plan could not be found.",
          variant: "destructive",
        });
        navigate("/pricing");
        return;
      }

      setPlan(data as PlanProduct);
      setIsLoading(false);
    };

    if (user) {
      fetchPlan();
    }
  }, [planId, user, navigate, toast]);

  // Create a promise for the Stripe instance
  const stripePromise = useRef<Promise<Stripe | null> | null>(null);

  // Load Stripe when user clicks pay - only load once
  const initializeStripe = async () => {
    if (stripeLoadAttempted.current) return stripeInstance;
    stripeLoadAttempted.current = true;

    try {
      const stripe = await loadStripe(STRIPE_PUBLISHABLE_KEY);
      setStripeInstance(stripe);
      stripePromise.current = Promise.resolve(stripe);
      return stripe;
    } catch (error) {
      console.error("[Checkout] Failed to load Stripe:", error);
      setStripeError("Failed to initialize payment system.");
      return null;
    }
  };

  // Create payment intent when user clicks payment button
  const handleStartPayment = async () => {
    if (!plan || !user || clientSecret) return;

    setShowPaymentForm(true);
    setIsCreatingIntent(true);
    setStripeError(null);

    try {
      console.log("[Checkout] Creating payment intent for plan:", plan.plan_id);
      const { data, error } = await supabase.functions.invoke("create-payment-intent", {
        body: { planId: plan.plan_id },
      });

      if (error) throw error;

      // Handle embedded checkout for subscriptions
      if (data?.type === "embedded_checkout" && data?.clientSecret) {
        console.log("[Checkout] Using embedded checkout for subscription");
        const stripe = await initializeStripe();
        if (!stripe) {
          setIsCreatingIntent(false);
          return;
        }
        setPaymentType("embedded_checkout");
        setClientSecret(data.clientSecret);
      }
      // Handle payment intent for one-time payments
      else if (data?.type === "payment" && data?.clientSecret) {
        const stripe = await initializeStripe();
        if (!stripe) {
          setIsCreatingIntent(false);
          return;
        }
        console.log("[Checkout] Client secret received for payment intent");
        setPaymentType("payment");
        setClientSecret(data.clientSecret);
      } else {
        throw new Error("Invalid response from payment service");
      }
    } catch (error: any) {
      console.error("[Checkout] Error creating payment intent:", error);
      setStripeError(error.message || "Failed to initialize payment");
      toast({
        title: "Setup failed",
        description: error.message || "Failed to initialize payment. Please try again.",
        variant: "destructive",
      });
      setShowPaymentForm(false);
    } finally {
      setIsCreatingIntent(false);
    }
  };

  const handlePaymentSuccess = async (paymentIntentId: string) => {
    try {
      const { error } = await supabase.functions.invoke("finalize-purchase", {
        body: {
          paymentIntentId,
          planId: plan?.plan_id,
        },
      });

      if (error) throw error;

      setPaymentSuccess(true);
      toast({
        title: "Payment Successful! 🎉",
        description: `Your ${plan?.plan_name || "subscription"} is now active.`,
        duration: 5000,
      });

      setTimeout(() => {
        navigate("/subscription");
      }, 2000);
    } catch (error: any) {
      console.error("[Checkout] finalize-purchase failed:", error);
      setPaymentSuccess(true);
      toast({
        title: "Payment received",
        description:
          "Your payment went through, but we couldn't sync your subscription yet. Please refresh your Subscription page in a moment.",
        variant: "destructive",
        duration: 7000,
      });

      setTimeout(() => {
        navigate("/subscription");
      }, 2000);
    }
  };

  const handlePaymentError = (error: string) => {
    console.error("[Checkout] Payment error:", error);
  };

  const handleRetry = () => {
    setClientSecret(null);
    setShowPaymentForm(false);
    setStripeError(null);
    setPaymentType(null);
    stripeLoadAttempted.current = false;
    setStripeInstance(null);
  };

  const handleEmbeddedCheckoutComplete = () => {
    console.log("[Checkout] Embedded checkout completed");
    setPaymentSuccess(true);
    toast({
      title: "Payment Successful! 🎉",
      description: `Your ${plan?.plan_name || "subscription"} is now active.`,
      duration: 5000,
    });
    setTimeout(() => {
      navigate("/subscription");
    }, 2000);
  };

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatInterval = (interval: string | null) => {
    if (!interval || interval === "one_time") return "";
    return `/${interval}`;
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !plan) {
    return null;
  }

  if (paymentSuccess) {
    return (
      <main className="min-h-screen gradient-hero flex items-center justify-center p-4 py-12">
        <div className="w-full max-w-lg mx-auto text-center">
          <div className="bg-card rounded-2xl shadow-medium p-8 border border-border/50">
            <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-6">
              <Check className="w-10 h-10 text-success" />
            </div>
            <h1 className="text-2xl font-bold font-display mb-4">Payment Successful!</h1>
            <p className="text-muted-foreground mb-4">
              Your {plan.plan_name} is now active.
            </p>
            <p className="text-sm text-muted-foreground">
              Redirecting to your subscription page...
            </p>
          </div>
        </div>
      </main>
    );
  }

  const features = plan.features || [];
  const isDev = import.meta.env.DEV;

  return (
    <main className="min-h-screen gradient-hero flex items-center justify-center p-4 py-12">
      <div className="w-full max-w-5xl mx-auto">
        {/* Back link */}
        <Link
          to="/pricing"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to pricing
        </Link>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Order Summary */}
          <div className="bg-card rounded-2xl shadow-medium p-8 border border-border/50 h-fit">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <CreditCard className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-2xl font-bold font-display mb-2">Complete Your Purchase</h1>
              <p className="text-muted-foreground">
                Review your order details
              </p>
            </div>

            {/* Plan Summary */}
            <div className="bg-muted/30 rounded-xl p-4 mb-6 border border-border/30">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {plan.plan_type === "contractor" ? "Employer Plan" : "Job Seeker Plan"}
                  </span>
                  <h2 className="text-lg font-bold font-display">{plan.plan_name}</h2>
                </div>
                <div className="text-right">
                  <span className="text-xl font-bold font-display">{formatPrice(plan.price_cents)}</span>
                  <span className="text-muted-foreground text-sm">{formatInterval(plan.interval)}</span>
                </div>
              </div>

              {/* Features */}
              {features.length > 0 && (
                <div className="pt-3 mt-3 border-t border-border/30">
                  <ul className="space-y-1">
                    {features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-2 text-sm text-foreground/80">
                        <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Test Card Info (Dev Mode Only) */}
            {isDev && (
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-blue-900 dark:text-blue-200 mb-2">Test Mode - Use these credentials:</p>
                    <div className="space-y-1 text-blue-800 dark:text-blue-300 font-mono text-xs">
                      <p>Card: <span className="font-bold">4242 4242 4242 4242</span></p>
                      <p>Expiry: <span className="font-bold">12/34</span> (any future date)</p>
                      <p>CVC: <span className="font-bold">123</span> (any 3 digits)</p>
                      <p>ZIP: <span className="font-bold">12345</span> (any valid ZIP)</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Payment Form */}
          <div className="bg-card rounded-2xl shadow-medium p-8 border border-border/50">
            <h2 className="text-lg font-bold font-display mb-6">Payment Details</h2>

            {!showPaymentForm ? (
              // Show Payment Button initially
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground mb-4">
                  Click the button below to enter your payment details securely.
                </p>
                <Button
                  onClick={handleStartPayment}
                  className="w-full"
                  size="lg"
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Pay {formatPrice(plan.price_cents)}
                </Button>
                <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Secure payment powered by Stripe</span>
                </div>
              </div>
            ) : isCreatingIntent ? (
              <div className="py-12 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">Setting up secure payment...</p>
              </div>
            ) : stripeError ? (
              <div className="py-12 text-center">
                <AlertTriangle className="w-8 h-8 text-destructive mx-auto mb-4" />
                <p className="text-sm text-muted-foreground mb-2">{stripeError}</p>
                <button
                  onClick={handleRetry}
                  className="text-primary hover:underline text-sm mt-2"
                >
                  Try again
                </button>
              </div>
            ) : clientSecret && stripeInstance && stripePromise.current && paymentType === "embedded_checkout" ? (
              // Embedded Checkout for subscriptions
              <StripeEmbeddedCheckout
                clientSecret={clientSecret}
                stripeInstance={stripePromise.current}
                onComplete={handleEmbeddedCheckoutComplete}
              />
            ) : clientSecret && stripeInstance && paymentType === "payment" ? (
              // Payment Element for one-time payments
              <Elements
                stripe={stripeInstance}
                options={{
                  clientSecret,
                  appearance: {
                    theme: "stripe",
                    variables: {
                      colorPrimary: "#6366f1",
                      colorBackground: "#ffffff",
                      colorText: "#1f2937",
                      colorDanger: "#ef4444",
                      fontFamily: "system-ui, sans-serif",
                      borderRadius: "8px",
                    },
                  },
                }}
                key={clientSecret}
              >
                <StripePaymentForm
                  priceFormatted={formatPrice(plan.price_cents)}
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                />
              </Elements>
            ) : (
              <div className="py-12 text-center">
                <AlertTriangle className="w-8 h-8 text-destructive mx-auto mb-4" />
                <p className="text-sm text-muted-foreground mb-2">Unable to initialize payment.</p>
                <button
                  onClick={handleRetry}
                  className="text-primary hover:underline text-sm mt-2"
                >
                  Try again
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
