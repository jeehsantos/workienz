import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  ArrowLeft,
  Users,
  Briefcase,
  FileText,
  Search,
  Crown,
  Star,
  Building,
  HardHat,
  BarChart3,
  Settings,
  Save,
  DollarSign,
  Gift,
  Zap,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductPriceManager } from "@/components/admin/ProductPriceManager";
import { AdminReferralManagement } from "@/components/admin/AdminReferralManagement";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type UserWithProfile = {
  user_id: string;
  email: string;
  full_name: string | null;
  roles: string[];
  has_subscription: boolean;
  subscription_status: string | null;
  created_at: string;
};

type ContractorProfile = {
  id: string;
  user_id: string;
  company_name: string;
  is_verified: boolean;
  is_entrepreneur: boolean;
  has_priority: boolean;
  created_at: string;
  email: string;
  package_name: string | null;
  current_plan_type: string | null;
  current_entitlement_id: string | null;
};

type ContractorTier = {
  plan_id: string;
  plan_name: string;
};

type Job = {
  id: string;
  title: string;
  status: string;
  company_name: string;
  positions_available: number;
  positions_filled: number;
  created_at: string;
};


export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, isAdmin } = useAuthContext();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("users");
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Data states
  const [users, setUsers] = useState<UserWithProfile[]>([]);
  const [contractors, setContractors] = useState<ContractorProfile[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [packages, setPackages] = useState<{ id: string; name: string }[]>([]);
  const [contractorTiers, setContractorTiers] = useState<ContractorTier[]>([]);
  
  
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  
  // Platform settings state
  const [maxPositionsPerJob, setMaxPositionsPerJob] = useState("10");
  const [freeTierCooldownDays, setFreeTierCooldownDays] = useState("3");
  const [paidTierMaxActiveApps, setPaidTierMaxActiveApps] = useState("3");
  const [paidTierCooldownDays, setPaidTierCooldownDays] = useState("3");
  // Contractor tier settings
  const [singlePostJobLimit, setSinglePostJobLimit] = useState("1");
  const [singlePostDurationDays, setSinglePostDurationDays] = useState("14");
  const [sprintDurationDays, setSprintDurationDays] = useState("14");
  const [sprintJobLimit, setSprintJobLimit] = useState("3");
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  // Upgrade button visibility setting
  const [hideUpgradeButtons, setHideUpgradeButtons] = useState(false);
  const [isSavingUpgradeVisibility, setIsSavingUpgradeVisibility] = useState(false);
  // Contractor referral settings
  const [contractorReferralDays, setContractorReferralDays] = useState("3");
  const [contractorReferralEnabled, setContractorReferralEnabled] = useState(true);

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin())) {
      navigate("/dashboard");
    }
  }, [user, authLoading, isAdmin, navigate]);

  useEffect(() => {
    if (user && isAdmin()) {
      fetchData();
    }
  }, [user, isAdmin, activeTab]);

  async function fetchData() {
    setIsLoading(true);

    if (activeTab === "users" || activeTab === "employees") {
      await fetchUsers();
    } else if (activeTab === "contractors") {
      await fetchContractors();
    } else if (activeTab === "jobs") {
      await fetchJobs();
    } else if (activeTab === "settings") {
      await fetchSettings();
    }

    // Always fetch packages for contractor subscriptions
    const { data: pkgData } = await supabase
      .from("contractor_packages")
      .select("id, name")
      .eq("is_active", true);
    setPackages(pkgData || []);

    // Fetch contractor tiers from plan_products
    const { data: tierData } = await supabase
      .from("plan_products")
      .select("plan_id, plan_name")
      .eq("plan_type", "contractor")
      .order("price_cents", { ascending: true });
    setContractorTiers(tierData || []);

    setIsLoading(false);
  }

  async function fetchSettings() {
    const { data } = await supabase
      .from("platform_settings")
      .select("setting_key, setting_value")
      .in("setting_key", [
        "max_positions_per_job",
        "free_tier_cooldown_days",
        "paid_tier_max_active_apps",
        "paid_tier_cooldown_days",
        "single_post_job_limit",
        "single_post_duration_days",
        "14_day_sprint_duration_days",
        "14_day_sprint_job_limit",
        "hide_upgrade_buttons",
        "contractor_referral_premium_days",
        "contractor_referral_enabled",
      ]);
    
    if (data) {
      data.forEach(setting => {
        switch (setting.setting_key) {
          case "max_positions_per_job":
            setMaxPositionsPerJob(setting.setting_value);
            break;
          case "free_tier_cooldown_days":
            setFreeTierCooldownDays(setting.setting_value);
            break;
          case "paid_tier_max_active_apps":
            setPaidTierMaxActiveApps(setting.setting_value);
            break;
          case "paid_tier_cooldown_days":
            setPaidTierCooldownDays(setting.setting_value);
            break;
          case "single_post_job_limit":
            setSinglePostJobLimit(setting.setting_value);
            break;
          case "single_post_duration_days":
            setSinglePostDurationDays(setting.setting_value);
            break;
          case "14_day_sprint_duration_days":
            setSprintDurationDays(setting.setting_value);
            break;
          case "14_day_sprint_job_limit":
            setSprintJobLimit(setting.setting_value);
            break;
          case "hide_upgrade_buttons":
            setHideUpgradeButtons(setting.setting_value === "true");
            break;
          case "contractor_referral_premium_days":
            setContractorReferralDays(setting.setting_value);
            break;
          case "contractor_referral_enabled":
            setContractorReferralEnabled(setting.setting_value === "true");
            break;
        }
      });
    }
  }

  async function toggleHideUpgradeButtons(checked: boolean) {
    setIsSavingUpgradeVisibility(true);
    
    const { error } = await supabase
      .from("platform_settings")
      .update({ setting_value: checked ? "true" : "false" })
      .eq("setting_key", "hide_upgrade_buttons");
    
    if (error) {
      toast({ title: "Error", description: "Failed to update setting", variant: "destructive" });
    } else {
      setHideUpgradeButtons(checked);
      toast({ title: "Success", description: `Upgrade buttons ${checked ? "hidden" : "visible"}` });
    }
    
    setIsSavingUpgradeVisibility(false);
  }

  async function saveSettings() {
    setIsSavingSettings(true);
    
    const updates = [
      { key: "max_positions_per_job", value: maxPositionsPerJob },
      { key: "free_tier_cooldown_days", value: freeTierCooldownDays },
      { key: "paid_tier_max_active_apps", value: paidTierMaxActiveApps },
      { key: "paid_tier_cooldown_days", value: paidTierCooldownDays },
      { key: "single_post_job_limit", value: singlePostJobLimit },
      { key: "single_post_duration_days", value: singlePostDurationDays },
      { key: "14_day_sprint_duration_days", value: sprintDurationDays },
      { key: "14_day_sprint_job_limit", value: sprintJobLimit },
      { key: "contractor_referral_premium_days", value: contractorReferralDays },
      { key: "contractor_referral_enabled", value: contractorReferralEnabled ? "true" : "false" },
    ];

    let hasError = false;
    for (const update of updates) {
      const { error } = await supabase
        .from("platform_settings")
        .update({ setting_value: update.value })
        .eq("setting_key", update.key);
      
      if (error) {
        console.error(`Failed to update ${update.key}:`, error);
        hasError = true;
      }
    }
    
    if (hasError) {
      toast({ title: "Error", description: "Failed to save some settings", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Settings saved successfully" });
    }
    
    setIsSavingSettings(false);
  }

  async function fetchUsers() {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, email, full_name, created_at")
      .order("created_at", { ascending: false });

    if (!profiles) {
      setUsers([]);
      return;
    }

    const enriched = await Promise.all(
      profiles.map(async (profile) => {
        // Fetch roles
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", profile.user_id);

        // Fetch subscription
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("status")
          .eq("user_id", profile.user_id)
          .eq("status", "active")
          .maybeSingle();

        return {
          ...profile,
          roles: roles?.map((r) => r.role) || [],
          has_subscription: !!sub,
          subscription_status: sub?.status || null,
        };
      })
    );

    setUsers(enriched);
  }

  async function fetchContractors() {
    const { data: contractorData } = await supabase
      .from("contractor_profiles")
      .select("id, user_id, company_name, is_verified, is_entrepreneur, has_priority, created_at")
      .order("created_at", { ascending: false });

    if (!contractorData) {
      setContractors([]);
      return;
    }

    const enriched = await Promise.all(
      contractorData.map(async (c) => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("email")
          .eq("user_id", c.user_id)
          .maybeSingle();

        // Get contractor subscription (legacy)
        const { data: subData } = await supabase
          .from("contractor_subscriptions")
          .select("package_id")
          .eq("contractor_profile_id", c.id)
          .eq("status", "active")
          .maybeSingle();

        let packageName = null;
        if (subData) {
          const { data: pkg } = await supabase
            .from("contractor_packages")
            .select("name")
            .eq("id", subData.package_id)
            .maybeSingle();
          packageName = pkg?.name || null;
        }

        // Get active entitlement plan type (new system)
        const { data: entitlementData } = await supabase
          .from("contractor_entitlements")
          .select("id, plan_type")
          .eq("user_id", c.user_id)
          .eq("status", "active")
          .order("is_recurring", { ascending: false })
          .limit(1)
          .maybeSingle();

        return {
          ...c,
          has_priority: c.has_priority ?? false,
          email: profile?.email || "",
          package_name: packageName,
          current_plan_type: entitlementData?.plan_type || null,
          current_entitlement_id: entitlementData?.id || null,
        };
      })
    );

    setContractors(enriched);
  }

  async function fetchJobs() {
    const { data: jobData } = await supabase
      .from("jobs")
      .select(`
        id,
        title,
        status,
        positions_available,
        positions_filled,
        created_at,
        contractor_id
      `)
      .order("created_at", { ascending: false });

    if (!jobData) {
      setJobs([]);
      return;
    }

    const enriched = await Promise.all(
      jobData.map(async (job) => {
        const { data: contractor } = await supabase
          .from("contractor_profiles")
          .select("company_name")
          .eq("id", job.contractor_id)
          .maybeSingle();

        return {
          ...job,
          company_name: contractor?.company_name || "Unknown",
        };
      })
    );

    setJobs(enriched);
  }


  async function toggleUserPremium(userId: string, currentHasSub: boolean) {
    setUpdatingId(userId);

    if (currentHasSub) {
      // Cancel subscription
      const { error } = await supabase
        .from("subscriptions")
        .update({ status: "cancelled" })
        .eq("user_id", userId)
        .eq("status", "active");

      if (error) {
        toast({ title: "Error", description: "Failed to update subscription", variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Subscription cancelled" });
        setUsers(users.map(u => u.user_id === userId ? { ...u, has_subscription: false, subscription_status: "cancelled" } : u));
      }
    } else {
      // Create active subscription
      const { error } = await supabase
        .from("subscriptions")
        .insert({
          user_id: userId,
          plan_name: "premium",
          status: "active",
        });

      if (error) {
        toast({ title: "Error", description: "Failed to create subscription", variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Premium subscription activated" });
        setUsers(users.map(u => u.user_id === userId ? { ...u, has_subscription: true, subscription_status: "active" } : u));
      }
    }

    setUpdatingId(null);
  }

  async function toggleEntrepreneur(contractorId: string, currentValue: boolean) {
    setUpdatingId(contractorId);

    const { error } = await supabase
      .from("contractor_profiles")
      .update({ is_entrepreneur: !currentValue })
      .eq("id", contractorId);

    if (error) {
      toast({ title: "Error", description: "Failed to update entrepreneur status", variant: "destructive" });
    } else {
      toast({ title: "Success", description: `Entrepreneur status ${!currentValue ? "enabled" : "disabled"}` });
      setContractors(contractors.map(c => c.id === contractorId ? { ...c, is_entrepreneur: !currentValue } : c));
    }

    setUpdatingId(null);
  }

  async function togglePriority(contractorId: string, currentValue: boolean) {
    setUpdatingId(contractorId);

    const { error } = await supabase
      .from("contractor_profiles")
      .update({ has_priority: !currentValue })
      .eq("id", contractorId);

    if (error) {
      toast({ title: "Error", description: "Failed to update priority status", variant: "destructive" });
    } else {
      toast({ title: "Success", description: `Priority badge ${!currentValue ? "enabled" : "disabled"}` });
      setContractors(contractors.map(c => c.id === contractorId ? { ...c, has_priority: !currentValue } : c));
    }

    setUpdatingId(null);
  }

  async function updateContractorPackage(contractorId: string, packageId: string) {
    setUpdatingId(contractorId);

    // First check if there's an existing active subscription
    const { data: existing } = await supabase
      .from("contractor_subscriptions")
      .select("id")
      .eq("contractor_profile_id", contractorId)
      .eq("status", "active")
      .maybeSingle();

    if (existing) {
      // Update existing
      const { error } = await supabase
        .from("contractor_subscriptions")
        .update({ package_id: packageId })
        .eq("id", existing.id);

      if (error) {
        toast({ title: "Error", description: "Failed to update package", variant: "destructive" });
      } else {
        const pkg = packages.find(p => p.id === packageId);
        toast({ title: "Success", description: "Package updated" });
        setContractors(contractors.map(c => c.id === contractorId ? { ...c, package_name: pkg?.name || null } : c));
      }
    } else {
      // Create new
      const { error } = await supabase
        .from("contractor_subscriptions")
        .insert({
          contractor_profile_id: contractorId,
          package_id: packageId,
          status: "active",
        });

      if (error) {
        toast({ title: "Error", description: "Failed to assign package", variant: "destructive" });
      } else {
        const pkg = packages.find(p => p.id === packageId);
        toast({ title: "Success", description: "Package assigned" });
        setContractors(contractors.map(c => c.id === contractorId ? { ...c, package_name: pkg?.name || null } : c));
      }
    }

    setUpdatingId(null);
  }

  async function updateJobStatus(jobId: string, newStatus: "draft" | "published" | "closed" | "filled") {
    setUpdatingId(jobId);

    const { error } = await supabase
      .from("jobs")
      .update({ status: newStatus })
      .eq("id", jobId);

    if (error) {
      toast({ title: "Error", description: "Failed to update job status", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Job status updated" });
      setJobs(jobs.map(j => j.id === jobId ? { ...j, status: newStatus } : j));
    }

    setUpdatingId(null);
  }

  async function updateContractorTier(contractor: ContractorProfile, newPlanId: string) {
    setUpdatingId(contractor.id);

    const tier = contractorTiers.find(t => t.plan_id === newPlanId);
    if (!tier) {
      toast({ title: "Error", description: "Invalid tier selected", variant: "destructive" });
      setUpdatingId(null);
      return;
    }

    // Determine job_allowance based on plan type
    let jobAllowance: number | null = null;
    let isRecurring = false;
    switch (newPlanId) {
      case "free_contractor":
        jobAllowance = 1;
        isRecurring = false;
        break;
      case "single_post":
        jobAllowance = 1;
        isRecurring = false;
        break;
      case "14_day_sprint":
        jobAllowance = 3;
        isRecurring = false;
        break;
      case "monthly_contractor":
      case "quarterly_contractor":
        jobAllowance = null; // Unlimited
        isRecurring = true;
        break;
    }

    // Check if contractor already has an active entitlement
    if (contractor.current_entitlement_id) {
      // Deactivate the current entitlement
      const { error: deactivateError } = await supabase
        .from("contractor_entitlements")
        .update({ 
          status: "consumed", 
          deactivated_at: new Date().toISOString(),
          deactivated_reason: "admin_tier_change"
        })
        .eq("id", contractor.current_entitlement_id);

      if (deactivateError) {
        toast({ title: "Error", description: "Failed to deactivate existing entitlement", variant: "destructive" });
        setUpdatingId(null);
        return;
      }
    }

    // Create new entitlement with the selected tier
    const { error: createError } = await supabase
      .from("contractor_entitlements")
      .insert({
        user_id: contractor.user_id,
        plan_type: newPlanId,
        status: "active",
        job_allowance: jobAllowance,
        jobs_used: 0,
        is_recurring: isRecurring,
        is_stackable: false,
        activated_at: new Date().toISOString(),
        purchased_at: new Date().toISOString(),
      });

    if (createError) {
      toast({ title: "Error", description: "Failed to assign tier: " + createError.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: `Tier updated to ${tier.plan_name}` });
      // Refresh contractors to get the new entitlement ID
      await fetchContractors();
    }

    setUpdatingId(null);
  }

  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filter for employees specifically
  const filteredEmployees = users.filter(
    (u) =>
      u.roles.includes("employee") &&
      (u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredContractors = contractors.filter(
    (c) =>
      c.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredJobs = jobs.filter(
    (j) =>
      j.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      j.company_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container-tight py-6 sm:py-8 px-4 sm:px-0">
        <Button variant="ghost" asChild className="mb-4 sm:mb-6">
          <Link to="/dashboard">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
        </Button>

        <div className="mb-6 sm:mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-2 font-display">Admin Dashboard</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Manage users, contractors, and job postings
            </p>
          </div>
          <div className="flex w-full sm:w-auto gap-2">
            <Button variant="outline" asChild className="w-full sm:w-auto">
              <Link to="/admin/articles">
                <FileText className="w-4 h-4 mr-2" />
                Article Management
              </Link>
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="w-full max-w-4xl flex flex-nowrap gap-2 overflow-x-auto sm:grid sm:grid-cols-7 sm:gap-2">
            <TabsTrigger value="users" className="flex items-center gap-2 shrink-0 text-xs sm:text-sm">
              <Users className="w-4 h-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="employees" className="flex items-center gap-2 shrink-0 text-xs sm:text-sm">
              <HardHat className="w-4 h-4" />
              Employees
            </TabsTrigger>
            <TabsTrigger value="contractors" className="flex items-center gap-2 shrink-0 text-xs sm:text-sm">
              <Building className="w-4 h-4" />
              Contractors
            </TabsTrigger>
            <TabsTrigger value="jobs" className="flex items-center gap-2 shrink-0 text-xs sm:text-sm">
              <Briefcase className="w-4 h-4" />
              Jobs
            </TabsTrigger>
            <TabsTrigger value="referrals" className="flex items-center gap-2 shrink-0 text-xs sm:text-sm">
              <Gift className="w-4 h-4" />
              Referrals
            </TabsTrigger>
            <TabsTrigger value="pricing" className="flex items-center gap-2 shrink-0 text-xs sm:text-sm">
              <DollarSign className="w-4 h-4" />
              Pricing
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2 shrink-0 text-xs sm:text-sm">
              <Settings className="w-4 h-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Search - hide on settings, pricing, and referrals tabs */}
          {activeTab !== "settings" && activeTab !== "pricing" && activeTab !== "referrals" && (
            <div className="relative max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          )}

          {/* Referrals Tab - render outside loading state */}
          <TabsContent value="referrals" className="space-y-4">
            <AdminReferralManagement />
          </TabsContent>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Users Tab */}
              <TabsContent value="users" className="space-y-4">
                <div className="space-y-3 sm:hidden">
                  {filteredUsers.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8 border border-dashed rounded-lg">
                      No users found
                    </div>
                  ) : (
                    filteredUsers.map((u) => (
                      <div key={u.user_id} className="bg-card border border-border/50 rounded-xl p-4 space-y-3">
                        <div>
                          <p className="font-semibold">{u.full_name || "No name"}</p>
                          <p className="text-sm text-muted-foreground">{u.email}</p>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {u.roles.map((role) => (
                            <Badge key={role} variant="secondary" className="text-xs capitalize">
                              {role}
                            </Badge>
                          ))}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground">Premium</span>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={u.has_subscription}
                              onCheckedChange={() => toggleUserPremium(u.user_id, u.has_subscription)}
                              disabled={updatingId === u.user_id}
                            />
                            {u.has_subscription && (
                              <Crown className="w-4 h-4 text-yellow-500" />
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Joined {new Date(u.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="hidden sm:block bg-card rounded-xl border border-border/50 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Roles</TableHead>
                        <TableHead>Premium</TableHead>
                        <TableHead>Joined</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((u) => (
                        <TableRow key={u.user_id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{u.full_name || "No name"}</p>
                              <p className="text-sm text-muted-foreground">{u.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {u.roles.map((role) => (
                                <Badge key={role} variant="secondary" className="text-xs capitalize">
                                  {role}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={u.has_subscription}
                                onCheckedChange={() => toggleUserPremium(u.user_id, u.has_subscription)}
                                disabled={updatingId === u.user_id}
                              />
                              {u.has_subscription && (
                                <Crown className="w-4 h-4 text-yellow-500" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(u.created_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* Employees Tab */}
              <TabsContent value="employees" className="space-y-4">
                <div className="space-y-3 sm:hidden">
                  {filteredEmployees.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8 border border-dashed rounded-lg">
                      No employees found
                    </div>
                  ) : (
                    filteredEmployees.map((u) => (
                      <div key={u.user_id} className="bg-card border border-border/50 rounded-xl p-4 space-y-3">
                        <div>
                          <p className="font-semibold">{u.full_name || "No name"}</p>
                          <p className="text-sm text-muted-foreground">{u.email}</p>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground">Premium</span>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={u.has_subscription}
                              onCheckedChange={() => toggleUserPremium(u.user_id, u.has_subscription)}
                              disabled={updatingId === u.user_id}
                            />
                            {u.has_subscription && (
                              <Crown className="w-4 h-4 text-yellow-500" />
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Joined {new Date(u.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="hidden sm:block bg-card rounded-xl border border-border/50 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Premium</TableHead>
                        <TableHead>Joined</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEmployees.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                            No employees found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredEmployees.map((u) => (
                          <TableRow key={u.user_id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{u.full_name || "No name"}</p>
                                <p className="text-sm text-muted-foreground">{u.email}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={u.has_subscription}
                                  onCheckedChange={() => toggleUserPremium(u.user_id, u.has_subscription)}
                                  disabled={updatingId === u.user_id}
                                />
                                {u.has_subscription && (
                                  <Crown className="w-4 h-4 text-yellow-500" />
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {new Date(u.created_at).toLocaleDateString()}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* Contractors Tab */}
              <TabsContent value="contractors" className="space-y-4">
                <div className="space-y-3 sm:hidden">
                  {filteredContractors.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8 border border-dashed rounded-lg">
                      No contractors found
                    </div>
                  ) : (
                    filteredContractors.map((c) => (
                      <div key={c.id} className="bg-card border border-border/50 rounded-xl p-4 space-y-4">
                        <div>
                          <p className="font-semibold">{c.company_name}</p>
                          <p className="text-sm text-muted-foreground">{c.email}</p>
                        </div>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">Priority</span>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={c.has_priority}
                                onCheckedChange={() => togglePriority(c.id, c.has_priority)}
                                disabled={updatingId === c.id}
                              />
                              {c.has_priority && (
                                <Zap className="w-4 h-4 text-amber-500" />
                              )}
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">Entrepreneur</span>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={c.is_entrepreneur}
                                onCheckedChange={() => toggleEntrepreneur(c.id, c.is_entrepreneur)}
                                disabled={updatingId === c.id}
                              />
                              {c.is_entrepreneur && (
                                <Star className="w-4 h-4 text-amber-500" />
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <span className="text-xs font-medium text-muted-foreground">Plan Tier</span>
                          <Select
                            value={c.current_plan_type || ""}
                            onValueChange={(value) => updateContractorTier(c, value)}
                            disabled={updatingId === c.id}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="No plan" />
                            </SelectTrigger>
                            <SelectContent>
                              {contractorTiers.map((tier) => (
                                <SelectItem key={tier.plan_id} value={tier.plan_id}>
                                  {tier.plan_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <span className="text-xs font-medium text-muted-foreground">Legacy Package</span>
                          <Select
                            value={packages.find(p => p.name === c.package_name)?.id || ""}
                            onValueChange={(value) => updateContractorPackage(c.id, value)}
                            disabled={updatingId === c.id}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="No package" />
                            </SelectTrigger>
                            <SelectContent>
                              {packages.map((pkg) => (
                                <SelectItem key={pkg.id} value={pkg.id}>
                                  {pkg.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Joined {new Date(c.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="hidden sm:block bg-card rounded-xl border border-border/50 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Company</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Entrepreneur</TableHead>
                        <TableHead>Plan Tier</TableHead>
                        <TableHead>Legacy Package</TableHead>
                        <TableHead>Joined</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredContractors.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{c.company_name}</p>
                              <p className="text-sm text-muted-foreground">{c.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={c.has_priority}
                                onCheckedChange={() => togglePriority(c.id, c.has_priority)}
                                disabled={updatingId === c.id}
                              />
                              {c.has_priority && (
                                <Zap className="w-4 h-4 text-amber-500" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={c.is_entrepreneur}
                                onCheckedChange={() => toggleEntrepreneur(c.id, c.is_entrepreneur)}
                                disabled={updatingId === c.id}
                              />
                              {c.is_entrepreneur && (
                                <Star className="w-4 h-4 text-amber-500" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={c.current_plan_type || ""}
                              onValueChange={(value) => updateContractorTier(c, value)}
                              disabled={updatingId === c.id}
                            >
                              <SelectTrigger className="w-36">
                                <SelectValue placeholder="No plan" />
                              </SelectTrigger>
                              <SelectContent>
                                {contractorTiers.map((tier) => (
                                  <SelectItem key={tier.plan_id} value={tier.plan_id}>
                                    {tier.plan_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={packages.find(p => p.name === c.package_name)?.id || ""}
                              onValueChange={(value) => updateContractorPackage(c.id, value)}
                              disabled={updatingId === c.id}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue placeholder="No package" />
                              </SelectTrigger>
                              <SelectContent>
                                {packages.map((pkg) => (
                                  <SelectItem key={pkg.id} value={pkg.id}>
                                    {pkg.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(c.created_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* Jobs Tab */}
              <TabsContent value="jobs" className="space-y-4">
                <div className="space-y-3 sm:hidden">
                  {filteredJobs.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8 border border-dashed rounded-lg">
                      No jobs found
                    </div>
                  ) : (
                    filteredJobs.map((job) => (
                      <div key={job.id} className="bg-card border border-border/50 rounded-xl p-4 space-y-3">
                        <div>
                          <p className="font-semibold">{job.title}</p>
                          <p className="text-sm text-muted-foreground">{job.company_name}</p>
                        </div>
                        <div className="space-y-2">
                          <span className="text-xs font-medium text-muted-foreground">Status</span>
                          <Select
                            value={job.status}
                            onValueChange={(value: "draft" | "published" | "closed" | "filled") => updateJobStatus(job.id, value)}
                            disabled={updatingId === job.id}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="draft">Draft</SelectItem>
                              <SelectItem value="published">Published</SelectItem>
                              <SelectItem value="closed">Closed</SelectItem>
                              <SelectItem value="filled">Filled</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Positions</span>
                          <span>
                            {job.positions_filled}/{job.positions_available}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Posted {new Date(job.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="hidden sm:block bg-card rounded-xl border border-border/50 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Job</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Positions</TableHead>
                        <TableHead>Posted</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredJobs.map((job) => (
                        <TableRow key={job.id}>
                          <TableCell className="font-medium">{job.title}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {job.company_name}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={job.status}
                              onValueChange={(value: "draft" | "published" | "closed" | "filled") => updateJobStatus(job.id, value)}
                              disabled={updatingId === job.id}
                            >
                              <SelectTrigger className="w-28">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="draft">Draft</SelectItem>
                                <SelectItem value="published">Published</SelectItem>
                                <SelectItem value="closed">Closed</SelectItem>
                                <SelectItem value="filled">Filled</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            {job.positions_filled}/{job.positions_available}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(job.created_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>


              {/* Pricing Tab */}
              <TabsContent value="pricing" className="space-y-6">
                <ProductPriceManager />
              </TabsContent>

              {/* Settings Tab */}
              <TabsContent value="settings" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Platform Settings</CardTitle>
                    <CardDescription>Configure platform-wide settings for job posting and applications</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-8">
                    {/* Job Posting Settings */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Job Posting Limits</h3>
                      <div className="space-y-2 max-w-xs">
                        <Label htmlFor="maxPositions">Maximum Positions Per Job</Label>
                        <Input
                          id="maxPositions"
                          type="number"
                          min="1"
                          max="100"
                          value={maxPositionsPerJob}
                          onChange={(e) => setMaxPositionsPerJob(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Contractors cannot post jobs with more positions than this limit.
                        </p>
                      </div>
                    </div>

                    {/* Application Throttling Settings */}
                    <div className="space-y-4 pt-4 border-t">
                      <h3 className="text-lg font-semibold">Application Throttling (Workers)</h3>
                      <p className="text-sm text-muted-foreground">
                        Control how frequently workers can apply to jobs based on their subscription tier.
                      </p>
                      
                      <div className="grid sm:grid-cols-3 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="freeTierCooldown">Free Tier Cooldown (Days)</Label>
                          <Input
                            id="freeTierCooldown"
                            type="number"
                            min="0"
                            max="30"
                            value={freeTierCooldownDays}
                            onChange={(e) => setFreeTierCooldownDays(e.target.value)}
                          />
                          <p className="text-xs text-muted-foreground">
                            Days free users must wait between applications.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="paidTierMaxApps">Paid Tier Max Active Apps</Label>
                          <Input
                            id="paidTierMaxApps"
                            type="number"
                            min="1"
                            max="20"
                            value={paidTierMaxActiveApps}
                            onChange={(e) => setPaidTierMaxActiveApps(e.target.value)}
                          />
                          <p className="text-xs text-muted-foreground">
                            Max pending/shortlisted applications for subscribers.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="paidTierCooldown">Paid Tier Cooldown (Days)</Label>
                          <Input
                            id="paidTierCooldown"
                            type="number"
                            min="0"
                            max="30"
                            value={paidTierCooldownDays}
                            onChange={(e) => setPaidTierCooldownDays(e.target.value)}
                          />
                          <p className="text-xs text-muted-foreground">
                            Days subscribers must wait between applications.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Upgrade Button Visibility */}
                    <div className="space-y-4 pt-4 border-t">
                      <h3 className="text-lg font-semibold">Upgrade Button Visibility</h3>
                      <p className="text-sm text-muted-foreground">
                        Control whether upgrade/premium buttons are shown to users.
                      </p>
                      
                      <div className="flex items-start gap-4 p-4 bg-muted/30 rounded-lg border border-border/50">
                        <Switch
                          id="hideUpgradeButtons"
                          checked={hideUpgradeButtons}
                          onCheckedChange={toggleHideUpgradeButtons}
                          disabled={isSavingUpgradeVisibility}
                        />
                        <div className="space-y-1">
                          <Label htmlFor="hideUpgradeButtons" className="font-medium cursor-pointer">
                            Hide Upgrade Buttons
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            When enabled:
                          </p>
                          <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                            <li><strong>Employees:</strong> "Upgrade to Premium" buttons are completely hidden</li>
                            <li><strong>Contractors:</strong> Upgrade buttons become "Become a Partner" and redirect to Contact page</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* Contractor Referral Program Settings */}
                    <div className="space-y-4 pt-4 border-t">
                      <h3 className="text-lg font-semibold">Contractor Referral Program</h3>
                      <p className="text-sm text-muted-foreground">
                        Configure the contractor-to-contractor referral program that grants temporary Premium access.
                      </p>
                      
                      <div className="grid sm:grid-cols-2 gap-6">
                        <div className="flex items-start gap-4 p-4 bg-muted/30 rounded-lg border border-border/50">
                          <Switch
                            id="contractorReferralEnabled"
                            checked={contractorReferralEnabled}
                            onCheckedChange={setContractorReferralEnabled}
                          />
                          <div className="space-y-1">
                            <Label htmlFor="contractorReferralEnabled" className="font-medium cursor-pointer">
                              Enable Contractor Referral Program
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              When enabled, contractors can share referral links to earn Premium days.
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="contractorReferralDays">Premium Days Per Referral</Label>
                          <Input
                            id="contractorReferralDays"
                            type="number"
                            min="0"
                            max="90"
                            value={contractorReferralDays}
                            onChange={(e) => setContractorReferralDays(e.target.value)}
                          />
                          <p className="text-xs text-muted-foreground">
                            Days of Premium access granted when a referred contractor publishes their first job. Changes apply to future rewards only.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Contractor Tier Settings */}
                    <div className="space-y-4 pt-4 border-t">
                      <h3 className="text-lg font-semibold">Contractor Tier Limits</h3>
                      <p className="text-sm text-muted-foreground">
                        Configure job posting limits and durations for one-time contractor plans.
                      </p>
                      
                      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="singlePostJobLimit">Single Post Job Limit</Label>
                          <Input
                            id="singlePostJobLimit"
                            type="number"
                            min="1"
                            max="10"
                            value={singlePostJobLimit}
                            onChange={(e) => setSinglePostJobLimit(e.target.value)}
                          />
                          <p className="text-xs text-muted-foreground">
                            Max jobs for Single Post tier.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="singlePostDuration">Single Post Duration (Days)</Label>
                          <Input
                            id="singlePostDuration"
                            type="number"
                            min="1"
                            max="90"
                            value={singlePostDurationDays}
                            onChange={(e) => setSinglePostDurationDays(e.target.value)}
                          />
                          <p className="text-xs text-muted-foreground">
                            Days after first job published.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="sprintJobLimit">14-Day Sprint Job Limit</Label>
                          <Input
                            id="sprintJobLimit"
                            type="number"
                            min="1"
                            max="20"
                            value={sprintJobLimit}
                            onChange={(e) => setSprintJobLimit(e.target.value)}
                          />
                          <p className="text-xs text-muted-foreground">
                            Max jobs for 14-Day Sprint tier.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="sprintDuration">Sprint Duration (Days)</Label>
                          <Input
                            id="sprintDuration"
                            type="number"
                            min="1"
                            max="90"
                            value={sprintDurationDays}
                            onChange={(e) => setSprintDurationDays(e.target.value)}
                          />
                          <p className="text-xs text-muted-foreground">
                            Days after first job published.
                          </p>
                        </div>
                      </div>
                    </div>

                    <Button onClick={saveSettings} disabled={isSavingSettings} className="mt-6">
                      {isSavingSettings ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      Save All Settings
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </div>
  );
}
