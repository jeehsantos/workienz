import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  CreditCard, 
  Calendar, 
  Check, 
  Crown, 
  ArrowRight,
  ExternalLink,
  Sparkles,
  XCircle,
  AlertTriangle,
  Clock
} from "lucide-react";
import { format } from "date-fns";

interface Subscription {
  id: string;
  plan_name: string;
  status: string;
  starts_at: string;
  ends_at: string | null;
  stripe_subscription_id: string | null;
}

interface PlanProduct {
  plan_id: string;
  plan_name: string;
  plan_type: string;
  description: string | null;
  price_cents: number;
  interval: string | null;
  features: string[] | null | unknown;
}

interface PendingChange {
  newPlanId: string;
  newPlanName: string;
  effectiveDate: string;
}

export default function Subscription() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, isContractor, isEmployee } = useAuthContext();
  const { toast } = useToast();

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [currentPlan, setCurrentPlan] = useState<PlanProduct | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isManaging, setIsManaging] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  // Fetch subscription data
  useEffect(() => {
    const fetchSubscription = async () => {
      if (!user) return;

      try {
        // Get user's active subscription
        const { data: subData, error: subError } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("user_id", user.id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (subError) throw subError;

        if (subData) {
          setSubscription(subData);

          // Get plan details - try matching by stripe_price_id first, then by plan_name
          let planData = null;
          
          if (subData.stripe_price_id) {
            // First try to match using stripe_price_id which stores the plan_id
            const { data: planByPriceId } = await supabase
              .from("plan_products")
              .select("*")
              .eq("plan_id", subData.stripe_price_id)
              .maybeSingle();
            
            if (planByPriceId) {
              planData = planByPriceId;
            } else {
              // Try matching by actual stripe_price_id
              const { data: planByStripePriceId } = await supabase
                .from("plan_products")
                .select("*")
                .eq("stripe_price_id", subData.stripe_price_id)
                .maybeSingle();
              planData = planByStripePriceId;
            }
          }
          
          // Fallback: try matching by plan_name
          if (!planData && subData.plan_name) {
            const { data: planByName } = await supabase
              .from("plan_products")
              .select("*")
              .eq("plan_name", subData.plan_name)
              .maybeSingle();
            planData = planByName;
          }

          if (planData) {
            setCurrentPlan(planData as PlanProduct);
          }
        }
      } catch (error) {
        console.error("Error fetching subscription:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubscription();
  }, [user]);

  // Fetch pending changes
  useEffect(() => {
    const fetchPendingChanges = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase.functions.invoke("get-pending-changes");

        if (error) {
          console.error("Error fetching pending changes:", error);
          return;
        }

        if (data?.hasPendingChanges && data?.pendingChange) {
          setPendingChange({
            newPlanId: data.pendingChange.planId,
            newPlanName: data.pendingChange.planName,
            effectiveDate: data.pendingChange.effectiveDate,
          });
        }

        if (data?.cancelAtPeriodEnd) {
          setCancelAtPeriodEnd(true);
        }
      } catch (error) {
        console.error("Error fetching pending changes:", error);
      }
    };

    fetchPendingChanges();
  }, [user]);

  const handleManageSubscription = async () => {
    setIsManaging(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, "_blank");
      } else {
        throw new Error("No portal URL returned");
      }
    } catch (error: any) {
      console.error("Portal error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to open billing portal. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsManaging(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!subscription?.stripe_subscription_id) {
      toast({
        title: "Cannot Cancel",
        description: "This subscription cannot be cancelled through this portal.",
        variant: "destructive",
      });
      return;
    }

    setIsCancelling(true);
    try {
      const { data, error } = await supabase.functions.invoke("cancel-subscription", {
        body: { subscriptionId: subscription.stripe_subscription_id }
      });

      if (error) throw error;

      toast({
        title: "Subscription Cancelled",
        description: "Your subscription will remain active until the end of the current billing period.",
      });

      // Refresh subscription data
      const { data: subData } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user?.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subData) {
        setSubscription(subData);
      } else {
        setSubscription(null);
        setCurrentPlan(null);
      }
    } catch (error: any) {
      console.error("Cancel error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to cancel subscription. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatInterval = (interval: string | null) => {
    if (!interval || interval === "one_time") return "";
    return ` / ${interval}`;
  };

  // Check if the subscription is a recurring type (not one-time payment)
  const isRecurringSubscription = currentPlan?.interval && currentPlan.interval !== "one_time";
  const isOneTimePurchase = currentPlan?.interval === "one_time" || !currentPlan?.interval;

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const hasActiveSubscription = subscription && subscription.status === "active";
  const planType = isContractor() ? "contractor" : isEmployee() ? "seeker" : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="container-tight py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 font-display">My Subscription</h1>
          <p className="text-muted-foreground">
            Manage your subscription and billing details
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Current Plan Card */}
          <div className="lg:col-span-2">
            <div className="bg-card rounded-xl p-6 shadow-soft border border-border/50">
              <div className="flex items-center gap-2 mb-6">
                <CreditCard className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold font-display">Current Plan</h2>
              </div>

              {hasActiveSubscription && currentPlan ? (
                <div className="space-y-6">
                  {/* Plan Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Crown className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xl font-bold font-display">{currentPlan.plan_name}</h3>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-success/10 text-success">
                            Active
                          </span>
                        </div>
                        {currentPlan.description && (
                          <p className="text-sm text-muted-foreground">{currentPlan.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold font-display">
                        {formatPrice(currentPlan.price_cents)}
                      </span>
                      <span className="text-muted-foreground text-sm">
                        {formatInterval(currentPlan.interval)}
                      </span>
                    </div>
                  </div>

                  {/* Billing Info */}
                  <div className="grid sm:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Started</p>
                        <p className="font-medium">
                          {format(new Date(subscription.starts_at), "MMMM d, yyyy")}
                        </p>
                      </div>
                    </div>
                    {subscription.ends_at && (
                      <div className="flex items-center gap-3">
                        <Calendar className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">
                            {isOneTimePurchase 
                              ? "Expires on" 
                              : cancelAtPeriodEnd 
                                ? "Cancels on" 
                                : "Next billing"}
                          </p>
                          <p className={`font-medium ${cancelAtPeriodEnd ? "text-amber-600 dark:text-amber-400" : ""}`}>
                            {format(new Date(subscription.ends_at), "MMMM d, yyyy")}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Cancellation Warning */}
                  {cancelAtPeriodEnd && subscription.ends_at && (
                    <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                      <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-amber-800 dark:text-amber-200">
                          Subscription Cancelling
                        </p>
                        <p className="text-sm text-amber-700 dark:text-amber-300">
                          Your subscription will end on {format(new Date(subscription.ends_at), "MMMM d, yyyy")}. 
                          You'll continue to have access until then.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Pending Plan Change */}
                  {pendingChange && (
                    <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                      <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-blue-800 dark:text-blue-200">
                          Pending Plan Change
                        </p>
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                          Your plan will change to <strong>{pendingChange.newPlanName}</strong> on{" "}
                          {format(new Date(pendingChange.effectiveDate), "MMMM d, yyyy")}.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Features */}
                  {currentPlan.features && Array.isArray(currentPlan.features) && currentPlan.features.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-3">Your plan includes:</p>
                      <ul className="grid sm:grid-cols-2 gap-2">
                        {(currentPlan.features as string[]).map((feature, index) => (
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

                  {/* Actions */}
                  <div className="flex flex-wrap gap-3 pt-4 border-t border-border/50">
                    {subscription.stripe_subscription_id && (
                      <Button
                        onClick={handleManageSubscription}
                        disabled={isManaging}
                        variant="outline"
                      >
                        {isManaging ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <ExternalLink className="w-4 h-4 mr-2" />
                        )}
                        Manage Billing
                      </Button>
                    )}
                    {isRecurringSubscription && subscription.stripe_subscription_id && !cancelAtPeriodEnd && (
                      <Button
                        onClick={handleCancelSubscription}
                        disabled={isCancelling}
                        variant="destructive"
                      >
                        {isCancelling ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <XCircle className="w-4 h-4 mr-2" />
                        )}
                        Cancel Subscription
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                /* No Active Subscription */
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No Active Subscription</h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    {planType === "seeker"
                      ? "You're on the free tier. Upgrade to unlock more applications and premium features."
                      : planType === "contractor"
                      ? "Subscribe to start posting jobs and finding workers."
                      : "Choose a plan that fits your needs."}
                  </p>
                  <Button asChild>
                    <Link to="/pricing">
                      View Plans
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Links */}
            <div className="bg-card rounded-xl p-6 shadow-soft border border-border/50">
              <h3 className="font-semibold mb-4">Quick Links</h3>
              <ul className="space-y-3">
                <li>
                  <Link
                    to="/pricing"
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowRight className="w-4 h-4" />
                    View all plans
                  </Link>
                </li>
                <li>
                  <Link
                    to="/dashboard"
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowRight className="w-4 h-4" />
                    Back to dashboard
                  </Link>
                </li>
              </ul>
            </div>

            {/* Help Card */}
            <div className="bg-primary/5 rounded-xl p-6 border border-primary/10">
              <h3 className="font-semibold mb-2">Need Help?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Have questions about your subscription? We're here to help.
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link to="/contact">Contact Support</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
