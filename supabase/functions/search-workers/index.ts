import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[SEARCH-WORKERS] ${step}${detailsStr}`);
};

interface WorkerDTO {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  headline: string | null;
  city: string | null;
  country: string | null;
  experience_years: number | null;
  skills: string[] | null;
  availability: string | null;
  is_available: boolean | null;
  avatar_url: string | null;
  access_level: "full" | "limited";
  is_applicant: boolean;
  can_contact: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const body = await req.json().catch(() => ({}));
    const filters = body.filters ?? {};
    const { city, skill, availability, search } = filters;

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Invalid authorization" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }
    const user = userData.user;

    // Verify user is a contractor
    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "contractor")
      .single();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "ERR_NOT_CONTRACTOR", message: "Only contractors can search workers" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    // Check contractor's entitlements for access level
    const { data: entitlements } = await supabaseClient
      .from("contractor_entitlements")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active");

    const hasActiveSubscription = (entitlements?.length ?? 0) > 0;
    const hasUnlimited = (entitlements ?? []).some((e) => e.job_allowance === null);

    logStep("Contractor access check", { hasActiveSubscription, hasUnlimited });

    // Get contractor profile to find applicants
    const { data: contractorProfile } = await supabaseClient
      .from("contractor_profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    // Get list of workers who have applied to this contractor's jobs
    let applicantEmployeeIds: string[] = [];
    if (contractorProfile) {
      const { data: applications } = await supabaseClient
        .from("job_applications")
        .select("employee_id, jobs!inner(contractor_id)")
        .eq("jobs.contractor_id", contractorProfile.id);

      applicantEmployeeIds = [...new Set((applications ?? []).map((a) => a.employee_id))];
      logStep("Found applicants", { count: applicantEmployeeIds.length });
    }

    // Build query for workers
    let query = supabaseClient
      .from("employee_profiles")
      .select(`
        id,
        user_id,
        headline,
        bio,
        city,
        suburb,
        country,
        experience_years,
        skills,
        availability,
        is_available,
        phone
      `)
      .eq("is_available", true);

    // Apply filters
    if (city && city !== "all") {
      query = query.eq("city", city);
    }
    if (availability && availability !== "all") {
      query = query.eq("availability", availability);
    }

    const { data: workers, error: workersError } = await query;

    if (workersError) {
      logStep("Error fetching workers", { error: workersError.message });
      throw new Error(workersError.message);
    }

    logStep("Fetched workers", { count: workers?.length ?? 0 });

    // Fetch profiles for all workers
    const userIds = (workers ?? []).map((w) => w.user_id);
    const { data: profiles } = await supabaseClient
      .from("profiles")
      .select("user_id, first_name, last_name, full_name, email, avatar_url")
      .in("user_id", userIds);

    const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));

    // Process and filter workers
    let processedWorkers: WorkerDTO[] = (workers ?? []).map((worker) => {
      const profile = profileMap.get(worker.user_id);
      const isApplicant = applicantEmployeeIds.includes(worker.id);
      const hasFullAccess = hasUnlimited || isApplicant;

      return {
        id: worker.id,
        user_id: worker.user_id,
        first_name: profile?.first_name ?? null,
        last_name: hasFullAccess 
          ? profile?.last_name 
          : (profile?.last_name ? profile.last_name.charAt(0) + "." : null),
        full_name: hasFullAccess 
          ? profile?.full_name 
          : ((profile?.first_name ?? "") + " " + (profile?.last_name ? profile.last_name.charAt(0) + "." : "")).trim() || null,
        headline: worker.headline,
        city: worker.city,
        country: worker.country,
        experience_years: worker.experience_years,
        skills: worker.skills,
        availability: worker.availability,
        is_available: worker.is_available,
        avatar_url: profile?.avatar_url ?? null,
        access_level: hasFullAccess ? "full" : "limited",
        is_applicant: isApplicant,
        can_contact: hasFullAccess,
      };
    });

    // Apply skill filter (client-side since skills is an array)
    if (skill && skill !== "all") {
      processedWorkers = processedWorkers.filter((w) =>
        w.skills?.some((s) => s.toLowerCase().includes(skill.toLowerCase()))
      );
    }

    // Apply search filter
    if (search && search.trim()) {
      const searchLower = search.toLowerCase();
      processedWorkers = processedWorkers.filter((w) =>
        w.full_name?.toLowerCase().includes(searchLower) ||
        w.first_name?.toLowerCase().includes(searchLower) ||
        w.headline?.toLowerCase().includes(searchLower) ||
        w.skills?.some((s) => s.toLowerCase().includes(searchLower))
      );
    }

    const response = {
      workers: processedWorkers,
      total_count: processedWorkers.length,
      has_active_subscription: hasActiveSubscription,
      has_full_access: hasUnlimited,
      applicant_count: applicantEmployeeIds.length,
    };

    logStep("Returning workers", { count: processedWorkers.length });

    return new Response(JSON.stringify(response), {
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
