-- Make leaderboards include every game mode (classic, daily, reverse) instead
-- of silently dropping anything that is not 'classic'. The RPCs now accept an
-- optional p_mode filter, expose r.mode in the payload, and keep one best run
-- per (nickname, mode) so reverse and classic high-scores can coexist.

drop function if exists public.top_leaderboard(integer, text);

create or replace function public.top_leaderboard(
  p_limit integer default 100,
  p_difficulty text default null,
  p_mode text default null
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
      select distinct on (lower(btrim(p.nickname)), r.mode)
        r.id,
        p.nickname,
        r.score,
        r.difficulty,
        r.categories,
        r.level_name,
        r.achievements,
        r.mode,
        r.created_at
      from public.runs r
      join public.profiles p on p.id = r.user_id
      where
        nullif(btrim(p.nickname), '') is not null
        and (p_difficulty is null or r.difficulty = p_difficulty)
        and (p_mode is null or r.mode = p_mode)
      order by lower(btrim(p.nickname)), r.mode, r.score desc, r.created_at desc
    ) best_rows
    order by best_rows.score desc, best_rows.created_at asc
    limit least(greatest(coalesce(p_limit, 100), 1), 100)
  ) limited_rows;
$$;

revoke all privileges on function public.top_leaderboard(integer, text, text)
  from public, anon, authenticated;
grant execute on function public.top_leaderboard(integer, text, text)
  to anon, authenticated;

drop function if exists public.weekly_leaderboard(integer);

create or replace function public.weekly_leaderboard(
  p_limit integer default 100,
  p_mode text default null
)
returns table(
  rank bigint,
  nickname text,
  best_score integer,
  difficulty text,
  mode text,
  level_name text,
  achievements text[],
  played_at timestamptz,
  games_played bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with bucket as (
    select
      r.user_id,
      p.nickname::text as nickname,
      r.score,
      r.difficulty,
      r.mode,
      r.level_name,
      r.achievements,
      r.created_at,
      r.id
    from public.runs r
    join public.profiles p on p.id = r.user_id
    where
      nullif(btrim(p.nickname), '') is not null
      and (p_mode is null or r.mode = p_mode)
      and r.created_at >= public.current_week_start()::timestamptz
      and r.created_at <  (public.current_week_start() + interval '7 days')::timestamptz
  ),
  best_per_user as (
    select distinct on (user_id, mode)
      user_id,
      nickname,
      score as best_score,
      difficulty,
      mode,
      level_name,
      achievements,
      created_at as played_at
    from bucket
    order by user_id, mode, score desc, created_at asc
  ),
  counts as (
    select user_id, mode, count(*) as games_played
    from bucket
    group by user_id, mode
  )
  select
    row_number() over (order by b.best_score desc, b.played_at asc) as rank,
    b.nickname,
    b.best_score,
    b.difficulty,
    b.mode,
    b.level_name,
    b.achievements,
    b.played_at,
    c.games_played
  from best_per_user b
  join counts c using (user_id, mode)
  order by b.best_score desc, b.played_at asc
  limit greatest(1, least(p_limit, 200));
$$;

revoke all privileges on function public.weekly_leaderboard(integer, text)
  from public, anon, authenticated;
grant execute on function public.weekly_leaderboard(integer, text)
  to anon, authenticated;
