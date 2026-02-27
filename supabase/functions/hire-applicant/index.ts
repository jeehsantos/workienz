import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface HireRequest {
  application_id: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization header required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;
    const { application_id }: HireRequest = await req.json();

    if (!application_id) {
      return new Response(JSON.stringify({ error: "application_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[hire-applicant] Processing:", application_id, "by user:", userId);

    // Pre-employment pack gate (advisory check before atomic transaction)
    const { data: packData } = await supabase
      .from("application_pre_employment_packs")
      .select("id, status")
      .eq("job_application_id", application_id)
      .maybeSingle();

    if (packData && !["submitted", "reviewed", "waived"].includes(packData.status)) {
      return new Response(
        JSON.stringify({
          error:
            "Pre-employment pack has not been completed yet. The candidate must submit their pre-employment form before you can confirm the hire.",
          pack_status: packData.status,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── ATOMIC TRANSACTION: all hire side effects in one DB call ────
    const { data: result, error: rpcError } = await supabase.rpc("execute_hire_transaction", {
      p_application_id: application_id,
      p_contractor_user_id: userId,
    });

    if (rpcError) {
      console.error("[hire-applicant] Transaction RPC failed:", rpcError);
      return new Response(JSON.stringify({ error: "Failed to process hire. Please try again." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tx = result as {
      ok: boolean;
      code: string;
      application_id?: string;
      job_id?: string;
      job_title?: string;
      employee_id?: string;
      employee_user_id?: string;
      employee_name?: string;
      contractor_user_id?: string;
      conversation_id?: string | null;
      rejected_app_ids?: string[];
      rejected_job_ids?: string[];
      rejected_conversation_ids?: string[] | null;
    };

    if (!tx.ok) {
      const errorMap: Record<string, { error: string; status: number }> = {
        APP_NOT_FOUND: { error: "Application not found", status: 404 },
        ALREADY_HIRED: { error: "This applicant has already been hired", status: 400 },
        JOB_NOT_FOUND: { error: "Job not found", status: 404 },
        UNAUTHORIZED: { error: "You are not authorized to hire for this job", status: 403 },
        EMPLOYEE_NOT_FOUND: { error: "Employee profile not found", status: 404 },
      };
      const mapped = errorMap[tx.code] || { error: "Hire failed", status: 400 };
      return new Response(JSON.stringify({ error: mapped.error, code: tx.code }), {
        status: mapped.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[hire-applicant] Transaction succeeded. Sending notifications...");

    // ─── POST-TRANSACTION: non-critical side effects (messages + notifications) ───
    const sideEffects: Promise<unknown>[] = [];

    // Hire congratulations message
    if (tx.conversation_id) {
      sideEffects.push(
        supabase.from("messages").insert({
          conversation_id: tx.conversation_id,
          sender_user_id: userId,
          content: `🎉 **CONGRATULATIONS ${(tx.employee_name || "").toUpperCase()}!**\n\nYou have been officially selected for the position: **${tx.job_title}**\n\n✅ Your application status has been updated\n\n⏰ This conversation will be archived automatically in 48 hours.\n\nThe employer will be in touch with next steps. Good luck with your new role!`,
        }),
      );
    }

    // Notification for hired worker
    sideEffects.push(
      supabase.from("notifications").insert({
        user_id: tx.employee_user_id,
        type: "hired",
        title: "🎉 You've been hired!",
        message: `Congratulations! You have been selected for the position: ${tx.job_title}`,
        action_url: tx.conversation_id ? `/conversation/${tx.conversation_id}` : "/dashboard",
        metadata: {
          job_id: tx.job_id,
          job_title: tx.job_title,
          application_id: application_id,
        },
      }),
    );

    // Batch: messages + notifications for rejected conversations
    const rejectedConvIds = tx.rejected_conversation_ids || [];
    const rejectedJobIds = tx.rejected_job_ids || [];

    if (rejectedConvIds.length > 0) {
      // Fetch job titles for rejected applications in one query
      const uniqueJobIds = [...new Set(rejectedJobIds)];
      const { data: rejectedJobs } = await supabase
        .from("jobs")
        .select("id, title, contractor_id")
        .in("id", uniqueJobIds);

      const jobMap = new Map((rejectedJobs || []).map((j) => [j.id, j]));

      // Fetch contractor user_ids in one query
      const contractorIds = [...new Set((rejectedJobs || []).map((j) => j.contractor_id))];
      const { data: contractorProfiles } = await supabase
        .from("contractor_profiles")
        .select("id, user_id")
        .in("id", contractorIds);

      const contractorMap = new Map((contractorProfiles || []).map((c) => [c.id, c.user_id]));

      // Fetch conversations to get contractor_user_id for sender
      const { data: rejectedConvs } = await supabase
        .from("conversations")
        .select("id, contractor_user_id, job_application_id")
        .in("id", rejectedConvIds);

      // Build batch inserts for messages and notifications
      const messageInserts: Array<{
        conversation_id: string;
        sender_user_id: string;
        content: string;
      }> = [];
      const notificationInserts: Array<{
        user_id: string;
        type: string;
        title: string;
        message: string;
        action_url: string;
        metadata: Record<string, unknown>;
      }> = [];

      for (let i = 0; i < (tx.rejected_app_ids || []).length; i++) {
        const appId = tx.rejected_app_ids![i];
        const jobId = rejectedJobIds[i];
        const jobInfo = jobMap.get(jobId);
        const conv = rejectedConvs?.find((c) => c.job_application_id === appId);

        if (conv) {
          messageInserts.push({
            conversation_id: conv.id,
            sender_user_id: conv.contractor_user_id,
            content: `📋 **Application Closed**\n\nThis candidate (${tx.employee_name}) has been hired by another employer for a different position.\n\nThe application for "${jobInfo?.title || "this job"}" has been automatically closed.\n\n⏰ This conversation will be archived in 48 hours.`,
          });

          if (jobInfo) {
            const contractorUserId = contractorMap.get(jobInfo.contractor_id);
            if (contractorUserId) {
              notificationInserts.push({
                user_id: contractorUserId,
                type: "application_closed",
                title: "Application Closed",
                message: `${tx.employee_name} has been hired by another employer. Their application has been closed.`,
                action_url: `/conversation/${conv.id}`,
                metadata: {
                  job_id: jobId,
                  application_id: appId,
                  reason: "hired_elsewhere",
                },
              });
            }
          }
        }
      }

      if (messageInserts.length > 0) {
        sideEffects.push(supabase.from("messages").insert(messageInserts));
      }
      if (notificationInserts.length > 0) {
        sideEffects.push(supabase.from("notifications").insert(notificationInserts));
      }
    }

    // Execute all side effects in parallel
    await Promise.all(sideEffects);

    console.log("[hire-applicant] Complete. Rejected:", rejectedConvIds.length, "other applications");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Applicant hired successfully",
        data: {
          application_id,
          job_title: tx.job_title,
          employee_name: tx.employee_name,
          conversation_id: tx.conversation_id,
          other_applications_rejected: (tx.rejected_app_ids || []).length,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[hire-applicant] Unexpected error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
