import { useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  User,
  Briefcase,
  FileText,
  Users,
  MessageCircle,
  BarChart3,
  CreditCard,
  FolderEdit,
  CalendarCheck,
  ShieldCheck,
} from "lucide-react";
import MyConversations from "@/components/dashboard/MyConversations";
import { SettingsCard } from "@/components/dashboard/SettingsCard";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, roles, isLoading, isAdmin, isContractor, isEmployee, isWriter } = useAuthContext();

  // Memoize role-based UI decisions - MUST be before any early returns
  const showEmployeeCards = useMemo(() => isEmployee(), [isEmployee]);
  const showContractorCards = useMemo(() => isContractor(), [isContractor]);
  const showWriterCards = useMemo(() => isWriter(), [isWriter]);
  const showAdminCards = useMemo(() => isAdmin(), [isAdmin]);

  // Check if user is a free tier employee (for showing referral dashboard)
  const { data: hasActiveSubscription } = useQuery({
    queryKey: ["user-subscription-status", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      return !!data;
    },
    enabled: !!user && showEmployeeCards,
  });

  const showReferralDashboard = showEmployeeCards && !hasActiveSubscription;

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/auth");
    }
  }, [user, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-destructive/10 text-destructive";
      case "contractor":
        return "bg-accent/20 text-accent-foreground";
      case "employee":
        return "bg-primary/10 text-primary";
      case "writer":
        return "bg-secondary text-secondary-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Main content */}
      <div className="container-tight py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 font-display">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's what you can do today.</p>
        </div>

        {/* Quick actions grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Profile Card - Employee */}
          {showEmployeeCards && (
            <div className="bg-card rounded-xl p-6 shadow-soft border border-border/50">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <User className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2 font-display">My Profile</h3>
              <p className="text-muted-foreground text-sm mb-4">Set up your profile so contractors can find you.</p>
              <Button variant="outline" size="sm" asChild>
                <Link to="/employee/view-profile">View Profile</Link>
              </Button>
            </div>
          )}

          {/* Verify Work Rights Card - Employee */}
          {showEmployeeCards && (
            <div className="bg-card rounded-xl p-6 shadow-soft border border-border/50">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <ShieldCheck className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2 font-display">Verify Work Rights</h3>
              <p className="text-muted-foreground text-sm mb-4">Verify your right to work in NZ to apply for jobs.</p>
              <Button variant="outline" size="sm" asChild>
                <Link to="/employee/verify">Verify Now</Link>
              </Button>
            </div>
          )}

          {/* Profile Card - Contractor */}
          {showContractorCards && (
            <div className="bg-card rounded-xl p-6 shadow-soft border border-border/50">
              <div className="w-12 h-12 rounded-lg bg-accent/20 flex items-center justify-center mb-4">
                <User className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-lg font-semibold mb-2 font-display">Company Profile</h3>
              <p className="text-muted-foreground text-sm mb-4">Update your company information.</p>
              <Button variant="outline" size="sm" asChild>
                <Link to="/contractor/profile">Edit Profile</Link>
              </Button>
            </div>
          )}

          {/* Contractor: Post Jobs */}
          {showContractorCards && (
            <div className="bg-card rounded-xl p-6 shadow-soft border border-border/50">
              <div className="w-12 h-12 rounded-lg bg-accent/20 flex items-center justify-center mb-4">
                <Briefcase className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-lg font-semibold mb-2 font-display">Post a Job</h3>
              <p className="text-muted-foreground text-sm mb-4">Create a new job posting to find workers.</p>
              <Button variant="outline" size="sm" asChild>
                <Link to="/contractor/post-job">Post Job</Link>
              </Button>
            </div>
          )}

          {/* Contractor: My Jobs */}
          {showContractorCards && (
            <div className="bg-card rounded-xl p-6 shadow-soft border border-border/50">
              <div className="w-12 h-12 rounded-lg bg-accent/20 flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-lg font-semibold mb-2 font-display">My Jobs</h3>
              <p className="text-muted-foreground text-sm mb-4">View and manage your job postings.</p>
              <Button variant="outline" size="sm" asChild>
                <Link to="/contractor/jobs">View Jobs</Link>
              </Button>
            </div>
          )}

          {/* Contractor-specific: Find Workers */}
          {showContractorCards && (
            <div className="bg-card rounded-xl p-6 shadow-soft border border-border/50">
              <div className="w-12 h-12 rounded-lg bg-accent/20 flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-lg font-semibold mb-2 font-display">Find Workers</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Search through verified workers and fill positions quickly.
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link to="/contractor/search-workers">Browse Workers</Link>
              </Button>
            </div>
          )}

          {/* Employee-specific */}
          {showEmployeeCards && (
            <div className="bg-card rounded-xl p-6 shadow-soft border border-border/50">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Briefcase className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2 font-display">Find Jobs</h3>
              <p className="text-muted-foreground text-sm mb-4">Browse available positions and apply for jobs.</p>
              <Button variant="outline" size="sm" asChild>
                <Link to="/jobs">Browse Jobs</Link>
              </Button>
            </div>
          )}

          {/* Employee: My Shifts */}
          {showEmployeeCards && (
            <div className="bg-card rounded-xl p-6 shadow-soft border border-border/50">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <CalendarCheck className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2 font-display">My Shifts</h3>
              <p className="text-muted-foreground text-sm mb-4">View your shift assignments and browse available shifts.</p>
              <Button variant="outline" size="sm" asChild>
                <Link to="/employee/shifts">View Shifts</Link>
              </Button>
            </div>
          )}

          {/* Writer-specific */}
          {showWriterCards && (
            <div className="bg-card rounded-xl p-6 shadow-soft border border-border/50">
              <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-secondary-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2 font-display">Write Topic</h3>
              <p className="text-muted-foreground text-sm mb-4">Create educational content for employees.</p>
              <Button variant="outline" size="sm" asChild>
                <Link to="/writer/new-guide">Write Topic</Link>
              </Button>
            </div>
          )}

          {/* Writer: My Topics */}
          {showWriterCards && (
            <div className="bg-card rounded-xl p-6 shadow-soft border border-border/50">
              <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-secondary-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2 font-display">My Topics</h3>
              <p className="text-muted-foreground text-sm mb-4">View and manage your published topics.</p>
              <Button variant="outline" size="sm" asChild>
                <Link to="/writer/articles">View Topics</Link>
              </Button>
            </div>
          )}

          {/* Admin-specific */}
          {showAdminCards && (
            <Link
              to="/admin"
              className="bg-card rounded-xl p-6 shadow-soft border border-border/50 hover:shadow-md transition-all hover:border-primary/30 group block"
            >
              <div className="w-12 h-12 rounded-lg bg-destructive/10 flex items-center justify-center mb-4 group-hover:bg-destructive/20 transition-colors">
                <Briefcase className="w-6 h-6 text-destructive" />
              </div>
              <h3 className="text-lg font-semibold mb-2 font-display group-hover:text-primary transition-colors">
                Admin Dashboard
              </h3>
              <p className="text-muted-foreground text-sm mb-4">Manage users, contractors, jobs, and subscriptions.</p>
            </Link>
          )}

          {/* Admin Partners */}
          {showAdminCards && (
            <Link
              to="/admin/partners"
              className="bg-card rounded-xl p-6 shadow-soft border border-border/50 hover:shadow-md transition-all hover:border-primary/30 group block"
            >
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
                <Users className="w-6 h-6 text-accent-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2 font-display group-hover:text-primary transition-colors">
                Partner Management
              </h3>
              <p className="text-muted-foreground text-sm mb-4">Manage platform partners and their discounts.</p>
            </Link>
          )}

          {/* Admin Analytics */}
          {showAdminCards && (
            <Link
              to="/admin/analytics"
              className="bg-card rounded-xl p-6 shadow-soft border border-border/50 hover:shadow-md transition-all hover:border-primary/30 group block"
            >
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <BarChart3 className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2 font-display group-hover:text-primary transition-colors">
                View Analytics
              </h3>
              <p className="text-muted-foreground text-sm mb-4">
                Track hiring metrics, job statistics, and platform trends.
              </p>
            </Link>
          )}

          {/* Admin Topics Management */}
          {showAdminCards && (
            <Link
              to="/admin/content-structure"
              className="bg-card rounded-xl p-6 shadow-soft border border-border/50 hover:shadow-md transition-all hover:border-primary/30 group block"
            >
              <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center mb-4 group-hover:bg-secondary/80 transition-colors">
                <FolderEdit className="w-6 h-6 text-secondary-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2 font-display group-hover:text-primary transition-colors">
                Topics Management
              </h3>
              <p className="text-muted-foreground text-sm mb-4">Manage categories, topics, and reports.</p>
            </Link>
          )}

          {/* Admin Settings */}
          {showAdminCards && (
            <Link
              to="/admin/settings"
              className="bg-card rounded-xl p-6 shadow-soft border border-border/50 hover:shadow-md transition-all hover:border-primary/30 group block"
            >
              <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center mb-4 group-hover:bg-muted/80 transition-colors">
                <CreditCard className="w-6 h-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2 font-display group-hover:text-primary transition-colors">
                Platform Settings
              </h3>
              <p className="text-muted-foreground text-sm mb-4">Configure platform-wide settings and limits.</p>
            </Link>
          )}

          {/* Topics (for employees) */}
          {showEmployeeCards && (
            <div className="bg-card rounded-xl p-6 shadow-soft border border-border/50">
              <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-secondary-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2 font-display">Workie NZ Guide</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Everything you need to prepare for work and life in New Zealand.
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link to="/guide">Browse Topics</Link>
              </Button>
            </div>
          )
          {/* Settings Card - for employees and contractors */}
          {(showEmployeeCards || showContractorCards) && <SettingsCard showReferralProgram={showReferralDashboard} />}
        </div>

        {/* My Conversations Section - for employees and contractors */}
        {(showEmployeeCards || showContractorCards) && user && (
          <div className="mt-8">
            <div className="bg-card rounded-xl p-6 shadow-soft border border-border/50">
              <div className="flex items-center gap-2 mb-4">
                <MessageCircle className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold font-display">My Conversations</h2>
              </div>
              <MyConversations userId={user.id} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
