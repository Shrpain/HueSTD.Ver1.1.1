-- Migration: fuzzy_search_documents
-- Enable pg_trgm for trigram-based fuzzy search
-- Enable unaccent for Vietnamese accent-insensitive search

-- 1. Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2. Create GIN indexes for fuzzy search performance
CREATE INDEX IF NOT EXISTS idx_documents_title_trgm
    ON documents USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_documents_description_trgm
    ON documents USING gin (description gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_documents_subject_trgm
    ON documents USING gin (subject gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_documents_school_trgm
    ON documents USING gin (school gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_documents_created_at
    ON documents (created_at DESC);

-- 3. Main fuzzy search function with trigram + ILIKE + unaccent
CREATE OR REPLACE FUNCTION search_documents_fuzzy(
    p_search TEXT,
    p_is_approved BOOLEAN DEFAULT NULL,
    p_type TEXT DEFAULT NULL,
    p_school TEXT DEFAULT NULL,
    p_page INT DEFAULT 1,
    p_page_size INT DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    file_url TEXT,
    uploader_id UUID,
    school TEXT,
    subject TEXT,
    type TEXT,
    year TEXT,
    status TEXT,
    views INT,
    downloads INT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    is_approved BOOLEAN,
    similarity_score FLOAT
)
LANGUAGE plpgsql
AS $$
DECLARE
    offset_val INT;
    has_search BOOLEAN;
BEGIN
    offset_val := (p_page - 1) * p_page_size;
    has_search := p_search IS NOT NULL AND p_search <> '';

    RETURN QUERY
    WITH base_filtered AS (
        SELECT
            d.*,
            GREATEST(
                similarity(d.title, p_search),
                COALESCE(similarity(d.description, p_search), 0),
                COALESCE(similarity(d.subject, p_search), 0),
                0
            ) AS sim_score
        FROM documents d
        WHERE
            (p_is_approved IS NULL OR d.is_approved = p_is_approved)
            AND (p_type IS NULL OR d.type = p_type)
            AND (p_school IS NULL OR d.school = p_school)
    )
    SELECT
        bf.id,
        bf.title,
        bf.description,
        bf.file_url,
        bf.uploader_id,
        bf.school,
        bf.subject,
        bf.type,
        bf.year,
        bf.status,
        bf.views,
        bf.downloads,
        bf.created_at,
        bf.updated_at,
        bf.is_approved,
        bf.sim_score
    FROM base_filtered bf
    WHERE
        NOT has_search
        OR bf.sim_score > 0
        OR bf.title ILIKE '%' || p_search || '%'
        OR bf.description ILIKE '%' || p_search || '%'
        OR bf.subject ILIKE '%' || p_search || '%'
        OR bf.school ILIKE '%' || p_search || '%'
        OR unaccent(bf.title) ILIKE '%' || unaccent(p_search) || '%'
        OR unaccent(bf.description) ILIKE '%' || unaccent(p_search) || '%'
        OR unaccent(bf.subject) ILIKE '%' || unaccent(p_search) || '%'
        OR unaccent(bf.school) ILIKE '%' || unaccent(p_search) || '%'
    ORDER BY
        CASE WHEN has_search THEN bf.sim_score ELSE 0 END DESC,
        bf.created_at DESC
    LIMIT p_page_size
    OFFSET offset_val;
END;
$$;

-- 4. Count function for pagination
CREATE OR REPLACE FUNCTION search_documents_fuzzy_count(
    p_search TEXT,
    p_is_approved BOOLEAN DEFAULT NULL,
    p_type TEXT DEFAULT NULL,
    p_school TEXT DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    result_count INT;
    has_search BOOLEAN;
BEGIN
    has_search := p_search IS NOT NULL AND p_search <> '';

    -- Use a simple approach: count with WHERE condition
    -- The trigram condition `%` is checked separately
    SELECT COUNT(*) INTO result_count
    FROM documents d
    WHERE
        (p_is_approved IS NULL OR d.is_approved = p_is_approved)
        AND (p_type IS NULL OR d.type = p_type)
        AND (p_school IS NULL OR d.school = p_school)
        AND (
            NOT has_search
            OR d.title ILIKE '%' || p_search || '%'
            OR d.description ILIKE '%' || p_search || '%'
            OR d.subject ILIKE '%' || p_search || '%'
            OR d.school ILIKE '%' || p_search || '%'
            OR unaccent(d.title) ILIKE '%' || unaccent(p_search) || '%'
            OR unaccent(d.description) ILIKE '%' || unaccent(p_search) || '%'
            OR unaccent(d.subject) ILIKE '%' || unaccent(p_search) || '%'
            OR unaccent(d.school) ILIKE '%' || unaccent(p_search) || '%'
            OR d.title % p_search
            OR d.description % p_search
            OR d.subject % p_search
        );

    RETURN COALESCE(result_count, 0);
END;
$$;

-- 5. Grant execute permissions
GRANT EXECUTE ON FUNCTION search_documents_fuzzy(TEXT, BOOLEAN, TEXT, TEXT, INT, INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION search_documents_fuzzy_count(TEXT, BOOLEAN, TEXT, TEXT) TO anon, authenticated;

COMMENT ON FUNCTION search_documents_fuzzy IS 'Fuzzy search for documents. Supports: pg_trgm similarity (typo tolerance), ILIKE (partial match), unaccent (Vietnamese diacritics). Returns documents with similarity_score.';
COMMENT ON FUNCTION search_documents_fuzzy_count IS 'Count matching documents for fuzzy search pagination.';
