create or replace function public.get_dashboard_analytics(
  p_window text default '30d',
  p_timezone text default 'UTC'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
<<get_dashboard>>
declare
  caller_id uuid := auth.uid();
  requested_window text := pg_catalog.lower(coalesce(p_window, '30d'));
  requested_timezone text := coalesce(nullif(p_timezone, ''), 'UTC');
  window_days integer;
  local_today date;
  period_start timestamptz;
  period_end timestamptz;
  previous_start timestamptz;
  trend_granularity text;
  trend_start_local timestamp;
  trend_end_local timestamp;
  trend_interval interval;
  current_streak integer := 0;
  snapshot_json jsonb;
  summary_json jsonb;
  trend_json jsonb;
  sections_json jsonb;
  difficulties_json jsonb;
  skills_json jsonb;
  review_json jsonb;
  recent_sessions_json jsonb;
  active_session_json jsonb;
begin
  if caller_id is null then raise exception 'Authentication required.'; end if;
  if requested_window not in ('1d', '14d', '30d', 'all') then
    raise exception 'Choose a valid dashboard window.';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_timezone_names zone where zone.name = requested_timezone
  ) then
    raise exception 'Choose a valid time zone.';
  end if;

  window_days := case requested_window
    when '1d' then 1
    when '14d' then 14
    when '30d' then 30
    else null
  end;
  local_today := pg_catalog.timezone(requested_timezone, pg_catalog.statement_timestamp())::date;
  period_end := pg_catalog.timezone(requested_timezone, (local_today + 1)::timestamp);
  if window_days is null then
    period_start := '-infinity'::timestamptz;
    previous_start := null;
    trend_granularity := 'month';
    trend_interval := interval '1 month';
  else
    period_start := pg_catalog.timezone(requested_timezone, (local_today - (window_days - 1))::timestamp);
    previous_start := pg_catalog.timezone(requested_timezone, (local_today - ((window_days * 2) - 1))::timestamp);
    trend_granularity := 'day';
    trend_interval := interval '1 day';
  end if;

  with bank as (
    select p.status
    from public.questions q
    left join public.user_question_progress p
      on p.question_id = q.id and p.user_id = caller_id
    where not q.is_retired and not q.is_active_test
  )
  select pg_catalog.jsonb_build_object(
    'total', count(*)::integer,
    'mastered', count(*) filter (where status = 'mastered')::integer,
    'review', count(*) filter (where status = 'review')::integer,
    'unseen', count(*) filter (where status is null)::integer
  )
  into snapshot_json
  from bank;

  with practice_days as (
    select distinct pg_catalog.timezone(requested_timezone, a.created_at)::date as practiced_on
    from public.answer_attempts a
    where a.user_id = caller_id
      and a.created_at < period_end
  ), latest as (
    select pg_catalog.max(practiced_on) as latest_day from practice_days
  ), numbered as (
    select practiced_on,
      pg_catalog.row_number() over (order by practiced_on desc)::integer as ordinal,
      (select latest_day from latest) as latest_day
    from practice_days
  )
  select case
    when pg_catalog.max(latest_day) is null
      or pg_catalog.max(latest_day) < local_today - 1 then 0
    else count(*) filter (where practiced_on = latest_day - (ordinal - 1))::integer
  end
  into current_streak
  from numbered;

  with current_items as (
    select i.first_attempt_correct, i.retry_count
    from public.practice_session_items i
    join public.practice_sessions s on s.id = i.session_id
    where s.user_id = caller_id
      and i.resolved_at >= period_start and i.resolved_at < period_end
  ), previous_items as (
    select i.first_attempt_correct
    from public.practice_session_items i
    join public.practice_sessions s on s.id = i.session_id
    where window_days is not null and s.user_id = caller_id
      and i.resolved_at >= previous_start and i.resolved_at < period_start
  ), current_stats as (
    select count(*)::integer as completed,
      count(*) filter (where first_attempt_correct)::integer as clean_solved,
      count(*) filter (where retry_count > 0)::integer as retried
    from current_items
  ), previous_stats as (
    select count(*)::integer as completed,
      count(*) filter (where first_attempt_correct)::integer as clean_solved
    from previous_items
  ), timing as (
    select coalesce(pg_catalog.sum(a.active_duration_ms), 0)::bigint as active_time_ms,
      count(a.active_duration_ms)::integer as timed_attempts
    from public.answer_attempts a
    where a.user_id = caller_id and a.created_at >= period_start and a.created_at < period_end
  ), activity as (
    select count(distinct pg_catalog.timezone(requested_timezone, a.created_at)::date)::integer as practice_days
    from public.answer_attempts a
    where a.user_id = caller_id and a.created_at >= period_start and a.created_at < period_end
  ), mastery as (
    select count(*)::integer as newly_mastered
    from public.user_question_progress p
    where p.user_id = caller_id and p.mastered_at >= period_start and p.mastered_at < period_end
  )
  select pg_catalog.jsonb_build_object(
    'completed', current_stats.completed,
    'cleanSolved', current_stats.clean_solved,
    'cleanSolveRate', case when current_stats.completed = 0 then null
      else pg_catalog.round(current_stats.clean_solved * 100.0 / current_stats.completed, 1) end,
    'cleanSolveDelta', case
      when window_days is null or current_stats.completed < 5 or previous_stats.completed < 5 then null
      else pg_catalog.round(
        current_stats.clean_solved * 100.0 / current_stats.completed
        - previous_stats.clean_solved * 100.0 / previous_stats.completed, 1
      ) end,
    'retried', current_stats.retried,
    'activeTimeMs', timing.active_time_ms,
    'timedAttempts', timing.timed_attempts,
    'practiceDays', activity.practice_days,
    'currentStreak', coalesce(current_streak, 0),
    'newlyMastered', mastery.newly_mastered,
    'previousCompleted', previous_stats.completed
  )
  into summary_json
  from current_stats, previous_stats, timing, activity, mastery;

  with expected(section, label, ordinality) as (
    values ('reading-writing'::text, 'Reading & Writing'::text, 1), ('math', 'Math', 2)
  ), bank as (
    select q.section, p.status
    from public.questions q
    left join public.user_question_progress p
      on p.question_id = q.id and p.user_id = caller_id
    where not q.is_retired and not q.is_active_test
  ), coverage as (
    select section, count(*)::integer as total,
      count(*) filter (where status = 'mastered')::integer as mastered,
      count(*) filter (where status = 'review')::integer as review,
      count(*) filter (where status is null)::integer as unseen
    from bank group by section
  ), current_performance as (
    select q.section, count(*)::integer as completed,
      count(*) filter (where i.first_attempt_correct)::integer as clean_solved,
      count(*) filter (where i.retry_count > 0)::integer as retried
    from public.practice_session_items i
    join public.practice_sessions s on s.id = i.session_id
    join public.questions q on q.id = i.question_id
    where s.user_id = caller_id and not q.is_retired and not q.is_active_test
      and i.resolved_at >= period_start and i.resolved_at < period_end
    group by q.section
  ), previous_performance as (
    select q.section, count(*)::integer as completed,
      count(*) filter (where i.first_attempt_correct)::integer as clean_solved
    from public.practice_session_items i
    join public.practice_sessions s on s.id = i.session_id
    join public.questions q on q.id = i.question_id
    where window_days is not null and s.user_id = caller_id
      and not q.is_retired and not q.is_active_test
      and i.resolved_at >= previous_start and i.resolved_at < period_start
    group by q.section
  ), timing as (
    select q.section, count(a.active_duration_ms)::integer as timed_first_attempts,
      pg_catalog.percentile_cont(0.5) within group (order by a.active_duration_ms)::bigint as median_first_attempt_ms
    from public.answer_attempts a
    join public.questions q on q.id = a.question_id
    where a.user_id = caller_id and a.attempt_number = 1 and a.active_duration_ms is not null
      and not q.is_retired and not q.is_active_test
      and a.created_at >= period_start and a.created_at < period_end
    group by q.section
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'key', expected.section,
    'label', expected.label,
    'total', coalesce(coverage.total, 0),
    'mastered', coalesce(coverage.mastered, 0),
    'review', coalesce(coverage.review, 0),
    'unseen', coalesce(coverage.unseen, 0),
    'completed', coalesce(current_performance.completed, 0),
    'cleanSolved', coalesce(current_performance.clean_solved, 0),
    'cleanSolveRate', case when coalesce(current_performance.completed, 0) = 0 then null
      else pg_catalog.round(current_performance.clean_solved * 100.0 / current_performance.completed, 1) end,
    'retried', coalesce(current_performance.retried, 0),
    'retryRate', case when coalesce(current_performance.completed, 0) = 0 then null
      else pg_catalog.round(current_performance.retried * 100.0 / current_performance.completed, 1) end,
    'timedFirstAttempts', coalesce(timing.timed_first_attempts, 0),
    'medianFirstAttemptMs', case when coalesce(timing.timed_first_attempts, 0) < 3 then null else timing.median_first_attempt_ms end,
    'previousCompleted', coalesce(previous_performance.completed, 0),
    'cleanSolveDelta', case
      when window_days is null or coalesce(current_performance.completed, 0) < 5
        or coalesce(previous_performance.completed, 0) < 5 then null
      else pg_catalog.round(
        current_performance.clean_solved * 100.0 / current_performance.completed
        - previous_performance.clean_solved * 100.0 / previous_performance.completed, 1
      ) end
  ) order by expected.ordinality), '[]'::jsonb)
  into sections_json
  from expected
  left join coverage on coverage.section = expected.section
  left join current_performance on current_performance.section = expected.section
  left join previous_performance on previous_performance.section = expected.section
  left join timing on timing.section = expected.section;

  with expected(difficulty, label, ordinality) as (
    values ('medium'::text, 'Medium'::text, 1), ('hard', 'Hard', 2)
  ), bank as (
    select q.difficulty, p.status
    from public.questions q
    left join public.user_question_progress p
      on p.question_id = q.id and p.user_id = caller_id
    where not q.is_retired and not q.is_active_test
  ), coverage as (
    select difficulty, count(*)::integer as total,
      count(*) filter (where status = 'mastered')::integer as mastered,
      count(*) filter (where status = 'review')::integer as review,
      count(*) filter (where status is null)::integer as unseen
    from bank group by difficulty
  ), current_performance as (
    select q.difficulty, count(*)::integer as completed,
      count(*) filter (where i.first_attempt_correct)::integer as clean_solved,
      count(*) filter (where i.retry_count > 0)::integer as retried
    from public.practice_session_items i
    join public.practice_sessions s on s.id = i.session_id
    join public.questions q on q.id = i.question_id
    where s.user_id = caller_id and not q.is_retired and not q.is_active_test
      and i.resolved_at >= period_start and i.resolved_at < period_end
    group by q.difficulty
  ), previous_performance as (
    select q.difficulty, count(*)::integer as completed,
      count(*) filter (where i.first_attempt_correct)::integer as clean_solved
    from public.practice_session_items i
    join public.practice_sessions s on s.id = i.session_id
    join public.questions q on q.id = i.question_id
    where window_days is not null and s.user_id = caller_id
      and not q.is_retired and not q.is_active_test
      and i.resolved_at >= previous_start and i.resolved_at < period_start
    group by q.difficulty
  ), timing as (
    select q.difficulty, count(a.active_duration_ms)::integer as timed_first_attempts,
      pg_catalog.percentile_cont(0.5) within group (order by a.active_duration_ms)::bigint as median_first_attempt_ms
    from public.answer_attempts a
    join public.questions q on q.id = a.question_id
    where a.user_id = caller_id and a.attempt_number = 1 and a.active_duration_ms is not null
      and not q.is_retired and not q.is_active_test
      and a.created_at >= period_start and a.created_at < period_end
    group by q.difficulty
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'key', expected.difficulty,
    'label', expected.label,
    'total', coalesce(coverage.total, 0),
    'mastered', coalesce(coverage.mastered, 0),
    'review', coalesce(coverage.review, 0),
    'unseen', coalesce(coverage.unseen, 0),
    'completed', coalesce(current_performance.completed, 0),
    'cleanSolved', coalesce(current_performance.clean_solved, 0),
    'cleanSolveRate', case when coalesce(current_performance.completed, 0) = 0 then null
      else pg_catalog.round(current_performance.clean_solved * 100.0 / current_performance.completed, 1) end,
    'retried', coalesce(current_performance.retried, 0),
    'retryRate', case when coalesce(current_performance.completed, 0) = 0 then null
      else pg_catalog.round(current_performance.retried * 100.0 / current_performance.completed, 1) end,
    'timedFirstAttempts', coalesce(timing.timed_first_attempts, 0),
    'medianFirstAttemptMs', case when coalesce(timing.timed_first_attempts, 0) < 3 then null else timing.median_first_attempt_ms end,
    'previousCompleted', coalesce(previous_performance.completed, 0),
    'cleanSolveDelta', case
      when window_days is null or coalesce(current_performance.completed, 0) < 5
        or coalesce(previous_performance.completed, 0) < 5 then null
      else pg_catalog.round(
        current_performance.clean_solved * 100.0 / current_performance.completed
        - previous_performance.clean_solved * 100.0 / previous_performance.completed, 1
      ) end
  ) order by expected.ordinality), '[]'::jsonb)
  into difficulties_json
  from expected
  left join coverage on coverage.difficulty = expected.difficulty
  left join current_performance on current_performance.difficulty = expected.difficulty
  left join previous_performance on previous_performance.difficulty = expected.difficulty
  left join timing on timing.difficulty = expected.difficulty;

  with bank as (
    select q.section, q.domain_code, q.domain_name, q.skill_code, q.skill_name, p.status
    from public.questions q
    left join public.user_question_progress p
      on p.question_id = q.id and p.user_id = caller_id
    where not q.is_retired and not q.is_active_test
  ), coverage as (
    select section, domain_code, domain_name, skill_code, skill_name,
      count(*)::integer as total,
      count(*) filter (where status = 'mastered')::integer as mastered,
      count(*) filter (where status = 'review')::integer as review,
      count(*) filter (where status is null)::integer as unseen
    from bank group by section, domain_code, domain_name, skill_code, skill_name
  ), current_performance as (
    select q.section, q.domain_code, q.skill_code, count(*)::integer as completed,
      count(*) filter (where i.first_attempt_correct)::integer as clean_solved,
      count(*) filter (where i.retry_count > 0)::integer as retried
    from public.practice_session_items i
    join public.practice_sessions s on s.id = i.session_id
    join public.questions q on q.id = i.question_id
    where s.user_id = caller_id and not q.is_retired and not q.is_active_test
      and i.resolved_at >= period_start and i.resolved_at < period_end
    group by q.section, q.domain_code, q.skill_code
  ), previous_performance as (
    select q.section, q.domain_code, q.skill_code, count(*)::integer as completed,
      count(*) filter (where i.first_attempt_correct)::integer as clean_solved
    from public.practice_session_items i
    join public.practice_sessions s on s.id = i.session_id
    join public.questions q on q.id = i.question_id
    where window_days is not null and s.user_id = caller_id
      and not q.is_retired and not q.is_active_test
      and i.resolved_at >= previous_start and i.resolved_at < period_start
    group by q.section, q.domain_code, q.skill_code
  ), timing as (
    select q.section, q.domain_code, q.skill_code,
      count(a.active_duration_ms)::integer as timed_first_attempts,
      pg_catalog.percentile_cont(0.5) within group (order by a.active_duration_ms)::bigint as median_first_attempt_ms
    from public.answer_attempts a
    join public.questions q on q.id = a.question_id
    where a.user_id = caller_id and a.attempt_number = 1 and a.active_duration_ms is not null
      and not q.is_retired and not q.is_active_test
      and a.created_at >= period_start and a.created_at < period_end
    group by q.section, q.domain_code, q.skill_code
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'key', coverage.section || ':' || coverage.domain_code || ':' || coverage.skill_code,
    'section', coverage.section,
    'domain', coverage.domain_name,
    'skill', coverage.skill_name,
    'total', coverage.total,
    'mastered', coverage.mastered,
    'review', coverage.review,
    'unseen', coverage.unseen,
    'completed', coalesce(current_performance.completed, 0),
    'cleanSolved', coalesce(current_performance.clean_solved, 0),
    'cleanSolveRate', case when coalesce(current_performance.completed, 0) = 0 then null
      else pg_catalog.round(current_performance.clean_solved * 100.0 / current_performance.completed, 1) end,
    'retried', coalesce(current_performance.retried, 0),
    'retryRate', case when coalesce(current_performance.completed, 0) = 0 then null
      else pg_catalog.round(current_performance.retried * 100.0 / current_performance.completed, 1) end,
    'timedFirstAttempts', coalesce(timing.timed_first_attempts, 0),
    'medianFirstAttemptMs', case when coalesce(timing.timed_first_attempts, 0) < 3 then null else timing.median_first_attempt_ms end,
    'previousCompleted', coalesce(previous_performance.completed, 0),
    'cleanSolveDelta', case
      when window_days is null or coalesce(current_performance.completed, 0) < 5
        or coalesce(previous_performance.completed, 0) < 5 then null
      else pg_catalog.round(
        current_performance.clean_solved * 100.0 / current_performance.completed
        - previous_performance.clean_solved * 100.0 / previous_performance.completed, 1
      ) end
  ) order by coverage.section, coverage.domain_name, coverage.skill_name), '[]'::jsonb)
  into skills_json
  from coverage
  left join current_performance using (section, domain_code, skill_code)
  left join previous_performance using (section, domain_code, skill_code)
  left join timing using (section, domain_code, skill_code);

  if requested_window = 'all' then
    select pg_catalog.date_trunc('month', coalesce(pg_catalog.min(activity_at), pg_catalog.timezone(requested_timezone, period_end)))
    into trend_start_local
    from (
      select pg_catalog.timezone(requested_timezone, i.resolved_at) as activity_at
      from public.practice_session_items i
      join public.practice_sessions s on s.id = i.session_id
      where s.user_id = caller_id and i.resolved_at is not null and i.resolved_at < period_end
      union all
      select pg_catalog.timezone(requested_timezone, a.created_at)
      from public.answer_attempts a where a.user_id = caller_id and a.created_at < period_end
    ) activity;
  else
    trend_start_local := pg_catalog.date_trunc(trend_granularity, pg_catalog.timezone(requested_timezone, period_start));
  end if;
  trend_end_local := pg_catalog.date_trunc(trend_granularity, local_today::timestamp);

  with buckets as (
    select pg_catalog.generate_series(trend_start_local, trend_end_local, trend_interval) as bucket_start
  ), resolved as (
    select pg_catalog.date_trunc(trend_granularity, pg_catalog.timezone(requested_timezone, i.resolved_at)) as bucket_start,
      count(*)::integer as completed,
      count(*) filter (where i.first_attempt_correct)::integer as clean_solved
    from public.practice_session_items i
    join public.practice_sessions s on s.id = i.session_id
    where s.user_id = caller_id and i.resolved_at >= period_start and i.resolved_at < period_end
    group by 1
  ), timing as (
    select pg_catalog.date_trunc(trend_granularity, pg_catalog.timezone(requested_timezone, a.created_at)) as bucket_start,
      coalesce(pg_catalog.sum(a.active_duration_ms), 0)::bigint as active_time_ms,
      count(a.active_duration_ms)::integer as timed_attempts
    from public.answer_attempts a
    where a.user_id = caller_id and a.created_at >= period_start and a.created_at < period_end
    group by 1
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'start', pg_catalog.to_char(buckets.bucket_start, 'YYYY-MM-DD'),
    'completed', coalesce(resolved.completed, 0),
    'cleanSolved', coalesce(resolved.clean_solved, 0),
    'cleanSolveRate', case when coalesce(resolved.completed, 0) = 0 then null
      else pg_catalog.round(resolved.clean_solved * 100.0 / resolved.completed, 1) end,
    'activeTimeMs', coalesce(timing.active_time_ms, 0),
    'timedAttempts', coalesce(timing.timed_attempts, 0)
  ) order by buckets.bucket_start), '[]'::jsonb)
  into trend_json
  from buckets
  left join resolved using (bucket_start)
  left join timing using (bucket_start);

  with review_items as (
    select q.section, q.domain_code, q.domain_name, q.skill_code, q.skill_name,
      p.first_attempt_misses, p.last_answered_at,
      local_today - pg_catalog.timezone(requested_timezone, p.last_answered_at)::date as age_days
    from public.user_question_progress p
    join public.questions q on q.id = p.question_id
    where p.user_id = caller_id and p.status = 'review'
      and not q.is_retired and not q.is_active_test
  ), totals as (
    select count(*)::integer as total,
      count(*) filter (where first_attempt_misses > 1)::integer as repeated_misses,
      count(*) filter (where age_days between 0 and 7)::integer as fresh,
      count(*) filter (where age_days between 8 and 30)::integer as aging,
      count(*) filter (where age_days > 30)::integer as stale
    from review_items
  ), sections as (
    select section, count(*)::integer as count from review_items group by section
  ), top_skills as (
    select section, domain_name, skill_name, count(*)::integer as count,
      count(*) filter (where first_attempt_misses > 1)::integer as repeated_misses,
      pg_catalog.min(last_answered_at) as oldest_answered_at
    from review_items
    group by section, domain_code, domain_name, skill_code, skill_name
    order by count desc, repeated_misses desc, domain_name, skill_name
    limit 8
  )
  select pg_catalog.jsonb_build_object(
    'total', totals.total,
    'repeatedMisses', totals.repeated_misses,
    'ageBuckets', pg_catalog.jsonb_build_object('fresh', totals.fresh, 'aging', totals.aging, 'stale', totals.stale),
    'bySection', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'section', sections.section,
      'label', case when sections.section = 'math' then 'Math' else 'Reading & Writing' end,
      'count', sections.count
    ) order by sections.section) from sections), '[]'::jsonb),
    'topSkills', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'section', top_skills.section,
      'domain', top_skills.domain_name,
      'skill', top_skills.skill_name,
      'count', top_skills.count,
      'repeatedMisses', top_skills.repeated_misses,
      'oldestAnsweredAt', top_skills.oldest_answered_at
    ) order by top_skills.count desc, top_skills.repeated_misses desc, top_skills.domain_name, top_skills.skill_name) from top_skills), '[]'::jsonb)
  )
  into review_json
  from totals;

  with session_stats as (
    select s.id, s.status, s.requested_count, s.topic_filters, s.created_at, s.completed_at, s.abandoned_at,
      count(i.question_id) filter (where i.resolved_at is not null)::integer as resolved,
      count(i.question_id) filter (where i.first_attempt_correct)::integer as clean_solved,
      coalesce(pg_catalog.sum(i.retry_count), 0)::integer as retries
    from public.practice_sessions s
    left join public.practice_session_items i on i.session_id = s.id
    where s.user_id = caller_id and s.status <> 'active'
    group by s.id
    order by s.created_at desc
    limit 10
  ), timing as (
    select a.session_id, coalesce(pg_catalog.sum(a.active_duration_ms), 0)::bigint as active_time_ms,
      count(a.active_duration_ms)::integer as timed_attempts
    from public.answer_attempts a
    where a.user_id = caller_id and a.session_id in (select id from session_stats)
    group by a.session_id
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', session_stats.id,
    'subject', case
      when pg_catalog.cardinality(session_stats.topic_filters) = 0 then 'Mixed'
      when session_stats.topic_filters[1] = 'section:math' then 'Math'
      else 'Reading & Writing' end,
    'status', session_stats.status,
    'requestedCount', session_stats.requested_count,
    'resolved', session_stats.resolved,
    'cleanSolved', session_stats.clean_solved,
    'cleanSolveRate', case when session_stats.resolved = 0 then null
      else pg_catalog.round(session_stats.clean_solved * 100.0 / session_stats.resolved, 1) end,
    'retries', session_stats.retries,
    'activeTimeMs', coalesce(timing.active_time_ms, 0),
    'timedAttempts', coalesce(timing.timed_attempts, 0),
    'createdAt', session_stats.created_at,
    'completedAt', session_stats.completed_at,
    'abandonedAt', session_stats.abandoned_at
  ) order by session_stats.created_at desc), '[]'::jsonb)
  into recent_sessions_json
  from session_stats
  left join timing on timing.session_id = session_stats.id;

  with active as (
    select s.id, s.requested_count, s.topic_filters, s.created_at,
      count(i.question_id) filter (where i.resolved_at is not null)::integer as resolved,
      count(i.question_id) filter (where i.first_attempt_correct)::integer as clean_solved,
      coalesce(pg_catalog.sum(i.retry_count), 0)::integer as retries
    from public.practice_sessions s
    left join public.practice_session_items i on i.session_id = s.id
    where s.user_id = caller_id and s.status = 'active'
    group by s.id
    limit 1
  ), timing as (
    select coalesce(pg_catalog.sum(a.active_duration_ms), 0)::bigint as active_time_ms,
      count(a.active_duration_ms)::integer as timed_attempts
    from public.answer_attempts a
    where a.user_id = caller_id and a.session_id = (select id from active)
  )
  select pg_catalog.jsonb_build_object(
    'id', active.id,
    'subject', case
      when pg_catalog.cardinality(active.topic_filters) = 0 then 'Mixed'
      when active.topic_filters[1] = 'section:math' then 'Math'
      else 'Reading & Writing' end,
    'requestedCount', active.requested_count,
    'resolved', active.resolved,
    'cleanSolved', active.clean_solved,
    'activeTimeMs', timing.active_time_ms,
    'timedAttempts', timing.timed_attempts,
    'createdAt', active.created_at
  )
  into active_session_json
  from active, timing;

  return pg_catalog.jsonb_build_object(
    'window', requested_window,
    'timezone', requested_timezone,
    'generatedAt', pg_catalog.statement_timestamp(),
    'trendGranularity', trend_granularity,
    'snapshot', snapshot_json,
    'summary', summary_json,
    'trend', trend_json,
    'sections', sections_json,
    'difficulties', difficulties_json,
    'skills', skills_json,
    'review', review_json,
    'recentSessions', recent_sessions_json,
    'activeSession', active_session_json
  );
