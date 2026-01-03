import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ContactEmailRequest {
  name: string;
  email: string;
  subject: string;
  message: string;
}

const subjectLabels: Record<string, string> = {
  general: "General Inquiry",
  support: "Support Request",
  partnerships: "Partnership Inquiry",
  feedback: "User Feedback",
  billing: "Billing Question",
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, email, subject, message }: ContactEmailRequest = await req.json();

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return new Response(
        JSON.stringify({ error: "All fields are required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const subjectLabel = subjectLabels[subject] || subject;
    const companyEmail = "support@workie.co.nz";

    // Send notification email to the company
    console.log("Sending notification email to company...");
    const notificationResponse = await resend.emails.send({
      from: "Workie Contact Form <onboarding@resend.dev>",
      to: [companyEmail],
      reply_to: email,
      subject: `[${subjectLabel}] New message from ${name}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
            .field { margin-bottom: 20px; }
            .field-label { font-weight: 600; color: #6b7280; font-size: 12px; text-transform: uppercase; margin-bottom: 4px; }
            .field-value { background: white; padding: 12px; border-radius: 8px; border: 1px solid #e5e7eb; }
            .message-box { background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; white-space: pre-wrap; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 24px;">New Contact Form Submission</h1>
              <p style="margin: 10px 0 0; opacity: 0.9;">${subjectLabel}</p>
            </div>
            <div class="content">
              <div class="field">
                <div class="field-label">From</div>
                <div class="field-value">${name} &lt;${email}&gt;</div>
              </div>
              <div class="field">
                <div class="field-label">Subject</div>
                <div class="field-value">${subjectLabel}</div>
              </div>
              <div class="field">
                <div class="field-label">Message</div>
                <div class="message-box">${message.replace(/\n/g, '<br>')}</div>
              </div>
              <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
                You can reply directly to this email to respond to ${name}.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Notification email sent:", notificationResponse);

    // Send confirmation email to the user
    console.log("Sending confirmation email to user...");
    const confirmationResponse = await resend.emails.send({
      from: "Workie <onboarding@resend.dev>",
      to: [email],
      subject: "We received your message!",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
            .highlight { background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 24px;">Thank You, ${name}!</h1>
              <p style="margin: 10px 0 0; opacity: 0.9;">We've received your message</p>
            </div>
            <div class="content">
              <p>Thanks for reaching out to us! We've received your message and our team will review it shortly.</p>
              
              <div class="highlight">
                <p style="margin: 0;"><strong>Subject:</strong> ${subjectLabel}</p>
                <p style="margin: 10px 0 0;"><strong>Your message:</strong></p>
                <p style="margin: 5px 0 0; color: #6b7280;">${message.substring(0, 200)}${message.length > 200 ? '...' : ''}</p>
              </div>
              
              <p><strong>What happens next?</strong></p>
              <p>Our team typically responds within 24 hours on business days. If your inquiry is urgent, please mention it in your message and we'll prioritize accordingly.</p>
              
              <div class="footer">
                <p>Best regards,<br><strong>The Workie Team</strong></p>
                <p style="margin-top: 20px; font-size: 12px; color: #9ca3af;">
                  This is an automated confirmation. Please do not reply to this email.
                </p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Confirmation email sent:", confirmationResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Emails sent successfully" 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-contact-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
