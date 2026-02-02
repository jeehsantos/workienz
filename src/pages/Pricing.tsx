import { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, X, Briefcase, Users, Sparkles, Clock, Database, Crown, Star, BookOpen, MessageSquare, Globe, Bot, Tractor, Building2, HardHat, Sparkle, Info, Zap, Lock, HelpCircle, ArrowUp, ArrowDown } from "lucide-react";
import { Footer } from "@/components/landing/Footer";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { PlanChangeModal } from "@/components/subscription/PlanChangeModal";
interface ContractorEntitlement {
  id: string;
  plan_type: string;
  available_slots: number | "unlimited";
  remaining_slots: number | "unlimited";
  jobs_used: number;
  expires_at: string | null;
  activated_at: string | null;
  is_stackable: boolean;
  is_recurring: boolean;
  status: string;
}
interface EntitlementsResponse {
  entitlements: ContractorEntitlement[];
  can_post_job: boolean;
  total_remaining_slots: number | "unlimited";
}
interface PlanProductFromDB {
  id: string;
  plan_id: string;
  plan_name: string;
  plan_type: string;
  price_cents: number;
  coming_soon: boolean;
  hidden: boolean;
  interval: string | null;
  description: string | null;
}

// Feature matrix for contractor plans
const contractorFeatureMatrix: Record<string, Record<string, boolean>> = {
  free_contractor: {
    "1 job listing": true,
    "Unlimited job posts": false,
    "30-day access": true,
    "View applicant profiles": true,
    "Direct messaging": true,
    "Browse job seeker database": false,
    "Priority support": false,
    "Advanced analytics": false,
    "Featured employer badge": false
  },
  single_post: {
    "1 job listing": true,
    "Unlimited job posts": false,
    "14-day access": true,
    "View applicant profiles": true,
    "Direct messaging": true,
    "Browse job seeker database": false,
    "Priority support": false,
    "Advanced analytics": false,
    "Featured employer badge": false
  },
  "14_day_sprint": {
    "1 job listing": false,
    "Unlimited job posts": true,
    "14-day access": true,
    "View applicant profiles": true,
    "Direct messaging": true,
    "Browse job seeker database": false,
    "Priority support": false,
    "Advanced analytics": false,
    "Featured employer badge": false
  },
  monthly_contractor: {
    "1 job listing": false,
    "Unlimited job posts": true,
    "14-day access": false,
    "View applicant profiles": true,
    "Direct messaging": true,
    "Browse job seeker database": true,
    "Priority support": true,
    "Advanced analytics": false,
    "Featured employer badge": false
  },
  quarterly_contractor: {
    "1 job listing": false,
    "Unlimited job posts": true,
    "14-day access": false,
    "View applicant profiles": true,
    "Direct messaging": true,
    "Browse job seeker database": true,
    "Priority support": true,
    "Advanced analytics": true,
    "Featured employer badge": true
  }
};

// Feature matrix for seeker plans
const seekerFeatureMatrix: Record<string, Record<string, boolean>> = {
  free_seeker: {
    "1 application / 3 days": true,
    "3 applications / 3 days": false,
    "Free community articles": true,
    "Full article library": false,
    "Basic profile": true,
    "Priority Badge": false,
    "Enhanced visibility": false,
    "Job alerts": true
  },
  weekly_seeker: {
    "1 application / 3 days": false,
    "3 applications / 3 days": true,
    "Free community articles": true,
    "Full article library": true,
    "Basic profile": true,
    "Priority Badge": true,
    "Enhanced visibility": true,
    "Job alerts": true
  },
  monthly_seeker: {
    "1 application / 3 days": false,
    "3 applications / 3 days": true,
    "Free community articles": true,
    "Full article library": true,
    "Basic profile": true,
    "Priority Badge": true,
    "Enhanced visibility": true,
    "Job alerts": true
  },
  quarterly_seeker: {
    "1 application / 3 days": false,
    "3 applications / 3 days": true,
    "Free community articles": true,
    "Full article library": true,
    "Basic profile": true,
    "Priority Badge": true,
    "Enhanced visibility": true,
    "Job alerts": true
  }
};

