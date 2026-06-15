-- Public browser clients must use narrow RPCs instead of reading internal
-- profile IDs, complete run payloads, or archive JSON directly.

do $$
declare
  required_name text;
  required_names text[] := array[
    'archive_week',
    'claim_nickname',
    'get_public_profile',
    'players_today',
    'submit_run',
    'weekly_leaderboard'
  ];
  function_record record;
begin
  foreach required_name in array required_names loop
    if not exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = required_name
    ) then
      raise exception 'Required RPC public.% is missing', required_name;
    end if;
  end loop;

  for function_record in
    select p.oid::regprocedure as signature, p.proname, p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any(required_names)
  loop
    if not function_record.prosecdef then
      raise exception
        'RPC % must be reviewed and changed to SECURITY DEFINER before applying this migration',
        function_record.signature;
    end if;

    execute format(
      'alter function %s set search_path to public, pg_temp',
      function_record.signature
    );
  end loop;
end
$$;

create or replace function public.top_leaderboard(
  p_limit integer default 100,
  p_difficulty text default null
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    jsonb_agg(to_jsonb(limited_rows) order by limited_rows.score desc, limited_rows.created_at asc),
    '[]'::jsonb
  )
  from (
    select best_rows.*
    from (
      select distinct on (lower(btrim(p.nickname)))
        r.id,
        p.nickname,
        r.score,
        r.difficulty,
        r.categories,
        r.level_name,
        r.achievements,
        r.created_at
      from public.runs r
      join public.profiles p on p.id = r.user_id
      where
        r.mode = 'classic'
        and nullif(btrim(p.nickname), '') is not null
        and (p_difficulty is null or r.difficulty = p_difficulty)
      order by lower(btrim(p.nickname)), r.score desc, r.created_at desc
    ) best_rows
    order by best_rows.score desc, best_rows.created_at asc
    limit least(greatest(coalesce(p_limit, 100), 1), 100)
  ) limited_rows;
$$;

create or replace function public.daily_leaderboard(
  p_daily_date date,
  p_difficulty text default null,
  p_limit integer default 100
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    jsonb_agg(to_jsonb(limited_rows) order by limited_rows.score desc, limited_rows.created_at asc),
    '[]'::jsonb
  )
  from (
    select best_rows.*
    from (
      select distinct on (lower(btrim(p.nickname)))
        r.id,
        p.nickname,
        r.score,
        r.difficulty,
        r.categories,
        r.level_name,
        r.achievements,
        r.created_at
      from public.runs r
      join public.profiles p on p.id = r.user_id
      where
        r.mode = 'daily'
        and r.daily_date = p_daily_date
        and nullif(btrim(p.nickname), '') is not null
        and (p_difficulty is null or r.difficulty = p_difficulty)
      order by lower(btrim(p.nickname)), r.score desc, r.created_at desc
    ) best_rows
    order by best_rows.score desc, best_rows.created_at asc
    limit least(greatest(coalesce(p_limit, 100), 1), 100)
  ) limited_rows;
$$;

create or replace function public.daily_percentile(
  p_daily_date date,
  p_score integer
)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with counts as (
    select
      count(*) filter (where r.score < p_score) as below_count,
      count(*) as total_count
    from public.runs r
    where r.mode = 'daily' and r.daily_date = p_daily_date
  )
  select case
    when total_count = 0 then null
    else round((below_count::numeric / total_count::numeric) * 100)::integer
  end
  from counts;
$$;

create or replace function public.hall_of_fame(p_limit integer default 20)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'week_start', archives.week_start,
        'winners', archives.winners
      )
      order by archives.week_start desc
    ),
    '[]'::jsonb
  )
  from (
    select
      ww.week_start,
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'nickname', item.winner ->> 'nickname',
              'best_score', item.winner -> 'best_score',
              'difficulty', item.winner ->> 'difficulty',
              'level_name', item.winner ->> 'level_name',
              'achievements', coalesce(item.winner -> 'achievements', '[]'::jsonb),
              'played_at', item.winner ->> 'played_at'
            )
            order by item.ordinality
          )
          from jsonb_array_elements(coalesce(ww.winners::jsonb, '[]'::jsonb))
            with ordinality as item(winner, ordinality)
        ),
        '[]'::jsonb
      ) as winners
    from public.weekly_winners ww
    order by ww.week_start desc
    limit least(greatest(coalesce(p_limit, 20), 1), 52)
  ) archives;
$$;

alter table public.daily_challenges enable row level security;
alter table public.play_events enable row level security;
alter table public.profiles enable row level security;
alter table public.runs enable row level security;
alter table public.weekly_winners enable row level security;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where
      schemaname = 'public'
      and tablename = any(array[
        'daily_challenges',
        'play_events',
        'profiles',
        'runs',
        'weekly_winners'
      ])
  loop
    execute format(
      'drop policy %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end
$$;

create policy profiles_select_own
on public.profiles
for select
to authenticated
using (id = auth.uid());

revoke all privileges
on table
  public.daily_challenges,
  public.play_events,
  public.profiles,
  public.runs,
  public.weekly_winners
from public, anon, authenticated;

grant select on table public.profiles to authenticated;

do $$
declare
  function_record record;
begin
  for function_record in
    select p.oid::regprocedure as signature, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where
      n.nspname = 'public'
      and p.proname = any(array[
        'archive_week',
        'claim_nickname',
        'current_week_start',
        'get_public_profile',
        'players_today',
        'submit_run',
        'weekly_leaderboard'
      ])
  loop
    execute format(
      'revoke all privileges on function %s from public, anon, authenticated',
      function_record.signature
    );

    if function_record.proname in ('claim_nickname', 'submit_run') then
      execute format(
        'grant execute on function %s to authenticated',
        function_record.signature
      );
    elsif function_record.proname = 'archive_week' then
      execute format(
        'grant execute on function %s to service_role',
        function_record.signature
      );
    elsif function_record.proname <> 'current_week_start' then
      execute format(
        'grant execute on function %s to anon, authenticated',
        function_record.signature
      );
    end if;
  end loop;
end
$$;

revoke all privileges
on function public.top_leaderboard(integer, text)
from public, anon, authenticated;
grant execute
on function public.top_leaderboard(integer, text)
to anon, authenticated;

revoke all privileges
on function public.daily_leaderboard(date, text, integer)
from public, anon, authenticated;
grant execute
on function public.daily_leaderboard(date, text, integer)
to anon, authenticated;

revoke all privileges
on function public.daily_percentile(date, integer)
from public, anon, authenticated;
grant execute
on function public.daily_percentile(date, integer)
to anon, authenticated;

revoke all privileges
on function public.hall_of_fame(integer)
from public, anon, authenticated;
grant execute
on function public.hall_of_fame(integer)
to anon, authenticated;
