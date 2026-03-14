import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Nightly job: checks for work verifications expiring within 30 days.
 * - 30 days out: sends a warning notification
 * - 7 days out: sends an urgent notification
 * - Expired: reverts status to 'unverified' and notifies
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Find verified profiles with expiry dates
    const { data: profiles, error } = await supabase
      .from('employee_profiles')
      .select('user_id, work_verification_expiry_date, work_verification_type')
      .eq('work_verification_status', 'verified')
      .not('work_verification_expiry_date', 'is', null);

    if (error) {
      console.error('[check-verification-expiry] Query error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let expiredCount = 0;
    let warningCount = 0;
    let urgentCount = 0;

    for (const profile of profiles) {
      const expiryDate = new Date(profile.work_verification_expiry_date);

      if (expiryDate <= now) {
        // EXPIRED: revert to unverified
        await supabase
          .from('employee_profiles')
          .update({
            work_verification_status: 'unverified',
            verification_review_reason: 'Your work rights verification has expired. Please re-verify.',
          })
          .eq('user_id', profile.user_id);

        await supabase.from('notifications').insert({
          user_id: profile.user_id,
          type: 'verification_expired',
          title: 'Work Rights Expired',
          message: 'Your work rights verification has expired. Please submit new documents to continue applying for jobs.',
          action_url: '/employee/verify',
        });

        expiredCount++;
      } else if (expiryDate.toISOString() <= in7Days) {
        // Check if we already sent an urgent notification recently (last 5 days)
        const { data: recentNotif } = await supabase
          .from('notifications')
          .select('id')
          .eq('user_id', profile.user_id)
          .eq('type', 'verification_expiring_urgent')
          .gte('created_at', new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString())
          .limit(1)
          .maybeSingle();

        if (!recentNotif) {
          const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
          await supabase.from('notifications').insert({
            user_id: profile.user_id,
            type: 'verification_expiring_urgent',
            title: 'Work Rights Expiring Soon!',
            message: `Your work rights verification expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. Re-verify now to avoid interruption.`,
            action_url: '/employee/verify',
          });
          urgentCount++;
        }
      } else if (expiryDate.toISOString() <= in30Days) {
        // Check if we already sent a warning notification recently (last 20 days)
        const { data: recentNotif } = await supabase
          .from('notifications')
          .select('id')
          .eq('user_id', profile.user_id)
          .eq('type', 'verification_expiring_warning')
          .gte('created_at', new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString())
          .limit(1)
          .maybeSingle();

        if (!recentNotif) {
          const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
          await supabase.from('notifications').insert({
            user_id: profile.user_id,
            type: 'verification_expiring_warning',
            title: 'Work Rights Expiring',
            message: `Your work rights verification expires in ${daysLeft} days. Consider re-verifying early.`,
            action_url: '/employee/verify',
          });
          warningCount++;
        }
      }
    }

    console.log(`[check-verification-expiry] Processed: ${profiles.length}, Expired: ${expiredCount}, Urgent: ${urgentCount}, Warning: ${warningCount}`);

    return new Response(
      JSON.stringify({ processed: profiles.length, expired: expiredCount, urgent: urgentCount, warning: warningCount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[check-verification-expiry] Error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
