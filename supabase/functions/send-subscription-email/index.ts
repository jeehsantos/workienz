import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-SUBSCRIPTION-EMAIL] ${step}${detailsStr}`);
};

interface EmailRequest {
  type: "welcome" | "expiry_reminder";
  userId: string;
  email: string;
  name?: string;
  planName?: string;
  expiryDate?: string;
  daysRemaining?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const { type, userId, email, name, planName, expiryDate, daysRemaining }: EmailRequest = await req.json();
    logStep("Request received", { type, email, planName });

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    let subject = "";
    let htmlContent = "";

    if (type === "welcome") {
      subject = `Welcome to Workie ${planName ? `- ${planName}` : ""}!`;
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
            <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 40px 24px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to Workie! 🎉</h1>
            </div>
            <div style="padding: 32px 24px;">
              <p style="font-size: 16px; color: #333; margin-bottom: 16px;">
                Hi ${name || "there"},
              </p>
              <p style="font-size: 16px; color: #555; margin-bottom: 24px;">
                Your <strong style="color: #6366f1;">${planName || "subscription"}</strong> is now active! 
                You now have full access to all the features included in your plan.
              </p>
              <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px 0; color: #333;">What's Next?</h3>
                <ul style="margin: 0; padding-left: 20px; color: #555;">
                  <li style="margin-bottom: 8px;">Complete your profile to stand out</li>
                  <li style="margin-bottom: 8px;">Explore available opportunities</li>
                  <li style="margin-bottom: 8px;">Connect with employers or workers</li>
                </ul>
              </div>
              <a href="https://workie.co.nz/dashboard" style="display: inline-block; background: #6366f1; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; margin-bottom: 24px;">
                Go to Dashboard
              </a>
              <p style="font-size: 14px; color: #888; margin-top: 24px;">
                Need help? Reply to this email or visit our help center.
              </p>
            </div>
            <div style="background: #f8f9fa; padding: 20px 24px; text-align: center; border-top: 1px solid #eee;">
              <p style="margin: 0; font-size: 12px; color: #888;">
                © ${new Date().getFullYear()} Workie. All rights reserved.
              </p>
            </div>
          </div>
        </body>
        </html>
      `;

      // Also create an in-app notification
      await supabaseAdmin.from("notifications").insert({
        user_id: userId,
        type: "subscription_welcome",
        title: "Welcome to Workie!",
        message: `Your ${planName || "subscription"} is now active. Enjoy all the benefits!`,
        action_url: "/dashboard",
        metadata: { plan_name: planName },
      });
      logStep("Created welcome notification");

    } else if (type === "expiry_reminder") {
      subject = `Your Workie subscription expires in ${daysRemaining} days`;
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
            <div style="background: linear-gradient(135deg, #f59e0b, #ef4444); padding: 40px 24px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">Subscription Expiring Soon ⚠️</h1>
            </div>
            <div style="padding: 32px 24px;">
              <p style="font-size: 16px; color: #333; margin-bottom: 16px;">
                Hi ${name || "there"},
              </p>
              <p style="font-size: 16px; color: #555; margin-bottom: 24px;">
                Your <strong style="color: #6366f1;">${planName || "subscription"}</strong> will expire on 
                <strong>${expiryDate}</strong> (in ${daysRemaining} days).
              </p>
              <div style="background: #fef3c7; border-radius: 8px; padding: 20px; margin-bottom: 24px; border-left: 4px solid #f59e0b;">
                <p style="margin: 0; color: #92400e;">
                  To continue enjoying all your benefits without interruption, renew your subscription before it expires.
                </p>
              </div>
              <a href="https://workie.co.nz/subscription" style="display: inline-block; background: #6366f1; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; margin-bottom: 24px;">
                Renew Subscription
              </a>
              <p style="font-size: 14px; color: #888; margin-top: 24px;">
                Questions? Reply to this email and we'll help you out.
              </p>
            </div>
            <div style="background: #f8f9fa; padding: 20px 24px; text-align: center; border-top: 1px solid #eee;">
              <p style="margin: 0; font-size: 12px; color: #888;">
                © ${new Date().getFullYear()} Workie. All rights reserved.
              </p>
            </div>
          </div>
        </body>
        </html>
      `;

      // Also create an in-app notification
      await supabaseAdmin.from("notifications").insert({
        user_id: userId,
        type: "subscription_expiry",
        title: "Subscription Expiring Soon",
        message: `Your ${planName || "subscription"} expires in ${daysRemaining} days. Renew to keep your benefits.`,
        action_url: "/subscription",
        metadata: { plan_name: planName, days_remaining: daysRemaining, expiry_date: expiryDate },
      });
      logStep("Created expiry reminder notification");
    }

    const emailResponse = await resend.emails.send({
      from: "Workie <noreply@workie.co.nz>",
      to: [email],
      subject,
      html: htmlContent,
    });

    logStep("Email sent successfully", { emailId: emailResponse.data?.id });

    return new Response(JSON.stringify({ success: true, emailId: emailResponse.data?.id }), {
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
