import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date().toISOString();

    // 1. Delete expired packs (past expires_at)
    const { data: expiredPacks, error: expiredError } = await supabase
      .from('application_pre_employment_packs')
      .select('id')
      .not('expires_at', 'is', null)
      .lt('expires_at', now);

    if (expiredError) {
      console.error('[cleanup-expired-packs] Error fetching expired packs:', expiredError);
    }

    let expiredCount = 0;
    if (expiredPacks && expiredPacks.length > 0) {
      const ids = expiredPacks.map(p => p.id);

      // Wipe encrypted data and mark as cancelled
      const { error: wipeError } = await supabase
        .from('application_pre_employment_packs')
        .update({
          answers_encrypted: null,
          answers: null,
          status: 'cancelled',
        })
        .in('id', ids);

      if (wipeError) {
        console.error('[cleanup-expired-packs] Error wiping packs:', wipeError);
      } else {
        expiredCount = ids.length;
      }
    }

    // 2. Delete downloaded packs older than 48h
    const cutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data: downloadedPacks, error: downloadedError } = await supabase
      .from('application_pre_employment_packs')
      .select('id')
      .not('downloaded_at', 'is', null)
      .lt('downloaded_at', cutoff48h)
      .not('answers_encrypted', 'is', null);

    let downloadedCount = 0;
    if (!downloadedError && downloadedPacks && downloadedPacks.length > 0) {
      const ids = downloadedPacks.map(p => p.id);

      const { error: wipeError } = await supabase
        .from('application_pre_employment_packs')
        .update({
          answers_encrypted: null,
          answers: null,
        })
        .in('id', ids);

      if (!wipeError) {
        downloadedCount = ids.length;
      }
    }

    console.log(`[cleanup-expired-packs] Cleaned up ${expiredCount} expired, ${downloadedCount} downloaded packs`);

    return new Response(JSON.stringify({
      success: true,
      expired_cleaned: expiredCount,
      downloaded_cleaned: downloadedCount,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[cleanup-expired-packs] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
