import { Footer } from "@/components/landing/Footer";
import { Users, Target, Eye, Handshake, UserCheck, Globe, Clock, Briefcase } from "lucide-react";
import ourStoryImg from "@/assets/about/our-story.png";
import missionImg from "@/assets/about/mission.png";
import connectingPeopleImg from "@/assets/about/connecting-people.png";

const targetGroups = [
  {
    icon: UserCheck,
    title: "First-Time Job Seekers",
    description: "We provide a crucial starting point for young and inexperienced individuals, transforming the search for a first job into a simple and encouraging experience."
  },
  {
    icon: Globe,
    title: "Newcomers to the Country",
    description: "We offer a clear path for new arrivals, helping them settle in and find their first opportunities without the frustration of bureaucracy."
  },
  {
    icon: Clock,
    title: "Active Seniors",
    description: "We value life experience. We are the ideal channel for seniors looking for quick, flexible jobs to supplement their income, without the need for lengthy applications."
  },
  {
    icon: Briefcase,
    title: "Experienced Operational Staff",
    description: "We welcome individuals with practical experience in fields like logistics, retail, hospitality, and essential services, offering a fast track to new roles without the complexity of specialized recruitment."
  }
];

export default function About() {
  return (
    <main className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative py-20 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
        <div className="container-tight relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold font-display mb-6 text-foreground">
              Where Opportunity Meets <span className="text-primary">Simplicity</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Connecting people with opportunities, creating a more inclusive job market for everyone.
            </p>
          </div>
        </div>
      </section>

      {/* Our Story Section */}
      <section className="py-16 lg:py-24">
        <div className="container-tight">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="order-2 lg:order-1">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <h2 className="text-3xl md:text-4xl font-bold font-display text-foreground">Our Story</h2>
              </div>
              <div className="space-y-4 text-muted-foreground leading-relaxed">
                <p>
                  Founded in 2024, Workie was born from a simple yet powerful conviction: finding work and hiring talent should be a quick, human, and accessible process for everyone.
                </p>
                <p>
                  We are more than a job platform; we are a driver of social inclusion, dedicated to simplifying the employment journey for those who need it most. Our focus is on eliminating barriers and bureaucracy, creating a direct path between the need for work and the opportunity.
                </p>
                <p className="font-medium text-foreground">
                  We believe that the dignity of work should be within reach for all, regardless of their starting point.
                </p>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-accent/20 rounded-3xl blur-2xl opacity-50" />
                <img 
                  src={ourStoryImg} 
                  alt="Diverse team working together" 
                  className="relative rounded-2xl shadow-medium w-full object-cover aspect-[4/3]"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mission & Vision Section */}
      <section className="py-16 lg:py-24 bg-muted/30">
        <div className="container-tight">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold font-display text-foreground mb-4">Mission & Vision</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Guiding principles that drive everything we do at Workie.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
            {/* Mission Card */}
            <div className="bg-card rounded-2xl p-8 shadow-soft border border-border/50 hover:shadow-medium transition-shadow">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Target className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-2xl font-bold font-display text-foreground">Mission</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Our Mission is to remove labor market barriers by efficiently connecting individuals seeking operational and non-specialized job opportunities with companies in need of staff. We focus on providing a quick and hassle-free job search experience, ensuring that opportunity is always just a few clicks away.
              </p>
            </div>
            
            {/* Vision Card */}
            <div className="bg-card rounded-2xl p-8 shadow-soft border border-border/50 hover:shadow-medium transition-shadow">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-14 h-14 rounded-xl bg-accent/20 flex items-center justify-center">
                  <Eye className="w-7 h-7 text-accent-foreground" />
                </div>
                <h3 className="text-2xl font-bold font-display text-foreground">Vision</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                To be the global reference platform for non-specialized work, recognized for its positive social impact and for creating a society where the transition to employment is fluid, inclusive, and immediate for everyone, regardless of their background or level of experience in operational roles.
              </p>
            </div>
          </div>
          
          {/* Mission Image */}
          <div className="mt-12">
            <div className="relative max-w-3xl mx-auto">
              <div className="absolute -inset-4 bg-gradient-to-r from-primary/10 to-accent/10 rounded-3xl blur-2xl opacity-50" />
              <img 
                src={missionImg} 
                alt="Our mission to connect people with opportunities" 
                className="relative rounded-2xl shadow-medium w-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Our Commitment Section */}
      <section className="py-16 lg:py-24">
        <div className="container-tight">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold font-display text-foreground mb-4">
              A Job Market for Everyone
            </h2>
            <p className="text-muted-foreground max-w-3xl mx-auto">
              At Workie, our focus is on individuals who are often overlooked by traditional models. We believe that a university degree or a highly specialized background is not the only measure of value. Our ecosystem is designed for simplicity and speed, concentrating on jobs that require practical skills and dedication.
            </p>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {targetGroups.map((group, index) => (
              <div 
                key={group.title}
                className="bg-card rounded-2xl p-6 shadow-soft border border-border/50 hover:shadow-medium hover:border-primary/30 transition-all group"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <group.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold font-display text-foreground mb-3">{group.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{group.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Our Difference Section */}
      <section className="py-16 lg:py-24 bg-muted/30">
        <div className="container-tight">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-r from-accent/20 to-primary/20 rounded-3xl blur-2xl opacity-50" />
                <img 
                  src={connectingPeopleImg} 
                  alt="Workie connecting people with opportunities" 
                  className="relative rounded-2xl shadow-medium w-full object-cover"
                />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center">
                  <Handshake className="w-6 h-6 text-accent-foreground" />
                </div>
                <h2 className="text-3xl md:text-4xl font-bold font-display text-foreground">Cooperation, Not Competition</h2>
              </div>
              <div className="space-y-4 text-muted-foreground leading-relaxed">
                <p>
                  Workie does not seek to compete with recruitment agencies; on the contrary, we cooperate. We act as a strategic partner, indicating candidates for high-volume, non-specialized roles to optimize the time spent on talent search, allowing agencies to focus on more specialized functions.
                </p>
                <p>
                  Our focus is on non-specialized work, quick and accessible, ensuring the labor market operates more efficiently for everyone.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 lg:py-24">
        <div className="container-tight">
          <div className="bg-gradient-to-r from-primary to-primary/80 rounded-3xl p-8 md:p-12 lg:p-16 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_hsl(var(--accent)/0.3),_transparent_70%)]" />
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold font-display text-primary-foreground mb-4">
                Join the Work Revolution
              </h2>
              <p className="text-primary-foreground/80 max-w-2xl mx-auto mb-8 text-lg">
                Whether you are a company looking for efficient and dedicated staff, or an individual seeking an immediate opportunity, Workie is your starting point.
              </p>
              <p className="text-xl md:text-2xl font-semibold font-display text-primary-foreground">
                Workie: Connecting People. Creating Opportunities.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
