import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const log = (step: string, details?: unknown) => {
  console.log(`[GENERATE-QUESTIONNAIRE] ${step}${details ? ` - ${JSON.stringify(details)}` : ''}`);
};

const KNOWN_CANDIDATE_FIELDS = [
  'visa_status', 'city', 'suburb', 'country', 'location_region',
  'availability', 'is_available', 'has_car', 'comfortable_heavy_lifting',
  'comfortable_standing', 'has_ird_number', 'phone', 'languages', 'skills',
  'experience_years', 'industry', 'bio', 'headline', 'date_of_birth',
  'work_experience', 'education',
].join(', ');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
      if (token !== serviceKey && token !== anonKey) {
        const authClient = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: claims, error: claimsErr } = await authClient.auth.getClaims(token);
        if (claimsErr || !claims?.claims?.sub) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    const { job_id, force } = await req.json();
    if (!job_id) {
      return new Response(JSON.stringify({ error: 'job_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    log('Starting', { job_id, force });

    // Fetch job with skills and physical requirements
    const { data: job, error: jobErr } = await supabase
      .from('jobs')
      .select('id, title, description, requirements, location_city, location_suburb, location_country, schedule_type, hiring_style, hiring_config, skills_required, requires_car, requires_heavy_lifting, requires_standing')
      .eq('id', job_id)
      .single();

    if (jobErr || !job) {
      return new Response(JSON.stringify({ error: 'Job not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (job.hiring_style !== 'open_ai_top10') {
      return new Response(JSON.stringify({ error: 'Job is not open_ai_top10 hiring style' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Idempotency check
    if (!force) {
      const { data: existing } = await supabase
        .from('job_ai_questionnaires')
        .select('job_id, questionnaire')
        .eq('job_id', job_id)
        .maybeSingle();

      if (existing) {
        log('Returning existing questionnaire');
        return new Response(JSON.stringify({ success: true, questionnaire: existing.questionnaire, cached: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: 'AI gateway not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch shifts
    let shiftNotes = 'Not specified';
    if (job.schedule_type === 'shifts') {
      const { data: shifts } = await supabase
        .from('job_shifts')
        .select('shift_date, start_time, end_time, break_minutes')
        .eq('job_id', job_id)
        .order('shift_date', { ascending: true })
        .limit(10);

      if (shifts && shifts.length > 0) {
        shiftNotes = shifts.map(s => `${s.shift_date}: ${s.start_time}-${s.end_time} (${s.break_minutes}min break)`).join('\n');
      }
    }

    const location = [job.location_suburb, job.location_city, job.location_country].filter(Boolean).join(', ');
    const requiredSkillsList = (job.skills_required || []).join(', ') || 'None';

    // Build v2 prompts
    const systemPrompt = `You generate short, practical screening questions for entry-level/temporary jobs in New Zealand.
Avoid academic/trivia questions. Keep language simple. Do not ask sensitive personal questions.`;

    const userPrompt = `Create a screening questionnaire for this job.

IMPORTANT RULES:
- Total questions: 5 to 7 (max 8 only if safety-critical).
- Do NOT ask questions for data we already collect in the candidate profile.
  Already captured fields (DO NOT ASK): ${KNOWN_CANDIDATE_FIELDS}
  Example fields: visa/work rights, location, availability, transport, phone/email.
- Contractor "required skills" must NOT be combined into one question.
  Each required skill must become an atomic check (its own yes/no or single_select question).
- Questions must be practical and directly job-related.
- Use simple formats: yes_no, single_select, short_text.
- Options must be included only for single_select.
- Keep prompts under 160 characters.
- Questionnaire must only ask for missing decision-relevant information.

JOB:
Title: ${job.title}
Description: ${job.description}
Location: ${location}
Shifts/notes: ${shiftNotes}
Contractor required skills (list): ${requiredSkillsList}

Return ONLY valid JSON in this schema:
{
  "version": "questionnaire_v2",
  "questions": [
    {
      "id": "q_001",
      "type": "yes_no" | "single_select" | "short_text",
      "prompt": "string",
      "options": [{"value":"string","label":"string"}]
    }
  ]
}`;

    log('Calling AI gateway (v2)');

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
      const errText = await aiResponse.text();
      log('AI gateway error', { status: aiResponse.status, body: errText });
      return new Response(JSON.stringify({ error: 'AI generation failed', details: aiResponse.status }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || '';

    let questionnaire;
    try {
      const jsonStr = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      questionnaire = JSON.parse(jsonStr);
    } catch {
      log('Failed to parse AI response', { rawContent: rawContent.substring(0, 500) });
      return new Response(JSON.stringify({ error: 'AI returned invalid JSON' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!questionnaire.questions || !Array.isArray(questionnaire.questions) || questionnaire.questions.length === 0) {
      return new Response(JSON.stringify({ error: 'AI returned empty questionnaire' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Upsert
    const { error: upsertErr } = await supabase
      .from('job_ai_questionnaires')
      .upsert({
        job_id,
        questionnaire,
        model: 'google/gemini-3-flash-preview',
        prompt_version: 'qgen_v2',
        generated_at: new Date().toISOString(),
      }, { onConflict: 'job_id' });

    if (upsertErr) {
      log('Upsert error', upsertErr);
      return new Response(JSON.stringify({ error: 'Failed to save questionnaire' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    log('Questionnaire v2 generated and saved', { questionCount: questionnaire.questions.length });

    return new Response(JSON.stringify({ success: true, questionnaire, cached: false }), {
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
