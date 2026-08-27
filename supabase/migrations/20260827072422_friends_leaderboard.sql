-- Private friend requests and accepted-friends-only progress comparisons.
create table public.friendships (
  id uuid primary key default extensions.gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  accepted_at timestamptz,
  check (requester_id <> addressee_id),
  check (
    (status = 'pending' and accepted_at is null)
    or (status = 'accepted' and accepted_at is not null)
  )
);

create unique index friendships_unique_pair
  on public.friendships (
    (case when requester_id < addressee_id then requester_id else addressee_id end),
    (case when requester_id < addressee_id then addressee_id else requester_id end)
  );
create index friendships_addressee_pending
  on public.friendships (addressee_id, created_at desc)
  where status = 'pending';
create index friendships_requester_status
  on public.friendships (requester_id, status);
create index friendships_addressee_status
  on public.friendships (addressee_id, status);

alter table public.friendships enable row level security;
create policy deny_direct_friendships on public.friendships
  for all to anon, authenticated using (false) with check (false);

revoke all on table public.friendships from public, anon, authenticated;
grant all on table public.friendships to service_role;

-- OAuth providers remain the source of truth for account names and avatars. Existing
-- profiles are backfilled, and each successful OAuth callback refreshes these fields.
update public.profiles as profile
set avatar_url = nullif(pg_catalog.btrim(coalesce(
    auth_user.raw_user_meta_data ->> 'avatar_url',
    auth_user.raw_user_meta_data ->> 'picture'
  )), ''),
  updated_at = now()
from auth.users as auth_user
where profile.id = auth_user.id
  and profile.avatar_url is null
  and nullif(pg_catalog.btrim(coalesce(
    auth_user.raw_user_meta_data ->> 'avatar_url',
    auth_user.raw_user_meta_data ->> 'picture'
  )), '') is not null;

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
    nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(pg_catalog.split_part(coalesce(new.email, ''), '@', 1), ''),
    'Learner'
  );

  insert into public.profiles (id, name, avatar_url)
  values (
    new.id,
    pg_catalog.left(display_name, 120),
    nullif(pg_catalog.btrim(coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    )), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.sync_oauth_profile()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  synced_profile jsonb;
begin
  if caller_id is null then raise exception 'Authentication required.'; end if;

  update public.profiles as profile
  set name = pg_catalog.left(coalesce(
      nullif(pg_catalog.btrim(auth_user.raw_user_meta_data ->> 'full_name'), ''),
      nullif(pg_catalog.btrim(auth_user.raw_user_meta_data ->> 'name'), ''),
      nullif(pg_catalog.split_part(coalesce(auth_user.email, ''), '@', 1), ''),
      profile.name
    ), 120),
    avatar_url = coalesce(
      nullif(pg_catalog.btrim(auth_user.raw_user_meta_data ->> 'avatar_url'), ''),
      nullif(pg_catalog.btrim(auth_user.raw_user_meta_data ->> 'picture'), ''),
      profile.avatar_url
    ),
    updated_at = pg_catalog.statement_timestamp()
  from auth.users as auth_user
  where profile.id = caller_id and auth_user.id = caller_id
  returning pg_catalog.jsonb_build_object(
    'id', profile.id,
    'name', profile.name,
    'avatarUrl', profile.avatar_url
  ) into synced_profile;

  if synced_profile is null then raise exception 'Account profile not found.'; end if;
  return synced_profile;
end;
$$;

-- Avatar URLs are accepted only from the authenticated OAuth identity, rather than
-- arbitrary profile updates that would be rendered to friends.
revoke update (avatar_url) on table public.profiles from authenticated;

create or replace function public.send_friend_request(p_email text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  requested_email text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_email, '')));
  target_id uuid;
  existing public.friendships%rowtype;
  request_id uuid;
begin
  if caller_id is null then raise exception 'Authentication required.'; end if;
  if requested_email = '' or pg_catalog.char_length(requested_email) > 320 then
    raise exception 'Enter a valid email address.';
  end if;

  select auth_user.id into target_id
  from auth.users as auth_user
  where pg_catalog.lower(auth_user.email) = requested_email
  limit 1;

  if target_id is null then
    raise exception 'No SAT Grinder account uses that email yet.';
  end if;
  if target_id = caller_id then
    raise exception 'You cannot send a friend request to yourself.';
  end if;

  select friendship.* into existing
  from public.friendships as friendship
  where (friendship.requester_id = caller_id and friendship.addressee_id = target_id)
     or (friendship.requester_id = target_id and friendship.addressee_id = caller_id)
  limit 1;

  if existing.id is not null then
    if existing.status = 'accepted' then
      raise exception 'You are already friends.';
    elsif existing.requester_id = caller_id then
      raise exception 'Your friend request is already pending.';
    else
      raise exception 'This person already sent you a request. Accept it below.';
    end if;
  end if;

  insert into public.friendships (requester_id, addressee_id)
  values (caller_id, target_id)
  returning id into request_id;

  return request_id;
