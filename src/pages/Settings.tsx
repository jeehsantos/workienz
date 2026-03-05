import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ResetPasswordSection } from "@/components/dashboard/settings/ResetPasswordSection";
import { ReferralProgramSection } from "@/components/dashboard/settings/ReferralProgramSection";

type SettingsSection = "password" | "referral";

interface SidebarItem {
  id: SettingsSection;
  label: string;
}

const sidebarItems: SidebarItem[] = [
  { id: "password", label: "Password" },
  { id: "referral", label: "Referral Program" },
];

export default function Settings() {
  const [activeSection, setActiveSection] = useState<SettingsSection>("password");
  const navigate = useNavigate();

  const renderContent = () => {
    switch (activeSection) {
      case "password":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold font-display">Password</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Update your account password to keep your account secure.
              </p>
            </div>
            <ResetPasswordSection inline />
          </div>
        );
      case "referral":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold font-display">Referral Program</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Share your referral code and earn bonus credits when friends sign up.
              </p>
            </div>
            <ReferralProgramSection inline />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="container-tight px-4 sm:px-6 pt-8 pb-2 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/dashboard")}
          className="shrink-0 -ml-2"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-semibold font-display text-foreground">Settings</h1>
      </div>

      {/* Main layout — Claude-style */}
      <div className="container-tight px-4 sm:px-6 pt-6 pb-12">
        <div className="flex flex-col md:flex-row gap-8 md:gap-16">
          {/* Sidebar — plain text links with active left border */}
          <nav className="shrink-0 md:w-48">
            <ul className="flex flex-row md:flex-col gap-1">
              {sidebarItems.map((item) => {
                const isActive = activeSection === item.id;
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => setActiveSection(item.id)}
                      className={cn(
                        "w-full text-left px-4 py-2 rounded-md text-sm font-medium transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary border-l-2 border-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      {item.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Content area */}
          <div className="flex-1 min-w-0">
            <div className="rounded-xl border bg-card p-6 sm:p-8 shadow-soft">
              {renderContent()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
