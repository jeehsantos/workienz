import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  CalendarIcon,
  Plus,
  Trash2,
  UserPlus,
  UserMinus,
  Loader2,
  Clock,
  Users,
  Check,
  X,
} from "lucide-react";

type ShiftAssignment = {
  id: string;
  employee_user_id: string;
  status: string;
  employee_name?: string;
};

type Shift = {
  id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  break_paid: boolean;
  capacity: number;
  assignments: ShiftAssignment[];
};

type PoolMember = {
  id: string;
  employee_id: string;
  category: string;
  employee_name?: string;
};

interface ShiftManagementProps {
  jobId: string;
  industry: string | null;
  allocationMode?: string;
}

export function ShiftManagement({ jobId, industry, allocationMode = "first_come" }: ShiftManagementProps) {
  const { toast } = useToast();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [poolMembers, setPoolMembers] = useState<PoolMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // New shift form
  const [newShiftDate, setNewShiftDate] = useState<Date | undefined>();
  const [newStartTime, setNewStartTime] = useState("08:00");
  const [newEndTime, setNewEndTime] = useState("16:00");
  const [newBreakMinutes, setNewBreakMinutes] = useState("30");
  const [newCapacity, setNewCapacity] = useState("1");
  const [showForm, setShowForm] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);

    const { data: shiftsData } = await supabase
      .from("job_shifts")
      .select("*")
      .eq("job_id", jobId)
      .order("shift_date", { ascending: true });

    const shiftsList = (shiftsData || []) as Array<{
      id: string;
      shift_date: string;
      start_time: string;
      end_time: string;
      break_minutes: number;
      break_paid: boolean;
      capacity?: number;
    }>;

    if (shiftsList.length > 0) {
      const shiftIds = shiftsList.map((s) => s.id);
      const { data: assignmentsData } = await supabase
        .from("shift_assignments")
        .select("*")
        .in("shift_id", shiftIds);

      const employeeIds = [...new Set((assignmentsData || []).map((a) => a.employee_user_id))];
      let nameMap: Record<string, string> = {};
      if (employeeIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, first_name, last_name")
          .in("user_id", employeeIds);
        if (profiles) {
          for (const p of profiles) {
            nameMap[p.user_id] = p.full_name || `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Unknown";
          }
        }
      }

      const shiftsWithAssignments: Shift[] = shiftsList.map((s) => ({
        ...s,
        capacity: (s as any).capacity ?? 1,
        assignments: (assignmentsData || [])
          .filter((a) => a.shift_id === s.id)
          .map((a) => ({
            ...a,
            employee_name: nameMap[a.employee_user_id] || "Unknown",
          })),
      }));
      setShifts(shiftsWithAssignments);
    } else {
      setShifts([]);
    }

    // Fetch talent pool members
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const { data: members } = await supabase
        .from("contractor_talent_pool_members")
        .select("id, employee_id, category")
        .eq("contractor_id", userData.user.id)
        .eq("status", "active");

      if (members && members.length > 0) {
        const empIds = members.map((m) => m.employee_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, first_name, last_name")
          .in("user_id", empIds);

        const nm: Record<string, string> = {};
        if (profiles) {
          for (const p of profiles) {
            nm[p.user_id] = p.full_name || `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Unknown";
          }
        }
        setPoolMembers(members.map((m) => ({ ...m, employee_name: nm[m.employee_id] || "Unknown" })));
      } else {
        setPoolMembers([]);
      }
    }

    setIsLoading(false);
  }, [jobId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateShift = async () => {
    if (!newShiftDate || !newStartTime || !newEndTime) {
      toast({ title: "Missing fields", description: "Please fill in date and times.", variant: "destructive" });
      return;
    }

    setIsCreating(true);
    const { error } = await supabase.functions.invoke("manage-shifts", {
      body: {
        action: "create_shift",
        job_id: jobId,
        shift_date: format(newShiftDate, "yyyy-MM-dd"),
        start_time: newStartTime,
        end_time: newEndTime,
        break_minutes: parseInt(newBreakMinutes) || 0,
        break_paid: false,
        capacity: parseInt(newCapacity) || 1,
      },
    });

    setIsCreating(false);
    if (error) {
      toast({ title: "Error", description: "Failed to create shift.", variant: "destructive" });
      return;
    }

    toast({ title: "Shift created" });
    setShowForm(false);
    setNewShiftDate(undefined);
    setNewCapacity("1");
    fetchData();
  };

  const handleDeleteShift = async (shiftId: string) => {
    const { error } = await supabase.functions.invoke("manage-shifts", {
      body: { action: "delete_shift", job_id: jobId, shift_id: shiftId },
    });
    if (error) {
      toast({ title: "Error", description: "Failed to delete shift.", variant: "destructive" });
      return;
    }
    toast({ title: "Shift deleted" });
    fetchData();
  };

  const handleAssignWorker = async (shiftId: string, employeeUserId: string) => {
    setActionLoadingId(shiftId);
    const { data, error } = await supabase.functions.invoke("manage-shifts", {
      body: { action: "assign_worker", job_id: jobId, shift_id: shiftId, employee_user_id: employeeUserId },
    });
    setActionLoadingId(null);
    if (error || data?.error) {
      toast({ title: "Error", description: data?.error || "Failed to assign worker.", variant: "destructive" });
      return;
    }
    toast({ title: "Worker assigned" });
    fetchData();
  };

  const handleUnassignWorker = async (shiftId: string, employeeUserId: string) => {
    const { error } = await supabase.functions.invoke("manage-shifts", {
      body: { action: "unassign_worker", job_id: jobId, shift_id: shiftId, employee_user_id: employeeUserId },
    });
    if (error) {
      toast({ title: "Error", description: "Failed to unassign worker.", variant: "destructive" });
      return;
    }
    toast({ title: "Worker unassigned" });
    fetchData();
  };

  const handleAcceptRequest = async (assignmentId: string) => {
    setActionLoadingId(assignmentId);
    const { data, error } = await supabase.functions.invoke("manage-shifts", {
      body: { action: "accept_request", job_id: jobId, assignment_id: assignmentId },
    });
    setActionLoadingId(null);
    if (error || data?.error) {
      toast({ title: "Error", description: data?.error || "Failed to accept request.", variant: "destructive" });
      return;
    }
    toast({ title: "Request accepted" });
    fetchData();
  };

  const handleRejectRequest = async (assignmentId: string) => {
    setActionLoadingId(assignmentId);
    const { data, error } = await supabase.functions.invoke("manage-shifts", {
      body: { action: "reject_request", job_id: jobId, assignment_id: assignmentId },
    });
    setActionLoadingId(null);
    if (error || data?.error) {
      toast({ title: "Error", description: data?.error || "Failed to reject request.", variant: "destructive" });
      return;
    }
    toast({ title: "Request declined" });
    fetchData();
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

  const getAvailableWorkers = (shift: Shift) => {
    const assignedIds = shift.assignments.map((a) => a.employee_user_id);
    return poolMembers.filter((m) => !assignedIds.includes(m.employee_id));
  };

  const getFilledCount = (shift: Shift) =>
    shift.assignments.filter((a) => ["confirmed", "assigned"].includes(a.status)).length;

  const getRequestedCount = (shift: Shift) =>
    shift.assignments.filter((a) => a.status === "requested").length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "requested":
        return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs">Requested</Badge>;
      case "assigned":
        return <Badge variant="outline" className="text-xs">Assigned</Badge>;
      case "confirmed":
        return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs">Confirmed</Badge>;
      case "declined":
        return <Badge variant="destructive" className="text-xs">Declined</Badge>;
      case "completed":
        return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs">Completed</Badge>;
      case "no_show":
        return <Badge variant="destructive" className="text-xs">No Show</Badge>;
      case "cancelled":
        return <Badge variant="secondary" className="text-xs">Cancelled</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">{status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Shift Management
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Mode: <span className="font-medium capitalize">{allocationMode.replace("_", " ")}</span>
            {allocationMode === "contractor_select"
              ? " — Workers request, you approve"
              : " — Workers claim instantly"}
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4 mr-1" />
          Add Shift
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Create Shift Form */}
        {showForm && (
          <div className="p-4 border border-border rounded-lg bg-muted/30 space-y-3">
            <h4 className="font-medium text-sm">New Shift</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("w-full justify-start text-left font-normal", !newShiftDate && "text-muted-foreground")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {newShiftDate ? format(newShiftDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={newShiftDate}
                      onSelect={setNewShiftDate}
                      disabled={(date) => date < new Date()}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label className="text-xs">Workers Required</Label>
                <Input type="number" value={newCapacity} onChange={(e) => setNewCapacity(e.target.value)} min="1" placeholder="Number of people needed" />
              </div>
              <div>
                <Label className="text-xs">Start Time</Label>
                <Input type="time" value={newStartTime} onChange={(e) => setNewStartTime(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">End Time</Label>
                <Input type="time" value={newEndTime} onChange={(e) => setNewEndTime(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Break (minutes)</Label>
                <Input type="number" value={newBreakMinutes} onChange={(e) => setNewBreakMinutes(e.target.value)} min="0" />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button size="sm" onClick={handleCreateShift} disabled={isCreating}>
                {isCreating && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                Create Shift
              </Button>
            </div>
          </div>
        )}

        {/* Shifts List */}
        {shifts.length === 0 && !showForm && (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No shifts created yet.</p>
            <p className="text-xs">Add shifts for your talent pool workers to {allocationMode === "contractor_select" ? "request" : "claim"}.</p>
          </div>
        )}

        {shifts.map((shift) => {
          const availableWorkers = getAvailableWorkers(shift);
          const filled = getFilledCount(shift);
          const requested = getRequestedCount(shift);
          const requestedAssignments = shift.assignments.filter((a) => a.status === "requested");
          const activeAssignments = shift.assignments.filter((a) => !["declined", "cancelled"].includes(a.status));

          return (
            <div key={shift.id} className="border border-border rounded-lg overflow-hidden">
              {/* Shift Header */}
              <div className="flex items-center justify-between p-3 bg-muted/30">
                <div className="flex items-center gap-3 flex-wrap">
                  <div>
                    <span className="font-medium text-sm">
                      {format(new Date(shift.shift_date), "EEE, MMM d, yyyy")}
                    </span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {shift.start_time} – {shift.end_time}
                    </span>
                  </div>
                  {shift.break_minutes > 0 && (
                    <Badge variant="secondary" className="text-xs">{shift.break_minutes}min break</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    <Users className="w-3 h-3 mr-1" />
                    {filled}/{shift.capacity}
                  </Badge>
                  {requested > 0 && (
                    <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs">
                      {requested} pending
                    </Badge>
                  )}
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteShift(shift.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Assignments */}
              <div className="p-3 space-y-2">
                {activeAssignments.length > 0 && (
                  <div className="space-y-1.5">
                    {activeAssignments.map((a) => (
                      <div key={a.id} className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/20">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{a.employee_name}</span>
                          {getStatusBadge(a.status)}
                        </div>
                        <div className="flex items-center gap-1">
                          {a.status === "requested" && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-green-600"
                                onClick={() => handleAcceptRequest(a.id)}
                                disabled={actionLoadingId === a.id}
                              >
                                {actionLoadingId === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive"
                                onClick={() => handleRejectRequest(a.id)}
                                disabled={actionLoadingId === a.id}
                              >
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                          {["assigned", "confirmed"].includes(a.status) && (
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleUnassignWorker(shift.id, a.employee_user_id)}>
                              <UserMinus className="w-3.5 h-3.5 text-muted-foreground" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Direct assign dropdown (contractor can still push-assign) */}
                {availableWorkers.length > 0 && filled < shift.capacity && (
                  <div className="pt-1">
                    <Select
                      onValueChange={(val) => handleAssignWorker(shift.id, val)}
                      disabled={actionLoadingId === shift.id}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <div className="flex items-center gap-1">
                          <UserPlus className="w-3 h-3" />
                          <SelectValue placeholder="Assign worker..." />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {availableWorkers.map((w) => (
                          <SelectItem key={w.employee_id} value={w.employee_id}>
                            {w.employee_name} ({w.category})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {availableWorkers.length === 0 && activeAssignments.length === 0 && (
                  <p className="text-xs text-muted-foreground py-1">No workers in your talent pool to assign.</p>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
