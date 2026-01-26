import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getPendingRetries, recordPaymentFailure, markPaymentRetrySuccess } from "../_shared/payment-retry.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PROCESS-PAYMENT-RETRIES] ${step}${detailsStr}`);
};

serve(async (req) => {
  try {
    logStep("Starting payment retry processing");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get all pending retries that are ready to be processed
    const pendingRetries = await getPendingRetries(supabase);
    logStep("Found pending retries", { count: pendingRetries.length });

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const retry of pendingRetries) {
      try {
        logStep("Processing retry", {
          retryId: retry.id,
          attemptNumber: retry.attempt_number,
          userId: retry.user_id,
        });

        results.processed++;

        // Determine what type of payment to retry
        if (retry.stripe_payment_intent_id) {
          // Retry payment intent
          try {
            const paymentIntent = await stripe.paymentIntents.retrieve(
              retry.stripe_payment_intent_id
            );

            if (paymentIntent.status === "succeeded") {
              // Payment already succeeded
              await markPaymentRetrySuccess(supabase, {
                userId: retry.user_id,
                stripePaymentIntentId: retry.stripe_payment_intent_id,
              });
              results.succeeded++;
              logStep("Payment intent already succeeded", {
                paymentIntentId: retry.stripe_payment_intent_id,
              });
            } else if (paymentIntent.status === "requires_payment_method") {
              // Cannot automatically retry - requires user action
              logStep("Payment intent requires user action", {
                paymentIntentId: retry.stripe_payment_intent_id,
              });
              // Keep in retrying state for next attempt
            } else {
              // Try to confirm the payment intent
              const confirmed = await stripe.paymentIntents.confirm(
                retry.stripe_payment_intent_id
              );

              if (confirmed.status === "succeeded") {
                await markPaymentRetrySuccess(supabase, {
                  userId: retry.user_id,
                  stripePaymentIntentId: retry.stripe_payment_intent_id,
                });
                results.succeeded++;
                logStep("Payment intent retry succeeded", {
                  paymentIntentId: retry.stripe_payment_intent_id,
                });
              } else {
                // Still not succeeded, schedule another retry
                await recordPaymentFailure(supabase, {
                  userId: retry.user_id,
                  stripePaymentIntentId: retry.stripe_payment_intent_id,
                  error: `Payment status: ${confirmed.status}`,
                  maxAttempts: retry.max_attempts,
                });
                logStep("Payment intent retry still pending", {
                  paymentIntentId: retry.stripe_payment_intent_id,
                  status: confirmed.status,
                });
              }
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logStep("Error retrying payment intent", {
              paymentIntentId: retry.stripe_payment_intent_id,
              error: errorMessage,
            });
            
            // Record the failure
            await recordPaymentFailure(supabase, {
              userId: retry.user_id,
              stripePaymentIntentId: retry.stripe_payment_intent_id,
              error: errorMessage,
              maxAttempts: retry.max_attempts,
            });
            results.failed++;
          }
        } else if (retry.stripe_subscription_id) {
          // Retry subscription payment
          try {
            const subscription = await stripe.subscriptions.retrieve(
              retry.stripe_subscription_id
            );

            if (subscription.status === "active") {
              // Subscription is now active
              await markPaymentRetrySuccess(supabase, {
                userId: retry.user_id,
                stripeSubscriptionId: retry.stripe_subscription_id,
              });
              results.succeeded++;
              logStep("Subscription payment succeeded", {
                subscriptionId: retry.stripe_subscription_id,
              });
            } else if (subscription.status === "past_due") {
              // Get the latest invoice and retry payment
              const invoices = await stripe.invoices.list({
                subscription: retry.stripe_subscription_id,
                limit: 1,
              });

              if (invoices.data.length > 0) {
                const invoice = invoices.data[0];
                
                if (invoice.status === "open") {
                  // Try to pay the invoice
                  const paidInvoice = await stripe.invoices.pay(invoice.id);
                  
                  if (paidInvoice.status === "paid") {
                    await markPaymentRetrySuccess(supabase, {
                      userId: retry.user_id,
                      stripeSubscriptionId: retry.stripe_subscription_id,
                    });
                    results.succeeded++;
                    logStep("Subscription invoice payment succeeded", {
                      subscriptionId: retry.stripe_subscription_id,
                      invoiceId: invoice.id,
                    });
                  } else {
                    // Still not paid, schedule another retry
                    await recordPaymentFailure(supabase, {
                      userId: retry.user_id,
                      stripeSubscriptionId: retry.stripe_subscription_id,
                      error: `Invoice status: ${paidInvoice.status}`,
                      maxAttempts: retry.max_attempts,
                    });
                  }
                }
              }
            } else {
              logStep("Subscription in non-retryable state", {
                subscriptionId: retry.stripe_subscription_id,
                status: subscription.status,
              });
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logStep("Error retrying subscription payment", {
              subscriptionId: retry.stripe_subscription_id,
              error: errorMessage,
            });
            
            // Record the failure
            await recordPaymentFailure(supabase, {
              userId: retry.user_id,
              stripeSubscriptionId: retry.stripe_subscription_id,
              error: errorMessage,
              maxAttempts: retry.max_attempts,
            });
            results.failed++;
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logStep("Error processing retry", {
          retryId: retry.id,
          error: errorMessage,
        });
        results.errors.push(`Retry ${retry.id}: ${errorMessage}`);
      }
    }

    logStep("Payment retry processing complete", results);

    return new Response(JSON.stringify({
      success: true,
      results,
    }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in process-payment-retries", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
