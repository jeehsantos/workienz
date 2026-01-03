import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Check, 
  Briefcase, 
  Users, 
  Sparkles, 
  Clock, 
  Database, 
  Crown,
  Star,
  BookOpen,
  MessageSquare,
  Globe,
  Bot,
  Tractor,
  Building2,
  HardHat,
  Sparkle,
  Info,
  Zap
} from "lucide-react";
import { Footer } from "@/components/landing/Footer";

const contractorPlans = [
  {
    name: "Single Post",
    price: "$24",
    gst: "+GST",
    description: "Post one job listing",
    features: [
      "1 job listing",
      "Active for 14 days",
      "View applicant profiles",
      "Direct messaging",
    ],
    cta: "Post a Job",
    badge: null,
    highlighted: false,
  },
  {
    name: "14-Day Sprint",
    price: "$50",
    gst: "+GST",
    description: "Unlimited posts for 14 days",
    features: [
      "Unlimited job posts",
      "14-day access period",
      "View applicant profiles",
      "Direct messaging",
      "Perfect for seasonal peaks",
    ],
    cta: "Start Sprint",
    badge: "Best for Seasonal",
    highlighted: false,
  },
  {
    name: "Monthly",
    price: "$40",
    gst: "+GST",
    period: "/month",
    description: "Unlimited posts + Database Access",
    features: [
      "Unlimited job posts",
      "Browse job seeker database",
      "View applicant profiles",
      "Direct messaging",
      "Priority support",
    ],
    cta: "Subscribe Monthly",
    badge: "Most Popular",
    highlighted: true,
  },
  {
    name: "Quarterly Pro",
    price: "$105",
    gst: "+GST",
    period: "/quarter",
    description: "All features included",
    features: [
      "Everything in Monthly",
      "Save $15 vs monthly",
      "Advanced analytics",
      "Featured employer badge",
      "Priority support",
    ],
    cta: "Go Quarterly",
    badge: "Best Value",
    highlighted: false,
  },
];

const seekerPlans = [
  {
    name: "Free Tier",
    price: "$0",
    description: "Get started for free",
    features: [
      "1 application every 3 days",
      "Access to free community articles",
      "Basic profile",
      "Job alerts",
    ],
    cta: "Get Started Free",
    badge: null,
    highlighted: false,
  },
  {
    name: "Premium Weekly",
    price: "$5",
    period: "/week",
    description: "Flexible weekly access",
    features: [
      "3 applications every 3 days",
      "Full article library access",
      "Priority Badge on profile",
      "Enhanced visibility",
    ],
    cta: "Start Weekly",
    badge: null,
    highlighted: false,
  },
  {
    name: "Premium Monthly",
    price: "$20",
    period: "/month",
    description: "Best for active job seekers",
    features: [
      "3 applications every 3 days",
      "Full article library access",
      "Priority Badge on profile",
      "Enhanced visibility",
      "Save vs weekly",
    ],
    cta: "Go Monthly",
    badge: null,
    highlighted: false,
  },
  {
    name: "Premium Quarterly",
    price: "$45",
    period: "/quarter",
    description: "Maximum value",
    features: [
      "3 applications every 3 days",
      "Full article library access",
      "Priority Badge on profile",
      "Enhanced visibility",
      "Save $15 vs monthly",
    ],
    cta: "Best Value",
    badge: "Most Popular",
    highlighted: true,
  },
];

const industries = [
  { icon: Tractor, label: "Farm" },
  { icon: Building2, label: "Venue" },
  { icon: HardHat, label: "Construction" },
  { icon: Sparkle, label: "Cleaning" },
];

const comingSoonFeatures = [
  {
    icon: Bot,
    title: "AI Career Agent",
    description: "Your personal AI assistant to help match you with the perfect roles and prepare for interviews.",
  },
  {
    icon: Globe,
    title: "Real-time Voice/Text Translation",
    description: "Break language barriers with instant translation in chats and voice calls.",
  },
];

