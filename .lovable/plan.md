

# Free RAG Pipeline - Replace OpenAI Embeddings with Full-Text Search

## Problem
The current RAG pipeline requires a paid OpenAI API key for `text-embedding-3-small` embeddings. The LLM chat answer already uses the free Lovable AI gateway (Gemini), so the only cost is embeddings.

## Solution
Replace vector similarity search with PostgreSQL full-text search (`tsvector`/`tsquery`). This is completely free, built into your database, and works well for article content where users ask questions using terms that appear in the articles.

## How It Works

1. **Ingestion** (`ingest-article-embeddings`):
   - Same chunking logic (build canonical_text, split into chunks)
   - Instead of generating embeddings, store a `tsvector` column on each chunk for full-text search
   - No external API calls needed

2. **Search** (`rag-chat-answer`):
   - Instead of embedding the question, use `plainto_tsquery` or `websearch_to_tsquery` to search chunks
   - Rank results using `ts_rank_cd` (built-in PostgreSQL ranking)
   - Pass top chunks to Gemini via Lovable AI gateway (free) to generate the answer

3. **Chat answer**: Uses `google/gemini-2.5-flash` via Lovable AI gateway -- no API key needed, included free.

## Trade-offs

| Aspect | Vector Search (current) | Full-Text Search (proposed) |
|--------|------------------------|----------------------------|
| Cost | Paid (OpenAI API) | Free |
| Semantic understanding | High (understands meaning) | Moderate (keyword matching) |
| Setup complexity | Requires API key | Built into database |
| Quality for article Q&A | Excellent | Good (articles contain the keywords users search for) |

For your use case -- answering questions strictly from your own article content -- full-text search is a strong fit because the answers are already in the text.

## Technical Changes

### 1. Database Migration
- Add a `search_vector tsvector` column to `article_chunks`
- Create a GIN index on it for fast searching
- Create/replace the `match_article_chunks` RPC to use `ts_rank_cd` instead of cosine similarity

### 2. Update `ingest-article-embeddings`
- Remove all OpenAI embedding calls
- After inserting chunks, update the `search_vector` column using `to_tsvector('english', chunk_text)`
- No external API dependencies

### 3. Update `rag-chat-answer`
- Remove OpenAI embedding call for the question
- Use the new full-text search RPC to find relevant chunks
- Keep Gemini (Lovable AI) for generating the final answer -- this is already free

### 4. Cleanup
- The `embedding` vector column on `article_chunks` can be kept (no harm) or dropped
- The `OPENAI_API_KEY` secret is no longer needed for RAG (may still be used elsewhere)

## Result
- Zero cost for the entire RAG pipeline
- No external API keys required
- Gemini handles the chat answer for free via Lovable AI
