import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

/**
 * Calculate next retry time using exponential backoff
 * @param attemptNumber Current attempt number (1-based)
 * @returns Date object for next retry
 */
export function calculateNextRetry(attemptNumber: number): Date {
  // Exponential backoff: 2^(attempt-1) minutes
  // Attempt 1: 1 minute
  // Attempt 2: 2 minutes
  // Attempt 3: 4 minutes
  // Attempt 4: 8 minutes
  // Attempt 5: 16 minutes
  const baseDelayMinutes = Math.pow(2, attemptNumber - 1);
  const delayMs = baseDelayMinutes * 60 * 1000;
  
  return new Date(Date.now() + delayMs);
}

/**
 * Record a payment failure and schedule retry
 */
export async function recordPaymentFailure(
  supabase: SupabaseClient,
  params: {
    userId: string;
    stripePaymentIntentId?: string;
    stripeSubscriptionId?: string;
    error: string;
    maxAttempts?: number;
  }
): Promise<{ success: boolean; retryId?: string; nextRetryAt?: Date }> {
  const { userId, stripePaymentIntentId, stripeSubscriptionId, error, maxAttempts = 5 } = params;

  // Check if there's an existing retry attempt for this payment
  const { data: existingAttempt } = await supabase
    .from("payment_retry_attempts")
    .select("*")
    .eq("user_id", userId)
    .or(
      stripePaymentIntentId
        ? `stripe_payment_intent_id.eq.${stripePaymentIntentId}`
        : `stripe_subscription_id.eq.${stripeSubscriptionId}`
    )
    .in("status", ["pending", "retrying"])
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  let attemptNumber = 1;
  let retryId: string;

  if (existingAttempt) {
    // Increment attempt number
    attemptNumber = existingAttempt.attempt_number + 1;

    if (attemptNumber > maxAttempts) {
      // Max attempts reached, mark as failed
      await supabase
        .from("payment_retry_attempts")
        .update({
          status: "failed",
          last_error: error,
          next_retry_at: null,
        })
        .eq("id", existingAttempt.id);

      return { success: false };
    }

    // Update existing attempt
    const nextRetryAt = calculateNextRetry(attemptNumber);
    const { data: updated } = await supabase
      .from("payment_retry_attempts")
      .update({
        attempt_number: attemptNumber,
        status: "retrying",
        last_error: error,
        next_retry_at: nextRetryAt.toISOString(),
      })
      .eq("id", existingAttempt.id)
      .select()
      .single();

    retryId = existingAttempt.id;
    return { success: true, retryId, nextRetryAt };
  } else {
    // Create new retry attempt
    const nextRetryAt = calculateNextRetry(attemptNumber);
    const { data: newAttempt, error: insertError } = await supabase
      .from("payment_retry_attempts")
      .insert({
        user_id: userId,
        stripe_payment_intent_id: stripePaymentIntentId,
        stripe_subscription_id: stripeSubscriptionId,
        attempt_number: attemptNumber,
        max_attempts: maxAttempts,
        status: "retrying",
        last_error: error,
        next_retry_at: nextRetryAt.toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating payment retry attempt:", insertError);
      return { success: false };
    }

    retryId = newAttempt.id;
    return { success: true, retryId, nextRetryAt };
  }
}

/**
 * Mark a payment retry as succeeded
 */
export async function markPaymentRetrySuccess(
  supabase: SupabaseClient,
  params: {
    userId: string;
    stripePaymentIntentId?: string;
    stripeSubscriptionId?: string;
  }
): Promise<void> {
  const { userId, stripePaymentIntentId, stripeSubscriptionId } = params;

  await supabase
    .from("payment_retry_attempts")
    .update({
      status: "succeeded",
      next_retry_at: null,
    })
    .eq("user_id", userId)
    .or(
      stripePaymentIntentId
        ? `stripe_payment_intent_id.eq.${stripePaymentIntentId}`
        : `stripe_subscription_id.eq.${stripeSubscriptionId}`
    )
    .in("status", ["pending", "retrying"]);
}

/**
 * Get pending retries that are ready to be processed
 */
export async function getPendingRetries(
  supabase: SupabaseClient
): Promise<any[]> {
  const { data, error } = await supabase
    .from("payment_retry_attempts")
    .select("*")
    .eq("status", "retrying")
    .lte("next_retry_at", new Date().toISOString())
    .order("next_retry_at", { ascending: true });

  if (error) {
    console.error("Error fetching pending retries:", error);
    return [];
  }

  return data || [];
}
