create or replace function public.remove_friend(p_friend_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  removed integer;
begin
  if caller_id is null then raise exception 'Authentication required.'; end if;
  if p_friend_id is null or p_friend_id = caller_id then
    raise exception 'Choose a valid friend.';
  end if;

  delete from public.friendships as friendship
  where friendship.status = 'accepted'
    and (
      (friendship.requester_id = caller_id and friendship.addressee_id = p_friend_id)
      or (friendship.requester_id = p_friend_id and friendship.addressee_id = caller_id)
    );
  get diagnostics removed = row_count;

  if removed <> 1 then raise exception 'Friend not found.'; end if;
end;
$$;

revoke execute on function public.remove_friend(uuid) from public, anon;
grant execute on function public.remove_friend(uuid) to authenticated;
