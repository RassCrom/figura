-- Reset public player profiles and all leaderboard data without deleting
-- Supabase Auth identities, daily challenge definitions, or play events.

delete from public.runs;
delete from public.weekly_winners;
delete from public.profiles;
