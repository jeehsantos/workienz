import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SubmitRequest {
  job_id: string;
  cover_letter?: string;
}

// Constants for application limits
const MAX_CONCURRENT_APPLICATIONS = 3;
const BASE_FREE_TIER_APPLICATIONS = 1;

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[submit-application] No authorization header');
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

    // Validate the user's token
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      console.error('[submit-application] Token validation failed:', claimsError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub as string;
    console.log('[submit-application] Authenticated user:', userId);

    // Parse request body
    const { job_id, cover_letter }: SubmitRequest = await req.json();

    if (!job_id) {
      return new Response(
        JSON.stringify({ error: 'job_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[submit-application] Processing application for job:', job_id);

    // 1. Get employee profile
    const { data: employeeProfile, error: empError } = await supabase
      .from('employee_profiles')
      .select('id, last_application_at, experience_years, industry')
      .eq('user_id', userId)
      .single();

    if (empError || !employeeProfile) {
      console.error('[submit-application] Employee profile not found:', empError);
      return new Response(
        JSON.stringify({ error: 'Please complete your profile before applying to jobs.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Check if already applied
    const { data: existingApp } = await supabase
      .from('job_applications')
      .select('id')
      .eq('job_id', job_id)
      .eq('employee_id', employeeProfile.id)
      .maybeSingle();

    if (existingApp) {
      return new Response(
        JSON.stringify({ error: 'You have already applied to this job.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Get job details
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, title, industry, experience_required, contractor_id')
      .eq('id', job_id)
      .single();

    if (jobError || !job) {
      console.error('[submit-application] Job not found:', jobError);
      return new Response(
        JSON.stringify({ error: 'Job not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Check experience requirements
    if (job.experience_required) {
      if (!employeeProfile.experience_years || employeeProfile.experience_years === 0) {
        return new Response(
          JSON.stringify({ error: 'This job requires experience. Your profile shows no work experience.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (job.industry && employeeProfile.industry && job.industry !== employeeProfile.industry) {
        return new Response(
          JSON.stringify({ error: `This job requires experience in ${job.industry}. Your profile shows experience in ${employeeProfile.industry}.` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 5. Check subscription status
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    const isSubscribed = !!subscription;

    // 6. Fetch platform settings
    const { data: settings } = await supabase
      .from('platform_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['free_tier_cooldown_days', 'paid_tier_max_active_apps', 'paid_tier_cooldown_days']);

    const settingsMap: Record<string, number> = {};
    settings?.forEach(s => {
      settingsMap[s.setting_key] = parseInt(s.setting_value) || 0;
    });

    const freeTierCooldownDays = settingsMap['free_tier_cooldown_days'] || 3;
    const paidTierMaxActiveApps = settingsMap['paid_tier_max_active_apps'] || 3;
    const paidTierCooldownDays = settingsMap['paid_tier_cooldown_days'] || 3;

    // 7. Get active applications count
    const { count: activeAppsCount } = await supabase
      .from('job_applications')
      .select('id', { count: 'exact', head: true })
      .eq('employee_id', employeeProfile.id)
      .in('status', ['pending', 'shortlisted']);

    const activeApplications = activeAppsCount || 0;

    // 8. Get referral credits for free tier users
    let referralCreditsRemaining = 0;
    let referralCreditsRecord: any = null;
    
    if (!isSubscribed) {
      const { data: referralCredits } = await supabase
        .from('employee_referral_credits')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (referralCredits && !referralCredits.is_shadow_banned) {
        referralCreditsRemaining = referralCredits.bonus_credits_balance - referralCredits.bonus_credits_used;
        referralCreditsRecord = referralCredits;
      }
    }

    // 9. Calculate total available applications for free tier
    const totalFreeApplications = BASE_FREE_TIER_APPLICATIONS + referralCreditsRemaining;

    // 10. Calculate cooldown - only applies to paid users OR free users who have exhausted their credits
    // Free tier users with available referral credits can apply without cooldown
    const cooldownDays = isSubscribed ? paidTierCooldownDays : freeTierCooldownDays;
    
    // For free tier: cooldown only applies if they're trying to use the base application again
    // (i.e., they have no referral credits remaining and have already used their base slot)
    const shouldApplyCooldown = isSubscribed || (activeApplications >= BASE_FREE_TIER_APPLICATIONS && referralCreditsRemaining <= 0);

    if (shouldApplyCooldown && employeeProfile.last_application_at) {
      const lastAppDate = new Date(employeeProfile.last_application_at);
      const now = new Date();
      const daysSinceLastApp = Math.floor((now.getTime() - lastAppDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysSinceLastApp < cooldownDays) {
        const remaining = cooldownDays - daysSinceLastApp;
        return new Response(
          JSON.stringify({ error: `You must wait ${remaining} more day${remaining > 1 ? 's' : ''} before applying to another job.` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 11. Check application slots with queue system
    if (isSubscribed) {
      if (activeApplications >= paidTierMaxActiveApps) {
        return new Response(
          JSON.stringify({ error: `You have reached your limit of ${paidTierMaxActiveApps} active applications.` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Free tier logic with referral credits and queue system
      
      // First, check the concurrency limit (max 3 active at any time)
      if (activeApplications >= MAX_CONCURRENT_APPLICATIONS) {
        return new Response(
          JSON.stringify({ 
            error: `You have ${activeApplications} active applications. The maximum concurrent applications is ${MAX_CONCURRENT_APPLICATIONS}. Please wait for a response on your current applications before applying to more jobs.`,
            remaining_credits: referralCreditsRemaining,
            active_applications: activeApplications,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if user has any available application credits
      // Free tier users get 1 base application + any referral bonus credits
      // Total allowed = BASE_FREE_TIER_APPLICATIONS (1) + referral credits remaining
      const totalAllowedApplications = BASE_FREE_TIER_APPLICATIONS + referralCreditsRemaining;
      
      console.log('[submit-application] Free tier credit check:', {
        activeApplications,
        referralCreditsRemaining,
        totalAllowedApplications,
        canApply: activeApplications < totalAllowedApplications
      });

      // Check if user can still apply (have available credits)
      if (activeApplications >= totalAllowedApplications) {
        return new Response(
          JSON.stringify({ 
            error: "You've reached the limit for free applications. Boost your job search with Workie Premium! Get unlimited applications, and access to our premium features! Alternatively, invite friends to earn more application credits.",
            upgrade_prompt: true,
            remaining_credits: referralCreditsRemaining,
            active_applications: activeApplications,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 12. All validations passed - create the application
    console.log('[submit-application] All validations passed, creating application');

    const { data: appData, error: appError } = await supabase
      .from('job_applications')
      .insert({
        job_id,
        employee_id: employeeProfile.id,
        cover_letter: cover_letter || null,
      })
      .select('id')
      .single();

    if (appError || !appData) {
      console.error('[submit-application] Failed to create application:', appError);
      return new Response(
        JSON.stringify({ error: 'Failed to submit application. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 13. Update last_application_at
    await supabase
      .from('employee_profiles')
      .update({ last_application_at: new Date().toISOString() })
      .eq('id', employeeProfile.id);

    // 14. If using referral credits (free tier, not the base application), consume one
    if (!isSubscribed && referralCreditsRecord && activeApplications >= BASE_FREE_TIER_APPLICATIONS) {
      await supabase
        .from('employee_referral_credits')
        .update({ 
          bonus_credits_used: referralCreditsRecord.bonus_credits_used + 1,
        })
        .eq('user_id', userId);

      console.log('[submit-application] Consumed 1 referral credit for user:', userId);
    }

    // 15. Get contractor info for conversation
    const { data: contractorProfile } = await supabase
      .from('contractor_profiles')
      .select('user_id')
      .eq('id', job.contractor_id)
      .single();

    // 16. Create conversation
    let conversationId: string | null = null;
    if (contractorProfile) {
      const { data: convData } = await supabase
        .from('conversations')
        .insert({
          job_application_id: appData.id,
          contractor_user_id: contractorProfile.user_id,
          employee_user_id: userId,
        })
        .select('id')
        .single();

      conversationId = convData?.id || null;

      // Send cover letter as first message if provided
      if (conversationId && cover_letter?.trim()) {
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', userId)
          .single();

        const introMessage = `📋 **Application for: ${job.title}**\n\nHi, I'm ${userProfile?.full_name || 'a job seeker'} and I'd like to apply for this position.\n\n**Cover Letter:**\n${cover_letter}`;

        await supabase.from('messages').insert({
          conversation_id: conversationId,
          sender_user_id: userId,
          content: introMessage,
        });
      }
    }

    console.log('[submit-application] Application created successfully:', appData.id);

    // Calculate remaining credits for response
    const newReferralCreditsRemaining = referralCreditsRecord 
      ? Math.max(0, referralCreditsRemaining - (activeApplications >= BASE_FREE_TIER_APPLICATIONS ? 1 : 0))
      : 0;

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Application submitted successfully',
        data: {
          application_id: appData.id,
          conversation_id: conversationId,
          remaining_referral_credits: newReferralCreditsRemaining,
          active_applications: activeApplications + 1,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[submit-application] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
