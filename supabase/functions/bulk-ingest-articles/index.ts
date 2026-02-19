import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CHUNK_TARGET_CHARS = 1500;
const CHUNK_OVERLAP_CHARS = 200;

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
    start = end >= text.length ? text.length : Math.max(end - CHUNK_OVERLAP_CHARS, start + 1);
  }

  return chunks.filter((c) => c.length > 20);
}

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

    // Find published articles with no chunks
    const { data: articles, error: fetchError } = await supabase
      .from("articles")
      .select("id, title, content, content_blocks, is_published")
      .eq("is_published", true);

    if (fetchError) {
      throw new Error(`Failed to fetch articles: ${fetchError.message}`);
    }

    const { data: existingChunks } = await supabase
      .from("article_chunks")
      .select("article_id");

    const chunkedArticleIds = new Set(
      (existingChunks || []).map((c: { article_id: string }) => c.article_id)
    );

    const unindexed = (articles || []).filter((a) => !chunkedArticleIds.has(a.id));
    console.log(`[bulk-ingest] Found ${unindexed.length} unindexed articles out of ${articles?.length || 0} published`);

    let processed = 0;
    let failed = 0;
    const results: { id: string; title: string; chunks: number; error?: string }[] = [];

    for (const article of unindexed) {
      try {
        let canonicalText = "";
        if (article.content_blocks && Array.isArray(article.content_blocks) && article.content_blocks.length > 0) {
          canonicalText = blocksToPlainText(article.content_blocks as ContentBlock[]);
        } else if (article.content) {
          canonicalText = article.content;
        }

        if (!canonicalText || canonicalText.trim().length < 50) {
          results.push({ id: article.id, title: article.title, chunks: 0, error: "Content too short" });
          failed++;
          continue;
        }

        canonicalText = `${article.title}\n\n${canonicalText}`;

        // Save canonical_text
        await supabase
          .from("articles")
          .update({ canonical_text: canonicalText })
          .eq("id", article.id);

        // Chunk and insert
        const chunks = chunkText(canonicalText);
        const rows = chunks.map((text, i) => ({
          article_id: article.id,
          chunk_index: i,
          chunk_text: text,
          token_count: Math.ceil(text.length / 4),
        }));

        const { error: insertError } = await supabase
          .from("article_chunks")
          .insert(rows);

        if (insertError) {
          results.push({ id: article.id, title: article.title, chunks: 0, error: insertError.message });
          failed++;
        } else {
          results.push({ id: article.id, title: article.title, chunks: chunks.length });
          processed++;
        }

        console.log(`[bulk-ingest] ${article.title}: ${chunks.length} chunks`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        results.push({ id: article.id, title: article.title, chunks: 0, error: msg });
        failed++;
      }
    }

    return new Response(
      JSON.stringify({ processed, failed, total: unindexed.length, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[bulk-ingest] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
