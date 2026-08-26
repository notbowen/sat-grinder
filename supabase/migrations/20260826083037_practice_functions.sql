create or replace function private.normalize_rational(p_value text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  value text := pg_catalog.regexp_replace(pg_catalog.btrim(p_value), '[[:space:]]', '', 'g');
  matched text[];
  unsigned_value text;
  whole_part text;
  fractional_part text;
  numerator numeric;
  denominator numeric;
  divisor numeric;
  a numeric;
  b numeric;
  remainder numeric;
  negative boolean := false;
begin
  if value = '' or pg_catalog.char_length(value) > 50 then
    return null;
  end if;

  if value ~ '^-?[0-9]+/[0-9]+$' then
    numerator := pg_catalog.split_part(value, '/', 1)::numeric;
    denominator := pg_catalog.split_part(value, '/', 2)::numeric;
  else
    matched := pg_catalog.regexp_match(value, '^(-?)\\(d|t)?frac\{(-?[0-9]+)\}\{([0-9]+)\}$');
    if matched is not null then
      numerator := matched[3]::numeric * case when matched[1] = '-' then -1 else 1 end;
      denominator := matched[4]::numeric;
    elsif value ~ '^-?[0-9]+$' then
      numerator := value::numeric;
      denominator := 1;
    elsif value ~ '^-?([0-9]+\.[0-9]*|\.[0-9]+)$' then
      negative := pg_catalog.left(value, 1) = '-';
      unsigned_value := case when negative then pg_catalog.substr(value, 2) else value end;
      whole_part := pg_catalog.split_part(unsigned_value, '.', 1);
      fractional_part := pg_catalog.split_part(unsigned_value, '.', 2);
      denominator := pg_catalog.power(10::numeric, pg_catalog.char_length(fractional_part));
      numerator := (coalesce(nullif(whole_part, ''), '0') || fractional_part)::numeric;
      if negative then numerator := -numerator; end if;
    else
      return null;
    end if;
  end if;

  if denominator = 0 then return null; end if;
  if denominator < 0 then numerator := -numerator; denominator := -denominator; end if;

  a := pg_catalog.abs(numerator);
  b := pg_catalog.abs(denominator);
  while b <> 0 loop
    remainder := pg_catalog.mod(a, b);
    a := b;
    b := remainder;
  end loop;
  divisor := case when a = 0 then 1 else a end;
  numerator := numerator / divisor;
  denominator := denominator / divisor;
  return pg_catalog.trunc(numerator)::text || '/' || pg_catalog.trunc(denominator)::text;
end;
$$;

create or replace function private.grade_answer(p_type text, p_correct_answers text[], p_response text)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  value text := pg_catalog.upper(pg_catalog.btrim(p_response));
  entered text;
  answer text;
begin
  if p_type = 'mcq' then
    if value !~ '^[A-D]$' then
      return pg_catalog.jsonb_build_object('valid', false, 'correct', false, 'message', 'Choose an answer before checking.');
    end if;
    foreach answer in array p_correct_answers loop
      if pg_catalog.upper(pg_catalog.btrim(answer)) = value then
        return pg_catalog.jsonb_build_object('valid', true, 'correct', true);
      end if;
    end loop;
    return pg_catalog.jsonb_build_object('valid', true, 'correct', false);
  end if;

  if pg_catalog.char_length(pg_catalog.btrim(p_response)) > 50 or pg_catalog.btrim(p_response) = '' then
    return pg_catalog.jsonb_build_object('valid', false, 'correct', false, 'message', 'Use no more than 50 characters.');
  end if;

  entered := private.normalize_rational(p_response);
  if entered is null then
    return pg_catalog.jsonb_build_object('valid', false, 'correct', false, 'message', 'Enter a number, decimal, improper fraction, or LaTeX fraction with a nonzero denominator.');
  end if;

  foreach answer in array p_correct_answers loop
    if coalesce(private.normalize_rational(answer), pg_catalog.btrim(answer)) = entered then
      return pg_catalog.jsonb_build_object('valid', true, 'correct', true);
    end if;
  end loop;
  return pg_catalog.jsonb_build_object('valid', true, 'correct', false);
end;
$$;

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
    'remaining', pg_catalog.greatest(0, total_count - mastered_count),
    'review', review_count,
    'sections', sections,
    'topics', topics,
    'activeSession', active_session
  );
end;
$$;

