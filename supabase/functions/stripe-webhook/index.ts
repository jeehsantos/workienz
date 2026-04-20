import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { recordPaymentFailure, markPaymentRetrySuccess } from "../_shared/payment-retry.ts";

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

    if (!webhookSecret) {
      logStep("ERROR: STRIPE_WEBHOOK_SECRET is not configured");
      return new Response(JSON.stringify({ error: "Webhook secret not configured" }), { status: 500 });
    }
    if (!signature) {
      logStep("ERROR: Missing stripe-signature header");
      return new Response(JSON.stringify({ error: "Missing stripe-signature header" }), { status: 400 });
    }
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      logStep("Webhook signature verified");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logStep("Webhook signature verification failed", { error: errorMessage });
      return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 });
    }

    logStep("Event type", { type: event.type });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Check if this event has already been processed (idempotency)
    const { data: existingEvent } = await supabase
      .from("webhook_events")
      .select("id")
      .eq("event_id", event.id)
      .single();

    if (existingEvent) {
      logStep("Event already processed, skipping", { eventId: event.id });
      return new Response(JSON.stringify({ received: true, skipped: true }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Record this event as being processed
    const { error: recordError } = await supabase
      .from("webhook_events")
      .insert({
        event_id: event.id,
        event_type: event.type,
        payload: event as any,
      });

    if (recordError) {
      logStep("Error recording webhook event", { error: recordError.message });
      // Continue processing even if recording fails (better than dropping the event)
    } else {
      logStep("Webhook event recorded", { eventId: event.id });
    }

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

          // Send welcome email and create notification
          try {
            // Get user email and name
            const { data: profile } = await supabase
              .from("profiles")
              .select("email, full_name, first_name")
              .eq("user_id", userId)
              .single();

            if (profile?.email) {
              // Invoke send-subscription-email function
              const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
              const response = await fetch(`${supabaseUrl}/functions/v1/send-subscription-email`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
                },
                body: JSON.stringify({
                  type: "welcome",
                  userId,
                  email: profile.email,
                  name: profile.first_name || profile.full_name,
                  planName: planName || "subscription",
                }),
              });
              
              if (response.ok) {
                logStep("Welcome email sent successfully");
              } else {
                logStep("Failed to send welcome email", { status: response.status });
              }
            }
          } catch (emailError) {
            logStep("Error sending welcome email", { error: String(emailError) });
          }
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

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        logStep("Payment failed", { 
          paymentIntentId: paymentIntent.id,
          error: paymentIntent.last_payment_error?.message 
        });

        // Get user_id from metadata
        const userId = paymentIntent.metadata?.user_id;
        if (!userId) {
          logStep("No user_id in payment intent metadata, skipping retry");
          break;
        }

        // Record failure and schedule retry
        const retryResult = await recordPaymentFailure(supabase, {
          userId,
          stripePaymentIntentId: paymentIntent.id,
          error: paymentIntent.last_payment_error?.message || "Payment failed",
          maxAttempts: 5,
        });

        if (retryResult.success) {
          logStep("Payment retry scheduled", {
            retryId: retryResult.retryId,
            nextRetryAt: retryResult.nextRetryAt,
          });
        } else {
          logStep("Max retry attempts reached or retry scheduling failed");
        }
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        logStep("Payment succeeded", { paymentIntentId: paymentIntent.id });

        // Mark any pending retries as succeeded
        const userId = paymentIntent.metadata?.user_id;
        if (userId) {
          await markPaymentRetrySuccess(supabase, {
            userId,
            stripePaymentIntentId: paymentIntent.id,
          });
          logStep("Payment retry marked as succeeded");
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Invoice payment failed", {
          invoiceId: invoice.id,
          subscriptionId: invoice.subscription,
        });

        // Get user from subscription
        if (invoice.subscription) {
          const { data: subscription } = await supabase
            .from("subscriptions")
            .select("user_id")
            .eq("stripe_subscription_id", invoice.subscription)
            .single();

          if (subscription?.user_id) {
            // Record failure and schedule retry
            const retryResult = await recordPaymentFailure(supabase, {
              userId: subscription.user_id,
              stripeSubscriptionId: invoice.subscription as string,
              error: invoice.last_finalization_error?.message || "Invoice payment failed",
              maxAttempts: 5,
            });

            if (retryResult.success) {
              logStep("Subscription payment retry scheduled", {
                retryId: retryResult.retryId,
                nextRetryAt: retryResult.nextRetryAt,
              });
            } else {
              logStep("Max retry attempts reached or retry scheduling failed");
            }
          }
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Invoice payment succeeded", {
          invoiceId: invoice.id,
          subscriptionId: invoice.subscription,
        });

        // Mark any pending retries as succeeded
        if (invoice.subscription) {
          const { data: subscription } = await supabase
            .from("subscriptions")
            .select("user_id")
            .eq("stripe_subscription_id", invoice.subscription)
            .single();

          if (subscription?.user_id) {
            await markPaymentRetrySuccess(supabase, {
              userId: subscription.user_id,
              stripeSubscriptionId: invoice.subscription as string,
            });
            logStep("Subscription payment retry marked as succeeded");
          }
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
