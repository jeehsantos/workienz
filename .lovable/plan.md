
# Fix RAG Chat: Bulk Ingest + Improved Search

## Root Cause
Only 1 of 12 published articles has been chunked and indexed. The remaining 11 articles have 0 entries in `article_chunks`, so the full-text search finds nothing for questions about IRD numbers, arriving in NZ, bank accounts, etc.

## Changes

### 1. Bulk Ingest All Published Articles
Create a new edge function `bulk-ingest-articles` that:
- Fetches all published articles that have no chunks in `article_chunks`
- Calls `ingest-article-embeddings` for each one sequentially
- Returns a summary of how many articles were processed

This is a one-time catch-up operation. Going forward, articles are auto-ingested when published/updated.

### 2. Improve Search Matching in `rag-chat-answer`
Update the `match_article_chunks` database function to be more lenient:
- Try `websearch_to_tsquery` first (handles quoted phrases, boolean operators)
- If no results, fall back to `plainto_tsquery` (treats input as plain words joined by AND)
- If still no results, try individual keywords with OR logic using `to_tsquery`
- This ensures natural questions like "How can I get an IRD number?" match articles containing those words even if the phrasing differs

### 3. Trigger Bulk Ingestion
After deploying, invoke the bulk ingest function to populate chunks for all 11 missing articles.

## Technical Details

### New Edge Function: `bulk-ingest-articles`
- Location: `supabase/functions/bulk-ingest-articles/index.ts`
- Queries all published articles with 0 chunks
- For each article, calls the existing `ingest-article-embeddings` function logic inline (reusing the same chunking code)
- No external API calls needed (FTS-only pipeline)

### Database Migration: Improve `match_article_chunks` RPC
Update the function to use a multi-strategy approach:
1. First try `websearch_to_tsquery('english', query_text)` -- current behavior
2. If no rows returned, retry with `plainto_tsquery('english', query_text)` -- broader AND matching
3. As a last resort, split the query into individual words and search with OR logic

This way, a question like "How can I get an IRD number?" will match articles containing "IRD" and "number" even if the exact phrase structure differs.

### Update `supabase/config.toml`
Add the new `bulk-ingest-articles` function with `verify_jwt = false`.

## Expected Result
- All 12 published articles will have searchable chunks
- Questions like "How do I get an IRD number?" will match the IRD article
- Questions like "what should I do first when I arrive in NZ?" will match the "First things to do" article
- The chat widget will return relevant answers with source links
