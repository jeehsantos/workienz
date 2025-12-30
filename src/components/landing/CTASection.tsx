import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Users, Briefcase, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";

const stats = [
  { icon: Users, value: "10K+", label: "Active Workers" },
  { icon: Briefcase, value: "2.5K+", label: "Employers" },
  { icon: TrendingUp, value: "50K+", label: "Jobs Filled" },
];

export function CTASection() {
  return (
    <section className="py-20 lg:py-28 gradient-primary relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-10 w-40 h-40 rounded-full bg-primary-foreground blur-3xl" />
        <div className="absolute bottom-10 right-10 w-60 h-60 rounded-full bg-primary-foreground blur-3xl" />
        <div className="absolute top-1/2 left-1/2 w-96 h-96 rounded-full bg-primary-foreground blur-3xl -translate-x-1/2 -translate-y-1/2" />
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
      }} />

      <div className="container-tight relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 bg-primary-foreground/10 rounded-full px-4 py-2 mb-6 backdrop-blur-sm">
            <Sparkles className="w-4 h-4 text-primary-foreground" />
            <span className="text-sm font-medium text-primary-foreground">Join thousands already connected</span>
          </div>

          <h2 className="text-3xl lg:text-5xl font-bold mb-6 text-primary-foreground font-display">
            Ready to Transform Your Hiring?
          </h2>
          
          <p className="text-lg lg:text-xl text-primary-foreground/80 mb-10 leading-relaxed">
            Join New Zealand's fastest-growing platform for temporary work. 
            Whether you're hiring or seeking opportunities, your next success story starts here.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="xl" 
              className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 shadow-lg"
              asChild
            >
              <Link to="/auth?mode=signup">
                Get Started Free
                <ArrowRight className="w-5 h-5" />
              </Link>
            </Button>
            <Button 
              size="xl" 
              variant="ghost"
              className="text-primary-foreground border-2 border-primary-foreground/30 hover:bg-primary-foreground/10"
              asChild
            >
              <Link to="/jobs">
                Browse Jobs
              </Link>
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 lg:gap-8 max-w-2xl mx-auto">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center p-4 rounded-2xl bg-primary-foreground/10 backdrop-blur-sm">
              <stat.icon className="w-6 h-6 text-primary-foreground/60 mx-auto mb-2" />
              <div className="text-2xl lg:text-3xl font-bold text-primary-foreground font-display">{stat.value}</div>
              <div className="text-sm text-primary-foreground/60">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
