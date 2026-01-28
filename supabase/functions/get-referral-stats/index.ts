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

    // Validate user token
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub as string;

    // Get the user's referral credits
    const { data: credits } = await supabase
      .from('employee_referral_credits')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!credits) {
      return new Response(
        JSON.stringify({
          has_referral_code: false,
          referral_code: null,
          total_verified_referrals: 0,
          pending_referrals: 0,
          bonus_credits_balance: 0,
          bonus_credits_used: 0,
          remaining_credits: 0,
          has_premium_article_access: false,
          referrals: [],
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all referrals made by this user
    const { data: referrals } = await supabase
      .from('referrals')
      .select(`
        id,
        status,
        created_at,
        verified_at,
        referred_user_id
      `)
      .eq('referrer_user_id', userId)
      .order('created_at', { ascending: false });

    // Get profiles for referred users
    const referredUserIds = referrals?.map(r => r.referred_user_id) || [];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, first_name, avatar_url')
      .in('user_id', referredUserIds);

    const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

    // Enrich referrals with profile info
    const enrichedReferrals = referrals?.map(r => ({
      id: r.id,
      status: r.status,
      created_at: r.created_at,
      verified_at: r.verified_at,
      referred_user: {
        name: profileMap.get(r.referred_user_id)?.first_name || 
              profileMap.get(r.referred_user_id)?.full_name?.split(' ')[0] || 
              'Anonymous',
        avatar_url: profileMap.get(r.referred_user_id)?.avatar_url,
      },
    })) || [];

    const pendingCount = referrals?.filter(r => r.status === 'pending').length || 0;

    return new Response(
      JSON.stringify({
        has_referral_code: true,
        referral_code: credits.referral_code,
        total_verified_referrals: credits.total_verified_referrals,
        pending_referrals: pendingCount,
        bonus_credits_balance: credits.bonus_credits_balance,
        bonus_credits_used: credits.bonus_credits_used,
        remaining_credits: credits.bonus_credits_balance - credits.bonus_credits_used,
        has_premium_article_access: credits.has_premium_article_access,
        is_shadow_banned: credits.is_shadow_banned,
        referrals: enrichedReferrals,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[get-referral-stats] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
