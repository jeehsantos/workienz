import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    // Ensure we always advance by at least half the chunk size to avoid infinite loops
    const nextStart = end - CHUNK_OVERLAP_CHARS;
    start = Math.max(start + Math.max(end - start, 1), nextStart);
    if (start <= end - CHUNK_OVERLAP_CHARS && end < text.length) {
      start = end - CHUNK_OVERLAP_CHARS;
    }
    // Simplify: always move forward by the chunk we just consumed minus overlap
    start = end >= text.length ? text.length : Math.max(end - CHUNK_OVERLAP_CHARS, start + 1);
  }

  return chunks.filter((c) => c.length > 20);
}

// ---------- main ----------

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
      await supabase
        .from("article_chunks")
        .delete()
        .eq("article_id", article_id);

      return new Response(
        JSON.stringify({ message: "Article is not published, skipping. Existing chunks removed." }),
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
        JSON.stringify({ error: "Article content too short for indexing" }),
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

    // 5. Delete old chunks and insert new ones
    const { error: deleteError } = await supabase
      .from("article_chunks")
      .delete()
      .eq("article_id", article_id);

    if (deleteError) {
      console.error("[ingest] Failed to delete old chunks:", deleteError);
    }

    // Insert chunks — the DB trigger auto-populates search_vector
    const rows = chunks.map((text, i) => ({
      article_id,
      chunk_index: i,
      chunk_text: text,
      token_count: Math.ceil(text.length / 4),
    }));

    const { error: insertError } = await supabase
      .from("article_chunks")
      .insert(rows);

    if (insertError) {
      console.error("[ingest] Failed to insert chunks:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to store chunks", details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[ingest] Successfully indexed article ${article_id}: ${chunks.length} chunks`);

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
