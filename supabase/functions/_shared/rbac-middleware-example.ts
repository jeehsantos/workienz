/**
 * Example Edge Functions using RBAC Middleware
 * 
 * This file demonstrates various patterns for using role-based access control
 * in Supabase Edge Functions. Copy these patterns to implement RBAC in your functions.
 * 
 * Requirements: 2.4
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  createServiceClient,
  createAuthErrorResponse,
  createAuthzErrorResponse,
  AuthenticationError,
  AuthorizationError,
  // RBAC functions
  requireAdmin,
  requireContractor,
  requireEmployee,
  requireWriter,
  requireContractorOrAdmin,
  authenticateWithRoles,
} from "./auth-middleware.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// EXAMPLE 1: Admin-only endpoint
// ============================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createServiceClient();

    // Require admin role - will throw AuthorizationError if user is not admin
    const auth = await requireAdmin(req, supabaseClient);

    console.log(`[Admin Endpoint] Admin user ${auth.user.id} accessed endpoint`);
    console.log(`[Admin Endpoint] User roles:`, auth.roles);

    // Your admin-only logic here
    return new Response(
      JSON.stringify({
        success: true,
        message: "Admin access granted",
        user_id: auth.user.id,
        roles: auth.roles,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    // Handle authentication errors
    if (error instanceof AuthenticationError) {
      return createAuthErrorResponse(error, corsHeaders);
    }

    // Handle authorization errors
    if (error instanceof AuthorizationError) {
      return createAuthzErrorResponse(error, corsHeaders);
    }

    // Handle other errors
    console.error("[Admin Endpoint] Error:", error);
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

// ============================================================================
// EXAMPLE 2: Contractor-only endpoint
// ============================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createServiceClient();

    // Require contractor role
    const auth = await requireContractor(req, supabaseClient);

    console.log(`[Contractor Endpoint] Contractor ${auth.user.id} accessed endpoint`);

    // Your contractor-only logic here
    return new Response(
      JSON.stringify({
        success: true,
        message: "Contractor access granted",
        user_id: auth.user.id,
        roles: auth.roles,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return createAuthErrorResponse(error, corsHeaders);
    }
    if (error instanceof AuthorizationError) {
      return createAuthzErrorResponse(error, corsHeaders);
    }
    console.error("[Contractor Endpoint] Error:", error);
    return new Response(
      JSON.stringify({ error: "INTERNAL_ERROR", message: String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

// ============================================================================
// EXAMPLE 3: Contractor or Admin endpoint (common pattern)
// ============================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createServiceClient();

    // Allow contractors or admins
    const auth = await requireContractorOrAdmin(req, supabaseClient);

    console.log(`[Contractor/Admin Endpoint] User ${auth.user.id} accessed endpoint`);
    console.log(`[Contractor/Admin Endpoint] User roles:`, auth.roles);

    // Your logic here - can check specific role if needed
    const isAdmin = auth.roles.includes("admin");
    const isContractor = auth.roles.includes("contractor");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Access granted",
        user_id: auth.user.id,
        roles: auth.roles,
        is_admin: isAdmin,
        is_contractor: isContractor,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return createAuthErrorResponse(error, corsHeaders);
    }
    if (error instanceof AuthorizationError) {
      return createAuthzErrorResponse(error, corsHeaders);
    }
    console.error("[Contractor/Admin Endpoint] Error:", error);
    return new Response(
      JSON.stringify({ error: "INTERNAL_ERROR", message: String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

// ============================================================================
// EXAMPLE 4: Multiple roles with custom logic
// ============================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createServiceClient();

    // Allow employee, contractor, or admin
    const auth = await authenticateWithRoles(req, supabaseClient, {
      requiredRoles: ["employee", "contractor", "admin"],
    });

    console.log(`[Multi-Role Endpoint] User ${auth.user.id} accessed endpoint`);
    console.log(`[Multi-Role Endpoint] User roles:`, auth.roles);

    // Different logic based on role
    let responseData: any = {
      success: true,
      user_id: auth.user.id,
      roles: auth.roles,
    };

    if (auth.roles.includes("admin")) {
      // Admin gets full access
      responseData.access_level = "full";
      responseData.message = "Admin access - full permissions";
    } else if (auth.roles.includes("contractor")) {
      // Contractor gets contractor-specific data
      responseData.access_level = "contractor";
      responseData.message = "Contractor access";
    } else if (auth.roles.includes("employee")) {
      // Employee gets employee-specific data
      responseData.access_level = "employee";
      responseData.message = "Employee access";
    }

    return new Response(
      JSON.stringify(responseData),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return createAuthErrorResponse(error, corsHeaders);
    }
    if (error instanceof AuthorizationError) {
      return createAuthzErrorResponse(error, corsHeaders);
    }
    console.error("[Multi-Role Endpoint] Error:", error);
    return new Response(
      JSON.stringify({ error: "INTERNAL_ERROR", message: String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

// ============================================================================
// EXAMPLE 5: Require multiple roles (user must have ALL specified roles)
// ============================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createServiceClient();

    // User must have BOTH contractor AND writer roles
    const auth = await authenticateWithRoles(req, supabaseClient, {
      requireAllRoles: ["contractor", "writer"],
    });

    console.log(`[Multi-Role Required] User ${auth.user.id} has all required roles`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "User has both contractor and writer roles",
        user_id: auth.user.id,
        roles: auth.roles,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return createAuthErrorResponse(error, corsHeaders);
    }
    if (error instanceof AuthorizationError) {
      return createAuthzErrorResponse(error, corsHeaders);
    }
    console.error("[Multi-Role Required] Error:", error);
    return new Response(
      JSON.stringify({ error: "INTERNAL_ERROR", message: String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

// ============================================================================
// EXAMPLE 6: Any authenticated user (no specific role required)
// ============================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createServiceClient();

    // Any authenticated user can access
    const auth = await authenticateWithRoles(req, supabaseClient, {
      allowAnyAuthenticated: true,
    });

    console.log(`[Any Auth] User ${auth.user.id} accessed endpoint`);
    console.log(`[Any Auth] User roles:`, auth.roles);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Authenticated user access",
        user_id: auth.user.id,
        roles: auth.roles,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return createAuthErrorResponse(error, corsHeaders);
    }
    if (error instanceof AuthorizationError) {
      return createAuthzErrorResponse(error, corsHeaders);
    }
    console.error("[Any Auth] Error:", error);
    return new Response(
      JSON.stringify({ error: "INTERNAL_ERROR", message: String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
