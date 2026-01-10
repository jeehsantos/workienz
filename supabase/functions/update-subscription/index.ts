import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[UPDATE-SUBSCRIPTION] ${step}${detailsStr}`);
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
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const { newPlanId } = await req.json();
    if (!newPlanId) throw new Error("New plan ID is required");
    logStep("New plan ID received", { newPlanId });

    // Get new plan details from database
    const { data: newPlanData, error: planError } = await supabaseClient
      .from("plan_products")
      .select("*")
      .eq("plan_id", newPlanId)
      .single();

    if (planError || !newPlanData) {
      throw new Error("New plan not found");
    }
    logStep("New plan details fetched", { planName: newPlanData.plan_name, price: newPlanData.price_cents });

    if (!newPlanData.stripe_price_id) {
      throw new Error("Plan does not have a Stripe price configured");
    }

    // Initialize Stripe
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Find customer by email
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length === 0) {
      throw new Error("No Stripe customer found for this user");
    }
    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    // Get active subscription for this customer
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      throw new Error("No active subscription found to update");
    }

    const currentSubscription = subscriptions.data[0];
    const currentItemId = currentSubscription.items.data[0].id;
    const currentPriceId = currentSubscription.items.data[0].price.id;
    
    logStep("Current subscription found", { 
      subscriptionId: currentSubscription.id, 
      currentItemId,
      currentPriceId 
    });

    // Update subscription to the new plan
    // proration_behavior: 'none' means the change takes effect at the next billing cycle
    const updatedSubscription = await stripe.subscriptions.update(
      currentSubscription.id,
      {
        items: [
          {
            id: currentItemId,
            deleted: true,
          },
          {
            price: newPlanData.stripe_price_id,
          },
        ],
        proration_behavior: "none",
        metadata: {
          user_id: user.id,
          plan_id: newPlanId,
          plan_name: newPlanData.plan_name,
          plan_type: newPlanData.plan_type,
          previous_plan_id: currentSubscription.metadata?.plan_id,
        },
      }
    );

    logStep("Subscription updated", { 
      subscriptionId: updatedSubscription.id,
      newPriceId: newPlanData.stripe_price_id,
      status: updatedSubscription.status
    });

    // Get the next billing date
    const nextBillingDate = updatedSubscription.current_period_end 
      ? new Date(updatedSubscription.current_period_end * 1000).toISOString()
      : null;

    // Update local subscription record
    await supabaseClient
      .from("subscriptions")
      .update({
        plan_name: newPlanData.plan_name,
        stripe_price_id: newPlanId,
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_subscription_id", currentSubscription.id);

    logStep("Local subscription record updated");

    return new Response(
      JSON.stringify({
        success: true,
        newPlanName: newPlanData.plan_name,
        nextBillingDate,
        message: `Your plan will change to ${newPlanData.plan_name} on your next billing date.`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage, stack: error instanceof Error ? error.stack : undefined });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
