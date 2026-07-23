-- Keep server-authoritative scoring aligned with src/config/gameConfig.ts.
-- This revision softens wrong-answer, time, and distance penalties and fixes
-- two legacy mismatches: hints were counted as wrong guesses, and the streak
-- bonus started one round later on the server than it did in the client.

create or replace function public.submit_run(
  p_results       jsonb,
  p_difficulty    text,
  p_categories    text[],
  p_session_id    text,
  p_mode          text        default 'classic',
  p_daily_date    date        default null,
  p_achievements  text[]      default '{}',
  p_level_name    text        default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_user_id        uuid := auth.uid();
  v_score          integer := 0;
  v_round          jsonb;
  v_round_score    integer;
  v_max_total      constant integer := 50000;
  v_xp_award       integer;
  v_run_id         uuid;
  v_last_run_at    timestamptz;
  v_any_correct    boolean := false;
  v_min_correct_time numeric := null;
  v_zero_hints_correct boolean := false;
  v_continents     text[] := '{}';
  v_continent      text;
  v_existing_id    uuid;
  v_existing_score integer;
  v_existing_xp    integer;
  v_profile        profiles%rowtype;
  v_unlocked       text[];
  v_unlocked_now   text[] := '{}';
  v_scholar_streak integer;
  v_allowed_hint   constant text[] := array['silk_road'];
  v_hint           text;
  v_wrong          integer;
  v_time_used      numeric;
  v_extra_used     numeric;
  v_effective_time numeric;
  v_time_bonus     integer;
  v_streak_bonus   integer;
  v_prev_first_correct boolean := false;
  v_streak         boolean := false;
  v_distance_km    numeric;
  v_round_seconds  integer;
  v_location_pts   integer;
  v_speed_pts      integer;
  v_reverse_location_points constant numeric := 4600.0;
  v_reverse_speed_points    constant numeric := 400.0;
  v_perfect_radius_km       constant numeric := 25.0;
  v_distance_decay_km       constant numeric := 1500.0;
  v_max_scoring_distance_km constant numeric := 8000.0;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if p_session_id is not null then
    select id, score, greatest(50, score / 18)
      into v_existing_id, v_existing_score, v_existing_xp
      from runs
      where user_id = v_user_id and session_id = p_session_id
      limit 1;
    if v_existing_id is not null then
      return jsonb_build_object(
        'run_id', v_existing_id,
        'score', v_existing_score,
        'xp_awarded', v_existing_xp,
        'idempotent', true
      );
    end if;
  end if;

  if p_difficulty not in ('Explorer', 'Scholar', 'Conqueror') then
    raise exception 'BAD_DIFFICULTY';
  end if;
  if p_mode not in ('classic', 'daily', 'reverse') then
    raise exception 'BAD_MODE';
  end if;
  if jsonb_typeof(p_results) <> 'array' then
    raise exception 'BAD_RESULTS_SHAPE';
  end if;
  if jsonb_array_length(p_results) = 0 or jsonb_array_length(p_results) > 5 then
    raise exception 'BAD_RESULTS_LENGTH';
  end if;

  v_round_seconds := case p_difficulty
    when 'Scholar' then 24
    when 'Conqueror' then 18
    else 30
  end;

  for v_round in select * from jsonb_array_elements(p_results) loop
    if (v_round->>'hintsUsed') is null
      or (v_round->>'wrongGuesses') is null
      or (v_round->>'timeUsed') is null
      or (v_round->>'correct') is null then
      raise exception 'BAD_RESULTS_SHAPE';
    end if;

    v_wrong := least(20, greatest(0, coalesce((v_round->>'wrongGuesses')::integer, 0)));
    v_time_used := greatest(0, least(60, coalesce((v_round->>'timeUsed')::numeric, 0)));
    v_extra_used := greatest(
      0,
      least(v_time_used, coalesce((v_round->>'extraUsed')::numeric, 0))
    );

    if p_mode = 'reverse' then
      v_distance_km := greatest(0, coalesce((v_round->>'distanceKm')::numeric, 99999));
      if v_distance_km >= v_max_scoring_distance_km then
        v_round_score := 0;
      else
        v_location_pts := case
          when v_distance_km <= v_perfect_radius_km then v_reverse_location_points::integer
          else round(
            v_reverse_location_points *
            exp(-((v_distance_km - v_perfect_radius_km) / v_distance_decay_km))
          )::integer
        end;
        v_speed_pts := round(
          v_reverse_speed_points *
          greatest(0.0, least(1.0, 1.0 - v_time_used / v_round_seconds::numeric))
        )::integer;
        v_round_score := v_location_pts + v_speed_pts;
      end if;
    else
      v_streak :=
        coalesce((v_round->>'correct')::boolean, false)
        and coalesce((v_round->>'firstGuess')::boolean, false)
        and v_prev_first_correct;

      if coalesce((v_round->>'correct')::boolean, false) then
        -- timeUsed stores total elapsed time. Extra-bank seconds count at half
        -- weight, matching calcRoundScore on the client.
        v_effective_time := greatest(0, v_time_used - v_extra_used * 0.5);
        v_time_bonus := greatest(
          0,
          round((1.0 - v_effective_time / v_round_seconds::numeric) * 500)::integer
        );
        v_streak_bonus := case when v_streak then 500 else 0 end;
        v_round_score := greatest(0, 5000 - v_wrong * 700 + v_time_bonus + v_streak_bonus);
      else
        v_round_score := 0;
      end if;

      v_prev_first_correct :=
        coalesce((v_round->>'correct')::boolean, false)
        and coalesce((v_round->>'firstGuess')::boolean, false);
    end if;

    v_score := v_score + v_round_score;

    if coalesce((v_round->>'correct')::boolean, false) then
      v_any_correct := true;
      if v_min_correct_time is null or v_time_used < v_min_correct_time then
        v_min_correct_time := v_time_used;
      end if;
      if coalesce((v_round->>'hintsUsed')::integer, 0) = 0 then
        v_zero_hints_correct := true;
      end if;
      v_continent := nullif(v_round->>'continent', 'Unknown');
      if v_continent is not null then
        v_continents := array(
          select distinct item
          from unnest(v_continents || array[v_continent]) as item
        );
      end if;
    end if;
  end loop;

  if v_score > v_max_total then
    raise exception 'BAD_TOTAL_SCORE';
  end if;
  if p_categories is null
    or cardinality(p_categories) = 0
    or cardinality(p_categories) > 20 then
    raise exception 'BAD_CATEGORIES';
  end if;

  if p_mode = 'daily' then
    if p_daily_date is null then
      raise exception 'DAILY_DATE_REQUIRED';
    end if;
    if p_daily_date <> current_date then
      raise exception 'DAILY_DATE_INVALID';
    end if;
    if exists (
      select 1
      from runs
      where user_id = v_user_id and mode = 'daily' and daily_date = p_daily_date
    ) then
      raise exception 'DAILY_ALREADY_PLAYED';
    end if;
  end if;

  select max(created_at)
    into v_last_run_at
    from runs
    where user_id = v_user_id;
  if v_last_run_at is not null and now() - v_last_run_at < interval '2 minutes' then
    raise exception 'RATE_LIMIT';
  end if;

  select *
    into v_profile
    from profiles
    where id = v_user_id;
  if not found then
    insert into profiles (id) values (v_user_id);
    select * into v_profile from profiles where id = v_user_id;
  end if;

  v_unlocked := coalesce(v_profile.unlocked_achievements, '{}');
  if v_any_correct
    and not v_profile.correct_ever
    and not ('first_blood' = any(v_unlocked)) then
    v_unlocked_now := v_unlocked_now || array['first_blood'];
  end if;
  if v_min_correct_time is not null
    and v_min_correct_time < 5
    and not ('lightning_round' = any(v_unlocked)) then
    v_unlocked_now := v_unlocked_now || array['lightning_round'];
  end if;
  if p_difficulty = 'Conqueror'
    and v_zero_hints_correct
    and not ('ice_cold' = any(v_unlocked)) then
    v_unlocked_now := v_unlocked_now || array['ice_cold'];
  end if;
  if cardinality(v_continents) >= 5
    and not ('around_the_world' = any(v_unlocked)) then
    v_unlocked_now := v_unlocked_now || array['around_the_world'];
  end if;
  if v_score >= 27000 and not ('great_khan' = any(v_unlocked)) then
    v_unlocked_now := v_unlocked_now || array['great_khan'];
  end if;

  v_scholar_streak := case
    when v_any_correct and p_difficulty in ('Scholar', 'Conqueror')
      then v_profile.scholar_win_streak + 1
    else 0
  end;
  if v_scholar_streak >= 5 and not ('on_fire' = any(v_unlocked)) then
    v_unlocked_now := v_unlocked_now || array['on_fire'];
  end if;

  if p_achievements is not null then
    if cardinality(p_achievements) > 20 then
      raise exception 'BAD_ACHIEVEMENTS';
    end if;
    foreach v_hint in array p_achievements loop
      if v_hint = any(v_allowed_hint) and not (v_hint = any(v_unlocked)) then
        v_unlocked_now := v_unlocked_now || array[v_hint];
      end if;
    end loop;
  end if;

  v_unlocked_now := array(select distinct item from unnest(v_unlocked_now) as item);
  v_xp_award := greatest(50, v_score / 18);

  insert into runs (
    user_id,
    score,
    difficulty,
    categories,
    mode,
    daily_date,
    results,
    achievements,
    level_name,
    session_id
  ) values (
    v_user_id,
    v_score,
    p_difficulty,
    p_categories,
    p_mode,
    p_daily_date,
    p_results,
    v_unlocked_now,
    p_level_name,
    p_session_id
  ) returning id into v_run_id;

  update profiles
  set
    xp = xp + v_xp_award,
    personal_best = greatest(personal_best, v_score),
    total_games = total_games + 1,
    correct_ever = correct_ever or v_any_correct,
    scholar_win_streak = v_scholar_streak,
    unlocked_achievements = array(
      select distinct item
      from unnest(unlocked_achievements || v_unlocked_now) as item
    ),
    daily_streak = case
      when p_mode = 'daily' and last_daily_played_on = p_daily_date - interval '1 day'
        then daily_streak + 1
      when p_mode = 'daily'
        and (last_daily_played_on is null or last_daily_played_on < p_daily_date - interval '1 day')
        then 1
      else daily_streak
    end,
    last_daily_played_on = case
      when p_mode = 'daily' then p_daily_date
      else last_daily_played_on
    end,
    updated_at = now()
  where id = v_user_id;

  insert into play_events (user_id, day)
  values (v_user_id, current_date)
  on conflict do nothing;

  return jsonb_build_object(
    'run_id', v_run_id,
    'score', v_score,
    'xp_awarded', v_xp_award,
    'unlocked_now', to_jsonb(v_unlocked_now)
  );
end;
$$;
