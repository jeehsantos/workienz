import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENAI_EMBEDDING_URL = "https://api.openai.com/v1/embeddings";
const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMS = 1536;
const CHUNK_TARGET_CHARS = 1500; // ~375 tokens
const CHUNK_OVERLAP_CHARS = 200; // ~50 tokens

// ---------- helpers ----------

interface ContentBlock {
  type: string;
  value?: string;
  content?: string;
  heading?: string;
  items?: string[];
  text?: string;
  title?: string;
}

function blocksToPlainText(blocks: ContentBlock[]): string {
  const parts: string[] = [];
  for (const block of blocks) {
    if (block.type === "heading" && block.value) {
      parts.push(`\n${block.value}\n`);
    } else if (block.type === "tip" && block.value) {
      parts.push(`Tip: ${block.value}`);
    } else if (block.type === "warning" && block.value) {
      parts.push(`Warning: ${block.value}`);
    } else if (block.value) {
      parts.push(block.value);
    } else if (block.content) {
      parts.push(block.content);
    } else if (block.text) {
      parts.push(block.text);
    }
    if (block.heading) parts.push(`\n${block.heading}\n`);
    if (block.items && Array.isArray(block.items)) {
      for (const item of block.items) {
        parts.push(`• ${item}`);
      }
    }
  }
  return parts.join("\n").trim();
}

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  if (text.length <= CHUNK_TARGET_CHARS) {
    chunks.push(text);
    return chunks;
  }

  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + CHUNK_TARGET_CHARS, text.length);

    // Try to break at a paragraph or sentence boundary
    if (end < text.length) {
      const slice = text.slice(start, end);
      const lastParagraph = slice.lastIndexOf("\n\n");
      const lastSentence = slice.lastIndexOf(". ");

      if (lastParagraph > CHUNK_TARGET_CHARS * 0.5) {
        end = start + lastParagraph + 2;
      } else if (lastSentence > CHUNK_TARGET_CHARS * 0.3) {
        end = start + lastSentence + 2;
      }
    }

    chunks.push(text.slice(start, end).trim());
    start = Math.max(start + 1, end - CHUNK_OVERLAP_CHARS);
  }

  return chunks.filter((c) => c.length > 20);
}

async function getEmbedding(
  text: string,
  apiKey: string
): Promise<number[]> {
  const response = await fetch(OPENAI_EMBEDDING_URL, {
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
    throw new Error(
      `Embedding API error [${response.status}]: ${errBody}`
    );
  }

  const result = await response.json();
  return result.data[0].embedding;
}

async function getEmbeddingsBatch(
  texts: string[],
  apiKey: string
): Promise<number[][]> {
  const response = await fetch(OPENAI_EMBEDDING_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts,
      dimensions: EMBEDDING_DIMS,
    }),
  });

  if (!response.ok) {
    // Fall back to sequential
    console.log("[ingest] Batch embedding failed, falling back to sequential");
    const embeddings: number[][] = [];
    for (const text of texts) {
      embeddings.push(await getEmbedding(text, apiKey));
    }
    return embeddings;
  }

  const result = await response.json();
  return result.data
    .sort((a: { index: number }, b: { index: number }) => a.index - b.index)
    .map((d: { embedding: number[] }) => d.embedding);
}

// ---------- main ----------

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { article_id } = await req.json();
    if (!article_id) {
      return new Response(
        JSON.stringify({ error: "article_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Fetch article
    const { data: article, error: fetchError } = await supabase
      .from("articles")
      .select("id, title, content, content_blocks, is_published, canonical_text")
      .eq("id", article_id)
      .single();

    if (fetchError || !article) {
      return new Response(
        JSON.stringify({ error: "Article not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Skip drafts
    if (!article.is_published) {
      // Clean up any existing chunks for unpublished articles
      await supabase
        .from("article_chunks")
        .delete()
        .eq("article_id", article_id);

      return new Response(
        JSON.stringify({ message: "Article is not published, skipping embedding. Existing chunks removed." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Build canonical text
    let canonicalText = "";
    if (
      article.content_blocks &&
      Array.isArray(article.content_blocks) &&
      article.content_blocks.length > 0
    ) {
      canonicalText = blocksToPlainText(article.content_blocks as ContentBlock[]);
    } else if (article.content) {
      canonicalText = article.content;
    }

    if (!canonicalText || canonicalText.trim().length < 50) {
      return new Response(
        JSON.stringify({ error: "Article content too short for embedding" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prepend title for better context
    canonicalText = `${article.title}\n\n${canonicalText}`;

    // 3. Save canonical_text
    const { error: updateError } = await supabase
      .from("articles")
      .update({ canonical_text: canonicalText })
      .eq("id", article_id);

    if (updateError) {
      console.error("[ingest] Failed to save canonical_text:", updateError);
    }

    // 4. Chunk
    const chunks = chunkText(canonicalText);
    console.log(`[ingest] Article ${article_id}: ${chunks.length} chunks from ${canonicalText.length} chars`);

    // 5. Embed all chunks
    const embeddings = await getEmbeddingsBatch(chunks, OPENAI_API_KEY);

    // 6. Delete old chunks and insert new ones
    const { error: deleteError } = await supabase
      .from("article_chunks")
      .delete()
      .eq("article_id", article_id);

    if (deleteError) {
      console.error("[ingest] Failed to delete old chunks:", deleteError);
    }

    // Insert chunks using service role (bypasses RLS)
    const rows = chunks.map((text, i) => ({
      article_id,
      chunk_index: i,
      chunk_text: text,
      embedding: JSON.stringify(embeddings[i]),
      token_count: Math.ceil(text.length / 4), // rough estimate
    }));

    const { error: insertError } = await supabase
      .from("article_chunks")
      .insert(rows);

    if (insertError) {
      console.error("[ingest] Failed to insert chunks:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to store embeddings", details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[ingest] Successfully embedded article ${article_id}: ${chunks.length} chunks`);

    return new Response(
      JSON.stringify({
        success: true,
        article_id,
        chunks_created: chunks.length,
        canonical_text_length: canonicalText.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[ingest] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
