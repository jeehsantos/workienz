import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const log = (step: string, details?: unknown) => {
  console.log(`[REFRESH-TOP-CANDIDATES] ${step}${details ? ` - ${JSON.stringify(details)}` : ''}`);
};

// In-memory debounce map (per isolate instance)
const lastRefreshed = new Map<string, number>();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const { job_id } = await req.json();
    if (!job_id) {
      return new Response(JSON.stringify({ error: 'job_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    log('Starting', { job_id });

    // Fetch job for hiring_config
    const { data: job, error: jobErr } = await supabase
      .from('jobs')
      .select('id, hiring_style, hiring_config')
      .eq('id', job_id)
      .single();

    if (jobErr || !job || job.hiring_style !== 'open_ai_top10') {
      return new Response(JSON.stringify({ error: 'Job not eligible' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const config = (job.hiring_config || {}) as Record<string, unknown>;
    const topN = Math.min(25, Math.max(1, (config.top_n as number) || 10));
    const debounceSeconds = (config.refresh_debounce_seconds as number) || 60;

    // Debounce check
    const lastTime = lastRefreshed.get(job_id);
    const now = Date.now();
    if (lastTime && (now - lastTime) < debounceSeconds * 1000) {
      log('Debounced - skipping refresh', { secondsSinceLast: Math.round((now - lastTime) / 1000), debounceSeconds });
      return new Response(JSON.stringify({ success: true, debounced: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    lastRefreshed.set(job_id, now);

    // Fetch top scored applications (exclude rejected/hired to keep rankings consistent)
    const { data: topApps, error: appsErr } = await supabase
      .from('job_applications')
      .select('id, ai_score, created_at')
      .eq('job_id', job_id)
      .eq('ai_scoring_status', 'scored')
      .in('status', ['pending', 'reviewing', 'shortlisted'])
      .not('ai_score', 'is', null)
      .order('ai_score', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(topN);

    if (appsErr) {
      log('Error fetching applications', appsErr);
      return new Response(JSON.stringify({ error: 'Failed to fetch applications' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!topApps || topApps.length === 0) {
      log('No scored applications yet');
      return new Response(JSON.stringify({ success: true, candidates_count: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Delete existing top candidates for this job
    await supabase.from('job_top_candidates').delete().eq('job_id', job_id);

    // Insert new rankings
    const now_ts = new Date().toISOString();
    const candidates = topApps.map((app, idx) => ({
      job_id,
      job_application_id: app.id,
      rank: idx + 1,
      score: app.ai_score,
      updated_at: now_ts,
    }));

    const { error: insertErr } = await supabase.from('job_top_candidates').insert(candidates);

    if (insertErr) {
      log('Error inserting top candidates', insertErr);
      return new Response(JSON.stringify({ error: 'Failed to update top candidates' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    log('Top candidates refreshed', { count: candidates.length });

    return new Response(JSON.stringify({ success: true, candidates_count: candidates.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    log('ERROR', { message: error instanceof Error ? error.message : String(error) });
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
