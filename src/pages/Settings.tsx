import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ResetPasswordSection } from "@/components/dashboard/settings/ResetPasswordSection";
import { ReferralProgramSection } from "@/components/dashboard/settings/ReferralProgramSection";
import { useAuthContext } from "@/contexts/AuthContext";
import { Shield, Download, Trash2, ExternalLink, ShieldCheck } from "lucide-react";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

const VerifyWorkRightsContent = lazy(() => import("@/components/settings/VerifyWorkRightsSection"));

type SettingsSection = "password" | "referral" | "billing" | "privacy" | "verification";

interface SidebarItem {
  id: SettingsSection;
  label: string;
  employeeOnly?: boolean;
}

const sidebarItems: SidebarItem[] = [
  { id: "password", label: "Password" },
  { id: "verification", label: "Work Verification", employeeOnly: true },
  { id: "referral", label: "Referral Program" },
  { id: "billing", label: "Billing & Subscription" },
  { id: "privacy", label: "Privacy & Data" },
];

export default function Settings() {
  const [searchParams] = useSearchParams();
  const initialSection = (searchParams.get("section") as SettingsSection) || "password";
  const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection);
  const navigate = useNavigate();
  const { user, isEmployee } = useAuthContext();

  const filteredSidebarItems = sidebarItems.filter(
    (item) => !item.employeeOnly || isEmployee()
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
      case "billing":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold font-display">Billing & Subscription</h2>
              <p className="text-sm text-muted-foreground mt-1">
                View your plan details and manage your billing preferences.
              </p>
            </div>
            <Button asChild>
              <Link to="/subscription">Manage Subscription</Link>
            </Button>
          </div>
        );
      case "privacy":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold font-display">Privacy & Data</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Manage your personal data and exercise your rights under the New Zealand Privacy Act 2020.
              </p>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Download className="h-4 w-4 text-primary" />
                  <h3 className="font-medium text-sm">Request My Data</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Request a copy of all personal information we hold about you. We will respond within 20 working days.
                </p>
                <Button variant="outline" size="sm" asChild>
                  <a href={`mailto:privacy@workie.co.nz?subject=Data%20Access%20Request&body=Hi%20Workie%20Privacy%20Team%2C%0A%0AI%20would%20like%20to%20request%20a%20copy%20of%20all%20personal%20data%20you%20hold%20about%20me.%0A%0AAccount%20email%3A%20${encodeURIComponent(user?.email ?? "")}%0A%0AThank%20you.`}>
                    Request Data Export
                  </a>
                </Button>
              </div>

              <div className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Trash2 className="h-4 w-4 text-destructive" />
                  <h3 className="font-medium text-sm">Delete My Account</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Request permanent deletion of your account and all associated personal data. This action cannot be undone.
                </p>
                <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10" asChild>
                  <a href={`mailto:privacy@workie.co.nz?subject=Account%20Deletion%20Request&body=Hi%20Workie%20Privacy%20Team%2C%0A%0AI%20would%20like%20to%20request%20the%20deletion%20of%20my%20account%20and%20all%20associated%20personal%20data.%0A%0AAccount%20email%3A%20${encodeURIComponent(user?.email ?? "")}%0A%0AI%20understand%20this%20action%20is%20permanent.%0A%0AThank%20you.`}>
                    Request Account Deletion
                  </a>
                </Button>
              </div>

              <div className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-medium text-sm">Data Correction</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  You can update most of your information directly from your profile. For other corrections, contact us at{" "}
                  <a href="mailto:privacy@workie.co.nz" className="text-primary hover:underline">privacy@workie.co.nz</a>.
                </p>
              </div>

              <div className="pt-2">
                <Link to="/privacy" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Read our full Privacy Policy
                </Link>
              </div>
            </div>
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
