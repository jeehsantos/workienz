import { Button } from "@/components/ui/button";
import { ArrowRight, MapPin, Clock, Star } from "lucide-react";
import { Link } from "react-router-dom";

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

          {/* Visual */}
          <div className="relative animate-fade-up" style={{ animationDelay: "300ms" }}>
            <div className="relative bg-card rounded-2xl shadow-medium p-6 border border-border/50">
              {/* Mock job cards */}
              <div className="space-y-4">
                {[
                  { title: "Warehouse Associate", company: "Auckland Logistics", location: "Auckland CBD", type: "Temp", rate: "$28/hr" },
                  { title: "Event Staff", company: "NZ Events Co", location: "Wellington", type: "Contract", rate: "$32/hr" },
                  { title: "Retail Assistant", company: "Fashion Forward", location: "Christchurch", type: "Part-time", rate: "$25/hr" },
                ].map((job, i) => (
                  <div 
                    key={i} 
                    className="bg-secondary/50 rounded-xl p-4 hover:bg-secondary transition-colors cursor-pointer"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-semibold text-foreground">{job.title}</h4>
                        <p className="text-sm text-muted-foreground">{job.company}</p>
                      </div>
                      <span className="text-primary font-semibold">{job.rate}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {job.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {job.type}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Floating badge */}
              <div className="absolute -top-4 -right-4 bg-accent text-accent-foreground rounded-full px-4 py-2 shadow-lg animate-float">
                <span className="text-sm font-semibold">Hiring Now!</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
