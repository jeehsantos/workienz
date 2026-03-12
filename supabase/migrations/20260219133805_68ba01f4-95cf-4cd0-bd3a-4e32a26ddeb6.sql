
CREATE OR REPLACE FUNCTION public.match_article_chunks(
  query_text text,
  match_count integer DEFAULT 5,
  min_similarity double precision DEFAULT 0.0,
  scope_article_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(article_id uuid, chunk_text text, similarity double precision, title text, slug text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result_count integer;
BEGIN
  -- Strategy 1: websearch_to_tsquery (handles phrases, boolean operators)
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

  GET DIAGNOSTICS result_count = ROW_COUNT;
  IF result_count > 0 THEN RETURN; END IF;

  -- Strategy 2: plainto_tsquery (broader AND matching)
  RETURN QUERY
  SELECT
    ac.article_id,
    ac.chunk_text,
    ts_rank_cd(ac.search_vector, plainto_tsquery('english', query_text))::double precision AS similarity,
    a.title,
    a.slug
  FROM public.article_chunks ac
  JOIN public.articles a ON a.id = ac.article_id
  WHERE a.is_published = true
    AND ac.search_vector IS NOT NULL
    AND ac.search_vector @@ plainto_tsquery('english', query_text)
    AND (scope_article_id IS NULL OR ac.article_id = scope_article_id)
  ORDER BY similarity DESC
  LIMIT match_count;

  GET DIAGNOSTICS result_count = ROW_COUNT;
  IF result_count > 0 THEN RETURN; END IF;

  -- Strategy 3: individual keywords with OR logic
  RETURN QUERY
  SELECT
    ac.article_id,
    ac.chunk_text,
    ts_rank_cd(ac.search_vector, to_tsquery('english',
      array_to_string(
        ARRAY(
          SELECT lexeme FROM unnest(to_tsvector('english', query_text)) AS t(lexeme, positions, weights)
        ),
        ' | '
      )
    ))::double precision AS similarity,
    a.title,
    a.slug
  FROM public.article_chunks ac
  JOIN public.articles a ON a.id = ac.article_id
  WHERE a.is_published = true
    AND ac.search_vector IS NOT NULL
    AND ac.search_vector @@ to_tsquery('english',
      array_to_string(
        ARRAY(
          SELECT lexeme FROM unnest(to_tsvector('english', query_text)) AS t(lexeme, positions, weights)
        ),
        ' | '
      )
    )
    AND (scope_article_id IS NULL OR ac.article_id = scope_article_id)
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$function$;
