import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ValidateRequest {
  job_id: string;
}

interface ValidationResult {
  allowed: boolean;
  reason: string | null;
  active_applications: number;
  max_applications: number | null;
  cooldown_remaining_days: number | null;
  is_subscribed: boolean;
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
      console.error('[validate-application] No authorization header');
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
      console.error('[validate-application] Token validation failed:', claimsError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub as string;
    console.log('[validate-application] Authenticated user:', userId);

    // Parse request body
    const { job_id }: ValidateRequest = await req.json();

    if (!job_id) {
      return new Response(
        JSON.stringify({ error: 'job_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[validate-application] Validating application for job:', job_id);

    // 1. Get employee profile
    const { data: employeeProfile, error: empError } = await supabase
      .from('employee_profiles')
      .select('id, last_application_at, experience_years, industry')
      .eq('user_id', userId)
      .single();

    if (empError || !employeeProfile) {
      console.error('[validate-application] Employee profile not found:', empError);
      return new Response(
        JSON.stringify({
          allowed: false,
          reason: 'Please complete your profile before applying to jobs.',
          active_applications: 0,
          max_applications: null,
          cooldown_remaining_days: null,
          is_subscribed: false,
        } as ValidationResult),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Check if already applied to this job
    const { data: existingApp } = await supabase
      .from('job_applications')
      .select('id')
      .eq('job_id', job_id)
      .eq('employee_id', employeeProfile.id)
      .maybeSingle();

    if (existingApp) {
      return new Response(
        JSON.stringify({
          allowed: false,
          reason: 'You have already applied to this job.',
          active_applications: 0,
          max_applications: null,
          cooldown_remaining_days: null,
          is_subscribed: false,
        } as ValidationResult),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Get job details for experience validation
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, title, industry, experience_required')
      .eq('id', job_id)
      .single();

    if (jobError || !job) {
      console.error('[validate-application] Job not found:', jobError);
      return new Response(
        JSON.stringify({ error: 'Job not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Check experience requirements
    if (job.experience_required) {
      if (!employeeProfile.experience_years || employeeProfile.experience_years === 0) {
        return new Response(
          JSON.stringify({
            allowed: false,
            reason: 'This job requires experience. Your profile shows no work experience.',
            active_applications: 0,
            max_applications: null,
            cooldown_remaining_days: null,
            is_subscribed: false,
          } as ValidationResult),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (job.industry && employeeProfile.industry && job.industry !== employeeProfile.industry) {
        return new Response(
          JSON.stringify({
            allowed: false,
            reason: `This job requires experience in ${job.industry}. Your profile shows experience in ${employeeProfile.industry}.`,
            active_applications: 0,
            max_applications: null,
            cooldown_remaining_days: null,
            is_subscribed: false,
          } as ValidationResult),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (job.industry && !employeeProfile.industry) {
        return new Response(
          JSON.stringify({
            allowed: false,
            reason: `This job requires experience in ${job.industry}. Please update your profile to indicate your industry experience.`,
            active_applications: 0,
            max_applications: null,
            cooldown_remaining_days: null,
            is_subscribed: false,
          } as ValidationResult),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 5. Check subscription status
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('id, status')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    const isSubscribed = !!subscription;
    console.log('[validate-application] Subscription status:', isSubscribed ? 'active' : 'free');

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

    console.log('[validate-application] Settings:', { freeTierCooldownDays, paidTierMaxActiveApps, paidTierCooldownDays });

    // 7. Get active applications count (pending or shortlisted)
    const { count: activeAppsCount } = await supabase
      .from('job_applications')
      .select('id', { count: 'exact', head: true })
      .eq('employee_id', employeeProfile.id)
      .in('status', ['pending', 'shortlisted']);

    const activeApplications = activeAppsCount || 0;
    console.log('[validate-application] Active applications:', activeApplications);

    // 8. Calculate cooldown
    let cooldownRemainingDays: number | null = null;
    const cooldownDays = isSubscribed ? paidTierCooldownDays : freeTierCooldownDays;

    if (employeeProfile.last_application_at) {
      const lastAppDate = new Date(employeeProfile.last_application_at);
      const now = new Date();
      const daysSinceLastApp = Math.floor((now.getTime() - lastAppDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysSinceLastApp < cooldownDays) {
        cooldownRemainingDays = cooldownDays - daysSinceLastApp;
        return new Response(
          JSON.stringify({
            allowed: false,
            reason: `You must wait ${cooldownRemainingDays} more day${cooldownRemainingDays > 1 ? 's' : ''} before applying to another job.`,
            active_applications: activeApplications,
            max_applications: isSubscribed ? paidTierMaxActiveApps : 1,
            cooldown_remaining_days: cooldownRemainingDays,
            is_subscribed: isSubscribed,
          } as ValidationResult),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 9. Check application slots
    if (isSubscribed) {
      // Subscribed users: check against max active apps
      if (activeApplications >= paidTierMaxActiveApps) {
        return new Response(
          JSON.stringify({
            allowed: false,
            reason: `You have reached your limit of ${paidTierMaxActiveApps} active applications. Wait for a response or withdraw an existing application.`,
            active_applications: activeApplications,
            max_applications: paidTierMaxActiveApps,
            cooldown_remaining_days: null,
            is_subscribed: isSubscribed,
          } as ValidationResult),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Free users: only 1 active application allowed
      if (activeApplications >= 1) {
        return new Response(
          JSON.stringify({
            allowed: false,
            reason: "You've reached the limit for free applications. Boost your job search with Workie Premium! Get unlimited applications, and access to our premium features!",
            active_applications: activeApplications,
            max_applications: 1,
            cooldown_remaining_days: null,
            is_subscribed: isSubscribed,
          } as ValidationResult),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // All validations passed
    console.log('[validate-application] Validation passed');
    
    return new Response(
      JSON.stringify({
        allowed: true,
        reason: null,
        active_applications: activeApplications,
        max_applications: isSubscribed ? paidTierMaxActiveApps : 1,
        cooldown_remaining_days: null,
        is_subscribed: isSubscribed,
      } as ValidationResult),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[validate-application] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
