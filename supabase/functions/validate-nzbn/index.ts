import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[VALIDATE-NZBN] ${step}${detailsStr}`);
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const env = (Deno.env.get("NZBN_ENVIRONMENT") || "sandbox").toLowerCase();
    const isProd = env === "production";
    const subscriptionKey = isProd
      ? Deno.env.get("NZBN_SUBSCRIPTION_KEY_PRODUCTION")
      : Deno.env.get("NZBN_SUBSCRIPTION_KEY_SANDBOX");

    if (!subscriptionKey) {
      log("Missing NZBN subscription key", { env });
      return json({ error: "Verification service not configured", code: "CONFIG_ERROR" }, 500);
    }

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401);
    }
    const token = authHeader.replace("Bearer ", "");

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return json({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401);
    }
    const userId = userData.user.id;

    // Parse + validate body
    let body: { nzbn?: unknown };
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body", code: "INVALID_BODY" }, 400);
    }
    const rawNzbn = String(body?.nzbn ?? "").replace(/\D/g, "");
    if (rawNzbn.length !== 13) {
      return json(
        { error: "NZBN must be exactly 13 digits", code: "INVALID_NZBN" },
        400,
      );
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Look up contractor profile
    const { data: contractor, error: cpErr } = await serviceClient
      .from("contractor_profiles")
      .select("id, user_id, verification_status, company_name")
      .eq("user_id", userId)
      .maybeSingle();

    if (cpErr || !contractor) {
      log("No contractor profile", { userId });
      return json(
        {
          error: "Complete your company profile before verifying",
          code: "NO_CONTRACTOR_PROFILE",
        },
        403,
      );
    }

    if (contractor.verification_status === "verified") {
      return json(
        { error: "Your company is already verified", code: "ALREADY_VERIFIED" },
        400,
      );
    }

    // Check NZBN not already claimed by another contractor
    const { data: existingNzbn } = await serviceClient
      .from("contractor_profiles")
      .select("id, user_id")
      .eq("nzbn", rawNzbn)
      .neq("user_id", userId)
      .maybeSingle();

    if (existingNzbn) {
      return json(
        {
          error: "This NZBN is already registered to another company on Workie",
          code: "NZBN_TAKEN",
        },
        409,
      );
    }

    // Call MBIE NZBN API
    // Per https://portal.api.business.govt.nz: prod uses /gateway/, sandbox uses /sandbox/
    const baseUrl = isProd
      ? "https://api.business.govt.nz/gateway/nzbn/v5/entities"
      : "https://api.business.govt.nz/sandbox/nzbn/v5/entities";
    const apiUrl = `${baseUrl}/${rawNzbn}`;

    log("Calling NZBN API", { env, nzbn: rawNzbn });
    let nzbnRes: Response;
    try {
      nzbnRes = await fetch(apiUrl, {
        method: "GET",
        headers: {
          "Ocp-Apim-Subscription-Key": subscriptionKey,
          Accept: "application/json",
        },
      });
    } catch (e) {
      log("NZBN API network error", { error: String(e) });
      return json(
        { error: "Could not reach the NZBN service. Please try again.", code: "UPSTREAM_UNREACHABLE" },
        502,
      );
    }

    if (nzbnRes.status === 404) {
      return json(
        { error: "No business found with this NZBN. Please check the number.", code: "NOT_FOUND" },
        404,
      );
    }

    if (nzbnRes.status === 401 || nzbnRes.status === 403) {
      const text = await nzbnRes.text();
      log("NZBN API auth error", { status: nzbnRes.status, body: text.slice(0, 300) });
      return json(
        {
          error:
            "Verification service is misconfigured (invalid NZBN subscription key). Please contact support.",
          code: "UPSTREAM_AUTH_ERROR",
        },
        500,
      );
    }

    if (nzbnRes.status === 429) {
      return json(
        { error: "Too many verification attempts. Please try again in a moment.", code: "RATE_LIMITED" },
        429,
      );
    }

    if (!nzbnRes.ok) {
      const text = await nzbnRes.text();
      log("NZBN API error", { status: nzbnRes.status, body: text.slice(0, 300) });
      return json(
        { error: "NZBN service is temporarily unavailable. Please try again.", code: "UPSTREAM_ERROR" },
        502,
      );
    }

    const nzbnData = await nzbnRes.json();
    const entityName: string =
      nzbnData?.entityName || nzbnData?.tradingNames?.[0]?.name || "Unknown";
    const entityStatusCode: string = String(nzbnData?.entityStatusCode ?? "");
    const entityStatusDescription: string = String(
      nzbnData?.entityStatusDescription ?? nzbnData?.entityStatus ?? "",
    );

    // Active/registered codes: per MBIE, "50" Registered, "60" Active
    // Also accept any status description containing "registered" or "active"
    const activeCodes = new Set(["50", "60"]);
    const isActive =
      activeCodes.has(entityStatusCode) ||
      /registered|active/i.test(entityStatusDescription);

    if (!isActive) {
      log("Entity not active", { entityStatusCode, entityStatusDescription });
      // Mark rejected
      await serviceClient
        .from("contractor_profiles")
        .update({
          verification_status: "rejected",
          nzbn: rawNzbn,
          nzbn_data: nzbnData,
          verification_date: new Date().toISOString(),
        })
        .eq("user_id", userId);

      return json(
        {
          error: `This business is not currently active on the NZBN Register (${entityStatusDescription || entityStatusCode || "unknown status"}).`,
          code: "NOT_ACTIVE",
          entityName,
        },
        400,
      );
    }

    // Verified — persist
    const { error: updErr } = await serviceClient
      .from("contractor_profiles")
      .update({
        nzbn: rawNzbn,
        verification_status: "verified",
        verification_date: new Date().toISOString(),
        nzbn_data: nzbnData,
      })
      .eq("user_id", userId);

    if (updErr) {
      log("Update error", { error: updErr.message });
      // Unique-violation safety net
      if (updErr.code === "23505") {
        return json(
          { error: "This NZBN is already registered to another company.", code: "NZBN_TAKEN" },
          409,
        );
      }
      return json(
        { error: "Failed to save verification. Please try again.", code: "UPDATE_FAILED" },
        500,
      );
    }

    log("Verified", { userId, entityName });

    return json({
      success: true,
      code: "VERIFIED",
      entityName,
      nzbn: rawNzbn,
      verifiedAt: new Date().toISOString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("Unhandled error", { error: msg });
    return json({ error: "Internal error", code: "INTERNAL_ERROR" }, 500);
  }
});
