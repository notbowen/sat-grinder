update public.sync_runs
set trigger_source = 'manual-cli'
where trigger_source = 'legacy-admin';

alter table public.sync_runs
  drop constraint if exists sync_runs_trigger_source_check;
alter table public.sync_runs
  add constraint sync_runs_trigger_source_check
  check (trigger_source in ('github-action', 'manual-cli'));

drop function if exists public.claim_legacy_history(text);
drop table if exists private.legacy_claims;
alter table public.profiles drop column if exists legacy_claimed_at;
