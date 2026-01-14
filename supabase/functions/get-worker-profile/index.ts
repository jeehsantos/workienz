import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[GET-WORKER-PROFILE] ${step}${detailsStr}`);
};

interface WorkerDTO {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  headline: string | null;
  bio: string | null;
  city: string | null;
  suburb: string | null;
  country: string | null;
  experience_years: number | null;
  skills: string[] | null;
  languages: string[] | null;
  availability: string | null;
  is_available: boolean | null;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  has_car: boolean | null;
  comfortable_standing: boolean | null;
  comfortable_heavy_lifting: boolean | null;
  visa_status: string | null;
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

    const body = await req.json();
    const workerId = body.worker_id as string | undefined;

    if (!workerId) {
      return new Response(
        JSON.stringify({ error: "worker_id is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Authenticate user (optional - guests can view limited data)
    const authHeader = req.headers.get("Authorization");
    let user = null;
    let isContractor = false;
    let hasFullAccess = false;
    let isApplicant = false;

    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: userData } = await supabaseClient.auth.getUser(token);
      user = userData.user;

      if (user) {
        // Check if user is a contractor
        const { data: roleData } = await supabaseClient
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "contractor")
          .single();

        isContractor = !!roleData;

        if (isContractor) {
          // Check if contractor has unlimited subscription (monthly/quarterly)
          const { data: entitlements } = await supabaseClient
            .from("contractor_entitlements")
            .select("*")
            .eq("user_id", user.id)
            .eq("status", "active");

          const hasUnlimited = (entitlements ?? []).some((e) => e.job_allowance === null);
          
          if (hasUnlimited) {
            hasFullAccess = true;
            logStep("Contractor has unlimited plan - full access");
          }

          // Check if worker has applied to any of contractor's jobs
          const { data: contractorProfile } = await supabaseClient
            .from("contractor_profiles")
            .select("id")
            .eq("user_id", user.id)
            .single();

          if (contractorProfile) {
            // Get the worker's user_id from employee_profiles
            const { data: workerProfile } = await supabaseClient
              .from("employee_profiles")
              .select("user_id")
              .eq("id", workerId)
              .single();

            if (workerProfile) {
              // Check if this worker has applied to any of contractor's jobs
              const { data: applications } = await supabaseClient
                .from("job_applications")
                .select("id, jobs!inner(contractor_id)")
                .eq("jobs.contractor_id", contractorProfile.id)
                .eq("employee_id", workerId);

              isApplicant = (applications?.length ?? 0) > 0;
              if (isApplicant) {
                hasFullAccess = true;
                logStep("Worker is an applicant - full access");
              }
            }
          }
        }
      }
    }

    logStep("Access check", { isContractor, hasFullAccess, isApplicant });

    // Fetch worker profile with user profile data
    const { data: workerData, error: workerError } = await supabaseClient
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
        languages,
        availability,
        is_available,
        phone,
        has_car,
        comfortable_standing,
        comfortable_heavy_lifting,
        visa_status
      `)
      .eq("id", workerId)
      .single();

    if (workerError || !workerData) {
      return new Response(
        JSON.stringify({ error: "Worker not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    // Fetch user profile for name and email
    const { data: profileData } = await supabaseClient
      .from("profiles")
      .select("first_name, last_name, full_name, email, avatar_url")
      .eq("user_id", workerData.user_id)
      .single();

    // Build the DTO with masking based on access level
    const workerDTO: WorkerDTO = {
      id: workerData.id,
      user_id: workerData.user_id,
      first_name: profileData?.first_name ?? null,
      last_name: hasFullAccess ? profileData?.last_name : (profileData?.last_name ? profileData.last_name.charAt(0) + "." : null),
      full_name: hasFullAccess 
        ? profileData?.full_name 
        : ((profileData?.first_name ?? "") + " " + (profileData?.last_name ? profileData.last_name.charAt(0) + "." : "")).trim() || null,
      headline: workerData.headline,
      bio: hasFullAccess ? workerData.bio : null, // Hide bio for limited access
      city: workerData.city,
      suburb: hasFullAccess ? workerData.suburb : null, // Hide suburb for limited access
      country: workerData.country,
      experience_years: workerData.experience_years,
      skills: workerData.skills,
      languages: workerData.languages,
      availability: workerData.availability,
      is_available: workerData.is_available,
      phone: hasFullAccess ? workerData.phone : null, // Hide phone for limited access
      email: hasFullAccess ? profileData?.email : null, // Hide email for limited access
      avatar_url: profileData?.avatar_url ?? null,
      has_car: workerData.has_car,
      comfortable_standing: workerData.comfortable_standing,
      comfortable_heavy_lifting: workerData.comfortable_heavy_lifting,
      visa_status: hasFullAccess ? workerData.visa_status : null, // Hide visa for limited access
    };

    const response = {
      worker: workerDTO,
      access_level: hasFullAccess ? "full" : "limited",
      is_applicant: isApplicant,
      can_contact: hasFullAccess,
      is_authenticated: !!user,
      is_contractor: isContractor,
    };

    logStep("Returning worker profile", { accessLevel: response.access_level });

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
