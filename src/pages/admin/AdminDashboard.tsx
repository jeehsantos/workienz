import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  AlertTriangle,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  created_at: string;
  email: string;
  package_name: string | null;
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

type ArticleReport = {
  id: string;
  article_id: string;
  article_title: string;
  reporter_email: string;
  report_type: string;
  description: string;
  status: string;
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
  const [reports, setReports] = useState<ArticleReport[]>([]);
  
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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
    } else if (activeTab === "reports") {
      await fetchReports();
    }

    // Always fetch packages for contractor subscriptions
    const { data: pkgData } = await supabase
      .from("contractor_packages")
      .select("id, name")
      .eq("is_active", true);
    setPackages(pkgData || []);

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
      .select("id, user_id, company_name, is_verified, is_entrepreneur, created_at")
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

        // Get contractor subscription
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

        return {
          ...c,
          email: profile?.email || "",
          package_name: packageName,
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

  async function fetchReports() {
    const { data: reportData } = await supabase
      .from("article_reports")
      .select("id, article_id, report_type, description, status, created_at, reporter_user_id")
      .order("created_at", { ascending: false });

    if (!reportData) {
      setReports([]);
      return;
    }

    const enriched = await Promise.all(
      reportData.map(async (report) => {
        // Get article title
        const { data: article } = await supabase
          .from("articles")
          .select("title")
          .eq("id", report.article_id)
          .maybeSingle();

        // Get reporter email
        const { data: profile } = await supabase
          .from("profiles")
          .select("email")
          .eq("user_id", report.reporter_user_id)
          .maybeSingle();

        return {
          ...report,
          article_title: article?.title || "Unknown Article",
          reporter_email: profile?.email || "Unknown",
        };
      })
    );

    setReports(enriched);
  }

  async function updateReportStatus(reportId: string, newStatus: string) {
    setUpdatingId(reportId);

    const { error } = await supabase
      .from("article_reports")
      .update({ status: newStatus })
      .eq("id", reportId);

    if (error) {
      toast({ title: "Error", description: "Failed to update report status", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Report status updated" });
      setReports(reports.map(r => r.id === reportId ? { ...r, status: newStatus } : r));
    }

    setUpdatingId(null);
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
      <div className="container-tight py-8">
        <Button variant="ghost" asChild className="mb-6">
          <Link to="/dashboard">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
        </Button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 font-display">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Manage users, contractors, and job postings
          </p>
        </div>

        {/* Analytics Card */}
        <Link 
          to="/admin/analytics"
          className="block mb-8 bg-card rounded-xl p-6 border border-border/50 shadow-soft hover:shadow-md transition-all hover:border-primary/30 group"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <BarChart3 className="w-7 h-7 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold font-display group-hover:text-primary transition-colors">Analytics Dashboard</h2>
              <p className="text-muted-foreground text-sm">View hiring metrics, job statistics, and platform trends</p>
            </div>
            <ArrowLeft className="w-5 h-5 text-muted-foreground rotate-180 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-5 w-full max-w-2xl">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="employees" className="flex items-center gap-2">
              <HardHat className="w-4 h-4" />
              Employees
            </TabsTrigger>
            <TabsTrigger value="contractors" className="flex items-center gap-2">
              <Building className="w-4 h-4" />
              Contractors
            </TabsTrigger>
            <TabsTrigger value="jobs" className="flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              Jobs
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Reports
            </TabsTrigger>
          </TabsList>

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Users Tab */}
              <TabsContent value="users" className="space-y-4">
                <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
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
                <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
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
                <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Company</TableHead>
                        <TableHead>Entrepreneur</TableHead>
                        <TableHead>Package</TableHead>
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
                <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
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

              {/* Reports Tab */}
              <TabsContent value="reports" className="space-y-4">
                <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Article</TableHead>
                        <TableHead>Reporter</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reports.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            No reports submitted yet
                          </TableCell>
                        </TableRow>
                      ) : (
                        reports.map((report) => (
                          <TableRow key={report.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{report.article_title}</p>
                                <p className="text-xs text-muted-foreground line-clamp-1">
                                  {report.description}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {report.reporter_email}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">
                                {report.report_type.replace(/_/g, ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={report.status}
                                onValueChange={(value) => updateReportStatus(report.id, value)}
                                disabled={updatingId === report.id}
                              >
                                <SelectTrigger className="w-28">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending">Pending</SelectItem>
                                  <SelectItem value="reviewed">Reviewed</SelectItem>
                                  <SelectItem value="resolved">Resolved</SelectItem>
                                  <SelectItem value="dismissed">Dismissed</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {new Date(report.created_at).toLocaleDateString()}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </div>
  );
}
