import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

// Map plan IDs to their Stripe configuration
const planConfig: Record<string, { mode: "payment" | "subscription"; interval?: string }> = {
  single_post: { mode: "payment" },
  "14_day_sprint": { mode: "payment" },
  monthly_contractor: { mode: "subscription", interval: "month" },
  quarterly_contractor: { mode: "subscription", interval: "month" }, // 3 months
  free_seeker: { mode: "payment" },
  weekly_seeker: { mode: "subscription", interval: "week" },
  monthly_seeker: { mode: "subscription", interval: "month" },
  quarterly_seeker: { mode: "subscription", interval: "month" }, // 3 months
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
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
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

    const { planId, applyCredit, creditAmount, entitlementsToDeactivate } = await req.json();
    if (!planId) throw new Error("Plan ID is required");
    logStep("Plan ID received", { planId, applyCredit, creditAmount });

    // Get plan details from database
    const { data: planData, error: planError } = await supabaseClient
      .from("plan_products")
      .select("*")
      .eq("plan_id", planId)
      .single();

    if (planError || !planData) {
      throw new Error("Plan not found");
    }
    logStep("Plan details fetched", { planName: planData.plan_name, price: planData.price_cents });

    // Initialize Stripe
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    }

    const origin = req.headers.get("origin") || "https://localhost:5173";
    const config = planConfig[planId] || { mode: "payment" };

    // Create or get a price for this plan
    let stripePrice: Stripe.Price;

    if (planData.stripe_price_id) {
      // Use existing Stripe price
      stripePrice = await stripe.prices.retrieve(planData.stripe_price_id);
      logStep("Using existing Stripe price", { priceId: stripePrice.id });
    } else {
      // Create a product and price on the fly
      const product = await stripe.products.create({
        name: planData.plan_name,
        description: planData.description || undefined,
        metadata: {
          plan_id: planId,
          plan_type: planData.plan_type,
        },
      });
      logStep("Created Stripe product", { productId: product.id });

      const priceData: Stripe.PriceCreateParams = {
        product: product.id,
        unit_amount: planData.price_cents,
        currency: "nzd",
      };

      if (config.mode === "subscription" && config.interval) {
        priceData.recurring = {
          interval: config.interval as "week" | "month" | "year",
          interval_count: planId.includes("quarterly") ? 3 : 1,
        };
      }

      stripePrice = await stripe.prices.create(priceData);
      logStep("Created Stripe price", { priceId: stripePrice.id });

      // Update the plan with the Stripe IDs (using service role for this)
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { persistSession: false } }
      );

      await supabaseAdmin
        .from("plan_products")
        .update({
          stripe_product_id: product.id,
          stripe_price_id: stripePrice.id,
        })
        .eq("plan_id", planId);
      logStep("Updated plan with Stripe IDs");
    }

    // Create checkout session
    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: stripePrice.id,
          quantity: 1,
        },
      ],
      mode: config.mode,
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout?plan=${planId}`,
      metadata: {
        user_id: user.id,
        plan_id: planId,
        plan_name: planData.plan_name,
        plan_type: planData.plan_type,
        entitlements_to_deactivate: entitlementsToDeactivate?.join(",") || "",
      },
    };

    // Apply coupon for subscriptions if credit is available
    if (applyCredit && creditAmount && creditAmount > 0 && config.mode === "subscription") {
      logStep("Creating one-time coupon for subscription credit", { creditAmount });
      
      const coupon = await stripe.coupons.create({
        amount_off: creditAmount,
        currency: "nzd",
        duration: "once",
        name: "Unused Plan Credit",
        max_redemptions: 1,
      });

      sessionConfig.discounts = [{ coupon: coupon.id }];
      logStep("Coupon created and applied", { couponId: coupon.id });
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);
    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-checkout-session", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
