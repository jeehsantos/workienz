import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const log = (step: string, details?: unknown) => {
  console.log(`[SCORE-APPLICATION] ${step}${details ? ` - ${JSON.stringify(details)}` : ''}`);
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const { application_id } = await req.json();
    if (!application_id) {
      return new Response(JSON.stringify({ error: 'application_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    log('Starting', { application_id });

    // Fetch application
    const { data: app, error: appErr } = await supabase
      .from('job_applications')
      .select('id, job_id, employee_id, application_answers, ai_scoring_status, cover_letter')
      .eq('id', application_id)
      .single();

    if (appErr || !app) {
      return new Response(JSON.stringify({ error: 'Application not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch job with requirements fields
    const { data: job, error: jobErr } = await supabase
      .from('jobs')
      .select('id, title, description, requirements, location_city, location_suburb, location_country, schedule_type, hiring_style, hiring_config, skills_required, requires_car, requires_heavy_lifting, requires_standing')
      .eq('id', app.job_id)
      .single();

    if (jobErr || !job || job.hiring_style !== 'open_ai_top10') {
      log('Job not eligible for AI scoring', { hiring_style: job?.hiring_style });
      return new Response(JSON.stringify({ error: 'Job not eligible for AI scoring' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Set status to processing
    await supabase
      .from('job_applications')
      .update({ ai_scoring_status: 'processing' })
      .eq('id', application_id);

    // ─── Phase 8: AI Usage Cap Enforcement ───────────────────────────
    const { data: jobOwnerForCap } = await supabase
      .from('jobs')
      .select('contractor_id')
      .eq('id', app.job_id)
      .single();

    if (jobOwnerForCap) {
      const { data: contractorForCap } = await supabase
        .from('contractor_profiles')
        .select('user_id')
        .eq('id', jobOwnerForCap.contractor_id)
        .single();

      if (contractorForCap) {
        const { data: activeEnt } = await supabase
          .from('contractor_entitlements')
          .select('plan_type')
          .eq('user_id', contractorForCap.user_id)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();

        const isPaid = activeEnt && !['free_tier', 'free_contractor'].includes(activeEnt.plan_type);
        const capKey = isPaid ? 'ai_scoring_cap_paid' : 'ai_scoring_cap_free';

        const { data: capSetting } = await supabase
          .from('platform_settings')
          .select('setting_value')
          .eq('setting_key', capKey)
          .single();

        const cap = parseInt(capSetting?.setting_value || '500');

        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);

        const { count: usageCount } = await supabase
          .from('contractor_ai_usage_ledger')
          .select('id', { count: 'exact', head: true })
          .eq('contractor_user_id', contractorForCap.user_id)
          .eq('event_type', 'application_scored')
          .gte('created_at', monthStart.toISOString());

        if ((usageCount || 0) >= cap) {
          log('AI scoring cap reached', { usageCount, cap, isPaid });
          await supabase.from('job_applications').update({ ai_scoring_status: 'failed' }).eq('id', application_id);
          return new Response(JSON.stringify({
            error: 'Monthly AI scoring limit reached for this contractor.',
            code: 'AI_CAP_REACHED',
          }), {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    // Fetch candidate profile
    const { data: empProfile } = await supabase
      .from('employee_profiles')
      .select('user_id, headline, bio, city, suburb, country, experience_years, skills, languages, availability, is_available, has_car, comfortable_standing, comfortable_heavy_lifting, visa_status, industry')
      .eq('id', app.employee_id)
      .single();

    const { data: userProfile } = empProfile ? await supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', empProfile.user_id)
      .single() : { data: null };

    // Build candidate summary
    const candidateSummary = empProfile ? [
      `Name: ${userProfile?.full_name || 'Not provided'}`,
      `Experience: ${empProfile.experience_years || 0} years${empProfile.industry ? ` in ${empProfile.industry}` : ''}`,
      `Location: ${[empProfile.suburb, empProfile.city, empProfile.country].filter(Boolean).join(', ') || 'Not specified'}`,
      `Skills: ${empProfile.skills?.join(', ') || 'None listed'}`,
      `Languages: ${empProfile.languages?.join(', ') || 'Not specified'}`,
      `Availability: ${empProfile.availability || 'Not specified'}`,
      `Has car: ${empProfile.has_car ? 'Yes' : 'No'}`,
      `Comfortable with heavy lifting: ${empProfile.comfortable_heavy_lifting ? 'Yes' : 'No'}`,
      `Comfortable standing long periods: ${empProfile.comfortable_standing ? 'Yes' : 'No'}`,
      `Visa status: ${empProfile.visa_status || 'Not specified'}`,
    ].join('\n') : 'No profile data available';

    // Build job requirements summary for scoring context
    const jobRequirements = [
      job.skills_required?.length ? `Required skills: ${job.skills_required.join(', ')}` : null,
      job.requires_car ? 'Requires own transport (car)' : null,
      job.requires_heavy_lifting ? 'Requires heavy lifting' : null,
      job.requires_standing ? 'Requires standing for long periods' : null,
    ].filter(Boolean).join('\n') || 'No specific requirements';

    // Fetch questionnaire
    const { data: questData } = await supabase
      .from('job_ai_questionnaires')
      .select('questionnaire')
      .eq('job_id', app.job_id)
      .maybeSingle();

    // Fetch shifts
    let shiftNotes = 'Not specified';
    if (job.schedule_type === 'shifts') {
      const { data: shifts } = await supabase
        .from('job_shifts')
        .select('shift_date, start_time, end_time')
        .eq('job_id', job.id)
        .order('shift_date', { ascending: true })
        .limit(10);
      if (shifts && shifts.length > 0) {
        shiftNotes = shifts.map(s => `${s.shift_date}: ${s.start_time}-${s.end_time}`).join('\n');
      }
    }

    const location = [job.location_suburb, job.location_city, job.location_country].filter(Boolean).join(', ');

    if (!lovableApiKey) {
      await supabase.from('job_applications').update({ ai_scoring_status: 'failed' }).eq('id', application_id);
      return new Response(JSON.stringify({ error: 'AI gateway not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = `Score one applicant for one job. Combine three data sources:
1. Candidate profile data (visa, location, availability, transport, physical capabilities, skills)
2. Questionnaire answers
3. Job requirements (required skills, physical requirements, transport)

Determine overall fit and eligibility. Be fair and job-relevant. Do not infer protected attributes. Return JSON only.`;

    const userPrompt = `JOB:
${job.title}
${job.description}
Location: ${location}
Shifts/notes: ${shiftNotes}
Checklist: ${job.requirements || 'None'}

JOB REQUIREMENTS:
${jobRequirements}

Questionnaire: ${questData ? JSON.stringify(questData.questionnaire) : 'None'}

CANDIDATE PROFILE SUMMARY:
${candidateSummary}

APPLICATION ANSWERS JSON:
${app.application_answers ? JSON.stringify(app.application_answers) : 'None provided'}

Return ONLY this JSON:
{
  "ai_score": 0,
  "reason_summary": "string"
}

Rules:
- ai_score is 0-100 integer.
- reason_summary is 1-2 sentences, max 200 chars.
- Be fair. Focus on job-relevant factors only.
- Compare candidate profile against job requirements (skills match, transport, physical capabilities).
- Factor in questionnaire answers for role-specific readiness.
- A candidate missing critical requirements (e.g. no car when required) should score lower.`;

    log('Calling AI gateway for scoring');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      log('AI gateway error', { status: aiResponse.status });
      await supabase.from('job_applications').update({ ai_scoring_status: 'failed' }).eq('id', application_id);
      return new Response(JSON.stringify({ error: 'AI scoring failed' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || '';

    let scoreResult: { ai_score: number; reason_summary: string };
    try {
      const jsonStr = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      scoreResult = JSON.parse(jsonStr);
    } catch {
      log('Failed to parse AI scoring response', { rawContent: rawContent.substring(0, 300) });
      await supabase.from('job_applications').update({ ai_scoring_status: 'failed' }).eq('id', application_id);
      return new Response(JSON.stringify({ error: 'AI returned invalid scoring JSON' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiScore = Math.max(0, Math.min(100, Math.round(scoreResult.ai_score)));
    const reasonSummary = (scoreResult.reason_summary || '').substring(0, 500);

    // Save score
    await supabase
      .from('job_applications')
      .update({
        ai_score: aiScore,
        ai_reason_summary: reasonSummary,
        ai_scoring_status: 'scored',
        ai_score_updated_at: new Date().toISOString(),
      })
      .eq('id', application_id);

    log('Score saved', { aiScore, applicationId: application_id });

    // Increment AI usage ledger for scoring
    const { data: jobOwner } = await supabase
      .from('jobs')
      .select('contractor_id')
      .eq('id', app.job_id)
      .single();

    if (jobOwner) {
      const { data: contractorData } = await supabase
        .from('contractor_profiles')
        .select('user_id')
        .eq('id', jobOwner.contractor_id)
        .single();

      if (contractorData) {
        await supabase.from('contractor_ai_usage_ledger').insert({
          contractor_user_id: contractorData.user_id,
          job_id: app.job_id,
          event_type: 'application_scored',
          count: 1,
        });
        log('AI usage ledger incremented for application_scored');
      }
    }

    // Trigger refresh-top-candidates (fire-and-forget)
    try {
      await fetch(`${supabaseUrl}/functions/v1/refresh-top-candidates`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ job_id: app.job_id }),
      });
      log('Triggered refresh-top-candidates');
    } catch (e) {
      log('Failed to trigger refresh-top-candidates (non-fatal)', { error: String(e) });
    }

    return new Response(JSON.stringify({ success: true, ai_score: aiScore, reason_summary: reasonSummary }), {
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
