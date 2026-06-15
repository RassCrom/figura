# Security

## Supabase deployment order

The browser uses a public Supabase anonymous key. Authorization must therefore be enforced by
Postgres grants, RLS, and narrow RPCs rather than by hiding the key.

Apply `supabase/migrations/20260615000000_harden_public_api.sql` before deploying frontend code
that calls `top_leaderboard`, `daily_leaderboard`, `daily_percentile`, or `hall_of_fame`.

The migration intentionally fails if the existing sensitive RPCs are not `SECURITY DEFINER`.
Review those functions before changing that guard. Each security-definer function must:

- set a fixed `search_path`
- derive the caller from `auth.uid()` instead of accepting a user ID
- validate and clamp every client-supplied score, date, array, and limit
- avoid dynamic SQL built from client input

After applying the migration, verify with the public anonymous key that direct requests to
`profiles`, `runs`, `weekly_winners`, `play_events`, and `daily_challenges` return no rows or a
permission error, while the public read RPCs still work.

## Operational checklist

- Keep service-role keys out of browser environment variables, logs, and CI artifacts.
- Restrict `archive_week` and other maintenance RPCs to `service_role`.
- Keep anonymous-auth and RPC rate limits enabled in Supabase.
- Review RLS policies and function grants after every schema change.
- Pin GitHub Actions to immutable commit SHAs when maintaining the workflow.
- Run `pnpm audit` and `pnpm run ci` before releases.

## Reporting

Do not include credentials, access tokens, or personal player data in a vulnerability report.
