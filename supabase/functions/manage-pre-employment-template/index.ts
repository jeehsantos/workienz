import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TemplateField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'file' | 'checkbox' | 'textarea';
  required: boolean;
}

interface TemplateSection {
  title: string;
  fields: TemplateField[];
}

interface TemplateSchema {
  sections: TemplateSection[];
}

function validateTemplateSchema(schema: unknown): schema is TemplateSchema {
  if (!schema || typeof schema !== 'object') return false;
  const s = schema as Record<string, unknown>;
  if (!Array.isArray(s.sections)) return false;

  for (const section of s.sections) {
    if (!section || typeof section !== 'object') return false;
    if (typeof section.title !== 'string' || !section.title.trim()) return false;
    if (!Array.isArray(section.fields)) return false;

    for (const field of section.fields) {
      if (!field || typeof field !== 'object') return false;
      if (typeof field.id !== 'string' || !field.id.trim()) return false;
      if (typeof field.label !== 'string' || !field.label.trim()) return false;
      if (!['text', 'number', 'date', 'file', 'checkbox', 'textarea'].includes(field.type)) return false;
      if (typeof field.required !== 'boolean') return false;
    }
  }
  return true;
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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const userId = claimsData.claims.sub as string;

    // Verify contractor role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'contractor')
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Only contractors can manage templates' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    const { action } = body;

    if (action === 'list') {
      const { data, error } = await supabase
        .from('contractor_pre_employment_templates')
        .select('id, name, version, created_at, updated_at')
        .eq('contractor_id', userId)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return new Response(JSON.stringify({ templates: data }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'get') {
      const { template_id } = body;
      if (!template_id) {
        return new Response(JSON.stringify({ error: 'template_id required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data, error } = await supabase
        .from('contractor_pre_employment_templates')
        .select('*')
        .eq('id', template_id)
        .eq('contractor_id', userId)
        .single();

      if (error || !data) {
        return new Response(JSON.stringify({ error: 'Template not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({ template: data }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'create') {
      const { name, template_schema } = body;
      if (!name?.trim()) {
        return new Response(JSON.stringify({ error: 'Template name is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (!validateTemplateSchema(template_schema)) {
        return new Response(JSON.stringify({ error: 'Invalid template schema structure' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data, error } = await supabase
        .from('contractor_pre_employment_templates')
        .insert({
          contractor_id: userId,
          name: name.trim(),
          template_schema,
        })
        .select('id, name, version, created_at')
        .single();

      if (error) throw error;
      return new Response(JSON.stringify({ template: data }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'update') {
      const { template_id, name, template_schema } = body;
      if (!template_id) {
        return new Response(JSON.stringify({ error: 'template_id required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const updates: Record<string, unknown> = {};
      if (name?.trim()) updates.name = name.trim();
      if (template_schema) {
        if (!validateTemplateSchema(template_schema)) {
          return new Response(JSON.stringify({ error: 'Invalid template schema structure' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        updates.template_schema = template_schema;
      }

      const { data, error } = await supabase
        .from('contractor_pre_employment_templates')
        .update(updates)
        .eq('id', template_id)
        .eq('contractor_id', userId)
        .select('id, name, version, updated_at')
        .single();

      if (error || !data) {
        return new Response(JSON.stringify({ error: 'Template not found or update failed' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({ template: data }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'delete') {
      const { template_id } = body;
      if (!template_id) {
        return new Response(JSON.stringify({ error: 'template_id required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Check if template is in use by any active packs
      const { count } = await supabase
        .from('application_pre_employment_packs')
        .select('id', { count: 'exact', head: true })
        .eq('template_id', template_id)
        .in('status', ['required', 'in_progress', 'submitted']);

      if (count && count > 0) {
        return new Response(JSON.stringify({ error: 'Cannot delete template that is in use by active packs' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { error } = await supabase
        .from('contractor_pre_employment_templates')
        .delete()
        .eq('id', template_id)
        .eq('contractor_id', userId);

      if (error) throw error;
      return new Response(JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[manage-pre-employment-template] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
