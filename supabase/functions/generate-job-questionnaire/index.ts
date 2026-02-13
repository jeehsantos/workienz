import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const log = (step: string, details?: unknown) => {
  console.log(`[GENERATE-QUESTIONNAIRE] ${step}${details ? ` - ${JSON.stringify(details)}` : ''}`);
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

    // Auth check - accept both service-role calls and authenticated contractor calls
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      // Verify token if provided (non-service calls)
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

    // Fetch job
    const { data: job, error: jobErr } = await supabase
      .from('jobs')
      .select('id, title, description, requirements, location_city, location_suburb, location_country, schedule_type, hiring_style, hiring_config')
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

    // Idempotency: check if questionnaire already exists
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

    // Fetch shifts/notes
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

    const hiringConfig = (job.hiring_config || {}) as Record<string, unknown>;
    const questionCount = (hiringConfig.question_count as number) || 8;
    const location = [job.location_suburb, job.location_city, job.location_country].filter(Boolean).join(', ');
    const checklistJson = job.requirements || 'None';

    // Call LLM
    const systemPrompt = `You generate short, practical screening questions for temporary/entry-level work in New Zealand.
Avoid academic or trivia questions. Keep language simple. Do not ask sensitive personal questions.`;

    const userPrompt = `Create a screening questionnaire for this job.

Rules:
- Total 6 to 10 questions (aim for ${questionCount}).
- Practical + job-related + fair.
- Mix: yes_no, single_select, short_text.
- Focus on: reliability, availability, role tasks, safety/physical realities if relevant.

Return ONLY valid JSON matching schema below.

SCHEMA:
{
  "version": "questionnaire_v1",
  "questions": [
    {
      "id": "q_xxx",
      "type": "yes_no" | "single_select" | "short_text",
      "prompt": "string",
      "options": [{"value":"string","label":"string"}]
    }
  ]
}

JOB:
Title: ${job.title}
Description: ${job.description}
Location: ${location}
Shifts/notes: ${shiftNotes}
Checklist (optional): ${checklistJson}

IMPORTANT:
- Include "options" ONLY for single_select.
- Keep prompts <= 180 chars.
- No extra keys, no markdown.`;

    log('Calling AI gateway');

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

    // Parse JSON from response (strip markdown fences if present)
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

    // Validate basic structure
    if (!questionnaire.questions || !Array.isArray(questionnaire.questions) || questionnaire.questions.length === 0) {
      return new Response(JSON.stringify({ error: 'AI returned empty questionnaire' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Upsert into job_ai_questionnaires (service role bypasses RLS)
    const { error: upsertErr } = await supabase
      .from('job_ai_questionnaires')
      .upsert({
        job_id,
        questionnaire,
        model: 'google/gemini-3-flash-preview',
        prompt_version: 'qgen_v1',
        generated_at: new Date().toISOString(),
      }, { onConflict: 'job_id' });

    if (upsertErr) {
      log('Upsert error', upsertErr);
      return new Response(JSON.stringify({ error: 'Failed to save questionnaire' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    log('Questionnaire generated and saved', { questionCount: questionnaire.questions.length });

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
