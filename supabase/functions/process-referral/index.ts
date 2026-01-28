import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ProcessReferralRequest {
  referral_code: string;
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

    // Validate user token
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const referredUserId = claimsData.claims.sub as string;
    const { referral_code }: ProcessReferralRequest = await req.json();

    if (!referral_code) {
      return new Response(
        JSON.stringify({ error: 'Referral code is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get IP address and user agent for fraud tracking
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                      req.headers.get('cf-connecting-ip') || 
                      'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // Check if the referred user is an employee
    const { data: referredEmployee } = await supabase
      .from('employee_profiles')
      .select('id')
      .eq('user_id', referredUserId)
      .maybeSingle();

    if (!referredEmployee) {
      return new Response(
        JSON.stringify({ error: 'Only employees can use referral codes' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find the referrer by their referral code
    const { data: referrerCredits } = await supabase
      .from('employee_referral_credits')
      .select('user_id, is_shadow_banned')
      .eq('referral_code', referral_code.toUpperCase())
      .maybeSingle();

    if (!referrerCredits) {
      return new Response(
        JSON.stringify({ error: 'Invalid referral code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cannot refer yourself
    if (referrerCredits.user_id === referredUserId) {
      return new Response(
        JSON.stringify({ error: 'You cannot use your own referral code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if this user has already been referred
    const { data: existingReferral } = await supabase
      .from('referrals')
      .select('id')
      .eq('referred_user_id', referredUserId)
      .maybeSingle();

    if (existingReferral) {
      return new Response(
        JSON.stringify({ error: 'You have already used a referral code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for potential fraud - same IP used by referrer
    const { data: sameIpReferrals } = await supabase
      .from('referrals')
      .select('id')
      .eq('referrer_user_id', referrerCredits.user_id)
      .eq('ip_address', ipAddress);

    const potentialFraud = sameIpReferrals && sameIpReferrals.length >= 2;

    // Create the referral record (initially pending)
    const { data: referral, error: referralError } = await supabase
      .from('referrals')
      .insert({
        referrer_user_id: referrerCredits.user_id,
        referred_user_id: referredUserId,
        referral_code: referral_code.toUpperCase(),
        status: 'pending',
        ip_address: ipAddress,
        user_agent: userAgent,
      })
      .select()
      .single();

    if (referralError) {
      console.error('[process-referral] Failed to create referral:', referralError);
      return new Response(
        JSON.stringify({ error: 'Failed to process referral' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[process-referral] Created pending referral:', {
      referral_id: referral.id,
      referrer: referrerCredits.user_id,
      referred: referredUserId,
      potential_fraud: potentialFraud,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Referral recorded. It will be verified once you confirm your email.',
        referral_id: referral.id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[process-referral] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
