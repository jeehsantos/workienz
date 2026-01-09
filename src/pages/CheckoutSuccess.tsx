import { useEffect, useState, useRef } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Sparkles, Users, Briefcase, ArrowRight, Loader2 } from "lucide-react";

export default function CheckoutSuccess() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const paymentIntentId = searchParams.get("payment_intent");
  const redirectStatus = searchParams.get("redirect_status");
  const isStripeRedirectSuccess = !!paymentIntentId && redirectStatus === "succeeded";

  const navigate = useNavigate();
  const { user, isContractor, isEmployee, isLoading } = useAuthContext();
  const { toast } = useToast();
  const [showContent, setShowContent] = useState(false);
  const [hasShownToast, setHasShownToast] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const hasFinalized = useRef(false);

  useEffect(() => {
    const shouldShowSuccess = !!sessionId || isStripeRedirectSuccess;

    if (shouldShowSuccess && !hasShownToast) {
      toast({
        title: "Payment Successful! 🎉",
        description: "Your subscription is now active. Enjoy all the benefits!",
        duration: 5000,
      });
      setHasShownToast(true);

      const timer = setTimeout(() => {
        setShowContent(true);
      }, 300);

      // Auto-redirect to subscription page after 5 seconds
      const redirectTimer = setTimeout(() => {
        navigate("/subscription");
      }, 5000);

      return () => {
        clearTimeout(timer);
        clearTimeout(redirectTimer);
      };
    } else if (!sessionId && !isStripeRedirectSuccess) {
      setShowContent(true);
    }
  }, [sessionId, isStripeRedirectSuccess, hasShownToast, toast, navigate]);

  useEffect(() => {
    const finalize = async () => {
      if (hasFinalized.current) return;

      // Handle session_id from Stripe Checkout (hosted)
      if (user && sessionId) {
        hasFinalized.current = true;
        setIsFinalizing(true);
        try {
          const { error } = await supabase.functions.invoke("finalize-purchase", {
            body: { sessionId },
          });
          if (error) throw error;
        } catch (error: any) {
          console.error("[CheckoutSuccess] finalize-purchase failed (session):", error);
          toast({
            title: "Payment received",
            description:
              "We couldn't sync your subscription yet. Please refresh your Subscription page in a moment.",
            variant: "destructive",
            duration: 7000,
          });
        } finally {
          setIsFinalizing(false);
        }
        return;
      }

      // Handle payment_intent from embedded payments
      if (user && isStripeRedirectSuccess && paymentIntentId) {
        hasFinalized.current = true;
        setIsFinalizing(true);
        try {
          const { error } = await supabase.functions.invoke("finalize-purchase", {
            body: { paymentIntentId },
          });
          if (error) throw error;
        } catch (error: any) {
          console.error("[CheckoutSuccess] finalize-purchase failed (paymentIntent):", error);
          toast({
            title: "Payment received",
            description:
              "We couldn't sync your subscription yet. Please refresh your Subscription page in a moment.",
            variant: "destructive",
            duration: 7000,
          });
        } finally {
          setIsFinalizing(false);
        }
      }
    };

    finalize();
  }, [user, sessionId, isStripeRedirectSuccess, paymentIntentId, toast]);

  if (isLoading || isFinalizing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const isJobSeeker = isEmployee();
  const isEmployer = isContractor();

  return (
    <main className="min-h-screen gradient-hero flex items-center justify-center p-4 py-12">
      <div 
        className={`w-full max-w-lg mx-auto transition-all duration-500 ${
          showContent ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        <div className="bg-card rounded-2xl shadow-medium p-8 border border-border/50 text-center">
          {/* Success Icon */}
          <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-6 animate-pulse">
            <CheckCircle2 className="w-10 h-10 text-success" />
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold font-display mb-4">
            {isJobSeeker ? "Welcome to the Inner Circle!" : "You're All Set!"}
          </h1>

          {/* Role-specific message */}
          {isJobSeeker ? (
            <div className="space-y-4 mb-8">
              <p className="text-muted-foreground">
                Your <span className="text-primary font-semibold">Priority Badge</span> is now active, and your 3 daily applications are ready to use.
              </p>
              <div className="bg-primary/5 rounded-xl p-4 border border-primary/10">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <span className="font-semibold text-foreground">Coming Soon</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  We'll notify you as soon as the AI Translation and Agent features go live!
                </p>
              </div>
            </div>
          ) : isEmployer ? (
            <div className="space-y-4 mb-8">
              <p className="text-muted-foreground">
                Your unlimited posting is now active. Start browsing our community of eager locals and find the help you need today.
              </p>
              <div className="bg-accent/5 rounded-xl p-4 border border-accent/10">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Users className="w-5 h-5 text-accent" />
                  <span className="font-semibold text-foreground">Ready to Hire</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Post your first job and start receiving applications from qualified workers.
                </p>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground mb-8">
              Your subscription is now active. Thank you for choosing Workie!
            </p>
          )}

          {/* Auto-redirect notice */}
          {(sessionId || isStripeRedirectSuccess) && (
            <p className="text-xs text-muted-foreground mb-6 animate-pulse">
              Redirecting to your subscription page in a few seconds...
            </p>
          )}

          {/* CTA Buttons */}
          <div className="space-y-3">
            <Button asChild className="w-full" size="lg">
              <Link to="/subscription">
                View Subscription
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>

            <Button asChild variant="outline" className="w-full">
              <Link to="/dashboard">
                Go to Dashboard
              </Link>
            </Button>

            {isEmployer && (
              <Button asChild variant="ghost" className="w-full">
                <Link to="/contractor/post-job">
                  <Briefcase className="w-4 h-4 mr-2" />
                  Post Your First Job
                </Link>
              </Button>
            )}

            {isJobSeeker && (
              <Button asChild variant="ghost" className="w-full">
                <Link to="/jobs">
                  <Briefcase className="w-4 h-4 mr-2" />
                  Browse Jobs
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
