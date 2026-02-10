import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: unknown) => {
  console.log(`[MANAGE-FAVORITE] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    // Authenticate
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Verify contractor role
    const { data: roles } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "contractor");

    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ error: "Only contractors can manage favorites" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    logStep("Action received", { action, userId });

    if (action === "add") {
      const { employee_user_id, employee_profile_id, note, job_id } = body;

      if (!employee_user_id || !employee_profile_id) {
        return new Response(JSON.stringify({ error: "employee_user_id and employee_profile_id are required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Prevent self-favorite
      if (employee_user_id === userId) {
        return new Response(JSON.stringify({ error: "Cannot favorite yourself" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await serviceClient
        .from("contractor_favorite_workers")
        .upsert({
          contractor_user_id: userId,
          employee_user_id,
          employee_profile_id,
          note: note || null,
          job_id: job_id || null,
        }, { onConflict: "contractor_user_id,employee_user_id" })
        .select()
        .single();

      if (error) throw error;

      logStep("Favorite added", { id: data.id });
      return new Response(JSON.stringify({ success: true, favorite: data }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "remove") {
      const { employee_user_id } = body;

      const { error } = await serviceClient
        .from("contractor_favorite_workers")
        .delete()
        .eq("contractor_user_id", userId)
        .eq("employee_user_id", employee_user_id);

      if (error) throw error;

      logStep("Favorite removed", { employee_user_id });
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_note") {
      const { employee_user_id, note } = body;

      const { error } = await serviceClient
        .from("contractor_favorite_workers")
        .update({ note })
        .eq("contractor_user_id", userId)
        .eq("employee_user_id", employee_user_id);

      if (error) throw error;

      logStep("Note updated", { employee_user_id });
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list") {
      const { data, error } = await serviceClient
        .from("contractor_favorite_workers")
        .select(`
          id,
          employee_user_id,
          employee_profile_id,
          note,
          job_id,
          created_at
        `)
        .eq("contractor_user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Enrich with employee profile and user profile data
      const enriched = await Promise.all(
        (data || []).map(async (fav) => {
          const { data: empProfile } = await serviceClient
            .from("employee_profiles")
            .select("id, headline, city, skills, industry")
            .eq("id", fav.employee_profile_id)
            .single();

          const { data: userProfile } = await serviceClient
            .from("profiles")
            .select("full_name, avatar_url, email")
            .eq("user_id", fav.employee_user_id)
            .single();

          // Get job title if job_id exists
          let jobTitle = null;
          if (fav.job_id) {
            const { data: job } = await serviceClient
              .from("jobs")
              .select("title")
              .eq("id", fav.job_id)
              .single();
            jobTitle = job?.title || null;
          }

          return {
            ...fav,
            employee_name: userProfile?.full_name || "Worker",
            employee_avatar: userProfile?.avatar_url || null,
            employee_headline: empProfile?.headline || null,
            employee_city: empProfile?.city || null,
            employee_skills: empProfile?.skills || [],
            employee_industry: empProfile?.industry || null,
            job_title: jobTitle,
          };
        })
      );

      logStep("Favorites listed", { count: enriched.length });
      return new Response(JSON.stringify({ success: true, favorites: enriched }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action. Use: add, remove, update_note, list" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
