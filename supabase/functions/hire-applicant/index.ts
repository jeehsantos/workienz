import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HireRequest {
  application_id: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[hire-applicant] No authorization header');
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate the user's token using getClaims
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      console.error('[hire-applicant] Token validation failed:', claimsError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub as string;
    console.log('[hire-applicant] Authenticated user:', userId);

    // Parse request body
    const { application_id }: HireRequest = await req.json();

    if (!application_id) {
      return new Response(
        JSON.stringify({ error: 'application_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[hire-applicant] Processing application:', application_id);

    // 1. Get the application details with job info
    const { data: application, error: appError } = await supabase
      .from('job_applications')
      .select(`
        id,
        job_id,
        employee_id,
        status
      `)
      .eq('id', application_id)
      .single();

    if (appError || !application) {
      console.error('[hire-applicant] Application not found:', appError);
      return new Response(
        JSON.stringify({ error: 'Application not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Verify the contractor owns this job
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select(`
        id,
        title,
        contractor_id
      `)
      .eq('id', application.job_id)
      .single();

    if (jobError || !job) {
      console.error('[hire-applicant] Job not found:', jobError);
      return new Response(
        JSON.stringify({ error: 'Job not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check contractor ownership
    const { data: contractorProfile, error: contractorError } = await supabase
      .from('contractor_profiles')
      .select('id, user_id')
      .eq('id', job.contractor_id)
      .single();

    if (contractorError || !contractorProfile || contractorProfile.user_id !== userId) {
      console.error('[hire-applicant] Unauthorized - not the job owner');
      return new Response(
        JSON.stringify({ error: 'You are not authorized to hire for this job' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Get employee info
    const { data: employeeProfile, error: empError } = await supabase
      .from('employee_profiles')
      .select('id, user_id')
      .eq('id', application.employee_id)
      .single();

    if (empError || !employeeProfile) {
      console.error('[hire-applicant] Employee profile not found:', empError);
      return new Response(
        JSON.stringify({ error: 'Employee profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get employee's name for the message
    const { data: employeeUserProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', employeeProfile.user_id)
      .single();

    const employeeName = employeeUserProfile?.full_name || 'Applicant';

    // BEGIN TRANSACTIONAL OPERATIONS
    console.log('[hire-applicant] Starting transactional hire process...');

    // 4. Update application status to 'hired'
    const { error: updateAppError } = await supabase
      .from('job_applications')
      .update({ status: 'hired' })
      .eq('id', application_id);

    if (updateAppError) {
      console.error('[hire-applicant] Failed to update application status:', updateAppError);
      return new Response(
        JSON.stringify({ error: 'Failed to update application status' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[hire-applicant] Application status updated to hired');

    // 5. Update worker availability status
    const { error: updateEmpError } = await supabase
      .from('employee_profiles')
      .update({ is_available: false })
      .eq('id', application.employee_id);

    if (updateEmpError) {
      console.error('[hire-applicant] Failed to update worker availability:', updateEmpError);
      // Rollback application status
      await supabase
        .from('job_applications')
        .update({ status: application.status })
        .eq('id', application_id);
      return new Response(
        JSON.stringify({ error: 'Failed to update worker availability' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[hire-applicant] Worker availability updated');

    // 6. Find or create conversation for this application
    let conversationId: string | null = null;
    
    const { data: existingConv } = await supabase
      .from('conversations')
      .select('id')
      .eq('job_application_id', application_id)
      .single();

    if (existingConv) {
      conversationId = existingConv.id;
    } else {
      // Create conversation if it doesn't exist
      const { data: newConv, error: convError } = await supabase
        .from('conversations')
        .insert({
          job_application_id: application_id,
          contractor_user_id: userId,
          employee_user_id: employeeProfile.user_id,
        })
        .select('id')
        .single();

      if (convError) {
        console.error('[hire-applicant] Failed to create conversation:', convError);
      } else {
        conversationId = newConv.id;
      }
    }

    // 7. Send congratulations system message in chat
    if (conversationId) {
      const hireMessage = {
        type: 'hire_notification',
        title: '🎉 Congratulations!',
        message: `You've been selected for the position: ${job.title}`,
        details: 'The employer will contact you with next steps. Your availability status has been updated.',
        timestamp: new Date().toISOString(),
      };

      const { error: msgError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_user_id: userId,
          content: `🎉 **CONGRATULATIONS ${employeeName.toUpperCase()}!**\n\nYou have been officially selected for the position: **${job.title}**\n\n✅ Your application status has been updated to "Hired"\n✅ Your availability status has been set to busy\n\nThe employer will be in touch with next steps. Good luck with your new role!`,
        });

      if (msgError) {
        console.error('[hire-applicant] Failed to send hire message:', msgError);
      } else {
        console.log('[hire-applicant] Hire notification message sent');
      }
    }

    // 8. Create notification for the worker
    const { error: notifError } = await supabase
      .from('notifications')
      .insert({
        user_id: employeeProfile.user_id,
        type: 'hired',
        title: '🎉 You\'ve been hired!',
        message: `Congratulations! You have been selected for the position: ${job.title}`,
        action_url: conversationId ? `/conversation/${conversationId}` : '/dashboard',
        metadata: {
          job_id: job.id,
          job_title: job.title,
          application_id: application_id,
        },
      });

    if (notifError) {
      console.error('[hire-applicant] Failed to create notification:', notifError);
    } else {
      console.log('[hire-applicant] Notification created for worker');
    }

    // 9. Close other pending applications for this job (optional - auto-reject)
    const { error: rejectError } = await supabase
      .from('job_applications')
      .update({ status: 'rejected' })
      .eq('job_id', application.job_id)
      .neq('id', application_id)
      .eq('status', 'pending');

    if (rejectError) {
      console.error('[hire-applicant] Failed to reject other applications:', rejectError);
    } else {
      console.log('[hire-applicant] Other pending applications rejected');
    }

    console.log('[hire-applicant] Hire process completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Applicant hired successfully',
        data: {
          application_id,
          job_title: job.title,
          employee_name: employeeName,
          conversation_id: conversationId,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[hire-applicant] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
