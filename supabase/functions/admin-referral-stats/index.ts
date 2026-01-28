import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface AdminAction {
  action: 'list_top_referrers' | 'void_referral' | 'shadow_ban_user' | 'unban_user' | 'get_fraud_flags';
  referral_id?: string;
  user_id?: string;
  reason?: string;
  limit?: number;
}

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

    // Validate user token
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adminUserId = claimsData.claims.sub as string;

    // Check if user is an admin
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: adminUserId,
      _role: 'admin',
    });

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: AdminAction = await req.json();
    const { action, referral_id, user_id, reason, limit = 20 } = body;

    switch (action) {
      case 'list_top_referrers': {
        // Get top referrers with their stats
        const { data: topReferrers } = await supabase
          .from('employee_referral_credits')
          .select(`
            user_id,
            referral_code,
            total_verified_referrals,
            bonus_credits_balance,
            bonus_credits_used,
            has_premium_article_access,
            is_shadow_banned,
            created_at
          `)
          .order('total_verified_referrals', { ascending: false })
          .limit(limit);

        // Get profile info for each referrer
        const userIds = topReferrers?.map(r => r.user_id) || [];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, email, avatar_url')
          .in('user_id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

        const enrichedReferrers = topReferrers?.map(r => ({
          ...r,
          profile: profileMap.get(r.user_id) || null,
        })) || [];

        return new Response(
          JSON.stringify({ top_referrers: enrichedReferrers }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_fraud_flags': {
        // Find users with multiple referrals from same IP
        const { data: suspiciousIps } = await supabase
          .from('referrals')
          .select('referrer_user_id, ip_address')
          .eq('status', 'verified');

        // Group by IP and count
        const ipCounts = new Map<string, { count: number; referrers: Set<string> }>();
        suspiciousIps?.forEach(r => {
          const key = r.ip_address as string;
          if (!ipCounts.has(key)) {
            ipCounts.set(key, { count: 0, referrers: new Set() });
          }
          const entry = ipCounts.get(key)!;
          entry.count++;
          entry.referrers.add(r.referrer_user_id);
        });

        // Filter IPs with suspicious activity (3+ referrals or multiple referrers)
        const fraudFlags: Array<{ ip: string; count: number; referrer_count: number }> = [];
        ipCounts.forEach((value, ip) => {
          if (value.count >= 3 || value.referrers.size > 1) {
            fraudFlags.push({
              ip,
              count: value.count,
              referrer_count: value.referrers.size,
            });
          }
        });

        // Find referred users who never completed profile or applied
        const { data: referrals } = await supabase
          .from('referrals')
          .select('id, referred_user_id, referrer_user_id, status, created_at')
          .eq('status', 'verified');

        const referredIds = referrals?.map(r => r.referred_user_id) || [];
        
        const { data: employeeProfiles } = await supabase
          .from('employee_profiles')
          .select('user_id')
          .in('user_id', referredIds);

        const { data: applications } = await supabase
          .from('job_applications')
          .select('employee_id');

        const { data: empProfilesWithIds } = await supabase
          .from('employee_profiles')
          .select('id, user_id')
          .in('user_id', referredIds);

        const empIdMap = new Map(empProfilesWithIds?.map(e => [e.user_id, e.id]) || []);
        const applicationEmployeeIds = new Set(applications?.map(a => a.employee_id) || []);

        const inactiveReferrals = referrals?.filter(r => {
          const hasProfile = employeeProfiles?.some(p => p.user_id === r.referred_user_id);
          const empId = empIdMap.get(r.referred_user_id);
          const hasApplied = empId && applicationEmployeeIds.has(empId);
          
          // Flag if verified more than 7 days ago and no profile or no applications
          const daysSinceCreated = (Date.now() - new Date(r.created_at).getTime()) / (1000 * 60 * 60 * 24);
          return daysSinceCreated > 7 && (!hasProfile || !hasApplied);
        }) || [];

        return new Response(
          JSON.stringify({
            suspicious_ips: fraudFlags,
            inactive_referrals: inactiveReferrals.length,
            inactive_referral_details: inactiveReferrals.slice(0, 20),
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'void_referral': {
        if (!referral_id) {
          return new Response(
            JSON.stringify({ error: 'referral_id is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get the referral details first
        const { data: referral } = await supabase
          .from('referrals')
          .select('referrer_user_id, status')
          .eq('id', referral_id)
          .single();

        if (!referral || referral.status !== 'verified') {
          return new Response(
            JSON.stringify({ error: 'Referral not found or already voided' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Void the referral
        await supabase
          .from('referrals')
          .update({
            status: 'voided',
            voided_at: new Date().toISOString(),
            voided_reason: reason || 'Voided by admin',
          })
          .eq('id', referral_id);

        // Recalculate referrer's credits
        const { count: newVerifiedCount } = await supabase
          .from('referrals')
          .select('id', { count: 'exact', head: true })
          .eq('referrer_user_id', referral.referrer_user_id)
          .eq('status', 'verified');

        const { data: newBonusCredits } = await supabase.rpc('calculate_referral_bonus_credits', {
          verified_count: newVerifiedCount || 0,
        });

        await supabase
          .from('employee_referral_credits')
          .update({
            total_verified_referrals: newVerifiedCount || 0,
            bonus_credits_balance: newBonusCredits || 0,
            has_premium_article_access: (newVerifiedCount || 0) >= 3,
          })
          .eq('user_id', referral.referrer_user_id);

        return new Response(
          JSON.stringify({ success: true, message: 'Referral voided' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'shadow_ban_user': {
        if (!user_id) {
          return new Response(
            JSON.stringify({ error: 'user_id is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        await supabase
          .from('employee_referral_credits')
          .update({
            is_shadow_banned: true,
            shadow_banned_at: new Date().toISOString(),
            shadow_banned_reason: reason || 'Shadow banned by admin',
          })
          .eq('user_id', user_id);

        return new Response(
          JSON.stringify({ success: true, message: 'User shadow banned' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'unban_user': {
        if (!user_id) {
          return new Response(
            JSON.stringify({ error: 'user_id is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        await supabase
          .from('employee_referral_credits')
          .update({
            is_shadow_banned: false,
            shadow_banned_at: null,
            shadow_banned_reason: null,
          })
          .eq('user_id', user_id);

        return new Response(
          JSON.stringify({ success: true, message: 'User unbanned' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error) {
    console.error('[admin-referral-stats] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