// Static plan metadata (badges, CTAs, etc.) - prices come from DB
const contractorPlanMeta: Record<string, {
  gst: string;
  cta: string;
  badge: string | null;
  highlighted: boolean;
  period?: string;
}> = {
  free_contractor: {
    gst: "",
    cta: "Start Free",
    badge: "Free",
    highlighted: false
  },
  single_post: {
    gst: "+GST",
    cta: "Post a Job",
    badge: null,
    highlighted: false
  },
  "14_day_sprint": {
    gst: "+GST",
    cta: "Start Sprint",
    badge: "Best for Seasonal",
    highlighted: false
  },
  monthly_contractor: {
    gst: "+GST",
    cta: "Subscribe Monthly",
    badge: "Most Popular",
    highlighted: true,
    period: "/month"
  },
  quarterly_contractor: {
    gst: "+GST",
    cta: "Go Quarterly",
    badge: "Best Value",
    highlighted: false,
    period: "/quarter"
  }
};
const seekerPlanMeta: Record<string, {
  cta: string;
  badge: string | null;
  highlighted: boolean;
  period?: string;
}> = {
  free_seeker: {
    cta: "Get Started Free",
    badge: null,
    highlighted: false
  },
  weekly_seeker: {
    cta: "Start Weekly",
    badge: null,
    highlighted: false,
    period: "/week"
  },
  monthly_seeker: {
    cta: "Go Monthly",
    badge: null,
    highlighted: false,
    period: "/month"
  },
  quarterly_seeker: {
    cta: "Best Value",
    badge: "Most Popular",
    highlighted: true,
    period: "/quarter"
  }
};
const industries = [{
  icon: Tractor,
  label: "Farm"
}, {
  icon: Building2,
  label: "Venue"
}, {
  icon: HardHat,
  label: "Construction"
}, {
  icon: Sparkle,
  label: "Cleaning"
}];
const comingSoonFeatures = [{
  icon: Bot,
  title: "Community Support AI",
  description: "Your 24/7 assistant to help you understand New Zealand work rights and community articles. Ask questions about settling in, or let the agent find up-to-date guidance from official immigration sites just for you."
}, {
  icon: Globe,
  title: "Native Language Chat Bridge",
  description: "Communicate with confidence. Send messages or voice notes in your own language, and we'll translate them into English for the contractor. You receive their replies back in your preferred language instantly."
}];

// FAQ data
const faqItems = [{
  category: "Billing",
  questions: [{
    question: "How does billing work?",
    answer: "We offer flexible billing options. One-time purchases (Single Post, 14-Day Sprint) are charged immediately. Subscription plans (Monthly, Quarterly) are billed at the start of each billing cycle. All prices are in NZD and GST is added at checkout."
  }, {
    question: "What payment methods do you accept?",
    answer: "We accept all major credit and debit cards (Visa, Mastercard, American Express) through our secure payment processor, Stripe. All transactions are encrypted and PCI-compliant."
  }, {
    question: "Can I change my plan at any time?",
    answer: "Yes! You can upgrade or downgrade your plan at any time. When upgrading, you'll be charged the prorated difference. When downgrading, the change takes effect at the end of your current billing period."
  }]
}, {
  category: "Refunds",
  questions: [{
    question: "What is your refund policy?",
    answer: "We offer a 7-day money-back guarantee for all subscription plans. If you're not satisfied within the first 7 days, contact our support team for a full refund. One-time purchases are non-refundable once a job has been posted."
  }, {
    question: "How do I request a refund?",
    answer: "To request a refund, please contact our support team at support@workie.co.nz with your account email and reason for the refund. We typically process refunds within 3-5 business days."
  }]
}, {
  category: "Plan Differences",
  questions: [{
    question: "What's the difference between Single Post and 14-Day Sprint?",
    answer: "Single Post allows you to create one job listing that stays active for 14 days. The 14-Day Sprint gives you unlimited job posts during a 14-day period - perfect for seasonal hiring or when you need to fill multiple positions quickly."
  }, {
    question: "What does 'Database Access' include?",
    answer: "Database Access (available on Monthly and Quarterly plans) lets you browse and search through all job seeker profiles on Workie. You can filter by skills, location, availability, and more - then reach out directly to candidates who match your needs."
  }, {
    question: "What benefits do Premium job seekers get?",
    answer: "Premium job seekers get 3 applications every 3 days (vs 1 for free users), access to our full article library with career tips, a Priority Badge that makes their profile stand out, and enhanced visibility in employer searches."
  }]
}];