end;
$$;


create or replace function public.get_friends_leaderboard(
  p_window text default '30d',
  p_timezone text default 'UTC'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  requested_window text := pg_catalog.lower(coalesce(p_window, '30d'));
  requested_timezone text := coalesce(nullif(p_timezone, ''), 'UTC');
  window_days integer;
  local_today date;
  period_start timestamptz;
  period_end timestamptz;
  members_json jsonb;
begin
  if caller_id is null then raise exception 'Authentication required.'; end if;
  if requested_window not in ('1d', '14d', '30d', 'all') then
    raise exception 'Choose a valid leaderboard window.';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_timezone_names as zone
    where zone.name = requested_timezone
  ) then
    raise exception 'Choose a valid time zone.';
  end if;

  window_days := case requested_window
    when '1d' then 1
    when '14d' then 14
    when '30d' then 30
    else null
  end;
  local_today := pg_catalog.timezone(requested_timezone, pg_catalog.statement_timestamp())::date;
  period_end := pg_catalog.timezone(requested_timezone, (local_today + 1)::timestamp);
  period_start := case when window_days is null then '-infinity'::timestamptz
    else pg_catalog.timezone(requested_timezone, (local_today - (window_days - 1))::timestamp)
  end;

  with members as (
    select caller_id as user_id
    union
    select case when friendship.requester_id = caller_id
      then friendship.addressee_id else friendship.requester_id end
    from public.friendships as friendship
    where friendship.status = 'accepted'
      and caller_id in (friendship.requester_id, friendship.addressee_id)
  ), completed as (
    select session.user_id,
      count(*)::integer as completed,
      count(*) filter (where item.first_attempt_correct)::integer as clean_solved
    from public.practice_session_items as item
    join public.practice_sessions as session on session.id = item.session_id
    join members on members.user_id = session.user_id
    where item.resolved_at >= period_start and item.resolved_at < period_end
    group by session.user_id
  ), timing as (
    select attempt.user_id,
      coalesce(pg_catalog.sum(attempt.active_duration_ms), 0)::bigint as active_time_ms,
      count(distinct pg_catalog.timezone(requested_timezone, attempt.created_at)::date)::integer as practice_days
    from public.answer_attempts as attempt
    join members on members.user_id = attempt.user_id
    where attempt.created_at >= period_start and attempt.created_at < period_end
    group by attempt.user_id
  ), mastery as (
    select progress.user_id, count(*)::integer as newly_mastered
    from public.user_question_progress as progress
    join members on members.user_id = progress.user_id
    where progress.mastered_at >= period_start and progress.mastered_at < period_end
    group by progress.user_id
  ), stats as (
    select members.user_id, profile.name, profile.avatar_url, auth_user.email,
      coalesce(completed.completed, 0) as completed,
      coalesce(completed.clean_solved, 0) as clean_solved,
      coalesce(timing.active_time_ms, 0) as active_time_ms,
      coalesce(timing.practice_days, 0) as practice_days,
      coalesce(mastery.newly_mastered, 0) as newly_mastered
    from members
    join public.profiles as profile on profile.id = members.user_id
    join auth.users as auth_user on auth_user.id = members.user_id
    left join completed on completed.user_id = members.user_id
    left join timing on timing.user_id = members.user_id
    left join mastery on mastery.user_id = members.user_id
  ), ranked as (
    select stats.*,
      pg_catalog.dense_rank() over (
        order by completed desc, clean_solved desc, newly_mastered desc, active_time_ms desc
      )::integer as rank
    from stats
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'rank', rank,
    'id', user_id,
    'name', name,
    'email', email,
    'avatarUrl', avatar_url,
    'isCurrentUser', user_id = caller_id,
    'completed', completed,
    'cleanSolved', clean_solved,
    'cleanSolveRate', case when completed = 0 then null
      else pg_catalog.round(clean_solved * 100.0 / completed, 1) end,
    'activeTimeMs', active_time_ms,
    'practiceDays', practice_days,
    'newlyMastered', newly_mastered
  ) order by rank, user_id = caller_id desc, pg_catalog.lower(name), user_id), '[]'::jsonb)
  into members_json
  from ranked;

  return pg_catalog.jsonb_build_object(
    'window', requested_window,
    'timezone', requested_timezone,
    'generatedAt', pg_catalog.statement_timestamp(),
    'members', members_json
  );
end;
$$;

