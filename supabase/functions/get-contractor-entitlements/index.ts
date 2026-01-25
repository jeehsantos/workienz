import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[GET-CONTRACTOR-ENTITLEMENTS] ${step}${detailsStr}`);
};

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
      return new Response(
        JSON.stringify({ error: "ERR_NOT_CONTRACTOR", message: "User is not a contractor" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    // Fetch active entitlements (including free tier) - also include consumed free tier for display
    const { data: entitlements, error: entError } = await supabaseClient
      .from("contractor_entitlements")
      .select("*")
      .eq("user_id", user.id)
      .or("status.in.(active,standby),and(status.eq.consumed,plan_type.in.(free_tier,free_contractor))");

    if (entError) {
      logStep("Error fetching entitlements", { error: entError.message });
      throw new Error(entError.message);
    }

    logStep("Fetched entitlements", { count: entitlements?.length ?? 0 });

    // Fetch current subscription for next billing date
    const { data: subscription } = await supabaseClient
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    // Process entitlements
    const processedEntitlements = (entitlements ?? []).map((ent) => {
      const isUnlimited = ent.job_allowance === null;
      const remainingSlots = isUnlimited ? "unlimited" : Math.max(0, (ent.job_allowance ?? 0) - (ent.jobs_used ?? 0));
      
      return {
        id: ent.id,
        plan_type: ent.plan_type,
        available_slots: isUnlimited ? "unlimited" : ent.job_allowance,
        remaining_slots: remainingSlots,
        jobs_used: ent.jobs_used ?? 0,
        expires_at: ent.expires_at,
        activated_at: ent.activated_at,
        is_stackable: ent.is_stackable ?? false,
        is_recurring: ent.is_recurring ?? false,
        status: ent.status,
        purchased_at: ent.purchased_at,
      };
    });

    // Determine overall capabilities
    const hasActiveEntitlement = processedEntitlements.length > 0;
    const hasUnlimited = processedEntitlements.some((e) => e.available_slots === "unlimited");
    
    // Calculate total remaining slots across all entitlements
    let totalRemainingSlots: number | "unlimited" = 0;
    for (const ent of processedEntitlements) {
      if (ent.remaining_slots === "unlimited") {
        totalRemainingSlots = "unlimited";
        break;
      }
      totalRemainingSlots += ent.remaining_slots as number;
    }

    const canPostJob = hasActiveEntitlement && (hasUnlimited || (typeof totalRemainingSlots === "number" && totalRemainingSlots > 0));
    const canBrowseDatabase = hasActiveEntitlement;

    // Determine active plan name
    let activePlanName = "No active plan";
    if (hasUnlimited) {
      const unlimitedEnt = processedEntitlements.find((e) => e.available_slots === "unlimited");
      activePlanName = unlimitedEnt?.plan_type.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) ?? "Unlimited Plan";
    } else if (hasActiveEntitlement) {
      activePlanName = processedEntitlements[0]?.plan_type.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) ?? "Active Plan";
    }

    // Next billing date is only for recurring subscriptions
    const nextBillingDate = subscription?.ends_at && processedEntitlements.some((e) => e.is_recurring)
      ? subscription.ends_at
      : null;

    const response = {
      entitlements: processedEntitlements,
      can_post_job: canPostJob,
      can_browse_database: canBrowseDatabase,
      total_remaining_slots: totalRemainingSlots,
      next_billing_date: nextBillingDate,
      active_plan_name: activePlanName,
      has_active_subscription: hasActiveEntitlement,
    };

    logStep("Returning entitlements response", response);

    return new Response(JSON.stringify(response), {
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
