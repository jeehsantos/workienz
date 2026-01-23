import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ValidationRequest {
  job_id: string;
}

interface Requirement {
  type: string;
  label: string;
  met: boolean;
  reason?: string;
}

interface ValidationResponse {
  allowed: boolean;
  requirements: Requirement[];
  blocked_reason?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = userData.user.id;
    const { job_id } = await req.json() as ValidationRequest;

    if (!job_id) {
      return new Response(
        JSON.stringify({ error: "job_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get employee profile
    const { data: employee, error: empError } = await supabase
      .from("employee_profiles")
      .select("id, visa_status, has_car, comfortable_heavy_lifting, comfortable_standing, skills")
      .eq("user_id", userId)
      .single();

    if (empError || !employee) {
      return new Response(
        JSON.stringify({ error: "Employee profile not found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get job requirements
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, title, requires_car, requires_heavy_lifting, requires_standing, skills_required, requirements")
      .eq("id", job_id)
      .single();

    if (jobError || !job) {
      return new Response(
        JSON.stringify({ error: "Job not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const requirements: Requirement[] = [];
    let hasBlockingIssue = false;
    let blockedReason: string | undefined;

    // 1. Check visa status - Tourist/Visitor visa cannot apply
    const blockedVisaStatuses = ["Visitor Visa (with work rights)"];
    const restrictedVisaStatuses = ["Tourist Visa", "Visitor Visa"];
    
    if (employee.visa_status) {
      const isBlocked = blockedVisaStatuses.includes(employee.visa_status) || 
                        restrictedVisaStatuses.some(v => employee.visa_status?.includes(v));
      
      if (isBlocked) {
        hasBlockingIssue = true;
        blockedReason = "Unfortunately, visitor/tourist visa holders are not eligible to work in New Zealand. Please update your visa status if this is incorrect.";
        requirements.push({
          type: "visa_status",
          label: "Valid Work Visa",
          met: false,
          reason: "Visitor/Tourist visa does not allow employment in New Zealand"
        });
      }
    }

    // 2. Check physical requirement: heavy lifting
    if (job.requires_heavy_lifting) {
      const met = employee.comfortable_heavy_lifting === true;
      requirements.push({
        type: "physical",
        label: "Comfortable with heavy lifting (>10kg)",
        met,
        reason: met ? undefined : "This job requires lifting items over 10kg"
      });
    }

    // 3. Check physical requirement: standing
    if (job.requires_standing) {
      const met = employee.comfortable_standing === true;
      requirements.push({
        type: "physical",
        label: "Comfortable standing for long periods",
        met,
        reason: met ? undefined : "This job requires standing for extended periods"
      });
    }

    // 4. Check logistical requirement: car
    if (job.requires_car) {
      const met = employee.has_car === true;
      requirements.push({
        type: "logistical",
        label: "Own vehicle/car required",
        met,
        reason: met ? undefined : "This job requires you to have your own transportation"
      });
    }

    // 5. Check skills match
    if (job.skills_required && job.skills_required.length > 0) {
      const employeeSkills: string[] = (employee.skills || []).map((s: string) => s.toLowerCase());
      const jobSkills: string[] = job.skills_required.map((s: string) => s.toLowerCase());
      
      const matchedSkills = jobSkills.filter((skill: string) => 
        employeeSkills.some((empSkill: string) => empSkill.includes(skill) || skill.includes(empSkill))
      );
      
      const skillMatchPercentage = matchedSkills.length / jobSkills.length;
      const met = skillMatchPercentage >= 0.5; // At least 50% match
      
      requirements.push({
        type: "skills",
        label: `Skills match (${job.skills_required.join(", ")})`,
        met,
        reason: met 
          ? `You match ${matchedSkills.length}/${jobSkills.length} required skills`
          : `You only match ${matchedSkills.length}/${jobSkills.length} required skills`
      });
    }

    // Determine if all critical requirements are met (visa is blocking, others are informational)
    const unmetCriticalRequirements = requirements.filter(r => 
      r.type === "visa_status" && !r.met
    );

    const response: ValidationResponse = {
      allowed: !hasBlockingIssue && unmetCriticalRequirements.length === 0,
      requirements,
      blocked_reason: blockedReason
    };

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[validate-job-requirements] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
