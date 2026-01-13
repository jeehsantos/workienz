import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[GET-PENDING-CHANGES] ${step}${detailsStr}`);
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
    if (!authHeader?.startsWith("Bearer ")) {
      throw new Error("No authorization header provided");
    }
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      throw new Error(`Authentication error: ${claimsError?.message || "Invalid token"}`);
    }
    
    const userId = claimsData.claims.sub as string;
    const email = claimsData.claims.email as string;
    if (!email) throw new Error("User email not available in token");
    logStep("User authenticated", { userId, email });

    // Initialize Stripe
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Find customer by email
    const customers = await stripe.customers.list({ email: email, limit: 1 });
    if (customers.data.length === 0) {
      return new Response(
        JSON.stringify({ hasPendingChanges: false }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }
    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    // Get active subscription for this customer
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
      expand: ["data.schedule"],
    });

    if (subscriptions.data.length === 0) {
      return new Response(
        JSON.stringify({ hasPendingChanges: false }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const subscription = subscriptions.data[0];
    logStep("Subscription found", { subscriptionId: subscription.id });

    // Check if the subscription has a schedule (pending changes)
    let pendingChange = null;
    
    if (subscription.schedule) {
      const schedule = subscription.schedule as Stripe.SubscriptionSchedule;
      logStep("Subscription schedule found", { scheduleId: schedule.id, status: schedule.status });
      
      // Get the upcoming phase if it exists
      if (schedule.phases && schedule.phases.length > 1) {
        const nextPhase = schedule.phases[1];
        const nextPriceId = nextPhase.items[0]?.price;
        
        if (nextPriceId && typeof nextPriceId === 'string') {
          // Get plan details for the pending price
          const { data: pendingPlan } = await supabaseClient
            .from("plan_products")
            .select("plan_name, price_cents")
            .eq("stripe_price_id", nextPriceId)
            .single();

          if (pendingPlan) {
            pendingChange = {
              newPlanName: pendingPlan.plan_name,
              newPrice: pendingPlan.price_cents,
              effectiveDate: new Date(nextPhase.start_date * 1000).toISOString(),
            };
            logStep("Pending change found", pendingChange);
          }
        }
      }
    }

    // Also check subscription's cancel_at_period_end status
    const cancelAtPeriodEnd = subscription.cancel_at_period_end;
    const currentPeriodEnd = subscription.current_period_end 
      ? new Date(subscription.current_period_end * 1000).toISOString() 
      : null;

    return new Response(
      JSON.stringify({
        hasPendingChanges: !!pendingChange || cancelAtPeriodEnd,
        pendingChange,
        cancelAtPeriodEnd,
        currentPeriodEnd,
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
