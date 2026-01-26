/**
 * Example Edge Function using Auth Middleware
 * 
 * This file demonstrates how to use the auth middleware in Edge Functions.
 * Copy this pattern to other Edge Functions that require authentication.
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  authenticateRequest,
  createAuthErrorResponse,
  createServiceClient,
  logAuthEvent,
  AuthenticationError,
} from "./auth-middleware.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabaseClient = createServiceClient();

    // Authenticate request with middleware
    const auth = await authenticateRequest(req, supabaseClient, {
      requireAuth: true,
      checkExpiration: true,
      expirationBuffer: 300, // 5 minutes
    });

    // Log successful authentication
    logAuthEvent("success", {
      userId: auth.user.id,
      email: auth.user.email,
      expiresAt: new Date(auth.expiresAt * 1000).toISOString(),
    });

    // Your function logic here
    // You now have access to auth.user, auth.token, auth.expiresAt

    return new Response(
      JSON.stringify({
        success: true,
        user_id: auth.user.id,
        message: "Authenticated successfully",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    // Handle authentication errors
    if (error instanceof AuthenticationError) {
      logAuthEvent("failure", {
        code: error.code,
        message: error.message,
      });
      return createAuthErrorResponse(error, corsHeaders);
    }

    // Handle other errors
    console.error("[Function] Error:", error);
    return new Response(
      JSON.stringify({
        error: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "An error occurred",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
