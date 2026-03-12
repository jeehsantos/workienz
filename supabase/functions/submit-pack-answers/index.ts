import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function encryptAnswers(answers: Record<string, unknown>, key: string): Promise<{ encrypted: Uint8Array; iv: Uint8Array }> {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(answers));

  // Derive a CryptoKey from the secret
  const keyData = encoder.encode(key.padEnd(32, '0').slice(0, 32));
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData, { name: 'AES-GCM' }, false, ['encrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, cryptoKey, data
  );

  // Prepend IV to ciphertext
  const result = new Uint8Array(iv.length + encrypted.byteLength);
  result.set(iv);
  result.set(new Uint8Array(encrypted), iv.length);

  return { encrypted: result, iv };
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
      console.error('[submit-pack-answers] PRE_EMPLOYMENT_ENCRYPTION_KEY not configured');
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
    const { pack_id, answers } = await req.json();

    if (!pack_id || !answers || typeof answers !== 'object') {
      return new Response(JSON.stringify({ error: 'pack_id and answers are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Verify this pack belongs to the employee
    const { data: pack, error: packError } = await supabase
      .from('application_pre_employment_packs')
      .select('id, status, job_application_id, template_id')
      .eq('id', pack_id)
      .single();

    if (packError || !pack) {
      return new Response(JSON.stringify({ error: 'Pack not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Verify ownership through application -> employee_profile -> user
    const { data: app } = await supabase
      .from('job_applications')
      .select('employee_id')
      .eq('id', pack.job_application_id)
      .single();

    if (!app) {
      return new Response(JSON.stringify({ error: 'Application not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: empProfile } = await supabase
      .from('employee_profiles')
      .select('user_id')
      .eq('id', app.employee_id)
      .single();

    if (!empProfile || empProfile.user_id !== userId) {
      return new Response(JSON.stringify({ error: 'You are not authorized to submit this pack' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!['required', 'in_progress'].includes(pack.status)) {
      return new Response(JSON.stringify({ error: 'This pack has already been submitted' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Validate answers against template schema
    if (pack.template_id) {
      const { data: template } = await supabase
        .from('contractor_pre_employment_templates')
        .select('template_schema')
        .eq('id', pack.template_id)
        .single();

      if (template?.template_schema) {
        const schema = template.template_schema as { sections: Array<{ fields: Array<{ id: string; required: boolean; label: string }> }> };
        const requiredFields = schema.sections
          .flatMap(s => s.fields)
          .filter(f => f.required);

        const missing = requiredFields.filter(f => {
          const val = answers[f.id];
          return val === undefined || val === null || (typeof val === 'string' && !val.trim());
        });

        if (missing.length > 0) {
          return new Response(JSON.stringify({
            error: `Missing required fields: ${missing.map(f => f.label).join(', ')}`,
          }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }
    }

    // Encrypt answers
    const { encrypted } = await encryptAnswers(answers, encryptionKey);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Store encrypted answers, clear plain answers
    const { error: updateError } = await supabase
      .from('application_pre_employment_packs')
      .update({
        answers: null, // Clear any plain text answers
        answers_encrypted: Array.from(encrypted), // Store as array for bytea
        encryption_version: 'aes-256-gcm-v1',
        status: 'submitted',
        submitted_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .eq('id', pack_id);

    if (updateError) {
      console.error('[submit-pack-answers] Update error:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to submit answers' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Do NOT log answers content
    console.log('[submit-pack-answers] Pack submitted successfully:', pack_id);

    return new Response(JSON.stringify({ success: true, expires_at: expiresAt.toISOString() }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[submit-pack-answers] Error:', error instanceof Error ? error.message : 'Unknown');
    return new Response(JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
