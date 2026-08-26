create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sync_runs (
  id uuid primary key,
  status text not null check (status in ('running', 'completed', 'failed')),
  trigger_source text not null check (trigger_source in ('github-action', 'manual-cli')),
  started_at timestamptz not null,
  completed_at timestamptz,
  total_metadata integer not null default 0 check (total_metadata >= 0),
  fetched_details integer not null default 0 check (fetched_details >= 0),
  imported integer not null default 0 check (imported >= 0),
  active_excluded integer not null default 0 check (active_excluded >= 0),
  error text
);

create table public.questions (
  id uuid primary key,
  display_id text not null unique,
  section text not null check (section in ('reading-writing', 'math')),
  domain_code text not null,
  domain_name text not null,
  skill_code text not null,
  skill_name text not null,
  difficulty text not null check (difficulty in ('medium', 'hard')),
  type text not null check (type in ('mcq', 'spr')),
  stimulus_html text,
  stem_html text not null,
  rationale_html text not null,
  answer_options jsonb not null default '[]'::jsonb check (jsonb_typeof(answer_options) = 'array'),
  correct_answers text[] not null check (cardinality(correct_answers) > 0),
  is_active_test boolean not null default false,
  is_retired boolean not null default false,
  source_updated_at timestamptz,
  content_hash text not null,
  sync_run_id uuid references public.sync_runs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.question_assets (
  id text primary key check (id ~ '^[a-f0-9]{64}$'),
  mime_type text not null check (mime_type in ('image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml')),
  storage_path text not null unique,
  byte_size integer not null check (byte_size between 1 and 10000000),
  created_at timestamptz not null default now()
);

create table public.practice_sessions (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  mode text not null check (mode = 'random'),
  requested_count integer not null check (requested_count between 1 and 50),
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  topic_filters text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  abandoned_at timestamptz
);

create table public.practice_session_items (
  session_id uuid not null references public.practice_sessions(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  position integer not null check (position >= 0),
  first_attempt_correct boolean,
  retry_count integer not null default 0 check (retry_count >= 0),
  resolved_at timestamptz,
  primary key (session_id, question_id),
  unique (session_id, position)
);

create table public.answer_attempts (
  id uuid primary key,
  session_id uuid not null references public.practice_sessions(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete cascade,
  attempt_number integer not null check (attempt_number > 0),
  response text not null,
  is_correct boolean not null,
  created_at timestamptz not null default now(),
  unique (session_id, question_id, attempt_number)
);

create table public.user_question_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  status text not null check (status in ('review', 'mastered')),
  first_attempt_misses integer not null default 0 check (first_attempt_misses >= 0),
  last_answered_at timestamptz not null,
  mastered_at timestamptz,
  primary key (user_id, question_id)
);

create table public.question_sync_staging (
  run_id uuid not null references public.sync_runs(id) on delete cascade,
  id uuid not null,
  display_id text not null,
  section text not null check (section in ('reading-writing', 'math')),
  domain_code text not null,
  domain_name text not null,
  skill_code text not null,
  skill_name text not null,
  difficulty text not null check (difficulty in ('medium', 'hard')),
  type text not null check (type in ('mcq', 'spr')),
  stimulus_html text,
  stem_html text not null,
  rationale_html text not null,
  answer_options jsonb not null check (jsonb_typeof(answer_options) = 'array'),
  correct_answers text[] not null check (cardinality(correct_answers) > 0),
  is_active_test boolean not null default false,
  source_updated_at timestamptz,
  content_hash text not null,
  primary key (run_id, id),
  unique (run_id, display_id)
);

create index idx_questions_eligible_section on public.questions (is_retired, is_active_test, section);
create index idx_questions_domain_skill on public.questions (domain_code, skill_code);
create index idx_practice_sessions_user_status on public.practice_sessions (user_id, status);
create unique index idx_one_active_session_per_user on public.practice_sessions (user_id) where status = 'active';
create index idx_attempts_session_question on public.answer_attempts (session_id, question_id);
create index idx_progress_user_status on public.user_question_progress (user_id, status);
create index idx_sync_runs_status_started on public.sync_runs (status, started_at desc);
create unique index idx_one_running_sync on public.sync_runs (status) where status = 'running';

alter table public.profiles enable row level security;
alter table public.sync_runs enable row level security;
alter table public.questions enable row level security;
alter table public.question_assets enable row level security;
alter table public.practice_sessions enable row level security;
alter table public.practice_session_items enable row level security;
alter table public.answer_attempts enable row level security;
alter table public.user_question_progress enable row level security;
alter table public.question_sync_staging enable row level security;

create policy profiles_select_self on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

revoke all on table public.profiles, public.sync_runs, public.questions, public.question_assets,
  public.practice_sessions, public.practice_session_items, public.answer_attempts,
  public.user_question_progress, public.question_sync_staging from anon, authenticated;
grant select, update (name, avatar_url, updated_at) on public.profiles to authenticated;
grant all on table public.profiles, public.sync_runs, public.questions, public.question_assets,
  public.practice_sessions, public.practice_session_items, public.answer_attempts,
  public.user_question_progress, public.question_sync_staging to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'question-assets',
  'question-assets',
  false,
  10000000,
  array['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy question_assets_authenticated_read on storage.objects for select to authenticated
  using (bucket_id = 'question-assets');

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  display_name text;
begin
  display_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Learner'
  );

  insert into public.profiles (id, name, avatar_url)
  values (
    new.id,
    left(display_name, 120),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
