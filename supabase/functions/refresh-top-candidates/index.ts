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

    // Fetch job for hiring_config and contractor_id (for favorite boost)
    const { data: job, error: jobErr } = await supabase
      .from('jobs')
      .select('id, hiring_style, hiring_config, contractor_id')
      .eq('id', job_id)
      .single();

    if (jobErr || !job || job.hiring_style !== 'open_ai_top10') {
      return new Response(JSON.stringify({ error: 'Job not eligible' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get contractor user_id for favorite boost
    const { data: contractor } = await supabase
      .from('contractor_profiles')
      .select('user_id')
      .eq('id', job.contractor_id)
      .single();

    const contractorUserId = contractor?.user_id;

    const config = (job.hiring_config || {}) as Record<string, unknown>;
    const topN = Math.min(25, Math.max(1, (config.top_n as number) || 10));
    const debounceSeconds = (config.refresh_debounce_seconds as number) || 60;
    const FAVORITE_BOOST = 3; // Small boost for previously favorited workers

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

    // Fetch more than topN to allow for boost reordering
    const fetchLimit = Math.min(50, topN * 2);

    // Fetch top scored applications (exclude rejected/hired to keep rankings consistent)
    const { data: topApps, error: appsErr } = await supabase
      .from('job_applications')
      .select('id, employee_id, ai_score, created_at')
      .eq('job_id', job_id)
      .eq('ai_scoring_status', 'scored')
      .in('status', ['pending', 'reviewing', 'shortlisted'])
      .not('ai_score', 'is', null)
      .order('ai_score', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(fetchLimit);

    if (appsErr) {
      log('Error fetching applications', appsErr);
      return new Response(JSON.stringify({ error: 'Failed to fetch applications' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!topApps || topApps.length === 0) {
      log('No scored applications yet');
      // Clear existing rankings
      await supabase.from('job_top_candidates').delete().eq('job_id', job_id);
      return new Response(JSON.stringify({ success: true, candidates_count: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Phase 6 Task 8: Apply preferred boost for favorited workers (dynamic, not persisted to ai_score)
    let favoritedEmployeeIds = new Set<string>();
    if (contractorUserId) {
      const employeeIds = topApps.map(a => a.employee_id);
      const { data: favorites } = await supabase
        .from('contractor_favorite_workers')
        .select('employee_profile_id')
        .eq('contractor_user_id', contractorUserId)
        .in('employee_profile_id', employeeIds);

      if (favorites) {
        favoritedEmployeeIds = new Set(favorites.map(f => f.employee_profile_id));
      }
    }

    // Apply boost and re-sort
    const boostedApps = topApps.map(app => ({
      ...app,
      effective_score: (app.ai_score || 0) + (favoritedEmployeeIds.has(app.employee_id) ? FAVORITE_BOOST : 0),
      is_preferred: favoritedEmployeeIds.has(app.employee_id),
    }));

    boostedApps.sort((a, b) => {
      if (b.effective_score !== a.effective_score) return b.effective_score - a.effective_score;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    const finalApps = boostedApps.slice(0, topN);

    // Delete existing top candidates for this job
    await supabase.from('job_top_candidates').delete().eq('job_id', job_id);

    // Insert new rankings (score stored is effective_score including boost)
    const now_ts = new Date().toISOString();
    const candidates = finalApps.map((app, idx) => ({
      job_id,
      job_application_id: app.id,
      rank: idx + 1,
      score: app.effective_score,
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
