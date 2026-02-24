import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function decryptAnswers(encryptedData: Uint8Array, key: string): Promise<Record<string, unknown>> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key.padEnd(32, '0').slice(0, 32));
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData, { name: 'AES-GCM' }, false, ['decrypt']
  );

  // Extract IV (first 12 bytes) and ciphertext
  const iv = encryptedData.slice(0, 12);
  const ciphertext = encryptedData.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv }, cryptoKey, ciphertext
  );

  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(decrypted));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const encryptionKey = Deno.env.get('PRE_EMPLOYMENT_ENCRYPTION_KEY');

    if (!encryptionKey) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const userId = claimsData.claims.sub as string;
    const { pack_id } = await req.json();

    if (!pack_id) {
      return new Response(JSON.stringify({ error: 'pack_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Get pack with encrypted data
    const { data: pack, error: packError } = await supabase
      .from('application_pre_employment_packs')
      .select('id, status, answers_encrypted, job_application_id, template_id, downloaded_at, expires_at')
      .eq('id', pack_id)
      .single();

    if (packError || !pack) {
      return new Response(JSON.stringify({ error: 'Pack not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Verify contractor ownership
    const { data: app } = await supabase
      .from('job_applications')
      .select('job_id')
      .eq('id', pack.job_application_id)
      .single();

    if (!app) {
      return new Response(JSON.stringify({ error: 'Application not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: job } = await supabase
      .from('jobs')
      .select('contractor_id')
      .eq('id', app.job_id)
      .single();

    if (!job) {
      return new Response(JSON.stringify({ error: 'Job not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: contractor } = await supabase
      .from('contractor_profiles')
      .select('user_id')
      .eq('id', job.contractor_id)
      .single();

    if (!contractor || contractor.user_id !== userId) {
      return new Response(JSON.stringify({ error: 'You are not authorized to download this pack' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (pack.status !== 'submitted' && pack.status !== 'reviewed') {
      return new Response(JSON.stringify({ error: 'Pack is not ready for download' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Check expiry
    if (pack.expires_at && new Date(pack.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'This pack has expired and data has been deleted' }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!pack.answers_encrypted) {
      return new Response(JSON.stringify({ error: 'No encrypted data available' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Decrypt answers
    const encryptedArray = new Uint8Array(pack.answers_encrypted as unknown as number[]);
    const decryptedAnswers = await decryptAnswers(encryptedArray, encryptionKey);

    // Get template schema for labels
    let templateSchema = null;
    if (pack.template_id) {
      const { data: template } = await supabase
        .from('contractor_pre_employment_templates')
        .select('template_schema, name')
        .eq('id', pack.template_id)
        .single();
      templateSchema = template;
    }

    // Mark as downloaded and schedule deletion in 48h
    const deletionAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    await supabase
      .from('application_pre_employment_packs')
      .update({
        downloaded_at: new Date().toISOString(),
        status: 'reviewed',
        reviewed_at: new Date().toISOString(),
        // Update expires_at to 48h from now (whichever is sooner)
        expires_at: pack.expires_at && new Date(pack.expires_at) < deletionAt
          ? pack.expires_at
          : deletionAt.toISOString(),
      })
      .eq('id', pack_id);

    console.log('[download-pack-answers] Pack downloaded:', pack_id);

    return new Response(JSON.stringify({
      answers: decryptedAnswers,
      template: templateSchema,
      downloaded_at: new Date().toISOString(),
      deletion_scheduled_at: deletionAt.toISOString(),
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[download-pack-answers] Error:', error instanceof Error ? error.message : 'Unknown');
    return new Response(JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
