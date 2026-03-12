
-- A) Add canonical_text column to articles
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS canonical_text text;

-- B) Create article_chunks table
CREATE TABLE public.article_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  chunk_text text NOT NULL,
  embedding extensions.vector(1536),
  token_count integer,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_article_chunks_article_id ON public.article_chunks USING btree (article_id);
CREATE INDEX idx_article_chunks_updated_at ON public.article_chunks USING btree (updated_at);
CREATE INDEX idx_article_chunks_embedding ON public.article_chunks USING hnsw (embedding extensions.vector_cosine_ops);

-- Enable RLS - no policies = deny all direct access for anon/authenticated
ALTER TABLE public.article_chunks ENABLE ROW LEVEL SECURITY;

-- C) RPC for similarity search
CREATE OR REPLACE FUNCTION public.match_article_chunks(
  query_embedding extensions.vector(1536),
  match_count integer DEFAULT 5,
  min_similarity float DEFAULT 0.7,
  scope_article_id uuid DEFAULT NULL
)
RETURNS TABLE (
  article_id uuid,
  chunk_text text,
  similarity float,
  title text,
  slug text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ac.article_id,
    ac.chunk_text,
    (1 - (ac.embedding <=> query_embedding))::float AS similarity,
    a.title,
    a.slug
  FROM public.article_chunks ac
  JOIN public.articles a ON a.id = ac.article_id
  WHERE a.is_published = true
    AND (scope_article_id IS NULL OR ac.article_id = scope_article_id)
    AND (1 - (ac.embedding <=> query_embedding))::float >= min_similarity
  ORDER BY ac.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
