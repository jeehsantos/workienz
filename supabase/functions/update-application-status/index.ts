import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth client to identify caller
    const authClient = createClient(supabaseUrl, serviceKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { job_application_id, new_status, reason } = await req.json();

    // Validate input
    const validStatuses = ["pending", "shortlisted", "rejected", "hired", "approved_to_pool"];
    if (!job_application_id || !validStatuses.includes(new_status)) {
      return new Response(
        JSON.stringify({ error: "Invalid input. Provide job_application_id and a valid new_status." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const serviceClient = createClient(supabaseUrl, serviceKey);

    // Fetch the application and verify ownership
    const { data: application, error: appErr } = await serviceClient
      .from("job_applications")
      .select("id, job_id, status")
      .eq("id", job_application_id)
      .single();

    if (appErr || !application) {
      return new Response(JSON.stringify({ error: "Application not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check caller is contractor who owns the job OR admin
    const { data: isAdmin } = await serviceClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });

    if (!isAdmin) {
      // Must be the contractor who owns the job
      const { data: jobOwner, error: ownerErr } = await serviceClient
        .from("jobs")
        .select("contractor_id, contractor_profiles!inner(user_id)")
        .eq("id", application.job_id)
        .single();

      if (ownerErr || !jobOwner) {
        return new Response(JSON.stringify({ error: "Job not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const contractorUserId = (jobOwner as any).contractor_profiles?.user_id;
      if (contractorUserId !== user.id) {
        return new Response(JSON.stringify({ error: "Forbidden: You do not own this job." }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Perform the update
    const { data: updated, error: updateErr } = await serviceClient
      .from("job_applications")
      .update({ status: new_status })
      .eq("id", job_application_id)
      .select()
      .single();

    if (updateErr) {
      return new Response(JSON.stringify({ error: updateErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ data: updated }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
