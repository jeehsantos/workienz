/**
 * JWT Authentication Middleware for Supabase Edge Functions
 * 
 * Provides utilities for validating JWT tokens, checking token expiration,
 * and enforcing authentication on protected routes.
 * 
 * Requirements: 2.2, 15.1, 15.2
 */

import { createClient, SupabaseClient, User } from "https://esm.sh/@supabase/supabase-js@2.57.2";

export interface AuthContext {
  user: User;
  token: string;
  expiresAt: number;
}

export interface AuthMiddlewareOptions {
  requireAuth?: boolean;
  checkExpiration?: boolean;
  expirationBuffer?: number; // seconds before expiration to warn
}

export class AuthenticationError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 401
  ) {
    super(message);
    this.name = "AuthenticationError";
  }
}

/**
 * Extract JWT token from Authorization header
 */
export function extractToken(req: Request): string | null {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return null;
  }

  // Support both "Bearer <token>" and raw token
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.substring(7)
    : authHeader;

  return token || null;
}

/**
 * Decode JWT token to extract expiration time
 * Note: This does NOT validate the signature, only decodes the payload
 */
export function decodeJWT(token: string): { exp?: number; sub?: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    // Decode the payload (second part)
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

/**
 * Check if token is expired or will expire soon
 */
export function checkTokenExpiration(
  token: string,
  bufferSeconds: number = 300 // 5 minutes default
): { expired: boolean; expiresIn: number; shouldRefresh: boolean } {
  const decoded = decodeJWT(token);
  
  if (!decoded || !decoded.exp) {
    return { expired: true, expiresIn: 0, shouldRefresh: true };
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresIn = decoded.exp - now;
  const expired = expiresIn <= 0;
  const shouldRefresh = expiresIn <= bufferSeconds;

  return { expired, expiresIn, shouldRefresh };
}

/**
 * Validate JWT token and return authenticated user
 */
export async function validateToken(
  supabaseClient: SupabaseClient,
  token: string,
  options: AuthMiddlewareOptions = {}
): Promise<AuthContext> {
  const { checkExpiration = true, expirationBuffer = 300 } = options;

  // Check token expiration before making API call
  if (checkExpiration) {
    const expiration = checkTokenExpiration(token, expirationBuffer);
    
    if (expiration.expired) {
      throw new AuthenticationError(
        "Token has expired",
        "TOKEN_EXPIRED",
        401
      );
    }

    if (expiration.shouldRefresh) {
      console.warn(`[Auth] Token expires in ${expiration.expiresIn}s, refresh recommended`);
    }
  }

  // Validate token with Supabase
  const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);

  if (userError) {
    throw new AuthenticationError(
      `Authentication failed: ${userError.message}`,
      "AUTH_FAILED",
      401
    );
  }

  if (!userData.user) {
    throw new AuthenticationError(
      "User not found",
      "USER_NOT_FOUND",
      401
    );
  }

  const decoded = decodeJWT(token);
  const expiresAt = decoded?.exp || 0;

  return {
    user: userData.user,
    token,
    expiresAt,
  };
}

/**
 * Authentication middleware for Edge Functions
 * 
 * Usage:
 * ```typescript
 * const auth = await authenticateRequest(req, supabaseClient);
 * console.log('Authenticated user:', auth.user.id);
 * ```
 */
export async function authenticateRequest(
  req: Request,
  supabaseClient: SupabaseClient,
  options: AuthMiddlewareOptions = {}
): Promise<AuthContext> {
  const { requireAuth = true } = options;

  const token = extractToken(req);

  if (!token) {
    if (requireAuth) {
      throw new AuthenticationError(
        "No authorization token provided",
        "NO_TOKEN",
        401
      );
    }
    throw new AuthenticationError(
      "No authorization token provided",
      "NO_TOKEN",
      401
    );
  }

  return validateToken(supabaseClient, token, options);
}

/**
 * Create a standardized error response
 */
export function createAuthErrorResponse(
  error: AuthenticationError | Error,
  corsHeaders: Record<string, string>
): Response {
  const isAuthError = error instanceof AuthenticationError;
  
  const statusCode = isAuthError ? error.code : 500;
  const errorCode = isAuthError ? error.code : "INTERNAL_ERROR";
  const message = error.message;

  return new Response(
    JSON.stringify({
      error: errorCode,
      message,
      timestamp: new Date().toISOString(),
    }),
    {
      status: isAuthError ? error.statusCode : 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    }
  );
}

/**
 * Helper to create Supabase client with service role
 */
export function createServiceClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing required Supabase environment variables");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

/**
 * Log authentication events for monitoring
 */
export function logAuthEvent(
  event: "success" | "failure" | "expired" | "refresh_needed",
  details: Record<string, unknown>
): void {
  const timestamp = new Date().toISOString();
  console.log(`[Auth:${event}] ${timestamp}`, JSON.stringify(details));
}

// ============================================================================
// ROLE-BASED ACCESS CONTROL (RBAC) MIDDLEWARE
// Requirements: 2.4
// ============================================================================

/**
 * Application roles enum matching database app_role type
 */
export type AppRole = "admin" | "contractor" | "employee" | "writer";

/**
 * Authorization error for role-based access control
 */
export class AuthorizationError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 403
  ) {
    super(message);
    this.name = "AuthorizationError";
  }
}

