import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  Loader2,
  Clock,
  Users,
  CalendarCheck,
  XCircle,
  AlertTriangle,
} from "lucide-react";

type ShiftWithStatus = {
  id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  capacity: number;
  filled: number;
  myAssignment: {
    id: string;
    status: string;
  } | null;
};

type ConfirmedShift = {
  shift_date: string;
  start_time: string;
  end_time: string;
};

interface EmployeeShiftBrowserProps {
  jobId: string;
  jobTitle: string;
  allocationMode: string;
}

/**
 * Check if two time ranges on the same date overlap.
 * Times are "HH:MM" or "HH:MM:SS" strings.
 */
function timesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const sA = toMin(startA);
  const eA = toMin(endA);
  const sB = toMin(startB);
  const eB = toMin(endB);
  return sA < eB && sB < eA;
}

export function EmployeeShiftBrowser({ jobId, jobTitle, allocationMode }: EmployeeShiftBrowserProps) {
  const { toast } = useToast();
  const [shifts, setShifts] = useState<ShiftWithStatus[]>([]);
  const [confirmedShifts, setConfirmedShifts] = useState<ConfirmedShift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchShifts = useCallback(async () => {
    setIsLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setIsLoading(false); return; }

    const userId = userData.user.id;

    // Fetch shifts for this job + all user's confirmed assignments in parallel
    const [shiftsRes, confirmedRes] = await Promise.all([
      supabase
        .from("job_shifts")
        .select("*")
        .eq("job_id", jobId)
        .order("shift_date", { ascending: true }),
      supabase
        .from("shift_assignments")
        .select("shift_id, status, job_shifts!inner(shift_date, start_time, end_time)")
        .eq("employee_user_id", userId)
        .in("status", ["confirmed", "assigned"]),
    ]);

    // Build confirmed shifts list (across ALL jobs)
    const allConfirmed: ConfirmedShift[] = (confirmedRes.data || []).map((a: any) => ({
      shift_date: a.job_shifts.shift_date,
      start_time: a.job_shifts.start_time,
      end_time: a.job_shifts.end_time,
    }));
    setConfirmedShifts(allConfirmed);

    const shiftsList = (shiftsRes.data || []) as Array<{
      id: string; shift_date: string; start_time: string; end_time: string;
      break_minutes: number; capacity?: number;
    }>;

    if (shiftsList.length === 0) {
      setShifts([]);
      setIsLoading(false);
      return;
    }

    const shiftIds = shiftsList.map((s) => s.id);

    // Fetch all assignments for counts + my status
    const { data: assignments } = await supabase
      .from("shift_assignments")
      .select("id, shift_id, employee_user_id, status")
      .in("shift_id", shiftIds);

    const allAssignments = assignments || [];

    const enriched: ShiftWithStatus[] = shiftsList.map((s) => {
      const shiftAssignments = allAssignments.filter((a) => a.shift_id === s.id);
      const filled = shiftAssignments.filter((a) => ["confirmed", "assigned"].includes(a.status)).length;
      const myAssignment = shiftAssignments.find((a) => a.employee_user_id === userId) || null;

      return {
        id: s.id,
        shift_date: s.shift_date,
        start_time: s.start_time,
        end_time: s.end_time,
        break_minutes: s.break_minutes,
        capacity: (s as any).capacity ?? 1,
        filled,
        myAssignment: myAssignment ? { id: myAssignment.id, status: myAssignment.status } : null,
      };
    });

    setShifts(enriched);
    setIsLoading(false);
  }, [jobId]);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  /** Check if a shift clashes with any of the user's confirmed shifts */
  const getClashingShift = useCallback(
    (shift: ShiftWithStatus): ConfirmedShift | null => {
      // Don't flag clashes for shifts the user is already on
      if (shift.myAssignment) return null;

      for (const cs of confirmedShifts) {
        if (cs.shift_date === shift.shift_date && timesOverlap(shift.start_time, shift.end_time, cs.start_time, cs.end_time)) {
          return cs;
        }
      }
      return null;
    },
    [confirmedShifts]
  );

  const handleRequestShift = async (shiftId: string) => {
    setActionLoadingId(shiftId);
    try {
      const { data, error } = await supabase.functions.invoke("manage-shifts", {
        body: { action: "request_shift", job_id: jobId, shift_id: shiftId },
      });

      setActionLoadingId(null);

      if (error) {
        let errorMessage = "Something went wrong.";
        try {
          const errorBody = await (error as any)?.context?.json?.();
          if (errorBody?.error) errorMessage = errorBody.error;
        } catch {
          if (error.message) errorMessage = error.message;
        }
        toast({
          title: "Unable to request shift",
          description: errorMessage,
          variant: "destructive",
        });
        fetchShifts();
        return;
      }

      if (data?.error) {
        toast({
          title: "Unable to request shift",
          description: data.error,
          variant: "destructive",
        });
        fetchShifts();
        return;
      }

      const isInstant = data?.code === "CLAIMED";
      toast({ title: isInstant ? "Shift claimed!" : "Shift requested", description: isInstant ? "You're confirmed for this shift." : "Waiting for contractor approval." });
      fetchShifts();
    } catch (err) {
      setActionLoadingId(null);
      toast({ title: "Error", description: "Failed to request shift. Please try again.", variant: "destructive" });
      fetchShifts();
    }
  };

  const handleCancelRequest = async (assignmentId: string) => {
    setActionLoadingId(assignmentId);
    const { data, error } = await supabase.functions.invoke("manage-shifts", {
      body: { action: "cancel_request", assignment_id: assignmentId },
    });
    setActionLoadingId(null);
    if (error || data?.error) {
      toast({ title: "Error", description: data?.error || "Failed to cancel.", variant: "destructive" });
      return;
    }
    toast({ title: "Request cancelled" });
    fetchShifts();
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  // Filter to future shifts only
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const futureShifts = shifts.filter((s) => {
    const isFuture = new Date(s.shift_date) >= now;
    const isFull = s.filled >= s.capacity;
    const hasMyAssignment = !!s.myAssignment;
    return isFuture && (!isFull || hasMyAssignment);
  });

  if (futureShifts.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8 text-muted-foreground">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No upcoming shifts available for this job.</p>
        </CardContent>
      </Card>
    );
  }

  const modeLabel = allocationMode === "contractor_select" ? "Request" : "Claim";

  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarCheck className="w-5 h-5" />
            Available Shifts
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {allocationMode === "contractor_select"
              ? "Request shifts you're interested in — the contractor will approve or decline."
              : "Claim shifts instantly — first come, first served."}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {futureShifts.map((shift) => {
            const isFull = shift.filled >= shift.capacity;
            const hasMyAssignment = !!shift.myAssignment;
            const myStatus = shift.myAssignment?.status;
            const clash = getClashingShift(shift);
            const hasClash = !!clash;
            const canRequest = !hasMyAssignment && !isFull && !hasClash;
            const canCancel = hasMyAssignment && ["requested", "confirmed"].includes(myStatus || "");

            return (
              <div key={shift.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 border border-border rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">
                      {format(new Date(shift.shift_date), "EEE, MMM d")}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {shift.start_time} – {shift.end_time}
                    </span>
                    {shift.break_minutes > 0 && (
                      <Badge variant="secondary" className="text-xs">{shift.break_minutes}min break</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      <Users className="w-3 h-3 mr-1" />
                      {shift.filled}/{shift.capacity} filled
                    </Badge>
                    {myStatus && (
                      <Badge
                        className={
                          myStatus === "confirmed"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs"
                            : myStatus === "requested"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs"
                            : myStatus === "declined"
                            ? "bg-destructive/10 text-destructive text-xs"
                            : "text-xs"
                        }
                        variant="secondary"
                      >
                        {myStatus === "confirmed" ? "You're confirmed" :
                         myStatus === "requested" ? "Pending approval" :
                         myStatus === "declined" ? "Declined" :
                         myStatus === "cancelled" ? "Cancelled" :
                         myStatus}
                      </Badge>
                    )}
                    {isFull && !hasMyAssignment && (
                      <Badge variant="secondary" className="text-xs">Full</Badge>
                    )}
                    {hasClash && !hasMyAssignment && (
                      <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Clashes with another shift
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 flex-shrink-0">
                  {!hasMyAssignment && !isFull && hasClash && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span tabIndex={0}>
                          <Button size="sm" disabled>
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            {modeLabel}
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[250px] text-center">
                        <p className="text-xs">
                          This shift clashes with your confirmed shift on{" "}
                          {format(new Date(clash!.shift_date), "MMM d")} ({clash!.start_time} – {clash!.end_time}).
                          Cancel the other shift first if you want to claim this one.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {canRequest && (
                    <Button
                      size="sm"
                      onClick={() => handleRequestShift(shift.id)}
                      disabled={actionLoadingId === shift.id}
                    >
                      {actionLoadingId === shift.id ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <CalendarCheck className="w-3 h-3 mr-1" />
                      )}
                      {modeLabel}
                    </Button>
                  )}
                  {canCancel && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCancelRequest(shift.myAssignment!.id)}
                      disabled={actionLoadingId === shift.myAssignment!.id}
                    >
                      {actionLoadingId === shift.myAssignment!.id ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <XCircle className="w-3 h-3 mr-1" />
                      )}
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
