import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CANCEL-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    const { subscriptionId } = await req.json();
    if (!subscriptionId) throw new Error("Subscription ID is required");
    logStep("Subscription ID received", { subscriptionId });

    // Verify the subscription belongs to this user
    const { data: subData, error: subError } = await supabaseClient
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .eq("stripe_subscription_id", subscriptionId)
      .single();

    if (subError || !subData) {
      throw new Error("Subscription not found or does not belong to this user");
    }
    logStep("Subscription verified", { userId: user.id });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Cancel at period end (user keeps access until current billing period ends)
    const cancelledSubscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });

    // Get period end with fallback to item-level data
    const periodEnd = cancelledSubscription.current_period_end 
      ?? cancelledSubscription.items?.data?.[0]?.current_period_end;

    logStep("Subscription set to cancel at period end", { 
      subscriptionId: cancelledSubscription.id,
      cancelAtPeriodEnd: cancelledSubscription.cancel_at_period_end,
      rootPeriodEnd: cancelledSubscription.current_period_end,
      itemPeriodEnd: cancelledSubscription.items?.data?.[0]?.current_period_end,
      using: periodEnd
    });

    // Calculate ends_at date with validation
    let endsAtDate: string | null = null;
    if (typeof periodEnd === 'number' && periodEnd > 0) {
      endsAtDate = new Date(periodEnd * 1000).toISOString();
    } else {
      logStep("WARNING: No valid period end found, using null for ends_at");
    }

    // Update local subscription record - mark as cancelled but with ends_at in future
    // The subscription will remain "active" in Stripe until period end
    await supabaseClient
      .from("subscriptions")
      .update({
        ends_at: endsAtDate,
      })
      .eq("stripe_subscription_id", subscriptionId);

    return new Response(JSON.stringify({ 
      success: true,
      endsAt: endsAtDate
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in cancel-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
