import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[OFFER-POSITION] ${step}${detailsStr}`);
};

interface OfferRequest {
  job_id: string;
  employee_user_id: string;
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

    // Validate token
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub as string;
    logStep('Authenticated user', { userId });

    // Verify contractor role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'contractor')
      .single();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: 'Only contractors can offer positions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { job_id, employee_user_id }: OfferRequest = await req.json();

    if (!job_id || !employee_user_id) {
      return new Response(
        JSON.stringify({ error: 'job_id and employee_user_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logStep('Offer request', { job_id, employee_user_id });

    // 1. Verify the job belongs to this contractor and is private
    const { data: contractorProfile } = await supabase
      .from('contractor_profiles')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!contractorProfile) {
      return new Response(
        JSON.stringify({ error: 'Contractor profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, title, status, contractor_id')
      .eq('id', job_id)
      .single();

    if (jobError || !job) {
      return new Response(
        JSON.stringify({ error: 'Job not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (job.contractor_id !== contractorProfile.id) {
      return new Response(
        JSON.stringify({ error: 'You do not own this job' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (job.status !== 'private') {
      return new Response(
        JSON.stringify({ error: 'Only private jobs can be used for direct offers. Please post the job as private first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Verify the employee exists and is a favorited worker
    const { data: employeeProfile } = await supabase
      .from('employee_profiles')
      .select('id, user_id')
      .eq('user_id', employee_user_id)
      .single();

    if (!employeeProfile) {
      return new Response(
        JSON.stringify({ error: 'Employee profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: favorite } = await supabase
      .from('contractor_favorite_workers')
      .select('id')
      .eq('contractor_user_id', userId)
      .eq('employee_user_id', employee_user_id)
      .maybeSingle();

    if (!favorite) {
      return new Response(
        JSON.stringify({ error: 'This worker is not in your favorites. You can only offer positions to favorited workers.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Check for existing application
    const { data: existingApp } = await supabase
      .from('job_applications')
      .select('id')
      .eq('job_id', job_id)
      .eq('employee_id', employeeProfile.id)
      .maybeSingle();

    if (existingApp) {
      return new Response(
        JSON.stringify({ error: 'An application already exists for this worker on this job.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Auto-create the job application
    const { data: newApp, error: appError } = await supabase
      .from('job_applications')
      .insert({
        job_id,
        employee_id: employeeProfile.id,
        status: 'pending',
        cover_letter: null,
      })
      .select('id')
      .single();

    if (appError || !newApp) {
      logStep('Failed to create application', { error: appError });
      return new Response(
        JSON.stringify({ error: 'Failed to create application' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logStep('Application created', { applicationId: newApp.id });

    // 5. Create conversation
    const { data: newConv, error: convError } = await supabase
      .from('conversations')
      .insert({
        job_application_id: newApp.id,
        contractor_user_id: userId,
        employee_user_id: employee_user_id,
      })
      .select('id')
      .single();

    if (convError) {
      logStep('Failed to create conversation', { error: convError });
    }

    const conversationId = newConv?.id || null;

    // 6. Get names for the message
    const { data: contractorUser } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', userId)
      .single();

    const { data: employeeUser } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', employee_user_id)
      .single();

    // 7. Send offer message in chat
    if (conversationId) {
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_user_id: userId,
        content: `💼 **Position Offer**\n\nHi ${employeeUser?.full_name || 'there'}! I'd like to offer you a position:\n\n**${job.title}**\n\nI enjoyed working with you previously and would love to have you on board again. Please let me know if you're interested!\n\nThe employer can mark you as "Hired" once you accept.`,
      });

      logStep('Offer message sent');
    }

    // 8. Create notification for the employee
    await supabase.from('notifications').insert({
      user_id: employee_user_id,
      type: 'position_offer',
      title: '💼 New Position Offer!',
      message: `${contractorUser?.full_name || 'An employer'} has offered you a position: ${job.title}`,
      action_url: conversationId ? `/messages/${conversationId}` : '/dashboard',
      metadata: {
        job_id: job.id,
        job_title: job.title,
        application_id: newApp.id,
        contractor_user_id: userId,
      },
    });

    logStep('Notification created for employee');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Position offered successfully',
        data: {
          application_id: newApp.id,
          conversation_id: conversationId,
          job_title: job.title,
          employee_name: employeeUser?.full_name || 'Worker',
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    logStep('ERROR', { message: error instanceof Error ? error.message : String(error) });
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
