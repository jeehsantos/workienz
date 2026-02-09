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

    // Verify user is a contractor
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    if (!userRoles?.some(r => r.role === 'contractor')) {
      return new Response(
        JSON.stringify({ error: 'Only contractors can access contractor referral codes' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user already has a referral code
    const { data: existing } = await supabase
      .from('contractor_referral_codes')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ referral_code: existing.referral_code }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate a new code
    const { data: newCode, error: codeError } = await supabase.rpc('generate_contractor_referral_code');
    if (codeError || !newCode) {
      console.error('[get-contractor-referral-code] Failed to generate code:', codeError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate referral code' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert via service role (bypasses RLS)
    const { data: newRecord, error: insertError } = await supabase
      .from('contractor_referral_codes')
      .insert({ user_id: userId, referral_code: newCode })
      .select()
      .single();

    if (insertError) {
      console.error('[get-contractor-referral-code] Failed to create record:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create referral record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ referral_code: newRecord.referral_code }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[get-contractor-referral-code] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
