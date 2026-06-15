-- claim_nickname compares nicknames through the citext extension. The API
-- hardening migration removed the trusted extensions schema from its fixed
-- search_path, causing valid claims to fail with PostgreSQL error 42704.

do $$
begin
  if to_regprocedure('public.claim_nickname(text)') is null then
    raise exception 'Required RPC public.claim_nickname(text) is missing';
  end if;

  if not exists (
    select 1
    from pg_extension
    where extname = 'citext'
  ) then
    raise exception 'Required extension citext is missing';
  end if;
end
$$;

alter function public.claim_nickname(text)
set search_path to public, extensions, pg_temp;
