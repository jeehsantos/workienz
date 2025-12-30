import { HeroSection } from "@/components/landing/HeroSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { RolesSection } from "@/components/landing/RolesSection";
import { CTASection } from "@/components/landing/CTASection";
import { Footer } from "@/components/landing/Footer";

const Index = () => {
  return (
    <div>
      <HeroSection />
      <FeaturesSection />
      <RolesSection />
      <CTASection />
      <Footer />
    </div>
  );
};

export default Index;
