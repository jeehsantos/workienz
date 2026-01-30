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

    // Check if user has the employee role (from user_roles table)
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    const isEmployee = userRoles?.some(r => r.role === 'employee');

    if (!isEmployee) {
      return new Response(
        JSON.stringify({ error: 'Only employees can access referral codes' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user already has a referral record
    const { data: existingCredits } = await supabase
      .from('employee_referral_credits')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (existingCredits) {
      return new Response(
        JSON.stringify({
          referral_code: existingCredits.referral_code,
          total_verified_referrals: existingCredits.total_verified_referrals,
          bonus_credits_balance: existingCredits.bonus_credits_balance,
          bonus_credits_used: existingCredits.bonus_credits_used,
          remaining_credits: existingCredits.bonus_credits_balance - existingCredits.bonus_credits_used,
          has_premium_article_access: existingCredits.has_premium_article_access,
          is_shadow_banned: existingCredits.is_shadow_banned,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate a new referral code
    const { data: newCode, error: codeError } = await supabase.rpc('generate_referral_code');
    
    if (codeError || !newCode) {
      console.error('[get-referral-code] Failed to generate code:', codeError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate referral code' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create the referral credits record
    const { data: newCredits, error: insertError } = await supabase
      .from('employee_referral_credits')
      .insert({
        user_id: userId,
        referral_code: newCode,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[get-referral-code] Failed to create credits record:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create referral record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        referral_code: newCredits.referral_code,
        total_verified_referrals: 0,
        bonus_credits_balance: 0,
        bonus_credits_used: 0,
        remaining_credits: 0,
        has_premium_article_access: false,
        is_shadow_banned: false,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[get-referral-code] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
