import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Lock, Check, X, CheckCircle } from "lucide-react";
import { z } from "zod";

// Enhanced password validation with complexity requirements
const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be less than 72 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[!@#$%^&*()_+\-=\[\]{}|;:'",.<>?\/\\]/, "Password must contain at least one special character");

// Password strength requirements for visual indicator
const passwordRequirements = [
  { label: "At least 8 characters", test: (pwd: string) => pwd.length >= 8 },
  { label: "One uppercase letter (A-Z)", test: (pwd: string) => /[A-Z]/.test(pwd) },
  { label: "One lowercase letter (a-z)", test: (pwd: string) => /[a-z]/.test(pwd) },
  { label: "One number (0-9)", test: (pwd: string) => /[0-9]/.test(pwd) },
  { label: "One special character (!@#$%...)", test: (pwd: string) => /[!@#$%^&*()_+\-=\[\]{}|;:'",.<>?\/\\]/.test(pwd) },
];

// Password strength indicator component
function PasswordStrengthIndicator({ password }: { password: string }) {
  const metRequirements = passwordRequirements.filter(req => req.test(password)).length;
  const strengthPercentage = (metRequirements / passwordRequirements.length) * 100;
  
  const getStrengthLabel = () => {
    if (metRequirements === 0) return { label: "", color: "bg-muted" };
    if (metRequirements <= 2) return { label: "Weak", color: "bg-destructive" };
    if (metRequirements <= 4) return { label: "Medium", color: "bg-warning" };
    return { label: "Strong", color: "bg-success" };
  };

  const strength = getStrengthLabel();

  if (!password) return null;

  return (
    <div className="mt-3 space-y-3">
      {/* Strength bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Password strength</span>
          <span className={`font-medium ${
            strength.label === "Weak" ? "text-destructive" : 
            strength.label === "Medium" ? "text-warning" : 
            strength.label === "Strong" ? "text-success" : ""
          }`}>
            {strength.label}
          </span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-300 ${strength.color}`}
            style={{ width: `${strengthPercentage}%` }}
          />
        </div>
      </div>

      {/* Requirements checklist */}
      <div className="grid gap-1.5">
        {passwordRequirements.map((req, index) => {
          const isMet = req.test(password);
          return (
            <div 
              key={index} 
              className={`flex items-center gap-2 text-xs transition-colors ${
                isMet ? "text-success" : "text-muted-foreground"
              }`}
            >
              {isMet ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <X className="w-3.5 h-3.5" />
              )}
              <span>{req.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string }>({});
  const [isSuccess, setIsSuccess] = useState(false);

  // Check if user has a valid recovery session
  useEffect(() => {
    let mounted = true;

    // Set up auth state listener FIRST to catch PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      
      console.log("Auth event:", event, "Session:", !!session);
      
      if (event === "PASSWORD_RECOVERY" && session) {
        setIsValidSession(true);
        setIsChecking(false);
      } else if (event === "SIGNED_IN" && session) {
        // User may already be signed in from the recovery link
        setIsValidSession(true);
        setIsChecking(false);
      }
    });

    // THEN check for existing session
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        if (error) {
          console.error("Session check error:", error);
          setIsChecking(false);
          return;
        }
        
        // If there's already a valid session, allow password reset
        if (session) {
          setIsValidSession(true);
          setIsChecking(false);
        } else {
          // Give the auth state change listener time to process hash params
          setTimeout(() => {
            if (mounted) {
              setIsChecking(false);
            }
          }, 2000);
        }
      } catch (err) {
        console.error("Session check failed:", err);
        if (mounted) {
          setIsChecking(false);
        }
      }
    };

    checkSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Check if passwords match (for real-time feedback)
  const passwordsMatch = useMemo(() => {
    if (!confirmPassword) return true;
    return password === confirmPassword;
  }, [password, confirmPassword]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { password?: string; confirmPassword?: string } = {};

    // Validate password
    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) {
      newErrors.password = passwordResult.error.errors[0].message;
    }

    // Validate confirm password
    if (!confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        console.error("Password update error:", error);
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      setIsSuccess(true);
      toast({
        title: "Password updated!",
        description: "Your password has been successfully reset.",
      });

      // Redirect after a short delay
      setTimeout(() => {
        navigate("/dashboard");
      }, 2000);
    } catch (error) {
      console.error("Unexpected error:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state
  if (isChecking) {
    return (
      <main className="min-h-screen gradient-hero flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </main>
    );
  }

  // Invalid session state
  if (!isValidSession && !isChecking) {
    return (
      <main className="min-h-screen gradient-hero flex items-center justify-center p-4 py-12">
        <div className="w-full max-w-md mx-auto">
          <div className="bg-card rounded-2xl shadow-medium p-8 border border-border/50 text-center">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <X className="w-8 h-8 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold mb-2 font-display">Invalid or expired link</h1>
            <p className="text-muted-foreground mb-6">
              This password reset link is invalid or has expired. Please request a new one.
            </p>
            <Button asChild variant="hero" className="w-full">
              <Link to="/forgot-password">Request new link</Link>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen gradient-hero flex items-center justify-center p-4 py-12">
      <div className="w-full max-w-md mx-auto">
        {/* Back link */}
        <Link
          to="/auth"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors justify-center w-full"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to sign in
        </Link>

        <div className="bg-card rounded-2xl shadow-medium p-8 border border-border/50">
          {/* Logo */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg font-display">K</span>
            </div>
            <span className="text-xl font-bold font-display">Kiwi Hunters</span>
          </div>

          {isSuccess ? (
            // Success state
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-success" />
              </div>
              <h1 className="text-2xl font-bold mb-2 font-display">Password updated!</h1>
              <p className="text-muted-foreground mb-6">
                Your password has been successfully reset. Redirecting you to your dashboard...
              </p>
              <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
            </div>
          ) : (
            // Form state
            <>
              <div className="text-center mb-8">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-6 h-6 text-primary" />
                </div>
                <h1 className="text-2xl font-bold mb-2 font-display">Set new password</h1>
                <p className="text-muted-foreground">
                  Create a strong password for your account.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="password">New Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1.5"
                    autoComplete="new-password"
                  />
                  {errors.password && (
                    <p className="text-sm text-destructive mt-1">{errors.password}</p>
                  )}
                  <PasswordStrengthIndicator password={password} />
                </div>

                <div>
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`mt-1.5 ${
                      confirmPassword && !passwordsMatch 
                        ? "border-destructive focus-visible:ring-destructive" 
                        : ""
                    }`}
                    autoComplete="new-password"
                  />
                  {errors.confirmPassword && (
                    <p className="text-sm text-destructive mt-1">{errors.confirmPassword}</p>
                  )}
                  {confirmPassword && !passwordsMatch && !errors.confirmPassword && (
                    <p className="text-sm text-destructive mt-1">Passwords do not match</p>
                  )}
                  {confirmPassword && passwordsMatch && password && (
                    <p className="text-sm text-success mt-1 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      Passwords match
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  variant="hero"
                  size="lg"
                  className="w-full mt-6"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Updating password...
                    </>
                  ) : (
                    "Update password"
                  )}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