create or replace function public.get_topic_catalog()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with caller as (
    select auth.uid() as id
  ), eligible as (
    select q.section, q.domain_code, q.domain_name, q.skill_code, q.skill_name
    from public.questions q
    cross join caller u
    left join public.user_question_progress p on p.question_id = q.id and p.user_id = u.id
    where u.id is not null and not q.is_retired and not q.is_active_test
      and (p.status is null or p.status <> 'mastered')
  ), skill_counts as (
    select section, domain_code, domain_name, skill_code, skill_name, count(*)::integer as count
    from eligible group by section, domain_code, domain_name, skill_code, skill_name
  ), domain_counts as (
    select section, domain_code, domain_name, sum(count)::integer as count
    from skill_counts group by section, domain_code, domain_name
  ), skills as (
    select section, domain_code,
      pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'code', skill_code, 'name', skill_name, 'count', count
      ) order by skill_name) as items
    from skill_counts group by section, domain_code
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'code', d.domain_code, 'name', d.domain_name, 'section', d.section,
    'count', d.count, 'skills', s.items
  ) order by d.section, d.domain_name), '[]'::jsonb)
  from domain_counts d join skills s using (section, domain_code);
$$;

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
  if p_mode not in ('random', 'topics') then raise exception 'Choose a valid practice mode.'; end if;
  if p_count is null or p_count < 1 or p_count > 50 then raise exception 'Choose between 1 and 50 questions.'; end if;
  if p_mode = 'topics' and cardinality(filters) = 0 then raise exception 'Choose at least one topic.'; end if;
  if cardinality(filters) > 30 or exists (select 1 from unnest(filters) f where char_length(f) > 100) then
    raise exception 'Choose a valid topic selection.';
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
      and (cardinality(filters) = 0 or exists (
        select 1 from unnest(filters) filter
        where filter = 'section:' || q.section
          or filter = 'domain:' || q.domain_code
          or filter = 'skill:' || q.skill_code
      ))
    order by pg_catalog.random()
    limit p_count
  ) candidate;

  if available < p_count then
    raise exception 'Only % eligible question%s available for that selection.', available,
      case when available = 1 then ' is' else 's are' end;
  end if;

  insert into public.practice_sessions (id, user_id, mode, requested_count, topic_filters)
  values (session_id, caller_id, p_mode, p_count, filters);
  insert into public.practice_session_items (session_id, question_id, position)
  select session_id, item.question_id, (item.ordinality - 1)::integer
  from unnest(question_ids) with ordinality item(question_id, ordinality);
  return session_id;
end;
$$;

