
-- 1. Add search_vector column to article_chunks
ALTER TABLE public.article_chunks ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- 2. Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_article_chunks_search_vector ON public.article_chunks USING GIN (search_vector);

-- 3. Drop the old vector-based match_article_chunks function
DROP FUNCTION IF EXISTS public.match_article_chunks(extensions.vector, integer, double precision, uuid);

-- 4. Create new full-text search version of match_article_chunks
CREATE OR REPLACE FUNCTION public.match_article_chunks(
  query_text text,
  match_count integer DEFAULT 5,
  min_similarity double precision DEFAULT 0.0,
  scope_article_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  article_id uuid,
  chunk_text text,
  similarity double precision,
  title text,
  slug text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ac.article_id,
    ac.chunk_text,
    ts_rank_cd(ac.search_vector, websearch_to_tsquery('english', query_text))::double precision AS similarity,
    a.title,
    a.slug
  FROM public.article_chunks ac
  JOIN public.articles a ON a.id = ac.article_id
  WHERE a.is_published = true
    AND ac.search_vector IS NOT NULL
    AND ac.search_vector @@ websearch_to_tsquery('english', query_text)
    AND (scope_article_id IS NULL OR ac.article_id = scope_article_id)
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- 5. Auto-populate search_vector on insert/update via trigger
CREATE OR REPLACE FUNCTION public.update_chunk_search_vector()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', NEW.chunk_text);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_chunk_search_vector
BEFORE INSERT OR UPDATE OF chunk_text ON public.article_chunks
FOR EACH ROW
EXECUTE FUNCTION public.update_chunk_search_vector();

-- 6. Backfill search_vector for any existing chunks
UPDATE public.article_chunks
SET search_vector = to_tsvector('english', chunk_text)
WHERE search_vector IS NULL;
