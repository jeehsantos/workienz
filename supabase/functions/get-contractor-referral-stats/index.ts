import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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

    // Get referral code
    const { data: codeRecord } = await supabase
      .from('contractor_referral_codes')
      .select('referral_code, is_active')
      .eq('user_id', userId)
      .maybeSingle();

    // Get all referrals made by this user
    const { data: referrals } = await supabase
      .from('contractor_referrals')
      .select('id, status, created_at, qualified_at, referred_user_id')
      .eq('referrer_user_id', userId)
      .order('created_at', { ascending: false });

    // Get profiles for referred users
    const referredUserIds = referrals?.map(r => r.referred_user_id) || [];
    let profileMap = new Map<string, { first_name: string | null; full_name: string | null }>();
    if (referredUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, full_name')
        .in('user_id', referredUserIds);
      profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
    }

    // Get all rewards for this user
    const { data: rewards } = await supabase
      .from('contractor_referral_rewards')
      .select('id, referral_id, days_granted, granted_at')
      .eq('referrer_user_id', userId)
      .order('granted_at', { ascending: false });

    // Calculate totals
    const totalSignups = referrals?.length || 0;
    const qualifiedCount = referrals?.filter(r => r.status === 'qualified').length || 0;
    const pendingCount = referrals?.filter(r => r.status === 'pending').length || 0;
    const totalDaysEarned = rewards?.reduce((sum, r) => sum + r.days_granted, 0) || 0;

    // Get active premium entitlement (referral-based)
    const { data: premiumEntitlement } = await supabase
      .from('contractor_entitlements')
      .select('id, plan_type, expires_at, status')
      .eq('user_id', userId)
      .eq('plan_type', 'referral_premium')
      .eq('status', 'active')
      .maybeSingle();

    const premiumEndsAt = premiumEntitlement?.expires_at || null;
    const premiumActive = premiumEntitlement ? new Date(premiumEntitlement.expires_at) > new Date() : false;

    // Calculate remaining days
    let premiumDaysRemaining = 0;
    if (premiumActive && premiumEndsAt) {
      const diffMs = new Date(premiumEndsAt).getTime() - Date.now();
      premiumDaysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }

    // Build enriched referral history
    const rewardMap = new Map(rewards?.map(r => [r.referral_id, r]) || []);
    const enrichedReferrals = referrals?.map(r => {
      const profile = profileMap.get(r.referred_user_id);
      const reward = rewardMap.get(r.id);
      return {
        id: r.id,
        status: r.status,
        created_at: r.created_at,
        qualified_at: r.qualified_at,
        referred_user_name: profile?.first_name || profile?.full_name?.split(' ')[0] || 'Contractor',
        reward_days: reward?.days_granted || null,
        reward_date: reward?.granted_at || null,
      };
    }) || [];

    // Get the configured days per referral
    const { data: settingData } = await supabase
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', 'contractor_referral_premium_days')
      .maybeSingle();
    const daysPerReferral = parseInt(settingData?.setting_value || '3', 10);

    return new Response(
      JSON.stringify({
        has_referral_code: !!codeRecord,
        referral_code: codeRecord?.referral_code || null,
        total_signups: totalSignups,
        qualified_referrals: qualifiedCount,
        pending_referrals: pendingCount,
        total_days_earned: totalDaysEarned,
        premium_active: premiumActive,
        premium_ends_at: premiumEndsAt,
        premium_days_remaining: premiumDaysRemaining,
        days_per_referral: daysPerReferral,
        referrals: enrichedReferrals,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[get-contractor-referral-stats] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