// Feature item component with checkmark or X
const FeatureItem = ({
  included,
  label
}: {
  included: boolean;
  label: string;
}) => <li className="flex items-start gap-2.5">
    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${included ? "bg-primary/15" : "bg-muted"}`}>
      {included ? <Check className="w-3 h-3 text-primary" /> : <X className="w-3 h-3 text-muted-foreground/50" />}
    </div>
    <span className={`text-sm ${included ? "text-foreground/80" : "text-muted-foreground/60 line-through"}`}>
      {label}
    </span>
  </li>;
export default function Pricing() {
  const navigate = useNavigate();
  const {
    user,
    isContractor,
    isEmployee
  } = useAuthContext();

  // Determine initial tab based on user role
  const getInitialTab = () => {
    if (user) {
      if (isContractor()) return "hire";
      if (isEmployee()) return "work";
    }
    return "hire"; // default for guests
  };
  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [currentSubscription, setCurrentSubscription] = useState<{
    planId: string | null;
    planName: string | null;
    price: number | null;
    nextBillingDate: string | null;
  }>({
    planId: null,
    planName: null,
    price: null,
    nextBillingDate: null
  });

  // Database-driven plans
  const [dbPlans, setDbPlans] = useState<PlanProductFromDB[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);

  // Contractor entitlements for checking slot consumption
  const [contractorEntitlements, setContractorEntitlements] = useState<EntitlementsResponse | null>(null);

  // Modal state for plan changes
  const [planChangeModal, setPlanChangeModal] = useState<{
    isOpen: boolean;
    newPlanId: string;
    newPlanName: string;
    newPrice: number;
  } | null>(null);

  // Fetch plans from database
  useEffect(() => {
    const fetchPlans = async () => {
      const {
        data,
        error
      } = await supabase.from("plan_products").select("id, plan_id, plan_name, plan_type, price_cents, interval, description, coming_soon, hidden").order("price_cents", {
        ascending: true
      });
      if (!error && data) {
        setDbPlans(data as PlanProductFromDB[]);
      }
      setIsLoadingPlans(false);
    };
    fetchPlans();
  }, []);

  // Derived plan arrays from DB data - filter out hidden plans
  const contractorPlans = dbPlans.filter(p => p.plan_type === "contractor" && !p.hidden).map(p => ({
    planId: p.plan_id,
    name: p.plan_name,
    price: `$${(p.price_cents / 100).toFixed(0)}`,
    priceCents: p.price_cents,
    description: p.description || "",
    comingSoon: p.coming_soon,
    ...contractorPlanMeta[p.plan_id]
  }));

  // Filter out hidden seeker plans
  const seekerPlans = dbPlans.filter(p => p.plan_type === "seeker" && !p.hidden).map(p => ({
    planId: p.plan_id,
    name: p.plan_name,
    price: `$${(p.price_cents / 100).toFixed(0)}`,
    priceCents: p.price_cents,
    description: p.description || "",
    comingSoon: p.coming_soon,
    ...seekerPlanMeta[p.plan_id]
  }));

  // Update tab when user role changes
  useEffect(() => {
    if (user) {
      if (isContractor()) setActiveTab("hire");else if (isEmployee()) setActiveTab("work");
    }
  }, [user, isContractor, isEmployee]);

  // Fetch current subscription with plan details
  useEffect(() => {
    const fetchSubscription = async () => {
      if (user) {
        const {
          data
        } = await supabase.from("subscriptions").select("stripe_price_id, plan_name, status, ends_at").eq("user_id", user.id).eq("status", "active").single();
        if (data) {
          // Get price for current plan
          const {
            data: planData
          } = await supabase.from("plan_products").select("price_cents").eq("plan_id", data.stripe_price_id).single();
          setCurrentSubscription({
            planId: data.stripe_price_id,
            planName: data.plan_name,
            price: planData?.price_cents ?? null,
            nextBillingDate: data.ends_at
          });
        }

        // Fetch contractor entitlements for slot consumption check
        if (isContractor()) {
          const {
            data: entData
          } = await supabase.functions.invoke("get-contractor-entitlements");
          if (entData) {
            setContractorEntitlements(entData);
          }
        }
      }
    };
    fetchSubscription();
  }, [user, isContractor]);

  // Memoize toggle lock state
  const isToggleLocked = useMemo(() => {
    return user && (isContractor() || isEmployee());
  }, [user, isContractor, isEmployee]);

  // Get plan price from database data
  const getPlanPrice = (planId: string): number => {
    const plan = dbPlans.find(p => p.plan_id === planId);
    return plan?.price_cents ?? 0;
  };

  // Check if plan is coming soon
  const isPlanComingSoon = (planId: string): boolean => {
    const plan = dbPlans.find(p => p.plan_id === planId);
    return plan?.coming_soon ?? false;
  };

  // Check if current plan is a one-time purchase (no Stripe subscription)
  const isCurrentPlanOneTime = (): boolean => {
    const oneTimePlans = ["single_post", "14_day_sprint"];
    return currentSubscription.planId ? oneTimePlans.includes(currentSubscription.planId) : false;
  };

  // Determine if a plan is an upgrade, downgrade, or current
  const getPlanAction = (planId: string, planPrice: number): "current" | "upgrade" | "downgrade" | "purchase" => {
    // If employee with no subscription, free tier is their current plan
    if (!currentSubscription.planId && user && isEmployee() && planId === "free_seeker") {
      return "current";
    }
    if (!currentSubscription.planId) return "purchase";

    // For one-time purchases (single_post, 14_day_sprint), check slot consumption
    const oneTimePlans = ["single_post", "14_day_sprint"];
    if (oneTimePlans.includes(planId) && currentSubscription.planId === planId) {
      // Check if slots are consumed using entitlements data
      if (contractorEntitlements) {
        const planType = planId === "single_post" ? "single_post" : "14_day_sprint";
        const matchingEntitlement = contractorEntitlements.entitlements.find(e => e.plan_type === planType && e.status === "active");

        // If no remaining slots OR no matching active entitlement, allow repurchase
        if (!matchingEntitlement) {
          return "purchase";
        }
        if (matchingEntitlement.remaining_slots !== "unlimited" && matchingEntitlement.remaining_slots === 0) {
          return "purchase"; // Slots consumed, allow re-purchase
        }
      }

      // Check if the one-time purchase has expired
      if (currentSubscription.nextBillingDate) {
        const expiryDate = new Date(currentSubscription.nextBillingDate);
        if (expiryDate < new Date()) {
          return "purchase"; // Expired, allow re-purchase
        }
      }
      return "current"; // Still active with remaining slots
    }

    // If current plan is one-time and new plan is a subscription, treat as purchase (not upgrade)
    // because there's no Stripe subscription to update
    if (isCurrentPlanOneTime() && !oneTimePlans.includes(planId)) {
      return "purchase"; // Go through normal checkout flow
    }
    if (currentSubscription.planId === planId) return "current";
    if (currentSubscription.price === null) return "purchase";
    if (planPrice > currentSubscription.price) return "upgrade";
    return "downgrade";
  };

  // Stabilize plan selection callback
  const handleSelectPlan = useCallback((planId: string, planName: string) => {
    // Free plan - just go to signup
    if (planId === "free_seeker") {
      navigate("/auth?mode=signup");
      return;
    }
    const planPrice = getPlanPrice(planId);
    const action = getPlanAction(planId, planPrice);
    if (action === "upgrade" || action === "downgrade") {
      // Show confirmation modal for plan changes
      setPlanChangeModal({
        isOpen: true,
        newPlanId: planId,
        newPlanName: planName,
        newPrice: planPrice
      });
    } else if (user) {
      navigate(`/checkout?plan=${planId}`);
    } else {
      navigate(`/auth?mode=signup&plan=${planId}`);
    }
  }, [user, navigate, getPlanPrice, getPlanAction]);

  // Stabilize plan change success callback
  const handlePlanChangeSuccess = useCallback(async () => {
    // Refresh subscription data
    if (user) {
      const {
        data
      } = await supabase.from("subscriptions").select("stripe_price_id, plan_name, status, ends_at").eq("user_id", user.id).eq("status", "active").single();
      if (data) {
        const {
          data: planData
        } = await supabase.from("plan_products").select("price_cents").eq("plan_id", data.stripe_price_id).single();
        setCurrentSubscription({
          planId: data.stripe_price_id,
          planName: data.plan_name,
          price: planData?.price_cents ?? null,
          nextBillingDate: data.ends_at
        });
      }
    }
  }, [user]);

  // Get button label and variant for a plan
  const getPlanButtonConfig = (planId: string, planPrice: number, defaultCta: string) => {
    const action = getPlanAction(planId, planPrice);
    switch (action) {
      case "current":
        return {
          label: "Current Plan",
          variant: "secondary" as const,
          disabled: true,
          icon: null
        };
      case "upgrade":
        return {
          label: "Upgrade",
          variant: "default" as const,
          disabled: false,
          icon: ArrowUp
        };
      case "downgrade":
        return {
          label: "Downgrade",
          variant: "outline" as const,
          disabled: false,
          icon: ArrowDown
        };
      default:
        return {
          label: defaultCta,
          variant: "outline" as const,
          disabled: false,
          icon: null
        };
    }
  };

  // Memoize feature arrays to avoid recalculating on every render
  const contractorFeatures = useMemo(() => {
    return Object.keys(contractorFeatureMatrix.single_post);
  }, []);
  const seekerFeatures = useMemo(() => {
    return Object.keys(seekerFeatureMatrix.free_seeker);
  }, []);
  return <main className="min-h-screen">
      {/* Hero Section */}
      <section className="pt-8 pb-12 lg:pt-12 lg:pb-16 gradient-hero">
        <div className="container-tight">
          <div className="text-center mb-10">
            <h1 className="text-4xl lg:text-5xl font-bold mb-4 font-display">
              Simple, Fair Pricing
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Whether you're hiring or looking for work, we have a plan that fits your needs.
            </p>
          </div>

          {/* Toggle Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex flex-col items-center gap-3 mb-10">
              <TabsList className="grid w-full max-w-md grid-cols-2 h-14 p-1 bg-muted/50">
                <TabsTrigger value="hire" disabled={isToggleLocked && isEmployee()} className={`flex items-center gap-2 text-base font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground ${isToggleLocked && isEmployee() ? "opacity-50 cursor-not-allowed" : ""}`}>
                  <Briefcase className="w-5 h-5" />
                  I want to Hire
                  {isToggleLocked && isContractor() && <Lock className="w-3.5 h-3.5 ml-1" />}
                </TabsTrigger>
                <TabsTrigger value="work" disabled={isToggleLocked && isContractor()} className={`flex items-center gap-2 text-base font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground ${isToggleLocked && isContractor() ? "opacity-50 cursor-not-allowed" : ""}`}>
                  <Users className="w-5 h-5" />
                  I want to Work
                  {isToggleLocked && isEmployee() && <Lock className="w-3.5 h-3.5 ml-1" />}
                </TabsTrigger>
              </TabsList>
              
              {isToggleLocked && <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  Showing plans for your account type ({isContractor() ? "The Workie-Maker" : "The Workie"})
                </p>}
            </div>

            {/* Contractor Pricing */}
            <TabsContent value="hire" className="mt-0">
              {/* Industry Icons */}
              <div className="flex justify-center gap-8 mb-8">
                {industries.map(industry => <div key={industry.label} className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <industry.icon className="w-6 h-6 text-primary" />
                    </div>
                    <span className="text-sm text-muted-foreground">{industry.label}</span>
                  </div>)}
              </div>

              {/* Contractor Plans Grid */}
              <div className="grid max-w-6xl grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 justify-items-center mx-auto">
                {contractorPlans.map(plan => {
                const planPrice = getPlanPrice(plan.planId);
                const action = getPlanAction(plan.planId, planPrice);
                const isCurrentPlan = action === "current";
                const features = contractorFeatureMatrix[plan.planId] || {};
                const buttonConfig = getPlanButtonConfig(plan.planId, planPrice, plan.cta);
                return <div key={plan.name} className={`relative bg-card rounded-2xl p-6 shadow-soft border transition-all duration-300 hover:shadow-medium ${isCurrentPlan ? "border-green-500 ring-2 ring-green-500/20" : plan.highlighted ? "border-primary ring-2 ring-primary/20 scale-[1.02]" : "border-border/50"}`}>
                      {/* Current Plan Badge */}
                      {isCurrentPlan && <div className="absolute -top-3 right-4">
                          <span className="bg-green-500 text-white text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap">
                            Your Plan
                          </span>
                        </div>}
                      
                      {/* Regular Badge */}
                      {plan.badge && !isCurrentPlan && <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <span className={`text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap ${plan.badge === "Most Popular" ? "gradient-primary text-primary-foreground" : plan.badge === "Best Value" ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground"}`}>
                            {plan.badge}
                          </span>
                        </div>}

                      <div className="mb-4 pt-2">
                        <h3 className="text-lg font-bold font-display">{plan.name}</h3>
                        <p className="text-sm text-muted-foreground">{plan.description}</p>
                      </div>

                      <div className="mb-5">
                        {plan.comingSoon ? <span className="text-xl font-bold font-display text-primary">COMING SOON</span> : <>
                            <span className="text-3xl font-bold font-display">{plan.price}</span>
                            <span className="text-sm text-muted-foreground ml-1">{plan.gst}</span>
                            {plan.period && <span className="text-muted-foreground text-sm">{plan.period}</span>}
                          </>}
                      </div>

                      <ul className="space-y-2 mb-6">
                        {contractorFeatures.map(feature => <FeatureItem key={feature} included={features[feature] ?? false} label={feature} />)}
                      </ul>

                      <Button variant={plan.comingSoon ? "secondary" : buttonConfig.variant} className={`w-full ${plan.comingSoon ? "opacity-70 cursor-not-allowed" : action === "upgrade" ? "" : action === "downgrade" ? "border-amber-500 text-amber-600 hover:bg-amber-50" : ""}`} onClick={() => !plan.comingSoon && handleSelectPlan(plan.planId, plan.name)} disabled={plan.comingSoon || buttonConfig.disabled}>
                        {plan.comingSoon ? "Coming Soon" : <>
                            {buttonConfig.icon && <buttonConfig.icon className="w-4 h-4 mr-1.5" />}
                            {buttonConfig.label}
                          </>}
                      </Button>
                    </div>;
              })}
              </div>

              {/* Platform Benefits - Clarified Section */}
              <div className="mt-14 max-w-4xl mx-auto">
                <div className="text-center mb-6">
                  <span className="inline-block text-xs font-medium uppercase tracking-wider text-muted-foreground bg-muted/50 px-3 py-1 rounded-full mb-2">
                    Platform Benefits
                  </span>
                  <h3 className="text-lg font-semibold font-display text-foreground">
                    Why employers choose Workie
                  </h3>
                </div>
                
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="group flex items-center gap-4 p-5 rounded-2xl bg-gradient-to-br from-primary/5 to-transparent border border-primary/10 hover:border-primary/20 transition-all duration-300">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <Database className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">Database Access</h4>
                      <p className="text-sm text-muted-foreground">Browse job seekers directly</p>
                    </div>
                  </div>
                  
                  <div className="group flex items-center gap-4 p-5 rounded-2xl bg-gradient-to-br from-primary/5 to-transparent border border-primary/10 hover:border-primary/20 transition-all duration-300">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <MessageSquare className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">Direct Messaging</h4>
                      <p className="text-sm text-muted-foreground">Chat with candidates instantly</p>
                    </div>
                  </div>
                  
                  <div className="group flex items-center gap-4 p-5 rounded-2xl bg-gradient-to-br from-primary/5 to-transparent border border-primary/10 hover:border-primary/20 transition-all duration-300">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <Zap className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">Fast Hiring</h4>
                      <p className="text-sm text-muted-foreground">Fill positions quickly</p>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Job Seeker Pricing */}
            <TabsContent value="work" className="mt-0">
              {/* Priority Badge Preview */}
              <div className="flex justify-center mb-8">
                <div className="inline-flex items-center gap-3 bg-gradient-to-r from-amber-500/10 to-teal-500/10 border border-amber-500/20 rounded-full px-5 py-2.5">
                  <div className="flex items-center gap-2">
                    <Crown className="w-5 h-5 text-amber-500" />
                    <span className="font-semibold text-foreground">Priority Badge</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    Stand out to employers with a premium profile badge
                  </span>
                </div>
              </div>

              {/* Seeker Plans Grid */}
              <div className="grid w-fit max-w-6xl grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 justify-items-center mx-auto">
                {seekerPlans.map(plan => {
                const planPrice = getPlanPrice(plan.planId);
                const action = getPlanAction(plan.planId, planPrice);
                const isCurrentPlan = action === "current";
                const features = seekerFeatureMatrix[plan.planId] || {};
                const buttonConfig = getPlanButtonConfig(plan.planId, planPrice, plan.cta);
                return <div key={plan.name} className={`relative bg-card rounded-2xl p-6 shadow-soft border transition-all duration-300 hover:shadow-medium ${isCurrentPlan ? "border-green-500 ring-2 ring-green-500/20" : plan.highlighted ? "border-primary ring-2 ring-primary/20 scale-[1.02]" : "border-border/50"}`}>
                      {/* Current Plan Badge */}
                      {isCurrentPlan && <div className="absolute -top-3 right-4">
                          <span className="bg-green-500 text-white text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap">
                            Your Plan
                          </span>
                        </div>}
                      
                      {/* Regular Badge */}
                      {plan.badge && !isCurrentPlan && <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <span className="gradient-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap">
                            {plan.badge}
                          </span>
                        </div>}

                      <div className="mb-4 pt-2">
                        <h3 className="text-lg font-bold font-display">{plan.name}</h3>
                        <p className="text-sm text-muted-foreground">{plan.description}</p>
                      </div>

                      <div className="mb-5">
                        {plan.comingSoon ? <span className="text-xl font-bold font-display text-primary">COMING SOON</span> : <>
                            <span className="text-3xl font-bold font-display">{plan.price}</span>
                            {plan.period && <span className="text-muted-foreground text-sm">{plan.period}</span>}
                          </>}
                      </div>

                      <ul className="space-y-2 mb-6">
                        {seekerFeatures.map(feature => <FeatureItem key={feature} included={features[feature] ?? false} label={feature} />)}
                      </ul>

                      <Button variant={plan.comingSoon ? "secondary" : buttonConfig.variant} className={`w-full ${plan.comingSoon ? "opacity-70 cursor-not-allowed" : action === "upgrade" ? "" : action === "downgrade" ? "border-amber-500 text-amber-600 hover:bg-amber-50" : ""}`} onClick={() => !plan.comingSoon && handleSelectPlan(plan.planId, plan.name)} disabled={plan.comingSoon || buttonConfig.disabled}>
                        {plan.comingSoon ? "Coming Soon" : <>
                            {buttonConfig.icon && <buttonConfig.icon className="w-4 h-4 mr-1.5" />}
                            {buttonConfig.label}
                          </>}
                      </Button>
                    </div>;
              })}
              </div>

              {/* Platform Benefits - Job Seeker Section */}
              <div className="mt-14 max-w-4xl mx-auto">
                <div className="text-center mb-6">
                  <span className="inline-block text-xs font-medium uppercase tracking-wider text-muted-foreground bg-muted/50 px-3 py-1 rounded-full mb-2">
                    Premium Benefits
                  </span>
                  <h3 className="text-lg font-semibold font-display text-foreground">
                    Why job seekers go Premium
                  </h3>
                </div>
                
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="group flex items-center gap-4 p-5 rounded-2xl bg-gradient-to-br from-primary/5 to-transparent border border-primary/10 hover:border-primary/20 transition-all duration-300">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <BookOpen className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">Full Article Library</h4>
                      <p className="text-sm text-muted-foreground">Career tips & industry insights</p>
                    </div>
                  </div>
                  
                  <div className="group flex items-center gap-4 p-5 rounded-2xl bg-gradient-to-br from-primary/5 to-transparent border border-primary/10 hover:border-primary/20 transition-all duration-300">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <Star className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">Enhanced Visibility</h4>
                      <p className="text-sm text-muted-foreground">Appear at top of searches</p>
                    </div>
                  </div>
                  
                  <div className="group flex items-center gap-4 p-5 rounded-2xl bg-gradient-to-br from-primary/5 to-transparent border border-primary/10 hover:border-primary/20 transition-all duration-300">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <Clock className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">More Applications</h4>
                      <p className="text-sm text-muted-foreground">Apply to more jobs faster</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Coming Soon Features - Improved */}
              <div className="mt-14 max-w-3xl mx-auto">
                <div className="text-center mb-6">
                  <span className="inline-block text-xs font-medium uppercase tracking-wider text-muted-foreground bg-muted/50 px-3 py-1 rounded-full mb-2">
                    On Our Roadmap
                  </span>
                  <div className="inline-flex items-center gap-2 justify-center">
                    <Sparkles className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-semibold font-display text-foreground">
                      Coming Soon for Premium Members
                    </h3>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {comingSoonFeatures.map(feature => <div key={feature.title} className="group relative overflow-hidden bg-card/80 backdrop-blur-sm rounded-2xl p-6 border border-border/50 hover:border-primary/30 transition-all duration-300 shadow-sm">
                      {/* Pulse Animation */}
                      <div className="absolute top-4 right-4">
                        <span className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/60 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                        </span>
                      </div>

                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                          <feature.icon className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <h4 className="font-semibold text-foreground">{feature.title}</h4>
                            <span className="text-[10px] font-semibold uppercase bg-primary/15 text-primary px-2 py-0.5 rounded-full">
                              Coming Soon
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                        </div>
                      </div>
                    </div>)}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 lg:py-20 bg-muted/30">
        <div className="container-tight">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <HelpCircle className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-2xl lg:text-3xl font-bold font-display">
                Frequently Asked Questions
              </h2>
            </div>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Got questions? We've got answers. If you can't find what you're looking for, feel free to contact us.
            </p>
          </div>

          <div className="max-w-3xl mx-auto space-y-8">
            {faqItems.map(category => <div key={category.category}>
                <h3 className="text-lg font-semibold font-display text-foreground mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary"></span>
                  {category.category}
                </h3>
                <Accordion type="single" collapsible className="bg-card rounded-xl border border-border/50 shadow-soft overflow-hidden">
                  {category.questions.map((item, index) => <AccordionItem key={index} value={`${category.category}-${index}`} className="border-b border-border/50 last:border-b-0">
                      <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/30 text-left font-medium">
                        {item.question}
                      </AccordionTrigger>
                      <AccordionContent className="px-5 pb-4 text-muted-foreground">
                        {item.answer}
                      </AccordionContent>
                    </AccordionItem>)}
                </Accordion>
              </div>)}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16">
        <div className="container-tight text-center">
          <h2 className="text-2xl lg:text-3xl font-bold font-display mb-4">
            Ready to get started?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Join thousands of Kiwis connecting for work opportunities across New Zealand.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <Link to="/auth?mode=signup">Create Free Account</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/contact">Contact Sales</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />

      {/* Plan Change Confirmation Modal */}
      {planChangeModal && currentSubscription.planId && currentSubscription.planName && currentSubscription.price !== null && <PlanChangeModal isOpen={planChangeModal.isOpen} onClose={() => setPlanChangeModal(null)} currentPlanId={currentSubscription.planId} currentPlanName={currentSubscription.planName} currentPrice={currentSubscription.price} newPlanId={planChangeModal.newPlanId} newPlanName={planChangeModal.newPlanName} newPrice={planChangeModal.newPrice} nextBillingDate={currentSubscription.nextBillingDate} isCurrentPlanOneTime={isCurrentPlanOneTime()} onSuccess={handlePlanChangeSuccess} />}

    </main>;
}