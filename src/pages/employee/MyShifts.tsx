import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, isPast, isToday } from "date-fns";
import {
  Loader2,
  CalendarCheck,
  Clock,
  MapPin,
  Users,
  ArrowLeft,
  CalendarDays,
  AlertCircle,
  CheckCircle2,
  History,
} from "lucide-react";
import { EmployeeShiftBrowser } from "@/components/jobs/EmployeeShiftBrowser";

type ShiftAssignment = {
  id: string;
  status: string;
  assigned_at: string;
  shift_id: string;
  job_id: string;
  shift: {
    id: string;
    shift_date: string;
    start_time: string;
    end_time: string;
    break_minutes: number;
    capacity: number;
  };
  job: {
    id: string;
    title: string;
    location_city: string | null;
    location_suburb: string | null;
    industry: string | null;
    shift_allocation_mode: string;
    contractor_profiles: {
      company_name: string;
    };
  };
};

type PoolJob = {
  jobId: string;
  jobTitle: string;
  allocationMode: string;
  companyName: string;
};

export default function MyShifts() {
  const navigate = useNavigate();
  const { user, isEmployee, isLoading: authLoading } = useAuthContext();
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [poolJobs, setPoolJobs] = useState<PoolJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("upcoming");

  useEffect(() => {
    if (!authLoading && (!user || !isEmployee())) {
      navigate("/auth", { replace: true });
    }
  }, [authLoading, user, isEmployee, navigate]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);

    // Fetch shift assignments
    const { data: assignmentsData } = await supabase
      .from("shift_assignments")
      .select(`
        id, status, assigned_at, shift_id, job_id,
        job_shifts!inner(id, shift_date, start_time, end_time, break_minutes, capacity),
        jobs!inner(id, title, location_city, location_suburb, industry, shift_allocation_mode, contractor_profiles!inner(company_name))
      `)
      .eq("employee_user_id", user.id)
      .order("assigned_at", { ascending: false });

    if (assignmentsData) {
      const mapped = assignmentsData.map((a: any) => ({
        id: a.id,
        status: a.status,
        assigned_at: a.assigned_at,
        shift_id: a.shift_id,
        job_id: a.job_id,
        shift: a.job_shifts,
        job: a.jobs,
      }));
      setAssignments(mapped);
    }

    // Fetch pool memberships to show available shifts
    const { data: poolData } = await supabase
      .from("contractor_talent_pool_members")
      .select("source_job_id, contractor_id, status")
      .eq("employee_id", user.id)
      .eq("status", "active");

    if (poolData && poolData.length > 0) {
      const jobIds = poolData
        .map((p) => p.source_job_id)
        .filter(Boolean) as string[];

      if (jobIds.length > 0) {
        const { data: jobsData } = await supabase
          .from("jobs")
          .select("id, title, shift_allocation_mode, status, contractor_profiles!inner(company_name)")
          .in("id", jobIds)
          .eq("status", "published");

        if (jobsData) {
          setPoolJobs(
            jobsData.map((j: any) => ({
              jobId: j.id,
              jobTitle: j.title,
              allocationMode: j.shift_allocation_mode,
              companyName: j.contractor_profiles.company_name,
            }))
          );
        }
      }
    }

    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  const { upcoming, pending, past } = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const upcoming: ShiftAssignment[] = [];
    const pending: ShiftAssignment[] = [];
    const past: ShiftAssignment[] = [];

    for (const a of assignments) {
      const shiftDate = new Date(a.shift.shift_date);
      const isInPast = isPast(shiftDate) && !isToday(shiftDate);

      if (isInPast || ["completed", "no_show", "cancelled", "declined"].includes(a.status)) {
        past.push(a);
      } else if (a.status === "requested") {
        pending.push(a);
      } else {
        upcoming.push(a);
      }
    }

    // Sort upcoming by date ascending
    upcoming.sort((a, b) => new Date(a.shift.shift_date).getTime() - new Date(b.shift.shift_date).getTime());
    pending.sort((a, b) => new Date(a.shift.shift_date).getTime() - new Date(b.shift.shift_date).getTime());
    past.sort((a, b) => new Date(b.shift.shift_date).getTime() - new Date(a.shift.shift_date).getTime());

    return { upcoming, pending, past };
  }, [assignments]);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; className: string }> = {
      confirmed: { label: "Confirmed", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
      assigned: { label: "Assigned", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
      requested: { label: "Pending Approval", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
      completed: { label: "Completed", className: "bg-muted text-muted-foreground" },
      no_show: { label: "No Show", className: "bg-destructive/10 text-destructive" },
      cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
      declined: { label: "Declined", className: "bg-destructive/10 text-destructive" },
    };
    const c = config[status] || { label: status, className: "bg-muted text-muted-foreground" };
    return <Badge variant="secondary" className={c.className}>{c.label}</Badge>;
  };

  const renderAssignment = (a: ShiftAssignment) => (
    <div key={a.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 border border-border/50 rounded-lg bg-card">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="font-semibold text-sm">{a.job.title}</span>
          <span className="text-xs text-muted-foreground">— {(a.job as any).contractor_profiles?.company_name}</span>
        </div>
        <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <CalendarDays className="w-3 h-3" />
            {format(new Date(a.shift.shift_date), "EEE, MMM d, yyyy")}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {a.shift.start_time} – {a.shift.end_time}
          </span>
          {a.job.location_city && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {a.job.location_suburb ? `${a.job.location_suburb}, ` : ""}{a.job.location_city}
            </span>
          )}
        </div>
      </div>
      <div className="flex-shrink-0">
        {getStatusBadge(a.status)}
      </div>
    </div>
  );

  const emptyState = (icon: React.ReactNode, message: string) => (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      {icon}
      <p className="text-sm mt-2">{message}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="container-tight py-8">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Dashboard
            </Link>
          </Button>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold font-display flex items-center gap-3">
            <CalendarCheck className="w-8 h-8 text-primary" />
            My Shifts
          </h1>
          <p className="text-muted-foreground mt-1">
            View your shift assignments and browse available shifts from your talent pools.
          </p>
        </div>

        {/* Assigned Shifts */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-10">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="upcoming" className="gap-1">
              <CheckCircle2 className="w-4 h-4" />
              Upcoming ({upcoming.length})
            </TabsTrigger>
            <TabsTrigger value="pending" className="gap-1">
              <AlertCircle className="w-4 h-4" />
              Pending ({pending.length})
            </TabsTrigger>
            <TabsTrigger value="past" className="gap-1">
              <History className="w-4 h-4" />
              Past ({past.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="mt-4 space-y-3">
            {upcoming.length > 0
              ? upcoming.map(renderAssignment)
              : emptyState(<CheckCircle2 className="w-8 h-8 opacity-50" />, "No upcoming shifts confirmed yet.")}
          </TabsContent>

          <TabsContent value="pending" className="mt-4 space-y-3">
            {pending.length > 0
              ? pending.map(renderAssignment)
              : emptyState(<AlertCircle className="w-8 h-8 opacity-50" />, "No pending shift requests.")}
          </TabsContent>

          <TabsContent value="past" className="mt-4 space-y-3">
            {past.length > 0
              ? past.map(renderAssignment)
              : emptyState(<History className="w-8 h-8 opacity-50" />, "No past shifts yet.")}
          </TabsContent>
        </Tabs>

        {/* Available Shifts from Pools */}
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold font-display flex items-center gap-2 mb-1">
              <Users className="w-5 h-5 text-primary" />
              Available Shifts
            </h2>
            <p className="text-sm text-muted-foreground">
              Browse and claim or request shifts from jobs you've been approved for.
            </p>
          </div>

          {poolJobs.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12 text-muted-foreground">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">You're not in any talent pools yet.</p>
                <p className="text-xs mt-1">Apply to shift-based jobs and get approved to see available shifts here.</p>
              </CardContent>
            </Card>
          ) : (
            poolJobs.map((pj) => (
              <div key={pj.jobId}>
                <h3 className="text-sm font-semibold mb-2 text-muted-foreground">
                  {pj.companyName} — {pj.jobTitle}
                </h3>
                <EmployeeShiftBrowser
                  jobId={pj.jobId}
                  jobTitle={pj.jobTitle}
                  allocationMode={pj.allocationMode}
                />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
