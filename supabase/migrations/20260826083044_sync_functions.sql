create or replace function public.begin_question_sync(p_trigger_source text default 'github-action')
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  run_id uuid := extensions.gen_random_uuid();
begin
  if p_trigger_source not in ('github-action', 'manual-cli') then
    raise exception 'Choose a valid synchronization source.';
  end if;

  update public.sync_runs set
    status = 'failed',
    completed_at = pg_catalog.clock_timestamp(),
    error = 'The previous sync stopped before it could finish.'
  where status = 'running' and started_at < pg_catalog.clock_timestamp() - interval '90 minutes';

  if exists (select 1 from public.sync_runs where status = 'running') then
    raise exception 'A question-bank sync is already running.';
  end if;

  insert into public.sync_runs (id, status, trigger_source, started_at)
  values (run_id, 'running', p_trigger_source, pg_catalog.clock_timestamp());
  return run_id;
end;
$$;

create or replace function public.finalize_question_sync(p_run_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  staged_count integer;
  excluded_count integer;
begin
  perform 1 from public.sync_runs where id = p_run_id and status = 'running' for update;
  if not found then raise exception 'The synchronization run is not active.'; end if;

  select count(*)::integer,
    count(*) filter (where is_active_test)::integer
  into staged_count, excluded_count
  from public.question_sync_staging where run_id = p_run_id;
  if staged_count = 0 then raise exception 'No validated questions were staged.'; end if;

  update public.questions set is_retired = true, updated_at = pg_catalog.clock_timestamp();

  insert into public.questions (
    id, display_id, section, domain_code, domain_name, skill_code, skill_name,
    difficulty, type, stimulus_html, stem_html, rationale_html, answer_options,
    correct_answers, is_active_test, is_retired, source_updated_at, content_hash,
    sync_run_id, created_at, updated_at
  )
  select id, display_id, section, domain_code, domain_name, skill_code, skill_name,
    difficulty, type, stimulus_html, stem_html, rationale_html, answer_options,
    correct_answers, is_active_test, false, source_updated_at, content_hash,
    p_run_id, pg_catalog.clock_timestamp(), pg_catalog.clock_timestamp()
  from public.question_sync_staging where run_id = p_run_id
  on conflict (id) do update set
    display_id = excluded.display_id,
    section = excluded.section,
    domain_code = excluded.domain_code,
    domain_name = excluded.domain_name,
    skill_code = excluded.skill_code,
    skill_name = excluded.skill_name,
    difficulty = excluded.difficulty,
    type = excluded.type,
    stimulus_html = excluded.stimulus_html,
    stem_html = excluded.stem_html,
    rationale_html = excluded.rationale_html,
    answer_options = excluded.answer_options,
    correct_answers = excluded.correct_answers,
    is_active_test = excluded.is_active_test,
    is_retired = false,
    source_updated_at = excluded.source_updated_at,
    content_hash = excluded.content_hash,
    sync_run_id = excluded.sync_run_id,
    updated_at = excluded.updated_at;

  update public.sync_runs set
    status = 'completed',
    completed_at = pg_catalog.clock_timestamp(),
    fetched_details = staged_count,
    imported = staged_count,
    active_excluded = excluded_count,
    error = null
  where id = p_run_id;
  delete from public.question_sync_staging where run_id = p_run_id;

  return pg_catalog.jsonb_build_object(
    'runId', p_run_id,
    'imported', staged_count,
    'activeExcluded', excluded_count
  );
end;
$$;

create or replace function public.fail_question_sync(p_run_id uuid, p_error text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.sync_runs set
    status = 'failed',
    completed_at = pg_catalog.clock_timestamp(),
    error = pg_catalog.left(coalesce(p_error, 'Unknown synchronization error'), 2000)
  where id = p_run_id and status = 'running';
  delete from public.question_sync_staging where run_id = p_run_id;
end;
$$;

revoke execute on function public.begin_question_sync(text),
  public.finalize_question_sync(uuid), public.fail_question_sync(uuid, text)
  from public, anon, authenticated;
grant execute on function public.begin_question_sync(text),
  public.finalize_question_sync(uuid), public.fail_question_sync(uuid, text)
  to service_role;
