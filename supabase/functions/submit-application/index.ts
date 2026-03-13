import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface SubmitRequest {
  job_id: string;
  cover_letter?: string;
  application_answers?: Record<string, unknown>;
}

const BASE_FREE_TIER_APPLICATIONS = 1;
const MAX_CONCURRENT_APPLICATIONS = 3;

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
    const { job_id, cover_letter, application_answers }: SubmitRequest = await req.json();

    if (!job_id) {
      return new Response(
        JSON.stringify({ error: 'job_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[submit-application] Processing for user:', userId, 'job:', job_id);

    // ─── BATCH 1: All read queries in parallel ───────────────────────
    const [
      employeeResult,
      jobResult,
      subscriptionResult,
      settingsResult,
      referralResult,
    ] = await Promise.all([
      // Employee profile
      supabase
        .from('employee_profiles')
        .select('id, last_application_at, experience_years, industry')
        .eq('user_id', userId)
        .single(),
      // Job details + status check
      supabase
        .from('jobs')
        .select('id, title, industry, experience_required, contractor_id, hiring_style, status, positions_available, positions_filled')
        .eq('id', job_id)
        .single(),
      // Subscription
      supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle(),
      // Platform settings
      supabase
        .from('platform_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['free_tier_cooldown_days', 'paid_tier_max_active_apps', 'paid_tier_cooldown_days']),
      // Referral credits
      supabase
        .from('employee_referral_credits')
        .select('bonus_credits_balance, bonus_credits_used, is_shadow_banned')
        .eq('user_id', userId)
        .maybeSingle(),
    ]);

    // ─── Validate employee profile ───────────────────────────────────
    if (employeeResult.error || !employeeResult.data) {
      return new Response(
        JSON.stringify({ error: 'Please complete your profile before applying to jobs.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const emp = employeeResult.data;

    // ─── Work Rights Verification Gate ───────────────────────────────
    const { data: verificationData } = await supabase
      .from('employee_profiles')
      .select('work_verification_status')
      .eq('user_id', userId)
      .single();

    if (!verificationData || verificationData.work_verification_status !== 'verified') {
      return new Response(
        JSON.stringify({ error: 'You must verify your work rights before applying to jobs.', code: 'WORK_RIGHTS_REQUIRED' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── Validate job exists and is open ─────────────────────────────
    if (jobResult.error || !jobResult.data) {
      return new Response(
        JSON.stringify({ error: 'Job not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const job = jobResult.data;

    if (job.status !== 'published') {
      return new Response(
        JSON.stringify({ error: 'This job is no longer accepting applications.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── BATCH 2: Queries that depend on employee id ─────────────────
    const [existingAppResult, activeAppsResult] = await Promise.all([
      // Already applied?
      supabase
        .from('job_applications')
        .select('id')
        .eq('job_id', job_id)
        .eq('employee_id', emp.id)
        .maybeSingle(),
      // Active application count
      supabase
        .from('job_applications')
        .select('id', { count: 'exact', head: true })
        .eq('employee_id', emp.id)
        .in('status', ['pending', 'shortlisted']),
    ]);

    if (existingAppResult.data) {
      return new Response(
        JSON.stringify({ error: 'You have already applied to this job.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── Experience requirements ─────────────────────────────────────
    if (job.experience_required) {
      if (!emp.experience_years || emp.experience_years === 0) {
        return new Response(
          JSON.stringify({ error: 'This job requires experience. Your profile shows no work experience.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (job.industry && emp.industry && job.industry !== emp.industry) {
        return new Response(
          JSON.stringify({ error: `This job requires experience in ${job.industry}. Your profile shows experience in ${emp.industry}.` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Position slot check removed — now handled atomically in create_job_application_atomic

    // ─── Parse settings ──────────────────────────────────────────────
    const settingsMap: Record<string, number> = {};
    settingsResult.data?.forEach(s => {
      settingsMap[s.setting_key] = parseInt(s.setting_value) || 0;
    });
    const freeTierCooldownDays = settingsMap['free_tier_cooldown_days'] || 3;
    const paidTierMaxActiveApps = settingsMap['paid_tier_max_active_apps'] || 3;
    const paidTierCooldownDays = settingsMap['paid_tier_cooldown_days'] || 3;

    const isSubscribed = !!subscriptionResult.data;
    const activeApplications = activeAppsResult.count || 0;

    // ─── Referral credits (free tier only) ───────────────────────────
    let referralCreditsRemaining = 0;
    const refData = referralResult.data;
    if (!isSubscribed && refData && !refData.is_shadow_banned) {
      referralCreditsRemaining = refData.bonus_credits_balance - refData.bonus_credits_used;
    }

    // ─── Application slot limits (subscribers only) ────────────────
    if (isSubscribed) {
      if (activeApplications >= paidTierMaxActiveApps) {
        return new Response(
          JSON.stringify({ error: `You have reached your limit of ${paidTierMaxActiveApps} active applications.` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    // Free-tier users have no cooldown or slot limits for normal job applications

    // ─── Questionnaire validation (open_ai_top10) ────────────────────
    const isOpenAI = job.hiring_style === 'open_ai_top10';
    let aiScoringStatus = 'pending';
    let validatedAnswers: Record<string, unknown> | null = null;

    if (isOpenAI) {
      const { data: questData } = await supabase
        .from('job_ai_questionnaires')
        .select('questionnaire')
        .eq('job_id', job_id)
        .maybeSingle();

      if (questData?.questionnaire) {
        const questions = (questData.questionnaire as any).questions;
        if (Array.isArray(questions) && questions.length > 0) {
          const answers = application_answers || {};
          const unanswered = questions.filter((q: any) => {
            const ans = (answers as Record<string, string>)[q.id];
            return !ans || !String(ans).trim();
          });
          if (unanswered.length > 0) {
            return new Response(
              JSON.stringify({ error: `Please answer all ${questions.length} screening questions. ${unanswered.length} question(s) unanswered.` }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      }
      validatedAnswers = application_answers || null;
      aiScoringStatus = 'pending';
    }

    // ─── ATOMIC: lock job row, check slots, check duplicate, insert ──
    const { data: atomicResult, error: atomicError } = await supabase.rpc(
      'create_job_application_atomic',
      {
        p_job_id: job_id,
        p_employee_id: emp.id,
        p_cover_letter: cover_letter || null,
        p_application_answers: validatedAnswers,
        p_ai_scoring_status: aiScoringStatus,
      }
    );

    if (atomicError) {
      console.error('[submit-application] Atomic RPC failed:', atomicError);
      return new Response(
        JSON.stringify({ error: 'Failed to submit application. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rpcResult = atomicResult as { code: string; ok: boolean; application_id?: string };

    if (!rpcResult.ok) {
      const errorMap: Record<string, { error: string; status: number; extra?: Record<string, unknown> }> = {
        JOB_NOT_FOUND: { error: 'Job not found', status: 404 },
        JOB_NOT_OPEN: { error: 'This job is no longer accepting applications.', status: 400 },
        NO_SLOTS: { error: 'All positions have been filled.', status: 400, extra: { position_filled: true } },
        ALREADY_APPLIED: { error: 'You have already applied to this job.', status: 400, extra: { code: 'ALREADY_APPLIED' } },
        APPLICATIONS_CLOSED: { error: 'This job has reached its application limit and is no longer accepting new applications.', status: 400, extra: { code: 'APPLICATIONS_CLOSED' } },
      };
      const mapped = errorMap[rpcResult.code] || { error: 'Application failed.', status: 400 };
      return new Response(
        JSON.stringify({ error: mapped.error, ...mapped.extra }),
        { status: mapped.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const appData = { id: rpcResult.application_id! };

    // ─── Post-insert side effects (parallel) ─────────────────────────
    const sideEffects: Promise<any>[] = [
      // Update last_application_at
      supabase
        .from('employee_profiles')
        .update({ last_application_at: new Date().toISOString() })
        .eq('id', emp.id),
    ];

    // Consume referral credit if applicable
    if (!isSubscribed && refData && !refData.is_shadow_banned && activeApplications >= BASE_FREE_TIER_APPLICATIONS) {
      sideEffects.push(
        supabase
          .from('employee_referral_credits')
          .update({ bonus_credits_used: refData.bonus_credits_used + 1 })
          .eq('user_id', userId)
      );
      console.log('[submit-application] Consuming 1 referral credit');
    }

    // Get contractor for conversation
    const contractorResult = await supabase
      .from('contractor_profiles')
      .select('user_id')
      .eq('id', job.contractor_id)
      .single();

    await Promise.all(sideEffects);

    // ─── Create conversation ─────────────────────────────────────────
    let conversationId: string | null = null;
    if (contractorResult.data) {
      const { data: convData } = await supabase
        .from('conversations')
        .insert({
          job_application_id: appData.id,
          contractor_user_id: contractorResult.data.user_id,
          employee_user_id: userId,
        })
        .select('id')
        .single();

      conversationId = convData?.id || null;

      if (conversationId && cover_letter?.trim()) {
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', userId)
          .single();

        await supabase.from('messages').insert({
          conversation_id: conversationId,
          sender_user_id: userId,
          content: `📋 **Application for: ${job.title}**\n\nHi, I'm ${userProfile?.full_name || 'a job seeker'} and I'd like to apply for this position.\n\n**Cover Letter:**\n${cover_letter}`,
        });
      }
    }

    // ─── Fire-and-forget AI scoring ──────────────────────────────────
    if (isOpenAI) {
      try {
        fetch(`${supabaseUrl}/functions/v1/score-application-ai`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ application_id: appData.id }),
        });
      } catch (e) {
        console.error('[submit-application] AI scoring trigger failed (non-fatal):', e);
      }
    }

    const newCreditsRemaining = refData && !refData.is_shadow_banned
      ? Math.max(0, referralCreditsRemaining - (activeApplications >= BASE_FREE_TIER_APPLICATIONS ? 1 : 0))
      : 0;

    console.log('[submit-application] Success:', appData.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Application submitted successfully',
        data: {
          application_id: appData.id,
          conversation_id: conversationId,
          remaining_referral_credits: newCreditsRemaining,
          active_applications: activeApplications + 1,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[submit-application] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
