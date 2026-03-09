import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Briefcase, User, ArrowLeft, Loader2, Check, X, Mail, RefreshCw } from "lucide-react";
import { z } from "zod";
import { TwoFactorVerify } from "@/components/auth/TwoFactorVerify";
import { Checkbox } from "@/components/ui/checkbox";
import workieLogo from "@/assets/workie-logo.png";

type UserType = "contractor" | "employee";

const emailSchema = z.string().email("Please enter a valid email address");

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
  // Memoize expensive password requirement calculations
  const metRequirements = useMemo(() => {
    return passwordRequirements.filter(req => req.test(password)).length;
  }, [password]);
  
  const strengthPercentage = useMemo(() => {
    return (metRequirements / passwordRequirements.length) * 100;
  }, [metRequirements]);
  
  const strength = useMemo(() => {
    if (metRequirements === 0) return { label: "", color: "bg-muted" };
    if (metRequirements <= 2) return { label: "Weak", color: "bg-destructive" };
    if (metRequirements <= 4) return { label: "Medium", color: "bg-warning" };
    return { label: "Strong", color: "bg-success" };
  }, [metRequirements]);

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

export default function Auth() {
  const [searchParams] = useSearchParams();
  const isSignUp = searchParams.get("mode") === "signup";
  const pendingPlanFromUrl = searchParams.get("plan");
  const referralCodeFromUrl = searchParams.get("ref");
  const navigate = useNavigate();
  const { signIn, signUp, user, isLoading: authLoading } = useAuthContext();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingSignup, setIsProcessingSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [userType, setUserType] = useState<UserType | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [errors, setErrors] = useState<{ 
    email?: string; 
    password?: string; 
    confirmPassword?: string;
    firstName?: string;
    lastName?: string;
    terms?: string;
  }>({});
  
  // 2FA state
  const [requires2FA, setRequires2FA] = useState(false);
  const [pending2FAUserId, setPending2FAUserId] = useState<string | null>(null);

  // Email confirmation state
  const [emailConfirmationPending, setEmailConfirmationPending] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [resendingEmail, setResendingEmail] = useState(false);

  // Store pending plan in localStorage
  useEffect(() => {
    if (pendingPlanFromUrl) {
      localStorage.setItem("pendingPlan", pendingPlanFromUrl);
    }
  }, [pendingPlanFromUrl]);

  // Store pending referral code in localStorage
  useEffect(() => {
    if (referralCodeFromUrl) {
      localStorage.setItem("pendingReferralCode", referralCodeFromUrl);
    }
  }, [referralCodeFromUrl]);

  // Redirect if already logged in (but not during signup processing)
  useEffect(() => {
    if (!authLoading && user && !isProcessingSignup && !emailConfirmationPending) {
      // Check for pending plan
      const pendingPlan = localStorage.getItem("pendingPlan");
      if (pendingPlan) {
        localStorage.removeItem("pendingPlan");
        navigate(`/checkout?plan=${pendingPlan}`);
      } else {
        navigate("/dashboard");
      }
    }
  }, [user, authLoading, navigate, isProcessingSignup, emailConfirmationPending]);

  // Check if passwords match (for real-time feedback)
  const passwordsMatch = useMemo(() => {
    if (!confirmPassword) return true;
    return password === confirmPassword;
  }, [password, confirmPassword]);

  // Stabilize form validation callback - MUST be before any early returns
  const validateForm = useCallback(() => {
    const newErrors: { 
      email?: string; 
      password?: string; 
      confirmPassword?: string;
      firstName?: string;
      lastName?: string;
      terms?: string;
    } = {};
    
    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      newErrors.email = emailResult.error.errors[0].message;
    }
    
    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) {
      newErrors.password = passwordResult.error.errors[0].message;
    }
    
    // Validate confirm password for signup
    if (isSignUp) {
      if (!confirmPassword) {
        newErrors.confirmPassword = "Please confirm your password";
      } else if (password !== confirmPassword) {
        newErrors.confirmPassword = "Passwords do not match";
      }
    }
    
    if (isSignUp && !firstName.trim()) {
      newErrors.firstName = "First name is required";
    }
    
    if (isSignUp && !lastName.trim()) {
      newErrors.lastName = "Last name is required";
    }

    if (isSignUp && !agreedToTerms) {
      newErrors.terms = "You must agree to the Terms of Service and Privacy Policy";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [email, password, confirmPassword, firstName, lastName, isSignUp, agreedToTerms]);

  // Stabilize user type selection callbacks - MUST be before any early returns
  const handleSelectContractor = useCallback(() => {
    setUserType("contractor");
  }, []);

  const handleSelectEmployee = useCallback(() => {
    setUserType("employee");
  }, []);

  // Stabilize Google sign-in callback - MUST be before any early returns
  const handleGoogleSignIn = useCallback(async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) {
        toast({
          title: "Google sign-in failed",
          description: error.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to initiate Google sign-in.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Stabilize form submit callback - MUST be before any early returns
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    if (isSignUp && !userType) {
      toast({
        title: "Please select account type",
        description: "Choose whether you're hiring or looking for work.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      if (isSignUp) {
        // Set flag to prevent redirect during signup processing
        setIsProcessingSignup(true);
        
        const { error } = await signUp(email, password, firstName, lastName, userType!);
        if (error) {
          if (error.message.includes("already registered")) {
            toast({
              title: "Account exists",
              description: "This email is already registered. Please sign in instead.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Sign up failed",
              description: error.message,
              variant: "destructive",
            });
          }
          return;
        }

        // Send confirmation email via edge function
        try {
          const { error: emailError } = await supabase.functions.invoke("send-confirmation-email", {
            body: { email, firstName },
          });

          if (emailError) {
            console.error("Error sending confirmation email:", emailError);
            toast({
              title: "Account created",
              description: "Please check your email for a confirmation link (email may take a moment to arrive).",
            });
          }
        } catch (emailErr) {
          console.error("Failed to send confirmation email:", emailErr);
        }

        // Sign out immediately - user must confirm email first
        await supabase.auth.signOut();
        
        // Show confirmation pending screen
        setPendingEmail(email);
        setEmailConfirmationPending(true);
        
        toast({
          title: "Check your email",
          description: "We've sent you a confirmation link to activate your account.",
        });
      } else {
        // For sign in, first sign in normally
        const { data, error } = await signIn(email, password);
        if (error) {
          if (error.message.includes("Email not confirmed")) {
            // User hasn't confirmed their email yet
            toast({
              title: "Email not confirmed",
              description: "Please check your email for the confirmation link, or resend it below.",
              variant: "destructive",
            });
            setPendingEmail(email);
            setEmailConfirmationPending(true);
            return;
          } else if (error.message.includes("Invalid login")) {
            toast({
              title: "Invalid credentials",
              description: "Please check your email and password.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Sign in failed",
              description: error.message,
              variant: "destructive",
            });
          }
          return;
        }

        // Check if 2FA is enabled for this user
        if (data?.user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("two_factor_enabled")
            .eq("user_id", data.user.id)
            .single();

          if (profile?.two_factor_enabled) {
            // Sign out temporarily and show 2FA verification
            await supabase.auth.signOut();
            setPending2FAUserId(data.user.id);
            setRequires2FA(true);
            setIsLoading(false);
            return;
          }
        }

        toast({
          title: "Welcome back!",
          description: "You've successfully signed in.",
        });
        
        // Check for pending plan after signin
        const pendingPlan = localStorage.getItem("pendingPlan");
        if (pendingPlan) {
          localStorage.removeItem("pendingPlan");
          navigate(`/checkout?plan=${pendingPlan}`);
        } else {
          navigate("/dashboard");
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [validateForm, isSignUp, userType, signUp, email, password, firstName, lastName, toast, navigate, signIn]);

  // Handle resend confirmation email
  const handleResendEmail = useCallback(async () => {
    if (!pendingEmail) return;
    
    setResendingEmail(true);
    try {
      const { error } = await supabase.functions.invoke("send-confirmation-email", {
        body: { email: pendingEmail, firstName: firstName || "" },
      });

      if (error) {
        toast({
          title: "Failed to resend",
          description: "Please try again in a moment.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Email sent!",
          description: "Please check your inbox for the confirmation link.",
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to resend confirmation email.",
        variant: "destructive",
      });
    } finally {
      setResendingEmail(false);
    }
  }, [pendingEmail, firstName, toast]);

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Don't render form if already logged in
  if (user) {
    return null;
  }

  // Show email confirmation pending screen
  if (emailConfirmationPending && pendingEmail) {
    return (
      <main className="min-h-screen gradient-hero flex items-center justify-center p-4 py-12">
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

            {/* Email icon */}
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Mail className="w-8 h-8 text-primary" />
              </div>
            </div>

            <h1 className="text-2xl font-bold mb-2 font-display">Check Your Email</h1>
            <p className="text-muted-foreground mb-2">
              We've sent a confirmation link to:
            </p>
            <p className="font-medium text-foreground mb-6">
              {pendingEmail}
            </p>

            <p className="text-sm text-muted-foreground mb-6">
              Click the link in the email to activate your account. If you don't see it, check your spam folder.
            </p>

            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full"
                onClick={handleResendEmail}
                disabled={resendingEmail}
              >
                {resendingEmail ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Sending...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Resend Email
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setEmailConfirmationPending(false);
                  setPendingEmail("");
                }}
              >
                Use a different email
              </Button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Show 2FA verification screen
  if (requires2FA && pending2FAUserId) {
    return (
      <main className="min-h-screen gradient-hero flex items-center justify-center p-4 py-12">
        <TwoFactorVerify 
          userId={pending2FAUserId}
          onSuccess={() => {
            toast({
              title: "Welcome back!",
              description: "You've successfully signed in.",
            });
            // Check for pending plan after 2FA
            const pendingPlan = localStorage.getItem("pendingPlan");
            if (pendingPlan) {
              localStorage.removeItem("pendingPlan");
              navigate(`/checkout?plan=${pendingPlan}`);
            } else {
              navigate("/dashboard");
            }
          }}
          onCancel={() => {
            setRequires2FA(false);
            setPending2FAUserId(null);
            setPassword("");
          }}
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen gradient-hero flex items-center justify-center p-4 py-12">
      <div className="w-full max-w-md mx-auto">
        {/* Back link */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors justify-center w-full"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>

        <div className="bg-card rounded-2xl shadow-medium p-8 border border-border/50">
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

          <h1 className="text-2xl font-bold text-center mb-2 font-display">
            {isSignUp ? "Create your account" : "Welcome back"}
          </h1>
          <p className="text-muted-foreground text-center mb-8">
            {isSignUp
              ? "Join New Zealand's #1 temporary work platform"
              : "Sign in to continue to your dashboard"}
          </p>

          {/* User type selection for signup */}
          {isSignUp && (
            <div className="mb-6">
              <Label className="text-sm font-medium mb-3 block">I want to...</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleSelectContractor}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    userType === "contractor"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <Briefcase
                    className={`w-6 h-6 mx-auto mb-2 ${
                      userType === "contractor" ? "text-primary" : "text-muted-foreground"
                    }`}
                  />
                  <p className="font-medium text-sm">Hire Workers</p>
                  <p className="text-xs text-muted-foreground">Contractor</p>
                </button>
                <button
                  type="button"
                  onClick={handleSelectEmployee}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    userType === "employee"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <User
                    className={`w-6 h-6 mx-auto mb-2 ${
                      userType === "employee" ? "text-primary" : "text-muted-foreground"
                    }`}
                  />
                  <p className="font-medium text-sm">Find Work</p>
                  <p className="text-xs text-muted-foreground">Employee</p>
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    type="text"
                    placeholder="John"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="mt-1.5"
                  />
                  {errors.firstName && (
                    <p className="text-sm text-destructive mt-1">{errors.firstName}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    type="text"
                    placeholder="Smith"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="mt-1.5"
                  />
                  {errors.lastName && (
                    <p className="text-sm text-destructive mt-1">{errors.lastName}</p>
                  )}
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5"
              />
              {errors.email && (
                <p className="text-sm text-destructive mt-1">{errors.email}</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {!isSignUp && (
                  <Link 
                    to="/forgot-password" 
                    className="text-sm text-primary hover:underline font-medium"
                  >
                    Forgot password?
                  </Link>
                )}
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5"
              />
              {errors.password && (
                <p className="text-sm text-destructive mt-1">{errors.password}</p>
              )}
              {/* Show password strength indicator only during signup */}
              {isSignUp && <PasswordStrengthIndicator password={password} />}
            </div>

            {/* Confirm password field - only for signup */}
            {isSignUp && (
              <div>
                <Label htmlFor="confirmPassword">Confirm Password</Label>
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
            )}

            {/* Terms & Privacy consent - signup only */}
            {isSignUp && (
              <div className="space-y-1.5">
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="terms"
                    checked={agreedToTerms}
                    onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
                    className="mt-0.5"
                  />
                  <label htmlFor="terms" className="text-sm text-muted-foreground leading-snug cursor-pointer">
                    I agree to the{" "}
                    <Link to="/terms" className="text-primary hover:underline" target="_blank">
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link to="/privacy" className="text-primary hover:underline" target="_blank">
                      Privacy Policy
                    </Link>
                  </label>
                </div>
                {errors.terms && (
                  <p className="text-sm text-destructive">{errors.terms}</p>
                )}
              </div>
            )}

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
                  {isSignUp ? "Creating account..." : "Signing in..."}
                </>
              ) : isSignUp ? (
                "Create Account"
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          {/* Google Sign-in Button */}
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full"
            disabled={isLoading}
            onClick={handleGoogleSignIn}
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </Button>

          <p className="text-center text-sm text-muted-foreground mt-6">
            {isSignUp ? (
              <>
                Already have an account?{" "}
                <Link to="/auth" className="text-primary hover:underline font-medium">
                  Sign in
                </Link>
              </>
            ) : (
              <>
                Don't have an account?{" "}
                <Link to="/auth?mode=signup" className="text-primary hover:underline font-medium">
                  Sign up
                </Link>
              </>
            )}
          </p>
        </div>
      </div>
    </main>
  );
}
