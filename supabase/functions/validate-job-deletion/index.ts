import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[VALIDATE-JOB-DELETION] ${step}${detailsStr}`);
};

interface ValidationResult {
  can_delete: boolean;
  error_code: string | null;
  message: string | null;
  active_applications_count: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");

    logStep("User authenticated", { userId: user.id });

    // Get job_id from request body
    const { job_id } = await req.json();
    if (!job_id) throw new Error("job_id is required");

    logStep("Validating job deletion", { jobId: job_id });

    // Verify user owns this job
    const { data: job, error: jobError } = await supabaseClient
      .from("jobs")
      .select(`
        id,
        title,
        contractor_id,
        contractor_profiles!inner(user_id)
      `)
      .eq("id", job_id)
      .single();

    if (jobError || !job) {
      logStep("Job not found", { error: jobError?.message });
      const result: ValidationResult = {
        can_delete: false,
        error_code: "ERR_JOB_NOT_FOUND",
        message: "Job posting not found.",
        active_applications_count: 0,
      };
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Verify ownership - contractor_profiles is an object from inner join
    const contractorProfile = job.contractor_profiles as unknown as { user_id: string };
    const jobOwnerUserId = contractorProfile.user_id;
    if (jobOwnerUserId !== user.id) {
      logStep("User does not own this job", { jobOwner: jobOwnerUserId, requestUser: user.id });
      const result: ValidationResult = {
        can_delete: false,
        error_code: "ERR_NOT_OWNER",
        message: "You do not have permission to delete this job.",
        active_applications_count: 0,
      };
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Check for active applications (pending or shortlisted)
    const { count, error: countError } = await supabaseClient
      .from("job_applications")
      .select("id", { count: "exact", head: true })
      .eq("job_id", job_id)
      .in("status", ["pending", "shortlisted"]);

    if (countError) {
      logStep("Error checking applications", { error: countError.message });
      throw new Error(`Failed to check applications: ${countError.message}`);
    }

    const activeCount = count || 0;
    logStep("Active applications check", { jobId: job_id, activeCount });

    if (activeCount > 0) {
      const result: ValidationResult = {
        can_delete: false,
        error_code: "ERR_ACTIVE_APPLICATIONS",
        message: `This job has ${activeCount} active application${activeCount > 1 ? "s" : ""} in progress. Please review and conclude all applications (hire or reject) before deleting the job post.`,
        active_applications_count: activeCount,
      };
      logStep("Deletion blocked - active applications", result);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // All checks passed - deletion allowed
    const result: ValidationResult = {
      can_delete: true,
      error_code: null,
      message: null,
      active_applications_count: 0,
    };

    logStep("Deletion validated - allowed", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
