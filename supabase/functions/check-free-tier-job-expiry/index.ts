import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[FREE-TIER-JOB-EXPIRY] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Cron job started");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get the free tier expiry days setting
    const { data: setting } = await supabaseAdmin
      .from("platform_settings")
      .select("setting_value")
      .eq("setting_key", "free_tier_job_expiry_days")
      .single();

    const expiryDays = parseInt(setting?.setting_value || "30", 10);
    logStep("Using expiry days", { expiryDays });

    const now = new Date();
    const expiryThreshold = new Date(now.getTime() - expiryDays * 24 * 60 * 60 * 1000);

    // Find all jobs from free tier contractors that are older than expiry threshold
    // First, get contractors on free tier
    const { data: freeTierEntitlements, error: entError } = await supabaseAdmin
      .from("contractor_entitlements")
      .select("user_id")
      .eq("plan_type", "free_contractor")
      .eq("status", "active");

    if (entError) {
      throw new Error(`Failed to fetch free tier entitlements: ${entError.message}`);
    }

    if (!freeTierEntitlements || freeTierEntitlements.length === 0) {
      logStep("No free tier contractors found");
      return new Response(JSON.stringify({ 
        success: true, 
        message: "No free tier contractors found",
        jobsClosed: 0
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const freeTierUserIds = freeTierEntitlements.map(e => e.user_id);
    logStep("Found free tier contractors", { count: freeTierUserIds.length });

    // Get contractor profile IDs for these users
    const { data: contractorProfiles } = await supabaseAdmin
      .from("contractor_profiles")
      .select("id, user_id")
      .in("user_id", freeTierUserIds);

    if (!contractorProfiles || contractorProfiles.length === 0) {
      logStep("No contractor profiles found for free tier users");
      return new Response(JSON.stringify({ 
        success: true, 
        message: "No contractor profiles found",
        jobsClosed: 0
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const contractorIds = contractorProfiles.map(p => p.id);

    // Find published jobs from these contractors that are older than threshold
    const { data: expiredJobs, error: jobsError } = await supabaseAdmin
      .from("jobs")
      .select(`
        id,
        title,
        contractor_id,
        created_at
      `)
      .in("contractor_id", contractorIds)
      .eq("status", "published")
      .lt("created_at", expiryThreshold.toISOString());

    if (jobsError) {
      throw new Error(`Failed to fetch expired jobs: ${jobsError.message}`);
    }

    if (!expiredJobs || expiredJobs.length === 0) {
      logStep("No expired jobs found");
      return new Response(JSON.stringify({ 
        success: true, 
        message: "No expired jobs found",
        jobsClosed: 0
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    logStep("Found potentially expired jobs", { count: expiredJobs.length });

    let jobsClosed = 0;
    const errors: string[] = [];

    for (const job of expiredJobs) {
      try {
        // Check if job has any pending or hired applications (active conversations)
        const { data: activeApplications } = await supabaseAdmin
          .from("job_applications")
          .select("id, status")
          .eq("job_id", job.id)
          .in("status", ["pending", "hired"]);

        const hasActiveApplications = activeApplications && activeApplications.length > 0;

        if (hasActiveApplications) {
          logStep("Skipping job with active applications", { 
            jobId: job.id, 
            title: job.title,
            activeCount: activeApplications.length 
          });
          continue;
        }

        // Close the job
        const { error: updateError } = await supabaseAdmin
          .from("jobs")
          .update({ status: "closed" })
          .eq("id", job.id);

        if (updateError) {
          errors.push(`Job ${job.id}: ${updateError.message}`);
          continue;
        }

        // Find the contractor user_id for notification
        const contractorProfile = contractorProfiles.find(p => p.id === job.contractor_id);
        if (contractorProfile) {
          // Create notification for contractor
          await supabaseAdmin.from("notifications").insert({
            user_id: contractorProfile.user_id,
            type: "job_expired",
            title: "Job Posting Expired",
            message: `Your free tier job "${job.title}" has expired after ${expiryDays} days with no active applications.`,
            action_url: "/contractor/jobs",
            metadata: { job_id: job.id, job_title: job.title },
          });
        }

        jobsClosed++;
        logStep("Closed expired job", { jobId: job.id, title: job.title });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        errors.push(`Job ${job.id}: ${errMsg}`);
      }
    }

    logStep("Cron job completed", { jobsClosed, errors: errors.length });

    return new Response(JSON.stringify({ 
      success: true,
      jobsClosed,
      errorsCount: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    }), {
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
