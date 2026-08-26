create index idx_legacy_claims_claimed_by on private.legacy_claims (claimed_by);
create index idx_answer_attempts_question_id on public.answer_attempts (question_id);
create index idx_answer_attempts_user_id on public.answer_attempts (user_id);
create index idx_practice_session_items_question_id on public.practice_session_items (question_id);
create index idx_questions_sync_run_id on public.questions (sync_run_id);
create index idx_progress_question_id on public.user_question_progress (question_id);

create policy deny_direct_sync_runs on public.sync_runs
  for all to anon, authenticated using (false) with check (false);
create policy deny_direct_questions on public.questions
  for all to anon, authenticated using (false) with check (false);
create policy deny_direct_question_assets on public.question_assets
  for all to anon, authenticated using (false) with check (false);
create policy deny_direct_practice_sessions on public.practice_sessions
  for all to anon, authenticated using (false) with check (false);
create policy deny_direct_practice_session_items on public.practice_session_items
  for all to anon, authenticated using (false) with check (false);
create policy deny_direct_answer_attempts on public.answer_attempts
  for all to anon, authenticated using (false) with check (false);
create policy deny_direct_progress on public.user_question_progress
  for all to anon, authenticated using (false) with check (false);
create policy deny_direct_sync_staging on public.question_sync_staging
  for all to anon, authenticated using (false) with check (false);
