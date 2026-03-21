-- Bảng bình luận tài liệu (đã áp migration create_document_comments qua Supabase nếu dùng MCP)
-- Chạy thủ công nếu cần đồng bộ môi trường khác:

CREATE TABLE IF NOT EXISTS public.document_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_comments_document_id ON public.document_comments(document_id);
CREATE INDEX IF NOT EXISTS idx_document_comments_doc_created ON public.document_comments(document_id, created_at DESC);
