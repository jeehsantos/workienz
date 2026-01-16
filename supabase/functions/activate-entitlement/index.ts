import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ACTIVATE-ENTITLEMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    const { entitlementId } = await req.json();
    if (!entitlementId) throw new Error("Entitlement ID is required");
    logStep("Entitlement ID received", { entitlementId });

    // Get the entitlement
    const { data: entitlement, error: entError } = await supabaseClient
      .from("contractor_entitlements")
      .select("*")
      .eq("id", entitlementId)
      .eq("user_id", user.id)
      .single();

    if (entError || !entitlement) {
      throw new Error("Entitlement not found or does not belong to user");
    }

    logStep("Entitlement found", { 
      planType: entitlement.plan_type, 
      status: entitlement.status,
      activatedAt: entitlement.activated_at 
    });

    // Check if already activated
    if (entitlement.activated_at) {
      throw new Error("This entitlement is already activated");
    }

    // Check if entitlement is in standby status
    if (entitlement.status !== "standby") {
      throw new Error("Only standby entitlements can be activated");
    }

    // Check for active recurring subscription
    const { data: activeSubscription } = await supabaseClient
      .from("contractor_entitlements")
      .select("id, plan_type")
      .eq("user_id", user.id)
      .eq("status", "active")
      .eq("is_recurring", true)
      .not("activated_at", "is", null)
      .limit(1)
      .maybeSingle();

    if (activeSubscription) {
      logStep("User has active subscription, cannot activate", { 
        activeSubId: activeSubscription.id,
        activePlanType: activeSubscription.plan_type 
      });
      return new Response(JSON.stringify({
        success: false,
        error: "active_subscription_exists",
        message: `You have an active ${activeSubscription.plan_type.replace(/_/g, " ")} subscription. This entitlement can be redeemed once your subscription ends, or you can request a reimbursement.`
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Calculate expiry date based on plan type
    const now = new Date();
    let expiresAt: Date;
    
    if (entitlement.plan_type === "single_post") {
      // Single post: no time limit, expires when used
      expiresAt = new Date(now);
      expiresAt.setFullYear(expiresAt.getFullYear() + 100); // Effectively no expiry
    } else if (entitlement.plan_type === "14_day_sprint") {
      expiresAt = new Date(now);
      expiresAt.setDate(expiresAt.getDate() + 14);
    } else {
      expiresAt = new Date(now);
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    }

    // Activate the entitlement
    const { error: updateError } = await supabaseClient
      .from("contractor_entitlements")
      .update({
        status: "active",
        activated_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .eq("id", entitlementId)
      .eq("user_id", user.id);

    if (updateError) {
      throw new Error(`Failed to activate entitlement: ${updateError.message}`);
    }

    logStep("Entitlement activated successfully", { 
      activatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString() 
    });

    return new Response(JSON.stringify({
      success: true,
      activated_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
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
