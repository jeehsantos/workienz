import { Button } from "@/components/ui/button";
import { ArrowRight, Star } from "lucide-react";
import { Link } from "react-router-dom";
import workersHeroImage from "@/assets/workers-hero.jpg";

export function HeroSection() {
  return (
    <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 gradient-hero overflow-hidden">
      {/* Decorative background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute top-1/2 -left-20 w-60 h-60 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="container-tight relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Content */}
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 bg-primary/10 rounded-full px-4 py-2 mb-6 animate-fade-up">
              <Star className="w-4 h-4 text-primary fill-primary" />
              <span className="text-sm font-medium text-primary">New Zealand's #1 Temporary Work Platform</span>
            </div>

            <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold mb-6 font-display text-balance animate-fade-up" style={{ animationDelay: "100ms" }}>
              Find Your Next
              <span className="text-primary block">Opportunity</span>
            </h1>

            <p className="text-lg lg:text-xl text-muted-foreground mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed animate-fade-up" style={{ animationDelay: "200ms" }}>
              Connect with top employers and skilled workers across New Zealand. 
              Whether you're hiring or seeking work, start your journey today.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start animate-fade-up" style={{ animationDelay: "300ms" }}>
              <Button variant="hero" size="xl" asChild>
                <Link to="/auth?mode=signup">
                  Get Started Free
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </Button>
              <Button variant="outline" size="xl" asChild>
                <Link to="/jobs">Browse Jobs</Link>
              </Button>
            </div>

            {/* Stats */}
            <div className="flex flex-wrap justify-center lg:justify-start gap-8 mt-12 pt-8 border-t border-border/50 animate-fade-up" style={{ animationDelay: "400ms" }}>
              <div>
                <p className="text-3xl font-bold font-display text-foreground">10K+</p>
                <p className="text-sm text-muted-foreground">Active Workers</p>
              </div>
              <div>
                <p className="text-3xl font-bold font-display text-foreground">2.5K+</p>
                <p className="text-sm text-muted-foreground">Employers</p>
              </div>
              <div>
                <p className="text-3xl font-bold font-display text-foreground">50K+</p>
                <p className="text-sm text-muted-foreground">Jobs Filled</p>
              </div>
            </div>
          </div>

          {/* Hero Image */}
          <div className="relative animate-fade-up" style={{ animationDelay: "300ms" }}>
            <div className="relative rounded-2xl overflow-hidden shadow-medium border border-border/50">
              <img 
                src={workersHeroImage} 
                alt="Diverse workers including farmers, construction workers, and service staff in New Zealand countryside"
                className="w-full h-auto object-cover aspect-[16/10]"
              />
              {/* Overlay gradient for better text readability if needed */}
              <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent" />
              
              {/* Floating badge */}
              <div className="absolute top-4 right-4 bg-accent text-accent-foreground rounded-full px-4 py-2 shadow-lg animate-float">
                <span className="text-sm font-semibold">Hiring Now!</span>
              </div>
            </div>
            
            {/* Decorative element */}
            <div className="absolute -bottom-4 -left-4 w-24 h-24 bg-primary/10 rounded-2xl -z-10" />
            <div className="absolute -top-4 -right-4 w-16 h-16 bg-accent/20 rounded-xl -z-10" />
          </div>
        </div>
      </div>
    </section>
  );
}
