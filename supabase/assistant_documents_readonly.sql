-- Read-only role and grants for backend-only document access.
-- Run this in Supabase SQL Editor as a privileged admin.
-- Do NOT expose any resulting credential to the frontend.

-- 1. Create a dedicated read-only role
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'assistant_documents_readonly') then
    create role assistant_documents_readonly noinherit;
  end if;
end $$;

-- 2. Minimum database/schema access
grant usage on schema public to assistant_documents_readonly;

-- 3. Allow read only on documents
grant select on table public.documents to assistant_documents_readonly;

-- 4. Explicitly deny write privileges on documents
revoke insert, update, delete, truncate, references, trigger on table public.documents from assistant_documents_readonly;

-- 5. Revoke all access from other app tables for this role
revoke all privileges on table public.profiles from assistant_documents_readonly;
revoke all privileges on table public.notifications from assistant_documents_readonly;
revoke all privileges on table public.chat_conversations from assistant_documents_readonly;
revoke all privileges on table public.chat_messages from assistant_documents_readonly;
revoke all privileges on table public.document_comments from assistant_documents_readonly;
revoke all privileges on table public.api_settings from assistant_documents_readonly;
revoke all privileges on table public.user_ai_usage from assistant_documents_readonly;

-- 6. Optional RLS policy example if you want the role to see only approved documents
alter table public.documents enable row level security;

drop policy if exists assistant_documents_readonly_select on public.documents;
create policy assistant_documents_readonly_select
on public.documents
for select
to assistant_documents_readonly
using (is_approved = true);

-- 7. Notes
-- You still need a backend-only credential path to use this role safely.
-- Never place that credential in the React frontend or public env vars.
