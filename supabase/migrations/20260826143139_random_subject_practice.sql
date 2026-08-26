create or replace function public.get_practice_pool()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with caller as (
    select auth.uid() as id
  ), eligible as (
    select q.section
    from public.questions q
    cross join caller u
    left join public.user_question_progress p on p.question_id = q.id and p.user_id = u.id
    where u.id is not null and not q.is_retired and not q.is_active_test
      and (p.status is null or p.status <> 'mastered')
  )
  select pg_catalog.jsonb_build_object(
    'total', count(*)::integer,
    'math', count(*) filter (where section = 'math'),
    'readingWriting', count(*) filter (where section = 'reading-writing')
  )
  from eligible;
$$;

drop function if exists public.get_topic_catalog();

create or replace function public.start_practice(p_mode text, p_count integer, p_filters text[] default '{}'::text[])
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
<<start_practice>>
declare
  caller_id uuid := auth.uid();
  filters text[] := coalesce(p_filters, '{}'::text[]);
  session_id uuid := extensions.gen_random_uuid();
  question_ids uuid[];
  available integer;
begin
  if caller_id is null then raise exception 'Authentication required.'; end if;
  if p_mode is distinct from 'random' then raise exception 'Choose a valid practice mode.'; end if;
  if p_count is null or p_count < 1 or p_count > 50 then raise exception 'Choose between 1 and 50 questions.'; end if;
  if cardinality(filters) > 1 or exists (
    select 1 from unnest(filters) filter
    where filter not in ('section:math', 'section:reading-writing')
  ) then
    raise exception 'Choose a valid subject selection.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(caller_id::text, 0));
  if exists (select 1 from public.practice_sessions s where s.user_id = caller_id and s.status = 'active') then
    raise exception 'Finish or abandon your active quiz before starting another one.';
  end if;

  select array_agg(candidate.id), count(*)::integer
  into question_ids, available
  from (
    select q.id
    from public.questions q
    left join public.user_question_progress p on p.question_id = q.id and p.user_id = caller_id
    where not q.is_retired and not q.is_active_test
      and (p.status is null or p.status <> 'mastered')
      and (cardinality(filters) = 0 or filters[1] = 'section:' || q.section)
    order by pg_catalog.random()
    limit p_count
  ) candidate;

  if available < p_count then
    raise exception 'Only % eligible question%s available for that selection.', available,
      case when available = 1 then ' is' else 's are' end;
  end if;

  insert into public.practice_sessions (id, user_id, mode, requested_count, topic_filters)
  values (session_id, caller_id, 'random', p_count, filters);
  insert into public.practice_session_items (session_id, question_id, position)
  select session_id, item.question_id, (item.ordinality - 1)::integer
  from unnest(question_ids) with ordinality item(question_id, ordinality);
  return session_id;
end;
$$;

revoke execute on function public.get_practice_pool() from public, anon;
revoke execute on function public.start_practice(text, integer, text[]) from public, anon;
grant execute on function public.get_practice_pool() to authenticated;
grant execute on function public.start_practice(text, integer, text[]) to authenticated;
