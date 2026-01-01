import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { Footer } from "@/components/landing/Footer";

const plans = [
  {
    name: "Basic",
    price: "Free",
    description: "Perfect for getting started",
    features: [
      "Create your profile",
      "Search for jobs",
      "Apply to listings",
      "Basic job alerts",
    ],
    cta: "Get Started",
    popular: false,
  },
  {
    name: "Pro",
    price: "$19",
    period: "/month",
    description: "For serious job seekers",
    features: [
      "Everything in Basic",
      "Access to all articles",
      "Priority applications",
      "AI career assistant",
      "Advanced job matching",
      "Profile boost",
    ],
    cta: "Start Free Trial",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    description: "For contractors & agencies",
    features: [
      "Unlimited job postings",
      "Advanced search filters",
      "Direct messaging",
      "Candidate tracking",
      "Analytics dashboard",
      "Priority support",
    ],
    cta: "Contact Sales",
    popular: false,
  },
];

export default function Pricing() {
  return (
    <main className="min-h-screen">
      <section className="pt-8 pb-20 lg:pt-12 lg:pb-28 gradient-hero">
        <div className="container-tight">
          <div className="text-center mb-16">
            <h1 className="text-4xl lg:text-5xl font-bold mb-4 font-display">
              Simple, Transparent Pricing
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Choose the plan that's right for you. All plans include a 14-day free trial.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative bg-card rounded-2xl p-8 shadow-soft border transition-all duration-300 hover:shadow-medium ${
                  plan.popular
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-border/50"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="gradient-primary text-primary-foreground text-sm font-semibold px-4 py-1 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}

                <h3 className="text-xl font-bold mb-2 font-display">{plan.name}</h3>
                <p className="text-muted-foreground text-sm mb-4">{plan.description}</p>

                <div className="mb-6">
                  <span className="text-4xl font-bold font-display">{plan.price}</span>
                  {plan.period && (
                    <span className="text-muted-foreground">{plan.period}</span>
                  )}
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-primary" />
                      </div>
                      <span className="text-sm text-foreground/80">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  variant={plan.popular ? "hero" : "outline"}
                  className="w-full"
                  asChild
                >
                  <Link to="/auth?mode=signup">{plan.cta}</Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
