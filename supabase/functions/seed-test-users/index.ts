import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Allow POST requests without auth for seeding
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 405,
    });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const testUsers = [
      { email: "contractor@test.com", password: "Test1234!", userType: "contractor", fullName: "Test Contractor" },
      { email: "employee@test.com", password: "Test1234!", userType: "employee", fullName: "Test Employee" },
      { email: "admin@test.com", password: "Test1234!", userType: "admin", fullName: "Test Admin" },
      { email: "writer@test.com", password: "Test1234!", userType: "writer", fullName: "Test Writer" },
    ];

    const results = [];

    for (const user of testUsers) {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: {
          full_name: user.fullName,
          user_type: user.userType,
        },
      });

      if (error) {
        results.push({ email: user.email, success: false, error: error.message });
      } else {
        results.push({ email: user.email, success: true, userId: data.user?.id });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
