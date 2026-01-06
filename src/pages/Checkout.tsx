import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { useAuthContext } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Check, CreditCard, Shield, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StripePaymentForm } from "@/components/checkout/StripePaymentForm";

// Load Stripe outside of component to avoid recreating on re-render
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY!);

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

  // Create payment intent or checkout session when user clicks payment button
  const handleStartPayment = async () => {
    if (!plan || !user || clientSecret) return;

    setShowPaymentForm(true);
    setIsCreatingIntent(true);

    try {
      console.log("[Checkout] Creating payment intent for plan:", plan.plan_id);
      const { data, error } = await supabase.functions.invoke("create-payment-intent", {
        body: { planId: plan.plan_id },
      });

      if (error) throw error;

      if (data?.clientSecret) {
        console.log("[Checkout] Client secret received");
        setClientSecret(data.clientSecret);
      } else {
        throw new Error("No client secret returned");
      }
    } catch (error: any) {
      console.error("[Checkout] Error creating payment intent:", error);
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

  const handlePaymentSuccess = () => {
    setPaymentSuccess(true);
    toast({
      title: "Payment Successful! 🎉",
      description: `Your ${plan?.plan_name || "subscription"} is now active.`,
      duration: 5000,
    });

    // Redirect to subscription page after a short delay
    setTimeout(() => {
      navigate("/subscription");
    }, 2000);
  };

  const handlePaymentError = (error: string) => {
    console.error("[Checkout] Payment error:", error);
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
      <div className="w-full max-w-lg mx-auto">
        {/* Back link */}
        <Link
          to="/pricing"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to pricing
        </Link>

        <div className="bg-card rounded-2xl shadow-medium p-8 border border-border/50">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <CreditCard className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold font-display mb-2">Complete Your Purchase</h1>
            <p className="text-muted-foreground">
              Enter your payment details below
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
                  {features.slice(0, 3).map((feature, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm text-foreground/80">
                      <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                  {features.length > 3 && (
                    <li className="text-xs text-muted-foreground">+{features.length - 3} more</li>
                  )}
                </ul>
              </div>
            )}
          </div>

          {/* Test Card Info (Dev Mode Only) */}
          {isDev && (
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-4 mb-6 border border-blue-200 dark:border-blue-800">
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

          {/* Stripe Payment Form */}
          {!showPaymentForm ? (
            // Show Payment Button initially
            <div className="space-y-4">
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
          ) : clientSecret ? (
            // Payment Element for all payments
            <Elements
              stripe={stripePromise}
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
              <Shield className="w-8 h-8 text-muted-foreground mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">Unable to initialize payment.</p>
              <button
                onClick={() => {
                  setClientSecret(null);
                  setShowPaymentForm(false);
                }}
                className="text-primary hover:underline text-sm mt-2"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
