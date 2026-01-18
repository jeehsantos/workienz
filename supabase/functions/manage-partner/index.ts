import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PartnerRequest {
  action: 'create' | 'update' | 'delete' | 'list';
  partner_id?: string;
  contractor_user_id?: string;
  display_name?: string;
  logo_url?: string;
  is_active?: boolean;
  discount_percent?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });

    // Validate token
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub as string;

    // Check if user is admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const request: PartnerRequest = await req.json();
    console.log('[manage-partner] Action:', request.action);

    switch (request.action) {
      case 'list': {
        // List all partners with contractor info
        const { data: partners, error } = await supabase
          .from('partners')
          .select(`
            *,
            contractor_profile:contractor_user_id (
              id,
              company_name
            )
          `)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('[manage-partner] List error:', error);
          return new Response(
            JSON.stringify({ error: 'Failed to fetch partners' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get contractor profiles for the user IDs
        const enrichedPartners = await Promise.all((partners || []).map(async (partner) => {
          const { data: profile } = await supabase
            .from('contractor_profiles')
            .select('company_name')
            .eq('user_id', partner.contractor_user_id)
            .single();

          const { data: userProfile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('user_id', partner.contractor_user_id)
            .single();

          return {
            ...partner,
            company_name: profile?.company_name || 'Unknown',
            contact_name: userProfile?.full_name || 'Unknown',
            contact_email: userProfile?.email || 'Unknown',
          };
        }));

        return new Response(
          JSON.stringify({ success: true, partners: enrichedPartners }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'create': {
        if (!request.contractor_user_id || !request.display_name) {
          return new Response(
            JSON.stringify({ error: 'contractor_user_id and display_name are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Create Stripe coupon if discount is provided
        let stripeCouponId: string | null = null;
        if (request.discount_percent && request.discount_percent > 0) {
          try {
            const coupon = await stripe.coupons.create({
              percent_off: request.discount_percent,
              duration: 'forever',
              name: `Partner: ${request.display_name}`,
              metadata: {
                partner_name: request.display_name,
                created_by: 'workie_admin',
              },
            });
            stripeCouponId = coupon.id;
            console.log('[manage-partner] Created Stripe coupon:', stripeCouponId);
          } catch (stripeError) {
            console.error('[manage-partner] Stripe coupon creation failed:', stripeError);
          }
        }

        const { data: partner, error } = await supabase
          .from('partners')
          .insert({
            contractor_user_id: request.contractor_user_id,
            display_name: request.display_name,
            logo_url: request.logo_url || null,
            is_active: request.is_active ?? true,
            discount_percent: request.discount_percent || 0,
            stripe_coupon_id: stripeCouponId,
          })
          .select()
          .single();

        if (error) {
          console.error('[manage-partner] Create error:', error);
          return new Response(
            JSON.stringify({ error: 'Failed to create partner' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, partner }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update': {
        if (!request.partner_id) {
          return new Response(
            JSON.stringify({ error: 'partner_id is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get existing partner
        const { data: existingPartner } = await supabase
          .from('partners')
          .select('*')
          .eq('id', request.partner_id)
          .single();

        if (!existingPartner) {
          return new Response(
            JSON.stringify({ error: 'Partner not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Handle Stripe coupon update
        let stripeCouponId = existingPartner.stripe_coupon_id;
        const discountChanged = request.discount_percent !== undefined && 
          request.discount_percent !== existingPartner.discount_percent;

        if (discountChanged) {
          // Delete old coupon if exists
          if (existingPartner.stripe_coupon_id) {
            try {
              await stripe.coupons.del(existingPartner.stripe_coupon_id);
              console.log('[manage-partner] Deleted old Stripe coupon:', existingPartner.stripe_coupon_id);
            } catch (e) {
              console.log('[manage-partner] Could not delete old coupon:', e);
            }
          }

          // Create new coupon if discount > 0
          if (request.discount_percent && request.discount_percent > 0) {
            try {
              const coupon = await stripe.coupons.create({
                percent_off: request.discount_percent,
                duration: 'forever',
                name: `Partner: ${request.display_name || existingPartner.display_name}`,
                metadata: {
                  partner_name: request.display_name || existingPartner.display_name,
                  created_by: 'workie_admin',
                },
              });
              stripeCouponId = coupon.id;
              console.log('[manage-partner] Created new Stripe coupon:', stripeCouponId);
            } catch (stripeError) {
              console.error('[manage-partner] Stripe coupon creation failed:', stripeError);
              stripeCouponId = null;
            }
          } else {
            stripeCouponId = null;
          }
        }

        const updateData: any = { stripe_coupon_id: stripeCouponId };
        if (request.display_name !== undefined) updateData.display_name = request.display_name;
        if (request.logo_url !== undefined) updateData.logo_url = request.logo_url;
        if (request.is_active !== undefined) updateData.is_active = request.is_active;
        if (request.discount_percent !== undefined) updateData.discount_percent = request.discount_percent;

        const { data: partner, error } = await supabase
          .from('partners')
          .update(updateData)
          .eq('id', request.partner_id)
          .select()
          .single();

        if (error) {
          console.error('[manage-partner] Update error:', error);
          return new Response(
            JSON.stringify({ error: 'Failed to update partner' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, partner }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete': {
        if (!request.partner_id) {
          return new Response(
            JSON.stringify({ error: 'partner_id is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get partner to delete coupon
        const { data: partner } = await supabase
          .from('partners')
          .select('stripe_coupon_id')
          .eq('id', request.partner_id)
          .single();

        // Delete Stripe coupon if exists
        if (partner?.stripe_coupon_id) {
          try {
            await stripe.coupons.del(partner.stripe_coupon_id);
            console.log('[manage-partner] Deleted Stripe coupon:', partner.stripe_coupon_id);
          } catch (e) {
            console.log('[manage-partner] Could not delete coupon:', e);
          }
        }

        const { error } = await supabase
          .from('partners')
          .delete()
          .eq('id', request.partner_id);

        if (error) {
          console.error('[manage-partner] Delete error:', error);
          return new Response(
            JSON.stringify({ error: 'Failed to delete partner' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
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
    console.error('[manage-partner] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});