export default function Pricing() {
  const [activeTab, setActiveTab] = useState("hire");

  return (
    <main className="min-h-screen">
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
            <div className="flex justify-center mb-10">
              <TabsList className="grid w-full max-w-md grid-cols-2 h-14 p-1 bg-muted/50">
                <TabsTrigger 
                  value="hire" 
                  className="flex items-center gap-2 text-base font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <Briefcase className="w-5 h-5" />
                  I want to Hire
                </TabsTrigger>
                <TabsTrigger 
                  value="work" 
                  className="flex items-center gap-2 text-base font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <Users className="w-5 h-5" />
                  I want to Work
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Contractor Pricing */}
            <TabsContent value="hire" className="mt-0">
              {/* Industry Icons */}
              <div className="flex justify-center gap-8 mb-8">
                {industries.map((industry) => (
                  <div key={industry.label} className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <industry.icon className="w-6 h-6 text-primary" />
                    </div>
                    <span className="text-sm text-muted-foreground">{industry.label}</span>
                  </div>
                ))}
              </div>

              {/* Minimum Wage Callout */}
              <div className="max-w-2xl mx-auto mb-10">
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 flex gap-4 items-start">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Info className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">The Minimum Wage Principle</h3>
                    <p className="text-sm text-muted-foreground">
                      Our single-post price is anchored to the 2026 NZ Minimum Wage ($23.95). 
                      We believe finding help should be as fair as the work itself.
                    </p>
                  </div>
                </div>
              </div>

              {/* Contractor Plans Grid */}
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
                {contractorPlans.map((plan) => (
                  <div
                    key={plan.name}
                    className={`relative bg-card rounded-2xl p-6 shadow-soft border transition-all duration-300 hover:shadow-medium ${
                      plan.highlighted
                        ? "border-primary ring-2 ring-primary/20 scale-[1.02]"
                        : "border-border/50"
                    }`}
                  >
                    {plan.badge && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className={`text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap ${
                          plan.badge === "Most Popular" 
                            ? "gradient-primary text-primary-foreground" 
                            : plan.badge === "Best Value"
                            ? "bg-accent text-accent-foreground"
                            : "bg-secondary text-secondary-foreground"
                        }`}>
                          {plan.badge}
                        </span>
                      </div>
                    )}

                    <div className="mb-4 pt-2">
                      <h3 className="text-lg font-bold font-display">{plan.name}</h3>
                      <p className="text-sm text-muted-foreground">{plan.description}</p>
                    </div>

                    <div className="mb-5">
                      <span className="text-3xl font-bold font-display">{plan.price}</span>
                      <span className="text-sm text-muted-foreground ml-1">{plan.gst}</span>
                      {plan.period && (
                        <span className="text-muted-foreground text-sm">{plan.period}</span>
                      )}
                    </div>

                    <ul className="space-y-2.5 mb-6">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2">
                          <div className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Check className="w-2.5 h-2.5 text-primary" />
                          </div>
                          <span className="text-sm text-foreground/80">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      variant={plan.highlighted ? "default" : "outline"}
                      className="w-full"
                      asChild
                    >
                      <Link to="/auth?mode=signup">{plan.cta}</Link>
                    </Button>
                  </div>
                ))}
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
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
                {seekerPlans.map((plan) => (
                  <div
                    key={plan.name}
                    className={`relative bg-card rounded-2xl p-6 shadow-soft border transition-all duration-300 hover:shadow-medium ${
                      plan.highlighted
                        ? "border-primary ring-2 ring-primary/20 scale-[1.02]"
                        : "border-border/50"
                    }`}
                  >
                    {plan.badge && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="gradient-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap">
                          {plan.badge}
                        </span>
                      </div>
                    )}

                    <div className="mb-4 pt-2">
                      <h3 className="text-lg font-bold font-display">{plan.name}</h3>
                      <p className="text-sm text-muted-foreground">{plan.description}</p>
                    </div>

                    <div className="mb-5">
                      <span className="text-3xl font-bold font-display">{plan.price}</span>
                      {plan.period && (
                        <span className="text-muted-foreground text-sm">{plan.period}</span>
                      )}
                    </div>

                    <ul className="space-y-2.5 mb-6">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2">
                          <div className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Check className="w-2.5 h-2.5 text-primary" />
                          </div>
                          <span className="text-sm text-foreground/80">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      variant={plan.highlighted ? "default" : "outline"}
                      className="w-full"
                      asChild
                    >
                      <Link to="/auth?mode=signup">{plan.cta}</Link>
                    </Button>
                  </div>
                ))}
              </div>

              {/* Coming Soon Features */}
              <div className="mt-12 max-w-3xl mx-auto">
                <div className="text-center mb-6">
                  <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-sm font-semibold px-4 py-1.5 rounded-full mb-2">
                    <Sparkles className="w-4 h-4" />
                    Coming Soon
                  </div>
                  <h3 className="text-xl font-bold font-display">Premium Features on the Roadmap</h3>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {comingSoonFeatures.map((feature) => (
                    <div 
                      key={feature.title} 
                      className="relative overflow-hidden bg-gradient-to-br from-card to-muted/30 rounded-xl p-5 border border-border/50"
                    >
                      {/* Pulse Animation */}
                      <div className="absolute top-3 right-3">
                        <span className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/60 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                        </span>
                      </div>

                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <feature.icon className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold">{feature.title}</h4>
                            <span className="text-[10px] font-medium bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                              BETA
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">{feature.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Seeker Features */}
              <div className="mt-10 max-w-4xl mx-auto">
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-card border border-border/50">
                    <BookOpen className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-sm">Full Article Library</h4>
                      <p className="text-xs text-muted-foreground">Career tips & industry insights</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-card border border-border/50">
                    <Star className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-sm">Enhanced Visibility</h4>
                      <p className="text-xs text-muted-foreground">Appear at top of searches</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-card border border-border/50">
                    <Clock className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-sm">More Applications</h4>
                      <p className="text-xs text-muted-foreground">Apply to more jobs faster</p>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* FAQ or CTA Section */}
      <section className="py-16 bg-muted/30">
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
    </main>
  );
}
