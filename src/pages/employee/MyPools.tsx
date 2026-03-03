import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  ArrowLeft,
  Users,
  LogOut,
  Building2,
  Calendar,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
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
import { EmployeeShiftBrowser } from "@/components/jobs/EmployeeShiftBrowser";

interface ShiftJob {
  id: string;
  title: string;
  shift_allocation_mode: string;
}

interface PoolMembership {
  id: string;
  contractor_id: string;
  category: string;
  status: string;
  created_at: string;
  contractor_profile: {
    id: string;
    company_name: string;
    city: string | null;
    industry: string | null;
    avatar_url: string | null;
  } | null;
  shift_jobs: ShiftJob[];
}

export default function MyPools() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, isEmployee } = useAuthContext();
  const { toast } = useToast();

  const [pools, setPools] = useState<PoolMembership[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const [expandedPool, setExpandedPool] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || !isEmployee())) {
      navigate("/auth");
    }
  }, [user, authLoading, isEmployee, navigate]);

  const fetchPools = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("contractor_talent_pool_members")
      .select("id, contractor_id, category, status, created_at")
      .eq("employee_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching pools:", error);
      setIsLoading(false);
      return;
    }

    const memberships = data || [];

    if (memberships.length === 0) {
      setPools([]);
      setIsLoading(false);
      return;
    }

    // Batch fetch contractor profiles
    const contractorUserIds = memberships.map((m) => m.contractor_id);
    const { data: cProfiles } = await supabase
      .from("contractor_profiles")
      .select("id, user_id, company_name, city, industry, avatar_url")
      .in("user_id", contractorUserIds);

    const cpMap = new Map(
      (cProfiles || []).map((cp) => [cp.user_id, cp])
    );

    // Fetch published shift jobs for each contractor
    const contractorProfileIds = (cProfiles || []).map((cp) => cp.id);
    let shiftJobsMap = new Map<string, ShiftJob[]>();

    if (contractorProfileIds.length > 0) {
      const { data: shiftJobs } = await supabase
        .from("jobs")
        .select("id, title, contractor_id, shift_allocation_mode")
        .eq("job_type", "shift")
        .eq("status", "published")
        .in("contractor_id", contractorProfileIds);

      if (shiftJobs) {
        for (const j of shiftJobs) {
          const existing = shiftJobsMap.get(j.contractor_id) || [];
          existing.push({
            id: j.id,
            title: j.title,
            shift_allocation_mode: (j as any).shift_allocation_mode || "first_come",
          });
          shiftJobsMap.set(j.contractor_id, existing);
        }
      }
    }

    const enriched: PoolMembership[] = memberships.map((m) => {
      const cp = cpMap.get(m.contractor_id);
      return {
        ...m,
        contractor_profile: cp ? { id: cp.id, company_name: cp.company_name, city: cp.city, industry: cp.industry, avatar_url: cp.avatar_url } : null,
        shift_jobs: cp ? (shiftJobsMap.get(cp.id) || []) : [],
      };
    });

    setPools(enriched);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    if (user && isEmployee()) fetchPools();
  }, [user, isEmployee, fetchPools]);

  const handleLeavePool = async (membershipId: string) => {
    setLeavingId(membershipId);

    const { error } = await supabase
      .from("contractor_talent_pool_members")
      .update({ status: "left_by_worker" })
      .eq("id", membershipId);

    setLeavingId(null);

    if (error) {
      toast({ title: "Error", description: "Failed to leave pool.", variant: "destructive" });
      return;
    }

    setPools((prev) => prev.filter((p) => p.id !== membershipId));
    toast({ title: "Left Pool", description: "You have left the talent pool." });
  };

  if (authLoading || isLoading) {
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
          <h1 className="text-3xl font-bold font-display">My Talent Pools</h1>
          <p className="text-muted-foreground mt-1">
            You're in {pools.length} active pool{pools.length !== 1 ? "s" : ""}. Browse and request available shifts below.
          </p>
        </div>

        {pools.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-xl border border-border/50">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Pool Memberships</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              When a contractor approves your application for a shift-based role, you'll be added to their talent pool and can request shifts.
            </p>
            <Button asChild className="mt-4">
              <Link to="/jobs">Browse Jobs</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {pools.map((pool) => {
              const isExpanded = expandedPool === pool.id;
              const shiftJobCount = pool.shift_jobs.length;

              return (
                <div key={pool.id} className="bg-card rounded-xl border border-border/50 overflow-hidden">
                  <div className="p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-6 h-6 text-primary" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-lg">
                          {pool.contractor_profile?.company_name || "Contractor"}
                        </h3>

                        <div className="flex flex-wrap items-center gap-3 mt-1">
                          <Badge variant="secondary">{pool.category}</Badge>
                          {pool.contractor_profile?.city && (
                            <span className="text-sm text-muted-foreground">{pool.contractor_profile.city}</span>
                          )}
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            Joined {new Date(pool.created_at).toLocaleDateString()}
                          </span>
                          {shiftJobCount > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {shiftJobCount} shift job{shiftJobCount !== 1 ? "s" : ""}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {shiftJobCount > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setExpandedPool(isExpanded ? null : pool.id)}
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
                            {isExpanded ? "Hide Shifts" : "View Shifts"}
                          </Button>
                        )}

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={leavingId === pool.id}
                              className="text-destructive hover:text-destructive"
                            >
                              {leavingId === pool.id ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              ) : (
                                <LogOut className="w-4 h-4 mr-2" />
                              )}
                              Leave
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Leave Talent Pool?</AlertDialogTitle>
                              <AlertDialogDescription>
                                You'll no longer be able to request shifts from{" "}
                                {pool.contractor_profile?.company_name || "this contractor"}'s {pool.category} pool.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleLeavePool(pool.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Leave Pool
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>

                  {/* Expanded: show shift jobs */}
                  {isExpanded && shiftJobCount > 0 && (
                    <div className="border-t border-border/50 p-6 bg-muted/20 space-y-6">
                      {pool.shift_jobs.map((sj) => (
                        <div key={sj.id}>
                          <h4 className="font-medium mb-3">{sj.title}</h4>
                          <EmployeeShiftBrowser
                            jobId={sj.id}
                            jobTitle={sj.title}
                            allocationMode={sj.shift_allocation_mode}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
