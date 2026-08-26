alter function public.get_dashboard(text, text) rename to get_dashboard_analytics;

revoke all on function public.get_dashboard_analytics(text, text) from public, anon, authenticated;

create or replace function public.get_dashboard(
  p_window text default '30d',
  p_timezone text default 'UTC'
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with analytics as (
    select public.get_dashboard_analytics(p_window, p_timezone) as value
  )
  select (value - 'review') || pg_catalog.jsonb_build_object(
    'total', value #> '{snapshot,total}',
    'mastered', value #> '{snapshot,mastered}',
    'remaining', pg_catalog.to_jsonb(
      (value #>> '{snapshot,total}')::integer - (value #>> '{snapshot,mastered}')::integer
    ),
    'review', value #> '{snapshot,review}',
    'reviewAnalytics', value -> 'review',
    'topics', value -> 'skills'
  )
  from analytics;
$$;

revoke execute on function public.get_dashboard(text, text) from public, anon;
grant execute on function public.get_dashboard(text, text) to authenticated;
