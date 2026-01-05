import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION-EXPIRY] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Cron job started");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Find subscriptions expiring in the next 3 days
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const oneDayFromNow = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);

    const { data: expiringSubscriptions, error } = await supabaseAdmin
      .from("subscriptions")
      .select("id, user_id, plan_name, ends_at")
      .eq("status", "active")
      .gte("ends_at", now.toISOString())
      .lte("ends_at", threeDaysFromNow.toISOString());

    if (error) {
      throw new Error(`Failed to fetch subscriptions: ${error.message}`);
    }

    logStep("Found expiring subscriptions", { count: expiringSubscriptions?.length || 0 });

    if (!expiringSubscriptions || expiringSubscriptions.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: "No expiring subscriptions found" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    let emailsSent = 0;
    let errors: string[] = [];

    for (const sub of expiringSubscriptions) {
      try {
        // Get user email and name
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("email, full_name, first_name")
          .eq("user_id", sub.user_id)
          .single();

        if (!profile?.email) {
          logStep("No email found for user", { userId: sub.user_id });
          continue;
        }

        // Check if we already sent a notification today for this subscription
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const { data: existingNotification } = await supabaseAdmin
          .from("notifications")
          .select("id")
          .eq("user_id", sub.user_id)
          .eq("type", "subscription_expiry")
          .gte("created_at", todayStart.toISOString())
          .maybeSingle();

        if (existingNotification) {
          logStep("Notification already sent today", { userId: sub.user_id });
          continue;
        }

        // Calculate days remaining
        const expiryDate = new Date(sub.ends_at);
        const daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        // Send email via send-subscription-email function
        const { error: invokeError } = await supabaseAdmin.functions.invoke("send-subscription-email", {
          body: {
            type: "expiry_reminder",
            userId: sub.user_id,
            email: profile.email,
            name: profile.first_name || profile.full_name,
            planName: sub.plan_name,
            expiryDate: expiryDate.toLocaleDateString("en-NZ", { 
              weekday: "long", 
              year: "numeric", 
              month: "long", 
              day: "numeric" 
            }),
            daysRemaining,
          },
        });

        if (invokeError) {
          errors.push(`User ${sub.user_id}: ${invokeError.message}`);
          logStep("Error sending email", { userId: sub.user_id, error: invokeError.message });
        } else {
          emailsSent++;
          logStep("Expiry reminder sent", { userId: sub.user_id, daysRemaining });
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        errors.push(`User ${sub.user_id}: ${errMsg}`);
        logStep("Error processing subscription", { userId: sub.user_id, error: errMsg });
      }
    }

    logStep("Cron job completed", { emailsSent, errors: errors.length });

    return new Response(JSON.stringify({ 
      success: true, 
      emailsSent,
      errorsCount: errors.length,
      errors: errors.length > 0 ? errors : undefined,
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
