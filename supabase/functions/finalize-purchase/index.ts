import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[FINALIZE-PURCHASE] ${step}${detailsStr}`);
};

const computeOneTimeEndDate = (planId: string) => {
  const endDate = new Date();

  // Keep consistent with existing webhook behavior
  if (planId.includes("14_day") || planId.includes("single")) {
    endDate.setDate(endDate.getDate() + 14);
  } else {
    endDate.setMonth(endDate.getMonth() + 1);
  }

  return endDate.toISOString();
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabaseClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");

    const body = await req.json().catch(() => ({}));
    const paymentIntentId = body?.paymentIntentId as string | undefined;
    const sessionId = body?.sessionId as string | undefined;
    const fallbackPlanId = body?.planId as string | undefined;

    if (!paymentIntentId && !sessionId) {
      throw new Error("Either paymentIntentId or sessionId is required");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    let customerId: string | null = null;
    let stripeSubscriptionId: string | null = null;
    let subscription: Stripe.Subscription | null = null;
    let resolvedPlanId: string | null = fallbackPlanId ?? null;
    let resolvedPlanName: string | null = null;

    // Handle Stripe Checkout Session flow
    if (sessionId) {
      logStep("Retrieving Checkout Session", { sessionId });
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["subscription", "payment_intent"],
      });

      logStep("Checkout Session retrieved", {
        mode: session.mode,
        paymentStatus: session.payment_status,
        subscriptionId: session.subscription,
      });

      if (session.payment_status !== "paid") {
        throw new Error(`Checkout session not paid (status=${session.payment_status})`);
      }

      customerId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;

      // Extract plan info from metadata
      resolvedPlanId = session.metadata?.plan_id ?? fallbackPlanId ?? null;
      resolvedPlanName = session.metadata?.plan_name ?? null;

      if (session.subscription) {
        stripeSubscriptionId = typeof session.subscription === "string" 
          ? session.subscription 
          : session.subscription.id;
        
        logStep("Session has subscription", { stripeSubscriptionId });
        subscription = typeof session.subscription === "object" 
          ? session.subscription as Stripe.Subscription
          : await stripe.subscriptions.retrieve(stripeSubscriptionId);
      }
    } 
    // Handle PaymentIntent flow (embedded payments)
    else if (paymentIntentId) {
      logStep("Retrieving PaymentIntent", { paymentIntentId });
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      if (paymentIntent.status !== "succeeded") {
        throw new Error(`PaymentIntent not succeeded (status=${paymentIntent.status})`);
      }

      customerId = typeof paymentIntent.customer === "string"
        ? paymentIntent.customer
        : paymentIntent.customer?.id ?? null;

      resolvedPlanId = paymentIntent.metadata?.plan_id ?? fallbackPlanId ?? null;
      resolvedPlanName = paymentIntent.metadata?.plan_name ?? null;

      // If PaymentIntent is for a subscription, it will be linked to an invoice
      if (paymentIntent.invoice) {
        const invoiceId = typeof paymentIntent.invoice === "string" ? paymentIntent.invoice : paymentIntent.invoice.id;
        logStep("PaymentIntent has invoice", { invoiceId });

        const invoice = await stripe.invoices.retrieve(invoiceId);
        if (invoice.subscription) {
          stripeSubscriptionId = typeof invoice.subscription === "string" 
            ? invoice.subscription 
            : invoice.subscription.id;

          logStep("Invoice has subscription", { stripeSubscriptionId });
          subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
        }
      }
    }

    const isSubscription = !!subscription;

    let planId: string | null = resolvedPlanId;
    let planName: string | null = resolvedPlanName;
    let startsAt = new Date().toISOString();
    let endsAt: string | null = null;
    let statusToStore: "active" | "pending" | "cancelled" = "active";

    if (isSubscription && subscription) {
      // Override with subscription metadata if available
      planId = subscription.metadata?.plan_id ?? resolvedPlanId ?? null;
      planName = subscription.metadata?.plan_name ?? resolvedPlanName ?? null;

      startsAt = new Date(subscription.current_period_start * 1000).toISOString();
      endsAt = new Date(subscription.current_period_end * 1000).toISOString();

      if (subscription.status === "active" || subscription.status === "trialing") {
        statusToStore = "active";
      } else {
        statusToStore = "pending";
      }

      logStep("Resolved subscription purchase", {
        planId,
        status: subscription.status,
        currentPeriodEnd: subscription.current_period_end,
      });
    } else {
      // One-time payment
      if (!planId) {
        throw new Error("Unable to determine planId for one-time payment");
      }

      endsAt = computeOneTimeEndDate(planId);
      statusToStore = "active";

      logStep("Resolved one-time purchase", { planId, endsAt });
    }

    if (!planId) throw new Error("Unable to resolve planId");

    // Ensure we store a consistent plan name by falling back to plan_products
    if (!planName) {
      const { data: planRow } = await supabaseClient
        .from("plan_products")
        .select("plan_name")
        .eq("plan_id", planId)
        .maybeSingle();

      planName = planRow?.plan_name ?? "subscription";
    }

    logStep("Upserting subscription record", {
      userId: user.id,
      planId,
      planName,
      statusToStore,
      endsAt,
      stripeSubscriptionId,
    });

    const { error: upsertError } = await supabaseClient
      .from("subscriptions")
      .upsert(
        {
          user_id: user.id,
          plan_name: planName,
          status: statusToStore,
          starts_at: startsAt,
          ends_at: endsAt,
          stripe_customer_id: customerId,
          stripe_subscription_id: stripeSubscriptionId,
          // NOTE: despite the column name, the app currently uses this field to store our internal plan_id
          stripe_price_id: planId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

    if (upsertError) throw upsertError;

    return new Response(
      JSON.stringify({
        success: true,
        planId,
        planName,
        status: statusToStore,
        endsAt,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
