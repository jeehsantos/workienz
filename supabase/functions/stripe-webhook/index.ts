import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  try {
    logStep("Webhook received");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    let event: Stripe.Event;

    if (webhookSecret && signature) {
      try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
        logStep("Webhook signature verified");
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        logStep("Webhook signature verification failed", { error: errorMessage });
        return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 });
      }
    } else {
      // For development without signature verification
      event = JSON.parse(body);
      logStep("Webhook received without signature verification (dev mode)");
    }

    logStep("Event type", { type: event.type });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        logStep("Checkout session completed", { 
          sessionId: session.id, 
          customerId: session.customer,
          metadata: session.metadata 
        });

        const userId = session.metadata?.user_id;
        const planId = session.metadata?.plan_id;
        const planName = session.metadata?.plan_name;
        const planType = session.metadata?.plan_type;

        if (!userId) {
          logStep("No user_id in metadata, skipping");
          break;
        }

        // Determine subscription dates
        const now = new Date().toISOString();
        let endsAt: string | null = null;

        // For subscriptions, ends_at will be updated by subscription events
        // For one-time payments, calculate end date based on plan type
        if (session.mode === "payment") {
          const endDate = new Date();
          if (planId?.includes("14_day") || planId?.includes("single")) {
            endDate.setDate(endDate.getDate() + 14);
          } else {
            endDate.setMonth(endDate.getMonth() + 1);
          }
          endsAt = endDate.toISOString();
        }

        // Create or update subscription record
        const { error: upsertError } = await supabase
          .from("subscriptions")
          .upsert({
            user_id: userId,
            plan_name: planName || "Basic",
            status: "active",
            starts_at: now,
            ends_at: endsAt,
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: session.subscription as string | null,
            stripe_price_id: planId,
          }, {
            onConflict: "user_id",
          });

        if (upsertError) {
          logStep("Error upserting subscription", { error: upsertError.message });
        } else {
          logStep("Subscription record created/updated", { userId, planName });
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Subscription updated", { 
          subscriptionId: subscription.id,
          status: subscription.status,
          currentPeriodEnd: subscription.current_period_end
        });

        // Update the subscription end date
        const { error } = await supabase
          .from("subscriptions")
          .update({
            status: subscription.status === "active" ? "active" : "cancelled",
            ends_at: new Date(subscription.current_period_end * 1000).toISOString(),
          })
          .eq("stripe_subscription_id", subscription.id);

        if (error) {
          logStep("Error updating subscription", { error: error.message });
        } else {
          logStep("Subscription updated in database");
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Subscription deleted", { subscriptionId: subscription.id });

        const { error } = await supabase
          .from("subscriptions")
          .update({ status: "cancelled" })
          .eq("stripe_subscription_id", subscription.id);

        if (error) {
          logStep("Error cancelling subscription", { error: error.message });
        } else {
          logStep("Subscription cancelled in database");
        }
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in stripe-webhook", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