exception
  when unique_violation then
    raise exception 'A friend request already exists between these accounts.';
end;
$$;

create or replace function public.respond_to_friend_request(
  p_request_id uuid,
  p_accept boolean
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  changed integer;
begin
  if caller_id is null then raise exception 'Authentication required.'; end if;
  if p_request_id is null or p_accept is null then
    raise exception 'Choose a valid friend request response.';
  end if;

  if p_accept then
    update public.friendships
    set status = 'accepted',
      accepted_at = pg_catalog.statement_timestamp(),
      updated_at = pg_catalog.statement_timestamp()
    where id = p_request_id and addressee_id = caller_id and status = 'pending';
  else
    delete from public.friendships
    where id = p_request_id and addressee_id = caller_id and status = 'pending';
  end if;
  get diagnostics changed = row_count;

  if changed <> 1 then raise exception 'Pending friend request not found.'; end if;
end;
$$;

create or replace function public.get_friendships()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  result jsonb;
begin
  if caller_id is null then raise exception 'Authentication required.'; end if;

  with accepted as (
    select friendship.id,
      case when friendship.requester_id = caller_id
        then friendship.addressee_id else friendship.requester_id end as friend_id,
      friendship.accepted_at
    from public.friendships as friendship
    where friendship.status = 'accepted'
      and caller_id in (friendship.requester_id, friendship.addressee_id)
  ), friend_profiles as (
    select accepted.id, accepted.friend_id, accepted.accepted_at,
      profile.name, profile.avatar_url, auth_user.email
    from accepted
    join public.profiles as profile on profile.id = accepted.friend_id
    join auth.users as auth_user on auth_user.id = accepted.friend_id
  ), incoming as (
    select friendship.id, friendship.created_at, friendship.requester_id,
      profile.name, profile.avatar_url, auth_user.email
    from public.friendships as friendship
    join public.profiles as profile on profile.id = friendship.requester_id
    join auth.users as auth_user on auth_user.id = friendship.requester_id
    where friendship.addressee_id = caller_id and friendship.status = 'pending'
  ), outgoing as (
    select friendship.id, friendship.created_at, friendship.addressee_id,
      profile.name, profile.avatar_url, auth_user.email
    from public.friendships as friendship
    join public.profiles as profile on profile.id = friendship.addressee_id
    join auth.users as auth_user on auth_user.id = friendship.addressee_id
    where friendship.requester_id = caller_id and friendship.status = 'pending'
  )
  select pg_catalog.jsonb_build_object(
    'friends', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', friend_id,
        'name', name,
        'email', email,
        'avatarUrl', avatar_url,
        'friendsSince', accepted_at
      ) order by pg_catalog.lower(name), friend_id)
      from friend_profiles
    ), '[]'::jsonb),
    'incoming', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', id,
        'userId', requester_id,
        'name', name,
        'email', email,
        'avatarUrl', avatar_url,
        'createdAt', created_at
      ) order by created_at desc)
      from incoming
    ), '[]'::jsonb),
    'outgoing', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', id,
        'userId', addressee_id,
        'name', name,
        'email', email,
        'avatarUrl', avatar_url,
        'createdAt', created_at
      ) order by created_at desc)
      from outgoing
    ), '[]'::jsonb)
  ) into result;

  return result;
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
  if requested_window not in ('7d', '30d', '90d', 'all') then
    raise exception 'Choose a valid leaderboard window.';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_timezone_names as zone
    where zone.name = requested_timezone
  ) then
    raise exception 'Choose a valid time zone.';
  end if;

  window_days := case requested_window
    when '7d' then 7
    when '30d' then 30
    when '90d' then 90
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

revoke execute on function public.sync_oauth_profile() from public, anon;
revoke execute on function public.send_friend_request(text) from public, anon;
revoke execute on function public.respond_to_friend_request(uuid, boolean) from public, anon;
revoke execute on function public.get_friendships() from public, anon;
revoke execute on function public.get_friends_leaderboard(text, text) from public, anon;

grant execute on function public.sync_oauth_profile() to authenticated;
grant execute on function public.send_friend_request(text) to authenticated;
grant execute on function public.respond_to_friend_request(uuid, boolean) to authenticated;
grant execute on function public.get_friendships() to authenticated;
grant execute on function public.get_friends_leaderboard(text, text) to authenticated;
