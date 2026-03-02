import { useState, useEffect, useMemo, useCallback } from "react";
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
  DollarSign,
  Gift,
  Zap,
  Plus,
  ShieldOff,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Settings,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const ITEMS_PER_PAGE = 15;

type UserWithProfile = {
  user_id: string;
  email: string;
  full_name: string | null;
  roles: string[];
  has_subscription: boolean;
  subscription_status: string | null;
  created_at: string;
  is_banned: boolean;
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

function PaginationControls({ currentPage, totalPages, onPageChange }: { currentPage: number; totalPages: number; onPageChange: (page: number) => void }) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between pt-4">
      <p className="text-sm text-muted-foreground">
        Page {currentPage} of {totalPages}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
        >
          Next
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, isAdmin } = useAuthContext();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("users");
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Pagination states
  const [usersPage, setUsersPage] = useState(1);
  const [employeesPage, setEmployeesPage] = useState(1);
  const [contractorsPage, setContractorsPage] = useState(1);
  const [jobsPage, setJobsPage] = useState(1);

  // Data states
  const [users, setUsers] = useState<UserWithProfile[]>([]);
  const [contractors, setContractors] = useState<ContractorProfile[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [packages, setPackages] = useState<{ id: string; name: string }[]>([]);
  const [contractorTiers, setContractorTiers] = useState<ContractorTier[]>([]);

  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Create user form
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserFirstName, setNewUserFirstName] = useState("");
  const [newUserLastName, setNewUserLastName] = useState("");
  const [newUserRole, setNewUserRole] = useState("employee");
  const [isCreatingUser, setIsCreatingUser] = useState(false);

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

  // Reset page to 1 when search changes
  useEffect(() => {
    setUsersPage(1);
    setEmployeesPage(1);
    setContractorsPage(1);
    setJobsPage(1);
  }, [searchTerm]);

  async function fetchData() {
    setIsLoading(true);

    if (activeTab === "users" || activeTab === "employees") {
      await fetchUsers();
    } else if (activeTab === "contractors") {
      await fetchContractors();
    } else if (activeTab === "jobs") {
      await fetchJobs();
    }

    const { data: pkgData } = await supabase
      .from("contractor_packages")
      .select("id, name")
      .eq("is_active", true);
    setPackages(pkgData || []);

    const { data: tierData } = await supabase
      .from("plan_products")
      .select("plan_id, plan_name")
      .eq("plan_type", "contractor")
      .order("price_cents", { ascending: true });
    setContractorTiers(tierData || []);

    setIsLoading(false);
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
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", profile.user_id);

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
          is_banned: false, // We'll check this lazily or via admin API if needed
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
      .select("id, title, status, positions_available, positions_filled, created_at, contractor_id")
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

  async function handleCreateUser() {
    if (!newUserEmail || !newUserPassword || !newUserRole) {
      toast({ title: "Error", description: "Please fill all required fields", variant: "destructive" });
      return;
    }

    if (newUserPassword.length < 8) {
      toast({ title: "Error", description: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }

    setIsCreatingUser(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-user", {
        body: {
          action: "create_user",
          email: newUserEmail.trim(),
          password: newUserPassword,
          first_name: newUserFirstName.trim(),
          last_name: newUserLastName.trim(),
          role: newUserRole,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "Success", description: "User created successfully" });
      setShowCreateUser(false);
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserFirstName("");
      setNewUserLastName("");
      setNewUserRole("employee");
      await fetchUsers();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to create user", variant: "destructive" });
    }
    setIsCreatingUser(false);
  }

  async function handleDeactivateUser(userId: string) {
    setUpdatingId(userId);
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-user", {
        body: { action: "deactivate_user", user_id: userId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "Success", description: "User deactivated" });
      setUsers(users.map((u) => u.user_id === userId ? { ...u, is_banned: true } : u));
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to deactivate user", variant: "destructive" });
    }
    setUpdatingId(null);
  }

  async function handleReactivateUser(userId: string) {
    setUpdatingId(userId);
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-user", {
        body: { action: "reactivate_user", user_id: userId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "Success", description: "User reactivated" });
      setUsers(users.map((u) => u.user_id === userId ? { ...u, is_banned: false } : u));
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to reactivate user", variant: "destructive" });
    }
    setUpdatingId(null);
  }

  async function toggleUserPremium(userId: string, currentHasSub: boolean) {
    setUpdatingId(userId);
    if (currentHasSub) {
      const { error } = await supabase.from("subscriptions").update({ status: "cancelled" }).eq("user_id", userId).eq("status", "active");
      if (error) {
        toast({ title: "Error", description: "Failed to update subscription", variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Subscription cancelled" });
        setUsers(users.map((u) => u.user_id === userId ? { ...u, has_subscription: false, subscription_status: "cancelled" } : u));
      }
    } else {
      const { error } = await supabase.from("subscriptions").insert({ user_id: userId, plan_name: "premium", status: "active" });
      if (error) {
        toast({ title: "Error", description: "Failed to create subscription", variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Premium subscription activated" });
        setUsers(users.map((u) => u.user_id === userId ? { ...u, has_subscription: true, subscription_status: "active" } : u));
      }
    }
    setUpdatingId(null);
  }

  async function toggleEntrepreneur(contractorId: string, currentValue: boolean) {
    setUpdatingId(contractorId);
    const { error } = await supabase.from("contractor_profiles").update({ is_entrepreneur: !currentValue }).eq("id", contractorId);
    if (error) {
      toast({ title: "Error", description: "Failed to update entrepreneur status", variant: "destructive" });
    } else {
      toast({ title: "Success", description: `Entrepreneur status ${!currentValue ? "enabled" : "disabled"}` });
      setContractors(contractors.map((c) => c.id === contractorId ? { ...c, is_entrepreneur: !currentValue } : c));
    }
    setUpdatingId(null);
  }

  async function togglePriority(contractorId: string, currentValue: boolean) {
    setUpdatingId(contractorId);
    const { error } = await supabase.from("contractor_profiles").update({ has_priority: !currentValue }).eq("id", contractorId);
    if (error) {
      toast({ title: "Error", description: "Failed to update priority status", variant: "destructive" });
    } else {
      toast({ title: "Success", description: `Priority badge ${!currentValue ? "enabled" : "disabled"}` });
      setContractors(contractors.map((c) => c.id === contractorId ? { ...c, has_priority: !currentValue } : c));
    }
    setUpdatingId(null);
  }

  async function updateContractorPackage(contractorId: string, packageId: string) {
    setUpdatingId(contractorId);
    const { data: existing } = await supabase.from("contractor_subscriptions").select("id").eq("contractor_profile_id", contractorId).eq("status", "active").maybeSingle();
    if (existing) {
      const { error } = await supabase.from("contractor_subscriptions").update({ package_id: packageId }).eq("id", existing.id);
      if (error) {
        toast({ title: "Error", description: "Failed to update package", variant: "destructive" });
      } else {
        const pkg = packages.find((p) => p.id === packageId);
        toast({ title: "Success", description: "Package updated" });
        setContractors(contractors.map((c) => c.id === contractorId ? { ...c, package_name: pkg?.name || null } : c));
      }
    } else {
      const { error } = await supabase.from("contractor_subscriptions").insert({ contractor_profile_id: contractorId, package_id: packageId, status: "active" });
      if (error) {
        toast({ title: "Error", description: "Failed to assign package", variant: "destructive" });
      } else {
        const pkg = packages.find((p) => p.id === packageId);
        toast({ title: "Success", description: "Package assigned" });
        setContractors(contractors.map((c) => c.id === contractorId ? { ...c, package_name: pkg?.name || null } : c));
      }
    }
    setUpdatingId(null);
  }

  async function updateJobStatus(jobId: string, newStatus: "draft" | "published" | "closed" | "filled") {
    setUpdatingId(jobId);
    const { error } = await supabase.from("jobs").update({ status: newStatus }).eq("id", jobId);
    if (error) {
      toast({ title: "Error", description: "Failed to update job status", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Job status updated" });
      setJobs(jobs.map((j) => j.id === jobId ? { ...j, status: newStatus } : j));
    }
    setUpdatingId(null);
  }

  async function updateContractorTier(contractor: ContractorProfile, newPlanId: string) {
    setUpdatingId(contractor.id);
    const tier = contractorTiers.find((t) => t.plan_id === newPlanId);
    if (!tier) {
      toast({ title: "Error", description: "Invalid tier selected", variant: "destructive" });
      setUpdatingId(null);
      return;
    }

    let jobAllowance: number | null = null;
    let isRecurring = false;
    switch (newPlanId) {
      case "free_contractor":
      case "single_post":
        jobAllowance = 1;
        break;
      case "14_day_sprint":
        jobAllowance = 3;
        break;
      case "monthly_contractor":
      case "quarterly_contractor":
        jobAllowance = null;
        isRecurring = true;
        break;
    }

    if (contractor.current_entitlement_id) {
      const { error: deactivateError } = await supabase.from("contractor_entitlements").update({ status: "consumed", deactivated_at: new Date().toISOString(), deactivated_reason: "admin_tier_change" }).eq("id", contractor.current_entitlement_id);
      if (deactivateError) {
        toast({ title: "Error", description: "Failed to deactivate existing entitlement", variant: "destructive" });
        setUpdatingId(null);
        return;
      }
    }

    const { error: createError } = await supabase.from("contractor_entitlements").insert({
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
      await fetchContractors();
    }
    setUpdatingId(null);
  }

  // Filtered + paginated data
  const filteredUsers = useMemo(() => users.filter(
    (u) => u.email.toLowerCase().includes(searchTerm.toLowerCase()) || u.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  ), [users, searchTerm]);

  const filteredEmployees = useMemo(() => users.filter(
    (u) => u.roles.includes("employee") && (u.email.toLowerCase().includes(searchTerm.toLowerCase()) || u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()))
  ), [users, searchTerm]);

  const filteredContractors = useMemo(() => contractors.filter(
    (c) => c.company_name.toLowerCase().includes(searchTerm.toLowerCase()) || c.email.toLowerCase().includes(searchTerm.toLowerCase())
  ), [contractors, searchTerm]);

  const filteredJobs = useMemo(() => jobs.filter(
    (j) => j.title.toLowerCase().includes(searchTerm.toLowerCase()) || j.company_name.toLowerCase().includes(searchTerm.toLowerCase())
  ), [jobs, searchTerm]);

  const usersTotalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
  const employeesTotalPages = Math.ceil(filteredEmployees.length / ITEMS_PER_PAGE);
  const contractorsTotalPages = Math.ceil(filteredContractors.length / ITEMS_PER_PAGE);
  const jobsTotalPages = Math.ceil(filteredJobs.length / ITEMS_PER_PAGE);

  const paginatedUsers = filteredUsers.slice((usersPage - 1) * ITEMS_PER_PAGE, usersPage * ITEMS_PER_PAGE);
  const paginatedEmployees = filteredEmployees.slice((employeesPage - 1) * ITEMS_PER_PAGE, employeesPage * ITEMS_PER_PAGE);
  const paginatedContractors = filteredContractors.slice((contractorsPage - 1) * ITEMS_PER_PAGE, contractorsPage * ITEMS_PER_PAGE);
  const paginatedJobs = filteredJobs.slice((jobsPage - 1) * ITEMS_PER_PAGE, jobsPage * ITEMS_PER_PAGE);

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
            <p className="text-sm sm:text-base text-muted-foreground">Manage users, contractors, and job postings</p>
          </div>
          <div className="flex w-full sm:w-auto gap-2">
            <Button variant="outline" asChild className="w-full sm:w-auto">
              <Link to="/admin/articles">
                <FileText className="w-4 h-4 mr-2" />
                Article Management
              </Link>
            </Button>
            <Button variant="outline" asChild className="w-full sm:w-auto">
              <Link to="/admin/settings">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Link>
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="w-full max-w-4xl flex flex-nowrap gap-2 overflow-x-auto sm:grid sm:grid-cols-6 sm:gap-2">
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
          </TabsList>

          {/* Search - hide on pricing and referrals tabs */}
          {activeTab !== "pricing" && activeTab !== "referrals" && (
            <div className="flex items-center gap-3">
              <div className="relative max-w-md w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
              </div>
              {activeTab === "users" && (
                <Dialog open={showCreateUser} onOpenChange={setShowCreateUser}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      Add User
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New User</DialogTitle>
                      <DialogDescription>Add a new user to the platform.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="firstName">First Name</Label>
                          <Input id="firstName" value={newUserFirstName} onChange={(e) => setNewUserFirstName(e.target.value)} placeholder="John" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lastName">Last Name</Label>
                          <Input id="lastName" value={newUserLastName} onChange={(e) => setNewUserLastName(e.target.value)} placeholder="Doe" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email *</Label>
                        <Input id="email" type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} placeholder="john@example.com" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password">Password *</Label>
                        <Input id="password" type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} placeholder="Min 8 characters" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="role">Role *</Label>
                        <Select value={newUserRole} onValueChange={setNewUserRole}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="employee">Employee</SelectItem>
                            <SelectItem value="contractor">Contractor</SelectItem>
                            <SelectItem value="writer">Writer</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                      </DialogClose>
                      <Button onClick={handleCreateUser} disabled={isCreatingUser}>
                        {isCreatingUser && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Create User
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          )}

          {/* Referrals Tab */}
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
                {/* Mobile */}
                <div className="space-y-3 sm:hidden">
                  {paginatedUsers.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8 border border-dashed rounded-lg">No users found</div>
                  ) : (
                    paginatedUsers.map((u) => (
                      <div key={u.user_id} className="bg-card border border-border/50 rounded-xl p-4 space-y-3">
                        <div>
                          <p className="font-semibold">{u.full_name || "No name"}</p>
                          <p className="text-sm text-muted-foreground">{u.email}</p>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {u.roles.map((role) => (
                            <Badge key={role} variant="secondary" className="text-xs capitalize">{role}</Badge>
                          ))}
                          {u.is_banned && <Badge variant="destructive" className="text-xs">Deactivated</Badge>}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground">Premium</span>
                          <div className="flex items-center gap-2">
                            <Switch checked={u.has_subscription} onCheckedChange={() => toggleUserPremium(u.user_id, u.has_subscription)} disabled={updatingId === u.user_id} />
                            {u.has_subscription && <Crown className="w-4 h-4 text-yellow-500" />}
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-muted-foreground">Joined {new Date(u.created_at).toLocaleDateString()}</div>
                          {u.is_banned ? (
                            <Button variant="outline" size="sm" onClick={() => handleReactivateUser(u.user_id)} disabled={updatingId === u.user_id}>
                              <ShieldCheck className="w-3 h-3 mr-1" /> Reactivate
                            </Button>
                          ) : (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm" disabled={updatingId === u.user_id}>
                                  <ShieldOff className="w-3 h-3 mr-1" /> Deactivate
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Deactivate User</AlertDialogTitle>
                                  <AlertDialogDescription>This will prevent {u.email} from logging in. You can reactivate them later.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeactivateUser(u.user_id)}>Deactivate</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {/* Desktop */}
                <div className="hidden sm:block bg-card rounded-xl border border-border/50 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Roles</TableHead>
                        <TableHead>Premium</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedUsers.map((u) => (
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
                                <Badge key={role} variant="secondary" className="text-xs capitalize">{role}</Badge>
                              ))}
                              {u.is_banned && <Badge variant="destructive" className="text-xs">Deactivated</Badge>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Switch checked={u.has_subscription} onCheckedChange={() => toggleUserPremium(u.user_id, u.has_subscription)} disabled={updatingId === u.user_id} />
                              {u.has_subscription && <Crown className="w-4 h-4 text-yellow-500" />}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>
                            {u.is_banned ? (
                              <Button variant="outline" size="sm" onClick={() => handleReactivateUser(u.user_id)} disabled={updatingId === u.user_id}>
                                <ShieldCheck className="w-3 h-3 mr-1" /> Reactivate
                              </Button>
                            ) : (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="destructive" size="sm" disabled={updatingId === u.user_id}>
                                    <ShieldOff className="w-3 h-3 mr-1" /> Deactivate
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Deactivate User</AlertDialogTitle>
                                    <AlertDialogDescription>This will prevent {u.email} from logging in. You can reactivate them later.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeactivateUser(u.user_id)}>Deactivate</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <PaginationControls currentPage={usersPage} totalPages={usersTotalPages} onPageChange={setUsersPage} />
              </TabsContent>

              {/* Employees Tab */}
              <TabsContent value="employees" className="space-y-4">
                <div className="space-y-3 sm:hidden">
                  {paginatedEmployees.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8 border border-dashed rounded-lg">No employees found</div>
                  ) : (
                    paginatedEmployees.map((u) => (
                      <div key={u.user_id} className="bg-card border border-border/50 rounded-xl p-4 space-y-3">
                        <div>
                          <p className="font-semibold">{u.full_name || "No name"}</p>
                          <p className="text-sm text-muted-foreground">{u.email}</p>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground">Premium</span>
                          <div className="flex items-center gap-2">
                            <Switch checked={u.has_subscription} onCheckedChange={() => toggleUserPremium(u.user_id, u.has_subscription)} disabled={updatingId === u.user_id} />
                            {u.has_subscription && <Crown className="w-4 h-4 text-yellow-500" />}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">Joined {new Date(u.created_at).toLocaleDateString()}</div>
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
                      {paginatedEmployees.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground py-8">No employees found</TableCell>
                        </TableRow>
                      ) : (
                        paginatedEmployees.map((u) => (
                          <TableRow key={u.user_id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{u.full_name || "No name"}</p>
                                <p className="text-sm text-muted-foreground">{u.email}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Switch checked={u.has_subscription} onCheckedChange={() => toggleUserPremium(u.user_id, u.has_subscription)} disabled={updatingId === u.user_id} />
                                {u.has_subscription && <Crown className="w-4 h-4 text-yellow-500" />}
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                <PaginationControls currentPage={employeesPage} totalPages={employeesTotalPages} onPageChange={setEmployeesPage} />
              </TabsContent>

              {/* Contractors Tab */}
              <TabsContent value="contractors" className="space-y-4">
                <div className="space-y-3 sm:hidden">
                  {paginatedContractors.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8 border border-dashed rounded-lg">No contractors found</div>
                  ) : (
                    paginatedContractors.map((c) => (
                      <div key={c.id} className="bg-card border border-border/50 rounded-xl p-4 space-y-4">
                        <div>
                          <p className="font-semibold">{c.company_name}</p>
                          <p className="text-sm text-muted-foreground">{c.email}</p>
                        </div>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">Priority</span>
                            <div className="flex items-center gap-2">
                              <Switch checked={c.has_priority} onCheckedChange={() => togglePriority(c.id, c.has_priority)} disabled={updatingId === c.id} />
                              {c.has_priority && <Zap className="w-4 h-4 text-amber-500" />}
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">Entrepreneur</span>
                            <div className="flex items-center gap-2">
                              <Switch checked={c.is_entrepreneur} onCheckedChange={() => toggleEntrepreneur(c.id, c.is_entrepreneur)} disabled={updatingId === c.id} />
                              {c.is_entrepreneur && <Star className="w-4 h-4 text-amber-500" />}
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <span className="text-xs font-medium text-muted-foreground">Plan Tier</span>
                          <Select value={c.current_plan_type || ""} onValueChange={(value) => updateContractorTier(c, value)} disabled={updatingId === c.id}>
                            <SelectTrigger className="w-full"><SelectValue placeholder="No plan" /></SelectTrigger>
                            <SelectContent>
                              {contractorTiers.map((tier) => (<SelectItem key={tier.plan_id} value={tier.plan_id}>{tier.plan_name}</SelectItem>))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <span className="text-xs font-medium text-muted-foreground">Legacy Package</span>
                          <Select value={packages.find((p) => p.name === c.package_name)?.id || ""} onValueChange={(value) => updateContractorPackage(c.id, value)} disabled={updatingId === c.id}>
                            <SelectTrigger className="w-full"><SelectValue placeholder="No package" /></SelectTrigger>
                            <SelectContent>
                              {packages.map((pkg) => (<SelectItem key={pkg.id} value={pkg.id}>{pkg.name}</SelectItem>))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="text-xs text-muted-foreground">Joined {new Date(c.created_at).toLocaleDateString()}</div>
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
                      {paginatedContractors.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{c.company_name}</p>
                              <p className="text-sm text-muted-foreground">{c.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Switch checked={c.has_priority} onCheckedChange={() => togglePriority(c.id, c.has_priority)} disabled={updatingId === c.id} />
                              {c.has_priority && <Zap className="w-4 h-4 text-amber-500" />}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Switch checked={c.is_entrepreneur} onCheckedChange={() => toggleEntrepreneur(c.id, c.is_entrepreneur)} disabled={updatingId === c.id} />
                              {c.is_entrepreneur && <Star className="w-4 h-4 text-amber-500" />}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Select value={c.current_plan_type || ""} onValueChange={(value) => updateContractorTier(c, value)} disabled={updatingId === c.id}>
                              <SelectTrigger className="w-36"><SelectValue placeholder="No plan" /></SelectTrigger>
                              <SelectContent>
                                {contractorTiers.map((tier) => (<SelectItem key={tier.plan_id} value={tier.plan_id}>{tier.plan_name}</SelectItem>))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Select value={packages.find((p) => p.name === c.package_name)?.id || ""} onValueChange={(value) => updateContractorPackage(c.id, value)} disabled={updatingId === c.id}>
                              <SelectTrigger className="w-32"><SelectValue placeholder="No package" /></SelectTrigger>
                              <SelectContent>
                                {packages.map((pkg) => (<SelectItem key={pkg.id} value={pkg.id}>{pkg.name}</SelectItem>))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <PaginationControls currentPage={contractorsPage} totalPages={contractorsTotalPages} onPageChange={setContractorsPage} />
              </TabsContent>

              {/* Jobs Tab */}
              <TabsContent value="jobs" className="space-y-4">
                <div className="space-y-3 sm:hidden">
                  {paginatedJobs.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8 border border-dashed rounded-lg">No jobs found</div>
                  ) : (
                    paginatedJobs.map((job) => (
                      <div key={job.id} className="bg-card border border-border/50 rounded-xl p-4 space-y-3">
                        <div>
                          <p className="font-semibold">{job.title}</p>
                          <p className="text-sm text-muted-foreground">{job.company_name}</p>
                        </div>
                        <div className="space-y-2">
                          <span className="text-xs font-medium text-muted-foreground">Status</span>
                          <Select value={job.status} onValueChange={(value: "draft" | "published" | "closed" | "filled") => updateJobStatus(job.id, value)} disabled={updatingId === job.id}>
                            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
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
                          <span>{job.positions_filled}/{job.positions_available}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">Posted {new Date(job.created_at).toLocaleDateString()}</div>
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
                      {paginatedJobs.map((job) => (
                        <TableRow key={job.id}>
                          <TableCell className="font-medium">{job.title}</TableCell>
                          <TableCell className="text-muted-foreground">{job.company_name}</TableCell>
                          <TableCell>
                            <Select value={job.status} onValueChange={(value: "draft" | "published" | "closed" | "filled") => updateJobStatus(job.id, value)} disabled={updatingId === job.id}>
                              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="draft">Draft</SelectItem>
                                <SelectItem value="published">Published</SelectItem>
                                <SelectItem value="closed">Closed</SelectItem>
                                <SelectItem value="filled">Filled</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>{job.positions_filled}/{job.positions_available}</TableCell>
                          <TableCell className="text-muted-foreground">{new Date(job.created_at).toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <PaginationControls currentPage={jobsPage} totalPages={jobsTotalPages} onPageChange={setJobsPage} />
              </TabsContent>

              {/* Pricing Tab */}
              <TabsContent value="pricing" className="space-y-6">
                <ProductPriceManager />
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </div>
  );
}
