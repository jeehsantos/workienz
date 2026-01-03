import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Check, CreditCard, Shield } from "lucide-react";

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
  const [isProcessing, setIsProcessing] = useState(false);

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

  const handleConfirmAndPay = async () => {
    if (!plan || !user) return;

    setIsProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: { planId: plan.plan_id },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (error: any) {
      console.error("Checkout error:", error);
      toast({
        title: "Checkout failed",
        description: error.message || "Failed to create checkout session. Please try again.",
        variant: "destructive",
      });
      setIsProcessing(false);
    }
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

  const features = plan.features || [];

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
            <h1 className="text-2xl font-bold font-display mb-2">Review Your Selection</h1>
            <p className="text-muted-foreground">
              Confirm your plan before proceeding to payment
            </p>
          </div>

          {/* Plan Details */}
          <div className="bg-muted/30 rounded-xl p-6 mb-6 border border-border/30">
            <div className="flex items-start justify-between mb-4">
              <div>
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {plan.plan_type === "contractor" ? "Employer Plan" : "Job Seeker Plan"}
                </span>
                <h2 className="text-xl font-bold font-display">{plan.plan_name}</h2>
                {plan.description && (
                  <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                )}
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold font-display">{formatPrice(plan.price_cents)}</span>
                <span className="text-muted-foreground text-sm">{formatInterval(plan.interval)}</span>
                {plan.price_cents > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">+ GST</p>
                )}
              </div>
            </div>

            {/* Features */}
            {features.length > 0 && (
              <div className="pt-4 border-t border-border/30">
                <p className="text-sm font-medium mb-3">Includes:</p>
                <ul className="space-y-2">
                  {features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <div className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-2.5 h-2.5 text-primary" />
                      </div>
                      <span className="text-sm text-foreground/80">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Security Note */}
          <div className="flex items-center gap-3 text-sm text-muted-foreground mb-6 p-3 bg-muted/20 rounded-lg">
            <Shield className="w-5 h-5 text-primary flex-shrink-0" />
            <span>Your payment is secured by Stripe. We never store your card details.</span>
          </div>

          {/* CTA Button */}
          <Button
            onClick={handleConfirmAndPay}
            disabled={isProcessing}
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
                Confirm & Pay {formatPrice(plan.price_cents)}
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground mt-4">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </main>
  );
}
