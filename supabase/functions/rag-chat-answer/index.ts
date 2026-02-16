import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
const EMBEDDING_MODEL = "text-embedding-004";
const CHAT_MODEL = "google/gemini-2.5-flash";
const EMBEDDING_DIMS = 1536;
const MATCH_COUNT = 5;
const MIN_SIMILARITY = 0.78;
const NO_ANSWER = "Sorry — this information isn't available on Workie yet.";

const SYSTEM_PROMPT = `You are Workie's assistant. Answer ONLY using the provided sources. If sources do not contain the answer, say:
"${NO_ANSWER}"
Do not use outside knowledge. Keep it short and practical.
Return your response as JSON with this structure:
{
  "answer": "string",
  "sources": [{"title":"string","slug":"string"}]
}
Only return valid JSON, no markdown code fences.`;

async function getEmbedding(text: string, apiKey: string): Promise<number[]> {
  const response = await fetch(`${AI_GATEWAY_URL}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text,
      dimensions: EMBEDDING_DIMS,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Embedding API error [${response.status}]: ${errBody}`);
  }

  const result = await response.json();
  return result.data[0].embedding;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { question, article_slug } = await req.json();

    if (!question || typeof question !== "string" || question.trim().length < 3) {
      return new Response(
        JSON.stringify({ error: "A valid question is required (min 3 characters)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve article_slug to article_id if provided
    let scopeArticleId: string | null = null;
    if (article_slug) {
      const { data: articleData } = await supabase
        .from("articles")
        .select("id")
        .eq("slug", article_slug)
        .eq("is_published", true)
        .single();

      if (articleData) {
        scopeArticleId = articleData.id;
      }
      // If slug not found, continue without scoping (search all articles)
    }

    // 1. Embed the question
    console.log(`[rag] Embedding question: "${question.slice(0, 80)}..."`);
    const queryEmbedding = await getEmbedding(question, LOVABLE_API_KEY);

    // 2. Search for matching chunks via RPC
    const { data: chunks, error: rpcError } = await supabase.rpc(
      "match_article_chunks",
      {
        query_embedding: JSON.stringify(queryEmbedding),
        match_count: MATCH_COUNT,
        min_similarity: MIN_SIMILARITY,
        scope_article_id: scopeArticleId,
      }
    );

    if (rpcError) {
      console.error("[rag] RPC error:", rpcError);
      return new Response(
        JSON.stringify({ error: "Search failed", details: rpcError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Check if we have relevant results
    if (!chunks || chunks.length === 0) {
      console.log("[rag] No matching chunks found");
      return new Response(
        JSON.stringify({
          answer: NO_ANSWER,
          sources: [],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[rag] Found ${chunks.length} chunks, top similarity: ${chunks[0]?.similarity}`);

    // 4. Build sources context for LLM
    const uniqueSources = new Map<string, { title: string; slug: string }>();
    const sourcesText = chunks
      .map((chunk: { chunk_text: string; title: string; slug: string; similarity: number }, i: number) => {
        uniqueSources.set(chunk.slug, { title: chunk.title, slug: chunk.slug });
        return `[Source ${i + 1}: "${chunk.title}" (${chunk.slug})]:\n${chunk.chunk_text}`;
      })
      .join("\n\n---\n\n");

    const userPrompt = `Question: ${question}\n\nSources:\n${sourcesText}`;

    // 5. Call LLM for answer
    const llmResponse = await fetch(`${AI_GATEWAY_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
      }),
    });

    if (!llmResponse.ok) {
      if (llmResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (llmResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted, please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await llmResponse.text();
      throw new Error(`LLM API error [${llmResponse.status}]: ${errText}`);
    }

    const llmResult = await llmResponse.json();
    const rawContent = llmResult.choices?.[0]?.message?.content || "";

    // 6. Parse LLM JSON response
    let answer: string;
    let sources: { title: string; slug: string }[];

    try {
      // Strip markdown code fences if present
      const cleaned = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleaned);
      answer = parsed.answer || NO_ANSWER;
      sources = Array.isArray(parsed.sources) ? parsed.sources : Array.from(uniqueSources.values());
    } catch {
      // If JSON parsing fails, use raw content as answer
      console.warn("[rag] Failed to parse LLM JSON, using raw content");
      answer = rawContent || NO_ANSWER;
      sources = Array.from(uniqueSources.values());
    }

    return new Response(
      JSON.stringify({ answer, sources }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[rag] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
