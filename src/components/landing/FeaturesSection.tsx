import { Search, Users, FileText, Shield, Zap, Globe, Type } from "lucide-react";
const features = [{
  icon: Search,
  title: "One-to-One Hiring",
  description: "Each job opens a single hiring slot. One candidate at a time, one direct conversation, and a real chance to get hired — no application flooding."
}, {
  icon: Users,
  title: "Ready-to-Work Profiles",
  description: "Candidates confirm availability, work rights, and start dates upfront, so employers only engage with people ready to start."
}, {
  icon: FileText,
  title: "Quick Hiring",
  description: "Fill temporary positions in hours, not weeks. Our streamlined process saves you time."
}, {
  icon: Shield,
  title: "Secure & Admin-Light",
  description: "We don’t handle payroll or employment contracts. We provide a secure platform that reduces admin and helps you hire faster with confidence."
}, {
  icon: Zap,
  title: "Direct Employer Chat",
  description: "Candidates and employers connect instantly via private chat or quick call. No middlemen, no delays."
}, {
  icon: Globe,
  title: "Built for First Jobs & Temporary Work",
  description: "Designed for students, migrants, and new arrivals looking for warehouse, farm, hospitality, and other immediate-start roles."
}];
export function FeaturesSection() {
  return <section className="py-20 lg:py-28 bg-gradient-to-b from-secondary/30 to-background relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
      </div>

      <div className="container-tight relative z-10">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-primary/10 rounded-full px-4 py-2 mb-6">
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Powerful Features</span>
          </div>
          <h2 className="text-3xl lg:text-4xl font-bold mb-4 font-display">
            Why Choose Workie?
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            We're revolutionizing how New Zealand connects talent with opportunity.
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {features.map((feature, index) => <div key={feature.title} className="group bg-card/80 backdrop-blur-sm rounded-2xl p-6 shadow-soft hover:shadow-medium transition-all duration-300 hover:-translate-y-2 border border-border/50" style={{
          animationDelay: `${index * 100}ms`
        }}>
              <div className="w-14 h-14 rounded-xl gradient-primary flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <feature.icon className="w-7 h-7 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-3 font-display">{feature.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
            </div>)}
        </div>
      </div>
    </section>;
}