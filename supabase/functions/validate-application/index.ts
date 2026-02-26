import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/**
 * ADVISORY-ONLY endpoint.
 * Returns informational data for frontend UX hints.
 * Does NOT enforce any rules — submit-application is the single source of truth.
 */

interface AdvisoryResult {
  can_apply_hint: boolean;
  hint_reason: string | null;
  active_applications: number;
  max_applications: number | null;
  cooldown_remaining_days: number | null;
  is_subscribed: boolean;
  referral_credits_remaining: number;
  has_profile: boolean;
  already_applied: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
    const { job_id } = await req.json();

    if (!job_id) {
      return new Response(
        JSON.stringify({ error: 'job_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // All queries in parallel for performance
    const [empResult, subResult, settingsResult, refResult] = await Promise.all([
      supabase.from('employee_profiles').select('id, last_application_at').eq('user_id', userId).maybeSingle(),
      supabase.from('subscriptions').select('id').eq('user_id', userId).eq('status', 'active').maybeSingle(),
      supabase.from('platform_settings').select('setting_key, setting_value').in('setting_key', ['free_tier_cooldown_days', 'paid_tier_max_active_apps', 'paid_tier_cooldown_days']),
      supabase.from('employee_referral_credits').select('bonus_credits_balance, bonus_credits_used, is_shadow_banned').eq('user_id', userId).maybeSingle(),
    ]);

    const hasProfile = !!empResult.data;
    const isSubscribed = !!subResult.data;

    if (!hasProfile) {
      const result: AdvisoryResult = {
        can_apply_hint: false,
        hint_reason: 'Please complete your profile before applying to jobs.',
        active_applications: 0,
        max_applications: null,
        cooldown_remaining_days: null,
        is_subscribed: false,
        referral_credits_remaining: 0,
        has_profile: false,
        already_applied: false,
      };
      return new Response(JSON.stringify(result), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const emp = empResult.data;

    // Batch 2: queries needing employee id
    const [existingAppResult, activeAppsResult] = await Promise.all([
      supabase.from('job_applications').select('id').eq('job_id', job_id).eq('employee_id', emp.id).maybeSingle(),
      supabase.from('job_applications').select('id', { count: 'exact', head: true }).eq('employee_id', emp.id).in('status', ['pending', 'shortlisted']),
    ]);

    const alreadyApplied = !!existingAppResult.data;
    const activeApplications = activeAppsResult.count || 0;

    // Parse settings
    const settingsMap: Record<string, number> = {};
    settingsResult.data?.forEach(s => { settingsMap[s.setting_key] = parseInt(s.setting_value) || 0; });
    const freeTierCooldownDays = settingsMap['free_tier_cooldown_days'] || 3;
    const paidTierMaxActiveApps = settingsMap['paid_tier_max_active_apps'] || 3;
    const paidTierCooldownDays = settingsMap['paid_tier_cooldown_days'] || 3;

    // Referral credits
    let referralCreditsRemaining = 0;
    if (!isSubscribed && refResult.data && !refResult.data.is_shadow_banned) {
      referralCreditsRemaining = refResult.data.bonus_credits_balance - refResult.data.bonus_credits_used;
    }

    // Cooldown hint
    let cooldownRemainingDays: number | null = null;
    const cooldownDays = isSubscribed ? paidTierCooldownDays : freeTierCooldownDays;
    const shouldCheckCooldown = isSubscribed || (activeApplications >= 1 && referralCreditsRemaining <= 0);

    if (shouldCheckCooldown && emp.last_application_at) {
      const daysSince = Math.floor((Date.now() - new Date(emp.last_application_at).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince < cooldownDays) {
        cooldownRemainingDays = cooldownDays - daysSince;
      }
    }

    // Build advisory hint
    let canApplyHint = true;
    let hintReason: string | null = null;

    if (alreadyApplied) {
      canApplyHint = false;
      hintReason = 'You have already applied to this job.';
    } else if (cooldownRemainingDays && cooldownRemainingDays > 0) {
      canApplyHint = false;
      hintReason = `You must wait ${cooldownRemainingDays} more day${cooldownRemainingDays > 1 ? 's' : ''} before applying to another job.`;
    } else if (isSubscribed && activeApplications >= paidTierMaxActiveApps) {
      canApplyHint = false;
      hintReason = `You have reached your limit of ${paidTierMaxActiveApps} active applications.`;
    } else if (!isSubscribed) {
      const totalAllowed = 1 + referralCreditsRemaining;
      if (activeApplications >= totalAllowed) {
        canApplyHint = false;
        hintReason = "You've reached the limit for free applications. Upgrade to Premium or invite friends to earn more credits.";
      }
    }

    const result: AdvisoryResult = {
      can_apply_hint: canApplyHint,
      hint_reason: hintReason,
      active_applications: activeApplications,
      max_applications: isSubscribed ? paidTierMaxActiveApps : 1 + referralCreditsRemaining,
      cooldown_remaining_days: cooldownRemainingDays,
      is_subscribed: isSubscribed,
      referral_credits_remaining: referralCreditsRemaining,
      has_profile: true,
      already_applied: alreadyApplied,
    };

    return new Response(JSON.stringify(result), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[validate-application] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