/**
 * Extended auth context with role information
 */
export interface AuthContextWithRoles extends AuthContext {
  roles: AppRole[];
}

/**
 * RBAC middleware options
 */
export interface RBACOptions {
  /**
   * Required roles - user must have at least one of these roles
   */
  requiredRoles?: AppRole[];
  
  /**
   * Required all roles - user must have all of these roles
   */
  requireAllRoles?: AppRole[];
  
  /**
   * Allow if user has any role (authenticated users only)
   */
  allowAnyAuthenticated?: boolean;
}

/**
 * Fetch user roles from database
 */
export async function getUserRoles(
  supabaseClient: SupabaseClient,
  userId: string
): Promise<AppRole[]> {
  const { data: roleData, error } = await supabaseClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (error) {
    console.error("[RBAC] Error fetching user roles:", error);
    throw new AuthorizationError(
      "Failed to fetch user roles",
      "ROLE_FETCH_ERROR",
      500
    );
  }

  return (roleData || []).map((r) => r.role as AppRole);
}

/**
 * Check if user has a specific role
 */
export function hasRole(userRoles: AppRole[], role: AppRole): boolean {
  return userRoles.includes(role);
}

/**
 * Check if user has any of the specified roles
 */
export function hasAnyRole(userRoles: AppRole[], roles: AppRole[]): boolean {
  return roles.some((role) => userRoles.includes(role));
}

/**
 * Check if user has all of the specified roles
 */
export function hasAllRoles(userRoles: AppRole[], roles: AppRole[]): boolean {
  return roles.every((role) => userRoles.includes(role));
}

/**
 * Validate user has required roles
 */
export function validateRoles(
  userRoles: AppRole[],
  options: RBACOptions
): void {
  const { requiredRoles, requireAllRoles, allowAnyAuthenticated } = options;

  // If allowAnyAuthenticated is true, any authenticated user passes
  if (allowAnyAuthenticated) {
    return;
  }

  // Check if user has all required roles
  if (requireAllRoles && requireAllRoles.length > 0) {
    if (!hasAllRoles(userRoles, requireAllRoles)) {
      const missing = requireAllRoles.filter((r) => !userRoles.includes(r));
      throw new AuthorizationError(
        `Missing required roles: ${missing.join(", ")}`,
        "INSUFFICIENT_ROLES",
        403
      );
    }
  }

  // Check if user has at least one of the required roles
  if (requiredRoles && requiredRoles.length > 0) {
    if (!hasAnyRole(userRoles, requiredRoles)) {
      throw new AuthorizationError(
        `Access denied. Required roles: ${requiredRoles.join(" or ")}`,
        "UNAUTHORIZED_ROLE",
        403
      );
    }
  }

  // If no role requirements specified but not allowing any authenticated, deny
  if (!requiredRoles && !requireAllRoles && !allowAnyAuthenticated) {
    throw new AuthorizationError(
      "No role requirements specified",
      "INVALID_RBAC_CONFIG",
      500
    );
  }
}

/**
 * Authenticate and authorize request with role-based access control
 * 
 * Usage:
 * ```typescript
 * // Require admin role
 * const auth = await authenticateWithRoles(req, supabaseClient, {
 *   requiredRoles: ["admin"]
 * });
 * 
 * // Require contractor or admin
 * const auth = await authenticateWithRoles(req, supabaseClient, {
 *   requiredRoles: ["contractor", "admin"]
 * });
 * 
 * // Require both contractor and writer roles
 * const auth = await authenticateWithRoles(req, supabaseClient, {
 *   requireAllRoles: ["contractor", "writer"]
 * });
 * 
 * // Any authenticated user
 * const auth = await authenticateWithRoles(req, supabaseClient, {
 *   allowAnyAuthenticated: true
 * });
 * ```
 */
