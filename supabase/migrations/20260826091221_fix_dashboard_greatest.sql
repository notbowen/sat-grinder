create or replace function public.get_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
<<get_dashboard>>
declare
  caller_id uuid := auth.uid();
  total_count integer;
  mastered_count integer;
  review_count integer;
  sections jsonb;
  topics jsonb;
  active_session jsonb;
begin
  if caller_id is null then raise exception 'Authentication required.'; end if;

  with bank as (
    select q.id, q.section, q.domain_code, q.domain_name, q.skill_code, q.skill_name, p.status
    from public.questions q
    left join public.user_question_progress p on p.question_id = q.id and p.user_id = caller_id
    where not q.is_retired and not q.is_active_test
  )
  select count(*)::integer,
    count(*) filter (where status = 'mastered')::integer,
    count(*) filter (where status = 'review')::integer
  into total_count, mastered_count, review_count
  from bank;

  with bank as (
    select q.section, p.status
    from public.questions q
    left join public.user_question_progress p on p.question_id = q.id and p.user_id = caller_id
    where not q.is_retired and not q.is_active_test
  ), grouped as (
    select section, count(*)::integer as total,
      count(*) filter (where status = 'mastered')::integer as mastered
    from bank group by section
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'section', expected.section,
    'label', case when expected.section = 'math' then 'Math' else 'Reading & Writing' end,
    'total', coalesce(grouped.total, 0),
    'mastered', coalesce(grouped.mastered, 0)
  ) order by expected.ordinality), '[]'::jsonb)
  into sections
  from unnest(array['reading-writing', 'math']) with ordinality expected(section, ordinality)
  left join grouped on grouped.section = expected.section;

  with bank as (
    select q.section, q.domain_code, q.domain_name, q.skill_code, q.skill_name, p.status
    from public.questions q
    left join public.user_question_progress p on p.question_id = q.id and p.user_id = caller_id
    where not q.is_retired and not q.is_active_test
  ), grouped as (
    select section, domain_code, domain_name, skill_code, skill_name,
      count(*)::integer as total,
      count(*) filter (where status = 'mastered')::integer as mastered,
      count(*) filter (where status = 'review')::integer as review
    from bank group by section, domain_code, domain_name, skill_code, skill_name
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'section', section, 'domain', domain_name, 'skill', skill_name,
    'total', total, 'mastered', mastered, 'review', review
  ) order by domain_name, skill_name), '[]'::jsonb)
  into topics from grouped;

  select pg_catalog.jsonb_build_object('id', id, 'mode', mode, 'requestedCount', requested_count)
  into active_session
  from public.practice_sessions
  where public.practice_sessions.user_id = caller_id and status = 'active'
  limit 1;

  return pg_catalog.jsonb_build_object(
    'total', total_count,
    'mastered', mastered_count,
    'remaining', greatest(0, total_count - mastered_count),
    'review', review_count,
    'sections', sections,
    'topics', topics,
    'activeSession', active_session
  );
end;
$$;
