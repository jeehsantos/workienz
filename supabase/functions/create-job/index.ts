import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-JOB] ${step}${detailsStr}`);
};

interface JobData {
  title: string;
  description: string;
  requirements?: string;
  location_city?: string;
  location_suburb?: string;
  location_country?: string;
  hourly_rate_min?: number;
  hourly_rate_max?: number;
  job_type?: string;
  duration?: string;
  positions_available?: number;
  skills_required?: string[];
  industry?: string;
  schedule_type?: string;
  experience_required?: boolean;
  requires_heavy_lifting?: boolean;
  requires_standing?: boolean;
  requires_car?: boolean;
  provides_training?: boolean;
  provides_accommodation?: boolean;
  is_sse?: boolean;
  starts_at?: string;
  ends_at?: string;
  weekly_hours?: number;
  wizard_step?: number;
  form_data?: Record<string, unknown>;
}

interface Shift {
  shift_date: string;
  start_time: string;
  end_time: string;
  break_minutes?: number;
  break_paid?: boolean;
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

    const body = await req.json();
    const jobData: JobData = body.jobData;
    const status: "draft" | "published" = body.status ?? "draft";
    const shifts: Shift[] = body.shifts ?? [];
    const jobId: string | undefined = body.jobId; // For updates

    if (!jobData || !jobData.title || !jobData.description) {
      return new Response(
        JSON.stringify({ error: "ERR_INVALID_DATA", message: "Job title and description are required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Verify user is a contractor and get contractor profile
    const { data: contractorProfile, error: cpError } = await supabaseClient
      .from("contractor_profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (cpError || !contractorProfile) {
      return new Response(
        JSON.stringify({ error: "ERR_NO_CONTRACTOR_PROFILE", message: "You must complete your contractor profile first" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    logStep("Contractor profile found", { contractorId: contractorProfile.id });

    // If publishing, validate entitlements
    if (status === "published") {
      // Check if this is an update to an already published job
      let isAlreadyPublished = false;
      if (jobId) {
        const { data: existingJob } = await supabaseClient
          .from("jobs")
          .select("status")
          .eq("id", jobId)
          .eq("contractor_id", contractorProfile.id)
          .single();
        
        isAlreadyPublished = existingJob?.status === "published";
        logStep("Existing job status check", { jobId, isAlreadyPublished, currentStatus: existingJob?.status });
      }

      // Only check entitlements if this is a new publish (not updating an already published job)
      let selectedEntitlement = null;
      
      if (!isAlreadyPublished) {
        // Fetch active entitlements
        const { data: entitlements, error: entError } = await supabaseClient
          .from("contractor_entitlements")
          .select("*")
          .eq("user_id", user.id)
          .eq("status", "active")
          .order("is_recurring", { ascending: false })
          .order("created_at", { ascending: true });

        if (entError) throw new Error(entError.message);

        logStep("Fetched entitlements", { count: entitlements?.length ?? 0 });

        if (!entitlements || entitlements.length === 0) {
          return new Response(
            JSON.stringify({
              error: "ERR_NO_SUBSCRIPTION",
              message: "You need an active subscription to publish jobs. Choose a plan to get started.",
              upgrade_options: ["single_post", "14_day_sprint", "monthly_contractor", "quarterly_contractor"],
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
          );
        }

        // Find entitlement with available slots
        for (const ent of entitlements) {
          // Check expiration
          if (ent.expires_at && new Date(ent.expires_at) < new Date()) {
            await supabaseClient
              .from("contractor_entitlements")
              .update({ status: "expired" })
              .eq("id", ent.id);
            continue;
          }

          // Unlimited plans
          if (ent.job_allowance === null) {
            selectedEntitlement = ent;
            break;
          }

          // Check slots
          const remaining = (ent.job_allowance ?? 0) - (ent.jobs_used ?? 0);
          if (remaining > 0) {
            selectedEntitlement = ent;
            break;
          }
        }

        if (!selectedEntitlement) {
          const currentTier = entitlements[0]?.plan_type ?? "your current";
          return new Response(
            JSON.stringify({
              error: "ERR_LIMIT_REACHED",
              message: `You have used all your job posts for your ${currentTier.replace(/_/g, " ")} plan. Upgrade to post more jobs.`,
              current_tier: currentTier,
              upgrade_options: ["14_day_sprint", "monthly_contractor", "quarterly_contractor"],
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
          );
        }

        // Enforce free tier position limit (max 1 position)
        if (selectedEntitlement.plan_type === "free_contractor") {
          const maxPositionsForFreeTier = 1;
          if (jobData.positions_available && jobData.positions_available > maxPositionsForFreeTier) {
            logStep("Free tier position limit exceeded", { 
              requested: jobData.positions_available, 
              allowed: maxPositionsForFreeTier 
            });
            return new Response(
              JSON.stringify({
                error: "ERR_FREE_TIER_LIMIT",
                message: `Free tier is limited to ${maxPositionsForFreeTier} position per job posting. Please upgrade your plan to post multiple positions.`,
                current_tier: "free_contractor",
                upgrade_options: ["single_post", "14_day_sprint", "monthly_contractor", "quarterly_contractor"],
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
            );
          }
          // Force positions_available to 1 for free tier (belt and suspenders)
          jobData.positions_available = 1;
        }

        logStep("Selected entitlement for publishing", { entitlementId: selectedEntitlement.id });
      } else {
        logStep("Skipping entitlement check - updating already published job");
      }

      // Create or update the job
      let createdJobId = jobId;

      if (jobId) {
        // Update existing job
        const { error: updateError } = await supabaseClient
          .from("jobs")
          .update({
            ...jobData,
            status: "published",
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId)
          .eq("contractor_id", contractorProfile.id);

        if (updateError) throw new Error(updateError.message);
        logStep("Job updated and published", { jobId });
      } else {
        // Create new job
        const { data: newJob, error: createError } = await supabaseClient
          .from("jobs")
          .insert({
            ...jobData,
            contractor_id: contractorProfile.id,
            status: "published",
          })
          .select("id")
          .single();

        if (createError) throw new Error(createError.message);
        createdJobId = newJob.id;
        logStep("New job created and published", { jobId: createdJobId });
      }

      // Update entitlement usage only for new publishes
      if (selectedEntitlement) {
        const newJobsUsed = (selectedEntitlement.jobs_used ?? 0) + 1;
        const updateData: Record<string, unknown> = { jobs_used: newJobsUsed };

        // If this is the first job on a one-time plan, set activated_at and expires_at
        if (!selectedEntitlement.activated_at && !selectedEntitlement.is_recurring) {
          const activatedAt = new Date();
          updateData.activated_at = activatedAt.toISOString();

          // Fetch duration from settings
          const { data: settings } = await supabaseClient
            .from("platform_settings")
            .select("setting_key, setting_value")
            .in("setting_key", ["single_post_duration_days", "14_day_sprint_duration_days"]);

          const settingsMap = Object.fromEntries(
            (settings ?? []).map((s) => [s.setting_key, parseInt(s.setting_value, 10)])
          );

          let durationDays = 14; // Default
          if (selectedEntitlement.plan_type === "single_post") {
            durationDays = settingsMap["single_post_duration_days"] ?? 14;
          } else if (selectedEntitlement.plan_type === "14_day_sprint") {
            durationDays = settingsMap["14_day_sprint_duration_days"] ?? 14;
          }

          const expiresAt = new Date(activatedAt);
          expiresAt.setDate(expiresAt.getDate() + durationDays);
          updateData.expires_at = expiresAt.toISOString();

          logStep("First job on one-time plan, setting activation", { activatedAt, expiresAt: updateData.expires_at });
        }

        // Check if entitlement is now consumed (for limited plans)
        if (selectedEntitlement.job_allowance !== null && newJobsUsed >= selectedEntitlement.job_allowance) {
          updateData.status = "consumed";
          logStep("Entitlement fully consumed", { entitlementId: selectedEntitlement.id });
        }

        await supabaseClient
          .from("contractor_entitlements")
          .update(updateData)
          .eq("id", selectedEntitlement.id);
      }

      // Handle shifts if provided
      if (shifts.length > 0 && createdJobId) {
        // Delete existing shifts for this job
        await supabaseClient.from("job_shifts").delete().eq("job_id", createdJobId);

        // Insert new shifts
        const shiftsToInsert = shifts.map((s) => ({
          job_id: createdJobId,
          shift_date: s.shift_date,
          start_time: s.start_time,
          end_time: s.end_time,
          break_minutes: s.break_minutes ?? 0,
          break_paid: s.break_paid ?? false,
        }));

        await supabaseClient.from("job_shifts").insert(shiftsToInsert);
        logStep("Shifts inserted", { count: shiftsToInsert.length });
      }

      return new Response(
        JSON.stringify({
          success: true,
          job_id: createdJobId,
          status: "published",
          entitlement_id: selectedEntitlement?.id ?? null,
          remaining_posts: selectedEntitlement 
            ? (selectedEntitlement.job_allowance === null
              ? "unlimited"
              : Math.max(0, (selectedEntitlement.job_allowance ?? 0) - (selectedEntitlement.jobs_used ?? 0) - 1))
            : "N/A",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    } else {
      // Draft - no entitlement check needed
      let createdJobId = jobId;

      if (jobId) {
        const { error: updateError } = await supabaseClient
          .from("jobs")
          .update({
            ...jobData,
            status: "draft",
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId)
          .eq("contractor_id", contractorProfile.id);

        if (updateError) throw new Error(updateError.message);
        logStep("Draft updated", { jobId });
      } else {
        const { data: newJob, error: createError } = await supabaseClient
          .from("jobs")
          .insert({
            ...jobData,
            contractor_id: contractorProfile.id,
            status: "draft",
          })
          .select("id")
          .single();

        if (createError) throw new Error(createError.message);
        createdJobId = newJob.id;
        logStep("Draft created", { jobId: createdJobId });
      }

      // Handle shifts if provided
      if (shifts.length > 0 && createdJobId) {
        await supabaseClient.from("job_shifts").delete().eq("job_id", createdJobId);

        const shiftsToInsert = shifts.map((s) => ({
          job_id: createdJobId,
          shift_date: s.shift_date,
          start_time: s.start_time,
          end_time: s.end_time,
          break_minutes: s.break_minutes ?? 0,
          break_paid: s.break_paid ?? false,
        }));

        await supabaseClient.from("job_shifts").insert(shiftsToInsert);
      }

      return new Response(
        JSON.stringify({
          success: true,
          job_id: createdJobId,
          status: "draft",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
