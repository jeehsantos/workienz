import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ConfirmationEmailRequest {
  email: string;
  firstName: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, firstName }: ConfirmationEmailRequest = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Processing confirmation email for:", email);

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Get the origin for redirect URL
    const origin = req.headers.get("origin") || "https://workienz.lovable.app";

    // Generate email confirmation link using Supabase - use magiclink type for email verification
    const { data, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: email,
      options: {
        redirectTo: `${origin}/verify-email`,
      },
    });

    if (linkError) {
      console.error("Error generating confirmation link:", linkError);
      return new Response(
        JSON.stringify({ error: "Failed to generate confirmation link" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const confirmationLink = data.properties?.action_link;

    if (!confirmationLink) {
      console.error("No action link generated");
      return new Response(
        JSON.stringify({ error: "Failed to generate confirmation link" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("Sending confirmation email via Resend");

    const displayName = firstName || "there";

    // Send email via Resend
    const emailResponse = await resend.emails.send({
      from: "Workie <onboarding@resend.dev>",
      to: [email],
      subject: "Activate Your Account - Workie",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Activate Your Account</title>
          </head>
          <body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
            <table role="presentation" style="width: 100%; border-collapse: collapse;">
              <tr>
                <td align="center" style="padding: 40px 20px;">
                  <table role="presentation" style="width: 100%; max-width: 480px; border-collapse: collapse;">
                    <!-- Logo -->
                    <tr>
                      <td align="center" style="padding-bottom: 24px;">
                        <div style="display: inline-flex; align-items: center; gap: 8px;">
                            <img src="https://workienz.lovable.app/workie-logo.png" alt="Workie" style="height: 25px; width: 195px; object-fit: contain;" width="195" height="25" />
                        </div>
                      </td>
                    </tr>
                    <!-- Card -->
                    <tr>
                      <td style="background-color: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                        <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: bold; color: #18181b; text-align: center;">
                          Activate Your Account
                        </h1>
                        <p style="margin: 0 0 8px 0; font-size: 16px; color: #18181b; text-align: center; line-height: 1.5;">
                          Hi ${displayName},
                        </p>
                        <p style="margin: 0 0 24px 0; font-size: 16px; color: #71717a; text-align: center; line-height: 1.5;">
                          Welcome to Workie! Click the button below to verify your email address and start your journey.
                        </p>
                        <table role="presentation" style="width: 100%; border-collapse: collapse;">
                          <tr>
                            <td align="center" style="padding: 8px 0 24px 0;">
                              <a href="${confirmationLink}" 
                                 style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #22c55e, #16a34a); color: white; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px; box-shadow: 0 4px 14px -3px rgba(34, 197, 94, 0.5);">
                                Activate Account
                              </a>
                            </td>
                          </tr>
                        </table>
                        <p style="margin: 0 0 16px 0; font-size: 14px; color: #a1a1aa; text-align: center;">
                          This link will expire in 24 hours.
                        </p>
                        <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;">
                        <p style="margin: 0; font-size: 13px; color: #a1a1aa; text-align: center; line-height: 1.5;">
                          If you didn't create an account on Workie, you can safely ignore this email.
                        </p>
                      </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                      <td style="padding-top: 24px; text-align: center;">
                        <p style="margin: 0; font-size: 13px; color: #a1a1aa;">
                          © 2026 Workie. All rights reserved.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
    });

    console.log("Confirmation email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, message: "Confirmation email sent successfully" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in send-confirmation-email function:", error);
    return new Response(JSON.stringify({ error: error.message || "An error occurred" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
