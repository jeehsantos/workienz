import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import workieLogo from "@/assets/workie-logo.png";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const handleVerification = async () => {
      try {
        // Check if there's an access_token in the URL hash (Supabase redirect)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");

        if (accessToken && refreshToken) {
          // Set the session with the tokens from the URL
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            console.error("Error setting session:", error);
            setStatus("error");
            setErrorMessage("Failed to verify your email. The link may have expired.");
            return;
          }

          // Get the current session to verify it worked
          const { data: { session } } = await supabase.auth.getSession();
          
          if (session?.user) {
            // Try to trigger referral verification if applicable
            try {
              await supabase.functions.invoke("verify-referral", {
                headers: {
                  Authorization: `Bearer ${session.access_token}`,
                },
              });
            } catch (refError) {
              // Non-critical - referral verification is optional
              console.log("Referral verification skipped:", refError);
            }

            setStatus("success");
            
            toast({
              title: "Email verified!",
              description: "Your account is now active. Welcome to Workie!",
            });

            // Redirect to dashboard after a short delay
            setTimeout(() => {
              // Check for pending plan
              const pendingPlan = localStorage.getItem("pendingPlan");
              if (pendingPlan) {
                localStorage.removeItem("pendingPlan");
                navigate(`/checkout?plan=${pendingPlan}`);
              } else {
                navigate("/dashboard");
              }
            }, 2000);
          } else {
            setStatus("error");
            setErrorMessage("Failed to verify your email. Please try again.");
          }
        } else {
          // Check URL search params for error
          const error = searchParams.get("error");
          const errorDescription = searchParams.get("error_description");
          
          if (error) {
            setStatus("error");
            setErrorMessage(errorDescription || "Email verification failed.");
          } else {
            // No tokens in URL - check if user is already logged in
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user?.email_confirmed_at) {
              setStatus("success");
              setTimeout(() => navigate("/dashboard"), 2000);
            } else {
              setStatus("error");
              setErrorMessage("Invalid verification link. Please request a new one.");
            }
          }
        }
      } catch (error) {
        console.error("Verification error:", error);
        setStatus("error");
        setErrorMessage("An unexpected error occurred during verification.");
      }
    };

    handleVerification();
  }, [navigate, searchParams, toast]);

  return (
    <main className="min-h-screen gradient-hero flex items-center justify-center p-4">
      <div className="w-full max-w-md mx-auto">
        <div className="bg-card rounded-2xl shadow-medium p-8 border border-border/50 text-center">
          {/* Logo */}
          <div className="flex items-center justify-center mb-6">
            <img 
              src={workieLogo} 
              alt="Workie" 
              className="h-[25px] w-[195px] object-contain"
              width={195}
              height={25}
            />
          </div>

          {status === "loading" && (
            <>
              <div className="flex justify-center mb-4">
                <Loader2 className="w-12 h-12 animate-spin text-primary" />
              </div>
              <h1 className="text-2xl font-bold mb-2 font-display">Verifying Your Email</h1>
              <p className="text-muted-foreground">Please wait while we activate your account...</p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="flex justify-center mb-4">
                <CheckCircle className="w-12 h-12 text-success" />
              </div>
              <h1 className="text-2xl font-bold mb-2 font-display">Email Verified!</h1>
              <p className="text-muted-foreground mb-4">Your account is now active. Redirecting to your dashboard...</p>
              <div className="flex justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            </>
          )}

          {status === "error" && (
            <>
              <div className="flex justify-center mb-4">
                <XCircle className="w-12 h-12 text-destructive" />
              </div>
              <h1 className="text-2xl font-bold mb-2 font-display">Verification Failed</h1>
              <p className="text-muted-foreground mb-6">{errorMessage}</p>
              <div className="space-y-3">
                <Button
                  variant="hero"
                  className="w-full"
                  onClick={() => navigate("/auth?mode=signup")}
                >
                  Try Again
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate("/auth")}
                >
                  Sign In
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
