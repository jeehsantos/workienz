import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[MANAGE-SHIFTS] ${step}${d}`);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(supabaseUrl, serviceKey);
    const body = await req.json();
    const { action } = body;

    logStep("Action received", { action, userId: user.id });

    // Helper: verify contractor owns a shift-type job
    async function verifyJobOwnership(jobId: string): Promise<{ ok: boolean; contractorId?: string }> {
      const { data: cp } = await serviceClient
        .from("contractor_profiles")
        .select("id")
        .eq("user_id", user!.id)
        .single();
      if (!cp) return { ok: false };

      const { data: job } = await serviceClient
        .from("jobs")
        .select("id, contractor_id, job_type")
        .eq("id", jobId)
        .eq("contractor_id", cp.id)
        .single();
      if (!job) return { ok: false };
      if (job.job_type !== "shift") return { ok: false };

      return { ok: true, contractorId: cp.id };
    }

    const json = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    // ──────────────────────────────────
    // ACTION: create_shift
    // ──────────────────────────────────
    if (action === "create_shift") {
      const { job_id, shift_date, start_time, end_time, break_minutes, break_paid, capacity } = body;
      if (!job_id || !shift_date || !start_time || !end_time) {
        return json({ error: "Missing required fields" }, 400);
      }

      const ownership = await verifyJobOwnership(job_id);
      if (!ownership.ok) return json({ error: "Unauthorized or not a shift job" }, 403);

      const { data: shift, error } = await serviceClient
        .from("job_shifts")
        .insert({
          job_id,
          shift_date,
          start_time,
          end_time,
          break_minutes: break_minutes || 0,
          break_paid: break_paid || false,
          capacity: capacity || 1,
        })
        .select()
        .single();

      if (error) return json({ error: error.message }, 500);
      return json({ shift });
    }

    // ──────────────────────────────────
    // ACTION: delete_shift
    // ──────────────────────────────────
    if (action === "delete_shift") {
      const { job_id, shift_id } = body;
      if (!job_id || !shift_id) return json({ error: "Missing required fields" }, 400);

      const ownership = await verifyJobOwnership(job_id);
      if (!ownership.ok) return json({ error: "Unauthorized" }, 403);

      const { error } = await serviceClient
        .from("job_shifts")
        .delete()
        .eq("id", shift_id)
        .eq("job_id", job_id);

      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    // ──────────────────────────────────
    // ACTION: assign_worker (contractor pushes worker onto shift)
    // ──────────────────────────────────
    if (action === "assign_worker") {
      const { job_id, shift_id, employee_user_id } = body;
      if (!job_id || !shift_id || !employee_user_id) return json({ error: "Missing required fields" }, 400);

      const ownership = await verifyJobOwnership(job_id);
      if (!ownership.ok) return json({ error: "Unauthorized" }, 403);

      const { data: poolMember } = await serviceClient
        .from("contractor_talent_pool_members")
        .select("id")
        .eq("contractor_id", user!.id)
        .eq("employee_id", employee_user_id)
        .eq("status", "active")
        .maybeSingle();

      if (!poolMember) return json({ error: "Worker is not in your talent pool" }, 400);

      const { data: assignment, error } = await serviceClient
        .from("shift_assignments")
        .upsert(
          { shift_id, job_id, employee_user_id, assigned_by: user!.id, status: "assigned" },
          { onConflict: "shift_id,employee_user_id" }
        )
        .select()
        .single();

      if (error) return json({ error: error.message }, 500);
      return json({ assignment });
    }

    // ──────────────────────────────────
    // ACTION: unassign_worker
    // ──────────────────────────────────
    if (action === "unassign_worker") {
      const { job_id, shift_id, employee_user_id } = body;
      if (!job_id || !shift_id || !employee_user_id) return json({ error: "Missing required fields" }, 400);

      const ownership = await verifyJobOwnership(job_id);
      if (!ownership.ok) return json({ error: "Unauthorized" }, 403);

      const { error } = await serviceClient
        .from("shift_assignments")
        .delete()
        .eq("shift_id", shift_id)
        .eq("employee_user_id", employee_user_id)
        .eq("job_id", job_id);

      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    // ──────────────────────────────────
    // ACTION: request_shift (employee requests via RPC)
    // ──────────────────────────────────
    if (action === "request_shift") {
      const { job_id, shift_id } = body;
      if (!job_id || !shift_id) return json({ error: "Missing required fields" }, 400);

      // Determine allocation mode
      const { data: job } = await serviceClient
        .from("jobs")
        .select("shift_allocation_mode")
        .eq("id", job_id)
        .single();

      if (!job) return json({ error: "Job not found" }, 404);

      let result;
      if (job.shift_allocation_mode === "first_come") {
        const { data, error } = await serviceClient.rpc("claim_shift_atomic", {
          p_shift_id: shift_id,
          p_job_id: job_id,
          p_employee_user_id: user!.id,
        });
        if (error) return json({ error: error.message }, 500);
        result = data;
      } else {
        const { data, error } = await serviceClient.rpc("request_shift_atomic", {
          p_shift_id: shift_id,
          p_job_id: job_id,
          p_employee_user_id: user!.id,
        });
        if (error) return json({ error: error.message }, 500);
        result = data;
      }

      logStep("Shift request result", result);

      if (!result?.ok) {
        const messages: Record<string, string> = {
          SHIFT_NOT_FOUND: "This shift no longer exists.",
          JOB_NOT_OPEN: "This job is no longer accepting requests.",
          NOT_SHIFT_JOB: "This is not a shift-based job.",
          WRONG_MODE: "This shift uses a different allocation mode.",
          NOT_IN_POOL: "You must be in the contractor's talent pool to request shifts.",
          ALREADY_CLAIMED: "You've already claimed this shift.",
          ALREADY_REQUESTED: "You've already requested this shift.",
          SHIFT_FULL: "This shift is full.",
        };
        return json({ error: messages[result?.code] || "Request failed", code: result?.code }, 400);
      }

      return json({ ok: true, code: result.code, assignment_id: result.assignment_id });
    }

    // ──────────────────────────────────
    // ACTION: accept_request (contractor approves a requested shift)
    // ──────────────────────────────────
    if (action === "accept_request") {
      const { job_id, assignment_id } = body;
      if (!job_id || !assignment_id) return json({ error: "Missing required fields" }, 400);

      const ownership = await verifyJobOwnership(job_id);
      if (!ownership.ok) return json({ error: "Unauthorized" }, 403);

      // Get the assignment and verify it's 'requested'
      const { data: assignment } = await serviceClient
        .from("shift_assignments")
        .select("id, shift_id, status")
        .eq("id", assignment_id)
        .eq("job_id", job_id)
        .single();

      if (!assignment) return json({ error: "Assignment not found" }, 404);
      if (assignment.status !== "requested") {
        return json({ error: "Assignment is not in requested state" }, 400);
      }

      // Check capacity before accepting
      const { data: shift } = await serviceClient
        .from("job_shifts")
        .select("capacity")
        .eq("id", assignment.shift_id)
        .single();

      const { count } = await serviceClient
        .from("shift_assignments")
        .select("id", { count: "exact", head: true })
        .eq("shift_id", assignment.shift_id)
        .in("status", ["confirmed", "assigned"]);

      if (shift && count !== null && count >= shift.capacity) {
        return json({ error: "Shift is already at capacity", code: "SHIFT_FULL" }, 400);
      }

      const { error } = await serviceClient
        .from("shift_assignments")
        .update({ status: "confirmed", assigned_by: user!.id })
        .eq("id", assignment_id);

      if (error) return json({ error: error.message }, 500);
      logStep("Request accepted", { assignment_id });
      return json({ ok: true });
    }

    // ──────────────────────────────────
    // ACTION: reject_request
    // ──────────────────────────────────
    if (action === "reject_request") {
      const { job_id, assignment_id } = body;
      if (!job_id || !assignment_id) return json({ error: "Missing required fields" }, 400);

      const ownership = await verifyJobOwnership(job_id);
      if (!ownership.ok) return json({ error: "Unauthorized" }, 403);

      const { data: assignment } = await serviceClient
        .from("shift_assignments")
        .select("id, status")
        .eq("id", assignment_id)
        .eq("job_id", job_id)
        .single();

      if (!assignment) return json({ error: "Assignment not found" }, 404);
      if (assignment.status !== "requested") {
        return json({ error: "Assignment is not in requested state" }, 400);
      }

      const { error } = await serviceClient
        .from("shift_assignments")
        .update({ status: "declined" })
        .eq("id", assignment_id);

      if (error) return json({ error: error.message }, 500);
      logStep("Request rejected", { assignment_id });
      return json({ ok: true });
    }

    // ──────────────────────────────────
    // ACTION: cancel_request (employee cancels own request)
    // ──────────────────────────────────
    if (action === "cancel_request") {
      const { assignment_id } = body;
      if (!assignment_id) return json({ error: "Missing assignment_id" }, 400);

      const { data: assignment } = await serviceClient
        .from("shift_assignments")
        .select("id, status, employee_user_id")
        .eq("id", assignment_id)
        .single();

      if (!assignment) return json({ error: "Assignment not found" }, 404);
      if (assignment.employee_user_id !== user!.id) return json({ error: "Unauthorized" }, 403);
      if (!["requested", "confirmed"].includes(assignment.status)) {
        return json({ error: "Cannot cancel assignment in current state" }, 400);
      }

      const { error } = await serviceClient
        .from("shift_assignments")
        .update({ status: "cancelled" })
        .eq("id", assignment_id);

      if (error) return json({ error: error.message }, 500);
      logStep("Request cancelled by employee", { assignment_id });
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("manage-shifts error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
