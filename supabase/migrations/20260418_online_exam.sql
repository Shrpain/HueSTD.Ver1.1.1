create table if not exists public.exam_documents (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references public.profiles(id) on delete cascade,
    title text not null,
    description text null,
    creation_mode text not null default 'manual' check (creation_mode in ('manual', 'ai')),
    status text not null default 'draft' check (status in ('draft', 'ready', 'published', 'archived')),
    duration_minutes integer not null default 30 check (duration_minutes > 0 and duration_minutes <= 480),
    total_questions integer not null default 0 check (total_questions >= 0),
    total_points numeric(10,2) not null default 0 check (total_points >= 0),
    source_count integer not null default 0 check (source_count >= 0),
    ai_prompt_version text null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.exam_sources (
    id uuid primary key default gen_random_uuid(),
    exam_document_id uuid not null references public.exam_documents(id) on delete cascade,
    document_id uuid not null references public.documents(id) on delete restrict,
    position integer not null default 0,
    is_included boolean not null default true,
    created_at timestamptz not null default timezone('utc', now()),
    unique (exam_document_id, document_id)
);

create table if not exists public.document_ingestions (
    id uuid primary key default gen_random_uuid(),
    document_id uuid not null references public.documents(id) on delete cascade,
    created_by uuid not null references public.profiles(id) on delete cascade,
    file_url_snapshot text null,
    content_hash text not null,
    status text not null default 'pending' check (status in ('pending', 'processing', 'ready', 'failed')),
    extractor text null,
    ocr_used boolean not null default false,
    page_count integer not null default 0,
    char_count integer not null default 0,
    text_content text null,
    metadata_json text null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.document_ingestion_chunks (
    id uuid primary key default gen_random_uuid(),
    ingestion_id uuid not null references public.document_ingestions(id) on delete cascade,
    chunk_index integer not null,
    chunk_text text not null,
    token_estimate integer not null default 0,
    page_from integer null,
    page_to integer null,
    created_at timestamptz not null default timezone('utc', now()),
    unique (ingestion_id, chunk_index)
);

create table if not exists public.exam_questions (
    id uuid primary key default gen_random_uuid(),
    exam_document_id uuid not null references public.exam_documents(id) on delete cascade,
    question_order integer not null,
    question_text text not null,
    points numeric(10,2) not null default 1 check (points >= 0 and points <= 10),
    created_by text not null default 'manual' check (created_by in ('manual', 'ai', 'edited_ai')),
    source_refs_json text null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    unique (exam_document_id, question_order)
);

create table if not exists public.exam_question_options (
    id uuid primary key default gen_random_uuid(),
    question_id uuid not null references public.exam_questions(id) on delete cascade,
    option_key text not null check (option_key in ('A', 'B', 'C', 'D')),
    option_text text not null,
    is_correct boolean not null default false,
    created_at timestamptz not null default timezone('utc', now()),
    unique (question_id, option_key)
);

create unique index if not exists exam_question_options_single_correct_idx
    on public.exam_question_options(question_id)
    where is_correct = true;

create table if not exists public.exam_attempts (
    id uuid primary key default gen_random_uuid(),
    exam_document_id uuid not null references public.exam_documents(id) on delete cascade,
    user_id uuid not null references public.profiles(id) on delete cascade,
    status text not null default 'in_progress' check (status in ('in_progress', 'submitted', 'auto_submitted', 'graded')),
    started_at timestamptz not null default timezone('utc', now()),
    countdown_started_at timestamptz not null default timezone('utc', now()),
    submitted_at timestamptz null,
    expires_at timestamptz not null,
    score numeric(10,2) not null default 0,
    max_score numeric(10,2) not null default 0,
    time_spent_seconds integer not null default 0
);

create table if not exists public.exam_attempt_answers (
    id uuid primary key default gen_random_uuid(),
    attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
    question_id uuid not null references public.exam_questions(id) on delete cascade,
    selected_option_key text null check (selected_option_key in ('A', 'B', 'C', 'D')),
    is_correct boolean not null default false,
    awarded_points numeric(10,2) not null default 0,
    answered_at timestamptz not null default timezone('utc', now()),
    unique (attempt_id, question_id)
);

create index if not exists exam_documents_owner_idx on public.exam_documents(owner_id, updated_at desc);
create index if not exists exam_sources_exam_idx on public.exam_sources(exam_document_id, position);
create index if not exists exam_sources_document_idx on public.exam_sources(document_id);
create index if not exists document_ingestions_document_idx on public.document_ingestions(document_id, updated_at desc);
create index if not exists document_ingestions_created_by_idx on public.document_ingestions(created_by);
create index if not exists document_ingestion_chunks_ingestion_idx on public.document_ingestion_chunks(ingestion_id, chunk_index);
create index if not exists exam_questions_exam_idx on public.exam_questions(exam_document_id, question_order);
create index if not exists exam_question_options_question_idx on public.exam_question_options(question_id);
create index if not exists exam_attempts_user_idx on public.exam_attempts(user_id, started_at desc);
create index if not exists exam_attempts_exam_document_idx on public.exam_attempts(exam_document_id);
create index if not exists exam_attempt_answers_attempt_idx on public.exam_attempt_answers(attempt_id);
create index if not exists exam_attempt_answers_question_idx on public.exam_attempt_answers(question_id);

alter table public.exam_documents enable row level security;
alter table public.exam_sources enable row level security;
alter table public.document_ingestions enable row level security;
alter table public.document_ingestion_chunks enable row level security;
alter table public.exam_questions enable row level security;
alter table public.exam_question_options enable row level security;
alter table public.exam_attempts enable row level security;
alter table public.exam_attempt_answers enable row level security;

drop policy if exists exam_documents_owner_select on public.exam_documents;
create policy exam_documents_owner_select on public.exam_documents
    for select using (owner_id = auth.uid());

drop policy if exists exam_documents_owner_insert on public.exam_documents;
create policy exam_documents_owner_insert on public.exam_documents
    for insert with check (owner_id = auth.uid());

drop policy if exists exam_documents_owner_update on public.exam_documents;
create policy exam_documents_owner_update on public.exam_documents
    for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists exam_documents_owner_delete on public.exam_documents;
create policy exam_documents_owner_delete on public.exam_documents
    for delete using (owner_id = auth.uid());

drop policy if exists exam_sources_owner_all on public.exam_sources;
create policy exam_sources_owner_all on public.exam_sources
    for all using (
        exists (
            select 1
            from public.exam_documents e
            where e.id = exam_document_id and e.owner_id = auth.uid()
        )
    ) with check (
        exists (
            select 1
            from public.exam_documents e
            where e.id = exam_document_id and e.owner_id = auth.uid()
        )
    );

drop policy if exists document_ingestions_owner_all on public.document_ingestions;
create policy document_ingestions_owner_all on public.document_ingestions
    for all using (created_by = auth.uid()) with check (created_by = auth.uid());

drop policy if exists document_ingestion_chunks_owner_all on public.document_ingestion_chunks;
create policy document_ingestion_chunks_owner_all on public.document_ingestion_chunks
    for all using (
        exists (
            select 1
            from public.document_ingestions di
            where di.id = ingestion_id and di.created_by = auth.uid()
        )
    ) with check (
        exists (
            select 1
            from public.document_ingestions di
            where di.id = ingestion_id and di.created_by = auth.uid()
        )
    );

drop policy if exists exam_questions_owner_all on public.exam_questions;
create policy exam_questions_owner_all on public.exam_questions
    for all using (
        exists (
            select 1
            from public.exam_documents e
            where e.id = exam_document_id and e.owner_id = auth.uid()
        )
    ) with check (
        exists (
            select 1
            from public.exam_documents e
            where e.id = exam_document_id and e.owner_id = auth.uid()
        )
    );

drop policy if exists exam_question_options_owner_all on public.exam_question_options;
create policy exam_question_options_owner_all on public.exam_question_options
    for all using (
        exists (
            select 1
            from public.exam_questions q
            join public.exam_documents e on e.id = q.exam_document_id
            where q.id = question_id and e.owner_id = auth.uid()
        )
    ) with check (
        exists (
            select 1
            from public.exam_questions q
            join public.exam_documents e on e.id = q.exam_document_id
            where q.id = question_id and e.owner_id = auth.uid()
        )
    );

drop policy if exists exam_attempts_owner_all on public.exam_attempts;
create policy exam_attempts_owner_all on public.exam_attempts
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists exam_attempt_answers_owner_all on public.exam_attempt_answers;
create policy exam_attempt_answers_owner_all on public.exam_attempt_answers
    for all using (
        exists (
            select 1
            from public.exam_attempts a
            where a.id = attempt_id and a.user_id = auth.uid()
        )
    ) with check (
        exists (
            select 1
            from public.exam_attempts a
            where a.id = attempt_id and a.user_id = auth.uid()
        )
    );
