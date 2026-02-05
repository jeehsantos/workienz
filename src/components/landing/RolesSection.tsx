import { Briefcase, User, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

// Import rotating images
import farmManagers from "@/assets/landing/FarmManagers.png";
import weddingManagers from "@/assets/landing/WeddingManagers.png";
import warehouseWorkers from "@/assets/landing/WarehouseWorkers.jpg";
import cherryWorkers from "@/assets/landing/CherryWorkers.png";

// Image arrays for each role
const hiringImages = [farmManagers, weddingManagers];
const workImages = [warehouseWorkers, cherryWorkers];

// Helper function to get daily image index
const getDailyImageIndex = (imageCount: number): number => {
  const today = new Date();
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
  return dayOfYear % imageCount;
};

// Pre-calculate daily indices at module load for consistent rendering
const hiringDailyIndex = getDailyImageIndex(hiringImages.length);
const workDailyIndex = getDailyImageIndex(workImages.length);

const roles = [{
  images: hiringImages,
  dailyIndex: hiringDailyIndex,
  icon: Briefcase,
  title: "I'm Hiring",
  subtitle: "For Contractors & Employers",
  description: "Post jobs, search through verified workers, and fill positions quickly. Access our database of skilled temporary workers.",
  features: ["Post unlimited job listings", "Search verified worker profiles", "Direct messaging with candidates", "Hire within hours, not weeks"],
  cta: "Start Hiring",
  ctaLink: "/auth?mode=signup",
  variant: "hero" as const
}, {
  images: workImages,
  dailyIndex: workDailyIndex,
  icon: User,
  title: "I'm Looking for Work",
  subtitle: "For Employees & Job Seekers",
  description: "Create your profile, showcase your skills, and get matched with temporary and short-term opportunities that fit your schedule.",
  features: ["Create a standout profile", "Get matched to relevant jobs", "Access exclusive career articles", "Build your work history"],
  cta: "Find Work",
  ctaLink: "/auth?mode=signup",
  variant: "outline" as const
}];
export function RolesSection() {
  return <section className="py-20 bg-muted/30 relative overflow-hidden lg:py-[60px]">
      {/* Decorative background - darker for better readability */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -translate-y-1/2" />
        <div className="absolute top-1/4 right-0 w-72 h-72 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="container-tight relative z-10">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-primary rounded-full px-4 py-2 mb-6 shadow-md">
            <User className="w-4 h-4 text-primary-foreground" />
            <span className="text-sm font-medium text-primary-foreground">Choose Your Path</span>
          </div>
          <h2 className="text-3xl lg:text-4xl font-bold mb-4 font-display">
            How Can We Help You?
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Whether you're looking to hire or be hired, Workie has you covered.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-10">
          {roles.map((role, index) => {
          const currentImage = role.images[role.dailyIndex];
          // First image should load eagerly as it's likely the LCP element
          const isFirstImage = index === 0;
          return <div key={role.title} className="group bg-card rounded-3xl overflow-hidden shadow-soft hover:shadow-medium transition-all duration-500 border border-border/50">
                {/* Image Section */}
                <div className="relative h-48 lg:h-56 overflow-hidden">
                  <img 
                    src={currentImage} 
                    alt={role.title} 
                    loading={isFirstImage ? "eager" : "lazy"} 
                    decoding={isFirstImage ? "sync" : "async"}
                    fetchPriority={isFirstImage ? "high" : "auto"}
                    width={662} 
                    height={336} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />
                  <div className="absolute bottom-4 left-6">
                    <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shadow-lg">
                      <role.icon className="w-6 h-6 text-primary-foreground" />
                    </div>
                  </div>
                </div>

                {/* Content Section */}
                <div className="p-6 lg:p-8">
                  <div className="mb-4">
                    <h3 className="text-2xl font-bold font-display mb-1">{role.title}</h3>
                    <p className="text-muted-foreground text-sm">{role.subtitle}</p>
                  </div>

                  <p className="text-foreground/80 mb-6 leading-relaxed">
                    {role.description}
                  </p>

                  <ul className="space-y-3 mb-8">
                    {role.features.map(feature => <li key={feature} className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                        <span className="text-foreground/80">{feature}</span>
                      </li>)}
                  </ul>

                  <Button variant={role.variant} size="lg" className="w-full group/btn" asChild>
                    <Link to={role.ctaLink}>
                      {role.cta}
                      <ArrowRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                    </Link>
                  </Button>
                </div>
              </div>;
        })}
        </div>
      </div>
    </section>;
}