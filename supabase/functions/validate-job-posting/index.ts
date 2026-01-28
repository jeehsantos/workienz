import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[VALIDATE-JOB-POSTING] ${step}${detailsStr}`);
};

interface ValidationResult {
  can_post: boolean;
  remaining_posts: number | "unlimited";
  error_code: string | null;
  message: string | null;
  current_tier: string | null;
  plan_type: string | null; // Added for frontend tier detection
  upgrade_options: string[];
  entitlement_id: string | null;
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

    // Verify user is a contractor
    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "contractor")
      .single();

    if (!roleData) {
      const result: ValidationResult = {
        can_post: false,
        remaining_posts: 0,
        error_code: "ERR_NOT_CONTRACTOR",
        message: "You must be a contractor to post jobs.",
        current_tier: null,
        plan_type: null,
        upgrade_options: [],
        entitlement_id: null,
      };
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Fetch all active entitlements for this user
    const { data: entitlements, error: entError } = await supabaseClient
      .from("contractor_entitlements")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("is_recurring", { ascending: false }) // Prefer recurring (unlimited) first
      .order("created_at", { ascending: true });

    if (entError) {
      logStep("Error fetching entitlements", { error: entError.message });
      throw new Error(entError.message);
    }

    logStep("Fetched entitlements", { count: entitlements?.length ?? 0 });

    // No entitlements means no subscription
    if (!entitlements || entitlements.length === 0) {
      const result: ValidationResult = {
        can_post: false,
        remaining_posts: 0,
        error_code: "ERR_NO_SUBSCRIPTION",
        message: "Love seeing those job posts fly! It looks like you’ve reached your free limit. Ready to take the next step? Choose a plan that fits your goals and let’s get your team growing again.",
        current_tier: null,
        plan_type: null,
        upgrade_options: ["single_post", "14_day_sprint", "monthly_contractor", "quarterly_contractor"],
        entitlement_id: null,
      };
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Find an entitlement that has available slots
    let selectedEntitlement = null;
    let totalRemaining: number | "unlimited" = 0;

    for (const ent of entitlements) {
      // Check if entitlement has expired
      if (ent.expires_at && new Date(ent.expires_at) < new Date()) {
        logStep("Entitlement expired", { id: ent.id, expires_at: ent.expires_at });
        // Mark as expired (async, don't wait)
        supabaseClient
          .from("contractor_entitlements")
          .update({ status: "expired" })
          .eq("id", ent.id)
          .then(() => logStep("Marked entitlement as expired", { id: ent.id }));
        continue;
      }

      // Unlimited plans (monthly/quarterly)
      if (ent.job_allowance === null) {
        selectedEntitlement = ent;
        totalRemaining = "unlimited";
        break;
      }

      // Check if slots available
      const remaining = (ent.job_allowance ?? 0) - (ent.jobs_used ?? 0);
      if (remaining > 0) {
        selectedEntitlement = ent;
        if (typeof totalRemaining === "number") {
          totalRemaining += remaining;
        }
      }
    }

    // No available slots
    if (!selectedEntitlement) {
      const currentTier = entitlements[0]?.plan_type ?? null;
      const upgradeOptions = currentTier === "single_post" 
        ? ["14_day_sprint", "monthly_contractor", "quarterly_contractor"]
        : currentTier === "14_day_sprint"
        ? ["monthly_contractor", "quarterly_contractor"]
        : ["single_post", "14_day_sprint", "monthly_contractor", "quarterly_contractor"];

      const result: ValidationResult = {
        can_post: false,
        remaining_posts: 0,
        error_code: "ERR_LIMIT_REACHED",
        message: `You have used all your job posts for your ${currentTier?.replace(/_/g, " ")} plan. Upgrade to post more jobs.`,
        current_tier: currentTier,
        plan_type: currentTier,
        upgrade_options: upgradeOptions,
        entitlement_id: null,
      };
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Calculate remaining for selected entitlement
    const remaining = selectedEntitlement.job_allowance === null
      ? "unlimited"
      : Math.max(0, (selectedEntitlement.job_allowance ?? 0) - (selectedEntitlement.jobs_used ?? 0));

    // Check for free tier - support both 'free_tier' and 'free_contractor' plan types
    const isFreeTier = selectedEntitlement.plan_type === "free_tier" || selectedEntitlement.plan_type === "free_contractor";

    const result: ValidationResult = {
      can_post: true,
      remaining_posts: remaining,
      error_code: null,
      message: null,
      current_tier: selectedEntitlement.plan_type,
      plan_type: selectedEntitlement.plan_type,
      upgrade_options: [],
      entitlement_id: selectedEntitlement.id,
    };

    logStep("Validation passed", result);

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
