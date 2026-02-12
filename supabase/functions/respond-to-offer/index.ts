import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[RESPOND-TO-OFFER] ${step}${detailsStr}`);
};

interface RespondRequest {
  application_id: string;
  response: 'accept' | 'decline';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Function started');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub as string;
    logStep('Authenticated user', { userId });

    const { application_id, response: offerResponse }: RespondRequest = await req.json();

    if (!application_id || !offerResponse || !['accept', 'decline'].includes(offerResponse)) {
      return new Response(
        JSON.stringify({ error: 'application_id and response (accept/decline) are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logStep('Processing response', { application_id, response: offerResponse });

    // 1. Get the application and verify the employee owns it
    const { data: application, error: appError } = await supabase
      .from('job_applications')
      .select('id, job_id, employee_id, status')
      .eq('id', application_id)
      .single();

    if (appError || !application) {
      return new Response(
        JSON.stringify({ error: 'Application not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the employee owns this application
    const { data: employeeProfile } = await supabase
      .from('employee_profiles')
      .select('id, user_id')
      .eq('id', application.employee_id)
      .single();

    if (!employeeProfile || employeeProfile.user_id !== userId) {
      return new Response(
        JSON.stringify({ error: 'You are not authorized to respond to this offer' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (application.status !== 'pending') {
      return new Response(
        JSON.stringify({ error: 'This offer has already been responded to' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Verify this is a private job (offer flow)
    const { data: job } = await supabase
      .from('jobs')
      .select('id, title, status, contractor_id')
      .eq('id', application.job_id)
      .single();

    if (!job) {
      return new Response(
        JSON.stringify({ error: 'Job not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (job.status !== 'private') {
      return new Response(
        JSON.stringify({ error: 'This action is only available for direct position offers' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get contractor info
    const { data: contractorProfile } = await supabase
      .from('contractor_profiles')
      .select('id, user_id')
      .eq('id', job.contractor_id)
      .single();

    // Get names
    const { data: employeeUserProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', userId)
      .single();

    const employeeName = employeeUserProfile?.full_name || 'Worker';

    // Get conversation
    const { data: conversation } = await supabase
      .from('conversations')
      .select('id')
      .eq('job_application_id', application_id)
      .single();

    const conversationId = conversation?.id || null;

    if (offerResponse === 'accept') {
      // ACCEPT: Update application to 'shortlisted' (contractor can now hire)
      await supabase
        .from('job_applications')
        .update({ status: 'shortlisted' })
        .eq('id', application_id);

      logStep('Application accepted (shortlisted)');

      // Send acceptance message in chat
      if (conversationId) {
        await supabase.from('messages').insert({
          conversation_id: conversationId,
          sender_user_id: userId,
          content: `✅ **Offer Accepted**\n\nI'm interested in the position "${job.title}" and would like to accept this offer!\n\nLooking forward to the next steps.`,
        });
      }

      // Notify the contractor
      if (contractorProfile) {
        await supabase.from('notifications').insert({
          user_id: contractorProfile.user_id,
          type: 'offer_accepted',
          title: '✅ Offer Accepted!',
          message: `${employeeName} has accepted your position offer for "${job.title}". You can now confirm the hire.`,
          action_url: conversationId ? `/messages/${conversationId}` : '/dashboard',
          metadata: {
            job_id: job.id,
            job_title: job.title,
            application_id: application_id,
          },
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Offer accepted successfully',
          data: { new_status: 'shortlisted' },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      // DECLINE: Update application to 'rejected', close conversation
      await supabase
        .from('job_applications')
        .update({ status: 'rejected' })
        .eq('id', application_id);

      logStep('Application declined (rejected)');

      // Send decline message in chat
      if (conversationId) {
        await supabase.from('messages').insert({
          conversation_id: conversationId,
          sender_user_id: userId,
          content: `❌ **Offer Declined**\n\nThank you for the offer for "${job.title}", but I'm unable to accept at this time.\n\nI appreciate the opportunity and wish you the best in finding the right candidate.`,
        });

        // Close conversation and schedule deletion
        const deletionAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await supabase
          .from('conversations')
          .update({
            status: 'closed',
            scheduled_deletion_at: deletionAt.toISOString(),
          })
          .eq('id', conversationId);
      }

      // Notify the contractor
      if (contractorProfile) {
        await supabase.from('notifications').insert({
          user_id: contractorProfile.user_id,
          type: 'offer_declined',
          title: '❌ Offer Declined',
          message: `${employeeName} has declined your position offer for "${job.title}".`,
          action_url: conversationId ? `/messages/${conversationId}` : '/dashboard',
          metadata: {
            job_id: job.id,
            job_title: job.title,
            application_id: application_id,
          },
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Offer declined',
          data: { new_status: 'rejected' },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    logStep('ERROR', { message: error instanceof Error ? error.message : String(error) });
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