export async function authenticateWithRoles(
  req: Request,
  supabaseClient: SupabaseClient,
  rbacOptions: RBACOptions,
  authOptions: AuthMiddlewareOptions = {}
): Promise<AuthContextWithRoles> {
  // First authenticate the user
  const authContext = await authenticateRequest(req, supabaseClient, authOptions);

  // Fetch user roles
  const roles = await getUserRoles(supabaseClient, authContext.user.id);

  // Log role check
  console.log(`[RBAC] User ${authContext.user.id} has roles:`, roles);

  // Validate roles against requirements
  try {
    validateRoles(roles, rbacOptions);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      console.warn(`[RBAC] Authorization failed for user ${authContext.user.id}:`, error.message);
      throw error;
    }
    throw error;
  }

  // Log successful authorization
  console.log(`[RBAC] Authorization successful for user ${authContext.user.id}`);

  return {
    ...authContext,
    roles,
  };
}

/**
 * Create a standardized authorization error response
 */
export function createAuthzErrorResponse(
  error: AuthorizationError | Error,
  corsHeaders: Record<string, string>
): Response {
  const isAuthzError = error instanceof AuthorizationError;
  
  const statusCode = isAuthzError ? error.statusCode : 500;
  const errorCode = isAuthzError ? error.code : "INTERNAL_ERROR";
  const message = error.message;

  return new Response(
    JSON.stringify({
      error: errorCode,
      message,
      timestamp: new Date().toISOString(),
    }),
    {
      status: statusCode,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    }
  );
}

/**
 * Convenience functions for common role checks
 */

/**
 * Require admin role
 */
export async function requireAdmin(
  req: Request,
  supabaseClient: SupabaseClient,
  authOptions: AuthMiddlewareOptions = {}
): Promise<AuthContextWithRoles> {
  return authenticateWithRoles(req, supabaseClient, {
    requiredRoles: ["admin"],
  }, authOptions);
}

/**
 * Require contractor role
 */
export async function requireContractor(
  req: Request,
  supabaseClient: SupabaseClient,
  authOptions: AuthMiddlewareOptions = {}
): Promise<AuthContextWithRoles> {
  return authenticateWithRoles(req, supabaseClient, {
    requiredRoles: ["contractor"],
  }, authOptions);
}

/**
 * Require employee role
 */
export async function requireEmployee(
  req: Request,
  supabaseClient: SupabaseClient,
  authOptions: AuthMiddlewareOptions = {}
): Promise<AuthContextWithRoles> {
  return authenticateWithRoles(req, supabaseClient, {
    requiredRoles: ["employee"],
  }, authOptions);
}

/**
 * Require writer role
 */
export async function requireWriter(
  req: Request,
  supabaseClient: SupabaseClient,
  authOptions: AuthMiddlewareOptions = {}
): Promise<AuthContextWithRoles> {
  return authenticateWithRoles(req, supabaseClient, {
    requiredRoles: ["writer"],
  }, authOptions);
}

/**
 * Require contractor or admin role (common pattern for contractor operations)
 */
export async function requireContractorOrAdmin(
  req: Request,
  supabaseClient: SupabaseClient,
  authOptions: AuthMiddlewareOptions = {}
): Promise<AuthContextWithRoles> {
  return authenticateWithRoles(req, supabaseClient, {
    requiredRoles: ["contractor", "admin"],
  }, authOptions);
}

/**
 * Require employee or admin role (common pattern for employee operations)
 */
export async function requireEmployeeOrAdmin(
  req: Request,
  supabaseClient: SupabaseClient,
  authOptions: AuthMiddlewareOptions = {}
): Promise<AuthContextWithRoles> {
  return authenticateWithRoles(req, supabaseClient, {
    requiredRoles: ["employee", "admin"],
  }, authOptions);
}

/**
 * Log authorization events for monitoring
 */
export function logAuthzEvent(
  event: "success" | "failure" | "role_check",
  details: Record<string, unknown>
): void {
  const timestamp = new Date().toISOString();
  console.log(`[RBAC:${event}] ${timestamp}`, JSON.stringify(details));
}
