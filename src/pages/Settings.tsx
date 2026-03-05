import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Gift, ChevronLeft, User, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { ResetPasswordSection } from "@/components/dashboard/settings/ResetPasswordSection";
import { ReferralProgramSection } from "@/components/dashboard/settings/ReferralProgramSection";
import { useAuthContext } from "@/contexts/AuthContext";

type SettingsSection = "password" | "referral";

interface SidebarItem {
  id: SettingsSection;
  label: string;
  icon: React.ElementType;
  description: string;
  requiresRole?: string;
}

const sidebarItems: SidebarItem[] = [
  {
    id: "password",
    label: "Password",
    icon: Lock,
    description: "Change your account password",
  },
  {
    id: "referral",
    label: "Referral Program",
    icon: Gift,
    description: "Invite friends and earn credits",
    requiresRole: "contractor",
  },
];

export default function Settings() {
  const [activeSection, setActiveSection] = useState<SettingsSection>("password");
  const navigate = useNavigate();
  const { roles } = useAuthContext();

  const visibleItems = sidebarItems.filter(
    (item) => !item.requiresRole || roles.includes(item.requiresRole as any)
  );

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
            <Separator />
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
            <Separator />
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
      <div className="border-b bg-card">
        <div className="container-tight px-4 sm:px-6 py-4 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard")}
            className="shrink-0"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold font-display">Settings</h1>
            <p className="text-sm text-muted-foreground hidden sm:block">
              Manage your account preferences
            </p>
          </div>
        </div>
      </div>

      {/* Main layout */}
      <div className="container-tight px-4 sm:px-6 py-6">
        <div className="flex flex-col md:flex-row gap-6 md:gap-0 rounded-xl border bg-card overflow-hidden shadow-soft">
          {/* Sidebar */}
          <nav className="md:w-64 md:border-r bg-muted/30 shrink-0">
            <ScrollArea className="md:h-[calc(100vh-180px)]">
              <div className="p-2">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveSection(item.id)}
                      className={cn(
                        "w-full flex items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors",
                        isActive
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-lg shrink-0",
                          isActive ? "bg-primary/10 text-primary" : "bg-muted"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{item.label}</p>
                        <p className="text-xs text-muted-foreground truncate hidden sm:block">
                          {item.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </nav>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <ScrollArea className="md:h-[calc(100vh-180px)]">
              <div className="p-6 sm:p-8">{renderContent()}</div>
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  );
}
