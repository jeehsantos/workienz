import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    // Auth client to get user
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

    // Verify contractor owns the job
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

    // ACTION: create_shift
    if (action === "create_shift") {
      const { job_id, shift_date, start_time, end_time, break_minutes, break_paid } = body;
      if (!job_id || !shift_date || !start_time || !end_time) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const ownership = await verifyJobOwnership(job_id);
      if (!ownership.ok) {
        return new Response(JSON.stringify({ error: "Unauthorized or not a shift job" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: shift, error } = await serviceClient
        .from("job_shifts")
        .insert({
          job_id,
          shift_date,
          start_time,
          end_time,
          break_minutes: break_minutes || 0,
          break_paid: break_paid || false,
        })
        .select()
        .single();

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ shift }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: delete_shift
    if (action === "delete_shift") {
      const { job_id, shift_id } = body;
      if (!job_id || !shift_id) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const ownership = await verifyJobOwnership(job_id);
      if (!ownership.ok) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Delete shift (cascades to assignments)
      const { error } = await serviceClient
        .from("job_shifts")
        .delete()
        .eq("id", shift_id)
        .eq("job_id", job_id);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: assign_worker
    if (action === "assign_worker") {
      const { job_id, shift_id, employee_user_id } = body;
      if (!job_id || !shift_id || !employee_user_id) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const ownership = await verifyJobOwnership(job_id);
      if (!ownership.ok) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify worker is in the talent pool for this contractor
      const { data: poolMember } = await serviceClient
        .from("contractor_talent_pool_members")
        .select("id")
        .eq("contractor_id", user!.id)
        .eq("employee_id", employee_user_id)
        .eq("status", "active")
        .maybeSingle();

      if (!poolMember) {
        return new Response(
          JSON.stringify({ error: "Worker is not in your talent pool" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: assignment, error } = await serviceClient
        .from("shift_assignments")
        .upsert(
          {
            shift_id,
            job_id,
            employee_user_id,
            assigned_by: user!.id,
            status: "assigned",
          },
          { onConflict: "shift_id,employee_user_id" }
        )
        .select()
        .single();

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ assignment }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: unassign_worker
    if (action === "unassign_worker") {
      const { job_id, shift_id, employee_user_id } = body;
      if (!job_id || !shift_id || !employee_user_id) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const ownership = await verifyJobOwnership(job_id);
      if (!ownership.ok) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await serviceClient
        .from("shift_assignments")
        .delete()
        .eq("shift_id", shift_id)
        .eq("employee_user_id", employee_user_id)
        .eq("job_id", job_id);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("manage-shifts error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
