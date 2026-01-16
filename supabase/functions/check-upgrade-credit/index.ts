import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-UPGRADE-CREDIT] ${step}${detailsStr}`);
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

    const { targetPlanId } = await req.json();
    if (!targetPlanId) throw new Error("Target plan ID is required");
    logStep("Target plan received", { targetPlanId });

    // Get active one-time entitlements where jobs_used = 0
    const { data: unusedEntitlements, error: entitlementError } = await supabaseClient
      .from("contractor_entitlements")
      .select("id, plan_type, is_recurring, jobs_used, status")
      .eq("user_id", user.id)
      .eq("status", "active")
      .eq("is_recurring", false)
      .eq("jobs_used", 0);

    if (entitlementError) {
      throw new Error(`Error fetching entitlements: ${entitlementError.message}`);
    }

    logStep("Fetched unused entitlements", { count: unusedEntitlements?.length || 0 });

    if (!unusedEntitlements || unusedEntitlements.length === 0) {
      return new Response(JSON.stringify({
        has_credit: false,
        credit_amount_cents: 0,
        credit_source_plan: null,
        entitlements_to_deactivate: [],
        warning_message: null
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Get the prices for the unused entitlements
    const planTypes = unusedEntitlements.map(e => e.plan_type);
    const { data: planProducts, error: planError } = await supabaseClient
      .from("plan_products")
      .select("plan_id, plan_name, price_cents")
      .in("plan_id", planTypes);

    if (planError) {
      throw new Error(`Error fetching plan products: ${planError.message}`);
    }

    logStep("Fetched plan products", { plans: planProducts });

    // Calculate total credit from unused entitlements
    let totalCreditCents = 0;
    const entitlementsToDeactivate: string[] = [];
    const creditSourcePlans: string[] = [];

    for (const entitlement of unusedEntitlements) {
      const plan = planProducts?.find(p => p.plan_id === entitlement.plan_type);
      if (plan) {
        totalCreditCents += plan.price_cents;
        entitlementsToDeactivate.push(entitlement.id);
        creditSourcePlans.push(plan.plan_name);
      }
    }

    logStep("Calculated credit", { totalCreditCents, entitlementsToDeactivate });

    // Get target plan price to cap credit
    const { data: targetPlan, error: targetPlanError } = await supabaseClient
      .from("plan_products")
      .select("price_cents, plan_name")
      .eq("plan_id", targetPlanId)
      .single();

    if (targetPlanError || !targetPlan) {
      throw new Error(`Target plan not found: ${targetPlanId}`);
    }

    // Cap credit at target plan price
    const cappedCredit = Math.min(totalCreditCents, targetPlan.price_cents);

    const warningMessage = creditSourcePlans.length > 0
      ? `Your unused ${creditSourcePlans.join(", ")} ($${(totalCreditCents / 100).toFixed(2)}) will be deactivated and credited toward this purchase.`
      : null;

    return new Response(JSON.stringify({
      has_credit: totalCreditCents > 0,
      credit_amount_cents: cappedCredit,
      original_credit_cents: totalCreditCents,
      credit_source_plan: creditSourcePlans.join(", "),
      entitlements_to_deactivate: entitlementsToDeactivate,
      warning_message: warningMessage
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
