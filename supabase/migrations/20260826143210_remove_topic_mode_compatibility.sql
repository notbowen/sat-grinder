alter table public.practice_sessions
  drop constraint if exists practice_sessions_mode_check;
alter table public.practice_sessions
  add constraint practice_sessions_mode_check check (mode = 'random');
