import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// This function should be called when a user confirms their email
// It verifies any pending referral and credits the referrer

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

    const referredUserId = claimsData.claims.sub as string;

    // Find any pending referral for this user
    const { data: pendingReferral } = await supabase
      .from('referrals')
      .select('id, referrer_user_id, referral_code')
      .eq('referred_user_id', referredUserId)
      .eq('status', 'pending')
      .maybeSingle();

    if (!pendingReferral) {
      return new Response(
        JSON.stringify({ message: 'No pending referral to verify' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update referral status to verified
    const { error: updateReferralError } = await supabase
      .from('referrals')
      .update({
        status: 'verified',
        verified_at: new Date().toISOString(),
      })
      .eq('id', pendingReferral.id);

    if (updateReferralError) {
      console.error('[verify-referral] Failed to update referral:', updateReferralError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify referral' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Count total verified referrals for the referrer
    const { count: verifiedCount } = await supabase
      .from('referrals')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_user_id', pendingReferral.referrer_user_id)
      .eq('status', 'verified');

    const totalVerified = verifiedCount || 0;

    // Calculate new bonus credits based on milestones
    const { data: bonusCredits } = await supabase.rpc('calculate_referral_bonus_credits', {
      verified_count: totalVerified,
    });

    // Determine if they've unlocked premium article access (3+ referrals)
    const hasPremiumAccess = totalVerified >= 3;

    // Get current credits used (don't reset this)
    const { data: currentCredits } = await supabase
      .from('employee_referral_credits')
      .select('bonus_credits_used')
      .eq('user_id', pendingReferral.referrer_user_id)
      .maybeSingle();

    const creditsUsed = currentCredits?.bonus_credits_used || 0;

    // Update the referrer's credits
    const { error: updateCreditsError } = await supabase
      .from('employee_referral_credits')
      .update({
        total_verified_referrals: totalVerified,
        bonus_credits_balance: bonusCredits,
        has_premium_article_access: hasPremiumAccess,
      })
      .eq('user_id', pendingReferral.referrer_user_id);

    if (updateCreditsError) {
      console.error('[verify-referral] Failed to update credits:', updateCreditsError);
      return new Response(
        JSON.stringify({ error: 'Failed to update referral credits' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[verify-referral] Verified referral:', {
      referral_id: pendingReferral.id,
      referrer_id: pendingReferral.referrer_user_id,
      total_verified: totalVerified,
      new_bonus_credits: bonusCredits,
      has_premium_access: hasPremiumAccess,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Referral verified successfully',
        referrer_new_credits: bonusCredits - creditsUsed,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[verify-referral] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
