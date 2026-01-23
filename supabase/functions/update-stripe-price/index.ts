import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[update-stripe-price] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Initialize Supabase client with service role key for admin operations
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify admin role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user) {
      throw new Error("Authentication failed");
    }

    // Check if user is admin
    const { data: roles } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin");

    if (!roles || roles.length === 0) {
      throw new Error("Access denied: Admin role required");
    }

    logStep("Admin verified", { userId: userData.user.id });

    const requestBody = await req.json();
    const { action, planId, newPriceCents, comingSoon, hidden } = requestBody;

    logStep("Request received", { action, planId, newPriceCents, comingSoon, hidden });

    // Handle coming soon toggle
    if (action === "toggle_coming_soon") {
      const { error: updateError } = await supabaseClient
        .from("plan_products")
        .update({ coming_soon: comingSoon })
        .eq("plan_id", planId);

      if (updateError) {
        throw new Error(`Failed to update coming_soon status: ${updateError.message}`);
      }

      logStep("Coming soon status updated", { planId, comingSoon });

      return new Response(
        JSON.stringify({ success: true, message: "Coming soon status updated" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Handle hidden toggle
    if (action === "toggle_hidden") {
      const { error: updateError } = await supabaseClient
        .from("plan_products")
        .update({ hidden: hidden })
        .eq("plan_id", planId);

      if (updateError) {
        throw new Error(`Failed to update hidden status: ${updateError.message}`);
      }

      logStep("Hidden status updated", { planId, hidden });

      return new Response(
        JSON.stringify({ success: true, message: "Hidden status updated" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Handle price update
    if (action === "update_price") {
      if (!planId || typeof newPriceCents !== "number" || newPriceCents <= 0) {
        throw new Error("Invalid parameters: planId and valid newPriceCents required");
      }

      // Get current plan details
      const { data: plan, error: planError } = await supabaseClient
        .from("plan_products")
        .select("*")
        .eq("plan_id", planId)
        .single();

      if (planError || !plan) {
        throw new Error(`Plan not found: ${planError?.message}`);
      }

      logStep("Current plan fetched", { plan });

      // Initialize Stripe
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (!stripeKey) {
        throw new Error("STRIPE_SECRET_KEY not configured");
      }

      const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

      // Check if product exists in Stripe
      let stripeProductId = plan.stripe_product_id;
      if (!stripeProductId) {
        // Create product in Stripe
        const product = await stripe.products.create({
          name: plan.plan_name,
          description: plan.description || undefined,
        });
        stripeProductId = product.id;
        logStep("Created Stripe product", { productId: stripeProductId });
      }

      // Create new price in Stripe
      const recurring = plan.interval && plan.interval !== "one_time" 
        ? { interval: plan.interval === "quarter" ? "month" : plan.interval, interval_count: plan.interval === "quarter" ? 3 : 1 }
        : undefined;

      const newPrice = await stripe.prices.create({
        product: stripeProductId,
        unit_amount: newPriceCents,
        currency: "nzd",
        recurring: recurring as Stripe.PriceCreateParams.Recurring | undefined,
      });

      logStep("Created new Stripe price", { priceId: newPrice.id });

      // Deactivate old price if exists
      if (plan.stripe_price_id) {
        await stripe.prices.update(plan.stripe_price_id, { active: false });
        logStep("Deactivated old Stripe price", { oldPriceId: plan.stripe_price_id });
      }

      // Update database with new price info
      const { error: updateError } = await supabaseClient
        .from("plan_products")
        .update({
          price_cents: newPriceCents,
          stripe_price_id: newPrice.id,
          stripe_product_id: stripeProductId,
        })
        .eq("plan_id", planId);

      if (updateError) {
        throw new Error(`Failed to update database: ${updateError.message}`);
      }

      logStep("Database updated successfully");

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Price updated successfully",
          newPriceId: newPrice.id,
          newPriceCents
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    throw new Error("Invalid action specified");

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
