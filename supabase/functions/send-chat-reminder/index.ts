import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-CHAT-REMINDER] ${step}${detailsStr}`);
};

interface ReminderRequest {
  conversationId: string;
  contractorUserId: string;
  employeeUserId: string;
  contractorEmail: string;
  contractorName?: string;
  employeeEmail: string;
  employeeName?: string;
  jobTitle: string;
  hoursRemaining: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require service-role authorization (function is invoked by other edge functions / cron)
    const authHeader = req.headers.get("authorization") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const expected = `Bearer ${serviceKey}`;
    if (!serviceKey || authHeader !== expected) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    logStep("Function started");

    const {
      conversationId,
      contractorUserId,
      employeeUserId,
      contractorEmail,
      contractorName,
      employeeEmail,
      employeeName,
      jobTitle,
      hoursRemaining,
    }: ReminderRequest = await req.json();

    logStep("Request received", { conversationId, jobTitle, hoursRemaining });

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const createEmailHtml = (recipientName: string, otherPartyName: string) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #f59e0b, #ef4444); padding: 40px 24px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">⏰ Conversation Expiring Soon</h1>
          </div>
          <div style="padding: 32px 24px;">
            <p style="font-size: 16px; color: #333; margin-bottom: 16px;">
              Hi ${recipientName || "there"},
            </p>
            <p style="font-size: 16px; color: #555; margin-bottom: 24px;">
              Your conversation with <strong>${otherPartyName || "a user"}</strong> about 
              <strong style="color: #6366f1;">"${jobTitle}"</strong> will close in 
              <strong style="color: #ef4444;">${hoursRemaining} hours</strong> if there's no response.
            </p>
            <div style="background: #fef3c7; border-radius: 8px; padding: 20px; margin-bottom: 24px; border-left: 4px solid #f59e0b;">
              <p style="margin: 0; color: #92400e; font-weight: 500;">
                💬 Send a message now to keep this conversation active!
              </p>
            </div>
            <a href="https://workie.co.nz/messages/${conversationId}" style="display: inline-block; background: #6366f1; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; margin-bottom: 24px;">
              Reply Now
            </a>
            <p style="font-size: 14px; color: #888; margin-top: 24px;">
              If no messages are sent within ${hoursRemaining} hours, this conversation will be automatically closed.
            </p>
          </div>
          <div style="background: #f8f9fa; padding: 20px 24px; text-align: center; border-top: 1px solid #eee;">
            <p style="margin: 0; font-size: 12px; color: #888;">
              © ${new Date().getFullYear()} Workie. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const emailsSent: string[] = [];
    const notificationsCreated: string[] = [];

    // Send to contractor
    if (contractorEmail) {
      try {
        await resend.emails.send({
          from: "Workie <noreply@workie.co.nz>",
          to: [contractorEmail],
          subject: `⏰ Your conversation about "${jobTitle}" is expiring soon`,
          html: createEmailHtml(contractorName || "there", employeeName || "a job seeker"),
        });
        emailsSent.push(contractorEmail);
        logStep("Email sent to contractor", { email: contractorEmail });
      } catch (err) {
        logStep("Error sending to contractor", { error: String(err) });
      }
    }

    // Send to employee
    if (employeeEmail) {
      try {
        await resend.emails.send({
          from: "Workie <noreply@workie.co.nz>",
          to: [employeeEmail],
          subject: `⏰ Your conversation about "${jobTitle}" is expiring soon`,
          html: createEmailHtml(employeeName || "there", contractorName || "an employer"),
        });
        emailsSent.push(employeeEmail);
        logStep("Email sent to employee", { email: employeeEmail });
      } catch (err) {
        logStep("Error sending to employee", { error: String(err) });
      }
    }

    // Create in-app notifications for both parties
    const notifications = [
      {
        user_id: contractorUserId,
        type: "chat_expiry_warning",
        title: "Conversation Expiring Soon",
        message: `Your conversation about "${jobTitle}" will close in ${hoursRemaining} hours. Send a message to keep it active!`,
        action_url: `/messages/${conversationId}`,
        metadata: { 
          conversation_id: conversationId, 
          job_title: jobTitle, 
          hours_remaining: hoursRemaining 
        },
      },
      {
        user_id: employeeUserId,
        type: "chat_expiry_warning",
        title: "Conversation Expiring Soon",
        message: `Your conversation about "${jobTitle}" will close in ${hoursRemaining} hours. Send a message to keep it active!`,
        action_url: `/messages/${conversationId}`,
        metadata: { 
          conversation_id: conversationId, 
          job_title: jobTitle, 
          hours_remaining: hoursRemaining 
        },
      },
    ];

    const { error: notifError } = await supabaseAdmin
      .from("notifications")
      .insert(notifications);

    if (notifError) {
      logStep("Error creating notifications", { error: notifError.message });
    } else {
      notificationsCreated.push(contractorUserId, employeeUserId);
      logStep("Notifications created", { count: 2 });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      emailsSent,
      notificationsCreated,
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
