import { Briefcase, User } from "lucide-react";
import { Button } from "@/components/ui/button";

const roles = [
  {
    icon: Briefcase,
    title: "I'm Hiring",
    subtitle: "For Contractors & Employers",
    description: "Post jobs, search through verified workers, and fill positions quickly. Access our database of skilled temporary workers.",
    features: [
      "Post unlimited job listings",
      "Search verified worker profiles",
      "Direct messaging with candidates",
      "Hire within hours, not weeks",
    ],
    cta: "Start Hiring",
    variant: "hero" as const,
  },
  {
    icon: User,
    title: "I'm Looking for Work",
    subtitle: "For Employees & Job Seekers",
    description: "Create your profile, showcase your skills, and get matched with temporary and short-term opportunities that fit your schedule.",
    features: [
      "Create a standout profile",
      "Get matched to relevant jobs",
      "Access exclusive career articles",
      "Build your work history",
    ],
    cta: "Find Work",
    variant: "outline" as const,
  },
];

export function RolesSection() {
  return (
    <section className="py-20 lg:py-28">
      <div className="container-tight">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4 font-display">
            How Can We Help You?
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Whether you're looking to hire or be hired, Kiwi Hunters has you covered.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {roles.map((role) => (
            <div
              key={role.title}
              className="bg-card rounded-2xl p-8 shadow-soft hover:shadow-medium transition-all duration-300 border border-border/50"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-xl gradient-primary flex items-center justify-center">
                  <role.icon className="w-7 h-7 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold font-display">{role.title}</h3>
                  <p className="text-muted-foreground">{role.subtitle}</p>
                </div>
              </div>

              <p className="text-foreground/80 mb-6 leading-relaxed">
                {role.description}
              </p>

              <ul className="space-y-3 mb-8">
                {role.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    </div>
                    <span className="text-foreground/80">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button variant={role.variant} size="lg" className="w-full">
                {role.cta}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
