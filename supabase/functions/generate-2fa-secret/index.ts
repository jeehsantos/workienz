import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base32Encode } from "https://deno.land/std@0.190.0/encoding/base32.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate a random secret for TOTP
function generateSecret(): string {
  const array = new Uint8Array(20);
  crypto.getRandomValues(array);
  return base32Encode(array).replace(/=/g, "");
}

// Generate backup codes
function generateBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 10; i++) {
    const array = new Uint8Array(4);
    crypto.getRandomValues(array);
    const code = Array.from(array)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
    codes.push(code.slice(0, 4) + "-" + code.slice(4, 8));
  }
  return codes;
}

// Generate TOTP URI for QR code
function generateTotpUri(secret: string, email: string, issuer: string = "Workie"): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create Supabase client with user's token
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("User error:", userError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Generating 2FA secret for user:", user.id);

    // Generate secret and backup codes
    const secret = generateSecret();
    const backupCodes = generateBackupCodes();
    const totpUri = generateTotpUri(secret, user.email || "user");

    // Store the secret temporarily (not enabled yet until verified)
    // We'll use admin client to update the profile
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        two_factor_secret: secret,
        two_factor_backup_codes: backupCodes,
        two_factor_enabled: false, // Not enabled until verified
      })
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Error storing 2FA secret:", updateError);
      return new Response(JSON.stringify({ error: "Failed to generate 2FA secret" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("2FA secret generated successfully");

    return new Response(
      JSON.stringify({
        secret,
        totpUri,
        backupCodes,
        qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(totpUri)}`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("Error in generate-2fa-secret:", error);
    return new Response(JSON.stringify({ error: error.message || "An error occurred" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