create or replace function public.get_practice_session(p_session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
<<get_practice_session>>
declare
  caller_id uuid := auth.uid();
  practice public.practice_sessions%rowtype;
  current_question record;
  total_count integer;
  resolved_count integer;
  first_correct_count integer;
  current_json jsonb;
begin
  if caller_id is null then raise exception 'Authentication required.'; end if;
  select * into practice from public.practice_sessions s
  where s.id = p_session_id and s.user_id = caller_id;
  if not found then raise exception 'Quiz not found.'; end if;

  select count(*)::integer,
    count(*) filter (where resolved_at is not null)::integer,
    count(*) filter (where first_attempt_correct is true)::integer
  into total_count, resolved_count, first_correct_count
  from public.practice_session_items where session_id = p_session_id;

  select i.position, i.retry_count, q.id, q.display_id, q.section, q.domain_name,
    q.skill_name, q.difficulty, q.type, q.stimulus_html, q.stem_html, q.answer_options
  into current_question
  from public.practice_session_items i
  join public.questions q on q.id = i.question_id
  where i.session_id = p_session_id and i.resolved_at is null
  order by i.position limit 1;

  if found then
    current_json := pg_catalog.jsonb_build_object(
      'position', current_question.position,
      'retryCount', current_question.retry_count,
      'id', current_question.id,
      'displayId', current_question.display_id,
      'section', current_question.section,
      'domainName', current_question.domain_name,
      'skillName', current_question.skill_name,
      'difficulty', current_question.difficulty,
      'type', current_question.type,
      'stimulusHtml', current_question.stimulus_html,
      'stemHtml', current_question.stem_html,
      'answerOptions', current_question.answer_options
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'session', pg_catalog.jsonb_build_object(
      'id', practice.id, 'mode', practice.mode, 'requestedCount', practice.requested_count,
      'status', practice.status, 'createdAt', practice.created_at,
      'completedAt', practice.completed_at, 'abandonedAt', practice.abandoned_at
    ),
    'total', total_count,
    'resolved', resolved_count,
    'firstAttemptCorrect', first_correct_count,
    'current', current_json
  );
end;
$$;

create or replace function public.submit_practice_answer(p_session_id uuid, p_question_id uuid, p_response text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
<<submit_practice_answer>>
declare
  caller_id uuid := auth.uid();
  practice public.practice_sessions%rowtype;
  current_item record;
  grade jsonb;
  attempts_before integer;
  existing_progress public.user_question_progress%rowtype;
  now_at timestamptz := pg_catalog.clock_timestamp();
  first_attempt boolean;
  unresolved integer;
begin
  if caller_id is null then raise exception 'Authentication required.'; end if;
  if p_response is null then raise exception 'Enter a valid answer.'; end if;

  select * into practice from public.practice_sessions s
  where s.id = p_session_id and s.user_id = caller_id
  for update;
  if not found or practice.status <> 'active' then raise exception 'This quiz is no longer active.'; end if;

  select i.question_id, i.retry_count, q.type, q.correct_answers, q.rationale_html
  into current_item
  from public.practice_session_items i
  join public.questions q on q.id = i.question_id
  where i.session_id = p_session_id and i.resolved_at is null
  order by i.position limit 1
  for update of i;
  if not found or current_item.question_id <> p_question_id then raise exception 'That is not the current question.'; end if;

  grade := private.grade_answer(current_item.type, current_item.correct_answers, p_response);
  if not (grade ->> 'valid')::boolean then raise exception '%', grade ->> 'message'; end if;

  select count(*)::integer into attempts_before from public.answer_attempts
  where session_id = p_session_id and question_id = p_question_id;
  select * into existing_progress from public.user_question_progress p
  where p.user_id = caller_id and p.question_id = p_question_id;

  insert into public.answer_attempts (id, session_id, question_id, user_id, attempt_number, response, is_correct, created_at)
  values (extensions.gen_random_uuid(), p_session_id, p_question_id, caller_id,
    attempts_before + 1, pg_catalog.btrim(p_response), (grade ->> 'correct')::boolean, now_at);

  if not (grade ->> 'correct')::boolean then
    update public.practice_session_items set retry_count = retry_count + 1
    where session_id = p_session_id and question_id = p_question_id;
    if attempts_before = 0 and (existing_progress.user_id is null or existing_progress.status <> 'mastered') then
      insert into public.user_question_progress
        (user_id, question_id, status, first_attempt_misses, last_answered_at, mastered_at)
      values (caller_id, p_question_id, 'review', 1, now_at, null)
      on conflict (user_id, question_id) do update set
        status = 'review',
        first_attempt_misses = public.user_question_progress.first_attempt_misses + 1,
        last_answered_at = excluded.last_answered_at,
        mastered_at = null
      where public.user_question_progress.status <> 'mastered';
    end if;
    return pg_catalog.jsonb_build_object(
      'correct', false,
      'message', 'Not quite. Try it again—you can change your answer before checking.',
      'retries', current_item.retry_count + 1
    );
  end if;

  first_attempt := attempts_before = 0;
  update public.practice_session_items set resolved_at = now_at, first_attempt_correct = first_attempt
  where session_id = p_session_id and question_id = p_question_id;

  if first_attempt then
    insert into public.user_question_progress
      (user_id, question_id, status, first_attempt_misses, last_answered_at, mastered_at)
    values (caller_id, p_question_id, 'mastered', coalesce(existing_progress.first_attempt_misses, 0), now_at, now_at)
    on conflict (user_id, question_id) do update set
      status = 'mastered', last_answered_at = excluded.last_answered_at, mastered_at = excluded.mastered_at;
  elsif existing_progress.user_id is null then
    insert into public.user_question_progress
      (user_id, question_id, status, first_attempt_misses, last_answered_at)
    values (caller_id, p_question_id, 'review', 1, now_at);
  else
    update public.user_question_progress set last_answered_at = now_at
    where public.user_question_progress.user_id = caller_id
      and question_id = p_question_id;
  end if;

  select count(*)::integer into unresolved from public.practice_session_items
  where session_id = p_session_id and resolved_at is null;
  if unresolved = 0 then
    update public.practice_sessions set status = 'completed', completed_at = now_at where id = p_session_id;
  end if;

  return pg_catalog.jsonb_build_object(
    'correct', true,
    'firstAttempt', first_attempt,
    'completed', unresolved = 0,
    'message', case when first_attempt then 'Correct—mastered on the first try.'
      else 'Correct. This one stays in your rotation for a future clean solve.' end,
    'rationaleHtml', current_item.rationale_html,
    'correctAnswers', pg_catalog.to_jsonb(current_item.correct_answers)
  );
end;
$$;

create or replace function public.abandon_practice_session(p_session_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  update public.practice_sessions set status = 'abandoned', abandoned_at = pg_catalog.clock_timestamp()
  where id = p_session_id and user_id = auth.uid() and status = 'active';
  if not found then raise exception 'No active quiz was found.'; end if;
end;
$$;

create or replace function public.claim_legacy_history(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
<<claim_legacy_history>>
declare
  caller_id uuid := auth.uid();
  claim private.legacy_claims%rowtype;
begin
  if caller_id is null then raise exception 'Authentication required.'; end if;
  if p_token is null or char_length(p_token) < 32 then raise exception 'Enter the complete claim token.'; end if;

  select * into claim from private.legacy_claims
  where token_hash = extensions.digest(pg_catalog.convert_to(p_token, 'UTF8'), 'sha256')
    and claimed_at is null
  for update;
  if not found then raise exception 'That claim token is invalid or has already been used.'; end if;
  if exists (select 1 from public.practice_sessions s where s.user_id = caller_id)
    or exists (select 1 from public.user_question_progress p where p.user_id = caller_id) then
    raise exception 'Claim your old history before starting new practice.';
  end if;

  insert into public.practice_sessions
    (id, user_id, mode, requested_count, status, topic_filters, created_at, completed_at, abandoned_at)
  select x.id, caller_id, x.mode, x.requested_count, x.status, x.topic_filters,
    x.created_at, x.completed_at, x.abandoned_at
  from pg_catalog.jsonb_to_recordset(claim.payload -> 'practice_sessions') as x(
    id uuid, mode text, requested_count integer, status text, topic_filters text[],
    created_at timestamptz, completed_at timestamptz, abandoned_at timestamptz
  );

  insert into public.practice_session_items
    (session_id, question_id, position, first_attempt_correct, retry_count, resolved_at)
  select x.session_id, x.question_id, x.position, x.first_attempt_correct, x.retry_count, x.resolved_at
  from pg_catalog.jsonb_to_recordset(claim.payload -> 'practice_session_items') as x(
    session_id uuid, question_id uuid, position integer, first_attempt_correct boolean,
    retry_count integer, resolved_at timestamptz
  );

  insert into public.answer_attempts
    (id, session_id, question_id, user_id, attempt_number, response, is_correct, created_at)
  select x.id, x.session_id, x.question_id, caller_id, x.attempt_number, x.response, x.is_correct, x.created_at
  from pg_catalog.jsonb_to_recordset(claim.payload -> 'answer_attempts') as x(
    id uuid, session_id uuid, question_id uuid, attempt_number integer,
    response text, is_correct boolean, created_at timestamptz
  );

  insert into public.user_question_progress
    (user_id, question_id, status, first_attempt_misses, last_answered_at, mastered_at)
  select caller_id, x.question_id, x.status, x.first_attempt_misses, x.last_answered_at, x.mastered_at
  from pg_catalog.jsonb_to_recordset(claim.payload -> 'user_question_progress') as x(
    question_id uuid, status text, first_attempt_misses integer,
    last_answered_at timestamptz, mastered_at timestamptz
  );

  update public.profiles set legacy_claimed_at = pg_catalog.clock_timestamp(), updated_at = pg_catalog.clock_timestamp()
  where id = caller_id;
  update private.legacy_claims set token_hash = null, claimed_by = caller_id,
    claimed_at = pg_catalog.clock_timestamp() where id = claim.id;

  return pg_catalog.jsonb_build_object(
    'sessions', pg_catalog.jsonb_array_length(claim.payload -> 'practice_sessions'),
    'attempts', pg_catalog.jsonb_array_length(claim.payload -> 'answer_attempts'),
    'progress', pg_catalog.jsonb_array_length(claim.payload -> 'user_question_progress')
  );
end;
$$;

revoke execute on function public.get_dashboard() from public, anon;
revoke execute on function public.get_topic_catalog() from public, anon;
revoke execute on function public.start_practice(text, integer, text[]) from public, anon;
revoke execute on function public.get_practice_session(uuid) from public, anon;
revoke execute on function public.submit_practice_answer(uuid, uuid, text) from public, anon;
revoke execute on function public.abandon_practice_session(uuid) from public, anon;
revoke execute on function public.claim_legacy_history(text) from public, anon;

grant execute on function public.get_dashboard(), public.get_topic_catalog(),
  public.start_practice(text, integer, text[]), public.get_practice_session(uuid),
  public.submit_practice_answer(uuid, uuid, text), public.abandon_practice_session(uuid),
  public.claim_legacy_history(text) to authenticated;
