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

    const referredUserId = claimsData.claims.sub as string;
    const { referral_code } = await req.json();

    if (!referral_code) {
      return new Response(
        JSON.stringify({ error: 'Referral code is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify referred user is a contractor
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', referredUserId);

    if (!userRoles?.some(r => r.role === 'contractor')) {
      return new Response(
        JSON.stringify({ error: 'Only contractors can use contractor referral codes' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find referrer by code
    const { data: codeRecord } = await supabase
      .from('contractor_referral_codes')
      .select('user_id, referral_code, is_active')
      .eq('referral_code', referral_code.toUpperCase())
      .maybeSingle();

    if (!codeRecord || !codeRecord.is_active) {
      return new Response(
        JSON.stringify({ error: 'Invalid referral code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Self-referral check
    if (codeRecord.user_id === referredUserId) {
      return new Response(
        JSON.stringify({ error: 'You cannot use your own referral code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Loop prevention: check if referred user already referred the referrer
    const { data: reverseReferral } = await supabase
      .from('contractor_referrals')
      .select('id')
      .eq('referrer_user_id', referredUserId)
      .eq('referred_user_id', codeRecord.user_id)
      .maybeSingle();

    if (reverseReferral) {
      return new Response(
        JSON.stringify({ error: 'Referral loop detected. You cannot refer someone who referred you.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already referred
    const { data: existingReferral } = await supabase
      .from('contractor_referrals')
      .select('id')
      .eq('referred_user_id', referredUserId)
      .maybeSingle();

    if (existingReferral) {
      return new Response(
        JSON.stringify({ error: 'You have already used a referral code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                      req.headers.get('cf-connecting-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // Create referral record
    const { data: referral, error: referralError } = await supabase
      .from('contractor_referrals')
      .insert({
        referrer_user_id: codeRecord.user_id,
        referred_user_id: referredUserId,
        referral_code: referral_code.toUpperCase(),
        status: 'pending',
        ip_address: ipAddress,
        user_agent: userAgent,
      })
      .select()
      .single();

    if (referralError) {
      console.error('[process-contractor-referral] Failed:', referralError);
      return new Response(
        JSON.stringify({ error: 'Failed to process referral' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[process-contractor-referral] Created pending referral:', referral.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Referral recorded. Your referrer will earn Premium days when you publish your first job.',
        referral_id: referral.id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[process-contractor-referral] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
