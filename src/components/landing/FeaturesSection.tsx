import { Search, Users, FileText, Shield, Zap, Globe } from "lucide-react";

const features = [
  {
    icon: Search,
    title: "Smart Job Matching",
    description: "AI-powered algorithms connect the right workers with the right opportunities instantly.",
  },
  {
    icon: Users,
    title: "Verified Profiles",
    description: "Every contractor and employee goes through our verification process for trust and safety.",
  },
  {
    icon: FileText,
    title: "Learning Resources",
    description: "Access exclusive articles and guides to boost your career with a premium subscription.",
  },
  {
    icon: Shield,
    title: "Secure Platform",
    description: "Enterprise-grade security protects your data and ensures safe transactions.",
  },
  {
    icon: Zap,
    title: "Quick Hiring",
    description: "Fill temporary positions in hours, not weeks. Our streamlined process saves you time.",
  },
  {
    icon: Globe,
    title: "Location Based",
    description: "Find opportunities in your city, suburb, or expand your search nationwide.",
  },
];

export function FeaturesSection() {
  return (
    <section className="py-20 lg:py-28 bg-secondary/30">
      <div className="container-tight">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4 font-display">
            Why Choose Kiwi Hunters?
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            We're revolutionizing how New Zealand connects talent with opportunity.
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="group bg-card rounded-xl p-6 shadow-soft hover:shadow-medium transition-all duration-300 hover:-translate-y-1"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <feature.icon className="w-6 h-6 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2 font-display">{feature.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
