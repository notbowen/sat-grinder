begin;
create extension if not exists pgtap with schema extensions;
select plan(1);

do $$
<<integration>>
declare
  learner_a constant uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  learner_b constant uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  learner_c constant uuid := 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  test_question constant uuid := 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  bad_session constant uuid := 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  run_id uuid;
  session_id uuid;
  feedback jsonb;
  claim_result jsonb;
  failed_as_expected boolean;
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values
    ('00000000-0000-0000-0000-000000000000', learner_a, 'authenticated', 'authenticated', 'rpc-test-a@example.invalid', '', now(), '{}', '{"name":"RPC Test A"}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', learner_b, 'authenticated', 'authenticated', 'rpc-test-b@example.invalid', '', now(), '{}', '{"name":"RPC Test B"}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', learner_c, 'authenticated', 'authenticated', 'rpc-test-c@example.invalid', '', now(), '{}', '{"name":"RPC Test C"}', now(), now());

  if (select count(*) <> 3 from public.profiles where id in (learner_a, learner_b, learner_c)) then
    raise exception 'Profile creation trigger did not create all test profiles.';
  end if;

  insert into public.questions (
    id, display_id, section, domain_code, domain_name, skill_code, skill_name,
    difficulty, type, stem_html, rationale_html, answer_options, correct_answers,
    is_active_test, is_retired, content_hash
  ) values (
    test_question, 'DBTEST1', 'math', 'DBTEST', 'Database test', 'DBTESTSKILL',
    'Database transaction test', 'medium', 'mcq', '<p>Pick A.</p>', '<p>A is correct.</p>',
    '[{"letter":"A","content":"A"},{"letter":"B","content":"B"},{"letter":"C","content":"C"},{"letter":"D","content":"D"}]',
    array['A'], false, false, repeat('a', 64)
  );

  perform set_config('request.jwt.claim.sub', learner_a::text, true);
  if (public.get_dashboard() ->> 'remaining')::integer < 1 then
    raise exception 'Dashboard aggregation returned an invalid remaining count.';
  end if;
  session_id := public.start_practice('topics', 1, array['skill:DBTESTSKILL']);

  failed_as_expected := false;
  begin
    perform public.start_practice('topics', 1, array['skill:DBTESTSKILL']);
  exception when others then
    if sqlerrm not like 'Finish or abandon your active quiz%' then raise; end if;
    failed_as_expected := true;
  end;
  if not failed_as_expected then raise exception 'A second active session was allowed.'; end if;

  if (public.get_practice_session(session_id)::text like '%correctAnswers%'
    or public.get_practice_session(session_id)::text like '%rationaleHtml%') then
    raise exception 'The practice-session RPC leaked the answer key or rationale.';
  end if;

  perform set_config('request.jwt.claim.sub', learner_b::text, true);
  failed_as_expected := false;
  begin
    perform public.get_practice_session(session_id);
  exception when others then
    if sqlerrm <> 'Quiz not found.' then raise; end if;
    failed_as_expected := true;
  end;
  if not failed_as_expected then raise exception 'A second user read another user''s session.'; end if;

  perform set_config('request.jwt.claim.sub', learner_a::text, true);
  feedback := public.submit_practice_answer(session_id, test_question, 'B');
  if (feedback ->> 'correct')::boolean
    or feedback ? 'correctAnswers' or feedback ? 'rationaleHtml' then
    raise exception 'Incorrect-answer feedback was wrong or leaked protected content.';
  end if;
  if not exists (
    select 1 from public.user_question_progress
    where user_id = learner_a and question_id = test_question
      and status = 'review' and first_attempt_misses = 1
  ) then raise exception 'First miss did not create review progress.'; end if;

  feedback := public.submit_practice_answer(session_id, test_question, 'A');
  if not (feedback ->> 'correct')::boolean or not (feedback ->> 'completed')::boolean
    or not feedback ? 'correctAnswers' or not feedback ? 'rationaleHtml' then
    raise exception 'Correct feedback or completion state was invalid.';
  end if;
  if (select count(*) <> 2 from public.answer_attempts a where a.session_id = integration.session_id) then
    raise exception 'The quiz did not record exactly two attempts.';
  end if;
  if not exists (
    select 1 from public.user_question_progress
    where user_id = learner_a and question_id = test_question and status = 'review'
  ) then raise exception 'A retry incorrectly mastered the question.'; end if;

  insert into private.legacy_claims (token_hash, source_user_id, payload)
  values (
    extensions.digest(convert_to(repeat('b', 64), 'UTF8'), 'sha256'),
    'test-empty',
    '{"practice_sessions":[],"practice_session_items":[],"answer_attempts":[],"user_question_progress":[]}'
  );
  perform set_config('request.jwt.claim.sub', learner_b::text, true);
  claim_result := public.claim_legacy_history(repeat('b', 64));
  if (claim_result ->> 'sessions')::integer <> 0 then raise exception 'Empty claim returned a wrong count.'; end if;

  failed_as_expected := false;
  begin
    perform public.claim_legacy_history(repeat('b', 64));
  exception when others then
    if sqlerrm <> 'That claim token is invalid or has already been used.' then raise; end if;
    failed_as_expected := true;
  end;
  if not failed_as_expected then raise exception 'A one-time claim token was reused.'; end if;

  insert into private.legacy_claims (token_hash, source_user_id, payload)
  values (
    extensions.digest(convert_to(repeat('c', 64), 'UTF8'), 'sha256'),
    'test-rollback',
    jsonb_build_object(
      'practice_sessions', jsonb_build_array(jsonb_build_object(
        'id', bad_session, 'mode', 'random', 'requested_count', 1, 'status', 'completed',
        'topic_filters', jsonb_build_array(), 'created_at', now(), 'completed_at', now(), 'abandoned_at', null
      )),
      'practice_session_items', jsonb_build_array(jsonb_build_object(
        'session_id', bad_session, 'question_id', 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        'position', 0, 'first_attempt_correct', true, 'retry_count', 0, 'resolved_at', now()
      )),
      'answer_attempts', jsonb_build_array(),
      'user_question_progress', jsonb_build_array()
    )
  );
  perform set_config('request.jwt.claim.sub', learner_c::text, true);
  failed_as_expected := false;
  begin
    perform public.claim_legacy_history(repeat('c', 64));
  exception when foreign_key_violation then
    failed_as_expected := true;
  end;
  if not failed_as_expected then raise exception 'An invalid claim did not fail.'; end if;
  if exists (select 1 from public.practice_sessions where user_id = learner_c)
    or not exists (select 1 from private.legacy_claims where source_user_id = 'test-rollback' and claimed_at is null) then
    raise exception 'A failed legacy claim was partially applied.';
  end if;

  run_id := public.begin_question_sync('manual-cli');
  insert into public.question_sync_staging (
    run_id, id, display_id, section, domain_code, domain_name, skill_code, skill_name,
    difficulty, type, stem_html, rationale_html, answer_options, correct_answers,
    is_active_test, content_hash
  ) values (
    run_id, 'ffffffff-ffff-4fff-8fff-fffffffffff0', 'DBTEST1', 'math', 'DBTEST',
    'Database test', 'DBTESTSKILL2', 'Conflicting sync test', 'medium', 'mcq',
    '<p>Conflict.</p>', '<p>Conflict.</p>', '[]', array['A'], false, repeat('f', 64)
  );
  failed_as_expected := false;
  begin
    perform public.finalize_question_sync(run_id);
  exception when unique_violation then
    failed_as_expected := true;
  end;
  if not failed_as_expected then raise exception 'A conflicting synchronization unexpectedly finalized.'; end if;
  if (select is_retired from public.questions where id = test_question)
    or not exists (select 1 from public.sync_runs where id = run_id and status = 'running')
    or not exists (select 1 from public.question_sync_staging where question_sync_staging.run_id = integration.run_id) then
    raise exception 'A failed synchronization partially changed the active bank.';
  end if;
end;
$$;

select pass('practice, secrecy, claim, and synchronization transactions are atomic');
select * from finish();
rollback;
