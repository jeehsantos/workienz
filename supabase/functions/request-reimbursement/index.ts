import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[REQUEST-REIMBURSEMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

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
      jobsUsed: entitlement.jobs_used,
      paymentIntentId: entitlement.stripe_payment_intent_id 
    });

    // Can only refund standby entitlements that haven't been used
    if (entitlement.status !== "standby") {
      throw new Error("Only standby entitlements can be reimbursed");
    }

    if (entitlement.jobs_used > 0) {
      throw new Error("Cannot reimburse entitlements that have been used");
    }

    if (!entitlement.stripe_payment_intent_id) {
      throw new Error("No payment record found for this entitlement");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Retrieve the payment intent to get the charge ID
    const paymentIntent = await stripe.paymentIntents.retrieve(entitlement.stripe_payment_intent_id);
    logStep("Payment intent retrieved", { 
      status: paymentIntent.status,
      amount: paymentIntent.amount 
    });

    if (paymentIntent.status !== "succeeded") {
      throw new Error("Payment was not successful, cannot refund");
    }

    // Get the latest charge
    const charges = await stripe.charges.list({
      payment_intent: entitlement.stripe_payment_intent_id,
      limit: 1,
    });

    if (charges.data.length === 0) {
      throw new Error("No charge found for this payment");
    }

    const charge = charges.data[0];
    logStep("Charge found", { chargeId: charge.id, amount: charge.amount });

    // Process the refund
    const refund = await stripe.refunds.create({
      charge: charge.id,
      reason: "requested_by_customer",
    });

    logStep("Refund created", { refundId: refund.id, status: refund.status });

    // Update entitlement status to refunded
    const { error: updateError } = await supabaseClient
      .from("contractor_entitlements")
      .update({
        status: "refunded",
        deactivated_at: new Date().toISOString(),
        deactivated_reason: "refunded",
      })
      .eq("id", entitlementId)
      .eq("user_id", user.id);

    if (updateError) {
      logStep("WARNING: Failed to update entitlement status", { error: updateError.message });
      // Don't throw - refund was successful
    }

    logStep("Reimbursement completed successfully");

    return new Response(JSON.stringify({
      success: true,
      refund_id: refund.id,
      refund_status: refund.status,
      amount_refunded: refund.amount,
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
