import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode as base32Decode } from "https://deno.land/std@0.190.0/encoding/base32.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// TOTP implementation
async function generateTotp(secret: string, counter: number): Promise<string> {
  // Decode base32 secret and ensure proper padding
  const paddedSecret = secret + "======".slice(0, (8 - (secret.length % 8)) % 8);
  const secretBytes = base32Decode(paddedSecret);
  
  // Convert counter to 8-byte buffer
  const counterBuffer = new ArrayBuffer(8);
  const counterView = new DataView(counterBuffer);
  counterView.setBigUint64(0, BigInt(counter), false);

  // Import key and create HMAC - use ArrayBuffer directly
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes.buffer as ArrayBuffer,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );

  const hmac = await crypto.subtle.sign("HMAC", key, counterBuffer);
  const hmacArray = new Uint8Array(hmac);

  // Dynamic truncation
  const offset = hmacArray[hmacArray.length - 1] & 0x0f;
  const code =
    ((hmacArray[offset] & 0x7f) << 24) |
    ((hmacArray[offset + 1] & 0xff) << 16) |
    ((hmacArray[offset + 2] & 0xff) << 8) |
    (hmacArray[offset + 3] & 0xff);

  return (code % 1000000).toString().padStart(6, "0");
}

async function verifyTotp(secret: string, code: string, window: number = 1): Promise<boolean> {
  const counter = Math.floor(Date.now() / 30000);
  
  for (let i = -window; i <= window; i++) {
    const expectedCode = await generateTotp(secret, counter + i);
    if (expectedCode === code) {
      return true;
    }
  }
  return false;
}

interface VerifyRequest {
  code: string;
  userId?: string; // For login verification
  enableSetup?: boolean; // For initial setup verification
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code, userId, enableSetup }: VerifyRequest = await req.json();

    if (!code) {
      return new Response(
        JSON.stringify({ error: "Code is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    let targetUserId = userId;

    // If no userId provided, get from auth header
    if (!targetUserId) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: "No authorization header or userId" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: authHeader } } }
      );

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      targetUserId = user.id;
    }

    console.log("Verifying 2FA code for user:", targetUserId);

    // Get user's 2FA secret and backup codes
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("two_factor_secret, two_factor_backup_codes, two_factor_enabled")
      .eq("user_id", targetUserId)
      .single();

    if (profileError || !profile) {
      console.error("Profile error:", profileError);
      return new Response(
        JSON.stringify({ error: "User profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!profile.two_factor_secret) {
      return new Response(
        JSON.stringify({ error: "2FA is not set up for this user" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // First, try TOTP verification
    const isValidTotp = await verifyTotp(profile.two_factor_secret, code);

    if (isValidTotp) {
      console.log("TOTP code verified successfully");
      
      // If this is setup verification, enable 2FA
      if (enableSetup && !profile.two_factor_enabled) {
        const { error: enableError } = await supabaseAdmin
          .from("profiles")
          .update({ two_factor_enabled: true })
          .eq("user_id", targetUserId);

        if (enableError) {
          console.error("Error enabling 2FA:", enableError);
          return new Response(
            JSON.stringify({ error: "Failed to enable 2FA" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        return new Response(
          JSON.stringify({ verified: true, message: "2FA enabled successfully" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ verified: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try backup code verification (format: XXXX-XXXX)
    const normalizedCode = code.toUpperCase().replace(/\s/g, "");
    const backupCodes = profile.two_factor_backup_codes || [];
    const codeIndex = backupCodes.findIndex(
      (bc: string) => bc.replace(/-/g, "") === normalizedCode.replace(/-/g, "")
    );

    if (codeIndex !== -1) {
      console.log("Backup code used successfully");
      
      // Remove used backup code
      const updatedCodes = [...backupCodes];
      updatedCodes.splice(codeIndex, 1);
      
      const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .update({ two_factor_backup_codes: updatedCodes })
        .eq("user_id", targetUserId);

      if (updateError) {
        console.error("Error removing backup code:", updateError);
      }

      return new Response(
        JSON.stringify({ 
          verified: true, 
          usedBackupCode: true,
          remainingBackupCodes: updatedCodes.length 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Invalid 2FA code");
    return new Response(
      JSON.stringify({ verified: false, error: "Invalid code" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in verify-2fa-code:", error);
    return new Response(
      JSON.stringify({ error: error.message || "An error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
