import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ENROLL-FREE-TIER] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      throw new Error("Invalid token");
    }

    const userId = userData.user.id;
    logStep("User authenticated", { userId });

    // Check if user is a contractor
    const { data: roleCheck } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "contractor")
      .single();

    if (!roleCheck) {
      return new Response(
        JSON.stringify({ success: false, error: "User is not a contractor" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user already has any entitlement
    const { data: existingEntitlement } = await supabase
      .from("contractor_entitlements")
      .select("id, plan_type")
      .eq("user_id", userId)
      .not("status", "in", '("expired","consumed")')
      .limit(1)
      .maybeSingle();

    if (existingEntitlement) {
      logStep("User already has an entitlement", { existingPlan: existingEntitlement.plan_type });
      return new Response(
        JSON.stringify({ 
          success: true, 
          already_enrolled: true,
          plan_type: existingEntitlement.plan_type 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get free tier expiry setting
    const { data: settings } = await supabase
      .from("platform_settings")
      .select("setting_value")
      .eq("setting_key", "free_tier_job_expiry_days")
      .single();

    const expiryDays = parseInt(settings?.setting_value || "30");
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    // Create free tier entitlement
    const { error: insertError } = await supabase
      .from("contractor_entitlements")
      .insert({
        user_id: userId,
        plan_type: "free_tier",
        is_recurring: false,
        job_allowance: 1, // 1 job allowed
        jobs_used: 0,
        purchased_at: now.toISOString(),
        activated_at: now.toISOString(),
        expires_at: null, // Free tier doesn't expire, but jobs do
        is_stackable: false,
        status: "active"
      });

    if (insertError) {
      logStep("Error creating entitlement", { error: insertError.message });
      throw new Error(`Failed to create free tier entitlement: ${insertError.message}`);
    }

    logStep("Free tier entitlement created successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        already_enrolled: false,
        plan_type: "free_tier"
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
