import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PROCESS-CHAT-EXPIRY] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Cron job started");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const seventyTwoHoursAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000);

    // Find active conversations with no recent activity
    const { data: conversations, error: fetchError } = await supabaseAdmin
      .from("conversations")
      .select(`
        id,
        contractor_user_id,
        employee_user_id,
        activity_started_at,
        last_activity_at,
        reminder_count,
        reminder_sent_at,
        job_application_id
      `)
      .eq("status", "active")
      .lt("last_activity_at", twentyFourHoursAgo.toISOString());

    if (fetchError) {
      throw new Error(`Failed to fetch conversations: ${fetchError.message}`);
    }

    logStep("Found inactive conversations", { count: conversations?.length || 0 });

    if (!conversations || conversations.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: "No inactive conversations found" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    let remindersSent = 0;
    let conversationsClosed = 0;
    let errors: string[] = [];

    for (const conv of conversations) {
      try {
        const activityStarted = new Date(conv.activity_started_at);
        const lastActivity = new Date(conv.last_activity_at);
        const hoursSinceStart = (now.getTime() - activityStarted.getTime()) / (1000 * 60 * 60);

        // Get job title for notifications
        let jobTitle = "Direct Contact";
        if (conv.job_application_id) {
          const { data: app } = await supabaseAdmin
            .from("job_applications")
            .select("job_id")
            .eq("id", conv.job_application_id)
            .single();

          if (app?.job_id) {
            const { data: job } = await supabaseAdmin
              .from("jobs")
              .select("title")
              .eq("id", app.job_id)
              .single();
            jobTitle = job?.title || "Job Application";
          }
        }

        // Get both party names
        const { data: contractorProfile } = await supabaseAdmin
          .from("profiles")
          .select("email, full_name, first_name")
          .eq("user_id", conv.contractor_user_id)
          .single();

        const { data: employeeProfile } = await supabaseAdmin
          .from("profiles")
          .select("email, full_name, first_name")
          .eq("user_id", conv.employee_user_id)
          .single();

        // Check if conversation should be closed (72h+ since start with no activity)
        if (hoursSinceStart >= 72) {
          logStep("Closing conversation due to inactivity", { conversationId: conv.id, hoursSinceStart });

          // Update conversation status to closed
          const { error: updateError } = await supabaseAdmin
            .from("conversations")
            .update({ status: "closed" })
            .eq("id", conv.id);

          if (updateError) {
            errors.push(`Close ${conv.id}: ${updateError.message}`);
            continue;
          }

          // Create notifications for both parties
          const closedNotifications = [
            {
              user_id: conv.contractor_user_id,
              type: "chat_expired",
              title: "Conversation Closed",
              message: `Your conversation about "${jobTitle}" was closed due to inactivity.`,
              action_url: "/dashboard",
              metadata: { conversation_id: conv.id, job_title: jobTitle },
            },
            {
              user_id: conv.employee_user_id,
              type: "chat_expired",
              title: "Conversation Closed",
              message: `Your conversation about "${jobTitle}" was closed due to inactivity.`,
              action_url: "/dashboard",
              metadata: { conversation_id: conv.id, job_title: jobTitle },
            },
          ];

          await supabaseAdmin.from("notifications").insert(closedNotifications);

          conversationsClosed++;
          logStep("Conversation closed", { conversationId: conv.id });

        } else if (conv.reminder_count < 2) {
          // Send reminder if we haven't sent 2 yet
          const lastReminderTime = conv.reminder_sent_at ? new Date(conv.reminder_sent_at) : null;
          const hoursSinceReminder = lastReminderTime 
            ? (now.getTime() - lastReminderTime.getTime()) / (1000 * 60 * 60)
            : 999;

          // Only send one reminder per 24 hours
          if (hoursSinceReminder >= 24) {
            const hoursRemaining = Math.max(0, Math.ceil(72 - hoursSinceStart));

            // Invoke send-chat-reminder for both parties
            await supabaseAdmin.functions.invoke("send-chat-reminder", {
              body: {
                conversationId: conv.id,
                contractorUserId: conv.contractor_user_id,
                employeeUserId: conv.employee_user_id,
                contractorEmail: contractorProfile?.email,
                contractorName: contractorProfile?.first_name || contractorProfile?.full_name,
                employeeEmail: employeeProfile?.email,
                employeeName: employeeProfile?.first_name || employeeProfile?.full_name,
                jobTitle,
                hoursRemaining,
              },
            });

            // Update reminder tracking
            await supabaseAdmin
              .from("conversations")
              .update({
                reminder_count: conv.reminder_count + 1,
                reminder_sent_at: now.toISOString(),
              })
              .eq("id", conv.id);

            remindersSent++;
            logStep("Reminder sent", { conversationId: conv.id, reminderCount: conv.reminder_count + 1 });
          }
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        errors.push(`Conv ${conv.id}: ${errMsg}`);
        logStep("Error processing conversation", { conversationId: conv.id, error: errMsg });
      }
    }

    logStep("Cron job completed", { remindersSent, conversationsClosed, errors: errors.length });

    return new Response(JSON.stringify({ 
      success: true,
      remindersSent,
      conversationsClosed,
      errorsCount: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    }), {
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
